"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Building2, 
  Users, 
  ShieldCheck, 
  LogOut, 
  Plus, 
  MoreVertical,
  CircleCheck,
  CircleAlert
} from "lucide-react"; // แนะนำให้ลง lucide-react เพื่อความสวยงามครับ

/* ================== TYPES (เหมือนเดิม) ================== */
type Company = { id: string; name: string; code: string; status: "active" | "suspended"; createdAt: string; };
type CompanyAdmin = { id: string; companyId: string; name: string; username: string; email?: string; status: "active" | "suspended"; createdAt: string; };

export default function ProviderPage() {
  const router = useRouter();

  /* ---------- PROVIDER INFO ---------- */
  const provider = {
    name: "นายสมพงษ์ ร่ำรวย",
    role: "System Provider",
    company: "Siam Royal System Co., Ltd.",
    avatar: "/profile.png", // อย่าลืมใส่ไฟล์ใน public/ หรือเปลี่ยน path นะครับ
  };

  /* ---------- STATE ---------- */
  const [companies, setCompanies] = useState<Company[]>([
    { id: "COMP-001", name: "Thai Smart Factory", code: "TSF", status: "active", createdAt: new Date().toISOString() },
  ]);

  const [admins, setAdmins] = useState<CompanyAdmin[]>([
    { id: "ADM-001", companyId: "COMP-001", name: "สมชาย ร่ำรวย", username: "tsf_admin", email: "admin@tsf.co.th", status: "active", createdAt: new Date().toISOString() },
  ]);

  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);

  const handleLogout = () => router.push("/login");

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans">
      
      {/* TOP NAV / LOGO SECTION */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-100">
               {/* ใส่โลโก้ของคุณตรงนี้ */}
               <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain invert brightness-0" 
                    onError={(e) => e.currentTarget.style.display = 'none'} />
               <ShieldCheck className="text-white absolute" size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none text-slate-900">Siam Royal</h1>
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-blue-600">Provider Console</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <p className="text-sm font-bold text-slate-900">{provider.name}</p>
              <p className="text-[11px] text-slate-500">{provider.role}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        
        {/* WELCOME SECTION */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">แดชบอร์ดภาพรวม</h2>
            <p className="text-slate-500 text-sm">จัดการข้อมูลบริษัทลูกค้าและสิทธิ์การเข้าถึงระบบ</p>
          </div>
          <div className="flex gap-2">
             <button onClick={() => setShowCompanyForm(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md shadow-blue-100">
                <Plus size={18} /> เพิ่มบริษัทใหม่
             </button>
          </div>
        </header>

        {/* STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="บริษัททั้งหมด" value={companies.length} icon={<Building2 className="text-blue-600" />} color="blue" />
          <StatCard title="Admin ทั้งหมด" value={admins.length} icon={<Users className="text-purple-600" />} color="purple" />
          <StatCard title="เปิดใช้งานอยู่" value={companies.filter(c => c.status === "active").length} icon={<CircleCheck className="text-emerald-600" />} color="emerald" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* COMPANY TABLE */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">บริษัทลูกค้า (Tenants)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500">
                  <tr>
                    <th className="px-6 py-4">บริษัท</th>
                    <th className="px-6 py-4 text-center">สถานะ</th>
                    <th className="px-6 py-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {companies.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900">{c.name}</p>
                        <p className="text-xs text-slate-400">Code: {c.code}</p>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => {}} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><MoreVertical size={16}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ADMIN TABLE */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">ผู้ดูแลระบบ (Admins)</h3>
              <button onClick={() => setShowAdminForm(true)} className="text-blue-600 text-sm font-bold flex items-center gap-1">
                <Plus size={16} /> เพิ่ม
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500">
                  <tr>
                    <th className="px-6 py-4">ชื่อผู้ใช้</th>
                    <th className="px-6 py-4">สังกัดบริษัท</th>
                    <th className="px-6 py-4 text-right">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {admins.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium">
                        <p className="text-slate-900">{a.name}</p>
                        <p className="text-xs text-slate-400">@{a.username}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {companies.find(c => c.id === a.companyId)?.name}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <StatusBadge status={a.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {/* MODAL (ตัวอย่างการปรับ Modal ให้มนและดูนุ่มขึ้น) */}
      {showCompanyForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
             <h3 className="text-xl font-bold mb-6">สร้างบริษัทลูกค้าใหม่</h3>
             <form onSubmit={(e) => { e.preventDefault(); setShowCompanyForm(false); }} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">ชื่อบริษัท</label>
                  <input name="name" placeholder="Thai Smart Factory" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">รหัสย่อบริษัท (Code)</label>
                  <input name="code" placeholder="TSF" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all" />
                </div>
                <div className="flex gap-3 pt-4">
                   <button type="button" onClick={() => setShowCompanyForm(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-all">ยกเลิก</button>
                   <button type="submit" className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all">บันทึกข้อมูล</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================== UI COMPONENTS ================== */

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-${color}-50`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="text-2xl font-black text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
      isActive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-red-500"}`} />
      {isActive ? "ปกติ" : "ระงับ"}
    </span>
  );
}