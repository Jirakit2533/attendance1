/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '5ehj4jb22a.ufs.sh' },
      { protocol: 'https', hostname: 'utfs.io' },
      { protocol: 'https', hostname: 'i.pravatar.cc' },
      { protocol: 'https', hostname: 'ui-avatars.com' }
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  // 🚀 เพิ่มส่วนนี้เพื่อปิดการทำงานของ Turbopack ที่ทำให้เกิด Fatal Error
  experimental: {
    turbo: {
      enabled: false
    }
  }
};

module.exports = nextConfig;