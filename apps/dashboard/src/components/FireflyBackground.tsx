'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import {
  createFirefly,
  stepFirefly,
  fireflyGlow,
  fireflyOffset,
  type Firefly,
  type FireflyTuning,
} from './fireflyengine';

export interface FireflyBackgroundProps {
  /** Number of fireflies on desktop. Default 14. */
  count?: number;
  /** Multiplier applied to `count` below 640px wide. Default 0.6. */
  mobileScale?: number;
  /** Travel speed multiplier. 1 = default, 0.5 = half as fast. */
  speed?: number;
  /** Glow intensity multiplier. 1 = default, 0.6 = subtler. */
  glow?: number;
  /** [min, max] seconds a firefly hovers when resting. Default [3, 8]. */
  restDuration?: [number, number];
  /** Core radius in px; the halo scales with it. Default 1.4. */
  size?: number;
  /** Hex colours picked at random per firefly. */
  colors?: string[];
  /** Behind content by default. Raise only if a section hides the canvas. */
  zIndex?: number;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_COLORS = ['#d6eb78', '#f0de8c']; // yellow-green, pale gold
const HALO_MULT = 8; // halo radius = core radius * 8
const SPRITE = 64;

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

function buildSprite(rgb: [number, number, number]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = SPRITE;
  const g = c.getContext('2d')!;
  const [r, gr, b] = rgb;
  const grad = g.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
  grad.addColorStop(0, `rgba(${r},${gr},${b},1)`);
  grad.addColorStop(0.12, `rgba(${r},${gr},${b},0.55)`);
  grad.addColorStop(0.35, `rgba(${r},${gr},${b},0.16)`);
  grad.addColorStop(0.7, `rgba(${r},${gr},${b},0.04)`);
  grad.addColorStop(1, `rgba(${r},${gr},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, SPRITE, SPRITE);
  return c;
}

export default function FireflyBackground({
  count = 14,
  mobileScale = 0.6,
  speed = 1,
  glow = 1,
  restDuration = [3, 8],
  size = 1.4,
  colors = DEFAULT_COLORS,
  zIndex = -1,
  className,
  style,
}: FireflyBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Live-tunable props are read from a ref so changing them never restarts the loop.
  const live = useRef({ speed, glow, restDuration, size });
  live.current = { speed, glow, restDuration, size };
  const colorsKey = colors.join(',');

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const palette = colorsKey.split(',');
    const sprites = palette.map((c) => buildSprite(hexToRgb(c)));
    const cores = palette.map((c) => {
      const [r, g, b] = hexToRgb(c);
      const mix = (v: number) => Math.round(v + (255 - v) * 0.55);
      return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
    });

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = mq.matches;
    let w = 0, h = 0, dpr = 1, raf = 0, last = 0, t = 0;
    const flies: Firefly[] = [];
    const off = { x: 0, y: 0 };

    const tuning = (): FireflyTuning => ({
      speed: live.current.speed,
      glow: live.current.glow,
      restDuration: live.current.restDuration,
    });
    const targetCount = () => Math.max(0, Math.round(w < 640 ? count * mobileScale : count));

    const draw = (still: boolean) => {
      ctx.clearRect(0, 0, w, h);
      const { glow: gMul, size: core } = live.current;
      for (const f of flies) {
        let px = f.x, py = f.y;
        let g: number;
        if (still) {
          g = f.glowBase * 0.6;
        } else {
          fireflyOffset(f, t, off);
          px += off.x;
          py += off.y;
          g = fireflyGlow(f, t);
        }
        g = Math.min(1, g * gMul);

        // Soft halo
        const D = core * HALO_MULT * 2 * (0.85 + 0.3 * g);
        ctx.globalAlpha = Math.min(0.55, 0.5 * g);
        ctx.drawImage(sprites[f.colorIndex % sprites.length], px - D / 2, py - D / 2, D, D);

        // Tiny core
        ctx.globalAlpha = Math.min(1, 0.3 + 0.6 * g);
        ctx.fillStyle = cores[f.colorIndex % cores.length];
        ctx.beginPath();
        ctx.arc(px, py, core * (0.8 + 0.25 * g), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const syncCount = () => {
      const n = targetCount();
      while (flies.length < n) flies.push(createFirefly(w, h, palette.length, tuning(), flies));
      if (flies.length > n) flies.length = n;
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      syncCount();
      // No position rescaling (avoids jumps when mobile URL bars resize the viewport).
      for (const f of flies) {
        f.x = Math.min(Math.max(f.x, 0), w);
        f.y = Math.min(Math.max(f.y, 0), h);
        f.tx = Math.min(Math.max(f.tx, 0), w);
        f.ty = Math.min(Math.max(f.ty, 0), h);
      }
      if (reduced) draw(true);
    };

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
      last = now;
      t += dt;
      const tn = tuning();
      for (const f of flies) stepFirefly(f, dt, t, w, h, tn, flies);
      draw(false);
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (raf || reduced || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const onVisibility = () => (document.hidden ? stop() : start());
    const onMotion = () => {
      reduced = mq.matches;
      if (reduced) {
        stop();
        draw(true);
      } else start();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    document.addEventListener('visibilitychange', onVisibility);
    mq.addEventListener('change', onMotion);
    if (reduced) draw(true);
    else start();

    return () => {
      stop();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      mq.removeEventListener('change', onMotion);
    };
  }, [count, mobileScale, colorsKey]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex,
        pointerEvents: 'none',
        background: 'transparent',
        ...style,
      }}
    />
  );
}
