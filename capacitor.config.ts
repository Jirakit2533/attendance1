import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.attendance.app',
  appName: 'SRS Time Attendance',
  webDir: 'public', 
  server: {
    url: 'https://attendance1-k1ds.vercel.app',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: "#ffffff",
    },
  }, // <--- ต้องปิดวงเล็บของ plugins และตัว SplashScreen ให้ครบแบบนี้ครับ
};

export default config;