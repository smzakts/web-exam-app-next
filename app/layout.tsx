// app/layout.tsx
import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Web Exam App',
  description: 'CSVから学科問題を出題するアプリ',
};

/**
 * モバイル最適化：
 * - device-width / initial-scale
 * - viewport-fit=cover（iPhoneノッチのsafe-area対応）
 * - maximumScale=1 でレイアウトのズレを軽減（必要に応じて外してOK）
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
