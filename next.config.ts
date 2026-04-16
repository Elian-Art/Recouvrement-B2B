import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // ESLint is run separately in CI; ignore during builds to avoid
    // Node v24 / resolve-from path resolution issues with legacy ESLint packages.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
