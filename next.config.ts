import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow embedding in iframes (LMS)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Remove SAMEORIGIN restriction so this app can be embedded anywhere
          { key: "X-Frame-Options", value: "ALLOWALL" },
          // Modern CSP frame-ancestors (overrides X-Frame-Options in modern browsers)
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
    ];
  },
};

export default nextConfig;
