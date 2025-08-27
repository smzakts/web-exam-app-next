// app/quiz/[file]/page.tsx
import fs from 'fs';
import path from 'path';
import ClientPage from './ClientPage';

type Params = { file: string };

export async function generateStaticParams(): Promise<Params[]> {
  try {
    const dir = path.join(process.cwd(), 'public', 'csv');
    const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.csv'));
    return files.map(f => ({ file: f }));
  } catch {
    return [];
  }
}

export default function Page({ params }: { params: Params }) {
  const { file } = params;
  return <ClientPage fileParam={file} />;
}
