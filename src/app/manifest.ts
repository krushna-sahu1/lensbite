import type { MetadataRoute } from "next";

/**
 * Web app manifest (served at /manifest.webmanifest). Makes LensBite
 * installable to the home screen on Android and desktop Chrome/Edge, opening
 * full screen without browser chrome. src/proxy.ts lets it through without a
 * session: browsers fetch it without cookies.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LensBite",
    short_name: "LensBite",
    description: "Point your camera at food and talk to an AI nutrition buddy.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d0f0e",
    theme_color: "#0d0f0e",
    categories: ["health", "food", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Insights", url: "/insights", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] }],
  };
}
