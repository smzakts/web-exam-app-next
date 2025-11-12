// app/page.tsx
import path from 'path';
import Link from 'next/link';

import type { CsvEntry, CsvFile, CsvFolder } from '../lib/csv-tree';
import { buildCsvToc } from '../lib/csv-tree';
import { TOC_BACKGROUND_SCRIPT } from '../lib/toc-background-script';

function collectCsvItems(dir: string, parents: string[] = []): CsvItem[] {
  let dirents: fs.Dirent[] = [];
  try {
    dirents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  dirents.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  const items: CsvItem[] = [];
  for (const entry of dirents) {
    if (entry.name.startsWith('.')) continue;
    const nextPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      items.push(...collectCsvItems(nextPath, [...parents, entry.name]));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.csv')) {
      const segments = [...parents, entry.name];
      const display = segments
        .map((seg, idx) => (idx === segments.length - 1 ? seg.replace(/\.csv$/i, '') : seg))
        .join(' / ');
      const href = `/quiz/${segments.map(encodeURIComponent).join('/')}`;
      items.push({ name: display, href });
    }
  }
  return items;
}

export default async function Page() {
  // public/csv の一覧を取得（サーバー側）
  const dir = path.join(process.cwd(), 'public', 'csv');
  const items = collectCsvItems(dir).sort((a, b) => a.href.localeCompare(b.href, 'ja'));

  return (
    <ul className="toc-sublist">
      {entries.map(entry => {
        if (entry.kind === 'file') {
          return (
            <li key={entry.href} className="toc-subitem">
              <Link
                href={entry.href}
                className="toc-link"
                style={{ paddingLeft: linkPadding(depth) }}
              >
                <span>{entry.name}</span>
                <span>→</span>
              </Link>
            </li>
          );
        }

        return (
          <li key={entry.path.join('/') || entry.name} className="toc-subfolder">
            <details>
              <summary
                className="toc-summary"
                style={{ paddingLeft: summaryPadding(depth + 1) }}
              >
                <span>{entry.name}</span>
                <span aria-hidden className="toc-folder-indicator" />
              </summary>
              <FolderEntries entries={entry.entries} depth={depth + 1} />
            </details>
          </li>
        );
      })}
    </ul>
  );
}

export default async function Page() {
  // public/csv の一覧を取得（サーバー側）
  const dir = path.join(process.cwd(), 'public', 'csv');
  const toc = buildTocData(dir);

  return (
    <>
      {/* === 背景（静かで落ち着いた動き・ClientPage と同テイスト） === */}
      <div className="bg-canvas-wrap" aria-hidden>
        <canvas id="toc-bg" className="bg-canvas" />
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){
  const canvas = document.getElementById('toc-bg'); if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const DPR = Math.max(1, Math.floor(window.devicePixelRatio||1));
  const mql = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  const prefersReduced = mql && mql.matches;

  const opt = {
    density: 12,         // 点の密度（数字を大→点が少なく軽く）
    speedSec: 22,        // 周回にかける秒数（大きいほどゆっくり）
    distance: 70,        // 原点からの移動量（小さいほど控えめ）
    lines: 2,            // 近傍の線の本数
    lineRGB:[88,166,255],   // 青ライン
    circleRGB:[126,231,135],// 淡い緑の点
    radius:2,
    lineWidth:1,
    fpsCap:30            // フレーム上限でブレ感を軽減
  };

  const target = { x: innerWidth/2, y: innerHeight/2 };
  let w=0,h=0, points=[], raf=0, lastDraw=0, startTs=0;
  const frameInterval = 1000/Math.max(1,opt.fpsCap);

  function resize(){
    w=innerWidth; h=innerHeight;
    canvas.width=w*DPR; canvas.height=h*DPR;
    canvas.style.width=w+'px'; canvas.style.height=h+'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }

  function mkPoints(){
    points=[];
    let id=0;
    const sx=w/opt.density, sy=h/opt.density;
    for(let x=0;x<w;x+=sx){
      for(let y=0;y<h;y+=sy){
        const px=x+Math.random()*sx, py=y+Math.random()*sy;
        const baseSpeed = opt.speedSec*(0.9+Math.random()*0.2); // ±10%
        points.push({
          id:++id, x:px, y:py, ox:px, oy:py,
          o:0, c:[],                         // opacity, closest indices
          ph: Math.random()*Math.PI*2,       // 初期位相
          sp: (Math.PI*2)/baseSpeed          // 位相速度
        });
      }
    }
  }

function summaryPadding(depth: number): string {
  return `${SUMMARY_BASE + depth * INDENT_STEP}px`;
}

function linkPadding(depth: number): string {
  return `${LINK_BASE + depth * INDENT_STEP}px`;
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
