import type { NextConfig } from 'next';
const config: NextConfig = {
  // Keep the development server and production build from sharing Windows cache files.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next-build',
  poweredByHeader: false,
  webpack(config) {
    config.resolve.alias = { ...config.resolve.alias, 'onnxruntime-node': false };
    return config;
  },
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' }
    ] }];
  }
};
export default config;
