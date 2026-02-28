"use client";

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { saveSiteAction, savePositionAction, saveStaffAction, deleteStaffAction, updateLeaveStatusAction } from "./actions"; // ✅ ต้องมีบรรทัดนี้ 

// --- SUB-COMPONENTS ---
const Section = ({ title, children }) => (
  <section className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
    <div className="flex items-center gap-4 mb-8">
      <div className="h-10 w-2 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full shadow-lg shadow-blue-200"></div>
      <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">{title}</h2>
    </div>
    {children}
  </section>
);

const Logo = () => (
  <div className="flex items-center gap-2 group cursor-pointer">
    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl group-hover:rotate-6 transition-transform">N</div>
    <div className="leading-none">
      <span className="block font-black text-xl tracking-tighter text-slate-900">NEXTGEN</span>
      <span className="text-[10px] font-bold text-blue-600 tracking-[0.3em] uppercase">Systems</span>
    </div>
  </div>
);

export default function AdminClientPage({ 
  initialEmployees, 
  initialAttendance, 
  initialLeaves,
  admin,
  sites,
  positions
}) {
  // --- STATE MANAGEMENT ---
  const [employees, setEmployees] = useState(initialEmployees || []);
  const [attendance, setAttendance] = useState(initialAttendance || []);
  const [leaves, setLeaves] = useState(initialLeaves || []);
  
  // NEW STATES: For Dynamic Sites and Positions
  const [allSites, setAllSites] = useState(sites || []);
  const [allPositions, setAllPositions] = useState(positions || []);
  const [showAddSite, setShowAddSite] = useState(false);
  const [showAddPosition, setShowAddPosition] = useState(false);

  const [searchEmp, setSearchEmp] = useState("");
  const [searchAtt, setSearchAtt] = useState("");
  const [searchLeave, setSearchLeave] = useState("");
  
  const [showRegister, setShowRegister] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [viewImage, setViewImage] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // Filter State for Report
  const [filterSite, setFilterSite] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmpForReport, setSelectedEmpForReport] = useState(null);

  const reportDate = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  const reportTime = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  // --- LOGIC: FILTERING ---
  const filteredEmployees = employees.filter(e => 
    e.name?.toLowerCase().includes(searchEmp.toLowerCase()) || 
    e.id?.toString().includes(searchEmp)
  );

  const filteredAttendance = attendance.filter(a => 
    a.employee?.toLowerCase().includes(searchAtt.toLowerCase()) || 
    a.date?.includes(searchAtt)
  );

  const filteredLeaves = leaves.filter(l => 
    l.employee?.toLowerCase().includes(searchLeave.toLowerCase()) || 
    l.type?.toLowerCase().includes(searchLeave.toLowerCase())
  );

  const filteredEmpSuggestions = employees.filter(e => 
    (filterSite === "" || e.site === filterSite) &&
    (e.name?.toLowerCase().includes(searchQuery.toLowerCase()) || e.id?.toString().includes(searchQuery))
  );

  // --- HANDLERS ---
// --- HANDLERS ---
const handleAddSite = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const form = e.currentTarget; // ✅ เก็บ Reference ของฟอร์มไว้ก่อน
  const formData = new FormData(form);
  const name = formData.get("siteName") as string;

  if (!name) return;

  try {
    const result = await saveSiteAction({ 
      name: name, 
      address: "-", 
      coordinates: "-" 
    });

    if (result.success) {
      // ✅ 1. เคลียร์ค่าในฟอร์มก่อนปิด
      form.reset(); 
      
      // 2. อัปเดต State
      const newSiteObj = { id: crypto.randomUUID(), name: name };
      setAllSites((prev) => [...prev, newSiteObj]); 

      // 3. ปิด Modal สุดท้าย
      setShowAddSite(false);
    } else {
      alert(result.error || "บันทึกข้อมูลไม่สำเร็จ");
    }
  } catch (error) {
    console.error("Error adding site:", error);
    alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
  }
};

const handleAddPosition = async (e: React.FormEvent<HTMLFormElement>) => {
e.preventDefault();
const form = e.currentTarget; // ✅ เก็บ Reference ของฟอร์มไว้ก่อน
const formData = new FormData(form);
const name = formData.get("posName") as string;

if (!name) return;

try {
  const result = await savePositionAction({ name });

  if (result.success) {
    // ✅ 1. เคลียร์ค่าในฟอร์มก่อนปิด
    form.reset();

    // 2. อัปเดต State
    const newPosObj = { id: crypto.randomUUID(), name: name };
    setAllPositions((prev) => [...prev, newPosObj]); 

    // 3. ปิด Modal สุดท้าย
    setShowAddPosition(false);
  } else {
    alert(result.error || "ไม่สามารถบันทึกตำแหน่งได้");
  }
} catch (error) {
  console.error("Add Position Error:", error);
  alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
}
};
// 1. เตรียมข้อมูลเพื่อแก้ไข (ดึงรูปเก่ามาโชว์ด้วย)
const handleEditEmployee = (emp: any) => {
  setEditingEmployee(emp);
  setPreviewImage(emp.avatar || null); // ถ้ามี URL รูปใน DB ก็ดึงมาโชว์
  setShowRegister(true);
};

// 2. จัดการรูปภาพเป็น Base64 (วิธีที่คุณใช้อยู่)
const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  }
};

// 3. อัปเดตสถานะการลาลง Database
const updateLeaveStatus = async (id: string, status: string) => {
  if (!confirm(`ยืนยันการ ${status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'} คำขอลานี้?`)) return;
  
  try {
    const result = await updateLeaveStatusAction(id, status);
    if (result.success) {
      // อัปเดต State ในหน้าจอทันทีเพื่อความลื่นไหล
      setLeaves(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    } else {
      alert("เกิดข้อผิดพลาดในการอัปเดตสถานะ");
    }
  } catch (error) {
    console.error(error);
  }
};

// 4. ลบพนักงานออกจาก Database (Soft Delete)
const handleDeleteEmployee = async (id: string) => {
  if (confirm("⚠️ ยืนยันการลบข้อมูลพนักงาน? ข้อมูลจะถูกย้ายไปที่ถังขยะ")) {
    try {
      const result = await deleteStaffAction(id);
      if (result.success) {
        // ลบออกจากลิสต์ในหน้าจอ
        setEmployees(prev => prev.filter(e => e.id !== id));
        alert("ลบพนักงานเรียบร้อยแล้ว");
      } else {
        alert(result.error);
      }
    } catch (error) {
      console.error(error);
    }
  }
};

  const handleSaveEmployee = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      id: editingEmployee?.id,           // ถ้ามีค่า = แก้ไข, ถ้าไม่มี = เพิ่มใหม่
      isEdit: !!editingEmployee,
      username: formData.get("userName"),
      password: formData.get("password") || undefined, // ส่ง undefined ถ้าไม่เปลี่ยนรหัส
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      department: formData.get("department"),
      role: formData.get("role"),
      positionId: formData.get("positionId"), // รับค่าเป็น UUID จาก <select>
      siteId: formData.get("site_id"),        // รับค่าเป็น UUID จาก <select>
    };

    try {
      // 2. เรียกใช้ Server Action ที่คุณเขียนไว้ใน administratorActions.ts
      const result = await saveStaffAction(payload);

      if (result.success) {
        alert("🎉 บันทึกข้อมูลพนักงานสำเร็จ!");
        setShowRegister(false); // ปิด Modal
        setEditingEmployee(null); // เคลียร์สถานะการแก้ไข
        
        // 3. Refresh หน้าจอเพื่อให้ข้อมูลในตารางอัปเดต (Next.js Way)
        window.location.reload(); 
        // หรือถ้าใช้ router: router.refresh();
      } else {
        alert("❌ เกิดข้อผิดพลาด: " + result.error);
      }
    } catch (error) {
      console.error("Submit Error:", error);
      alert("❌ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    }
  };

  const handleLogout = async () => {
    if(!confirm("ยืนยันการออกจากระบบแอดมิน?")) return;
  
    try {
      // 1. ลบทุกชื่อที่เป็นไปได้ (ระบุ Path ให้ชัดเจน)
      const cookiesToClear = ["session_user_id", "user_role", "role", "session"];
      cookiesToClear.forEach(name => {
        // ลบแบบปกติ
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        // ลบเผื่อกรณีไม่มี Path
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
      });
  
      // 2. เรียก Server Action (สำคัญมากสำหรับ Admin)
      await logoutAction();
  
      // 3. ดีดกลับหน้า Login และล้าง Cache บราวเซอร์
      window.location.replace("/login"); 
    } catch (error) {
      window.location.replace("/login");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      {/* --- HEADER --- */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-[100] border-b border-slate-100 print:hidden">
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
          <Logo />

          <div className="flex items-center gap-4">
            {/* กลุ่มปุ่มตั้งค่า */}
            <div className="hidden lg:flex items-center gap-2 pr-4 border-r border-slate-100">
              <button 
                onClick={() => setShowAddSite(true)} 
                className="flex items-center gap-2 bg-slate-50 text-slate-600 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-tight hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-100"
              >
                <span>📍</span> เพิ่มไซต์งาน
              </button>
              <button 
                onClick={() => setShowAddPosition(true)} 
                className="flex items-center gap-2 bg-slate-50 text-slate-600 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-tight hover:bg-amber-50 hover:text-amber-600 transition-all border border-transparent hover:border-amber-100"
              >
                <span>💼</span> เพิ่มตำแหน่งงาน
              </button>
            </div>

            {/* กลุ่มปุ่ม Action หลัก */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => { setEditingEmployee(null); setPreviewImage(null); setShowRegister(true); }}
                className="bg-slate-900 text-white px-5 py-3.5 rounded-2xl font-black text-sm hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200 active:scale-95 flex items-center gap-2"
              >
                <span className="text-xl leading-none">+</span> 
                <span className="hidden sm:inline">ลงทะเบียนพนักงาน</span>
              </button>
              
              <button 
                onClick={() => setShowFilterModal(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3.5 rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 active:scale-95 group"
              >
                <span className="text-lg group-hover:rotate-12 transition-transform">📊</span>
                <span className="hidden md:inline">ทำใบรายงาน</span>
              </button>
            </div>

            {/* ส่วนข้อมูลผู้ใช้งานและ Logout */}
            <div className="flex items-center gap-3 ml-1 pl-4 border-l border-slate-100">
              <div className="text-right hidden md:block">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">ผู้ดูแลระบบ</p>
                <p className="font-black text-slate-900 leading-none">{admin.name}</p>
              </div>
              
              <button 
                onClick={handleLogout}
                className="w-12 h-12 flex items-center justify-center bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all group border border-red-100"
                title="ออกจากระบบ"
              >
                <span className="text-xl group-hover:scale-110 transition-transform">🚪</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-12">
        {/* --- STATS CARDS --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 print:hidden">
          {[
            { label: "พนักงานทั้งหมด", val: employees.length, unit: "คน", icon: "👥", color: "blue" },
            { label: "ลงชื่อวันนี้", val: attendance.length, unit: "รายการ", icon: "📍", color: "green" },
            { label: "คำขอลางาน", val: leaves.filter(l => l.status === 'pending').length, unit: "รอนุมัติ", icon: "📝", color: "orange" },
            // ✅ แก้จาก allSites.length เป็น sites.length (หรือตามชื่อ Props ที่รับมา)
            { label: "ไซต์งาน", val: sites.length, unit: "พื้นที่", icon: "🏢", color: "purple" }
          ].map((s, i) => (
            <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className={`w-14 h-14 bg-${s.color}-50 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform`}>{s.icon}</div>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest pt-2">Live Data</span>
              </div>
              <div className="space-y-1">
                <p className="text-4xl font-black text-slate-900">{s.val}</p>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-tighter">{s.label} <span className="text-xs opacity-50">({s.unit})</span></p>
              </div>
            </div>
          ))}
        </div>

        {/* --- 1. EMPLOYEES TABLE --- */}
        <div className="print:hidden">
          <Section title="จัดการข้อมูลพนักงาน">
            <div className="mb-6 relative max-w-md">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-gray-400">🔍</span>
              </div>
              <input 
                type="text" 
                placeholder="ค้นหาชื่อ หรือ รหัสพนักงาน..." 
                className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-100 bg-slate-50 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                value={searchEmp}
                onChange={(e) => setSearchEmp(e.target.value)}
              />
            </div>
            <div className="rounded-[2rem] border border-slate-100 overflow-hidden bg-white shadow-sm">
              <div className="overflow-x-auto max-h-[580px] overflow-y-auto custom-scrollbar">
                <table className="min-w-[1000px] w-full text-sm border-separate border-spacing-0">
                  <thead className="sticky top-0 z-20 bg-white">
                    <tr className="text-gray-400 font-bold uppercase text-[11px] tracking-widest border-b border-gray-100">
                      <th className="py-5 px-6 text-left w-20 bg-white border-b border-gray-100">รูป</th>
                      <th className="py-5 px-6 text-left bg-white border-b border-gray-100">พนักงาน</th>
                      <th className="py-5 px-6 text-left bg-white border-b border-gray-100">สังกัด</th>
                      <th className="py-5 px-6 text-left bg-white border-b border-gray-100">ตำแหน่ง</th>
                      <th className="py-5 px-6 text-left bg-white border-b border-gray-100">สถานที่</th>
                      <th className="py-5 px-6 text-left bg-white border-b border-gray-100">สถานะหัวหน้า</th>
                      <th className="py-5 px-6 text-center bg-white border-b border-gray-100">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredEmployees.map(e => (
                      <tr key={e.id} className="group hover:bg-blue-50/40 transition-colors">
                        <td className="py-4 px-6">
                          <div className="w-12 h-12 relative rounded-2xl overflow-hidden border-2 border-white shadow-sm group-hover:scale-110 transition-transform">
                            <Image src={e.avatar || "/profile.png"} alt="" fill className="object-cover" />
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="font-black text-gray-800">{e.name}</div>
                          <div className="text-blue-500 font-mono text-[11px]">@{e.username || e.id}</div>
                        </td>
                        <td className="py-4 px-6 font-bold text-gray-600">{e.department}</td>
                        <td className="py-4 px-6">
                          <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full font-bold text-[11px] uppercase tracking-wider">{e.position}</span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-gray-500 flex items-center gap-1 font-bold">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            {e.site}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`font-black text-[10px] uppercase px-3 py-1 rounded-lg ${e.leaderAccess === 'หัวหน้า' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{e.leaderAccess}</span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => handleEditEmployee(e)} className="w-10 h-10 flex items-center justify-center bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-all">✏️</button>
                            <button onClick={() => handleDeleteEmployee(e.id)} className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        </div>

        {/* --- 2. ATTENDANCE LOGS TABLE --- */}
        <div className="print:hidden mt-12">
          <Section title="ประวัติการเข้างาน (Attendance)">
            <div className="mb-6 relative max-w-md">
              <input 
                type="text" 
                placeholder="🔍 ค้นชื่อพนักงาน หรือ วันที่ (เช่น 2024-10)..." 
                className="w-full pl-4 pr-4 py-3 rounded-2xl border border-slate-100 bg-slate-50 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={searchAtt}
                onChange={(e) => setSearchAtt(e.target.value)}
              />
            </div>
            <div className="rounded-[2rem] border border-slate-100 overflow-hidden bg-white shadow-sm">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
                <table className="min-w-[900px] w-full text-sm border-separate border-spacing-0">
                  <thead className="sticky top-0 z-20 bg-white">
                    <tr className="text-gray-400 font-bold uppercase text-[11px] tracking-widest border-b border-gray-100">
                      <th className="py-5 px-6 text-left bg-white">พนักงาน</th>
                      <th className="py-5 px-6 text-center bg-white">วันที่</th>
                      <th className="py-5 px-6 text-center bg-white">เข้างาน</th>
                      <th className="py-5 px-6 text-center bg-white">ออกงาน</th>
                      <th className="py-5 px-6 text-left bg-white">สถานที่ (GPS)</th>
                      <th className="py-5 px-6 text-center bg-white">รูปถ่าย</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredAttendance.map((a, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-6 font-black text-gray-800">{a.employee}</td>
                        <td className="py-4 px-6 text-center font-bold text-gray-500">{a.date}</td>
                        <td className="py-4 px-6 text-center font-black text-green-600 bg-green-50/30">{a.checkIn}</td>
                        <td className="py-4 px-6 text-center font-black text-red-500 bg-red-50/30">{a.checkOut || "--:--"}</td>
                        <td className="py-4 px-6">
                          <a href={`https://www.google.com/maps?q=${a.location}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-mono text-[11px] flex items-center gap-1">
                            📍 {a.location}
                          </a>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <button onClick={() => setViewImage(a.image)} className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 hover:scale-110 transition-transform inline-block">
                            <Image src={a.image || "/profile.png"} alt="" width={40} height={40} className="object-cover" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        </div>
        {/* --- 3. LEAVE REQUESTS TABLE --- */}
        {/* --- 3. LEAVE REQUESTS TABLE --- */}
        <div className="print:hidden mt-8">
          <Section title="คำขอลางาน">
            <div className="mb-4 relative max-w-xs">
              <input 
                type="text" 
                placeholder="🔍 ค้นชื่อพนักงาน หรือ ประเภทลา..." 
                className="w-full pl-4 pr-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={searchLeave}
                onChange={(e) => setSearchLeave(e.target.value)}
              />
            </div>
            <div className="rounded-3xl border border-slate-100 overflow-hidden bg-white shadow-sm">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
                <table className="min-w-[800px] w-full text-sm border-separate border-spacing-0">
                  <thead className="sticky top-0 z-20 bg-white shadow-sm">
                    <tr className="text-gray-400 font-bold uppercase text-[11px] tracking-widest">
                      <th className="py-4 px-4 text-left border-b border-gray-100 bg-white">พนักงาน</th>
                      <th className="py-4 px-4 text-center border-b border-gray-100 bg-white">ประเภท</th>
                      <th className="py-4 px-4 text-center border-b border-gray-100 bg-white">วันที่</th>
                      <th className="py-4 px-4 text-left border-b border-gray-100 bg-white">เหตุผล</th>
                      <th className="py-4 px-4 text-center border-b border-gray-100 bg-white">สถานะ</th>
                      <th className="py-4 px-4 text-center border-b border-gray-100 bg-white">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredLeaves.length > 0 ? (
                      filteredLeaves.map(l => (
                        <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-4 px-4 font-black text-gray-800">{l.employee}</td>
                          <td className="py-4 px-4 text-center font-bold text-blue-600">{l.type}</td>
                          <td className="py-4 px-4 text-center text-gray-500 text-xs">{l.date}</td>
                          <td className="py-4 px-4 text-gray-600 italic">"{l.reason}"</td>
                          <td className="py-4 px-4 text-center">
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase ${l.status === 'pending' ? 'bg-orange-100 text-orange-600' : l.status === 'approved' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{l.status}</span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => updateLeaveStatus(l.id, "approved")} className="bg-green-600 text-white px-4 py-1.5 rounded-xl text-xs font-bold hover:scale-105 transition-transform">อนุมัติ</button>
                              <button onClick={() => updateLeaveStatus(l.id, "rejected")} className="bg-white border border-red-200 text-red-500 px-4 py-1.5 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors">ปฏิเสธ</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={6} className="py-20 text-center text-slate-400 italic font-bold">ไม่พบคำขอลา...</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        </div>
      </main>

      {/* --- 📍 MODAL: ADD SITE --- */}
      {showAddSite && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl">
            <h3 className="text-xl font-black text-slate-900 mb-6 uppercase italic">📍 เพิ่มไซต์งานใหม่</h3>
            <form onSubmit={handleAddSite} className="space-y-4">
              <input name="name" placeholder="ชื่อไซต์งาน..." required className="w-full border p-4 rounded-2xl bg-slate-50 font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
              <input name="address" placeholder="ที่อยู่ไซต์งาน (ระบุหรือไม่ก็ได้)" className="w-full border p-4 rounded-2xl bg-slate-50 font-bold outline-none" />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddSite(false)} className="flex-1 py-4 text-slate-400 font-bold uppercase text-[10px]">ยกเลิก</button>
                <button type="submit" className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-emerald-100">บันทึกไซต์</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 💼 MODAL: ADD POSITION --- */}
      {showAddPosition && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl">
            <h3 className="text-xl font-black text-slate-900 mb-6 uppercase italic">💼 เพิ่มตำแหน่งงาน</h3>
            <form onSubmit={handleAddPosition} className="space-y-4">
              <input name="name" placeholder="ระบุชื่อตำแหน่ง..." required className="w-full border p-4 rounded-2xl bg-slate-50 font-bold outline-none focus:ring-2 focus:ring-amber-500" />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddPosition(false)} className="flex-1 py-4 text-slate-400 font-bold uppercase text-[10px]">ยกเลิก</button>
                <button type="submit" className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-amber-100">บันทึกตำแหน่ง</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 👤 MODAL: REGISTRATION (Mapping ตรงตาม Schema) --- */}
      {showRegister && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-[500] p-4 backdrop-blur-md">
          <form onSubmit={handleSaveEmployee} className="bg-white p-8 rounded-[3.5rem] w-full max-w-2xl space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl">
            <h2 className="font-black text-2xl text-slate-900 uppercase italic border-b pb-4">
              {editingEmployee ? "✏️ แก้ไขข้อมูลพนักงาน" : "👤 ลงทะเบียนพนักงานใหม่"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Username</label>
                <input name="userName" defaultValue={editingEmployee?.username} placeholder="Username สำหรับ Login" required className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Password</label>
                <input name="password" type="password" placeholder={editingEmployee ? "••••••••" : "รหัสผ่าน"} required={!editingEmployee} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">ชื่อจริง</label>
                <input name="firstName" defaultValue={editingEmployee?.firstName} required className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">นามสกุล</label>
                <input name="lastName" defaultValue={editingEmployee?.lastName} required className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">แผนก (Department)</label>
                <input name="department" defaultValue={editingEmployee?.department} required className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">ระดับสิทธิ์ (Role)</label>
                <select name="role" defaultValue={editingEmployee?.role || "employee"} className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none border border-transparent focus:border-blue-500">
                  <option value="employee">Employee</option>
                  <option value="leader">Leader</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">ตำแหน่ง (Position)</label>
                <select name="positionId" defaultValue={editingEmployee?.positionId} className="w-full bg-white border border-slate-100 p-4 rounded-2xl font-bold outline-none">
                  <option value="">เลือกตำแหน่ง...</option>
                  {positions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">ไซต์งาน (Site)</label>
                <select name="site_id" defaultValue={editingEmployee?.siteId} className="w-full bg-white border border-slate-100 p-4 rounded-2xl font-bold outline-none">
                  <option value="">เลือกไซต์งาน...</option>
                  {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-6 border-t">
              <button type="button" onClick={() => setShowRegister(false)} className="px-6 py-4 font-bold text-slate-400 uppercase text-xs">ยกเลิก</button>
              <button type="submit" className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">บันทึกข้อมูล</button>
            </div>
          </form>
        </div>
      )}

      {/* --- 📊 MODAL: FILTER REPORT --- */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[400] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl">
            <h3 className="text-xl font-black text-slate-900 text-center mb-6 uppercase italic">📊 กรองข้อมูลรายงาน</h3>
            <div className="space-y-5">
              <select value={filterSite} onChange={(e) => setFilterSite(e.target.value)} className="w-full border p-4 rounded-2xl bg-slate-50 font-bold outline-none">
                <option value="">ทั้งหมด (All Sites)</option>
                {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="ค้นชื่อพนักงาน..." 
                  value={selectedEmpForReport ? `${selectedEmpForReport.firstName} ${selectedEmpForReport.lastName}` : searchQuery} 
                  onChange={(e) => { setSearchQuery(e.target.value); setSelectedEmpForReport(null); }} 
                  className="w-full border p-4 rounded-2xl bg-slate-50 font-bold outline-none" 
                />
                {searchQuery && !selectedEmpForReport && (
                  <div className="absolute z-10 w-full bg-white mt-2 border rounded-2xl shadow-xl max-h-40 overflow-auto">
                    {filteredEmpSuggestions.map((emp: any) => (
                      <div key={emp.id} onClick={() => { setSelectedEmpForReport(emp); setSearchQuery(""); }} className="p-4 hover:bg-blue-50 cursor-pointer border-b font-bold text-xs">
                        {emp.firstName} {emp.lastName} ({emp.username})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowFilterModal(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-bold text-slate-400">ยกเลิก</button>
              <button disabled={!selectedEmpForReport} onClick={() => { setShowFilterModal(false); setShowReport(true); }} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black disabled:opacity-30">ยืนยัน</button>
            </div>
          </div>
        </div>
      )}

      {/* --- 🖨️ MODAL: REPORT PREVIEW --- */}
      {showReport && (
        <div className="fixed inset-0 bg-slate-900/95 flex items-start justify-center z-[600] p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl flex flex-col p-10 print:p-0">
            <div className="flex justify-between items-center mb-10 print:hidden">
              <Logo />
              <div className="flex gap-3">
                <button onClick={() => window.print()} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs">ปริ้นรายงาน (PDF)</button>
                <button onClick={() => setShowReport(false)} className="bg-slate-100 px-6 py-3 rounded-2xl font-bold text-xs">ปิด</button>
              </div>
            </div>
            <div className="border-b-4 border-slate-900 pb-6 mb-6">
               <h2 className="text-3xl font-black uppercase tracking-tighter">{admin.company}</h2>
               <p className="text-blue-600 font-bold italic uppercase text-sm">Monthly Attendance Summary: {reportDate}</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="p-4 text-left uppercase text-[10px]">Date</th>
                  <th className="p-4 text-left uppercase text-[10px]">Employee</th>
                  <th className="p-4 text-center uppercase text-[10px]">Time In</th>
                  <th className="p-4 text-center uppercase text-[10px]">Time Out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendance.map((a, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-4 font-bold text-slate-400">{a.date}</td>
                    <td className="p-4 font-black">{a.employee}</td>
                    <td className="p-4 text-center text-green-600 font-black">{a.checkIn}</td>
                    <td className="p-4 text-center text-red-500 font-black">{a.checkOut || "--:--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- 🖼️ LIGHTBOX --- */}
      {viewImage && (
        <div className="fixed inset-0 bg-slate-900/95 flex items-center justify-center z-[700] p-4 backdrop-blur-xl" onClick={() => setViewImage(null)}>
          <div className="relative w-full max-w-4xl aspect-video animate-in zoom-in duration-300">
            <Image src={viewImage} alt="Large View" fill className="object-contain rounded-[2rem]" />
          </div>
        </div>
      )}

    </div>
  );
}