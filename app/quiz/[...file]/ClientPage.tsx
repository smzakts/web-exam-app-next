/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
// app/quiz/[...file]/ClientPage.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { CanvasBackground } from './CanvasBackground';

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

type LabelMode = 'kana' | 'number';

type ElasticState = 'open' | 'close' | null;

const KANA_LABELS = ['イ', 'ロ', 'ハ', 'ニ', 'ホ', 'ヘ', 'ト'] as const;
const NUM_LABELS = ['1', '2', '3', '4', '5', '6', '7'] as const;

function getAssetPrefix(): string {
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

function decodeFileParam(fileParam: string): { fileRaw: string; displayName: string } {
  const fileRaw = decodeURIComponent(fileParam);
  const displayName = fileRaw
    .replace(/\.csv$/i, '')
    .split('/')
    .map(seg => seg.trim())
    .filter(Boolean)
    .join(' / ');
  return { fileRaw, displayName };
}

function parseCsvText(text: string): string[][] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => line.split(','));
}

function rowsToQuizData(rows: string[][]): Quiz[] {
  return rows.map(row => {
    const cells = row.map(cell => (cell ?? '').trim());
    const [type = '', number = '', answer = '', image = '', question = '', ...rest] = cells;
    const options = rest.filter(Boolean);
    return { type, number, answer, image, question, options };
  });
}

function firstUnansweredFrom(
  arr: Array<Result | undefined>,
  start: number,
  total: number,
): number {
  if (total === 0) return -1;
  for (let i = start; i < total; i++) if (arr[i] === undefined) return i;
  for (let i = 0; i < start; i++) if (arr[i] === undefined) return i;
  return -1;
}

function getLabelIndex(label: string): number {
  const kanaIndex = KANA_LABELS.indexOf(label as any);
  if (kanaIndex >= 0) return kanaIndex;
  const numberIndex = NUM_LABELS.indexOf(label as any);
  if (numberIndex >= 0) return numberIndex;
  return -1;
}

async function fetchQuizData(prefix: string, fileRaw: string): Promise<Quiz[]> {
  const basePath = `/csv/${fileRaw}`;
  const candidates = [`${prefix}${basePath}`, basePath];
  let lastError: unknown;

  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} for ${url}`);
        continue;
      }
      const text = await res.text();
      return rowsToQuizData(parseCsvText(text));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('fetch failed');
}

function useElasticSidebar(): {
  isOpen: boolean;
  toggle: () => void;
  kick: ElasticState;
} {
  const [isOpen, setIsOpen] = useState(false);
  const [kick, setKick] = useState<ElasticState>(null);
  const timerRef = useRef<number | null>(null);

  const fireKick = useCallback((state: Exclude<ElasticState, null>) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setKick(state);
    timerRef.current = window.setTimeout(() => {
      setKick(null);
      timerRef.current = null;
    }, 500);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen(prev => {
      const next = !prev;
      fireKick(next ? 'open' : 'close');
      return next;
    });
  }, [fireKick]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return { isOpen, toggle, kick };
}

export default function ClientPage({ fileParam }: { fileParam: string }) {
  const router = useRouter();
  const prefix = useMemo(() => getAssetPrefix(), []);
  const { fileRaw, displayName } = useMemo(() => decodeFileParam(fileParam), [fileParam]);

  const [quizData, setQuizData] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Array<Result | undefined>>([]);
  const [labelMode, setLabelMode] = useState<LabelMode>('kana');
  const [viewIndex, setViewIndex] = useState(0);
  const [maxRevealed, setMaxRevealed] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { isOpen: sidebarOpen, toggle: toggleSidebar, kick: elasticKick } = useElasticSidebar();

  const totalCount = quizData.length;
  const currentQuestion = quizData[viewIndex];

  const { correctCount, percentage } = useMemo(() => {
    const correct = results.filter(result => result?.isCorrect).length;
    const total = quizData.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { correctCount: correct, percentage: pct };
  }, [results, quizData]);

  useEffect(() => {
    let cancelled = false;

    setQuizData([]);
    setResults([]);
    setViewIndex(0);
    setMaxRevealed(1);
    setLoadError(null);

    fetchQuizData(prefix, fileRaw)
      .then(data => {
        if (!cancelled) setQuizData(data);
      })
      .catch(error => {
        if (!cancelled) {
          console.error('CSV load failed:', error);
          setLoadError(`CSVの読み込みに失敗しました。ファイル: ${fileRaw}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fileRaw, prefix]);

  const undoLast = useCallback(() => {
    const lastIdx = results
      .map((result, index) => (result ? index : -1))
      .filter(index => index >= 0)
      .pop();
    if (lastIdx === undefined || lastIdx < 0) return;

    const nextResults = [...results];
    nextResults[lastIdx] = undefined;
    setResults(nextResults);
    setViewIndex(lastIdx);
  }, [results]);

  const resetQuiz = useCallback(() => {
    setResults([]);
    setViewIndex(0);
    setMaxRevealed(1);
  }, []);

  const answer = useCallback(
    (selectedLabel: string) => {
      const question = quizData[viewIndex];
      if (!question) return;

      const isCorrect =
        question.type === '2'
          ? question.answer === selectedLabel
          : getLabelIndex(selectedLabel) === getLabelIndex(question.answer);

      const nextResults: Array<Result | undefined> = [...results];
      nextResults[viewIndex] = {
        number: question.number,
        selected: selectedLabel,
        isCorrect,
        correctAnswer: question.answer,
      };

      const nextAfter = firstUnansweredFrom(nextResults, viewIndex + 1, totalCount);
      const firstAny = firstUnansweredFrom(nextResults, 0, totalCount);
      const nextIndex = nextAfter >= 0 ? nextAfter : firstAny >= 0 ? firstAny : viewIndex;
      const nextMax = Math.max(maxRevealed, Math.min(totalCount, nextIndex + 1));

      setResults(nextResults);
      setViewIndex(nextIndex);
      setMaxRevealed(nextMax);
    },
    [quizData, viewIndex, results, maxRevealed, totalCount],
  );

  const openQuestion = useCallback(
    (index: number) => {
      if (index < 0 || index >= totalCount) return;
      if (index >= maxRevealed) return;
      setViewIndex(index);
    },
    [maxRevealed, totalCount],
  );

  const availableLabels = labelMode === 'kana' ? KANA_LABELS : NUM_LABELS;
  const scoreText = `正答率: ${percentage}% (${correctCount}/${totalCount})`;
  const visibleCount = Math.min(maxRevealed, totalCount);

  const imgSrc = useCallback((name: string) => `${prefix}/img/${name}`, [prefix]);

  return (
    <>
      <CanvasBackground
        options={{
          density: 12,
          speedSec: 22,
          distance: 70,
          lines: 2,
          lineRGB: [88, 166, 255],
          circleRGB: [126, 231, 135],
          radius: 2,
          lineWidth: 1,
          mouse: true,
          updateClosest: false,
          fpsCap: 30,
        }}
      />

      <div className="global-header">
        <div className="bar">
          <button
            className={`hamburger-btn ${sidebarOpen ? 'is-open' : ''}`}
            aria-label="サイドバーを開閉"
            aria-pressed={sidebarOpen}
            onClick={toggleSidebar}
          >
            <span className="hb-line" />
            <span className="hb-line" />
            <span className="hb-line" />
          </button>

          <button className="ghost" onClick={() => router.push('/')}>目次</button>

          <div className="title">{displayName}</div>

          <div style={{ flex: 1 }} />

          <button className="ghost" onClick={undoLast}>戻る</button>
          <button onClick={resetQuiz}>リトライ</button>
          <select
            value={labelMode}
            onChange={event => setLabelMode(event.target.value as LabelMode)}
            aria-label="ラベル切替"
          >
            <option value="kana">イロハニ</option>
            <option value="number">1234</option>
          </select>
        </div>
      </div>

      <div
        className={[
          'page-shell',
          sidebarOpen ? 'with-sidebar-open' : '',
          elasticKick === 'open' ? 'sidebar-kick-open' : '',
          elasticKick === 'close' ? 'sidebar-kick-close' : '',
        ]
          .join(' ')
          .trim()}
      >
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
                {quizData.slice(0, visibleCount).map((question, index) => {
                  const result = results[index];
                  const isCurrent = index === viewIndex;
                  return (
                    <tr key={index} className={isCurrent ? 'current' : ''}>
                      <td
                        className="clickable"
                        onClick={() => openQuestion(index)}
                        title="この問題を表示"
                      >
                        {question.number || index + 1}
                      </td>
                      <td>{result?.selected ?? ''}</td>
                      <td
                        style={{
                          color: result
                            ? result.isCorrect
                              ? 'var(--accent-2)'
                              : 'var(--danger)'
                            : 'inherit',
                        }}
                      >
                        {result ? (result.isCorrect ? '正解' : '不正') : ''}
                      </td>
                      <td>{result?.correctAnswer ?? ''}</td>
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
              <p style={{ margin: 0, color: 'var(--danger)' }}>{loadError}</p>
            )}
            {!loadError && totalCount === 0 && (
              <p style={{ margin: 0 }}>CSVを読み込んでいます…</p>
            )}
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
                <button className="big-choice-btn" onClick={() => answer('○')}>
                  ○
                </button>
                <button className="big-choice-btn" onClick={() => answer('×')}>
                  ×
                </button>
              </div>
            )}

            {currentQuestion && currentQuestion.type !== '2' && (
              <>
                {availableLabels.map((label, index) => {
                  const text = currentQuestion.options[index];
                  if (!text) return null;
                  const value = String(label);
                  return (
                    <div key={value} className="choice-row" onClick={() => answer(value)}>
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
