"use client";

import { useState, useTransition } from "react";
import { User, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { loginAction } from "@/server/auth";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const result = await loginAction(formData);
        
        if (result.success) {
          // ✅ ใช้ window.location.href เพื่อล้างสถานะและให้ Middleware ตรวจสอบสิทธิ์ใหม่ทันที
          // หมายเหตุ: คุกกี้ถูกเซ็ตจาก Server Action เรียบร้อยแล้ว ไม่จำเป็นต้องเซ็ตซ้ำที่นี่ครับ
          window.location.href = result.redirect;
        } else {
          setError(result.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
        }
      } catch (err) {
        setError("เกิดข้อผิดพลาดในการเชื่อมต่อระบบ");
      }
    });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f0f2f5] px-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-200 rounded-full blur-3xl opacity-50" />

      <section className="w-full max-w-md z-10">
        <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-8">
          
          <header className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-gradient-to-tr from-white to-blue-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 overflow-hidden">
                {/* ใส่โลโก้ของคุณตรงนี้ */}
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain p-2" />
              </div>
            </div>
            <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">
              Siam Royal System
            </h1>
            <p className="text-gray-500 text-sm mt-1 uppercase tracking-widest font-medium">
              Time Attendance
            </p>
          </header>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 ml-1 uppercase">
                ชื่อผู้ใช้
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <User size={18} />
                </span>
                <input
                  name="username"
                  type="text"
                  required
                  disabled={isPending}
                  placeholder="Username"
                  className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-10 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-gray-700 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 ml-1 uppercase">
                รหัสผ่าน
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Lock size={18} />
                </span>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={isPending}
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
              disabled={isPending}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:scale-[1.02] active:scale-[0.98] transition-all mt-2 flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  กำลังตรวจสอบ...
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