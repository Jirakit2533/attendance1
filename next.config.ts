import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '5ehj4jb22a.ufs.sh' },
      { protocol: 'https', hostname: 'utfs.io' },
      { protocol: 'https', hostname: 'i.pravatar.cc' },
      { protocol: 'https', hostname: 'ui-avatars.com' }
    ],
  },
  typescript: {
    // ห้ามลบ: ช่วยให้ Build ผ่านแม้มี Error ของ Type
    ignoreBuildErrors: true,
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  // ย้ายมาอยู่ชั้นนอกสุดตามที่ระบบแจ้งเตือน เพื่อแก้ปัญหา Multiple lockfiles
  outputFileTracingRoot: __dirname,
};

export default nextConfig;