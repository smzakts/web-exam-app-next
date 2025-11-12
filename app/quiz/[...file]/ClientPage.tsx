'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { CanvasBackground } from './CanvasBackground';
import {
  KANA_LABELS,
  NUM_LABELS,
  createImgSrc,
  decodeFileParam,
  getAssetPrefix,
  type LabelMode,
  type Quiz,
  type Result,
} from './quiz-logic';
import { useElasticSidebar, useQuizFlow, useQuizLoader } from './hooks';

type QuizHeaderProps = {
  displayName: string;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  onNavigateHome: () => void;
  undoLast: () => void;
  resetQuiz: () => void;
  labelMode: LabelMode;
  onLabelModeChange: (mode: LabelMode) => void;
};

function QuizHeader({
  displayName,
  sidebarOpen,
  toggleSidebar,
  onNavigateHome,
  undoLast,
  resetQuiz,
  labelMode,
  onLabelModeChange,
}: QuizHeaderProps) {
  return (
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

        <button className="ghost" onClick={onNavigateHome}>
          目次
        </button>

        <div className="title">{displayName}</div>

        <div style={{ flex: 1 }} />

        <button className="ghost" onClick={undoLast}>
          戻る
        </button>
        <button onClick={resetQuiz}>リトライ</button>
        <select
          value={labelMode}
          onChange={event => onLabelModeChange(event.target.value as LabelMode)}
          aria-label="ラベル切替"
        >
          <option value="kana">イロハニ</option>
          <option value="number">1234</option>
        </select>
      </div>
    </div>
  );
}

type HistoryTableProps = {
  questions: Quiz[];
  results: Array<Result | undefined>;
  visibleCount: number;
  viewIndex: number;
  onSelect: (index: number) => void;
};

function HistoryTable({ questions, results, visibleCount, viewIndex, onSelect }: HistoryTableProps) {
  return (
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
        {questions.slice(0, visibleCount).map((question, index) => {
          const result = results[index];
          const isCurrent = index === viewIndex;
          return (
            <tr key={index} className={isCurrent ? 'current' : ''}>
              <td
                className="clickable"
                onClick={() => onSelect(index)}
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
  );
}

type SidebarProps = {
  sidebarOpen: boolean;
  scoreText: string;
  questions: Quiz[];
  results: Array<Result | undefined>;
  visibleCount: number;
  viewIndex: number;
  onSelect: (index: number) => void;
};

function Sidebar({
  sidebarOpen,
  scoreText,
  questions,
  results,
  visibleCount,
  viewIndex,
  onSelect,
}: SidebarProps) {
  return (
    <aside className="sidebar" id="sidebarMenu" aria-hidden={!sidebarOpen}>
      <div className="sidebar-curtain" aria-hidden="true" />
      <div className="sidebar-head">
        <div className="sidebar-title">履歴とスコア</div>
      </div>

      <div className="score">
        <span>{scoreText}</span>
      </div>

      <div className="history">
        <HistoryTable
          questions={questions}
          results={results}
          visibleCount={visibleCount}
          viewIndex={viewIndex}
          onSelect={onSelect}
        />
      </div>
    </aside>
  );
}

type MainSectionProps = {
  loadError: string | null;
  showLoading: boolean;
  currentQuestion: Quiz | undefined;
  imgSrc: (name: string) => string;
  availableLabels: readonly string[];
  onAnswer: (label: string) => void;
};

function MainSection({
  loadError,
  showLoading,
  currentQuestion,
  imgSrc,
  availableLabels,
  onAnswer,
}: MainSectionProps) {
  return (
    <section className="main">
      <div className="question-card">
        {loadError && <p style={{ margin: 0, color: 'var(--danger)' }}>{loadError}</p>}
        {!loadError && showLoading && <p style={{ margin: 0 }}>CSVを読み込んでいます…</p>}
        {!loadError && !showLoading && currentQuestion && (
          <>
            <p className="question-text">{currentQuestion.question}</p>
            {currentQuestion.image && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="question-image"
                  src={imgSrc(currentQuestion.image)}
                  alt=""
                />
              </>
            )}
          </>
        )}
      </div>

      <div className="choices-card">
        {currentQuestion?.type === '2' && (
          <div className="tf-row">
            <button className="big-choice-btn" onClick={() => onAnswer('○')}>
              ○
            </button>
            <button className="big-choice-btn" onClick={() => onAnswer('×')}>
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
                <div key={value} className="choice-row" onClick={() => onAnswer(value)}>
                  <div className="choice-chip">[{label}]</div>
                  <div className="choice-text">{text}</div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
}

export default function ClientPage({ fileParam }: { fileParam: string }) {
  const router = useRouter();
  const prefix = useMemo(() => getAssetPrefix(), []);
  const { fileRaw, displayName } = useMemo(() => decodeFileParam(fileParam), [fileParam]);
  const { quizData, loadError } = useQuizLoader(fileRaw, prefix);
  const {
    results,
    viewIndex,
    visibleCount,
    currentQuestion,
    totalCount,
    scoreText,
    answer,
    undoLast,
    resetQuiz,
    openQuestion,
  } = useQuizFlow(quizData);
  const { isOpen: sidebarOpen, toggle: toggleSidebar, kick: elasticKick } = useElasticSidebar();
  const [labelMode, setLabelMode] = useState<LabelMode>('kana');

  const availableLabels = labelMode === 'kana' ? KANA_LABELS : NUM_LABELS;
  const imgSrc = useMemo(() => createImgSrc(prefix), [prefix]);
  const showLoading = !loadError && totalCount === 0;

  const containerClassName = [
    'page-shell',
    sidebarOpen ? 'with-sidebar-open' : '',
    elasticKick === 'open' ? 'sidebar-kick-open' : '',
    elasticKick === 'close' ? 'sidebar-kick-close' : '',
  ]
    .filter(Boolean)
    .join(' ');

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

      <QuizHeader
        displayName={displayName}
        sidebarOpen={sidebarOpen}
        toggleSidebar={toggleSidebar}
        onNavigateHome={() => router.push('/')}
        undoLast={undoLast}
        resetQuiz={resetQuiz}
        labelMode={labelMode}
        onLabelModeChange={setLabelMode}
      />

      <div className={containerClassName}>
        <Sidebar
          sidebarOpen={sidebarOpen}
          scoreText={scoreText}
          questions={quizData}
          results={results}
          visibleCount={visibleCount}
          viewIndex={viewIndex}
          onSelect={openQuestion}
        />

        <MainSection
          loadError={loadError}
          showLoading={showLoading}
          currentQuestion={currentQuestion}
          imgSrc={imgSrc}
          availableLabels={availableLabels}
          onAnswer={answer}
        />
      </div>
    </>
  );
}
