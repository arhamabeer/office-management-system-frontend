const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? 'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ems/config', '@ems/types', '@ems/validation', '@ems/api-client'],
  // Same-origin proxy: the browser talks to /api/* on the web origin, so the
  // httpOnly refresh cookie is first-party (survives reloads, no CORS needed).
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${BACKEND_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
