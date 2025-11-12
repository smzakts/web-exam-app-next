export type Quiz = {
  type: string;
  number: string;
  answer: string;
  image: string;
  question: string;
  options: string[];
};

export type Result = {
  number: string;
  selected: string;
  isCorrect: boolean;
  correctAnswer: string;
};

export type LabelMode = 'kana' | 'number';

export const KANA_LABELS = ['イ', 'ロ', 'ハ', 'ニ', 'ホ', 'ヘ', 'ト'] as const;
export const NUM_LABELS = ['1', '2', '3', '4', '5', '6', '7'] as const;

export function getAssetPrefix(): string {
  const envPrefix = process.env.NEXT_PUBLIC_BASE_PATH || '';
  if (envPrefix) return envPrefix;

  if (typeof window !== 'undefined') {
    const runtimePrefix = (window as typeof window & {
      __NEXT_DATA__?: { assetPrefix?: string };
    }).__NEXT_DATA__?.assetPrefix;
    if (runtimePrefix && runtimePrefix.length > 0) {
      return runtimePrefix;
    }
  }

  if (typeof window !== 'undefined') {
    const segments = window.location.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      return `/${segments[0]!}`;
    }
  }

  return '';
}

export function decodeFileParam(fileParam: string): {
  fileRaw: string;
  displayName: string;
} {
  const fileRaw = decodeURIComponent(fileParam);
  const displayName = fileRaw
    .replace(/\.csv$/i, '')
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean)
    .join(' / ');

  return { fileRaw, displayName };
}

export function parseCsvText(text: string): string[][] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => line.split(','));
}

export function rowsToQuizData(rows: string[][]): Quiz[] {
  return rows.map(row => {
    const cells = row.map(cell => (cell ?? '').trim());
    const [type = '', number = '', answer = '', image = '', question = '', ...rest] = cells;
    const options = rest.filter(Boolean);
    return { type, number, answer, image, question, options };
  });
}

export async function fetchQuizData(prefix: string, fileRaw: string): Promise<Quiz[]> {
  const basePath = `/csv/${fileRaw}`;
  const candidates = [`${prefix}${basePath}`, basePath];
  let lastError: unknown;

  for (const url of candidates) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} for ${url}`);
        continue;
      }

      const text = await response.text();
      return rowsToQuizData(parseCsvText(text));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Failed to fetch quiz CSV.');
}

export function firstUnansweredFrom(
  entries: Array<Result | undefined>,
  startIndex: number,
  total: number,
): number {
  if (total === 0) return -1;

  for (let index = startIndex; index < total; index += 1) {
    if (entries[index] === undefined) return index;
  }

  for (let index = 0; index < startIndex; index += 1) {
    if (entries[index] === undefined) return index;
  }

  return -1;
}

export function getLabelIndex(label: string): number {
  const kanaIndex = KANA_LABELS.indexOf(label as (typeof KANA_LABELS)[number]);
  if (kanaIndex >= 0) return kanaIndex;

  const numberIndex = NUM_LABELS.indexOf(label as (typeof NUM_LABELS)[number]);
  if (numberIndex >= 0) return numberIndex;

  return -1;
}

export function createImgSrc(prefix: string) {
  return (name: string) => `${prefix}/img/${name}`;
}
