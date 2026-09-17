import type { NextConfig } from "next";
import path from "path";

const r2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, ".."),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "localhost" },
      ...(r2
        ? [
            {
              protocol: "https" as const,
              hostname: new URL(r2).hostname,
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
