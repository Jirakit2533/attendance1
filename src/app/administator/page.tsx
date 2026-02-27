"use client";

import Image from "next/image";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

// นำเข้าข้อมูลจำลองจากไฟล์ภายนอก
import { 
  dummyEmployees, 
  dummyAttendance, 
  dummyLeaves 
} from "@/data/employeeData";

/* ==========================================================================
   TYPES & INTERFACES
   ========================================================================== */

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
  accessLevel?: string;
  leaderAccess?: string;
};

type Attendance = {
  id: number;
  employee: string;
  date: string;
  checkIn: string;
  checkOut: string;
  location: string;
  image: string;
  imageOut?: string; // รองรับรูปถ่ายตอนเลิกงาน
};

type LeaveRequest = {
  id: number;
  employee: string;
  type: string;
  date: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
};

/* ==========================================================================
   HELPER FUNCTIONS
   ========================================================================== */

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

/* ==========================================================================
   SUB-COMPONENTS
   ========================================================================== */

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
        <span className="text-white font-black text-xl italic">S</span>
      </div>
      <div className="leading-tight">
        <h2 className="text-lg font-black text-gray-800 tracking-tighter uppercase italic">
          Siam Royal
        </h2>
        <p className="text-[10px] font-bold text-blue-600 tracking-[0.2em] uppercase -mt-1">
          System Management
        </p>
      </div>
    </div>
  );
}

function Stat({ 
  title, 
  value, 
  iconColor = "bg-blue-500" 
}: { 
  title: string; 
  value: number | string; 
  iconColor?: string 
}) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 ${iconColor} opacity-[0.03] -mr-8 -mt-8 rounded-full group-hover:scale-150 transition-transform duration-500`}></div>
      <p className="text-gray-400 text-xs font-bold uppercase tracking-[0.15em] mb-2">
        {title}
      </p>
      <p className="text-4xl font-black text-gray-900 tracking-tight">
        {value}
      </p>
    </div>
  );
}

function Section({ 
  title, 
  children 
}: { 
  title: string; 
  children: React.ReactNode 
}) {
  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-gray-50/50 px-8 py-5 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-lg font-black text-gray-800 tracking-tight flex items-center gap-2">
          <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
          {title}
        </h2>
      </div>
      <div className="p-4 sm:p-8">
        {children}
      </div>
    </div>
  );
}

/* ==========================================================================
   MAIN ADMIN PAGE
   ========================================================================== */

export default function AdminPage() {
  const router = useRouter();
  
  // States สำหรับจัดการข้อมูล
  const [employees, setEmployees] = useState<Employee[]>(dummyEmployees);
  const [attendance] = useState<Attendance[]>(dummyAttendance);
  const [leaves, setLeaves] = useState<LeaveRequest[]>(dummyLeaves);

  // ข้อมูล Admin (จำลอง)
  const admin = {
    name: "นายอดิศักดิ์ ใจมั่น",
    role: "System Administrator",
    company: "Siam Royal System Co., Ltd.",
    avatar: "/profile.png",
  };

  // States สำหรับ UI Controls
  const [sites, setSites] = useState<string[]>([
    "สำนักงานใหญ่", 
    "ไซต์งาน A (กรุงเทพ)", 
    "ไซต์งาน B (นนทบุรี)"
  ]);
  const [positions, setPositions] = useState<string[]>([
    "Manager", 
    "IT Support", 
    "Technician", 
    "HR"
  ]);

  const [showRegister, setShowRegister] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  // ข้อมูลสำหรับรายงาน
  const reportDate = new Date().toLocaleDateString('th-TH', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const reportTime = new Date().toLocaleTimeString('th-TH');

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterSite, setFilterSite] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmpForReport, setSelectedEmpForReport] = useState<Employee | null>(null);

  // ค้นหาพนักงานสำหรับ Filter Report
  const filteredEmpSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return employees
      .filter(emp => {
        const matchText = (emp.name + emp.id + emp.firstName + emp.lastName).toLowerCase();
        const search = searchQuery.toLowerCase();
        const matchSite = filterSite ? emp.site === filterSite : true;
        return matchText.includes(search) && matchSite;
      })
      .slice(0, 5);
  }, [searchQuery, employees, filterSite]);

  // States สำหรับ Search ในแต่ละตาราง
  const [searchEmp, setSearchEmp] = useState("");
  const [searchAtt, setSearchAtt] = useState("");
  const [searchLeave, setSearchLeave] = useState("");

  // Logic การกรองข้อมูลในตาราง
  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchEmp.toLowerCase()) || 
    e.id.toLowerCase().includes(searchEmp.toLowerCase())
  );

  const filteredAttendance = attendance.filter(a => 
    a.employee.toLowerCase().includes(searchAtt.toLowerCase()) ||
    a.date.includes(searchAtt)
  );

  const filteredLeaves = leaves.filter(l => 
    l.employee.toLowerCase().includes(searchLeave.toLowerCase()) ||
    l.type.includes(searchLeave)
  );

  /* ================= HANDLERS ================= */

  const handleLogout = () => {
    router.push("/login");
  };

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
      leaderAccess: String(f.get("accessLevel")),
      username: String(f.get("username")),
      password: String(f.get("password")),
      avatar: previewImage || "/profile.png",
    };

    if (editingEmployee) {
      setEmployees(prev => 
        prev.map(emp => (emp.id === editingEmployee.id ? { ...emp, ...newEmpData } : emp))
      );
    } else {
      setEmployees(prev => [
        ...prev, 
        { id: `EMP-${String(prev.length + 1).padStart(3, "0")}`, ...newEmpData }
      ]);
    }
    
    setEditingEmployee(null);
    setPreviewImage(null);
    setShowRegister(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-3 sm:p-8 space-y-8 font-sans print:p-0 print:bg-white text-slate-900">
      
      {/* 1. ADMIN HEADER SECTION */}
      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 p-6 sm:p-8 flex flex-col lg:flex-row items-center gap-8 print:hidden relative overflow-hidden">
        
        {/* Decorative Background Logo */}
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Logo />
        </div>

        {/* Profile Avatar with Animation */}
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
          <Image 
            src={admin.avatar} 
            alt="admin" 
            width={110} 
            height={110} 
            className="relative rounded-full border-4 border-white shadow-2xl" 
          />
        </div>

        {/* Admin Info Details */}
        <div className="flex-1 text-center lg:text-left z-10">
          <div className="mb-4">
            <Logo />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {admin.name}
          </h1>
          <p className="text-blue-600 font-bold text-sm uppercase tracking-widest">
            {admin.role}
          </p>
          <p className="text-gray-400 text-xs mt-1 font-medium">
            {admin.company}
          </p>
        </div>

        {/* Action Buttons Header */}
        <div className="flex flex-wrap justify-center gap-3 w-full lg:w-auto z-10">
          <button 
            onClick={() => setShowFilterModal(true)} 
            className="px-6 py-3 rounded-2xl bg-slate-900 text-white hover:bg-black font-bold transition-all shadow-lg shadow-slate-200 flex items-center gap-2"
          >
            <span>ทำรายงานสรุป</span>
          </button>
          
          <button 
            onClick={() => { 
              setEditingEmployee(null); 
              setPreviewImage(null); 
              setShowRegister(true); 
            }} 
            className="px-6 py-3 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 font-bold transition-all shadow-lg shadow-blue-200"
          >
            + ลงทะเบียนพนักงาน
          </button>
          
          <button 
            onClick={handleLogout} 
            className="px-6 py-3 rounded-2xl bg-white border border-gray-200 text-red-500 hover:bg-red-50 font-bold transition-all"
          >
            ลงชื่อออก
          </button>
        </div>
      </div>

      {/* 2. QUICK MANAGEMENT BUTTONS */}
      <div className="flex flex-wrap gap-4 print:hidden">
        <button 
          onClick={handleAddSite} 
          className="bg-white border border-dashed border-gray-300 px-5 py-3 rounded-2xl text-gray-600 font-bold hover:border-blue-500 hover:text-blue-500 transition-all flex items-center gap-2 text-sm"
        >
          <span className="text-xl">+</span> เพิ่มไซต์งานหรือสาขา
        </button>
        
        <button 
          onClick={handleAddPosition} 
          className="bg-white border border-dashed border-gray-300 px-5 py-3 rounded-2xl text-gray-600 font-bold hover:border-purple-500 hover:text-purple-500 transition-all flex items-center gap-2 text-sm"
        >
          <span className="text-xl">+</span> เพิ่มตำแหน่งพนักงาน
        </button>
      </div>

      {/* 3. DASHBOARD STATISTICS CARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
        <Stat 
          title="พนักงานทั้งหมด" 
          value={employees.length} 
          iconColor="bg-blue-600" 
        />
        <Stat 
          title="เช็คอินวันนี้" 
          value={attendance.length} 
          iconColor="bg-green-600" 
        />
        <Stat 
          title="คำขอลารออนุมัติ" 
          value={leaves.filter(l => l.status === "pending").length} 
          iconColor="bg-orange-600" 
        />
      </div>

      {/* 4. EMPLOYEE MANAGEMENT TABLE */}
      <div className="print:hidden">
        <Section title="จัดการข้อมูลพนักงาน">
          
          {/* Employee Search Bar */}
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
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.map(e => (
                      <tr key={e.id} className="group hover:bg-blue-50/40 transition-colors">
                        <td className="py-4 px-6">
                          <Image 
                            src={e.avatar || "/profile.png"} 
                            alt="" 
                            width={48} 
                            height={48} 
                            className="rounded-2xl border-2 border-white shadow-sm group-hover:scale-110 transition-transform object-cover" 
                          />
                        </td>
                        <td className="py-4 px-6">
                          <div className="font-black text-gray-800">{e.name}</div>
                          <div className="text-blue-500 font-mono text-[11px]">@{e.username || e.id}</div>
                        </td>
                        <td className="py-4 px-6 font-bold text-gray-600">
                          {e.department}
                        </td>
                        <td className="py-4 px-6">
                          <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full font-bold text-[11px] uppercase tracking-wider">
                            {e.position}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-gray-500 flex items-center gap-1 font-bold">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            {e.site}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`font-bold text-xs ${e.leaderAccess === 'หัวหน้า' ? 'text-blue-600' : 'text-gray-400'}`}>
                            {e.leaderAccess}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="flex justify-center gap-2">
                            <button 
                              onClick={() => handleEditEmployee(e)} 
                              className="w-10 h-10 flex items-center justify-center bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-all shadow-sm"
                            >
                              ✏️
                            </button>
                            <button 
                              onClick={() => handleDeleteEmployee(e.id)} 
                              className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all shadow-sm"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-20 text-center text-slate-400 font-bold italic bg-slate-50/30">
                        🚫 ไม่พบพนักงานที่ค้นหา...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Section>
      </div>

      {/* 5. ATTENDANCE TABLE (NEW 2-COLUMN PHOTO VERSION) */}
      <div className="print:hidden">
        <Section title="รายละเอียดการลงชื่อทำงาน">
          
          {/* Attendance Search Bar */}
          <div className="mb-4 relative max-w-xs">
            <input 
              type="text" 
              placeholder="🔍 ค้นชื่อ หรือ วันที่ (YYYY-MM-DD)..." 
              className="w-full pl-4 pr-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-sm font-bold outline-none focus:ring-2 focus:ring-green-500 transition-all"
              value={searchAtt}
              onChange={(e) => setSearchAtt(e.target.value)}
            />
          </div>

          <div className="rounded-3xl border border-slate-100 overflow-hidden bg-white shadow-sm">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
              <table className="min-w-[1150px] w-full text-sm border-separate border-spacing-0">
                <thead className="sticky top-0 z-20 bg-gray-50/80 backdrop-blur-md">
                  <tr className="text-gray-400 font-bold uppercase text-[11px] tracking-widest">
                    <th className="p-4 text-left border-b border-gray-100">วันที่</th>
                    <th className="p-4 text-left border-b border-gray-100">พนักงาน</th>
                    <th className="p-4 text-center border-b border-gray-100">เวลาเข้า</th>
                    <th className="p-4 text-center border-b border-gray-100">เวลาออก</th>
                    <th className="p-4 text-left border-b border-gray-100">พิกัด GPS</th>
                    <th className="p-4 text-center border-b border-gray-100">รูปเข้างาน</th>
                    <th className="p-4 text-center border-b border-gray-100">รูปออกงาน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredAttendance.length > 0 ? (
                    filteredAttendance.map(a => (
                      <tr key={a.id} className="group hover:bg-green-50/20 transition-colors">
                        <td className="p-4 font-bold text-gray-600">
                          {a.date}
                        </td>
                        <td className="p-4 font-black text-gray-800">
                          {a.employee}
                        </td>
                        <td className="p-4 text-center">
                          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-lg font-black">
                            {a.checkIn}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="bg-red-50 text-red-600 px-3 py-1 rounded-lg font-black">
                            {a.checkOut}
                          </span>
                        </td>
                        <td className="p-4">
                          {isValidLatLng(a.location) ? (
                            <a 
                              href={buildGoogleMapLink(a.location)} 
                              target="_blank" 
                              className="text-blue-500 hover:underline font-mono text-xs flex items-center gap-1"
                            >
                              📍 {a.location}
                            </a>
                          ) : ( a.location )}
                        </td>

                        {/* COLUMN: รูปถ่ายเข้างาน */}
                        <td className="p-4 text-center">
                          <div className="relative inline-block">
                            <Image 
                              src={a.image} 
                              alt="in" 
                              width={45} 
                              height={45} 
                              className="rounded-xl cursor-pointer shadow-md hover:ring-4 ring-blue-100 transition-all object-cover aspect-square" 
                              onClick={() => setViewImage(a.image)} 
                            />
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full"></div>
                          </div>
                        </td>

                        {/* COLUMN: รูปถ่ายออกงาน */}
                        <td className="p-4 text-center">
                          <div className="relative inline-block">
                            <Image 
                              src={a.imageOut || a.image} 
                              alt="out" 
                              width={45} 
                              height={45} 
                              className="rounded-xl cursor-pointer shadow-md hover:ring-4 ring-red-100 transition-all object-cover aspect-square grayscale-[0.3] hover:grayscale-0" 
                              onClick={() => setViewImage(a.imageOut || a.image)} 
                            />
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full"></div>
                          </div>
                        </td>

                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-20 text-center text-slate-400 italic font-bold">
                        ไม่พบข้อมูลการลงชื่อ...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Section>
      </div>

      {/* 6. LEAVE REQUESTS TABLE */}
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
                        <td className="py-4 px-4 font-black text-gray-800">
                          {l.employee}
                        </td>
                        <td className="py-4 px-4 text-center font-bold text-blue-600">
                          {l.type}
                        </td>
                        <td className="py-4 px-4 text-center text-gray-500 text-xs">
                          {l.date}
                        </td>
                        <td className="py-4 px-4 text-gray-600 italic leading-relaxed">
                          "{l.reason}"
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm 
                            ${l.status === 'pending' ? 'bg-orange-100 text-orange-600' : 
                              l.status === 'approved' ? 'bg-green-100 text-green-600' : 
                              'bg-red-100 text-red-600'}`}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex justify-center gap-2">
                            <button 
                              onClick={() => updateLeaveStatus(l.id, "approved")} 
                              className="bg-green-600 text-white px-4 py-1.5 rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-green-100 transition-all active:scale-95"
                            >
                              อนุมัติ
                            </button>
                            <button 
                              onClick={() => updateLeaveStatus(l.id, "rejected")} 
                              className="bg-white border border-red-200 text-red-500 px-4 py-1.5 rounded-xl text-xs font-bold hover:bg-red-50 transition-all active:scale-95"
                            >
                              ปฏิเสธ
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-20 text-center text-slate-400 italic font-bold">
                        ไม่พบคำขอลาที่ค้นหา...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Section>
      </div>

      {/* ----------------------------------------------------------------------
          MODALS SECTION (Filter, Report, Register, ViewImage)
          ---------------------------------------------------------------------- */}

      {/* FILTER MODAL */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">📊</div>
              <h3 className="text-xl font-black text-slate-900 uppercase italic">กรองข้อมูลรายงาน</h3>
              <p className="text-xs text-slate-400 font-bold mt-1">กรุณาเลือกเงื่อนไขเพื่อสร้างรายงาน</p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">1. เลือกไซต์/สาขา</label>
                <select 
                  value={filterSite} 
                  onChange={(e) => { setFilterSite(e.target.value); setSelectedEmpForReport(null); }} 
                  className="w-full border border-slate-100 p-4 rounded-2xl bg-slate-50 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  <option value="">ทั้งหมด (All Sites)</option>
                  {sites.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="space-y-2 relative">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">2. ค้นหาพนักงาน (ชื่อ/รหัส)</label>
                <input 
                  type="text" 
                  placeholder="พิมพ์เพื่อค้นหา..." 
                  value={selectedEmpForReport ? selectedEmpForReport.name : searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSelectedEmpForReport(null); }}
                  className="w-full border border-slate-100 p-4 rounded-2xl bg-slate-50 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                
                {searchQuery && !selectedEmpForReport && (
                  <div className="absolute z-10 w-full bg-white mt-1 border border-slate-100 rounded-2xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                    {filteredEmpSuggestions.length > 0 ? (
                      filteredEmpSuggestions.map((emp) => (
                        <div 
                          key={emp.id} 
                          onClick={() => { setSelectedEmpForReport(emp); setSearchQuery(""); }} 
                          className="p-3 hover:bg-blue-50 cursor-pointer flex items-center gap-3 transition-colors border-b border-slate-50 last:border-none"
                        >
                          <div className="w-8 h-8 relative rounded-lg overflow-hidden flex-shrink-0">
                            <Image src={emp.avatar} alt="" fill className="object-cover" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-800">{emp.name}</p>
                            <p className="text-[9px] font-bold text-slate-400">{emp.id} • {emp.position}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-[10px] font-bold text-slate-400">ไม่พบข้อมูลพนักงาน</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => { setShowFilterModal(false); setFilterSite(""); setSearchQuery(""); setSelectedEmpForReport(null); }} 
                className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-400 font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all"
              >
                ยกเลิก
              </button>
              <button 
                disabled={!selectedEmpForReport}
                onClick={() => { setShowFilterModal(false); setShowReport(true); }}
                className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg 
                  ${selectedEmpForReport ? 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700' : 'bg-slate-50 text-slate-300 cursor-not-allowed shadow-none'}`}
              >
                ยืนยันทำรายงาน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REPORT PREVIEW MODAL */}
      {showReport && (
        <div className="fixed inset-0 bg-slate-900/90 flex items-start justify-center z-[200] p-0 sm:p-4 overflow-y-auto backdrop-blur-md">
          <div className="bg-white w-full max-w-5xl my-0 sm:my-8 rounded-none sm:rounded-[3rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-500 print:shadow-none print:my-0 print:rounded-none">
            
            {/* Report Tool Bar */}
            <div className="p-6 border-b flex justify-between items-center bg-gray-50/50 rounded-t-[3rem] print:hidden sticky top-0 z-10 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <Logo />
                <div className="w-[1px] h-8 bg-gray-200"></div>
                <h3 className="font-black text-gray-700 uppercase tracking-tighter">Report Preview</h3>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => window.print()} 
                  className="bg-blue-600 text-white px-8 py-3 rounded-2xl text-sm font-black shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all"
                >
                  ปริ้นรายงาน (PDF)
                </button>
                <button 
                  onClick={() => setShowReport(false)} 
                  className="bg-white border border-gray-200 text-gray-500 px-6 py-3 rounded-2xl text-sm font-bold hover:bg-gray-100 transition-all"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>

            {/* Print Content Area */}
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

              {/* Stats Grid in Report */}
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

              {/* Data Table for Print */}
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
                  <div className="h-24 border-b-2 border-slate-100 flex items-end justify-center pb-2 mb-4"></div>
                  <p className="text-xs font-black text-slate-800 italic uppercase tracking-widest">Reviewer Signature</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">HR & Operations Manager</p>
                </div>
                <div className="text-center">
                  <div className="h-24 border-b-2 border-slate-100 flex items-end justify-center pb-2 mb-4 relative">
                    <p className="text-xl font-serif text-blue-800 font-black italic select-none">{admin.name}</p>
                  </div>
                  <p className="text-xs font-black text-slate-800 italic uppercase tracking-widest">Authorized By (Admin)</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">System Administrator Official Stamp</p>
                </div>
              </div>

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

      {/* REGISTRATION & EDIT MODAL */}
      {showRegister && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50 p-4 backdrop-blur-md">
          <form 
            onSubmit={handleSaveEmployee} 
            className="bg-white p-8 rounded-[3rem] w-full max-w-2xl space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-300"
          >
            <div className="flex items-center gap-4 border-b pb-6">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                {editingEmployee ? "✏️" : "👤"}
              </div>
              <h2 className="font-black text-2xl text-slate-900 tracking-tighter uppercase italic">
                {editingEmployee ? `Edit Employee Profile` : "Employee Registration"}
              </h2>
            </div>

            {/* Profile Picture Upload Section */}
            <div className="flex flex-col sm:flex-row items-center gap-8 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                <div className="relative w-24 h-24">
                  <Image 
                    src={previewImage || "/profile.png"} 
                    alt="preview" 
                    fill 
                    className="rounded-full object-cover border-4 border-white shadow-xl" 
                  />
                </div>
              </div>
              <div className="space-y-2 text-center sm:text-left">
                <h4 className="font-black text-slate-800">รูปโปรไฟล์พนักงาน</h4>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">ขนาดรูปแนะนำ: 500x500 px</p>
                <label className="inline-block bg-white border border-slate-200 text-slate-600 px-6 py-2 rounded-xl cursor-pointer hover:bg-slate-50 transition-all text-sm font-black shadow-sm">
                  Choose Image
                  <input type="file" accept="image/*" hidden onChange={handleImageChange} />
                </label>
              </div>
            </div>

            {/* Account Credentials */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-50">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Username</label>
                <input name="username" defaultValue={editingEmployee?.username} placeholder="Username" required className="w-full bg-slate-50 border-none p-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Password</label>
                <input name="password" defaultValue={editingEmployee?.password} placeholder="••••••••" required className="w-full bg-slate-50 border-none p-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
              </div>
            </div>

            {/* Personal Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">ชื่อจริง (ภาษาไทย)</label>
                <input name="firstName" defaultValue={editingEmployee?.firstName} placeholder="ระบุชื่อจริง" required className="w-full border border-slate-100 p-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">นามสกุล (ภาษาไทย)</label>
                <input name="lastName" defaultValue={editingEmployee?.lastName} placeholder="ระบุนามสกุล" required className="w-full border border-slate-100 p-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
              </div>
            </div>

            {/* Work Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">แผนก/ฝ่าย</label>
                <input name="department" defaultValue={editingEmployee?.department} placeholder="เช่น IT, HR, Sales" required className="w-full border border-slate-100 p-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">ตำแหน่งงาน</label>
                <select name="position" defaultValue={editingEmployee?.position} required className="w-full border border-slate-100 p-4 rounded-2xl bg-white font-bold text-sm">
                  {positions.map((p, idx) => <option key={idx} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            {/* Location & Access */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">ไซต์งาน/สาขาที่ประจำการ</label>
                <select name="site" defaultValue={editingEmployee?.site} required className="w-full border border-slate-100 p-4 rounded-2xl bg-white font-bold text-sm">
                  {sites.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">ระดับสิทธิ์การใช้งาน</label>
                <select name="accessLevel" defaultValue={editingEmployee?.leaderAccess || "พนักงาน"} required className="w-full border border-slate-100 p-4 rounded-2xl bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer">
                  <option value="หัวหน้า">หัวหน้างาน (Leader Access)</option>
                  <option value="พนักงาน">พนักงานทั่วไป (Staff Access)</option>
                </select>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t">
              <button 
                type="button" 
                onClick={() => { setShowRegister(false); setEditingEmployee(null); }} 
                className="px-8 py-4 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors font-bold uppercase tracking-widest text-xs"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-10 py-4 rounded-2xl bg-slate-900 text-white hover:bg-black transition-all shadow-xl shadow-slate-200 font-black uppercase tracking-widest text-xs"
              >
                {editingEmployee ? "Update Employee Data" : "Confirm Registration"}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* LIGHTBOX VIEW IMAGE */}
      {viewImage && (
        <div 
          className="fixed inset-0 bg-slate-900/95 flex items-center justify-center z-[300] p-4 backdrop-blur-xl" 
          onClick={() => setViewImage(null)}
        >
          <div className="relative w-full max-w-4xl aspect-video animate-in zoom-in duration-300">
            <Image 
              src={viewImage} 
              alt="large view" 
              fill 
              className="object-contain rounded-[2rem]" 
            />
            <div className="absolute top-0 right-0 p-8">
              <button className="w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md flex items-center justify-center font-black transition-all">
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}