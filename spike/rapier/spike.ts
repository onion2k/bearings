/**
 * The spike: the game's runs raced in Rapier, a real physics engine, against
 * the game's own solver, on the runs test's own measures, to find out whether
 * a marble run can be a physics simulation and what it would take. Not part
 * of the game: nothing in `src/` knows it is here.
 *
 *   npm run spike:rapier                  every run, 24 seeds each
 *   npm run spike:rapier -- the-leap-4    one run
 *   SEEDS=12 FELT_TO=1.8 MU=0.3 ...       the knobs, as environment
 *
 * The channel is a mesh from the track's own samples with the solver's lean
 * baked into the geometry; pegs are capsules; a funnel's bowl, rim wall and
 * throat are a mesh of their own; a sweeper and a wheel are dynamic bodies on
 * motored joints, so a jammed wheel slows rather than crushing a ball; the
 * gate lifts rather than slides; balls carry the solver's quadratic drag on
 * the track and none in the air; four substeps a frame. What was found is in
 * README.md beside this.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { compile, at, pose, pose0, bowlHeight, type Track, type Segment, type Obstacle } from '../../src/track';
import { RUNS } from '../../src/runs';
import { Marbles, RADIUS, GRAVITY, LEAN, MARBLES, SPACING, DRAG } from '../../src/marbles';
import { FELT_GRIP } from '../../src/track';
import { seeded } from '../../src/random';
import { HALF_WIDTH } from '../../src/track';

const WALL = Number(process.env.WALL ?? 2.0); // taller than the scene draws (0.57): a ball banking through a bend at speed hopped a low one
const SKIN = 0.08;
const SUBSTEPS = Number(process.env.SUBSTEPS ?? 4);
const DT = 1 / 60;
const MU = Number(process.env.MU ?? 0.3);
const CAP = 180; // seconds a race may take
// the air's drag and the felt of the channel, which the solver has as DRAG (v squared) and RESIST and Rapier
// has nothing of: without it a ball on the lean alone runs away to 140 a second and flies off the first bend
const DAMPING = Number(process.env.DAMPING ?? 0.05);

type V3 = [number, number, number];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Where a sample of a segment is with the solver's lean taken into the geometry: every piece leans down by a twentieth. */
function leaned(seg: Segment, i: number): { p: V3; t: V3; u: V3; b: V3 } {
  const o = i * 3;
  const p: V3 = [seg.points[o], seg.points[o + 1], seg.points[o + 2] - LEAN * (seg.start + seg.arc[i])];
  const t: V3 = [seg.tangents[o], seg.tangents[o + 1], seg.tangents[o + 2]];
  const u: V3 = [seg.ups[o], seg.ups[o + 1], seg.ups[o + 2]];
  return { p, t, u, b: cross(t, u) };
}
/** Somewhere along a segment, leaned the same way. */
function spotAt(track: Track, s: number, along: number) {
  const h = at(track, s, along);
  const seg = track.segments[s];
  const p: V3 = [h.x, h.y, h.z - LEAN * (seg.start + along)];
  const t: V3 = [h.tx, h.ty, h.tz],
    u: V3 = [h.ux, h.uy, h.uz];
  return { p, t, u, b: cross(t, u) };
}
const add = (p: V3, ...more: [V3, number][]): V3 => {
  const out: V3 = [...p];
  for (const [v, k] of more) for (let i = 0; i < 3; i++) out[i] += v[i] * k;
  return out;
};

/** A rotation taking local +Y to `d`, as a quaternion, for a capsule that lies along `d`. */
function alongQuat(d: V3): { x: number; y: number; z: number; w: number } {
  const y: V3 = [0, 1, 0];
  const c = cross(y, d);
  const w = 1 + d[1];
  const l = Math.hypot(c[0], c[1], c[2], w) || 1;
  return { x: c[0] / l, y: c[1] / l, z: c[2] / l, w: w / l };
}
/** A rotation from a right-handed frame (x, y, z as columns), as a quaternion. */
function frameQuat(x: V3, y: V3, z: V3) {
  const m00 = x[0],
    m01 = y[0],
    m02 = z[0],
    m10 = x[1],
    m11 = y[1],
    m12 = z[1],
    m20 = x[2],
    m21 = y[2],
    m22 = z[2];
  const tr = m00 + m11 + m22;
  let qw, qx, qy, qz;
  if (tr > 0) {
    const S = Math.sqrt(tr + 1) * 2;
    qw = S / 4;
    qx = (m21 - m12) / S;
    qy = (m02 - m20) / S;
    qz = (m10 - m01) / S;
  } else if (m00 > m11 && m00 > m22) {
    const S = Math.sqrt(1 + m00 - m11 - m22) * 2;
    qw = (m21 - m12) / S;
    qx = S / 4;
    qy = (m01 + m10) / S;
    qz = (m02 + m20) / S;
  } else if (m11 > m22) {
    const S = Math.sqrt(1 + m11 - m00 - m22) * 2;
    qw = (m02 - m20) / S;
    qx = (m01 + m10) / S;
    qy = S / 4;
    qz = (m12 + m21) / S;
  } else {
    const S = Math.sqrt(1 + m22 - m00 - m11) * 2;
    qw = (m10 - m01) / S;
    qx = (m02 + m20) / S;
    qy = (m12 + m21) / S;
    qz = S / 4;
  }
  return { x: qx, y: qy, z: qz, w: qw };
}
/** q1 * q2. */
function mul(a: { x: number; y: number; z: number; w: number }, b: { x: number; y: number; z: number; w: number }) {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

/** Every channel of the run as one mesh: floor, two walls and their lips; and the finish's end stop. */
function channelMesh(track: Track, run: { pieces: { kind: string }[] }) {
  const verts: number[] = [];
  const idx: number[] = [];
  const push = (v: V3) => verts.push(v[0], v[1], v[2]);
  for (const seg of track.segments) {
    if (seg.funnel) continue;
    const n = seg.arc.length;
    const base = verts.length / 3;
    // a splitter's two lanes part from one point and a joiner's meet at one, each lane's wall crossing the
    // other's floor over the stretch they share: the scene covers it with a wedge, and here the walls are
    // simply left off it, the floor alone
    const kind = run.pieces[seg.piece].kind;
    for (let i = 0; i < n; i++) {
      const { p, u, b } = leaned(seg, i);
      const w = seg.width[i];
      const shared = (kind === 'splitter' && i < n * 0.55) || (kind === 'joiner' && i > n * 0.45);
      const h = shared ? 0 : WALL;
      for (const [across, up] of [
        [-w - SKIN, h],
        [-w, h],
        [-w, 0],
        [w, 0],
        [w, h],
        [w + SKIN, h],
      ] as const)
        push(add(p, [b, across], [u, up]));
    }
    for (let i = 0; i + 1 < n; i++)
      for (let k = 0; k < 5; k++) {
        const a = base + i * 6 + k,
          c = base + (i + 1) * 6 + k;
        idx.push(a, a + 1, c, a + 1, c + 1, c);
      }
    // the end of the run is stopped, as the lane's stop stops the winner
    if (seg.next < 0 && !seg.fork) {
      const { p, t, u, b } = leaned(seg, n - 1);
      const w = seg.width[n - 1];
      const e = verts.length / 3;
      push(add(p, [b, -w], [t, 0.05]));
      push(add(p, [b, w], [t, 0.05]));
      push(add(p, [b, w], [u, WALL], [t, 0.05]));
      push(add(p, [b, -w], [u, WALL], [t, 0.05]));
      idx.push(e, e + 1, e + 2, e, e + 2, e + 3);
    }
  }
  return { verts: new Float32Array(verts), idx: new Uint32Array(idx) };
}

/** A funnel's bowl, its rim wall and its throat, as a surface of revolution. */
function bowlMesh(seg: Segment) {
  const bowl = seg.funnel!;
  const verts: number[] = [];
  const idx: number[] = [];
  const AROUND = 48;
  const zTop = bowl.z - LEAN * seg.start;
  const rings: [number, number][] = [];
  // the rim wall, top down, then the bowl in from the rim to the hole, then the throat down
  rings.push([bowl.rim, zTop + bowl.wall]);
  for (let k = 0; k <= 12; k++) {
    const r = bowl.rim - ((bowl.rim - bowl.hole) * k) / 12;
    rings.push([r, zTop + bowlHeight(bowl, r)]);
  }
  rings.push([bowl.hole, zTop + bowlHeight(bowl, bowl.hole) - bowl.throat]);
  for (const [r, z] of rings)
    for (let a = 0; a < AROUND; a++) {
      const phi = (a / AROUND) * Math.PI * 2;
      verts.push(bowl.x + r * Math.cos(phi), bowl.y + r * Math.sin(phi), z);
    }
  for (let ring = 0; ring + 1 < rings.length; ring++)
    for (let a = 0; a < AROUND; a++) {
      const a0 = ring * AROUND + a,
        a1 = ring * AROUND + ((a + 1) % AROUND);
      const b0 = a0 + AROUND,
        b1 = a1 + AROUND;
      idx.push(a0, a1, b0, a1, b1, b0);
    }
  return { verts: new Float32Array(verts), idx: new Uint32Array(idx) };
}

interface Moving {
  body: RAPIER.RigidBody;
  seg: number;
  ob: Obstacle;
  kind: 'part' | 'wheel';
  joint?: RAPIER.PrismaticImpulseJoint | RAPIER.RevoluteImpulseJoint;
}
// how hard a motored part is pulled toward where its clockwork says it should be: enough to keep time with a
// field going by, not enough to crush a ball caught against a wall, which then holds it up a little
const MOTOR = Number(process.env.MOTOR ?? 40);

interface Raced {
  place: number[];
  took: number[];
  grid: number[];
  frames: number;
  ms: number;
  lost: number;
  stalled: number;
  top: number;
  pops: Record<string, number>;
  stops: Record<string, number>;
}
/** Which kind of piece a point is nearest to, by the samples of every segment. */
function nearestKind(track: Track, run: { pieces: { kind: string }[] }, x: number, y: number, z: number): string {
  let best = Infinity,
    kind = '?';
  for (const seg of track.segments)
    for (let k = 0; k < seg.points.length; k += 3) {
      const d = Math.hypot(
        seg.points[k] - x,
        seg.points[k + 1] - y,
        seg.points[k + 2] - LEAN * (seg.start + seg.arc[k / 3]) - z,
      );
      if (d < best) {
        best = d;
        kind = run.pieces[seg.piece].kind;
      }
    }
  return kind;
}

function raceInRapier(track: Track, seed: number, run: { pieces: { kind: string }[] }): Raced {
  const world = new RAPIER.World({ x: 0, y: 0, z: -GRAVITY });
  world.timestep = DT / SUBSTEPS;
  const mesh = channelMesh(track, run);
  world.createCollider(RAPIER.ColliderDesc.trimesh(mesh.verts, mesh.idx).setFriction(MU).setRestitution(0));
  for (const seg of track.segments)
    if (seg.funnel) {
      const m = bowlMesh(seg);
      world.createCollider(RAPIER.ColliderDesc.trimesh(m.verts, m.idx).setFriction(MU).setRestitution(0));
    }
  // a landing is solid under its front: a ball arriving at the edge a hair low slid under a floor with nothing beneath
  for (const seg of track.segments) {
    if (!seg.flies || seg.funnel || seg.next < 0) continue;
    const land = track.segments[seg.next];
    const { p, t, u, b } = leaned(land, 0);
    const c = add(p, [t, 1.5], [u, -0.75]);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(1.5, land.width[0] + SKIN, 0.75)
        .setTranslation(c[0], c[1], c[2])
        .setRotation(frameQuat(t, b, u))
        .setFriction(MU)
        .setRestitution(0),
    );
  }
  const random = seeded(seed);
  // what the game draws: the grid, and where each moving part is in its turn
  const grid = [...Array(MARBLES).keys()];
  for (let i = MARBLES - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [grid[i], grid[j]] = [grid[j], grid[i]];
  }
  const phase = Array.from({ length: track.slots }, () => random());
  const moving: Moving[] = [];
  track.segments.forEach((seg, s) => {
    const wheels = new Map<number, Obstacle[]>();
    for (const ob of seg.obstacles) {
      if (ob.motion.kind === 'fixed') {
        const { p, u, b } = spotAt(track, s, ob.along);
        const c = add(p, [b, ob.across], [u, WALL / 2]);
        world.createCollider(
          RAPIER.ColliderDesc.capsule(WALL / 2, ob.radius)
            .setTranslation(c[0], c[1], c[2])
            .setRotation(alongQuat(u))
            .setFriction(MU)
            .setRestitution(0),
        );
      } else if (ob.motion.kind === 'paddle') {
        if (!wheels.has(ob.slot)) wheels.set(ob.slot, []);
        wheels.get(ob.slot)!.push(ob);
      } else if (ob.motion.kind === 'sweep') {
        const { p, t, u, b } = spotAt(track, s, ob.along);
        const c = add(p, [b, ob.across], [u, RADIUS]);
        const d: V3 = [
          t[0] * Math.cos(ob.angle) + b[0] * Math.sin(ob.angle),
          t[1] * Math.cos(ob.angle) + b[1] * Math.sin(ob.angle),
          t[2] * Math.cos(ob.angle) + b[2] * Math.sin(ob.angle),
        ];
        const body = world.createRigidBody(
          RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(c[0], c[1], c[2])
            .setRotation(alongQuat(d))
            .setGravityScale(0)
            .setCanSleep(false),
        );
        world.createCollider(
          RAPIER.ColliderDesc.capsule(ob.half, ob.radius).setFriction(MU).setRestitution(0).setDensity(3),
          body,
        );
        const anchor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(c[0], c[1], c[2]));
        // slides across the board only: the joint's own frames are the anchor's, which is not turned, so the
        // axis is the board's across in the world
        const joint = world.createImpulseJoint(
          RAPIER.JointData.prismatic({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: b[0], y: b[1], z: b[2] }),
          anchor,
          body,
          true,
        ) as RAPIER.PrismaticImpulseJoint;
        joint.configureMotorModel(RAPIER.MotorModel.ForceBased);
        moving.push({ body, seg: s, ob, kind: 'part', joint });
      } else {
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
        world.createCollider(RAPIER.ColliderDesc.capsule(ob.half, ob.radius).setFriction(MU).setRestitution(0), body);
        moving.push({ body, seg: s, ob, kind: 'part' });
      }
    }
    for (const paddles of wheels.values()) {
      const ob = paddles[0];
      const m = ob.motion as { axle: number; arm: number };
      const { p: o, t: tt, u, b } = spotAt(track, s, ob.along);
      const axle = add(o, [b, ob.across], [u, RADIUS + m.axle]);
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(axle[0], axle[1], axle[2])
          .setRotation(frameQuat(tt, b, u))
          .setGravityScale(0)
          .setCanSleep(false),
      );
      // four paddles about the axle, a quarter turn apart, in the body's own frame: x along, y across, z up
      for (let k = 0; k < paddles.length; k++) {
        const th = (k / paddles.length) * Math.PI * 2;
        const dir: V3 = [Math.sin(th), 0, -Math.cos(th)];
        const c = { x: (dir[0] * m.arm) / 2, y: 0, z: (dir[2] * m.arm) / 2 };
        const q = { x: 0, y: Math.sin(th / 2), z: 0, w: Math.cos(th / 2) };
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(ob.radius, ob.half, m.arm / 2)
            .setTranslation(c.x, c.y, c.z)
            .setRotation(q)
            .setFriction(MU)
            .setRestitution(0),
          body,
        );
      }
      const anchor = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(axle[0], axle[1], axle[2])
          .setRotation(frameQuat(tt, b, u)),
      );
      const joint = world.createImpulseJoint(
        RAPIER.JointData.revolute({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }),
        anchor,
        body,
        true,
      ) as RAPIER.RevoluteImpulseJoint;
      joint.configureMotorModel(RAPIER.MotorModel.ForceBased);
      const period = (ob.motion as { period: number }).period;
      joint.configureMotorVelocity((Math.PI * 2) / period, MOTOR);
      moving.push({ body, seg: s, ob, kind: 'wheel', joint });
    }
  });
  const place = (t: number) => {
    const p = pose0();
    for (const mv of moving) {
      const ph = mv.ob.slot >= 0 ? phase[mv.ob.slot] : 0;
      if (mv.kind === 'wheel' && mv.joint) continue;
      if (mv.kind === 'part' && mv.joint) {
        pose(mv.ob, t, ph, p, RADIUS);
        mv.joint.configureMotorPosition(p.across - mv.ob.across, MOTOR * 4, MOTOR / 2);
        continue;
      }
      if (mv.kind === 'part') {
        pose(mv.ob, t, ph, p, RADIUS);
        const { p: o, t: tt, u, b } = spotAt(track, mv.seg, p.along);
        let across = p.across,
          up = RADIUS;
        if (mv.ob.motion.kind === 'gate') {
          const aside = Math.min(1, Math.abs(p.across - mv.ob.across) / (mv.ob.half * 2));
          across = mv.ob.across;
          up = RADIUS + aside * (RADIUS * 2 + WALL);
        }
        const c = add(o, [b, across], [u, up]);
        const d: V3 = [tt[0] * p.da + b[0] * p.dc, tt[1] * p.da + b[1] * p.dc, tt[2] * p.da + b[2] * p.dc];
        mv.body.setNextKinematicTranslation({ x: c[0], y: c[1], z: c[2] });
        mv.body.setNextKinematicRotation(alongQuat(d));
      } else {
        const m = mv.ob.motion as { period: number; turn: number; axle: number };
        const { p: o, t: tt, u, b } = spotAt(track, mv.seg, mv.ob.along);
        const c = add(o, [b, mv.ob.across], [u, RADIUS + m.axle]);
        const f = (((t / m.period + ph + m.turn) % 1) + 1) % 1;
        const theta = Math.PI * 2 * f - Math.PI;
        const spin = { x: 0, y: Math.sin(theta / 2), z: 0, w: Math.cos(theta / 2) };
        mv.body.setNextKinematicTranslation({ x: c[0], y: c[1], z: c[2] });
        mv.body.setNextKinematicRotation(mul(frameQuat(tt, b, u), spin));
      }
    }
  };
  place(0);
  const balls: RAPIER.RigidBody[] = [];
  const ballColliders: RAPIER.Collider[] = [];
  const gate = track.segments[0];
  const rows = Math.ceil(MARBLES / 2);
  const room = gate.length - RADIUS * 2;
  const gap = Math.min(SPACING, room / (rows - 1));
  for (let i = 0; i < MARBLES; i++) {
    const slot = grid[i];
    const along = Math.max(0, gate.length - RADIUS - Math.floor(slot / 2) * gap);
    const across = slot % 2 === 0 ? -(HALF_WIDTH - RADIUS) : HALF_WIDTH - RADIUS;
    const { p, u, b } = spotAt(track, 0, along);
    const c = add(p, [b, across], [u, RADIUS + 0.02]);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(c[0], c[1], c[2])
        .setCcdEnabled(true)
        .setCanSleep(false)
        .setLinearDamping(DAMPING)
        .setAngularDamping(DAMPING),
    );
    ballColliders.push(
      world.createCollider(RAPIER.ColliderDesc.ball(RADIUS).setFriction(MU).setRestitution(0).setDensity(1), body),
    );
    balls.push(body);
  }
  const felts = track.segments.filter((sg) => sg.felt).map((sg) => ({ seg: sg }));
  const last = track.segments.length - 1;
  const finish = track.segments[last];
  let bottom = Infinity;
  for (const seg of track.segments)
    for (let k = 2; k < seg.points.length; k += 3) bottom = Math.min(bottom, seg.points[k]);
  bottom -= LEAN * track.length;
  const placeOf = new Array<number>(MARBLES).fill(0),
    took = new Array<number>(MARBLES).fill(-1);
  const still = new Array<number>(MARBLES).fill(0);
  let finishers = 0,
    lost = 0,
    stalled = 0,
    ms = 0,
    top = 0,
    frames = 0;
  const pops: Record<string, number> = {},
    stops: Record<string, number> = {};
  const fast = new Array<boolean>(MARBLES).fill(false);
  const missed = new Array<string>(MARBLES).fill('never below a landing');
  const wasTouching = new Array<boolean>(MARBLES).fill(true);
  const landings = track.segments
    .map((sg) => (sg.flies && !sg.funnel && sg.next >= 0 ? track.segments[sg.next] : null))
    .filter((l): l is Segment => l !== null);
  for (frames = 0; frames < CAP * 60; frames++) {
    const t = (frames + 1) * DT;
    place(t);
    for (let i = 0; i < MARBLES; i++) {
      if (placeOf[i] !== 0) continue;
      const body = balls[i];
      const v = body.linvel();
      const speed = Math.hypot(v.x, v.y, v.z);
      const mass = body.mass();
      // the air's drag, as the solver has it: the square of the speed, and none of it in the air off a lip, where
      // the solver's flight is gravity alone
      // set from inside the callback, which the type checker cannot see, so told so
      let touching = false as boolean;
      world.contactPairsWith(ballColliders[i], (other) => {
        world.contactPair(ballColliders[i], other, (manifold) => {
          if (manifold.numContacts() > 0) touching = true;
        });
      });
      const p = body.translation();
      if (process.env.LIPS !== undefined && !touching && wasTouching[i] && speed > 3) {
        // just left something at speed: off a lip, or a bump. Where, against the nearest lip
        for (const seg of track.segments) {
          if (!seg.flies || seg.funnel) continue;
          const { p: q } = leaned(seg, seg.arc.length - 1);
          if (Math.hypot(p.x - q[0], p.y - q[1], p.z - q[2]) < 1.5)
            console.log(
              `    off a lip at ${speed.toFixed(1)}, climbing ${((Math.asin(v.z / speed) * 180) / Math.PI).toFixed(0)} deg`,
            );
        }
      }
      wasTouching[i] = touching;
      if (speed > 1e-6) {
        let k = touching ? -DRAG * speed * DT * mass : 0;
        // a jump's felt brings any ball to its pace, as the solver's does, whatever it came in at
        let onFelt: V3 | null = null;
        for (const f of felts) {
          const { p: q, t: tt, u } = leaned(f.seg, 0);
          const along = (p.x - q[0]) * tt[0] + (p.y - q[1]) * tt[1] + (p.z - q[2]) * tt[2];
          if (
            along < 0 ||
            along > f.seg.felt!.upto * Number(process.env.FELT_TO ?? 1) ||
            Math.hypot(p.x - q[0] - tt[0] * along, p.y - q[1] - tt[1] * along) > HALF_WIDTH * 2
          )
            continue;
          k += ((f.seg.felt!.speed - speed) / speed) * Math.min(1, FELT_GRIP * 4 * DT) * mass;
          onFelt = u;
          if (process.env.LIPS && along > f.seg.felt!.upto - 0.3)
            console.log(`    leaving the felt at ${speed.toFixed(1)}`);
        }
        body.applyImpulse({ x: v.x * k, y: v.y * k, z: v.z * k }, true);
        // felt that changes a ball's pace changes its spin to match, or the floor takes the difference back
        if (onFelt) {
          const w = body.linvel();
          const spin = cross(onFelt, [w.x, w.y, w.z]);
          body.setAngvel({ x: spin[0] / RADIUS, y: spin[1] / RADIUS, z: spin[2] / RADIUS }, true);
        }
      }
    }
    const a = performance.now();
    for (let k = 0; k < SUBSTEPS; k++) world.step();
    ms += performance.now() - a;
    let going = 0;
    for (let i = 0; i < MARBLES; i++) {
      if (placeOf[i] !== 0) continue;
      const p = balls[i].translation(),
        v = balls[i].linvel();
      const speed = Math.hypot(v.x, v.y, v.z);
      top = Math.max(top, speed);
      // the first time it is under a landing's floor, where it was against that landing
      if (missed[i].startsWith('never'))
        for (const land of landings) {
          const { p: q, t: tt, b } = leaned(land, 0);
          const dx = p.x - q[0],
            dy = p.y - q[1],
            dz = p.z - q[2];
          const along = dx * tt[0] + dy * tt[1],
            across = dx * b[0] + dy * b[1];
          if (dz < -1.5 && along > -8 && along < land.length + 8 && Math.abs(across) < 8)
            missed[i] =
              `${along < 0 ? 'short of' : along > land.length ? 'past' : 'beside'} the landing: along ${along.toFixed(1)} of ${land.length.toFixed(1)}, across ${across.toFixed(1)} (${land.width[0].toFixed(1)} to the wall), at ${speed.toFixed(0)}`;
        }
      // a ball going faster than any marble on the run ever does was thrown by a contact: where
      if (speed > 30 && !fast[i]) {
        const k = nearestKind(track, run, p.x, p.y, p.z);
        pops[k] = (pops[k] ?? 0) + 1;
      }
      fast[i] = speed > 30;
      // over the line, home; below everything, lost; barely moving for long, stopped
      let inLane = false;
      for (let k = 0; k < finish.arc.length && !inLane; k += 2) {
        const { p: q } = leaned(finish, k);
        inLane =
          Math.hypot(p.x - q[0], p.y - q[1]) < HALF_WIDTH + RADIUS &&
          p.z - q[2] > 0 &&
          p.z - q[2] < RADIUS * 2.5 &&
          finish.arc[k] > 0.2;
      }
      if (inLane) {
        placeOf[i] = ++finishers;
        took[i] = t;
        continue;
      }
      if (p.z < bottom - 3) {
        placeOf[i] = -1;
        lost++;
        if (process.env.WHERE_LOST) console.log(`    lost: ${missed[i]}`);
        continue;
      }
      still[i] = speed < 0.15 ? still[i] + DT : 0;
      if (still[i] > 0.5 && Math.abs(still[i] % 0.5) < DT) {
        const side = random() < 0.5 ? -1 : 1;
        balls[i].applyImpulse({ x: side * 0.8 * balls[i].mass(), y: side * 0.8 * balls[i].mass(), z: 0 }, true);
      }
      if (still[i] > 8) {
        placeOf[i] = -2;
        stalled++;
        const k = nearestKind(track, run, p.x, p.y, p.z);
        // where across its piece: at the wall, or in the middle
        let best = Infinity,
          across = 0,
          wall = 0;
        for (let sg = 0; sg < track.segments.length; sg++) {
          const seg = track.segments[sg];
          for (let q = 0; q < seg.arc.length; q += 1) {
            const { p: c, b } = leaned(seg, q);
            const d = Math.hypot(c[0] - p.x, c[1] - p.y, c[2] - p.z);
            if (d < best) {
              best = d;
              across = (p.x - c[0]) * b[0] + (p.y - c[1]) * b[1] + (p.z - c[2]) * b[2];
              wall = seg.width[q];
            }
          }
        }
        const where = Math.abs(across) > wall - RADIUS - 0.15 ? `${k} at the wall` : `${k} in the open`;
        stops[where] = (stops[where] ?? 0) + 1;
        continue;
      }
      going++;
    }
    if (going === 0) break;
  }
  world.free();
  return { place: placeOf, took, grid, frames, ms, lost, stalled, top, pops, stops };
}

function raceInSolver(track: Track, seed: number) {
  const m = new Marbles(track, {}, { random: seeded(seed) });
  const a = performance.now();
  m.release();
  let f = 0;
  const flying = new Array<boolean>(m.count).fill(false);
  for (; f < CAP * 60 && !m.over; f++) {
    m.step(DT);
    if (process.env.LIPS)
      for (let i = 0; i < m.count; i++) {
        const now = m.state[i] === 4;
        if (now && !flying[i]) {
          const sp = Math.hypot(m.vx[i], m.vy[i], m.vz[i]);
          console.log(
            `    solver off a lip at ${sp.toFixed(1)}, climbing ${((Math.asin(m.vz[i] / sp) * 180) / Math.PI).toFixed(0)} deg`,
          );
        }
        flying[i] = now;
      }
  }
  const all = [...Array(m.count).keys()];
  return {
    place: all.map((i) => m.place[i]),
    took: all.map((i) => m.took[i]),
    grid: all.map((i) => m.grid[i]),
    ms: performance.now() - a,
    frames: f,
    lost: m.lost,
    stalled: m.stalled,
  };
}

function tau(a: number[], b: number[]) {
  let same = 0,
    other = 0;
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++) {
      const s = Math.sign(a[i] - a[j]) * Math.sign(b[i] - b[j]);
      if (s > 0) same++;
      else if (s < 0) other++;
    }
  return same + other ? (same - other) / (same + other) : 0;
}
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};

async function main() {
  await RAPIER.init();
  const which = process.argv.slice(2);
  const SEEDS = Number(process.env.SEEDS ?? 24);
  for (const run of RUNS.filter((r) => !which.length || which.includes(r.id))) {
    const track = compile(run);
    const popsBy: Record<string, number> = {},
      stopsBy: Record<string, number> = {};
    const stats = {
      rapier: {
        home: 0,
        lost: 0,
        stalled: 0,
        wins: [] as number[],
        taus: [] as number[],
        back: 0,
        ms: 0,
        frames: 0,
        top: 0,
      },
      solver: {
        home: 0,
        lost: 0,
        stalled: 0,
        wins: [] as number[],
        taus: [] as number[],
        back: 0,
        ms: 0,
        frames: 0,
        top: 0,
      },
    };
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = raceInRapier(track, seed, run);
      for (const [k, n] of Object.entries(r.pops)) popsBy[k] = (popsBy[k] ?? 0) + n;
      for (const [k, n] of Object.entries(r.stops)) stopsBy[k] = (stopsBy[k] ?? 0) + n;
      const s = raceInSolver(track, seed);
      for (const [name, x] of [
        ['rapier', r],
        ['solver', s],
      ] as const) {
        const st = stats[name];
        const homes = x.place.filter((p) => p > 0).length;
        st.home += homes;
        st.lost += x.lost;
        st.stalled += x.stalled;
        st.ms += x.ms;
        st.frames += x.frames;
        const winner = x.place.indexOf(1);
        if (winner >= 0) {
          st.wins.push(x.took[winner]);
          if (x.grid[winner] >= MARBLES / 2) st.back++;
        }
        const done = [...Array(MARBLES).keys()].filter((i) => x.place[i] > 0);
        if (done.length >= 3)
          st.taus.push(
            tau(
              done.map((i) => x.grid[i]),
              done.map((i) => x.place[i]),
            ),
          );
      }
      stats.rapier.top = Math.max(stats.rapier.top, r.top);
    }
    const line = (name: 'rapier' | 'solver') => {
      const st = stats[name];
      const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
      return (
        `  ${name.padEnd(7)} home ${String(st.home).padStart(3)}/${SEEDS * MARBLES}  lost ${String(st.lost).padStart(2)}  stopped ${String(st.stalled).padStart(2)}  winner's time ${median(st.wins).toFixed(1)} s (${st.wins.length ? Math.min(...st.wins).toFixed(1) : '-'}-${st.wins.length ? Math.max(...st.wins).toFixed(1) : '-'})  grid→finish tau ${mean(st.taus).toFixed(2)}  back half wins ${st.back}/${st.wins.length}  a frame ${(st.ms / st.frames).toFixed(3)} ms` +
        (name === 'rapier' ? `  top speed ${st.top.toFixed(0)}` : '')
      );
    };
    console.log(`${run.name} (${track.segments.length} segments), ${SEEDS} seeds:`);
    console.log(line('rapier'));
    console.log(line('solver'));
    console.log(`  thrown past 30 on: ${JSON.stringify(popsBy)}; stopped on: ${JSON.stringify(stopsBy)}`);
  }
}
main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
