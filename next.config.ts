import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  assetPrefix: process.env.GITHUB_ACTIONS
    ? '/conference-hall-led-maker/'
    : undefined,
};

export default nextConfig;
