import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {},
  async redirects() {
    return [{ source: "/app/overview", destination: "/app", permanent: true }];
  },
};

export default nextConfig;
