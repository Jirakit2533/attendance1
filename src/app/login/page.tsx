"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react"; // ลงเพิ่มด้วย npm install lucide-react

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const form = e.currentTarget;
    const username = (form.username as HTMLInputElement).value;
    const password = (form.password as HTMLInputElement).value;

    if (password !== "1234") {
      setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      return;
    }

    if (username === "admin") {
      localStorage.setItem("user", JSON.stringify({ role: "admin", username }));
      router.push("/administator");
    } else if (username.toLowerCase() === "provider") {
      localStorage.setItem("user", JSON.stringify({ role: "admin", username }));
      router.push("/provider");
    } else if (username === "leader") {
      localStorage.setItem("user", JSON.stringify({ role: "leader", username }));
      router.push("/leader");
    } else {
      localStorage.setItem("user", JSON.stringify({ role: "employee", username }));
      router.push("/employee");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f0f2f5] px-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-200 rounded-full blur-3xl opacity-50" />

      <section className="w-full max-w-md z-10">
        <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-8">
          
          <header className="text-center mb-8">
            {/* LOGO SPACE: ใส่ path โลโก้ของคุณที่นี่ */}
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                <ShieldCheck size={40} color="white" />
                {/* <img src="/your-logo-path.png" alt="Logo" className="w-full h-full object-contain" /> */}
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
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 ml-1 uppercase">
                ชื่อผู้ใช้
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <User size={18} />
                </span>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  placeholder="Username"
                  className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-10 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-gray-700"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 ml-1 uppercase">
                รหัสผ่าน
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Lock size={18} />
                </span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-10 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-gray-700"
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
              <div className="bg-red-50 text-red-600 text-xs py-2.5 px-4 rounded-lg text-center font-medium animate-pulse">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:scale-[1.02] active:scale-[0.98] transition-all mt-2"
            >
              ลงชื่อเข้าใช้งาน
            </button>
          </form>

          <footer className="mt-8 text-center">
            <p className="text-xs text-gray-400">
              © {new Date().getFullYear()} Siam Royal Group. All rights reserved.
            </p>
          </footer>
        </div>
      </section>
    </main>
  );
}