import type { NextConfig } from "next";
import withPWAInit from '@ducanh2912/next-pwa'; 

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
   workboxOptions: {
    skipWaiting: true,
     runtimeCaching: [
      {
        urlPattern: /^https?.*/, // Cache external resources
        handler: 'NetworkFirst',
        options: {
          cacheName: 'offlineCache',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          },
        },
      },
      {
        urlPattern: /^\/api\/donations\/.*/, // Cache API responses
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'donations-api',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          },
        },
      },
    ],
  },
  cacheOnFrontEndNav: true,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  //  swcMinify: true,
 images: {
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        port: '',
        pathname: '/**', // Allow all paths under Vercel Blob
      },
    ],
  },
};

export default withPWA(nextConfig);
