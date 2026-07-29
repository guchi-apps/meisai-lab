import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "明細ラボ",
    short_name: "明細ラボ",
    description: "給与・賞与管理アプリ",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f5ee",
    theme_color: "#33724c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
