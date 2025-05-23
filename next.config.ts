import type { NextConfig } from "next";
import withPWAInit from '@ducanh2912/next-pwa'; 

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
   workboxOptions: {
    skipWaiting: true,
    // Add other Workbox-specific options here if needed,
    // like clientsClaim: true,
    // or runtimeCaching: [...]
  },
  // Optional: Disable PWA in development for faster builds if you don't need to debug the service worker
  // disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Add any other Next.js specific configurations here
};

export default withPWA(nextConfig);
