import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "1";
const basePath = isGitHubPages ? "/fomo-maintenance" : "";

const nextConfig: NextConfig = {
  // Booking APIs need the Node server. Static export is only for a gated
  // GitHub Pages build (GITHUB_PAGES=1), which cannot run Stripe or Graph.
  ...(isGitHubPages
    ? {
        output: "export" as const,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
  basePath,
  assetPrefix: basePath || undefined,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  serverExternalPackages: ["stripe", "@microsoft/microsoft-graph-client"],
  async headers() {
    return [
      {
        source: "/manage/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
    ];
  },
};

export default nextConfig;
