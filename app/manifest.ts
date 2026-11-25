import type { MetadataRoute } from "next";

/** Lets Chrome (and other browsers) install Mlyfo as an app: its own icon, full screen, no address bar. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mlyfo",
    short_name: "Mlyfo",
    description: "Split bills, pay friends and check every address before money moves.",
    id: "/app",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#07080D",
    theme_color: "#07080D",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mlyfo Pad", url: "/app/pad", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Shield", url: "/app/shield", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
