/**
 * fireflyEngine.ts
 * DOM-free motion model for FireflyBackground. Each firefly is a tiny state
 * machine (wander <-> rest) with its own random parameters, so nothing syncs.
 */

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const wrapAngle = (a: number) => {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
};

export interface FireflyTuning {
  /** Multiplier on travel speed. 1 = default (~10-26 px/s). */
  speed: number;
  /** Multiplier on glow intensity. 1 = default. */
  glow: number;
  /** [min, max] seconds a firefly hovers when it rests. */
  restDuration: [number, number];
}

export interface Firefly {
  x: number;
  y: number;
  heading: number;
  speed: number;
  topSpeed: number;
  mode: 'wander' | 'rest';
  timer: number;
  tx: number;
  ty: number;
  wanderRadius: number;
  turnRate: number;
  wobbleAmp: number;
  wobbleFreq: number;
  wobblePhase: number;
  swayAx: number;
  swayAy: number;
  swayFx: number;
  swayFy: number;
  swayPx: number;
  swayPy: number;
  bobAmp: number;
  bobFreq: number;
  bobPhase: number;
  glowBase: number;
  gf1: number; gf2: number; gf3: number;
  gp1: number; gp2: number; gp3: number;
  restScale: number;
  colorIndex: number;
}

/** Max angular velocity (rad/s). Lower = lazier, wider curves. */
const MAX_TURN_RATE = 0.9;

const margin = (w: number, h: number) => Math.min(64, 0.08 * Math.min(w, h));

function pickTarget(f: Firefly, w: number, h: number, all: Firefly[]) {
  const m = margin(w, h);
  let tx: number, ty: number;

  if (all.length > 1 && Math.random() < 0.22) {
    // Loosely drift toward another firefly, never exactly onto it.
    let other = all[Math.floor(Math.random() * all.length)];
    if (other === f) other = all[(all.indexOf(f) + 1) % all.length];
    const a = rand(0, TAU);
    const r = rand(45, 130);
    tx = other.x + Math.cos(a) * r;
    ty = other.y + Math.sin(a) * r;
  } else {
    const a = rand(0, TAU);
    const r = f.wanderRadius * rand(0.5, 1);
    tx = f.x + Math.cos(a) * r;
    ty = f.y + Math.sin(a) * r;
  }

  tx = clamp(tx, m, Math.max(m, w - m));
  ty = clamp(ty, m, Math.max(m, h - m));

  // If clamping collapsed the leg (cornered), aim somewhere open instead.
  if (Math.hypot(tx - f.x, ty - f.y) < 60) {
    tx = rand(m, Math.max(m, w - m));
    ty = rand(m, Math.max(m, h - m));
  }
  f.tx = tx;
  f.ty = ty;
}

export function createFirefly(
  w: number,
  h: number,
  colorCount: number,
  tuning: FireflyTuning,
  peers: Firefly[] = [],
): Firefly {
  const scale = clamp(Math.min(w, h) / 800, 0.5, 1.2);
  const f: Firefly = {
    x: rand(0, w),
    y: rand(0, h),
    heading: rand(0, TAU),
    speed: 0,
    topSpeed: rand(10, 26),
    mode: Math.random() < 0.3 ? 'rest' : 'wander',
    timer: 0,
    tx: 0,
    ty: 0,
    wanderRadius: rand(140, 380) * scale,
    turnRate: rand(0.45, 1.1),
    wobbleAmp: rand(0.35, 0.9),
    wobbleFreq: rand(0.15, 0.42),
    wobblePhase: rand(0, TAU),
    swayAx: rand(2, 5),
    swayAy: rand(1.5, 4),
    swayFx: rand(0.2, 0.5),
    swayFy: rand(0.25, 0.55),
    swayPx: rand(0, TAU),
    swayPy: rand(0, TAU),
    bobAmp: rand(1.5, 4),
    bobFreq: rand(0.6, 1.4),
    bobPhase: rand(0, TAU),
    glowBase: rand(0.55, 1),
    gf1: rand(0.9, 2.1),
    gf2: rand(0.25, 0.6),
    gf3: rand(0.07, 0.18),
    gp1: rand(0, TAU),
    gp2: rand(0, TAU),
    gp3: rand(0, TAU),
    restScale: rand(0.7, 1.5),
    colorIndex: Math.floor(Math.random() * Math.max(1, colorCount)),
  };
  pickTarget(f, w, h, peers);
  if (f.mode === 'rest') {
    f.timer = rand(tuning.restDuration[0], tuning.restDuration[1]) * f.restScale * Math.random();
  } else {
    f.timer = rand(10, 22);
    f.speed = f.topSpeed * tuning.speed * rand(0.3, 1);
  }
  return f;
}

export function stepFirefly(
  f: Firefly,
  dt: number,
  t: number,
  w: number,
  h: number,
  tuning: FireflyTuning,
  all: Firefly[],
) {
  f.timer -= dt;
  let targetSpeed = 0;

  if (f.mode === 'wander') {
    const dx = f.tx - f.x;
    const dy = f.ty - f.y;
    const d = Math.hypot(dx, dy);

    // Aim at the target, bent by a slow sine so paths curve organically.
    const desired = Math.atan2(dy, dx) + Math.sin(t * f.wobbleFreq + f.wobblePhase) * f.wobbleAmp;
    const eased = wrapAngle(desired - f.heading) * (1 - Math.exp(-dt * f.turnRate));
    const maxTurn = MAX_TURN_RATE * dt; // hard cap: turns are always wide arcs
    f.heading = wrapAngle(f.heading + clamp(eased, -maxTurn, maxTurn));

    // Ease off when approaching the target.
    targetSpeed = f.topSpeed * tuning.speed * clamp(d / 70, 0.3, 1);

    if (d < 24 || f.timer <= 0) {
      if (Math.random() < 0.5) {
        f.mode = 'rest';
        f.timer = rand(tuning.restDuration[0], tuning.restDuration[1]) * f.restScale;
      } else {
        pickTarget(f, w, h, all);
        f.timer = rand(10, 22);
      }
    }
  } else if (f.timer <= 0) {
    f.mode = 'wander';
    pickTarget(f, w, h, all); // new random direction; heading eases toward it
    f.timer = rand(10, 22);
  }

  // Speed eases in/out, so rest and resume are gradual.
  f.speed += (targetSpeed - f.speed) * (1 - Math.exp(-dt * (f.mode === 'rest' ? 1.2 : 0.6)));
  f.x += Math.cos(f.heading) * f.speed * dt;
  f.y += Math.sin(f.heading) * f.speed * dt;

  // Soft, exponential pull back inside the viewport (no hard bounce).
  const m = margin(w, h);
  const k = Math.min(1, dt * 1.5);
  if (f.x < m) f.x += (m - f.x) * k;
  else if (f.x > w - m) f.x += (w - m - f.x) * k;
  if (f.y < m) f.y += (m - f.y) * k;
  else if (f.y > h - m) f.y += (h - m - f.y) * k;
}

/** Tiny per-frame sway + vertical bob; keeps resting fireflies alive. */
export function fireflyOffset(f: Firefly, t: number, out: { x: number; y: number }) {
  out.x =
    Math.sin(t * f.swayFx + f.swayPx) * f.swayAx +
    Math.sin(t * f.swayFx * 2.3 + f.swayPy) * f.swayAx * 0.3;
  out.y =
    Math.sin(t * f.bobFreq + f.bobPhase) * f.bobAmp +
    Math.sin(t * f.swayFy + f.swayPy) * f.swayAy;
}

/** 0..1 glow. Three slow, incommensurate sines: breathing at random intervals, never abrupt. */
export function fireflyGlow(f: Firefly, t: number): number {
  const a = 0.5 + 0.5 * Math.sin(t * f.gf1 + f.gp1);
  const b = 0.5 + 0.5 * Math.sin(t * f.gf2 + f.gp2);
  const c = 0.5 + 0.5 * Math.sin(t * f.gf3 + f.gp3);
  const v = (smooth(a) * 0.55 + b * 0.3 + 0.15) * (0.55 + 0.45 * smooth(c));
  return clamp(v, 0.08, 1) * f.glowBase;
}
