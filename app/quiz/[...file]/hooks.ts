'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchQuizData,
  firstUnansweredFrom,
  getLabelIndex,
  type Quiz,
  type Result,
} from './quiz-logic';

type ElasticState = 'open' | 'close' | null;

export function useElasticSidebar(): {
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

export function useQuizLoader(fileRaw: string, prefix: string): {
  quizData: Quiz[];
  loadError: string | null;
} {
  const [quizData, setQuizData] = useState<Quiz[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setQuizData([]);
    setLoadError(null);

    fetchQuizData(prefix, fileRaw)
      .then(data => {
        if (!cancelled) {
          setQuizData(data);
        }
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

  return { quizData, loadError };
}

function createEmptyResults(length: number): Array<Result | undefined> {
  return Array.from({ length }, () => undefined);
}

export function useQuizFlow(quizData: Quiz[]): {
  results: Array<Result | undefined>;
  viewIndex: number;
  visibleCount: number;
  currentQuestion: Quiz | undefined;
  totalCount: number;
  scoreText: string;
  answer: (selectedLabel: string) => void;
  undoLast: () => void;
  resetQuiz: () => void;
  openQuestion: (index: number) => void;
} {
  const [results, setResults] = useState<Array<Result | undefined>>([]);
  const [viewIndex, setViewIndex] = useState(0);
  const [maxRevealed, setMaxRevealed] = useState(1);

  const totalCount = quizData.length;

  useEffect(() => {
    setResults(createEmptyResults(totalCount));
    setViewIndex(0);
    setMaxRevealed(1);
  }, [totalCount, quizData]);

  const currentQuestion = quizData[viewIndex];

  const answer = useCallback(
    (selectedLabel: string) => {
      const question = quizData[viewIndex];
      if (!question) return;

      setResults(prev => {
        const next = [...prev];
        const isCorrect =
          question.type === '2'
            ? question.answer === selectedLabel
            : getLabelIndex(selectedLabel) === getLabelIndex(question.answer);

        next[viewIndex] = {
          number: question.number,
          selected: selectedLabel,
          isCorrect,
          correctAnswer: question.answer,
        };

        const nextAfter = firstUnansweredFrom(next, viewIndex + 1, totalCount);
        const firstAny = firstUnansweredFrom(next, 0, totalCount);
        const nextIndex = nextAfter >= 0 ? nextAfter : firstAny >= 0 ? firstAny : viewIndex;

        setViewIndex(nextIndex);
        setMaxRevealed(prevMax => Math.max(prevMax, Math.min(totalCount, nextIndex + 1)));

        return next;
      });
    },
    [quizData, totalCount, viewIndex],
  );

  const undoLast = useCallback(() => {
    setResults(prev => {
      for (let index = prev.length - 1; index >= 0; index -= 1) {
        if (prev[index]) {
          const next = [...prev];
          next[index] = undefined;
          setViewIndex(index);
          return next;
        }
      }
      return prev;
    });
  }, []);

  const resetQuiz = useCallback(() => {
    setResults(createEmptyResults(totalCount));
    setViewIndex(0);
    setMaxRevealed(1);
  }, [totalCount]);

  const openQuestion = useCallback(
    (index: number) => {
      setViewIndex(current => {
        const visible = Math.min(maxRevealed, totalCount);
        if (index < 0 || index >= totalCount) return current;
        if (index >= visible) return current;
        return index;
      });
    },
    [maxRevealed, totalCount],
  );

  const visibleCount = useMemo(
    () => Math.min(maxRevealed, totalCount),
    [maxRevealed, totalCount],
  );

  const correctCount = useMemo(
    () => results.filter(result => result?.isCorrect).length,
    [results],
  );

  const percentage = useMemo(() => {
    if (totalCount === 0) return 0;
    return Math.round((correctCount / totalCount) * 100);
  }, [correctCount, totalCount]);

  const scoreText = useMemo(
    () => `正答率: ${percentage}% (${correctCount}/${totalCount})`,
    [correctCount, percentage, totalCount],
  );

  return {
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
  };
}
