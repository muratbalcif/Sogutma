import type { NextConfig } from "next";
import path from "path";

const r2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      // Dev HMR + LAN access (external browser / phone on same Wi‑Fi)
      "connect-src 'self' https: http://localhost:* http://127.0.0.1:* http://192.168.*:* ws: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, ".."),
  images: {
    remotePatterns: [
      ...(r2
        ? [
            {
              protocol: "https" as const,
              hostname: new URL(r2).hostname,
            },
          ]
        : []),
      { protocol: "http", hostname: "localhost" },
      // Seed / local placeholder CDN used in catalog fixtures
      { protocol: "https", hostname: "cdn.furkansogutma.local" },
      { protocol: "http", hostname: "cdn.furkansogutma.local" },
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.cloudflarestorage.com" },
    ],
  },
  async headers() {
    return [
      // Do not attach page CSP to Turbopack/static assets — can break CSS in some browsers
      {
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
