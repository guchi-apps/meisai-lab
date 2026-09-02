import type { NextConfig } from "next";

const devAllowedOrigins = [
  "*.sslip.io",
  ...(process.env.DEV_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? []),
];

const nextConfig: NextConfig = {
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
