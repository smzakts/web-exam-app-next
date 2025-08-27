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

// ✅ あなたの環境の型に合わせて Promise<Params> を受け取る
export default async function Page({ params }: { params: Promise<Params> }) {
  const { file } = await params;
  return <ClientPage fileParam={file} />;
}
