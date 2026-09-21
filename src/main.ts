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
import { GameRenderer } from 'artshape-render/game/renderer';
import { createApi } from './debug';
import { SLOTS } from './cameras';
import { nameOf } from './field';
import { frameCost } from './frame-cost';
import { ABOUT } from './catalog';
import { Game, type GameEvents, type Shelf } from './game';
import { LOST, STALLED } from './marbles';
import { Input } from './input';
import { Progress } from './progress';
import { seeded } from './random';
import { Scene, boxOf } from './scene';
import { HALF_WIDTH } from './track';

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
const toSplit = document.getElementById('toSplit')!;
const verdict = document.getElementById('verdict')!;
const stats = document.getElementById('stats')!;
const help = document.getElementById('help')!;

main().catch((err: unknown) => {
  bootMsg.textContent = err instanceof Error ? err.message : String(err);
  console.error(err);
});

async function main() {
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
  const env = bakeEnvironment(ctx, 'studio', { size: 128, mips: 6 });
  renderer.setEnvironment(env.specular, env.brdf, env.mips);
  renderer.camera.fov = 40;
  renderer.camera.near = 1;
  renderer.camera.far = 600;

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
    },
  };
  // ?seed=N makes chance the same from before the field is drawn, for a test that wants the same race every run
  const seed = query.get('seed');
  const game = new Game(progress, events, seed !== null ? { random: seeded(+seed) } : {});
  refresh = () => showOrder();

  // ---- the scene ----

  const scene = new Scene();
  let follow = true;
  /** The middle of the run that is on. */
  const home: [number, number, number] = [0, 0, 0];
  const rebuild = () => {
    renderer.setStatic(scene.static(game.track));
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
    renderer.setLights(lights);
  };
  const lights = new LightPool(LIGHT_CAPACITY);
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
   * The four quarters of a split screen, each a texture of its own the renderer draws a camera's view into
   * before it is copied on to the canvas: the renderer has one camera and draws the whole of what it is given,
   * so a quarter is a small screen of its own. Made when the screen is split and on every resize, and let go
   * of when it is whole again. Side by side two and two on a screen wider than it is tall; one over the
   * other on a phone held upright, where four small squares would each show a marble and nothing round it.
   */
  let quarters: GPUTexture[] = [];
  let quarterWidth = 1,
    quarterHeight = 1,
    stacked = false;
  const layout = () => {
    for (const t of quarters) t.destroy();
    quarters = [];
    if (!game.split) {
      renderer.resize(width, height);
      return;
    }
    stacked = height > width;
    quarterWidth = Math.max(1, stacked ? width : width >> 1);
    quarterHeight = Math.max(1, stacked ? height >> 2 : height >> 1);
    renderer.resize(quarterWidth, quarterHeight);
    quarters = Array.from({ length: SLOTS }, () =>
      ctx.device.createTexture({
        label: 'quarter',
        size: [quarterWidth, quarterHeight],
        format: ctx.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      }),
    );
  };
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    canvas.width = width;
    canvas.height = height;
    layout();
  };
  /** The screen split in four or whole again, laid out for it, and the board's button told. */
  const resplit = () => {
    layout();
    if (!game.split) frameRun();
    toSplit.classList.toggle('on', game.split);
  };
  const setSplit = (on: boolean) => {
    game.setSplit(on);
    resplit();
  };
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
  }

  /**
   * The scene drawn into `target`, a whole screen: one view of it, or four, one to a quarter, each from its
   * own camera. The renderer's clock moves once a frame whichever it is, on the first view alone.
   */
  function present(target: GPUTexture, dt: number): boolean {
    if (!game.split) return renderer.frame(target.createView(), 'redraw', dt);
    const eye = [0, 0, 0];
    const { cameras } = game;
    for (let s = 0; s < SLOTS; s++) {
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
    for (let s = 0; s < SLOTS; s++) {
      const origin = stacked
        ? { x: 0, y: s * quarterHeight }
        : { x: (s & 1) * quarterWidth, y: (s >> 1) * quarterHeight };
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
    if (game.split) game.cameras.ease(game.marbles, home, CHASE);
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
    toRuns.classList.toggle('on', game.shelf === 'runs');
    toPieces.classList.toggle('on', game.shelf === 'pieces');
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
  showOrder();

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
    if (game.split) game.cameras.ease(game.marbles, home, CHASE);
    else if (follow) {
      const m = game.marbles;
      const lead = m.leader();
      cam.target[0] += ((lead >= 0 ? m.x[lead] : home[0]) - cam.target[0]) * CHASE;
      cam.target[1] += ((lead >= 0 ? m.y[lead] : home[1]) - cam.target[1]) * CHASE;
      cam.target[2] += ((lead >= 0 ? m.z[lead] : home[2]) - cam.target[2]) * CHASE;
    }
    if (!game.split) {
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

  /** Another run put on, by the arrows or by N: built, framed, and the board redrawn for it. */
  const step = (by: number) => {
    game.pick(game.run + by);
    rebuild();
    frameRun();
    showOrder();
  };
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  /** The runs or the catalog of pieces on the board, put on where it was left, built and framed. */
  const shelve = (shelf: Shelf) => {
    game.browse(shelf);
    rebuild();
    frameRun();
    showOrder();
  };
  toRuns.addEventListener('click', () => shelve('runs'));
  toSplit.addEventListener('click', () => setSplit(!game.split));
  toPieces.addEventListener('click', () => shelve('pieces'));
  // a row of the board picked by a tap or a click, for the next player without a marble, or let go again
  order.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest('li');
    if (row?.dataset.marble !== undefined) game.claim(Number(row.dataset.marble));
  });
  new Input((intent) => {
    if (intent === 'release') game.release();
    else if (intent === 'reset') game.reset();
    else if (intent === 'next') step(1);
    else if (intent === 'shelf') shelve(game.shelf === 'runs' ? 'pieces' : 'runs');
    else if (intent === 'split') setSplit(!game.split);
    else {
      if (intent.pick < game.marbles.count) game.claim(game.standing()[intent.pick]);
    }
    showOrder();
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
    rebuild: () => {
      rebuild();
      frameRun();
      showOrder();
    },
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
