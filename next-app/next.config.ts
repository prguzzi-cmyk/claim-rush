import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.FASTAPI_URL || "http://localhost:8888"}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
