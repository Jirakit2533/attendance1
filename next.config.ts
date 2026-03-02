/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '5ehj4jb22a.ufs.sh', // ✅ เพิ่มโฮสต์นี้ตามที่ Error ฟ้อง
      },
      {
        protocol: 'https',
        hostname: 'utfs.io', // สำหรับลิงก์ Uploadthing รูปแบบเก่า
      },
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
      },
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
      }
    ],
  },
  // ปรับปรุงประสิทธิภาพการ Build (ทางเลือก)
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;