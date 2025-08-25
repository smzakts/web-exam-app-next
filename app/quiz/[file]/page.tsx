// app/quiz/[file]/page.tsx
import fs from 'fs';
import path from 'path';
import ClientPage from './ClientPage';

type Params = { file: string };

/**
 * output: 'export' のとき必須。
 * public/csv にある .csv を列挙して静的生成用のパラメータを返す。
 */
export async function generateStaticParams(): Promise<Params[]> {
  try {
    const dir = path.join(process.cwd(), 'public', 'csv');
    const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.csv'));
    return files.map(f => ({ file: f }));
  } catch {
    return [];
  }
}

/**
 * App Router の最新仕様では params は Promise。
 * 必ず await してから使用する。※このファイルは Server Component（'use client' 禁止）
 */
export default async function Page({ params }: { params: Promise<Params> }) {
  const { file } = await params;
  return <ClientPage fileParam={file} />;
}
