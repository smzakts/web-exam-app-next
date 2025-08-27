/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
// app/quiz/[file]/ClientPage.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/* ================= 背景キャンバス（落ち着いた動き） ================= */

type BgOptions = {
  density?: number;      // 点の密度（大きいほど少なくなる）
  speedSec?: number;     // 周回にかける秒数（大きいほどゆっくり）
  distance?: number;     // 原点からの移動量（小さいほど控えめ）
  lines?: number;        // 近傍何本の線を引くか
  lineRGB?: [number, number, number];
  circleRGB?: [number, number, number];
  radius?: number;
  lineWidth?: number;
  mouse?: boolean;
  updateClosest?: boolean;
  fpsCap?: number;       // フレームレート上限（例: 30）
};

function CanvasBackground({ options = {} }: { options?: BgOptions }) {
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
      speedSec: options.speedSec ?? 20,     // ★ゆっくり
      distance: options.distance ?? 80,     // ★控えめ
      lines: options.lines ?? 2,            // ★線を減らす
      lineRGB: options.lineRGB ?? [88, 166, 255],
      circleRGB: options.circleRGB ?? [126, 231, 135],
      radius: options.radius ?? 2,
      lineWidth: options.lineWidth ?? 1,
      mouse: options.mouse ?? true,
      updateClosest: options.updateClosest ?? false,
      fpsCap: options.fpsCap ?? 30,         // ★30fpsに制限
    };

    type Pt = {
      id: number;
      x: number; y: number;
      ox: number; oy: number;  // origin
      opacity: number;
      closestIdx: number[];
      phase: number;           // 各点の初期位相
      phaseSpeed: number;      // 各点の速度（opt.speedSec±少し）
    };

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const state = {
      w: 0, h: 0,
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
          const baseSpeed = opt.speedSec * (0.9 + Math.random() * 0.2); // ±10%
          state.points.push({
            id: ++id,
            x: px, y: py,
            ox: px, oy: py,
            opacity: 0,
            closestIdx: [],
            phase: Math.random() * Math.PI * 2,  // 初期位相
            phaseSpeed: (Math.PI * 2) / baseSpeed,
          });
        }
      }
    }

    function sq(ax: number) { return ax * ax; }
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
      // 位相ベースのゆっくりした円運動（ノイズなし）
      for (const p of state.points) {
        const phase = p.phase + p.phaseSpeed * elapsedSec;
        // 各点ごとに微妙に楕円率を変える（静かな変化）
        const rx = opt.distance * (0.75 + ((p.id % 7) / 7) * 0.35); // 0.75〜1.1
        const ry = opt.distance * (0.75 + ((p.id % 11) / 11) * 0.35);
        p.x = p.ox + Math.cos(phase) * rx;
        p.y = p.oy + Math.sin(phase * 0.85) * ry; // y側は少し遅らせる
      }
    }

    function drawFrame() {
      // 透明度（ターゲットに近いほど濃く）※落ち着いた値に
      for (const p of state.points) {
        const d = sqDist(p.x, p.y, target.x, target.y);
        if (d < 6000) { p.opacity = 0.28; }
        else if (d < 14000) { p.opacity = 0.18; }
        else if (d < 36000) { p.opacity = 0.08; }
        else { p.opacity = 0.04; }
      }

      ctx.clearRect(0, 0, state.w, state.h);

      // 線
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
      // 点
      for (const p of state.points) {
        if (p.opacity <= 0) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, opt.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${opt.circleRGB[0]}, ${opt.circleRGB[1]}, ${opt.circleRGB[2]}, ${Math.min(p.opacity + 0.06, 0.5)})`;
        ctx.fill();
      }
    }

    function loop(ts: number) {
      if (prefersReduced) return; // OS設定を尊重して停止
      if (!state.startTs) state.startTs = ts;

      // FPS制限
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
        // 動かさず初回だけ描画
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

/* ================== ここから既存のクイズ実装 ================== */

type Quiz = {
  type: string;
  number: string;
  answer: string;
  image: string;
  question: string;
  options: string[];
};

type Result = {
  number: string;
  selected: string;
  isCorrect: boolean;
  correctAnswer: string;
};

const KANA_LABELS = ['イ', 'ロ', 'ハ', 'ニ', 'ホ', 'ヘ', 'ト'] as const;
const NUM_LABELS  = ['1', '2', '3', '4', '5', '6', '7'] as const;

/** 静的ファイル取得用のプレフィックス（GitHub Pages対策） */
function getPrefix(): string {
  const envPrefix = process.env.NEXT_PUBLIC_BASE_PATH || '';
  if (envPrefix) return envPrefix;

  if (typeof window !== 'undefined') {
    const anyWin = window as any;
    const runtime = anyWin.__NEXT_DATA__?.assetPrefix;
    if (typeof runtime === 'string' && runtime.length > 0) return runtime;
  }

  if (typeof window !== 'undefined') {
    const segs = window.location.pathname.split('/').filter(Boolean);
    if (segs.length > 0) return `/${segs[0]}`;
  }
  return '';
}

export default function ClientPage({ fileParam }: { fileParam: string }) {
  const router = useRouter();
  const PREFIX = getPrefix(); // 画像/CSV の取得のみで使用

  const fileRaw = decodeURIComponent(fileParam);
  const baseName = fileRaw.replace(/\.csv$/i, '');

  const [quizData, setQuizData] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Array<Result | undefined>>([]);
  const [labelMode, setLabelMode] = useState<'kana' | 'number'>('kana');

  const [viewIndex, setViewIndex] = useState<number>(0);
  const [maxRevealed, setMaxRevealed] = useState<number>(1);

  // サイドバー開閉（参考デザイン風の弾むアニメあり）
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // iPhone等のレイアウト調整用（今は未使用だが将来的に）
  const [isSmall, setIsSmall] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  // 弾む演出のキック
  const [elasticKick, setElasticKick] = useState<'open'|'close'|null>(null);
  const kickTimerRef = useRef<number | null>(null);

  const triggerElastic = (type: 'open'|'close') => {
    if (kickTimerRef.current) {
      window.clearTimeout(kickTimerRef.current);
      kickTimerRef.current = null;
    }
    setElasticKick(type);
    kickTimerRef.current = window.setTimeout(() => {
      setElasticKick(null);
      kickTimerRef.current = null;
    }, 500);
  };

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)');
    const apply = () => setIsSmall(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  useEffect(() => {
    return () => {
      if (kickTimerRef.current) window.clearTimeout(kickTimerRef.current);
    };
  }, []);

  const totalCount = quizData.length;
  const currentQuestion = quizData[viewIndex];

  const { correctCount, percentage } = useMemo(() => {
    const correct = results.filter(r => r?.isCorrect).length;
    const total = quizData.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { correctCount: correct, percentage: pct };
  }, [results, quizData]);

  const firstUnansweredFrom = (arr: Array<Result | undefined>, start: number, total: number): number => {
    if (total === 0) return -1;
    for (let i = start; i < total; i++) if (arr[i] === undefined) return i;
    for (let i = 0; i < start; i++) if (arr[i] === undefined) return i;
    return -1;
  };

  const parseCsv = (text: string): string[][] => {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      .split('\n')
      .filter(l => l.trim() !== '');
    return lines.map(line => line.split(','));
  };

  const rowsToQuizData = (rows: string[][]): Quiz[] => {
    return rows.map((row) => {
      const cells = row.map((c) => (c ?? '').trim());
      const [type = '', number = '', answer = '', image = '', question = '', ...rest] = cells;
      const options = rest.filter(Boolean);
      return { type, number, answer, image, question, options };
    });
  };

  /** フェッチを複数候補でトライ（GitHub Pages のパスずれ対策） */
  async function fetchWithFallbacks(path: string): Promise<Response> {
    const candidates = [`${PREFIX}${path}`, path];
    let lastErr: any = null;
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) return res;
        lastErr = new Error(`HTTP ${res.status} for ${url}`);
      } catch (e: any) {
        lastErr = e;
      }
    }
    throw lastErr ?? new Error('fetch failed');
  }

  // CSV読み込み
  useEffect(() => {
    const run = async () => {
      setQuizData([]);
      setResults([]);
      setViewIndex(0);
      setMaxRevealed(1);
      setLoadError(null);
      try {
        const res = await fetchWithFallbacks(`/csv/${fileRaw}`);
        const text = await res.text();
        const rows = parseCsv(text);
        const data = rowsToQuizData(rows);
        setQuizData(data);
      } catch (e: any) {
        console.error('CSV load failed:', e);
        setLoadError(`CSVの読み込みに失敗しました。ファイル: ${fileRaw}`);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileRaw, PREFIX]);

  const undoLast = useCallback(() => {
    const lastIdx = [...results].map((r, i) => r ? i : -1).filter(i => i >= 0).pop();
    if (lastIdx === undefined || lastIdx < 0) return;
    const newResults = [...results];
    newResults[lastIdx] = undefined;
    setResults(newResults);
    setViewIndex(lastIdx);
  }, [results]);

  const resetQuiz = useCallback(() => {
    setResults([]);
    setViewIndex(0);
    setMaxRevealed(1);
  }, []);

  const getIndexFromLabel = (label: string): number => {
    const ki = KANA_LABELS.indexOf(label as any);
    if (ki >= 0) return ki;
    const ni = NUM_LABELS.indexOf(label as any);
    if (ni >= 0) return ni;
    return -1;
  };

  const answer = useCallback((selectedLabel: string) => {
    const q = quizData[viewIndex];
    if (!q) return;

    const isCorrect =
      q.type === '2'
        ? (q.answer === selectedLabel)
        : (getIndexFromLabel(selectedLabel) === getIndexFromLabel(q.answer));

    const newResults: Array<Result | undefined> = [...results];
    newResults[viewIndex] = {
      number: q.number,
      selected: selectedLabel,
      isCorrect,
      correctAnswer: q.answer,
    };

    const nextAfter = firstUnansweredFrom(newResults, viewIndex + 1, totalCount);
    const firstAny = firstUnansweredFrom(newResults, 0, totalCount);
    const nextIndex = nextAfter >= 0 ? nextAfter : (firstAny >= 0 ? firstAny : viewIndex);
    const nextMax = Math.max(maxRevealed, Math.min(totalCount, nextIndex + 1));

    setResults(newResults);
    setViewIndex(nextIndex);
    setMaxRevealed(nextMax);
  }, [quizData, viewIndex, results, maxRevealed, totalCount]);

  const openQuestion = (i: number) => {
    if (i < 0 || i >= totalCount) return;
    if (i >= maxRevealed) return;
    setViewIndex(i);
  };

  const scoreText = `正答率: ${percentage}% (${correctCount}/${totalCount})`;
  const visibleCount = Math.min(maxRevealed, totalCount);

  const imgSrc = (name: string) => `${PREFIX}/img/${name}`;

  const onToggleSidebar = () => {
    setSidebarOpen(prev => {
      const next = !prev;
      triggerElastic(next ? 'open' : 'close');
      return next;
    });
  };

  return (
    <>
      {/* === 背景（静かで落ち着いた動き） === */}
      <CanvasBackground
        options={{
          density: 12,
          speedSec: 22,          // さらに落ち着かせたい場合は 28〜36
          distance: 70,
          lines: 2,
          lineRGB: [88,166,255],
          circleRGB: [126,231,135],
          radius: 2,
          lineWidth: 1,
          mouse: true,
          updateClosest: false,
          fpsCap: 30,
        }}
      />

      {/* === 固定ヘッダー === */}
      <div className="global-header">
        <div className="bar">
          <button
            className={`hamburger-btn ${sidebarOpen ? 'is-open' : ''}`}
            aria-label="サイドバーを開閉"
            aria-pressed={sidebarOpen}
            onClick={onToggleSidebar}
          >
            <span className="hb-line" />
            <span className="hb-line" />
            <span className="hb-line" />
          </button>

          <button className="ghost" onClick={() => router.push('/')}>目次</button>

          <div className="title">{baseName}</div>

          <div style={{ flex: 1 }} />

          <button className="ghost" onClick={undoLast}>戻る</button>
          <button onClick={resetQuiz}>リトライ</button>
          <select
            value={labelMode}
            onChange={(e) => setLabelMode(e.target.value as 'kana' | 'number')}
            aria-label="ラベル切替"
          >
            <option value="kana">イロハニ</option>
            <option value="number">1234</option>
          </select>
        </div>
      </div>

      {/* === 本体（サイドバーは state で開閉） === */}
      <div
        className={[
          'page-shell',
          sidebarOpen ? 'with-sidebar-open' : '',
          elasticKick === 'open' ? 'sidebar-kick-open' : '',
          elasticKick === 'close' ? 'sidebar-kick-close' : '',
        ].join(' ').trim()}
      >
        {/* 左：サイドバー */}
        <aside className="sidebar" id="sidebarMenu" aria-hidden={!sidebarOpen}>
          <div className="sidebar-curtain" aria-hidden="true" />
          <div className="sidebar-head">
            <div className="sidebar-title">履歴とスコア</div>
          </div>

          <div className="score">
            <span>{scoreText}</span>
          </div>

          <div className="history">
            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>選択</th>
                  <th>判定</th>
                  <th>解答</th>
                </tr>
              </thead>
              <tbody>
                {quizData.slice(0, visibleCount).map((q, i) => {
                  const r = results[i];
                  const isCurrent = i === viewIndex;
                  return (
                    <tr key={i} className={isCurrent ? 'current' : ''}>
                      <td className="clickable" onClick={() => openQuestion(i)} title="この問題を表示">
                        {q.number || i + 1}
                      </td>
                      <td>{r?.selected ?? ''}</td>
                      <td style={{ color: r ? (r.isCorrect ? 'var(--accent-2)' : 'var(--danger)') : 'inherit' }}>
                        {r ? (r.isCorrect ? '正解' : '不正解') : ''}
                      </td>
                      <td>{r?.correctAnswer ?? ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </aside>

        {/* 右：問題エリア（上下 1:1 固定） */}
        <section className="main">
          {/* 上：問題 */}
          <div className="question-card">
            {loadError && (
              <p style={{ margin: 0, color: 'var(--danger)' }}>
                {loadError}
              </p>
            )}
            {!loadError && totalCount === 0 && <p style={{ margin: 0 }}>CSVを読み込んでいます…</p>}
            {!loadError && totalCount > 0 && currentQuestion && (
              <>
                <p className="question-text">{currentQuestion.question}</p>
                {currentQuestion.image && (
                  <img className="question-image" src={imgSrc(currentQuestion.image)} alt="" />
                )}
              </>
            )}
          </div>

          {/* 下：選択肢 */}
          <div className="choices-card">
            {currentQuestion?.type === '2' && (
              <div className="tf-row">
                <button className="big-choice-btn" onClick={() => answer('○')}>○</button>
                <button className="big-choice-btn" onClick={() => answer('×')}>×</button>
              </div>
            )}

            {currentQuestion && currentQuestion.type !== '2' && (
              <>
                {(labelMode === 'kana' ? KANA_LABELS : NUM_LABELS).map((label, i) => {
                  const text = currentQuestion.options[i];
                  if (!text) return null;
                  return (
                    <div key={String(label)} className="choice-row" onClick={() => answer(String(label))}>
                      <div className="choice-chip">[{label}]</div>
                      <div className="choice-text">{text}</div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
