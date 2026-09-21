"use client";

import { useEffect, useRef, useState } from "react";

export type DitherWaveProps = {
  colorFront?: string; // default "#FF6A00"
  colorBack?: string; // default "#0B0F1A"
  pixelSize?: number; // default 6 (CSS px per cell)
  gap?: number; // default 1 (px groove between cells)
  waveAmplitude?: number; // default 0.16 (fraction of height)
  waveFrequency?: number; // default 1.6 (base wave cycles across width)
  speed?: number; // default 0.15 (slow; ~10s per crest crossing)
  paused?: boolean;
  className?: string;
  children?: React.ReactNode; // optional overlay slot, empty by default
};

const DEFAULTS = {
  colorFront: "#FF6A00",
  colorBack: "#0B0F1A",
  pixelSize: 6,
  gap: 1,
  waveAmplitude: 0.16,
  waveFrequency: 1.6,
  speed: 0.15,
} as const;

/* ------------------------------------------------------------------ */
/* Vertex shader: single fullscreen triangle, no textures needed.      */
/* ------------------------------------------------------------------ */
const VERT_SRC = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/* Fragment shader: ordered-dither wave field.                         */
/* Sections:                                                           */
/*   1. uniforms + outputs                                             */
/*   2. 8x8 Bayer matrix threshold                                     */
/*   3. tiny value-noise helper                                        */
/*   4. main: grid snap -> wave field -> dither step -> cell gap        */
/* ------------------------------------------------------------------ */
const FRAG_SRC = `#version 300 es
precision highp float;

/* ---- 1. uniforms ---- */
uniform vec2  uResolution;  // canvas size, device px
uniform float uTime;        // phase time (elapsed * speed)
uniform float uPixelSize;   // cell size, device px (css px * dpr)
uniform float uGap;         // groove width, device px
uniform vec3  uColorFront;  // solid color, bottom
uniform vec3  uColorBack;   // dark color, top
uniform float uAmp;         // wave amplitude, fraction of height
uniform float uFreq;        // base wave cycles across width

out vec4 outColor;

/* ---- 2. 8x8 Bayer ordered-dither matrix, normalized to 0..1 ---- */
const int BAYER[64] = int[64](
   0,32, 8,40, 2,34,10,42,
  48,16,56,24,50,18,58,26,
  12,44, 4,36,14,46, 6,38,
  60,28,52,20,62,30,54,22,
   3,35,11,43, 1,33, 9,41,
  51,19,59,27,49,17,57,25,
  15,47, 7,39,13,45, 5,37,
  63,31,55,23,61,29,53,21
);
float bayerThreshold(vec2 cell) {
  vec2 m = mod(cell, vec2(8.0));
  int idx = int(m.y) * 8 + int(m.x);
  return (float(BAYER[idx]) + 0.5) / 64.0;
}

/* ---- 3. tiny value noise (hash based, no texture) ---- */
float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

/* ---- 4. main ---- */
void main() {
  // 4a. snap to the pixel grid; sample everything at the cell center
  // so each cell renders perfectly uniform (no AA, no blur).
  vec2 cell = floor(gl_FragCoord.xy / uPixelSize);
  vec2 center = (cell + vec2(0.5)) * uPixelSize;
  vec2 n = center / uResolution;      // 0..1, origin bottom-left
  float x = n.x;
  float y = 1.0 - n.y;                // top = 0, bottom = 1

  // 4b. wave-displaced scalar field: two traveling sines (crests drift
  // sideways via x*f - t) plus a very slow low-octave noise wobble.
  float t = uTime * 6.2831853;
  float f1 = uFreq * 6.2831853;
  float f2 = f1 * 2.13 + 0.7;         // incommensurate 2nd wave
  float f3 = f1 * 0.61;               // low octave for the noise
  float w = sin(x * f1 - t) * 0.5
          + sin(x * f2 - t * 0.6 + 1.7) * 0.3
          + (vnoise(vec2(x * f3 - t * 0.3, t * 0.1)) - 0.5) * 0.4;
  float v = y + uAmp * w;
  // wide transition band; solid colors beyond it
  v = smoothstep(0.5 - 0.38, 0.5 + 0.38, v);

  // 4c. hard dither step: each cell is fully front or fully back.
  float thr = bayerThreshold(cell);
  vec3 col = (v >= thr) ? uColorFront : uColorBack;

  // 4d. carve the groove between cells: darken the outer uGap px.
  vec2 f = fract(gl_FragCoord.xy / uPixelSize) * uPixelSize;
  float edge = min(min(f.x, f.y), min(uPixelSize - f.x, uPixelSize - f.y));
  if (edge < uGap) {
    col *= 0.30;
  }

  outColor = vec4(col, 1.0);
}
`;

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
     .join("");
  }
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [1, 0.42, 0];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("createShader failed");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`shader compile failed: ${log}`);
  }
  return sh;
}

function linkProgram(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram {
  const prog = gl.createProgram();
  if (!prog) throw new Error("createProgram failed");
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`program link failed: ${log}`);
  }
  return prog;
}

/**
 * DitherWave — full-bleed animated ordered-dither gradient background.
 * Raw WebGL2, one fragment shader, zero render dependencies.
 */
export function DitherWave(props: DitherWaveProps) {
  const {
    colorFront = DEFAULTS.colorFront,
    colorBack = DEFAULTS.colorBack,
    pixelSize = DEFAULTS.pixelSize,
    gap = DEFAULTS.gap,
    waveAmplitude = DEFAULTS.waveAmplitude,
    waveFrequency = DEFAULTS.waveFrequency,
    speed = DEFAULTS.speed,
    paused = false,
    className = "",
    children,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const staticRedrawRef = useRef<(() => void) | null>(null);
  const [failed, setFailed] = useState(false);

  // Latest props for the RAF loop (avoids re-running setup on prop change).
  const liveRef = useRef({
    colorFront,
    colorBack,
    pixelSize,
    gap,
    waveAmplitude,
    waveFrequency,
    speed,
    paused,
  });
  liveRef.current = {
    colorFront,
    colorBack,
    pixelSize,
    gap,
    waveAmplitude,
    waveFrequency,
    speed,
    paused,
  };

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl2", {
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        powerPreference: "low-power",
      });
      if (!gl) throw new Error("webgl2 unavailable");
    } catch {
      setFailed(true);
      return;
    }

    let prog: WebGLProgram | null = null;
    let vao: WebGLVertexArrayObject | null = null;
    let vbo: WebGLBuffer | null = null;
    try {
      const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
      const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
      prog = linkProgram(gl, vs, fs);
      gl.deleteShader(vs);
      gl.deleteShader(fs);

      // Fullscreen triangle.
      vao = gl.createVertexArray();
      vbo = gl.createBuffer();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW
      );
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
    } catch {
      setFailed(true);
      if (prog && gl) gl.deleteProgram(prog);
      if (vbo && gl) gl.deleteBuffer(vbo);
      if (vao && gl) gl.deleteVertexArray(vao);
      return;
    }

    const uRes = gl.getUniformLocation(prog, "uResolution");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uPixelSize = gl.getUniformLocation(prog, "uPixelSize");
    const uGap = gl.getUniformLocation(prog, "uGap");
    const uColorFront = gl.getUniformLocation(prog, "uColorFront");
    const uColorBack = gl.getUniformLocation(prog, "uColorBack");
    const uAmp = gl.getUniformLocation(prog, "uAmp");
    const uFreq = gl.getUniformLocation(prog, "uFreq");

    const dpr = () =>
      Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      const d = dpr();
      canvas.width = Math.round(w * d);
      canvas.height = Math.round(h * d);
      gl!.viewport(0, 0, canvas.width, canvas.height);
    };

    const draw = (simTime: number) => {
      const p = liveRef.current;
      const d = dpr();
      const [fr, fg, fb] = hexToRgb(p.colorFront);
      const [br, bg, bb] = hexToRgb(p.colorBack);
      gl!.useProgram(prog);
      gl!.uniform2f(uRes, canvas.width, canvas.height);
      gl!.uniform1f(uTime, simTime);
      gl!.uniform1f(uPixelSize, Math.max(1, p.pixelSize * d));
      gl!.uniform1f(uGap, Math.max(0, p.gap * d));
      gl!.uniform3f(uColorFront, fr, fg, fb);
      gl!.uniform3f(uColorBack, br, bg, bb);
      gl!.uniform1f(uAmp, p.waveAmplitude);
      gl!.uniform1f(uFreq, p.waveFrequency);
      gl!.bindVertexArray(vao);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      gl!.bindVertexArray(null);
    };

    resize();

    let raf = 0;
    let running = false;
    let lastNow = 0;
    let simTime = 0; // seconds * speed; advanced only while running
    let visible = true;
    let tabVisible = typeof document === "undefined" ? true : !document.hidden;

    const tick = (now: number) => {
      if (!running) return;
      if (lastNow === 0) lastNow = now;
      const dt = Math.min((now - lastNow) / 1000, 0.1); // clamp tab-switch jumps
      lastNow = now;
      simTime += dt * liveRef.current.speed;
      draw(simTime);
      raf = requestAnimationFrame(tick);
    };

    const updateLoop = () => {
      const want = !reducedMotion && !liveRef.current.paused && visible && tabVisible;
      if (want && !running) {
        running = true;
        lastNow = 0; // reset so resume never jumps
        raf = requestAnimationFrame(tick);
      } else if (!want && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };

    // Reduced motion: single static frame, re-drawn if props change.
    // (The loop below never starts in this mode.)
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;
    const onVisibility = () => {
      tabVisible = !document.hidden;
      updateLoop();
    };
    let dprMql: MediaQueryList | null = null;
    const onDprChange = () => {
      resize();
      if (reducedMotion) draw(simTime);
      // Re-subscribe: the query targets the old dpr value.
      if (dprMql) {
        dprMql.removeEventListener("change", onDprChange);
        dprMql = window.matchMedia(`(resolution: ${dpr()}dppx)`);
        dprMql.addEventListener("change", onDprChange);
      }
    };

    if (reducedMotion) {
      staticRedrawRef.current = () => {
        resize();
        draw(0);
      };
      draw(0);
    } else {
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(() => {
          resize();
        });
        ro.observe(container);
      }
      if (typeof IntersectionObserver !== "undefined") {
        io = new IntersectionObserver(
          (entries) => {
            visible = entries.some((e) => e.isIntersecting);
            updateLoop();
          },
          { threshold: 0 }
        );
        io.observe(container);
      }
      document.addEventListener("visibilitychange", onVisibility);
      if (typeof window.matchMedia === "function") {
        dprMql = window.matchMedia(`(resolution: ${dpr()}dppx)`);
        dprMql.addEventListener("change", onDprChange);
      }
      updateLoop();
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      staticRedrawRef.current = null;
      ro?.disconnect();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      dprMql?.removeEventListener("change", onDprChange);
      if (gl) {
        if (vbo) gl.deleteBuffer(vbo);
        if (vao) gl.deleteVertexArray(vao);
        if (prog) gl.deleteProgram(prog);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
    };
    // Mount-once setup; live prop values flow through liveRef.
  }, []);

  // Reduced-motion static re-render when props change (no loop running).
  const redrawKey = [
    colorFront,
    colorBack,
    pixelSize,
    gap,
    waveAmplitude,
    waveFrequency,
  ].join("|");
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    staticRedrawRef.current?.();
  }, [redrawKey]);

  if (failed) {
    // Static CSS fallback: dark top, saturated bottom, same colors.
    return (
      <div
        ref={containerRef}
        className={`relative h-full w-full overflow-hidden ${className}`}
        style={{
          background: `linear-gradient(to bottom, ${colorBack} 0%, ${colorBack} 30%, ${colorFront} 72%, ${colorFront} 100%)`,
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative h-full w-full overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      {children}
    </div>
  );
}
