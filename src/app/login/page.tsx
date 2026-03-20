"use client";

import { useState, useTransition, useEffect } from "react";
import { User, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { handleLoginServer, clearSessionAction } from "@/app/login/api/login-server";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // ล้าง Cookies ผ่าน Server Action เมื่อเข้าหน้า Login
    clearSessionAction();

    const params = new URLSearchParams(window.location.search);
    if (params.get("invalid") || params.get("expired")) {
      setError("เซสชันหมดอายุหรือข้อมูลไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่");
    }
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        // เรียกใช้ Logic จาก Server Action ที่แยกออกมา
        const result = await handleLoginServer(formData);
        
        if (result.success) {
          setIsProcessing(true);
          window.location.href = result.redirect || "/";
        } else {
          setError(result.message);
          setIsProcessing(false);
        }
      } catch (err) {
        setError("เกิดข้อผิดพลาดในการเชื่อมต่อระบบ");
        setIsProcessing(false);
      }
    });
  };

  const isLoading = isPending || isProcessing;

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f0f2f5] px-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-200 rounded-full blur-3xl opacity-50" />

      <section className="w-full max-w-md z-10">
        <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-8">
          
          <header className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-gradient-to-tr from-white to-blue-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 overflow-hidden">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain p-2" />
              </div>
            </div>
            <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Siam Royal System</h1>
            <p className="text-gray-500 text-sm mt-1 uppercase tracking-widest font-medium">Time Attendance</p>
          </header>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 ml-1 uppercase">ชื่อผู้ใช้</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <User size={18} />
                </span>
                <input
                  name="username"
                  type="text"
                  required
                  disabled={isLoading}
                  placeholder="username"
                  className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-10 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-gray-700 disabled:opacity-50 lowercase"
                  onInput={(e) => {
                    const target = e.target as HTMLInputElement;
                    target.value = target.value.toLowerCase();
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 ml-1 uppercase">รหัสผ่าน</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Lock size={18} />
                </span>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={isLoading}
                  placeholder="••••••••"
                  className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-10 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-gray-700 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-[11px] py-2.5 px-4 rounded-lg text-center font-bold animate-pulse">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:scale-[1.02] active:scale-[0.98] transition-all mt-2 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  {isProcessing ? "กำลังนำคุณเข้าสู่ระบบ..." : "กำลังตรวจสอบ..."}
                </>
              ) : (
                "ลงชื่อเข้าใช้งาน"
              )}
            </button>
          </form>

          <footer className="mt-8 text-center border-t border-gray-50 pt-6">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              © {new Date().getFullYear()} Siam Royal Group. All rights reserved.
            </p>
          </footer>
        </div>
      </section>
    </main>
  );
}