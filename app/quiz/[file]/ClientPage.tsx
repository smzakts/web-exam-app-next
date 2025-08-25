/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
// app/quiz/[file]/ClientPage.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

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

/** ランタイムで basePath/assetPrefix を安全に取得 */
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
  const PREFIX = getPrefix();

  const fileRaw = decodeURIComponent(fileParam);
  const baseName = fileRaw.replace(/\.csv$/i, '');

  const [quizData, setQuizData] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Array<Result | undefined>>([]);
  const [labelMode, setLabelMode] = useState<'kana' | 'number'>('kana');

  const [viewIndex, setViewIndex] = useState<number>(0);
  const [maxRevealed, setMaxRevealed] = useState<number>(1);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [isSmall, setIsSmall] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)');
    const apply = () => setIsSmall(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
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

  /** フェッチを複数の候補でトライ（GitHub Pages でのパスずれ対策） */
  async function fetchWithFallbacks(path: string): Promise<Response> {
    const candidates = [
      `${PREFIX}${path}`,
      path,
    ];
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

  const sidebarWidth = sidebarOpen
    ? (isSmall ? '50vw' : '340px')
    : '0px';

  const scoreText = `正答率: ${percentage}% (${correctCount}/${totalCount})`;
  const visibleCount = Math.min(maxRevealed, totalCount);

  const imgSrc = (name: string) => `${PREFIX}/img/${name}`;

  return (
    <>
      <div className="global-header">
        <div className="bar">
          <button className="ghost" onClick={() => router.push(`${PREFIX}/`)}>目次</button>
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

      <button
        className={`sidebar-toggle ${sidebarOpen ? 'at-boundary' : 'at-left'}`}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'}
      >
        {sidebarOpen ? '«' : '»'}
      </button>

      <div className="page-shell" style={{ ['--sidebar-w' as any]: sidebarWidth }}>
        <aside className={`sidebar ${sidebarOpen ? '' : 'hidden'}`}>
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

        <section className="main">
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
