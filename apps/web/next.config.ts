import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Placeholder artwork is served from placehold.co until real assets land in /public.
    // See ASSETS.md for the replacement list.
    remotePatterns: [{ protocol: "https", hostname: "placehold.co" }],
  },
  async redirects() {
    return [{ source: "/app/overview", destination: "/app", permanent: true }];
  },
};

export default nextConfig;
