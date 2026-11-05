import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Posters come pre-sized from TMDB (or the API's mock images), so no image optimization.
  images: { unoptimized: true },
  turbopack: {
    rules: {
      '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' },
    },
  },
  // TMDB images through this domain: image.tmdb.org is blocked by some networks/ISPs, so the
  // browser loads /tmdb-images/... from the web app and the server fetches it from TMDB.
  // Enable by setting TMDB_IMAGE_BASE_URL=<web-url>/tmdb-images on the API.
  async rewrites() {
    return [{ source: '/tmdb-images/:path*', destination: 'https://image.tmdb.org/t/p/:path*' }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
