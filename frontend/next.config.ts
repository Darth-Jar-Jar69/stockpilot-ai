import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone is for Docker/Railway; Vercel uses its own output.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
