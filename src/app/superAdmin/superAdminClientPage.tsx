"use client";

import Image from "next/image";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
// Import Actions
import { 
  saveCompanyAction, 
  deleteCompanyAction, 
  saveAdminAction,
  // logoutAction // สมมติว่ามีตัวนี้ใน actions.ts
} from "./actions";

import { 
  Building2, 
  Users, 
  ShieldCheck, 
  LogOut, 
  Plus, 
  Search, 
  Trash2, 
  X, 
  Edit3, 
  Mail,   
  Phone,   
} from "lucide-react";

/* ================== TYPES ================== */
type Company = { 
  id: string; name: string; code: string; status: "active" | "suspended"; 
  phone: string; address: string; email: string;
  siteCount: number; 
  adminCount: number; leaderCount: number; staffCount: number;
  createdAt: string; 
};

type CompanyAdmin = { 
  id: string; companyId: string; name: string; username: string; 
  password?: string; 
  email: string; avatar: string; status: "active" | "suspended"; 
  siteCount: number; leaderManaged: number; staffManaged: number;
  createdAt: string; 
};

export default function SuperAdminClientPage({ 
  initialCompanies, 
  initialAdmins 
}: { 
  initialCompanies: Company[], 
  initialAdmins: CompanyAdmin[] 
}) {
  const router = useRouter();

  /* ---------- DATA STATE (ดึงข้อมูลจาก Props ที่ SSR มา) ---------- */
  // เรายังคงใช้ state เพื่อความลื่นไหลของ UI แต่จะซิงค์กับ Server Action
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [admins, setAdmins] = useState<CompanyAdmin[]>(initialAdmins);

  /* ---------- UI STATE ---------- */
  const [searchComp, setSearchComp] = useState(""); 
  const [searchAdmin, setSearchAdmin] = useState(""); 
  const [showCompModal, setShowCompModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editingComp, setEditingComp] = useState<Company | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<CompanyAdmin | null>(null);
  const [isPending, setIsPending] = useState(false);

  /* ---------- FILTER LOGIC ---------- */
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => 
      c.name.toLowerCase().includes(searchComp.toLowerCase()) || 
      c.code.toLowerCase().includes(searchComp.toLowerCase())
    );
  }, [companies, searchComp]);

  const filteredAdmins = useMemo(() => {
    return admins.filter(a => 
      a.name.toLowerCase().includes(searchAdmin.toLowerCase()) || 
      a.username.toLowerCase().includes(searchAdmin.toLowerCase())
    );
  }, [admins, searchAdmin]);

  /* ---------- ACTIONS (เชื่อม DB) ---------- */
  
  const handleSaveCompany = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    const formData = new FormData(e.currentTarget);
    
    const data = {
      id: editingComp?.id, // ถ้ามี ID คือการแก้ไข
      name: formData.get("name") as string,
      code: formData.get("code") as string,
      phone: formData.get("phone") as string,
      email: formData.get("email") as string,
      address: formData.get("address") as string,
    };

    const result = await saveCompanyAction(data); 
    if (result.success) {
      // อัปเดต State ทันทีเพื่อให้ UI เปลี่ยนแปลงเร็วขึ้น (Optimistic Update) หรือพึ่ง revalidatePath
      // ในที่นี้ถ้าใช้ revalidatePath ใน action แล้ว ข้อมูลจะถูกส่งลงมาใหม่ผ่าน initialCompanies
      setShowCompModal(false);
      setEditingComp(null);
    } else {
      alert("เกิดข้อผิดพลาด: " + result.error);
    }
    setIsPending(false);
  };

  const handleSaveAdmin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    const formData = new FormData(e.currentTarget);

    const data = {
      id: editingAdmin?.id,
      companyId: formData.get("companyId") as string,
      name: formData.get("name") as string,
      username: formData.get("username") as string,
      email: formData.get("email") as string,
      password: (formData.get("password") as string) || undefined,
      isEdit: !!editingAdmin
    };

    const result = await saveAdminAction(data);
    if (result.success) {
      setShowAdminModal(false);
      setEditingAdmin(null);
    } else {
      alert("เกิดข้อผิดพลาดในการบันทึกแอดมิน");
    }
    setIsPending(false);
  };

  const deleteItem = async (id: string, type: 'comp' | 'admin') => {
    if (!confirm("ยืนยันการลบข้อมูลนี้?")) return;

    if (type === 'comp') {
      const result = await deleteCompanyAction(id);
      if (!result.success) alert("ไม่สามารถลบได้");
    } else {
       // logic ลบ admin
       alert("ฟังก์ชันลบแอดมินกำลังดำเนินการ");
    }
  };

  const handleLogout = async () => {
    if(!confirm("ยืนยันการออกจากระบบ?")) return;
    document.cookie = "session_user_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "user_role=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    // try { await logoutAction(); } catch (e) {}
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900 font-sans pb-10">
      {/* 🧭 NAV/HEADER */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-200">
              <ShieldCheck className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-800 uppercase">Provider Dashboard</h1>
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.3em]">Siam Royal Systems</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 px-4 py-2 rounded-xl transition-all font-bold text-sm">
            <LogOut size={18} /> ออกจากระบบ
          </button>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto p-8 space-y-10">
        <div className="space-y-2">
          <h2 className="text-4xl font-black tracking-tighter">Manage Tenants</h2>
          <p className="text-slate-500 font-medium">จัดการพาร์ทเนอร์และสิทธิ์ระดับ HR Admin ทั้งหมดในระบบ</p>
        </div>

        {/* 🏢 COMPANY TABLE SECTION */}
        <section className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-white overflow-hidden">
          <div className="p-8 border-b border-slate-50 bg-gray-200/30 flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="text-xl font-black flex items-center gap-3 shrink-0">
              <Building2 className="text-indigo-600"/> รายชื่อบริษัทพาร์ทเนอร์
              <span className="ml-2 text-xs font-bold bg-indigo-100 text-indigo-600 px-2 py-1 rounded-md">{companies.length}</span>
            </h3>
            <div className="flex w-full md:w-auto gap-3">
              <div className="relative flex-1 md:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="ค้นหาชื่อ หรือ รหัสบริษัท..." 
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                  value={searchComp}
                  onChange={(e) => setSearchComp(e.target.value)}
                />
              </div>
              <button onClick={() => { setEditingComp(null); setShowCompModal(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-black shadow-lg shadow-indigo-100 flex items-center gap-2 transition-all active:scale-95 shrink-0 text-sm">
                <Plus size={18} /> ลงทะเบียนบริษัท
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 shadow-sm text-[11px] uppercase font-black text-slate-400 tracking-widest">
                <tr>
                  <th className="px-8 py-5">ข้อมูลบริษัท</th>
                  <th className="px-8 py-5">การติดต่อ</th>
                  <th className="px-8 py-5 text-center">Infrastructure</th>
                  <th className="px-8 py-5 text-center">สถานะ</th>
                  <th className="px-8 py-5 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-bold">
                {filteredCompanies.map(c => (
                  <tr key={c.id} className="group hover:bg-indigo-50/30 transition-all">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-xl font-black text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">{c.code}</div>
                        <div>
                          <p className="text-lg text-slate-800 leading-tight">{c.name}</p>
                          <p className="text-xs text-indigo-500 font-mono">{c.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm text-slate-600 space-y-1">
                      <div className="flex items-center gap-2"><Mail size={14} className="text-slate-300"/> {c.email}</div>
                      <div className="flex items-center gap-2"><Phone size={14} className="text-slate-300"/> {c.phone}</div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex justify-center gap-2">
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px]">📍 {c.siteCount} SITES</span>
                        <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-lg text-[10px]">{c.staffCount} USERS</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center"><StatusBadge status={c.status} /></td>
                    <td className="px-8 py-6">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingComp(c); setShowCompModal(true); }} className="p-3 bg-white text-slate-400 hover:text-indigo-600 rounded-xl shadow-sm border border-slate-100 transition-all"><Edit3 size={18}/></button>
                        <button onClick={() => deleteItem(c.id, 'comp')} className="p-3 bg-white text-slate-400 hover:text-red-600 rounded-xl shadow-sm border border-slate-100 transition-all"><Trash2 size={18}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 🔑 ADMIN TABLE SECTION */}
        <section className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-white overflow-hidden">
          <div className="p-8 border-b border-slate-50 bg-gray-200/30 flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="text-xl font-black flex items-center gap-3 shrink-0">
              <Users className="text-purple-600"/> บัญชีผู้ดูแล (HR Admins)
              <span className="ml-2 text-xs font-bold bg-purple-100 text-purple-600 px-2 py-1 rounded-md">{admins.length}</span>
            </h3>
            <div className="flex w-full md:w-auto gap-3">
              <div className="relative flex-1 md:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="ค้นหาชื่อ หรือ Username..." 
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none font-bold"
                  value={searchAdmin}
                  onChange={(e) => setSearchAdmin(e.target.value)}
                />
              </div>
              <button onClick={() => { setEditingAdmin(null); setShowAdminModal(true); }} className="bg-purple-600 text-white px-6 py-3 rounded-xl text-sm font-black hover:bg-purple-700 shadow-lg shadow-purple-100 transition-all shrink-0">+ เพิ่มแอดมิน</button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 shadow-sm text-[11px] uppercase font-black text-slate-400 tracking-widest">
                <tr>
                  <th className="px-8 py-5">Admin Profile</th>
                  <th className="px-8 py-5">Affiliated Company</th>
                  <th className="px-8 py-5 text-center">Managed Assets</th>
                  <th className="px-8 py-5 text-center">Status</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-bold">
                {filteredAdmins.map(a => (
                  <tr key={a.id} className="group hover:bg-purple-50/30 transition-all">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <img src={a.avatar} className="w-12 h-12 rounded-2xl border-2 border-white shadow-md object-cover" alt="" />
                        <div>
                          <p className="text-slate-800">{a.name}</p>
                          <p className="text-xs text-purple-500 font-mono">@{a.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="text-slate-700 text-sm">{companies.find(c => c.id === a.companyId)?.name || 'Unknown'}</span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-tighter">Tenant ID: {a.companyId}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex justify-center gap-2 text-[10px]">
                        <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md">📍 {a.siteCount}</span>
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md">👥 {a.staffManaged}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center"><StatusBadge status={a.status} /></td>
                    <td className="px-8 py-6">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingAdmin(a); setShowAdminModal(true); }} className="p-3 bg-white text-slate-400 hover:text-purple-600 rounded-xl shadow-sm border border-slate-100 transition-all"><Edit3 size={18}/></button>
                        <button onClick={() => deleteItem(a.id, 'admin')} className="p-3 bg-white text-slate-400 hover:text-red-600 rounded-xl shadow-sm border border-slate-100 transition-all"><Trash2 size={18}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* 🏙️ COMPANY MODAL */}
      {showCompModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
              <h4 className="text-xl font-black flex items-center gap-2">
                {editingComp ? <Edit3 className="text-indigo-600"/> : <Plus className="text-indigo-600"/>}
                {editingComp ? "แก้ไขข้อมูลบริษัท" : "ลงทะเบียนบริษัทใหม่"}
              </h4>
              <button onClick={() => setShowCompModal(false)} className="p-2 hover:bg-white rounded-full transition-colors"><X size={20}/></button>
            </div>
            <form onSubmit={handleSaveCompany} className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">รหัสบริษัท (Code)</label>
                  <input name="code" defaultValue={editingComp?.code} placeholder="เช่น TSF" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">ชื่อบริษัท</label>
                  <input name="name" defaultValue={editingComp?.name} placeholder="บริษัท..." className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold" required />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">อีเมลติดต่อ</label>
                <input name="email" type="email" defaultValue={editingComp?.email} placeholder="hr@company.com" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold" required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">เบอร์โทรศัพท์</label>
                <input name="phone" defaultValue={editingComp?.phone} placeholder="02-xxx-xxxx" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold" required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">ที่อยู่สำนักงาน</label>
                <textarea name="address" defaultValue={editingComp?.address} rows={2} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm" />
              </div>
              <button disabled={isPending} type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all mt-4 disabled:bg-slate-300">
                {isPending ? "กำลังบันทึก..." : "บันทึกข้อมูลบริษัท"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 👤 ADMIN MODAL */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
              <h4 className="text-xl font-black flex items-center gap-2">
                {editingAdmin ? <Edit3 className="text-purple-600"/> : <Plus className="text-purple-600"/>}
                {editingAdmin ? "แก้ไขแอดมิน" : "สร้างบัญชีแอดมิน"}
              </h4>
              <button onClick={() => setShowAdminModal(false)} className="p-2 hover:bg-white rounded-full"><X size={20}/></button>
            </div>
            <form onSubmit={handleSaveAdmin} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">สังกัดบริษัท</label>
                <select name="companyId" defaultValue={editingAdmin?.companyId} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none font-bold appearance-none bg-white">
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">ชื่อ-นามสกุล</label>
                <input name="name" defaultValue={editingAdmin?.name} placeholder="ชื่อแอดมิน..." className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none font-bold" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Username</label>
                  <input name="username" defaultValue={editingAdmin?.username} placeholder="admin.name" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none font-bold font-mono" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Password</label>
                  <input name="password" type="password" placeholder={editingAdmin ? "เว้นไว้เพื่อไม่เปลี่ยน" : "••••••••"} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none font-bold" required={!editingAdmin} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">อีเมลแอดมิน</label>
                <input name="email" type="email" defaultValue={editingAdmin?.email} placeholder="admin@email.com" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none font-bold" required />
              </div>
              <button disabled={isPending} type="submit" className="w-full bg-purple-600 text-white py-4 rounded-xl font-black shadow-lg shadow-purple-100 hover:bg-purple-700 transition-all mt-4 disabled:bg-slate-300">
                {isPending ? "กำลังบันทึก..." : "ยืนยันข้อมูลแอดมิน"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";
  return (
    <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${
      isActive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
    }`}>
      <span className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
      {isActive ? "ACTIVE" : "SUSPENDED"}
    </span>
  );
}