// app/quiz/[...file]/page.tsx
import path from 'path';

import { collectCsvFiles } from '../../../lib/csv-tree';
import ClientPage from './ClientPage';

type Params = { file: string[] };

export function generateStaticParams(): Params[] {
  const root = path.join(process.cwd(), 'public', 'csv');
  return collectCsvFiles(root).map(parts => ({ file: parts }));
}

export const dynamic = 'error';
export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<Params> }) {
  const { file } = await params;
  const segments = Array.isArray(file) ? file : [file];
  return <ClientPage fileParam={segments.join('/')} />;
}
