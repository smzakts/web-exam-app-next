// app/page.tsx
import path from 'path';
import Link from 'next/link';

import type { CsvEntry, CsvFile, CsvFolder } from '../lib/csv-tree';
import { buildCsvToc } from '../lib/csv-tree';
import { TOC_BACKGROUND_SCRIPT } from '../lib/toc-background-script';

const SUMMARY_BASE = 20;
const LINK_BASE = 36;
const INDENT_STEP = 16;

function summaryPadding(depth: number): string {
  const base = SUMMARY_BASE + depth * INDENT_STEP;
  return String(base) + 'px';
}

function linkPadding(depth: number): string {
  const base = LINK_BASE + depth * INDENT_STEP;
  return String(base) + 'px';
}

function encodeHref(segments: string[]): string {
  return `/quiz/${segments.map(encodeURIComponent).join('/')}`;
}

function FileRow({ file, depth }: { file: CsvFile; depth: number }) {
  return (
    <li className="toc-subitem">
      <Link
        href={encodeHref(file.path)}
        className="toc-link"
        style={{ paddingLeft: linkPadding(depth) }}
      >
        <span>{file.name}</span>
        <span>→</span>
      </Link>
    </li>
  );
}

function FolderRow({ folder, depth }: { folder: CsvFolder; depth: number }) {
  return (
    <li className="toc-subfolder">
      <details>
        <summary
          className="toc-summary"
          style={{ paddingLeft: summaryPadding(depth + 1) }}
        >
          <span>{folder.name}</span>
          <span aria-hidden className="toc-folder-indicator" />
        </summary>
        <CsvEntriesList entries={folder.entries} depth={depth + 1} />
      </details>
    </li>
  );
}

function CsvEntriesList({ entries, depth }: { entries: CsvEntry[]; depth: number }) {
  if (entries.length === 0) {
    return (
      <div className="toc-empty" style={{ paddingLeft: linkPadding(depth) }}>
        CSV ファイルが見つかりませんでした。
      </div>
    );
  }

  return (
    <ul className="toc-sublist">
      {entries.map(entry => {
        if (entry.kind === 'file') {
          return <FileRow key={entry.path.join('/')} file={entry} depth={depth} />;
        }
        return <FolderRow key={entry.path.join('/')} folder={entry} depth={depth} />;
      })}
    </ul>
  );
}

export default async function Page() {
  const dir = path.join(process.cwd(), 'public', 'csv');
  const toc = buildCsvToc(dir);

  return (
    <>
      <div className="bg-canvas-wrap" aria-hidden>
        <canvas id="toc-bg" className="bg-canvas" />
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: TOC_BACKGROUND_SCRIPT }} />
      </div>

      <div className="toc-container">
        <h1 className="toc-title">試験問題 目次</h1>
        <div className="toc-card">
          <ul className="toc-list">
            {toc.folders.map(folder => (
              <li key={folder.path.join('/')} className="toc-folder">
                <details>
                  <summary
                    className="toc-summary"
                    data-root="true"
                    style={{ paddingLeft: summaryPadding(0) }}
                  >
                    <span>{folder.name}</span>
                    <span aria-hidden className="toc-folder-indicator" />
                  </summary>
                  <CsvEntriesList entries={folder.entries} depth={0} />
                </details>
              </li>
            ))}

            {toc.rootFiles.map(file => (
              <li key={file.path.join('/')} className="toc-item">
                <Link
                  href={encodeHref(file.path)}
                  className="toc-link"
                  style={{
                    paddingLeft: summaryPadding(0),
                    paddingTop: '18px',
                    paddingBottom: '18px',
                  }}
                >
                  <span>{file.name}</span>
                  <span>→</span>
                </Link>
              </li>
            ))}

            {toc.folders.length === 0 && toc.rootFiles.length === 0 && (
              <li className="toc-item" style={{ opacity: 0.8, padding: '18px 20px' }}>
                <span>public/csv フォルダに CSV が見つかりませんでした。</span>
              </li>
            )}
          </ul>
        </div>
      </div>
    </>
  );
}
