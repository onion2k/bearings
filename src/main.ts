/**
 * The page: the race drawn, and what the player does to it. Everything that
 * happens on the run happens in `game.ts`; this turns its events into words
 * on the screen and draws the frame, on the game path of artshape-render.
 * There is no game logic here.
 */
import { createContext } from 'artshape-render/gpu/context';
import { Orbit } from 'artshape-render/gpu/camera';
import { bakeEnvironment } from 'artshape-render/render/env';
import { LightPool } from 'artshape-render/game/lights';
import { DEFAULT_POST, GameRenderer } from 'artshape-render/game/renderer';
import { createApi } from './debug';
import { MAX_SLOTS } from './cameras';
import { captionOf, nameOf, swatchOf } from './field';
import { frameCost } from './frame-cost';
import { ABOUT, CATALOG } from './catalog';
import { MAX_DESIGNS, PALETTE } from './designer';
import { Game, type GameEvents, type Shelf } from './game';
import { LOST, STALLED } from './race';
import { Input } from './input';
import { Progress } from './progress';
import { seeded } from './random';
import { Scene, boxOf } from './scene';
import { HALF_WIDTH, type Kind, type Theme } from './track';
import { LIGHTS, WORLDS, bulbOf } from './decor';

/** How many millimetres a world unit is: the renderer fixes a few real sizes by it. */
const MM_PER_UNIT = 100;
const LIGHT_CAPACITY = 16,
  EFFECT_CAPACITY = 16,
  PARTICLE_CAPACITY = 1024;
/** How many of the game's events the test API keeps, before the oldest go. */
const EVENTS_KEPT = 500;
/**
 * How much of the view a run is framed to fill, across and up: a little short
 * of the edges, so the gate at the top and the cup at the bottom are never
 * cut off, whatever shape the screen is.
 */
const FILL = 0.88;
/** How closely the camera chases the leader: a share of the way there each frame. */
const CHASE = 0.06;

const canvas = document.getElementById('view') as HTMLCanvasElement;
const boot = document.getElementById('boot')!;
const bootMsg = document.getElementById('bootMsg')!;
const board = document.getElementById('board')!;
const title = document.getElementById('title')!;
const bestLine = document.getElementById('best')!;
const prev = document.getElementById('prev')!;
const next = document.getElementById('next')!;
const order = document.getElementById('order')!;
const toRuns = document.getElementById('toRuns')!;
const toPieces = document.getElementById('toPieces')!;
const toDesigns = document.getElementById('toDesigns')!;
const picker = document.getElementById('picker')!;
const designTools = document.getElementById('designTools')!;
const newDesign = document.getElementById('newDesign')!;
const forgetDesign = document.getElementById('forget')!;
const builder = document.getElementById('build')!;
const designName = document.getElementById('designName') as HTMLInputElement;
const palette = document.getElementById('palette')!;
const undoPiece = document.getElementById('undo') as HTMLButtonElement;
const gridPiece = document.getElementById('grid') as HTMLButtonElement;
const laneTools = document.getElementById('lanes')!;
const laneLeft = document.getElementById('laneLeft') as HTMLButtonElement;
const themeTools = document.getElementById('themes') as HTMLDivElement;
const themeButtons = Array.from(themeTools.querySelectorAll('button'));
const laneRight = document.getElementById('laneRight') as HTMLButtonElement;
const keepDesign = document.getElementById('keep') as HTMLButtonElement;
const leaveDesign = document.getElementById('leave')!;
const problemList = document.getElementById('problems')!;
const toSplit = document.getElementById('toSplit')!;
const tags = document.getElementById('tags')!;
const verdict = document.getElementById('verdict')!;
const stats = document.getElementById('stats')!;
const help = document.getElementById('help')!;

main().catch((err: unknown) => {
  bootMsg.textContent = err instanceof Error ? err.message : String(err);
  console.error(err);
});

async function main() {
  // Rapier, which races every run: a megabyte of WASM in a chunk of its own, asked for first so that it comes down
  // while the GPU starts and the shaders compile, and waited on only where the game is made
  const physics = import('@dimforge/rapier3d-compat').then(async ({ default: rapier }) => {
    await rapier.init();
    return rapier;
  });

  // ---- the renderer ----

  const ctx = await createContext(canvas);
  // the canvas is drawn into whole, or in four quarters copied into it, so it has to be a place a copy may land
  ctx.context.configure({
    device: ctx.device,
    format: ctx.format,
    alphaMode: 'opaque',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
  });
  bootMsg.textContent = 'compiling shaders…';
  const renderer = new GameRenderer(ctx, LIGHT_CAPACITY, EFFECT_CAPACITY, PARTICLE_CAPACITY, MM_PER_UNIT);
  renderer.look = {
    ...renderer.look,
    sunDir: [0.35, -0.3, 0.89],
    sunColour: [1, 0.96, 0.9],
    exposure: 1.1,
    ambient: 0.65,
    background: [0.04, 0.04, 0.05],
  };
  // both skies a world can reflect, baked once here and switched between as a run is put on
  const envs = {
    studio: bakeEnvironment(ctx, 'studio', { size: 128, mips: 6 }),
    daylight: bakeEnvironment(ctx, 'daylight', { size: 128, mips: 6 }),
    dusk: bakeEnvironment(ctx, 'dusk', { size: 128, mips: 6 }),
  };
  let reflecting: keyof typeof envs = 'studio';
  renderer.setEnvironment(envs.studio.specular, envs.studio.brdf, envs.studio.mips);
  renderer.camera.fov = 40;
  renderer.camera.near = 1;
  // far enough to see a sweet factory's mountains from a phone's framing, which stands furthest back
  renderer.camera.far = 3000;

  // ---- the game, and what it says has happened ----

  const query = new URLSearchParams(location.search);
  const progress = new Progress();
  /**
   * The board, redrawn when something happens. The game announces the run it
   * puts on from inside its own constructor, before there is a game to draw a
   * board from, so this is a no-op until the game exists.
   */
  let refresh = () => {};
  /** What has happened, a line each, for the test API. */
  const eventLog: string[] = [];
  const log = (line: string) => {
    eventLog.push(line);
    if (eventLog.length > EVENTS_KEPT) eventLog.splice(0, eventLog.length - EVENTS_KEPT);
  };
  const events: GameEvents = {
    picked(run, name) {
      log(`picked ${run}`);
      title.textContent = name;
      refresh();
    },
    released(count) {
      log(`released ${count}`);
      refresh();
    },
    finished(marble, place, seconds) {
      log(`finished ${marble} ${place} ${seconds.toFixed(2)}`);
      refresh();
    },
    stalled(marble, seconds) {
      log(`stalled ${marble} ${seconds.toFixed(2)}`);
      refresh();
    },
    lost(marble, seconds) {
      log(`lost ${marble} ${seconds.toFixed(2)}`);
      refresh();
    },
    over(winner, seconds) {
      log(`over ${winner} ${seconds.toFixed(2)}`);
      refresh();
    },
    claimed(marble, player) {
      log(`claimed ${marble} ${player}`);
      refresh();
      // a pick can change how many views the split has, so the grid and its captions redraw with it
      resplit();
    },
  };
  // ?seed=N makes chance the same from before the field is drawn, for a test that wants the same race every run
  const seed = query.get('seed');
  bootMsg.textContent = 'loading physics…';
  const game = new Game(await physics, progress, events, seed !== null ? { random: seeded(+seed) } : {});
  refresh = () => showBoard();

  // ---- the scene ----

  const scene = new Scene();
  let follow = true;
  /** The middle of the run that is on. */
  const home: [number, number, number] = [0, 0, 0];
  const rebuild = () => {
    // the world the run is in: its track's colours, its sky, and the light, as its theme has them
    const world = WORLDS[(game.designer?.run ?? game.current).theme ?? 'plain'];
    renderer.setStatic(scene.static(game.track, game.decor, world.track));
    // a candy world is bright and clean: no darkened corners, which in a pale sky read as a grey haze
    renderer.post = {
      ...renderer.post,
      vignette: world.env === 'daylight' ? 0 : DEFAULT_POST.vignette,
      // a hall at dusk: its lamps and windows bloom a little more than the dark ever did
      bloom: world.env === 'dusk' ? 0.55 : DEFAULT_POST.bloom,
      tone: world.shading === 'toon' ? 'clamp' : 'filmic',
    };
    if (world.env !== reflecting) {
      reflecting = world.env;
      const env = envs[world.env];
      renderer.setEnvironment(env.specular, env.brdf, env.mips);
    }
    renderer.look = {
      ...renderer.look,
      background: world.sky,
      sunColour: world.sunColour,
      exposure: world.exposure,
      ambient: world.ambient,
      shading: world.shading,
    };
    const box = boxOf(game.track);
    renderer.setSunShadow(box);
    const mid: [number, number, number] = [
      (box.min[0] + box.max[0]) / 2,
      (box.min[1] + box.max[1]) / 2,
      (box.min[2] + box.max[2]) / 2,
    ];
    home[0] = mid[0];
    home[1] = mid[1];
    home[2] = mid[2];
    lights.clear();
    lights.add({ position: [mid[0], mid[1], box.max[2] + 20], radius: 160, colour: [1, 0.9, 0.75], intensity: 60 });
    // each lamp, or lollipop, a light of its own in its own colour, hung just under it: as many as the dressing has,
    // which its ceiling keeps inside the pool with the light over the whole run
    for (const d of game.decor) {
      const light = LIGHTS[d.kind];
      if (light) lights.add({ position: bulbOf(game.track, d, bulb), ...light });
    }
    renderer.setLights(lights);
  };
  const lights = new LightPool(LIGHT_CAPACITY);
  const bulb: [number, number, number] = [0, 0, 0];
  renderer.setDynamic(scene.dynamic());
  rebuild();

  const cam = renderer.camera;
  cam.target = [home[0], home[1], home[2]];
  cam.position = [home[0] + 40, home[1] - 50, home[2] + 40];
  const orbit = new Orbit(cam, {
    element: canvas,
    minPolar: 0.15,
    maxPolar: 1.45,
    minDistance: 12,
    // the Stress Test's hundred pieces need a diagonal of about 460 to stand back far enough to fit; the
    // ceiling is comfortably past that, not just past it, so a run laid out even more spread out still frames
    maxDistance: 800,
    rotateSpeed: 0.4,
    zoomSpeed: 0.8,
    panSpeed: 0,
    inertia: 0.5,
  });
  /**
   * The whole of the run in view, from off its shoulder: where the camera
   * starts, and where it goes when another run is put on, so a player sees a
   * run before they see anything race down it. How far back is worked out
   * rather than guessed: from the angle the camera looks at it, every point
   * of the track has to fall inside the view both across and up. A guess from the run's size alone cut the top off a tall run, and on a
   * phone, which is narrow, showed next to none of any of them.
   */
  const frameRun = () => {
    cam.target[0] = home[0];
    cam.target[1] = home[1];
    cam.target[2] = home[2];
    orbit.setSpherical({ azimuth: 0.9, polar: 0.95, radius: 60 });
    for (let i = 0; i < 400; i++) orbit.update();
    cam.update();
    const dx = cam.position[0] - home[0],
      dy = cam.position[1] - home[1],
      dz = cam.position[2] - home[2];
    const d = Math.hypot(dx, dy, dz) || 1;
    const right = cam.right,
      up = cam.up;
    const tallest = Math.tan(((cam.fov / 2) * Math.PI) / 180) * FILL,
      widest = tallest * cam.aspect;
    // every point of the track itself, not the corners of a box round it: a run that goes diagonally leaves
    // a box's corners empty, and framing those shrank the run to a third of a phone's screen
    const pad = HALF_WIDTH + 1;
    let need = 0;
    for (const seg of game.track.segments)
      for (let k = 0; k < seg.points.length; k += 3) {
        const vx = seg.points[k] - home[0],
          vy = seg.points[k + 1] - home[1],
          vz = seg.points[k + 2] - home[2];
        // a point nearer the camera is seen from closer, so it needs the camera further back to fit
        const nearer = (vx * dx + vy * dy + vz * dz) / d;
        const side = Math.abs(vx * right[0] + vy * right[1] + vz * right[2]) + pad;
        const rise = Math.abs(vx * up[0] + vy * up[1] + vz * up[2]) + pad;
        need = Math.max(need, nearer + side / widest, nearer + rise / tallest);
      }
    orbit.setSpherical({ radius: need });
    for (let i = 0; i < 400; i++) orbit.update();
  };

  let width = 1,
    height = 1;
  /**
   * The views of a split screen, each a texture of its own the renderer draws a camera's view into before it
   * is copied on to the canvas: the renderer has one camera and draws the whole of what it is given, so a view
   * is a small screen of its own. Made when the screen is split and on every resize, and let go of when it is
   * whole again. The grid follows the screen's shape so a view is never a long thin strip: four are two and
   * two on a wide screen and one over the next on an upright one, where two and two would be four squares that
   * each show a marble and nothing round it; eight are four across and two down, or two across and four down.
   */
  let quarters: GPUTexture[] = [];
  let quarterWidth = 1,
    quarterHeight = 1,
    columns = 1,
    stacked = false;
  /**
   * How many columns suit `n` views on a screen this shape: never more columns than rows would leave a view
   * a long thin strip. An upright screen wants at most two across, so even eight is a tall two-and-four
   * rather than a wide one-and-eight; a wide screen grows a column at a time as there is more to fit in.
   */
  const columnsFor = (n: number, stacked: boolean): number => {
    if (stacked) return n <= 2 ? 1 : 2;
    if (n <= 2) return n;
    if (n <= 4) return 2;
    if (n <= 6) return 3;
    return 4;
  };
  const layout = () => {
    for (const t of quarters) t.destroy();
    quarters = [];
    const { views } = game;
    if (!views) {
      renderer.resize(width, height);
      return;
    }
    stacked = height > width;
    columns = columnsFor(views, stacked);
    const rows = Math.ceil(views / columns);
    quarterWidth = Math.max(1, Math.floor(width / columns));
    quarterHeight = Math.max(1, Math.floor(height / rows));
    renderer.resize(quarterWidth, quarterHeight);
    quarters = Array.from({ length: views }, () =>
      ctx.device.createTexture({
        label: 'view',
        size: [quarterWidth, quarterHeight],
        format: ctx.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      }),
    );
  };
  /** One caption to a view: a dot of the marble's colour and its name. Made once; only the words change. */
  const captions = Array.from({ length: MAX_SLOTS }, () => {
    const el = document.createElement('span');
    el.className = 'tag';
    el.append(document.createElement('i'), document.createTextNode(''));
    tags.append(el);
    return { el, marble: -2, player: -2, across: '' };
  });
  /**
   * The captions put over their views for the layout there is: over the top of each on a wide screen, where the
   * board, the help line and the count have the corners, and at the foot of each on an upright one, where the
   * board has the top left and there is no help line or count.
   */
  const place = () => {
    const { views } = game;
    tags.hidden = !views;
    board.classList.toggle('split', views > 0);
    const rows = Math.ceil(views / columns);
    captions.forEach((c, s) => {
      c.el.hidden = s >= views;
      c.marble = -2;
      if (s >= views) return;
      const cell = { x: s % columns, y: Math.floor(s / columns) };
      c.across = `${(((cell.x + 0.5) / columns) * 100).toFixed(2)}%`;
      c.el.style.left = c.across;
      c.el.style.top = `${(((cell.y + (stacked ? 1 : 0)) / rows) * 100).toFixed(2)}%`;
      c.el.style.marginTop = stacked ? '-26px' : '8px';
    });
  };
  /** Each caption says who its camera follows, changing only when it does. */
  const say = () => {
    const { views } = game;
    if (!views) return;
    captions.forEach((c, s) => {
      if (s >= views) return;
      const marble = game.cameras.marble[s];
      const player = marble >= 0 ? game.players[marble] : 0;
      if (c.marble === marble && c.player === player) return;
      c.marble = marble;
      c.player = player;
      c.el.hidden = marble < 0;
      (c.el.firstChild as HTMLElement).style.background = swatchOf(marble);
      c.el.lastChild!.textContent = captionOf(marble, player);
      // the first view's caption stays clear of the board over the top left, where a narrow view would put it: by
      // how wide the board is and the caption is, both of which change, since a fixed clearance was overrun as soon
      // as the board grew a tab. It never leaves its own view for it, though: pushed clear at eight views, whose
      // columns are narrow, it ended up over the view beside it, naming a marble that was not in it
      if (s === 0 && !stacked) {
        const clear = board.getBoundingClientRect().right + 8 + c.el.offsetWidth / 2;
        const edge = quarterWidth / (devicePixelRatio > 1.5 ? 1.5 : devicePixelRatio || 1) - c.el.offsetWidth / 2 - 8;
        c.el.style.left = `min(max(${c.across}, ${Math.ceil(clear)}px), ${Math.floor(edge)}px)`;
      }
    });
  };
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    canvas.width = width;
    canvas.height = height;
    layout();
    place();
  };
  /** The screen split in four or whole again, laid out for it, and the board's button told. */
  const resplit = () => {
    layout();
    place();
    if (!game.views) frameRun();
    toSplit.classList.toggle('on', game.views > 0);
    toSplit.textContent = game.views ? `Split ${game.views}` : 'Split';
  };
  const setSplit = (on: boolean) => {
    game.setSplit(on);
    resplit();
  };
  const cycleSplit = () => setSplit(!game.split);
  // a screen that changes shape before the off is framed again for its new shape; once they race, the
  // camera is the leader's
  addEventListener('resize', () => {
    resize();
    if (follow && game.marbles.leader() < 0) frameRun();
  });
  resize();
  frameRun();

  function upload() {
    const n = scene.write(game.marbles);
    renderer.move(0, scene.marbles, n);
    // the sweepers, gates and wheels, placed at the race's own time, so what is drawn is what the marbles meet
    const [sweepers, gates, wheels] = scene.moving(game.marbles);
    renderer.move(1, scene.sweepers, sweepers);
    renderer.move(2, scene.gates, gates);
    renderer.move(3, scene.wheels, wheels);
    // where the next piece of a run being built goes, and nothing over a run being raced
    renderer.move(4, scene.marker, scene.mark(game.track, game.designer?.open ?? null));
    // the cogs, the pistons' rods and the smoke, where the game's own clock has them, so a paused game stands still
    const [cogs, rods, puffs, whisks] = scene.animate(game.decor, game.t);
    renderer.move(5, scene.cogs, cogs);
    renderer.move(6, scene.rods, rods);
    renderer.move(7, scene.whisks, whisks);
    renderer.setSprites(scene.smoke, puffs);
  }

  /**
   * The scene drawn into `target`, a whole screen: one view of it, or four, one to a quarter, each from its
   * own camera. The renderer's clock moves once a frame whichever it is, on the first view alone.
   */
  function present(target: GPUTexture, dt: number): boolean {
    const { views, cameras } = game;
    if (!views) return renderer.frame(target.createView(), 'redraw', dt);
    const eye = [0, 0, 0];
    for (let s = 0; s < views; s++) {
      cameras.eye(s, eye);
      cam.position = [eye[0], eye[1], eye[2]];
      cam.target = [cameras.target[s * 3], cameras.target[s * 3 + 1], cameras.target[s * 3 + 2]];
      cam.update();
      if (!renderer.frame(quarters[s].createView(), 'redraw', s === 0 ? dt : 0)) return false;
    }
    const encoder = ctx.device.createCommandEncoder({ label: 'split screen' });
    // what no quarter reaches, an odd pixel at an edge, is cleared and not left as it was
    encoder
      .beginRenderPass({
        label: 'split screen clear',
        colorAttachments: [
          { view: target.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } },
        ],
      })
      .end();
    for (let s = 0; s < views; s++) {
      const origin = { x: (s % columns) * quarterWidth, y: Math.floor(s / columns) * quarterHeight };
      encoder.copyTextureToTexture(
        { texture: quarters[s] },
        { texture: target, origin },
        { width: quarterWidth, height: quarterHeight },
      );
    }
    ctx.device.queue.submit([encoder.finish()]);
    return true;
  }

  /** What a frame of the scene as it stands costs, drawn to a texture of our own rather than the canvas, so no wait to be shown is counted. */
  async function measureFrame(): Promise<number> {
    const target = ctx.device.createTexture({
      label: 'measuring target',
      size: [width, height],
      format: ctx.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST,
    });
    if (game.views) game.cameras.ease(game.marbles, home, CHASE);
    const cost = await frameCost(
      () => {
        upload();
        return present(target, 1 / 60);
      },
      () => ctx.device.queue.onSubmittedWorkDone(),
    );
    target.destroy();
    return cost;
  }

  /** The order of the race as it stands, for the board, with who has which marble and who has won. */
  function showOrder() {
    const { marbles } = game;
    const best = game.best();
    // a run shows the best time on it, and a piece from the catalog says what it does instead
    bestLine.textContent =
      game.shelf === 'pieces' ? ABOUT[game.run] : best > 0 ? `best ${best.toFixed(2)}s` : 'no best yet';
    const rows = game
      .standing()
      .map((i) => {
        const place = marbles.place[i];
        const state = marbles.state[i];
        const player = game.players[i];
        const when =
          marbles.took[i] > 0
            ? `${marbles.took[i].toFixed(2)}s`
            : state === STALLED
              ? 'stopped'
              : state === LOST
                ? 'lost'
                : '';
        const who = player > 0 ? `<i>P${player}</i>` : '<i class="none"></i>';
        return `<li data-marble="${i}"${place === 1 ? ' class="won"' : ''}>${who}<b>${nameOf(i)}</b><span>${when}</span></li>`;
      })
      .join('');
    order.innerHTML = rows;
    verdict.textContent = sayWho();
  }

  /**
   * The board for whatever is on: the order of the race, with a designs
   * shelf's own buttons under its title, or the builder in its place while a
   * run is being built.
   */
  function showBoard() {
    const building = game.designer !== null;
    toRuns.classList.toggle('on', game.shelf === 'runs' && !building);
    toPieces.classList.toggle('on', game.shelf === 'pieces');
    toDesigns.classList.toggle('on', game.shelf === 'designs');
    picker.hidden = building;
    bestLine.hidden = building;
    order.hidden = building;
    verdict.hidden = building;
    builder.hidden = !building;
    board.classList.toggle('building', building);
    designTools.hidden = building || game.shelf !== 'designs';
    if (building) showBuild();
    else showOrder();
    // the board may have changed its width, and the first view's caption keeps clear of it by measuring it
    for (const c of captions) c.marble = -2;
  }

  /** The builder the name was last cleared for: a new build starts with an empty name, showing the one it would get. */
  let named: unknown = null;
  /** One button to a kind of piece, made once; whether each can go on now changes as the run is built. */
  const kinds = PALETTE.map((kind) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = CATALOG[kind].name;
    b.dataset.kind = kind;
    palette.append(b);
    return b;
  });

  /** The builder: which pieces can go on the end, whether the run can be kept, and what is wrong with it if not. */
  function showBuild() {
    const designer = game.designer!;
    if (named !== designer) {
      named = designer;
      designName.value = '';
    }
    designName.placeholder = designer.run.name;
    for (const b of kinds) {
      const kind = b.dataset.kind as Kind;
      const refused = designer.refuses(kind);
      b.disabled = refused !== '';
      b.title = refused || CATALOG[kind].about;
    }
    undoPiece.disabled = designer.run.pieces.length <= 1;
    // which lane of a split the next piece goes on, pressed, and only while a split is open
    laneTools.hidden = designer.lane === null;
    laneLeft.setAttribute('aria-pressed', String(designer.lane === 'left'));
    laneRight.setAttribute('aria-pressed', String(designer.lane === 'right'));
    // the theme the run is dressed as, pressed
    for (const b of themeButtons)
      b.setAttribute('aria-pressed', String(b.dataset.theme === (designer.run.theme ?? 'plain')));
    // a grid over the last piece laid, pressed while it has one; said why not, where it cannot have one
    const refusedLid = designer.refusesLid();
    const last = designer.run.pieces[designer.run.pieces.length - 1];
    gridPiece.disabled = refusedLid !== '';
    gridPiece.setAttribute('aria-pressed', String(!!last.lid));
    gridPiece.title = refusedLid || (last.lid ? 'Take the grid off the last piece' : 'Put a grid over the last piece');
    const full = game.progress.save.designs.length >= MAX_DESIGNS;
    const problems = full
      ? [`${MAX_DESIGNS} designs are kept already: throw one away to keep another`]
      : designer.problems();
    keepDesign.disabled = problems.length > 0;
    // the first few, which are what to put right first; the rest would only push the board down the screen
    const lines = problems.slice(0, 3);
    if (problems.length > 3) lines.push(`and ${problems.length - 3} more`);
    problemList.replaceChildren(
      ...(lines.length ? lines : ['sound, and ready to keep']).map((line) => {
        const li = document.createElement('li');
        li.textContent = line;
        if (!lines.length) li.className = 'sound';
        return li;
      }),
    );
  }

  /** The line under the board: how to pick before anyone has, and who won once it is over. */
  function sayWho(): string {
    const champion = game.champion();
    if (champion > 0) {
      const won = game.players.indexOf(champion);
      return `P${champion} wins, with ${nameOf(won)}`;
    }
    if (champion === 0) {
      const won = game.standing().find((i) => game.marbles.place[i] === 1);
      return won === undefined ? 'nobody got home' : `${nameOf(won)} wins, and nobody had it`;
    }
    if (game.away) return '';
    return game.players.some((p) => p > 0) ? '' : 'tap a marble to pick it';
  }

  await renderer.ready;
  boot.classList.add('gone');
  board.hidden = false;
  stats.hidden = false;
  help.hidden = false;
  title.textContent = game.track.name;
  showBoard();

  // ---- each frame ----

  let frames = 0;
  let smoothed = 0;
  function simulate(dt: number) {
    frames++;
    game.step(dt);
  }
  function draw(dt: number) {
    // while they race the camera rides with whoever is in front, easing rather than snapping so a pass is
    // worth watching; before the off and after it, it drifts back to take in the whole run. Written in
    // place, since this is every frame and a new array each time would be garbage sixty times a second.
    if (game.views) {
      game.cameras.ease(game.marbles, home, CHASE);
      say();
    } else if (follow) {
      const m = game.marbles;
      const lead = m.leader();
      cam.target[0] += ((lead >= 0 ? m.x[lead] : home[0]) - cam.target[0]) * CHASE;
      cam.target[1] += ((lead >= 0 ? m.y[lead] : home[1]) - cam.target[1]) * CHASE;
      cam.target[2] += ((lead >= 0 ? m.z[lead] : home[2]) - cam.target[2]) * CHASE;
    }
    if (!game.views) {
      orbit.update();
      cam.update();
    }
    upload();
    const t = performance.now();
    present(ctx.context.getCurrentTexture(), dt);
    smoothed += (performance.now() - t - smoothed) * 0.05;
    if (frames % 30 === 0)
      stats.textContent = `${smoothed.toFixed(1)} ms · ${game.marbles.finishers} home · ${game.progress.save.races} races`;
  }

  /** The run on has changed, or the run being built has: built again, framed, and the board redrawn for it. */
  const again = () => {
    rebuild();
    frameRun();
    showBoard();
  };
  /** Another run put on, by the arrows or by N: built, framed, and the board redrawn for it. */
  const step = (by: number) => {
    game.pick(game.run + by);
    again();
  };
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  /** The runs or the catalog of pieces on the board, put on where it was left, built and framed. */
  const shelve = (shelf: Shelf) => {
    game.browse(shelf);
    again();
  };
  toRuns.addEventListener('click', () => shelve('runs'));
  toDesigns.addEventListener('click', () => shelve('designs'));
  newDesign.addEventListener('click', () => {
    game.build();
    again();
  });
  forgetDesign.addEventListener('click', () => {
    game.forget(game.run);
    again();
  });
  palette.addEventListener('click', (e) => {
    const kind = (e.target as HTMLElement).closest('button')?.dataset.kind;
    if (kind && game.lay(kind as Kind)) again();
  });
  undoPiece.addEventListener('click', () => {
    if (game.undo()) again();
  });
  gridPiece.addEventListener('click', () => {
    if (game.lid()) again();
  });
  laneLeft.addEventListener('click', () => {
    if (game.lane('left')) again();
  });
  themeTools.addEventListener('click', (e) => {
    const theme = (e.target as HTMLElement).closest('button')?.dataset.theme;
    if (theme && game.dress(theme as Theme | 'plain')) again();
  });
  laneRight.addEventListener('click', () => {
    if (game.lane('right')) again();
  });
  // a run that cannot be kept is not: the board already says why, and keeps saying it
  keepDesign.addEventListener('click', () => {
    if (game.keep(designName.value).length === 0) again();
  });
  leaveDesign.addEventListener('click', () => {
    game.leave();
    again();
  });
  toSplit.addEventListener('click', cycleSplit);
  toPieces.addEventListener('click', () => shelve('pieces'));
  // a row of the board picked by a tap or a click, for the next player without a marble, or let go again
  order.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest('li');
    if (row?.dataset.marble !== undefined) game.claim(Number(row.dataset.marble));
  });
  new Input((intent) => {
    // a run being built is only left by its own buttons: a stray N or C would throw away what was not kept
    if (game.designer && (intent === 'next' || intent === 'shelf')) return;
    if (intent === 'release') game.release();
    else if (intent === 'reset') game.reset();
    else if (intent === 'next') step(1);
    else if (intent === 'shelf') shelve(game.shelf === 'runs' ? 'pieces' : 'runs');
    else if (intent === 'split') cycleSplit();
    else {
      if (intent.pick < game.marbles.count) game.claim(game.standing()[intent.pick]);
    }
    showBoard();
  });

  // ---- the test API, and the frame loop ----

  // ?paused=1 starts the game stopped where it was built, so a test sees the
  // same race every run: no frame of its own has run, and every one after is
  // the test's, of a length it chose
  let paused = query.has('paused');
  let ready = false;
  let bootMs = 0;
  window.game = createApi({
    game,
    ready: () => ready,
    bootMs: () => bootMs,
    paused: () => paused,
    setPaused: (p) => {
      paused = p;
    },
    simulate,
    draw,
    frame: () => frames,
    rebuild: again,
    look(x, y, z, view) {
      follow = false;
      cam.target = [x, y, z];
      orbit.setSpherical(view);
      for (let i = 0; i < 400; i++) orbit.update();
    },
    setFollow: (on) => {
      follow = on;
    },
    resplit,
    measureFrame,
    chase: () => [cam.target[0], cam.target[1], cam.target[2]],
    sky: () => [...renderer.look.background] as [number, number, number],
    project: (x, y, z) => {
      // the camera's view and projection, as the renderer draws with, to a point on the page's own canvas
      const m = cam.viewProjection;
      const cx = m[0] * x + m[4] * y + m[8] * z + m[12],
        cy = m[1] * x + m[5] * y + m[9] * z + m[13],
        cw = m[3] * x + m[7] * y + m[11] * z + m[15];
      const r = canvas.getBoundingClientRect();
      return [r.left + ((cx / cw + 1) / 2) * r.width, r.top + ((1 - cy / cw) / 2) * r.height];
    },
    events: eventLog,
  });

  let last = performance.now();
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    if (paused) {
      draw(0);
      return;
    }
    simulate(dt);
    draw(dt);
  };
  ready = true;
  bootMs = performance.now();
  requestAnimationFrame(frame);
}
