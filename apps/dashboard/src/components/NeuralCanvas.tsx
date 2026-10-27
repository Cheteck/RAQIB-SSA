'use client';

import { useEffect, useRef } from 'react';

/**
 * RAQIB neural core — full-viewport 3D particle sphere + ring renderer.
 * Port of the template's `#c` canvas loop (RAQIB-Interface.html).
 * Exposes a minimal API via ref: setMode(mode) to change state color.
 */
export type CoreMode = 'idle' | 'listening' | 'thinking' | 'speaking';

const TC: Record<CoreMode, [number, number, number]> = {
  idle: [98, 230, 255],
  listening: [125, 255, 200],
  thinking: [255, 179, 71],
  speaking: [215, 248, 255],
};

const RG = [
  { n: 150, r: 1.38, v: 0.5, tx: 1.2, tz: 0.3, g: 0 },
  { n: 190, r: 1.62, v: -0.32, tx: 0.4, tz: -0.7, g: 1 },
  { n: 230, r: 1.9, v: 0.2, tx: -0.9, tz: 0.5, g: 0 },
];

interface Props {
  mode?: CoreMode;
  barsRef?: React.RefObject<HTMLDivElement | null>;
  onClick?: () => void;
}

export default function NeuralCanvas({ mode = 'idle', barsRef, onClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const apiRef = useRef<CoreMode>(mode);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;
  apiRef.current = mode;

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    if (!g) return;

    let W = 0, H = 0, D = 1;
    const rs = () => {
      D = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = W * D;
      cv.height = H * D;
      g.setTransform(D, 0, 0, D, 0, 0);
    };
    window.addEventListener('resize', rs);
    rs();

    const N = 1100;
    const PT: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number }> = [];
    const GA = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (2 * (i + 0.5)) / N;
      const r = Math.sqrt(1 - y * y);
      const a = GA * i;
      PT.push({
        x: Math.cos(a) * r,
        y,
        z: Math.sin(a) * r,
        sx: (Math.random() - 0.5) * 4,
        sy: (Math.random() - 0.5) * 4,
        sz: (Math.random() - 0.5) * 4,
      });
    }

    let S: CoreMode = 'idle';
    let col = [98, 230, 255];
    let asm = 0;
    let amp = 0;
    let tamp = 0;
    let rot = 0;
    let mx = 0, my = 0, mxT = 0, myT = 0;
    let t0 = performance.now();
    let cx = 0, cy = 0, R = 0, cr = 1, sr = 0, cxr = 1, sxr = 0;
    const o = { x: 0, y: 0, f: 1, d: 0.5 };

    const pj = (X: number, Y: number, Z: number) => {
      const x1 = X * cr + Z * sr;
      const z1 = -X * sr + Z * cr;
      const y1 = Y * cxr - z1 * sxr;
      const z2 = Y * sxr + z1 * cxr;
      const f = 2.6 / (2.6 - z2);
      o.x = cx + x1 * R * f;
      o.y = cy + y1 * R * f;
      o.f = f;
      o.d = (z2 + 1.4) / 2.8;
    };

    const onMove = (e: PointerEvent) => {
      mxT = e.clientX / W - 0.5;
      myT = e.clientY / H - 0.5;
    };
    const onClickCv = () => {
      clickRef.current?.();
    };
    window.addEventListener('pointermove', onMove);
    cv.addEventListener('click', onClickCv);

    const bars = () => {
      // Priorité : barsRef passé en prop
      if (barsRef?.current) return Array.from(barsRef.current.querySelectorAll('i')) as HTMLElement[];
      // Fallback : chercher le .wv du dock dans le DOM (persistant)
      const wv = document.querySelector('.wv');
      return wv ? Array.from(wv.querySelectorAll('i')) as HTMLElement[] : [];
    };

    let raf = 0;
    const fr = (t: number) => {
      const dt = Math.min((t - t0) / 1000, 0.05);
      t0 = t;
      S = apiRef.current;
      asm = Math.min(1, asm + dt / 2.4);
      const e = 1 - (1 - asm) ** 3;

      if (S === 'listening')
        tamp = 0.2 + 0.4 * Math.abs(Math.sin(t / 170)) * (0.5 + 0.5 * Math.random());
      else if (S === 'thinking') tamp = 0.14;
      else if (S === 'idle') tamp = 0.05 + 0.03 * Math.sin(t / 900);
      else tamp *= 0.92;
      amp += (tamp - amp) * 0.12;
      for (let k = 0; k < 3; k++) col[k] += (TC[S][k] - col[k]) * 0.06;
      mx += (mxT - mx) * 0.05;
      my += (myT - my) * 0.05;
      rot += dt * (S === 'thinking' ? 1.6 : 0.25);

      cx = W / 2;
      cy = H * 0.5;
      R = Math.min(W * (W > 1199 ? 0.19 : 0.3), H * 0.25);
      const ry = rot + mx * 0.9;
      const rx = 0.3 + my * 0.5;
      cr = Math.cos(ry);
      sr = Math.sin(ry);
      cxr = Math.cos(rx);
      sxr = Math.sin(rx);

      const c = col.map((v) => Math.round(v)).join(',');
      const sc = S === 'thinking' ? 0.86 : 1;
      const scan = Math.sin(t / 2600) * 0.95;

      g.clearRect(0, 0, W, H);
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
      gr.addColorStop(0, `rgba(${c},${0.13 + amp * 0.3})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      const k0 = W > 700 ? 1 : 0.7;
      const ex = amp * 0.4;

      for (const p of PT) {
        const d =
          (1 + ex * Math.sin(p.x * 5 + p.y * 4 + t / 260) * Math.cos(p.z * 5 - t / 330)) * sc;
        pj(
          (p.sx + (p.x - p.sx) * e) * d,
          (p.sy + (p.y - p.sy) * e) * d,
          (p.sz + (p.z - p.sz) * e) * d
        );
        const a =
          Math.min(1, 0.1 + 0.55 * o.d + 0.9 * Math.exp(-(((p.y - scan) * 8) ** 2))) *
          (0.3 + 0.7 * e);
        const s = (0.8 + 1.5 * o.d) * o.f * (1 + amp * 0.6) * k0;
        g.fillStyle = `rgba(${c},${a.toFixed(2)})`;
        g.fillRect(o.x - s / 2, o.y - s / 2, s, s);
      }

      for (const r of RG) {
        const cc = r.g ? '255,179,71' : c;
        const ca = Math.cos(r.tx);
        const sa = Math.sin(r.tx);
        const cb = Math.cos(r.tz);
        const sb = Math.sin(r.tz);
        const rr = r.r * (1 + amp * 0.12) * e;
        for (let i = 0; i < r.n; i++) {
          const a = (i / r.n) * 6.2832 + (t * r.v) / 1000;
          const X = Math.cos(a) * rr;
          const Z0 = Math.sin(a) * rr;
          const Y1 = -Z0 * sa;
          const Z = Z0 * ca;
          pj(X * cb - Y1 * sb, X * sb + Y1 * cb, Z);
          const tail = i < 14 ? (14 - i) / 14 : 0;
          const al = 0.08 + 0.4 * o.d + tail * 0.7;
          const s = (0.8 + tail * 2.4) * o.f * k0;
          g.fillStyle = `rgba(${cc},${(al * e).toFixed(2)})`;
          g.fillRect(o.x - s / 2, o.y - s / 2, s, s);
        }
      }
      g.globalCompositeOperation = 'source-over';

      const rt = document.documentElement.style;
      rt.setProperty('--mx', mx.toFixed(3));
      rt.setProperty('--s', c);

      const lv = Math.min(1, amp * 2.2);
      bars().forEach((b, i) => {
        (b as HTMLElement).style.transform = `scaleY(${(0.12 + lv * (0.4 + 0.6 * Math.abs(Math.sin(t / 120 + i * 1.3)))).toFixed(2)})`;
      });

      raf = requestAnimationFrame(fr);
    };
    raf = requestAnimationFrame(fr);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', rs);
      window.removeEventListener('pointermove', onMove);
      cv.removeEventListener('click', onClickCv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ zIndex: 0 }}
      aria-label="RAQIB neural core"
    />
  );
}
