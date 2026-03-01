import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/config', '@repo/db'],
};

export default nextConfig;
