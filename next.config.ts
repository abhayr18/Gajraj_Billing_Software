import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // Static HTML/JS/CSS export — no server needed
  images: {
    unoptimized: true, // Required for static export
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
