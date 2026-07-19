import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ลบบรรทัด output: "export", ออก หรือใส่ // ข้างหน้าครับ
  // output: "export", 
  
  images: {
    // ถ้าไม่ได้ใช้ output: "export" คุณอาจไม่ต้องใช้ unoptimized ก็ได้ครับ
    unoptimized: true, 
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
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;