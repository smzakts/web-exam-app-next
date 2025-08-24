// app/quiz/[file]/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

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

export default function QuizPage() {
  const params = useParams<{ file: string }>();
  const router = useRouter();

  const fileRaw = decodeURIComponent(params.file);
  const baseName = fileRaw.replace(/\.csv$/i, '');

  const [quizData, setQuizData] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Array<Result | undefined>>([]); // index = 0-based
  const [labelMode, setLabelMode] = useState<'kana' | 'number'>('kana');

  // 表示中の問題（0-based）
  const [viewIndex, setViewIndex] = useState<number>(0);

  // 左表の段階表示：最大でここまでのNoを見せる（1,2,3,...）
  const [maxRevealed, setMaxRevealed] = useState<number>(1); // 初期は No1 のみ表示

  // サイドバー開閉
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // モバイル幅判定（<= 860px）
  const [isSmall, setIsSmall] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)');
    const apply = () => setIsSmall(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  const totalCount = quizData.length;
  const currentQuestion = quizData[viewIndex];

  // スコア
  const { correctCount, percentage } = useMemo(() => {
    const correct = results.filter(r => r?.isCorrect).length;
    const total = quizData.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { correctCount: correct, percentage: pct };
  }, [results, quizData]);

  // 与えられた配列 arr で、start 以降 → 先頭の順に「未回答(=undefined)」の最初の位置を返す（上限は total）
  const firstUnansweredFrom = (arr: Array<Result | undefined>, start: number, total: number): number => {
    if (total === 0) return -1;
    for (let i = start; i < total; i++) if (arr[i] === undefined) return i;
    for (let i = 0; i < start; i++) if (arr[i] === undefined) return i;
    return -1;
  };

  // CSVパース（簡易）
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

  // CSV読み込み
  useEffect(() => {
    const run = async () => {
      setQuizData([]);
      setResults([]);
      setViewIndex(0);
      setMaxRevealed(1);
      try {
        const res = await fetch(`/csv/${fileRaw}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`CSVの取得に失敗しました (${res.status})`);
        const text = await res.text();
        const rows = parseCsv(text);
        const data = rowsToQuizData(rows);
        setQuizData(data);
      } catch (e) {
        console.error(e);
      }
    };
    run();
  }, [fileRaw]);

  // “戻る”：最後の回答を取り消し、そこを表示（段階表示は縮めない）
  const undoLast = useCallback(() => {
    const lastIdx = [...results].map((r, i) => r ? i : -1).filter(i => i >= 0).pop();
    if (lastIdx === undefined || lastIdx < 0) return;
    const newResults = [...results];
    newResults[lastIdx] = undefined;
    setResults(newResults);
    setViewIndex(lastIdx);
  }, [results]);

  // “リトライ”：全消去、No1からやり直し
  const resetQuiz = useCallback(() => {
    setResults([]);
    setViewIndex(0);
    setMaxRevealed(1);
  }, []);

  // ラベル→インデックス
  const getIndexFromLabel = (label: string): number => {
    const ki = KANA_LABELS.indexOf(label as any);
    if (ki >= 0) return ki;
    const ni = NUM_LABELS.indexOf(label as any);
    if (ni >= 0) return ni;
    return -1;
  };

  // 回答：クリック1回で「記録 → 次の未回答へ」
  const answer = useCallback((selectedLabel: string) => {
    const q = quizData[viewIndex];
    if (!q) return;

    const isCorrect =
      q.type === '2'
        ? (q.answer === selectedLabel)                                    // ○×
        : (getIndexFromLabel(selectedLabel) === getIndexFromLabel(q.answer)); // 択一

    // 新しい結果配列を作る（これで次の表示先を決める）
    const newResults: Array<Result | undefined> = [...results];
    newResults[viewIndex] = {
      number: q.number,
      selected: selectedLabel,
      isCorrect,
      correctAnswer: q.answer,
    };

    // 次の未回答
    const nextAfter = firstUnansweredFrom(newResults, viewIndex + 1, totalCount);
    const firstAny = firstUnansweredFrom(newResults, 0, totalCount);
    const nextIndex = nextAfter >= 0 ? nextAfter : (firstAny >= 0 ? firstAny : viewIndex);

    // 段階表示の上限を広げる
    const nextMax = Math.max(maxRevealed, Math.min(totalCount, nextIndex + 1));

    // 一括更新
    setResults(newResults);
    setViewIndex(nextIndex);
    setMaxRevealed(nextMax);
  }, [quizData, viewIndex, results, maxRevealed, totalCount]);

  // Noクリックでその問題を開く（段階表示ルール）
  const openQuestion = (i: number) => {
    if (i < 0 || i >= totalCount) return;
    if (i >= maxRevealed) return; // まだ見せないNoなら無効
    setViewIndex(i);
  };

  // 小画面では「半々/全幅」をJS側で幅指定
  const sidebarWidth = sidebarOpen
    ? (isSmall ? '50vw' : '340px')
    : '0px';

  const scoreText = `正答率: ${percentage}% (${correctCount}/${totalCount})`;
  const visibleCount = Math.min(maxRevealed, totalCount);

  return (
    <>
      {/* === 上部固定ヘッダー === */}
      <div className="global-header">
        <div className="bar">
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

      {/* === サイドバー開閉ボタン（小型・«/»・境界/中央） === */}
      <button
        className={`sidebar-toggle ${sidebarOpen ? 'at-boundary' : 'at-left'}`}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'}
      >
        {sidebarOpen ? '«' : '»'}
      </button>

      {/* === 本体（小画面では半々 / 閉時は右カラム全幅） === */}
      <div className="page-shell" style={{ ['--sidebar-w' as any]: sidebarWidth }}>
        {/* 左：サイドバー（段階表示） */}
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
                      <td
                        className="clickable"
                        onClick={() => openQuestion(i)}
                        title="この問題を表示"
                      >
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

        {/* 右：問題エリア */}
        <section className="main">
          <div className="question-card">
            {totalCount === 0 && <p style={{ margin: 0 }}>CSVを読み込んでいます…</p>}
            {totalCount > 0 && currentQuestion && (
              <>
                <p className="question-text">
                  {currentQuestion.question}
                </p>
                {currentQuestion.image && (
                  <img className="question-image" src={`/img/${currentQuestion.image}`} alt="" />
                )}
              </>
            )}
          </div>

          <div className="choices-card">
            {/* ○× */}
            {currentQuestion?.type === '2' && (
              <div className="tf-row">
                <button className="big-choice-btn" onClick={() => answer('○')}>○</button>
                <button className="big-choice-btn" onClick={() => answer('×')}>×</button>
              </div>
            )}

            {/* 択一（[イ] 文章） */}
            {currentQuestion && currentQuestion.type !== '2' && (
              <>
                {(labelMode === 'kana' ? KANA_LABELS : NUM_LABELS).map((label, i) => {
                  const text = currentQuestion.options[i];
                  if (!text) return null;
                  return (
                    <div
                      key={String(label)}
                      className="choice-row"
                      onClick={() => answer(String(label))}
                    >
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

// この動的セグメントは、生成したパス以外を 404 にします（未定義URL対策）
export const dynamicParams = false;

// 静的に生成するパス一覧を返す
export async function generateStaticParams() {
  const fs = await import('fs');
  const path = await import('path');

  // public/csv フォルダの .csv を列挙 → 拡張子を外して { file } に変換
  const dir = path.join(process.cwd(), 'public', 'csv');
  let names: string[] = [];
  try {
    names = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith('.csv'))
      .map((d) => d.name.replace(/\.csv$/i, ''));
  } catch (e) {
    // フォルダがなくてもエラーにしない（空配列なら /quiz/* は生成されない）
    names = [];
  }

  // [{ file: 'math' }, { file: 'english' }] のような形で返す
  return names.map((file) => ({ file }));
}