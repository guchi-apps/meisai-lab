// @ts-check

// このファイルを .ts にしない: 本番の `next start` は .ts の設定ファイルをトランスパイルするために
// SWCのネイティブバイナリを読み込み、そのまま常駐してメモリとスレッドを食う（#223）。
// .mjs なら読み込まれない。型は JSDoc で付ける。

const devAllowedOrigins = [
  "*.sslip.io",
  ...(process.env.DEV_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? []),
];

/** @type {import("next").NextConfig} */
const nextConfig = {
  allowedDevOrigins: devAllowedOrigins,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
  // 項目ページを設定の傘下へ移したため、旧URLのブックマークを新URLへ逃がす（#190）
  async redirects() {
    return [{ source: "/items", destination: "/settings/items", permanent: false }];
  },
};

export default nextConfig;
