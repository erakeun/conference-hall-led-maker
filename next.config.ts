import type { NextConfig } from 'next';

const basePath = process.env.GITHUB_ACTIONS
  ? '/conference-hall-led-maker'
  : '';

const nextConfig: NextConfig = { output: 'export', basePath };

export default nextConfig;
