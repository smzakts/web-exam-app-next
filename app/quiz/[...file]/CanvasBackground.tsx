'use client';

import { useEffect, useRef } from 'react';

type BgOptions = {
  density?: number;
  speedSec?: number;
  distance?: number;
  lines?: number;
  lineRGB?: [number, number, number];
  circleRGB?: [number, number, number];
  radius?: number;
  lineWidth?: number;
  mouse?: boolean;
  updateClosest?: boolean;
  fpsCap?: number;
};

export function CanvasBackground({ options = {} }: { options?: BgOptions }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const opt: Required<BgOptions> = {
      density: options.density ?? 12,
      speedSec: options.speedSec ?? 20,
      distance: options.distance ?? 80,
      lines: options.lines ?? 2,
      lineRGB: options.lineRGB ?? [88, 166, 255],
      circleRGB: options.circleRGB ?? [126, 231, 135],
      radius: options.radius ?? 2,
      lineWidth: options.lineWidth ?? 1,
      mouse: options.mouse ?? true,
      updateClosest: options.updateClosest ?? false,
      fpsCap: options.fpsCap ?? 30,
    };

    type Pt = {
      id: number;
      x: number;
      y: number;
      ox: number;
      oy: number;
      opacity: number;
      closestIdx: number[];
      phase: number;
      phaseSpeed: number;
    };

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const state = {
      w: 0,
      h: 0,
      points: [] as Pt[],
      lastDraw: 0,
      frameInterval: 1000 / Math.max(1, opt.fpsCap),
      startTs: 0,
    };

    function resize() {
      state.w = window.innerWidth;
      state.h = window.innerHeight;
      canvas.width = state.w * DPR;
      canvas.height = state.h * DPR;
      canvas.style.width = `${state.w}px`;
      canvas.style.height = `${state.h}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function mkPoints() {
      state.points = [];
      const stepX = state.w / opt.density;
      const stepY = state.h / opt.density;
      let id = 0;
      for (let x = 0; x < state.w; x += stepX) {
        for (let y = 0; y < state.h; y += stepY) {
          const px = x + Math.random() * stepX;
          const py = y + Math.random() * stepY;
          const baseSpeed = opt.speedSec * (0.9 + Math.random() * 0.2);
          state.points.push({
            id: ++id,
            x: px,
            y: py,
            ox: px,
            oy: py,
            opacity: 0,
            closestIdx: [],
            phase: Math.random() * Math.PI * 2,
            phaseSpeed: (Math.PI * 2) / baseSpeed,
          });
        }
      }
    }

    function sq(ax: number) {
      return ax * ax;
    }

    function sqDist(ax: number, ay: number, bx: number, by: number) {
      return sq(ax - bx) + sq(ay - by);
    }

    function findClosest() {
      const n = state.points.length;
      for (let i = 0; i < n; i++) {
        const p = state.points[i];
        p.closestIdx = [];
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          if (p.closestIdx.length < opt.lines) {
            p.closestIdx.push(j);
            continue;
          }
          for (let k = 0; k < opt.lines; k++) {
            const cj = p.closestIdx[k]!;
            if (sqDist(p.x, p.y, state.points[j].x, state.points[j].y) <
                sqDist(p.x, p.y, state.points[cj].x, state.points[cj].y)) {
              p.closestIdx[k] = j;
              break;
            }
          }
        }
      }
    }

    function updatePositions(elapsedSec: number) {
      for (const p of state.points) {
        const phase = p.phase + p.phaseSpeed * elapsedSec;
        const rx = opt.distance * (0.75 + ((p.id % 7) / 7) * 0.35);
        const ry = opt.distance * (0.75 + ((p.id % 11) / 11) * 0.35);
        p.x = p.ox + Math.cos(phase) * rx;
        p.y = p.oy + Math.sin(phase * 0.85) * ry;
      }
    }

    function drawFrame() {
      for (const p of state.points) {
        const d = sqDist(p.x, p.y, target.x, target.y);
        if (d < 6000) {
          p.opacity = 0.28;
        } else if (d < 14000) {
          p.opacity = 0.18;
        } else if (d < 36000) {
          p.opacity = 0.08;
        } else {
          p.opacity = 0.04;
        }
      }

      ctx.clearRect(0, 0, state.w, state.h);

      ctx.lineCap = 'round';
      ctx.lineWidth = opt.lineWidth;
      for (const p of state.points) {
        if (p.opacity <= 0) continue;
        for (const idx of p.closestIdx) {
          const q = state.points[idx];
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = `rgba(${opt.lineRGB[0]}, ${opt.lineRGB[1]}, ${opt.lineRGB[2]}, ${p.opacity})`;
          ctx.stroke();
        }
      }

      for (const p of state.points) {
        if (p.opacity <= 0) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, opt.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${opt.circleRGB[0]}, ${opt.circleRGB[1]}, ${opt.circleRGB[2]}, ${Math.min(p.opacity + 0.06, 0.5)})`;
        ctx.fill();
      }
    }

    function loop(ts: number) {
      if (prefersReduced) return;
      if (!state.startTs) state.startTs = ts;

      if (ts - state.lastDraw < state.frameInterval) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const elapsedSec = (ts - state.startTs) / 1000;

      updatePositions(elapsedSec);
      drawFrame();

      state.lastDraw = ts;
      rafRef.current = requestAnimationFrame(loop);
    }

    function onMouse(e: MouseEvent) {
      if (!opt.mouse) return;
      target.x = e.clientX;
      target.y = e.clientY;
    }

    function init() {
      resize();
      mkPoints();
      findClosest();
      if (!prefersReduced) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        drawFrame();
      }
    }

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouse);
    init();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [options]);

  return (
    <div className="bg-canvas-wrap" aria-hidden>
      <canvas ref={canvasRef} className="bg-canvas" />
    </div>
  );
}
