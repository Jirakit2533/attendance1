"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  username: string; // ✅ เพิ่มเพื่อจัดการ User
  password: string; // ✅ เพิ่มเพื่อจัดการ Pass
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

/* ================== PAGE ================== */
export default function AdminPage() {
  const router = useRouter();

  const admin = {
    name: "นายอดิศักดิ์ ใจมั่น",
    role: "System Administrator",
    company: "Siam Royal System Co., Ltd.",
    avatar: "/profile.png",
  };

  /* ================== MASTER DATA STATES ================== */
  const [sites, setSites] = useState<string[]>(["สำนักงานใหญ่", "ไซต์งาน A (กรุงเทพ)", "ไซต์งาน B (นนทบุรี)"]);
  const [positions, setPositions] = useState<string[]>(["Manager", "IT Support", "Technician", "HR"]);

  /* ================== UI STATES ================== */
  const [showRegister, setShowRegister] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);
  
  // ✅ เพิ่มสถานะสำหรับระบบ Report
  const [showReport, setShowReport] = useState(false);
  const reportDate = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  const reportTime = new Date().toLocaleTimeString('th-TH');

  /* ================== DATA STATES ================== */
  const [employees, setEmployees] = useState<Employee[]>([
    {
      id: "EMP-001",
      firstName: "สมชาย",
      lastName: "ใจดี",
      name: "สมชาย ใจดี",
      department: "IT",
      position: "IT Support",
      site: "สำนักงานใหญ่",
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

  /* ================== HANDLERS ================== */
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
    const name = prompt("ระบุชื่อไซด์งาน หรือ บริษัทใหม่:");
    if (name?.trim()) setSites(prev => [...prev, name.trim()]);
  };

  const handleAddPosition = () => {
    const name = prompt("ระบุชื่อตำแหน่งงานใหม่:");
    if (name?.trim()) setPositions(prev => [...prev, name.trim()]);
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
    <div className="min-h-screen bg-gray-100 p-3 sm:p-6 space-y-6 font-sans print:p-0 print:bg-white">
      
      {/* 1. ADMIN HEADER */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 print:hidden">
        <Image src={admin.avatar} alt="admin" width={100} height={100} className="rounded-full border-4 border-blue-600 shadow-md" />
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">{admin.name}</h1>
          <p className="text-blue-600 font-medium">{admin.role}</p>
          <p className="text-gray-500 text-sm">{admin.company}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {/* ✅ เพิ่มปุ่มทำรายงาน */}
          <button onClick={() => setShowReport(true)} className="flex-1 sm:flex-none bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 font-bold transition-all shadow-lg shadow-indigo-100 italic tracking-wide">ทำรายงานสรุป</button>
          <button onClick={() => { setEditingEmployee(null); setPreviewImage(null); setShowRegister(true); }} className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors">+ ลงทะเบียนพนักงาน</button>
          <button onClick={handleAddSite} className="flex-1 sm:flex-none bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition-colors">+ เพิ่มไซต์งานหรือสาขา</button>
          <button onClick={handleAddPosition} className="flex-1 sm:flex-none bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 transition-colors">+ เพิ่มตำแหน่งพนักงาน</button>
          <button onClick={handleLogout} className="flex-1 sm:flex-none bg-gray-700 text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">ลงชื่อออก</button>
        </div>
      </div>

      {/* 2. DASHBOARD STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        <Stat title="พนักงานทั้งหมด" value={employees.length} />
        <Stat title="เช็คอินวันนี้" value={attendance.length} />
        <Stat title="คำขอลารออนุมัติ" value={leaves.filter(l => l.status === "pending").length} />
      </div>

      {/* 3. EMPLOYEE MANAGEMENT TABLE */}
      <div className="print:hidden">
        <Section title="จัดการข้อมูลพนักงาน">
          <div className="overflow-x-auto">
            <table className="min-w-[1000px] w-full text-sm">
              <thead className="bg-gray-200 text-gray-700 uppercase">
                <tr>
                  <th className="p-3 text-left">รูป</th>
                  <th className="p-3 text-left">ID / Username</th>
                  <th className="p-3 text-left">ชื่อ-นามสกุล</th>
                  <th className="p-3 text-left">แผนก / ตำแหน่ง</th>
                  <th className="p-3 text-left">ไซท์งาน</th>
                  <th className="p-3 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(e => (
                  <tr key={e.id} className="border-t hover:bg-gray-50">
                    <td className="p-3">
                      <Image src={e.avatar} alt="" width={40} height={40} className="rounded-full border" />
                    </td>
                    <td className="p-3">
                      <div className="font-mono text-[10px] text-gray-400">{e.id}</div>
                      <div className="font-bold text-blue-600">@{e.username}</div>
                    </td>
                    <td className="p-3 font-semibold">{e.name}</td>
                    <td className="p-3">
                      <div>{e.department}</div>
                      <div className="text-purple-600 text-xs font-bold">{e.position}</div>
                    </td>
                    <td className="p-3 text-xs font-bold text-gray-600 uppercase">
                      {e.site}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleEditEmployee(e)} className="bg-amber-100 text-amber-600 px-3 py-1 rounded-lg hover:bg-amber-200 font-bold transition-colors">แก้ไข</button>
                        <button onClick={() => handleDeleteEmployee(e.id)} className="bg-red-100 text-red-600 px-3 py-1 rounded-lg hover:bg-red-200 font-bold transition-colors">ลบ</button>
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
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-2">วันที่</th>
                  <th className="p-2 text-left">พนักงาน</th>
                  <th className="p-2">เข้า</th>
                  <th className="p-2">ออก</th>
                  <th className="p-2">พิกัด</th>
                  <th className="p-2">รูป</th>
                </tr>
              </thead>
              <tbody className="text-center">
                {attendance.map(a => (
                  <tr key={a.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 whitespace-nowrap">{a.date}</td>
                    <td className="p-2 text-left font-medium">{a.employee}</td>
                    <td className="p-2 text-green-600 font-bold">{a.checkIn}</td>
                    <td className="p-2 text-red-600 font-bold">{a.checkOut}</td>
                    <td className="p-2">
                      {isValidLatLng(a.location) ? (
                        <a href={buildGoogleMapLink(a.location)} target="_blank" className="text-blue-600 underline text-xs">
                          {a.location}
                        </a>
                      ) : ( a.location )}
                    </td>
                    <td className="p-2">
                      <Image
                        src={a.image} alt="checkin" width={48} height={48}
                        className="rounded-lg cursor-pointer mx-auto shadow-sm hover:scale-110 transition-transform"
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
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-2">พนักงาน</th>
                  <th className="p-2">ประเภท</th>
                  <th className="p-2">วันที่</th>
                  <th className="p-2 text-left">เหตุผล</th>
                  <th className="p-2">สถานะ</th>
                  <th className="p-2">จัดการ</th>
                </tr>
              </thead>
              <tbody className="text-center">
                {leaves.map(l => (
                  <tr key={l.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-medium">{l.employee}</td>
                    <td className="p-2">{l.type}</td>
                    <td className="p-2 text-xs">{l.date}</td>
                    <td className="p-2 text-left text-gray-600">{l.reason}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        l.status === 'pending' ? 'bg-orange-100 text-orange-600' :
                        l.status === 'approved' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="p-2 space-x-2">
                      <button onClick={() => updateLeaveStatus(l.id, "approved")} className="bg-green-500 text-white px-3 py-1 rounded-lg text-xs hover:bg-green-600 transition-colors">อนุมัติ</button>
                      <button onClick={() => updateLeaveStatus(l.id, "rejected")} className="bg-red-500 text-white px-3 py-1 rounded-lg text-xs hover:bg-red-600 transition-colors">ปฏิเสธ</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      {/* ✅ 8. REPORT PREVIEW MODAL (เพิ่มส่วนนี้) */}
      {showReport && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-[200] p-0 sm:p-4 overflow-y-auto backdrop-blur-sm">
          <div className="bg-white w-full max-w-5xl my-0 sm:my-8 rounded-none sm:rounded-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300 print:shadow-none print:my-0">
            {/* Modal Toolbar - Hidden when printing */}
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-3xl print:hidden sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                <h3 className="font-bold text-gray-700">Preview รายงานสรุปการทำงาน</h3>
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all">ปริ้น / บันทึก PDF</button>
                <button onClick={() => setShowReport(false)} className="bg-white border border-gray-300 text-gray-600 px-5 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all">ยกเลิก</button>
              </div>
            </div>

            {/* A4 Content Area */}
            <div className="flex-1 p-8 sm:p-12 bg-white print:p-0">
              {/* Report Header */}
              <div className="flex justify-between items-start border-b-4 border-gray-800 pb-8 mb-8">
                <div>
                  <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">{admin.company}</h2>
                  <p className="text-gray-500 font-bold mt-1">รายงานสรุปการลงเวลาเข้า-ออกงานพนักงานประจำเดือน</p>
                  <div className="mt-4 grid grid-cols-1 gap-1 text-sm">
                    <p><span className="font-bold text-gray-400 uppercase text-[10px] tracking-widest block">ผู้ออกรายงาน (ADMIN)</span> <span className="text-lg font-bold">{admin.name}</span></p>
                    <p><span className="font-bold text-gray-400 uppercase text-[10px] tracking-widest block">แผนกดูแล</span> <span className="font-medium">{admin.role}</span></p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="bg-gray-100 p-4 rounded-2xl inline-block border border-gray-200">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 text-center">พิมพ์เมื่อวันที่ / เวลา</p>
                    <p className="text-lg font-black text-gray-800">{reportDate}</p>
                    <p className="text-xs font-bold text-blue-600">{reportTime}</p>
                  </div>
                </div>
              </div>

              {/* Summary Stats in Report */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="border-2 border-gray-100 p-4 rounded-2xl">
                  <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">จำนวนพนักงาน</p>
                  <p className="text-2xl font-black text-gray-800">{employees.length} <span className="text-sm font-normal text-gray-400">คน</span></p>
                </div>
                <div className="border-2 border-gray-100 p-4 rounded-2xl">
                  <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">การลงชื่อทั้งหมด</p>
                  <p className="text-2xl font-black text-gray-800">{attendance.length} <span className="text-sm font-normal text-gray-400">ครั้ง</span></p>
                </div>
                <div className="border-2 border-gray-100 p-4 rounded-2xl">
                  <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">ลากิจ/ลาป่วย</p>
                  <p className="text-2xl font-black text-gray-800">{leaves.length} <span className="text-sm font-normal text-gray-400">รายการ</span></p>
                </div>
                <div className="border-2 border-gray-100 p-4 rounded-2xl bg-indigo-50 border-indigo-100">
                  <p className="text-[10px] text-indigo-400 font-bold uppercase mb-1 italic">สถานะระบบ</p>
                  <p className="text-lg font-black text-indigo-700">สมบูรณ์ 100%</p>
                </div>
              </div>

              {/* Data Table for Report */}
              <h4 className="font-black text-gray-800 mb-4 text-sm uppercase tracking-[0.2em] border-l-4 border-blue-600 pl-3">รายละเอียดการเข้างาน (ATTENDANCE LOG)</h4>
              <table className="w-full text-[12px] border-collapse mb-10">
                <thead>
                  <tr className="bg-gray-900 text-white">
                    <th className="p-3 border border-gray-800 text-left">วันที่</th>
                    <th className="p-3 border border-gray-800 text-left">รายชื่อพนักงาน</th>
                    <th className="p-3 border border-gray-800 text-center">เข้า</th>
                    <th className="p-3 border border-gray-800 text-center">ออก</th>
                    <th className="p-3 border border-gray-800 text-left">พิกัด GPS (LAT, LNG)</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((a, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="p-3 border border-gray-200 font-bold">{a.date}</td>
                      <td className="p-3 border border-gray-200 font-medium text-gray-700 italic">{a.employee}</td>
                      <td className="p-3 border border-gray-200 text-center font-bold text-green-600">{a.checkIn}</td>
                      <td className="p-3 border border-gray-200 text-center font-bold text-red-600">{a.checkOut}</td>
                      <td className="p-3 border border-gray-200 font-mono text-xs text-gray-500 tracking-tighter">{a.location}</td>
                    </tr>
                  ))}
                  {attendance.length === 0 && (<tr><td colSpan={5} className="p-10 text-center italic text-gray-300">ไม่พบข้อมูลการบันทึกเวลา</td></tr>)}
                </tbody>
              </table>

              {/* Signature Section */}
              <div className="mt-20 flex justify-between px-10 gap-20">
                <div className="text-center flex-1 border-t-2 border-gray-200 pt-4">
                  <div className="h-16 flex items-end justify-center mb-2">
                    {/* Placeholder for Signature Image */}
                  </div>
                  <p className="text-xs font-bold text-gray-800 font-mono italic">( ............................................................ )</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">ผู้ตรวจทานข้อมูล</p>
                </div>
                <div className="text-center flex-1 border-t-2 border-gray-200 pt-4">
                   <div className="h-16 flex items-end justify-center mb-2">
                    <p className="text-xl font-serif text-blue-900 font-black italic select-none opacity-40">{admin.name}</p>
                  </div>
                  <p className="text-xs font-bold text-gray-800 font-mono italic">( {admin.name} )</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">ผู้อนุมัติรายงาน (ADMIN)</p>
                </div>
              </div>
              
              {/* Report Footer */}
              <div className="mt-16 text-center text-[10px] text-gray-300 font-bold tracking-[0.5em] border-t pt-8">
                THIS IS A COMPUTER GENERATED DOCUMENT - NO SIGNATURE REQUIRED
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. REGISTER / EDIT MODAL */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 backdrop-blur-sm">
          <form onSubmit={handleSaveEmployee} className="bg-white p-6 rounded-2xl w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <h2 className="font-bold text-2xl text-gray-800 border-b pb-2">
              {editingEmployee ? `แก้ไขข้อมูล: ${editingEmployee.id}` : "ลงทะเบียนพนักงานใหม่"}
            </h2>

            <div className="flex items-center gap-6 bg-gray-50 p-4 rounded-xl border border-dashed border-gray-300">
              <div className="relative w-20 h-20">
                <Image src={previewImage || "/profile.png"} alt="preview" fill className="rounded-full object-cover border-2 border-white shadow-md" />
              </div>
              <label className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors text-sm font-semibold">
                อัปโหลดรูปโปรไฟล์
                <input type="file" accept="image/*" hidden onChange={handleImageChange} />
              </label>
            </div>

            {/* Auth Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
              <div className="space-y-1">
                <label className="text-xs font-bold text-blue-500 uppercase tracking-wider">Username</label>
                <input name="username" defaultValue={editingEmployee?.username} placeholder="Username สำหรับ Login" required className="w-full border border-blue-200 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-blue-500 uppercase tracking-wider">Password</label>
                <input name="password" defaultValue={editingEmployee?.password} placeholder="กำหนดรหัสผ่าน" required className="w-full border border-blue-200 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">ชื่อ</label>
                <input name="firstName" defaultValue={editingEmployee?.firstName} placeholder="ระบุชื่อภาษาไทย" required className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">นามสกุล</label>
                <input name="lastName" defaultValue={editingEmployee?.lastName} placeholder="ระบุนามสกุลภาษาไทย" required className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">แผนก</label>
                <input name="department" defaultValue={editingEmployee?.department} placeholder="เช่น IT, HR" required className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">ตำแหน่งงาน</label>
                <select name="position" defaultValue={editingEmployee?.position} required className="w-full border p-2.5 rounded-lg bg-white">
                  {positions.map((p, idx) => <option key={idx} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">ไซท์งาน</label>
                <select name="site" defaultValue={editingEmployee?.site} required className="w-full border p-2.5 rounded-lg bg-white">
                  {sites.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={() => { setShowRegister(false); setEditingEmployee(null); }} className="px-6 py-2 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors font-medium">
                ยกเลิก
              </button>
              <button type="submit" className="px-8 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-shadow shadow-lg shadow-blue-200 font-bold">
                {editingEmployee ? "บันทึกการแก้ไข" : "บันทึกพนักงาน"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 7. IMAGE VIEWER */}
      {viewImage && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[300] p-4" onClick={() => setViewImage(null)}>
          <div className="relative w-full max-w-3xl aspect-square sm:aspect-video">
            <Image src={viewImage} alt="large view" fill className="object-contain rounded-lg shadow-2xl" />
            <button className="absolute -top-10 right-0 text-white font-bold text-xl uppercase tracking-widest">ปิดหน้าต่าง [X]</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================== COMPONENTS ================== */
function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
      <p className="text-gray-400 text-xs font-bold uppercase tracking-widest group-hover:text-blue-500 transition-colors">{title}</p>
      <p className="text-3xl font-black text-gray-800 mt-1">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-gray-50/50 px-6 py-4 border-b">
        <h2 className="text-lg font-black text-gray-700 tracking-tight">{title}</h2>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}