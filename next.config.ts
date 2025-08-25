/** @type {import('next').NextConfig} */
const isGithubActions = process.env.GITHUB_ACTIONS === 'true';
const repo = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : '';
const isUserOrOrgSite = repo && repo.endsWith('.github.io');

// Actions でのビルド時のみ basePath を付与（ユーザー/組織ページは除外）
const basePath = isGithubActions && !isUserOrOrgSite ? `/${repo}` : '';

const nextConfig = {
  // GitHub Pages で配信できるよう、静的書き出し
  output: 'export',
  // ルーティング用のベースパス（例: /web-exam-app-next）
  basePath,
  // アセットのパスもベースパス配下に
  assetPrefix: basePath,
  // 画像最適化を使わない（Pages でサーバー処理できないため）
  images: { unoptimized: true },
  // /path/ のように末尾スラッシュを付けて 404 を回避
  trailingSlash: true,
  // クライアント側でも basePath を参照できるよう公開
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

module.exports = nextConfig;
