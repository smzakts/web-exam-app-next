// app/page.tsx
import fs from 'fs';
import path from 'path';
import Link from 'next/link';

type CsvFile = { name: string; href: string };
type CsvFolder = { name: string; files: CsvFile[] };
type TocData = { folders: CsvFolder[]; rootFiles: CsvFile[] };

function safeReadDir(dir: string): fs.Dirent[] {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.filter(entry => !entry.name.startsWith('.'));
  } catch {
    return [];
  }
}

function collectFolderFiles(
  baseDir: string,
  folderName: string,
  parents: string[] = [],
): CsvFile[] {
  const currentDir = path.join(baseDir, ...parents);
  const dirents = safeReadDir(currentDir);
  dirents.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  const files: CsvFile[] = [];

  for (const entry of dirents) {
    if (entry.isDirectory()) {
      files.push(...collectFolderFiles(baseDir, folderName, [...parents, entry.name]));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.csv')) {
      const relativeSegments = [...parents, entry.name.replace(/\.csv$/i, '')];
      const displayName = relativeSegments.join(' / ') || entry.name.replace(/\.csv$/i, '');
      const hrefSegments = [folderName, ...parents, entry.name].map(encodeURIComponent);
      files.push({ name: displayName, href: `/quiz/${hrefSegments.join('/')}` });
    }
  }

  files.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  return files;
}

function buildTocData(dir: string): TocData {
  const dirents = safeReadDir(dir);
  dirents.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  const folders: CsvFolder[] = [];
  const rootFiles: CsvFile[] = [];

  for (const entry of dirents) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const files = collectFolderFiles(entryPath, entry.name);
      folders.push({ name: entry.name, files });
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.csv')) {
      const href = `/quiz/${encodeURIComponent(entry.name)}`;
      rootFiles.push({ name: entry.name.replace(/\.csv$/i, ''), href });
    }
  }

  rootFiles.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  return { folders, rootFiles };
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

  function sd(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }

  function findClosest(){
    const n=points.length;
    for(let i=0;i<n;i++){
      const p=points[i]; p.c=[];
      for(let j=0;j<n;j++){
        if(i===j) continue;
        if(p.c.length<opt.lines){ p.c.push(j); continue; }
        for(let k=0;k<opt.lines;k++){
          const cj=p.c[k];
          if(sd(p.x,p.y,points[j].x,points[j].y) < sd(p.x,p.y,points[cj].x,points[cj].y)){
            p.c[k]=j; break;
          }
        }
      }
    }
  }

  function updatePositions(elapsedSec){
    for(const p of points){
      const phase = p.ph + p.sp*elapsedSec;
      // 各点で楕円率を微妙に変える（静かな変化）
      const rx = opt.distance*(0.75 + ((p.id%7)/7)*0.35);
      const ry = opt.distance*(0.75 + ((p.id%11)/11)*0.35);
      p.x = p.ox + Math.cos(phase)*rx;
      p.y = p.oy + Math.sin(phase*0.85)*ry;
    }
  }

  function drawFrame(){
    // 透明度（ターゲットに近いほど濃く）
    for(const p of points){
      const d = sd(p.x,p.y,target.x,target.y);
      p.o = d<6000? .28 : d<14000? .18 : d<36000? .08 : .04;
    }

    ctx.clearRect(0,0,w,h);

    // 線
    ctx.lineCap='round'; ctx.lineWidth=opt.lineWidth;
    for(const p of points){
      if(p.o<=0) continue;
      for(const idx of p.c){
        const q=points[idx];
        ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y);
        ctx.strokeStyle='rgba('+opt.lineRGB.join(',')+','+p.o+')';
        ctx.stroke();
      }
    }
    // 点
    for(const p of points){
      if(p.o<=0) continue;
      ctx.beginPath(); ctx.arc(p.x,p.y,opt.radius,0,Math.PI*2);
      ctx.fillStyle='rgba('+opt.circleRGB.join(',')+','+Math.min(p.o+.06,.5)+')';
      ctx.fill();
    }
  }

  function loop(ts){
    if(!startTs) startTs=ts;
    // FPS制限
    if(ts - lastDraw < frameInterval){ raf=requestAnimationFrame(loop); return; }
    const elapsedSec=(ts-startTs)/1000;
    updatePositions(elapsedSec);
    drawFrame();
    lastDraw=ts;
    raf=requestAnimationFrame(loop);
  }

  function onMouse(e){ target.x=e.clientX; target.y=e.clientY; }

  function init(){
    resize(); mkPoints(); findClosest();
    if(prefersReduced){ drawFrame(); return; }
    raf=requestAnimationFrame(loop);
  }

  addEventListener('resize', resize);
  addEventListener('mousemove', onMouse);
  init();
})();`
          }}
        />
      </div>

      {/* === 目次本体（globals.css 側で半透明＆ブラー済み） === */}
      <div className="toc-container">
        <h1 className="toc-title">試験問題 目次</h1>
        <div className="toc-card">
          <ul className="toc-list">
            {toc.folders.map(folder => (
              <li key={folder.name} className="toc-folder">
                <details>
                  <summary>
                    <span>{folder.name}</span>
                    <span aria-hidden className="toc-folder-indicator" />
                  </summary>
                  {folder.files.length > 0 ? (
                    <ul className="toc-sublist">
                      {folder.files.map(file => (
                        <li key={file.href} className="toc-subitem">
                          <Link href={file.href}>
                            <span>{file.name}</span>
                            <span>→</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="toc-empty">CSV ファイルが見つかりませんでした。</div>
                  )}
                </details>
              </li>
            ))}

            {toc.rootFiles.map(file => (
              <li key={file.href} className="toc-item">
                <Link href={file.href}>
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
