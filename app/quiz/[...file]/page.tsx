// app/quiz/[...file]/page.tsx
import fs from 'fs';
import path from 'path';
import ClientPage from './ClientPage';

type Params = { file: string[] };

function collectCsvSegments(dir: string, parents: string[] = []): string[][] {
  let dirents: fs.Dirent[] = [];
  try {
    dirents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  dirents.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  const results: string[][] = [];
  for (const entry of dirents) {
    if (entry.name.startsWith('.')) continue;
    const nextPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectCsvSegments(nextPath, [...parents, entry.name]));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.csv')) {
      results.push([...parents, entry.name]);
    }
  }
  return results;
}

export function generateStaticParams(): Params[] {
  const root = path.join(process.cwd(), 'public', 'csv');
  const files = collectCsvSegments(root);
  return files.map(parts => ({ file: parts }));
}

export const dynamic = 'error';
export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<Params> }) {
  const { file } = await params;
  const segments = Array.isArray(file) ? file : [file];
  const relativePath = segments.join('/');
  return <ClientPage fileParam={relativePath} />;
}
