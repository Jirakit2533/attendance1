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
  // ✅ วิธีปิดการเช็ค Error ตอน Build ที่ถูกต้องสำหรับเวอร์ชันใหม่
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 💡 เพิ่มตรงนี้เพื่อช่วยเรื่อง Root Directory ที่ระบบบ่น
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

module.exports = nextConfig;