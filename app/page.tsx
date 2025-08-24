// app/page.tsx
import fs from 'fs';
import path from 'path';
import Link from 'next/link';

export const dynamic = 'force-static'; // 公開フォルダの静的一覧として扱う（CSVの追加は再ビルド推奨）

export default function IndexPage() {
  const csvDir = path.join(process.cwd(), 'public', 'csv');
  let files: string[] = [];
  try {
    files = fs
      .readdirSync(csvDir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.toLowerCase().endsWith('.csv'))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b, 'ja'));
  } catch {
    // ディレクトリが無い場合のフォールバック
    files = [];
  }

  return (
    <div className="toc-container">
      <h1 className="toc-title">目次（CSV一覧）</h1>

      {files.length === 0 ? (
        <p className="toc-empty">
          public/csv にCSVファイルがありません。<br />
          例: <code>public/csv/sample.csv</code> を作成してください。
        </p>
      ) : (
        <ul className="toc-list">
          {files.map((name) => {
            const href = `/quiz/${encodeURIComponent(name)}`;
            return (
              <li key={name} className="toc-item">
                <Link href={href}>{name}</Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
