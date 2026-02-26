"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { access } from "fs";

/* ================== TYPES ================== */
type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  department: string;
  position: string;
  site: string;
  avatar: string;
  username: string;
  password: string;
};

type Attendance = {
  id: number;
  employee: string;
  date: string;
  checkIn: string;
  checkOut: string;
  location: string;
  image: string;
};

type LeaveRequest = {
  id: number;
  employee: string;
  type: string;
  date: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
};

/* ================= HELPERS ================= */
function isValidLatLng(text: string) {
  const parts = text.split(",").map(s => s.trim());
  if (parts.length !== 2) return false;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function buildGoogleMapLink(text: string) {
  const [lat, lng] = text.split(",").map(s => s.trim());
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/* ================== COMPONENTS ================== */
function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
        <span className="text-white font-black text-xl italic">S</span>
      </div>
      <div className="leading-tight">
        <h2 className="text-lg font-black text-gray-800 tracking-tighter uppercase italic">Siam Royal</h2>
        <p className="text-[10px] font-bold text-blue-600 tracking-[0.2em] uppercase -mt-1">System Management</p>
      </div>
    </div>
  );
}

function Stat({ title, value, iconColor = "bg-blue-500" }: { title: string; value: number | string; iconColor?: string }) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 ${iconColor} opacity-[0.03] -mr-8 -mt-8 rounded-full group-hover:scale-150 transition-transform duration-500`}></div>
      <p className="text-gray-400 text-xs font-bold uppercase tracking-[0.15em] mb-2">{title}</p>
      <p className="text-4xl font-black text-gray-900 tracking-tight">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-gray-50/50 px-8 py-5 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-lg font-black text-gray-800 tracking-tight flex items-center gap-2">
          <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
          {title}
        </h2>
      </div>
      <div className="p-4 sm:p-8">{children}</div>
    </div>
  );
}

/* ================== PAGE ================== */
export default function AdminPage() {
  const router = useRouter();

  const admin = {
    name: "นายอดิศักดิ์ ใจมั่น",
    role: "System Administrator",
    company: "Siam Royal System Co., Ltd.",
    avatar: "/profile.png",
  };

  const [sites, setSites] = useState<string[]>(["สำนักงานใหญ่", "ไซต์งาน A (กรุงเทพ)", "ไซต์งาน B (นนทบุรี)"]);
  const [positions, setPositions] = useState<string[]>(["Manager", "IT Support", "Technician", "HR"]);
  const [leaderAccess, setLeaderAccess] = useState<string[]>([""]);
  const [showRegister, setShowRegister] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  const reportDate = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  const reportTime = new Date().toLocaleTimeString('th-TH');

  const [employees, setEmployees] = useState<Employee[]>([
    {
      id: "EMP-001",
      firstName: "สมชาย",
      lastName: "ใจดี",
      name: "สมชาย ใจดี",
      department: "IT",
      position: "IT Support",
      site: "สำนักงานใหญ่",
      leaderAccess: "หัวหน้า",
      avatar: "/profile.png",
      username: "somchai.j",
      password: "password123",
    },
  ]);

  const [attendance] = useState<Attendance[]>([
    {
      id: 1,
      employee: "สมชาย ใจดี",
      date: "2026-02-11",
      checkIn: "08:59",
      checkOut: "18:05",
      location: "13.756300, 100.501800",
      image: "/sample-checkin.jpg",
    },
  ]);

  const [leaves, setLeaves] = useState<LeaveRequest[]>([
    {
      id: 1,
      employee: "สมชาย ใจดี",
      type: "ลาป่วย",
      date: "12–13 ก.พ. 2026",
      reason: "ไม่สบาย",
      status: "pending",
    },
  ]);

  const handleLogout = () => router.push("/login");

  const updateLeaveStatus = (id: number, status: LeaveRequest["status"]) => {
    setLeaves(prev => prev.map(l => (l.id === id ? { ...l, status } : l)));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreviewImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAddSite = () => {
    const name = prompt("ระบุชื่อไซด์งาน หรือ สาขา:");
    if (name?.trim()) setSites(prev => [...prev, name.trim()]);
  };

  const handleAddPosition = () => {
    const name = prompt("ระบุชื่อตำแหน่งงานใหม่:");
    if (name?.trim()) setPositions(prev => [...prev, name.trim()]);
  };

  const handleLeaderAccessByPosition = () => {
    const name = prompt("เลือกตำแหน่งที่จะเข้าสู่ระบบในฐานะหัวหน้า:");
    if (name?.trim()) setLeaderAccess(prev => [...prev, name.trim()]);
  };

  const handleDeleteEmployee = (id: string) => {
    if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบพนักงานรายนี้? ข้อมูลจะไม่สามารถกู้คืนได้")) {
      setEmployees(prev => prev.filter(emp => emp.id !== id));
    }
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setPreviewImage(emp.avatar);
    setShowRegister(true);
  };

  const handleSaveEmployee = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const firstName = String(f.get("firstName"));
    const lastName = String(f.get("lastName"));
    const newEmpData = {
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      department: String(f.get("department")),
      position: String(f.get("position")),
      site: String(f.get("site")),
      accessLevel: leaderAccess.includes(String(f.get("position"))) ? "หัวหน้า" : "พนักงาน",
      username: String(f.get("username")),
      password: String(f.get("password")),
      avatar: previewImage || "/profile.png",
    };

    if (editingEmployee) {
      setEmployees(prev => prev.map(emp => (emp.id === editingEmployee.id ? { ...emp, ...newEmpData } : emp)));
    } else {
      setEmployees(prev => [...prev, { id: `EMP-${String(prev.length + 1).padStart(3, "0")}`, ...newEmpData }]);
    }
    setEditingEmployee(null);
    setPreviewImage(null);
    setShowRegister(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-3 sm:p-8 space-y-8 font-sans print:p-0 print:bg-white text-slate-900">
      {/* 1. ADMIN HEADER */}
      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 p-6 sm:p-8 flex flex-col lg:flex-row items-center gap-8 print:hidden relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <Logo />
        </div>
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
          <Image src={admin.avatar} alt="admin" width={110} height={110} className="relative rounded-full border-4 border-white shadow-2xl" />
        </div>
        <div className="flex-1 text-center lg:text-left z-10">
          <div className="mb-4">
            <Logo />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">{admin.name}</h1>
          <p className="text-blue-600 font-bold text-sm uppercase tracking-widest">{admin.role}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 w-full lg:w-auto z-10">
          <button onClick={() => setShowReport(true)} className="px-6 py-3 rounded-2xl bg-slate-900 text-white hover:bg-black font-bold transition-all shadow-lg shadow-slate-200 flex items-center gap-2">
            <span>ทำรายงานสรุป</span>
          </button>
          <button onClick={() => { setEditingEmployee(null); setPreviewImage(null); setShowRegister(true); }} className="px-6 py-3 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 font-bold transition-all shadow-lg shadow-blue-200">
            + ลงทะเบียนพนักงาน
          </button>
          <button onClick={handleLogout} className="px-6 py-3 rounded-2xl bg-white border border-gray-200 text-red-500 hover:bg-red-50 font-bold transition-all">
            ลงชื่อออก
          </button>
        </div>
      </div>
      {/* Quick Actions Bar */}
      <div className="flex flex-wrap gap-4 print:hidden">
        <button onClick={handleAddSite} className="bg-white border border-dashed border-gray-300 px-5 py-3 rounded-2xl text-gray-600 font-bold hover:border-blue-500 hover:text-blue-500 transition-all flex items-center gap-2 text-sm">
          <span className="text-xl">+</span> เพิ่มไซต์งานหรือสาขา
        </button>
        <button onClick={handleAddPosition} className="bg-white border border-dashed border-gray-300 px-5 py-3 rounded-2xl text-gray-600 font-bold hover:border-purple-500 hover:text-purple-500 transition-all flex items-center gap-2 text-sm">
          <span className="text-xl">+</span> เพิ่มตำแหน่งพนักงาน
        </button>
      </div>
      {/* 2. DASHBOARD STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
        <Stat title="พนักงานทั้งหมด" value={employees.length} iconColor="bg-blue-600" />
        <Stat title="เช็คอินวันนี้" value={attendance.length} iconColor="bg-green-600" />
        <Stat title="คำขอลารออนุมัติ" value={leaves.filter(l => l.status === "pending").length} iconColor="bg-orange-600" />
      </div>
      {/* 3. EMPLOYEE MANAGEMENT TABLE */}
      <div className="print:hidden">
        <Section title="จัดการข้อมูลพนักงาน">
          <div className="overflow-x-auto">
            <table className="min-w-[1000px] w-full text-sm">
              <thead>
                <tr className="text-gray-400 font-bold uppercase text-[11px] tracking-widest border-b border-gray-100">
                  <th className="pb-4 px-3 text-left w-20">รูป</th>
                  <th className="pb-4 px-3 text-left">พนักงาน</th>
                  <th className="pb-4 px-3 text-left">สังกัด</th>
                  <th className="pb-4 px-3 text-left">ตำแหน่ง</th>
                  <th className="pb-4 px-3 text-left">สถานที่</th>
                  <th className="pb-4 px-3 text-left">สถานะหัวหน้า</th>
                  <th className="pb-4 px-3 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {employees.map(e => (
                  <tr key={e.id} className="group hover:bg-blue-50/30 transition-colors">
                    <td className="py-4 px-3">
                      <Image src={e.avatar} alt="" width={48} height={48} className="rounded-2xl border-2 border-white shadow-sm group-hover:scale-110 transition-transform" />
                    </td>
                    <td className="py-4 px-3">
                      <div className="font-black text-gray-800">{e.name}</div>
                      <div className="text-blue-500 font-mono text-[11px]">@{e.username}</div>
                    </td>
                    <td className="py-4 px-3 font-bold text-gray-600">{e.department}</td>
                    <td className="py-4 px-3">
                      <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full font-bold text-[11px] uppercase tracking-wider">{e.position}</span>
                    </td>
                    <td className="py-4 px-3">
                       <div className="text-gray-500 flex items-center gap-1">
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                          {e.site}
                       </div>
                    </td>
                    <td className="py-4 px-3">
                       <div className="text-gray-500 flex items-center gap-1">
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                          {e.leaderAccess} 
                       </div>
                    </td>
                    <td className="py-4 px-3">
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
        </Section>
      </div>
      {/* 4. ATTENDANCE TABLE */}
      <div className="print:hidden">
        <Section title="รายละเอียดการลงชื่อทำงาน">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-gray-50/50 rounded-xl">
                <tr className="text-gray-400 font-bold uppercase text-[11px] tracking-widest border-b border-gray-100">
                  <th className="p-4 text-left">วันที่</th>
                  <th className="p-4 text-left">พนักงาน</th>
                  <th className="p-4 text-center">เวลาเข้า</th>
                  <th className="p-4 text-center">เวลาออก</th>
                  <th className="p-4 text-left">พิกัด GPS</th>
                  <th className="p-4 text-center">รูปถ่าย</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map(a => (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-green-50/20 transition-colors">
                    <td className="p-4 font-bold text-gray-600">{a.date}</td>
                    <td className="p-4 font-black text-gray-800">{a.employee}</td>
                    <td className="p-4 text-center">
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-lg font-black">{a.checkIn}</span>
                    </td>
                    <td className="p-4 text-center">
                        <span className="bg-red-50 text-red-600 px-3 py-1 rounded-lg font-black">{a.checkOut}</span>
                    </td>
                    <td className="p-4">
                      {isValidLatLng(a.location) ? (
                        <a href={buildGoogleMapLink(a.location)} target="_blank" className="text-blue-500 hover:underline font-mono text-xs flex items-center gap-1">
                          📍 {a.location}
                        </a>
                      ) : ( a.location )}
                    </td>
                    <td className="p-4">
                      <Image
                        src={a.image} alt="checkin" width={50} height={50}
                        className="rounded-xl cursor-pointer mx-auto shadow-md hover:ring-4 ring-blue-100 transition-all"
                        onClick={() => setViewImage(a.image)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
      {/* 5. LEAVE REQUEST TABLE */}
      <div className="print:hidden">
        <Section title="คำขอลางาน">
          <div className="overflow-x-auto">
            <table className="min-w-[800px] w-full text-sm">
              <thead>
                <tr className="text-gray-400 font-bold uppercase text-[11px] tracking-widest border-b border-gray-100">
                  <th className="pb-4 px-4 text-left">พนักงาน</th>
                  <th className="pb-4 px-4 text-center">ประเภท</th>
                  <th className="pb-4 px-4 text-center">วันที่</th>
                  <th className="pb-4 px-4 text-left">เหตุผล</th>
                  <th className="pb-4 px-4 text-center">สถานะ</th>
                  <th className="pb-4 px-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leaves.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50/50">
                    <td className="py-4 px-4 font-black text-gray-800">{l.employee}</td>
                    <td className="py-4 px-4 text-center font-bold text-blue-600">{l.type}</td>
                    <td className="py-4 px-4 text-center text-gray-500 text-xs">{l.date}</td>
                    <td className="py-4 px-4 text-gray-600 italic">"{l.reason}"</td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                        l.status === 'pending' ? 'bg-orange-100 text-orange-600' :
                        l.status === 'approved' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => updateLeaveStatus(l.id, "approved")} className="bg-green-600 text-white px-4 py-1.5 rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-green-100 transition-all">อนุมัติ</button>
                        <button onClick={() => updateLeaveStatus(l.id, "rejected")} className="bg-white border border-red-200 text-red-500 px-4 py-1.5 rounded-xl text-xs font-bold hover:bg-red-50 transition-all">ปฏิเสธ</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
      {/* 8. REPORT PREVIEW MODAL */}
      {showReport && (
        <div className="fixed inset-0 bg-slate-900/90 flex items-start justify-center z-[200] p-0 sm:p-4 overflow-y-auto backdrop-blur-md">
          <div className="bg-white w-full max-w-5xl my-0 sm:my-8 rounded-none sm:rounded-[3rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-500 print:shadow-none print:my-0 print:rounded-none">
            {/* Modal Toolbar */}
            <div className="p-6 border-b flex justify-between items-center bg-gray-50/50 rounded-t-[3rem] print:hidden sticky top-0 z-10 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <Logo />
                <div className="w-[1px] h-8 bg-gray-200"></div>
                <h3 className="font-black text-gray-700 uppercase tracking-tighter">Report Preview</h3>
              </div>
              <div className="flex gap-3">
                <button onClick={() => window.print()} className="bg-blue-600 text-white px-8 py-3 rounded-2xl text-sm font-black shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all">ปริ้นรายงาน (PDF)</button>
                <button onClick={() => setShowReport(false)} className="bg-white border border-gray-200 text-gray-500 px-6 py-3 rounded-2xl text-sm font-bold hover:bg-gray-100 transition-all">ปิดหน้าต่าง</button>
              </div>
            </div>
            {/* A4 Content Area */}
            <div className="flex-1 p-10 sm:p-20 bg-white print:p-0">
              {/* Report Header */}
              <div className="flex justify-between items-start border-b-[6px] border-slate-900 pb-10 mb-10">
                <div className="space-y-4">
                  <Logo />
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">{admin.company}</h2>
                    <p className="text-blue-600 font-black mt-2 text-lg italic tracking-tight">Monthly Attendance Summary Report</p>
                  </div>
                  <div className="pt-4 grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-black uppercase text-slate-400">Issuer</span>
                        <span className="text-lg font-bold text-slate-800">{admin.name} ({admin.role})</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 inline-block min-w-[200px]">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-2 text-center">Timestamp</p>
                    <p className="text-2xl font-black text-slate-900 leading-none">{reportDate}</p>
                    <p className="text-sm font-bold text-blue-600 mt-1">{reportTime}</p>
                  </div>
                </div>
              </div>
              {/* Summary Stats in Report */}
              <div className="grid grid-cols-4 gap-6 mb-12">
                {[
                  { label: "Total Staff", val: employees.length, unit: "Person" },
                  { label: "Check-in Log", val: attendance.length, unit: "Times" },
                  { label: "Leave Requests", val: leaves.length, unit: "Items" },
                  { label: "System Health", val: "100%", unit: "Stable" }
                ].map((s, i) => (
                  <div key={i} className="bg-white border-2 border-slate-50 p-5 rounded-3xl">
                    <p className="text-[10px] text-slate-400 font-black uppercase mb-2 tracking-widest">{s.label}</p>
                    <p className="text-3xl font-black text-slate-900">{s.val} <span className="text-[10px] font-bold text-slate-300 uppercase">{s.unit}</span></p>
                  </div>
                ))}
              </div>
              {/* Data Table for Report */}
              <div className="mb-6 flex items-center gap-3">
                 <div className="h-8 w-2 bg-blue-600 rounded-full"></div>
                 <h4 className="font-black text-slate-900 text-lg uppercase tracking-tighter">Attendance Log Details</h4>
              </div>
              <table className="w-full text-[13px] border-collapse mb-16">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="p-4 text-left font-black uppercase tracking-widest text-[10px]">Date</th>
                    <th className="p-4 text-left font-black uppercase tracking-widest text-[10px]">Employee Name</th>
                    <th className="p-4 text-center font-black uppercase tracking-widest text-[10px]">Time In</th>
                    <th className="p-4 text-center font-black uppercase tracking-widest text-[10px]">Time Out</th>
                    <th className="p-4 text-left font-black uppercase tracking-widest text-[10px]">GPS Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendance.map((a, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-black text-slate-900">{a.date}</td>
                      <td className="p-4 font-bold text-slate-600 italic">{a.employee}</td>
                      <td className="p-4 text-center"><span className="text-green-600 font-black">{a.checkIn}</span></td>
                      <td className="p-4 text-center"><span className="text-red-500 font-black">{a.checkOut}</span></td>
                      <td className="p-4 font-mono text-[11px] text-slate-400">{a.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Signature Section */}
              <div className="mt-24 grid grid-cols-2 gap-20 px-10">
                <div className="text-center">
                  <div className="h-24 border-b-2 border-slate-100 flex items-end justify-center pb-2 mb-4">
                    {/* Placeholder for Signature */}
                  </div>
                  <p className="text-xs font-black text-slate-800 italic uppercase tracking-widest">Reviewer Signature</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">HR & Operations Manager</p>
                </div>
                <div className="text-center">
                  <div className="h-24 border-b-2 border-slate-100 flex items-end justify-center pb-2 mb-4 relative">
                    <p className="text-3xl font-serif text-blue-900/10 font-black italic absolute top-0 animate-pulse select-none uppercase tracking-tighter">{admin.name}</p>
                    <p className="text-xl font-serif text-blue-800 font-black italic select-none">{admin.name}</p>
                  </div>
                  <p className="text-xs font-black text-slate-800 italic uppercase tracking-widest">Authorized By (Admin)</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">System Administrator Official Stamp</p>
                </div>
              </div>
              {/* Report Footer */}
              <div className="mt-20 text-center">
                <div className="inline-block px-10 py-2 border-y border-slate-100">
                   <p className="text-[9px] text-slate-300 font-black tracking-[0.8em] uppercase">
                     This is a computer-generated document - Verification code: SR-{Math.random().toString(36).substr(2, 9).toUpperCase()}
                   </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 6. REGISTER / EDIT MODAL */}
      {showRegister && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50 p-4 backdrop-blur-md">
          <form onSubmit={handleSaveEmployee} className="bg-white p-8 rounded-[3rem] w-full max-w-2xl space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-4 border-b pb-6">
               <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                 {editingEmployee ? "✏️" : "👤"}
               </div>
               <h2 className="font-black text-2xl text-slate-900 tracking-tighter">
                {editingEmployee ? `Edit Employee: ${editingEmployee.id}` : "Registration"}
              </h2>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-8 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                <div className="relative w-24 h-24">
                   <Image src={previewImage || "/profile.png"} alt="preview" fill className="rounded-full object-cover border-4 border-white shadow-xl" />
                </div>
              </div>
              <div className="space-y-2 text-center sm:text-left">
                 <h4 className="font-black text-slate-800">รูปโปรไฟล์</h4>
                 <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">ขนาดรูปแนะนำ: 500x500 px</p>
                 <label className="inline-block bg-white border border-slate-200 text-slate-600 px-6 py-2 rounded-xl cursor-pointer hover:bg-slate-50 transition-all text-sm font-black shadow-sm">
                   Choose Image
                   <input type="file" accept="image/*" hidden onChange={handleImageChange} />
                 </label>
              </div>
            </div>
            {/* Auth Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Username</label>
                <input name="username" defaultValue={editingEmployee?.username} placeholder="Username" required className="w-full bg-slate-50 border-none p-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Password</label>
                <input name="password" defaultValue={editingEmployee?.password} placeholder="••••••••" required className="w-full bg-slate-50 border-none p-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">First Name (Thai)</label>
                <input name="firstName" defaultValue={editingEmployee?.firstName} placeholder="ชื่อพนักงาน" required className="w-full border border-slate-100 p-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Last Name (Thai)</label>
                <input name="lastName" defaultValue={editingEmployee?.lastName} placeholder="นามสกุล" required className="w-full border border-slate-100 p-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">แผนก</label>
                <input name="department" defaultValue={editingEmployee?.department} placeholder="IT, HR, Sales" required className="w-full border border-slate-100 p-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">ตำแหน่งงาน</label>
                <select name="position" defaultValue={editingEmployee?.position} required className="w-full border border-slate-100 p-4 rounded-2xl bg-white font-bold text-sm">
                  {positions.map((p, idx) => <option key={idx} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">ไซต์งาน/สาขา</label>
                <select name="site" defaultValue={editingEmployee?.site} required className="w-full border border-slate-100 p-4 rounded-2xl bg-white font-bold text-sm">
                  {sites.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
                  สถานะการเข้าถึง
                </label>
                <select 
                  name="accessLevel" 
                  defaultValue={editingEmployee?.accessLevel || "พนักงาน"} 
                  required 
                  className="w-full border border-slate-100 p-4 rounded-2xl bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="หัวหน้า">หัวหน้า (Leader)</option>
                  <option value="พนักงาน">พนักงาน (Employee)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-6 border-t">
              <button type="button" onClick={() => { setShowRegister(false); setEditingEmployee(null); }} className="px-8 py-4 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors font-bold uppercase tracking-widest text-xs">
                Cancel
              </button>
              <button type="submit" className="px-10 py-4 rounded-2xl bg-slate-900 text-white hover:bg-black transition-all shadow-xl shadow-slate-200 font-black uppercase tracking-widest text-xs">
                {editingEmployee ? "Update Data" : "Confirm Register"}
              </button>
            </div>
          </form>
        </div>
      )}
      {/* 7. IMAGE VIEWER */}
      {viewImage && (
        <div className="fixed inset-0 bg-slate-900/95 flex items-center justify-center z-[300] p-4 backdrop-blur-xl" onClick={() => setViewImage(null)}>
          <div className="relative w-full max-w-4xl aspect-video animate-in zoom-in duration-300">
            <Image src={viewImage} alt="large view" fill className="object-contain rounded-[2rem]" />
            <div className="absolute top-0 right-0 p-8">
               <button className="w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md flex items-center justify-center font-black transition-all">✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}