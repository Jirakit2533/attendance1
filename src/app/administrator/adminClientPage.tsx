"use client";

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { saveSiteAction, 
         savePositionAction, 
         createDepartmentAction,
         updateLeaveStatusAction,
         saveStaffAction, 
         deleteStaffAction, 
         logoutAction     
        } from "./actions"; 


export const dynamic = "force-dynamic";

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

const LoadingOverlay = () => (
  <div className="fixed inset-0 z-[9999] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
    <div className="relative flex items-center justify-center">
      <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg animate-pulse"></div>
      </div>
    </div>
    <p className="mt-4 text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] animate-pulse">กำลังดำเนินการ...</p>
  </div>
);

export default function AdminClientPage({ 
  initialEmployees = [], 
  initialAttendance = [], 
  initialLeaves = [],
  admin = { name: "", company: "" },
  sites = [],
  positions = [],
  departments = [],
}) {
  // --- STATE MANAGEMENT ---
  const [employees, setEmployees] = useState(initialEmployees || []);
  const [attendance, setAttendance] = useState(initialAttendance || []);
  const [leaves, setLeaves] = useState(initialLeaves || []);

  // --- ADDITIONAL STATE FOR REPORT MODALS ---
  const [showFilterModal, setShowFilterModal] = useState(false); // ควบคุมการเปิด/ปิดหน้ากรองรายงาน
  const [showReport, setShowReport] = useState(false);           // ควบคุมการเปิด/ปิดหน้าแสดงตัวอย่างรายงาน
  const [selectedRole, setSelectedRole] = useState("employee");  // ใช้ในหน้า Register เพื่อเช็คสิทธิ์ Leader
  const [filterDepartment, setFilterDepartment] = useState(""); // สำหรับเก็บค่าแผนกที่เลือกใน Modal กรอง
  const [selectedEmpForReport, setSelectedEmpForReport] = useState(null); // สำหรับเลือกพนักงานเฉพาะเจาะจงในรายงาน

  // ตัวแปรสำหรับแสดงผลในใบรายงาน (สามารถคำนวณสดได้)
  const reportDate = new Date().toLocaleDateString('th-TH');
  const reportTime = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  
  const [allSites, setAllSites] = useState(sites || []);
  const [allPositions, setAllPositions] = useState(positions || []);
  const [allDepartments, setAllDepartments] = useState(departments || []);
  
  const [showAddSite, setShowAddSite] = useState(false);
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [showAddDepartment, setShowAddDepartment] = useState(false); 
  
  const [searchEmp, setSearchEmp] = useState("");
  const [searchAtt, setSearchAtt] = useState("");
  const [searchLeave, setSearchLeave] = useState("");
  
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [viewImage, setViewImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false); 

  // Filter State for Report
  const [filterSite, setFilterSite] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredEmployees = useMemo(() => {
    return (employees || []).map(emp => {
      // ค้นหาข้อมูลจาก Master Data เพื่อเอาชื่อมาแสดง (แทนที่จะแสดง ID)
      const deptObj = allDepartments.find(d => String(d.id) === String(emp.departmentId));
      const siteObj = allSites.find(s => String(s.id) === String(emp.siteId || emp.site_id));
      const posObj = allPositions.find(p => String(p.id) === String(emp.positionId));

      // แก้ปัญหา UserName เป็น UUID
      const isUuid = emp.userName && emp.userName.length > 30;
      const displayUserName = isUuid ? emp.firstName?.toLowerCase() : (emp.userName || "user");

      return {
        ...emp,
        userName: displayUserName,
        departmentName: deptObj ? deptObj.name : (emp.department || "ไม่ระบุ"),
        siteName: siteObj ? siteObj.name : (emp.site || "ไม่ระบุ"),
        positionName: posObj ? posObj.name : (emp.position || "ไม่ระบุ")
      };
    }).filter(e => 
      (e?.firstName?.toLowerCase() || "").includes(searchEmp?.toLowerCase() || "") || 
      (e?.lastName?.toLowerCase() || "").includes(searchEmp?.toLowerCase() || "") || 
      (e?.userName?.toLowerCase() || "").includes(searchEmp?.toLowerCase() || "")
    );
  }, [employees, searchEmp, allDepartments, allSites, allPositions]);

  // 2. Filter การเข้างาน (Attendance)
  const filteredAttendance = useMemo(() => {
    return (attendance || []).map(att => {
      // เชื่อมรูปภาพพนักงานจากตารางพนักงานหลัก
      const empInfo = employees.find(e => String(e.id) === String(att.userId || att.user_id));
      return {
        ...att,
        avatarUrl: att.avatarUrl || empInfo?.avatarUrl || null,
        // ถ้าไม่มีชื่อพนักงานใน Log ให้ใช้จากพนักงานที่ Join ได้
        employeeName: att.employeeName || (empInfo ? `${empInfo.firstName} ${empInfo.lastName}` : "Unknown")
      };
    }).filter(a => 
      (a?.employeeName?.toLowerCase() || "").includes(searchAtt?.toLowerCase() || "") || 
      (a?.date?.toString() || "").includes(searchAtt || "")
    );
  }, [attendance, employees, searchAtt]);

  // 3. Filter การลา + ดึงข้อมูลรูปและ Username จากพนักงาน
  const filteredLeaves = useMemo(() => {
    return (leaves || []).map(leave => {
      const empInfo = employees.find(e => String(e.id) === String(leave.userId || leave.user_id));
      return {
        ...leave,
        avatarUrl: leave.avatarUrl || empInfo?.avatarUrl || null,
        employeeName: leave.employeeName || (empInfo ? `${empInfo.firstName} ${empInfo.lastName}` : "พนักงานเก่า")
      };
    }).filter(l => 
      (l?.employeeName?.toLowerCase() || "").includes(searchLeave?.toLowerCase() || "") || 
      (l?.type?.toLowerCase() || "").includes(searchLeave?.toLowerCase() || "")
    );
  }, [leaves, employees, searchLeave]);

  // 4. Filter สำหรับช่องค้นหาใน Report
  const filteredEmpSuggestions = useMemo(() => {
    return (employees || []).filter(e => {
      const matchSite = filterSite === "" || e?.site === filterSite;
      const matchSearch = (e?.firstName?.toLowerCase() || "").includes(searchQuery?.toLowerCase() || "") || 
                          (e?.lastName?.toLowerCase() || "").includes(searchQuery?.toLowerCase() || "") || 
                          (e?.id?.toString() || "").includes(searchQuery || "");
      return matchSite && matchSearch;
    });
  }, [employees, filterSite, searchQuery]);

  // --- HANDLERS ---

  const handleAddDepartment = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = formData.get("name");
  
    if (!name) return;
    setIsProcessing(true);
    try {
      const result = await createDepartmentAction(name);
      if (result.success) {
        form.reset();
        setAllDepartments((prev) => [...prev, { id: crypto.randomUUID(), name: name }]); 
        setShowAddDepartment(false);
        alert(`✅ เพิ่มแผนก "${name}" เรียบร้อยแล้ว`);
      } else {
        alert(result.error || "ไม่สามารถบันทึกแผนกได้");
      }
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddSite = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = formData.get("siteName");

    if (!name) return;
    setIsProcessing(true);
    try {
      const result = await saveSiteAction({ name: name, address: "-", coordinates: "-" });
      if (result.success) {
        form.reset(); 
        setAllSites((prev) => [...prev, { id: crypto.randomUUID(), name: name }]); 
        setShowAddSite(false);
        alert(`✅ เพิ่มไซต์ "${name}" เรียบร้อยแล้ว`);
      } else {
        alert(result.error || "ไม่สามารถบันทึกไซต์งานได้");
      }
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddPosition = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = formData.get("posName");
  
    if (!name) return;
    setIsProcessing(true);
    try {
      const result = await savePositionAction({ name });
      if (result.success) {
        form.reset();
        setAllPositions((prev) => [...prev, { id: crypto.randomUUID(), name: name }]); 
        setShowAddPosition(false);
        alert(`✅ เพิ่มตำแหน่งงาน "${name}" เรียบร้อยแล้ว`);
      } else {
        alert(result.error || "ไม่สามารถบันทึกตำแหน่งได้");
      }
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditEmployee = (emp) => {
    setEditingEmployee(emp);
    setPreviewImage(emp.avatarUrl || null); 
    setShowRegister(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const updateLeaveStatus = async (id, status) => {
    // ปรับข้อความ Confirm ให้เป็นภาษาไทยที่อ่านง่าย
    const actionText = status === 'approved' ? 'อนุมัติ' : status === 'rejected' ? 'ปฏิเสธ' : 'ดึงกลับมาเป็นรอนุมัติ';
    if (!confirm(`ยืนยันการ "${actionText}" คำขอลานี้?`)) return;

    setIsProcessing(true);
    try {
      // ✅ เรียก Action (ไม่ต้องส่ง Admin ID เพราะใน Action ดึงจาก Cookie เองแล้ว)
      const result = await updateLeaveStatusAction(id, status);
      
      if (result.success) {
        // 1. อัปเดต State ในหน้าจอทันทีเพื่อให้ UI ลื่นไหล
        setLeaves(prev => prev.map(l => l.id === id ? { ...l, status } : l));
        
        // 2. (Optional) แจ้งเตือนความสำเร็จ
        // alert(result.message); 
      } else {
        alert("เกิดข้อผิดพลาด: " + result.error);
      }
    } catch (error) {
      console.error("Update Status Error:", error);
      alert("ระบบขัดข้อง ไม่สามารถอัปเดตสถานะได้");
    } finally {
      setIsProcessing(false);
    }
  };
  const handleDeleteEmployee = async (id) => {
    if (!confirm("⚠️ ยืนยันการลบข้อมูลพนักงาน? ข้อมูลจะถูกย้ายไปที่ถังขยะ")) return;
    setIsProcessing(true); 
    try {
      const result = await deleteStaffAction(id);
      if (result.success) {
        setEmployees(prev => prev.filter(e => e.id !== id));
        alert("✅ ลบพนักงานเรียบร้อยแล้ว");
      } else {
        alert("❌ เกิดข้อผิดพลาด: " + result.error);
      }
    } catch (error) {
      alert("❌ ไม่สามารถเชื่อมต่อฐานข้อมูลได้");
    } finally {
      setIsProcessing(false); 
    }
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    const submitButton = e.currentTarget.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    const avatarFile = formData.get("avatar");
  
    const compressImage = (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new window.Image();
          img.src = event.target.result;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 800; 
            let width = img.width, height = img.height;
            if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
            else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', 0.6)); 
            }
          };
        };
      });
    };
  
    try {
      let finalAvatarUrl = editingEmployee?.avatarUrl || ""; 
      if (avatarFile && avatarFile.size > 0) finalAvatarUrl = await compressImage(avatarFile);
  
      const siteInput = data.site_id;
      const payload = {
        id: editingEmployee?.id,
        firstName: data.firstName,
        lastName: data.lastName,
        userName: data.userName,
        password: data.password, 
        role: data.role, 
        avatarUrl: finalAvatarUrl,
        positionId: data.positionId,
        siteId: (siteInput === "all_sites" || siteInput === "") ? null : siteInput,
        departmentId: data.departmentId, 
      };
  
      const result = await saveStaffAction(payload); 
      if (result.success) {
        alert(editingEmployee ? "✏️ แก้ไขข้อมูลพนักงานเรียบร้อย" : "👤 ลงทะเบียนพนักงานใหม่เรียบร้อย");
        window.location.reload(); 
      } else {
        alert("❌ เกิดข้อผิดพลาด: " + result.error);
      }
    } catch (error) {
      alert("❌ ไม่สามารถบันทึกข้อมูลได้");
    } finally {
      setIsProcessing(false);
      if (submitButton) submitButton.disabled = false;
    }
  };
 
  const handleLogout = async () => {
    if(!confirm("ยืนยันการออกจากระบบแอดมิน?")) return;
    setIsProcessing(true);
    try {
      const cookiesToClear = ["session_user_id", "user_role", "role", "session"];
      cookiesToClear.forEach(name => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      });
      await logoutAction();
      window.location.replace("/login");
    } catch (error) {
      window.location.replace("/login");
    } finally {
      setIsProcessing(false);
    }
  };

  const calculateDiffDays = (start, end) => {
    // 1. เช็คว่ามีค่าส่งมาไหม
    if (!start || !end) return "-";
    
    const s = new Date(start);
    const e = new Date(end);
  
    // 2. เช็คว่าเป็นวันที่ที่ถูกต้องหรือไม่ (ป้องกัน Invalid Date)
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return "รูปแบบวันที่ผิด";
  
    s.setHours(0, 0, 0, 0);
    e.setHours(0, 0, 0, 0);
  
    const diffTime = e.getTime() - s.getTime();
    if (diffTime < 0) return "ช่วงเวลาไม่ถูกต้อง";
  
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return `${diffDays} วัน`;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      {/* --- HEADER --- */}
      {isProcessing && <LoadingOverlay />}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-[100] border-b border-slate-100 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 sm:h-24 flex items-center justify-between">
          <Logo />

          <div className="flex items-center gap-2 sm:gap-4">
            {/* 📍 กลุ่มปุ่มตั้งค่า (เพิ่มปุ่มแผนกเข้าไปที่นี่) */}
            <div className="flex items-center gap-1.5 sm:gap-2 pr-2 sm:pr-4 border-r border-slate-100">
              
              {/* --- ปุ่มเพิ่มแผนก (NEW!) --- */}
              <button 
                onClick={() => setShowAddDepartment(true)} 
                disabled={isProcessing}
                className="flex items-center justify-center gap-2 bg-slate-50 text-slate-600 w-10 h-10 lg:w-auto lg:px-4 lg:py-2.5 rounded-xl text-[11px] font-black uppercase tracking-tight hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-transparent hover:border-indigo-100"
                title="เพิ่มแผนก"
              >
                <span>🏢</span>
                <span className="hidden lg:inline">เพิ่มแผนก</span>
              </button>

              <button 
                onClick={() => setShowAddSite(true)} 
                disabled={isProcessing}
                className="flex items-center justify-center gap-2 bg-slate-50 text-slate-600 w-10 h-10 lg:w-auto lg:px-4 lg:py-2.5 rounded-xl text-[11px] font-black uppercase tracking-tight hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-100"
                title="เพิ่มไซต์งาน"
              >
                <span>📍</span>
                <span className="hidden lg:inline">เพิ่มไซต์งาน</span>
              </button>

              <button 
                onClick={() => setShowAddPosition(true)} 
                disabled={isProcessing}
                className="flex items-center justify-center gap-2 bg-slate-50 text-slate-600 w-10 h-10 lg:w-auto lg:px-4 lg:py-2.5 rounded-xl text-[11px] font-black uppercase tracking-tight hover:bg-amber-50 hover:text-amber-600 transition-all border border-transparent hover:border-amber-100"
                title="เพิ่มตำแหน่งงาน"
              >
                <span>💼</span>
                <span className="hidden lg:inline">เพิ่มตำแหน่งงาน</span>
              </button>
            </div>

            {/* 🚀 กลุ่มปุ่ม Action หลัก */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button 
                onClick={() => { setEditingEmployee(null); setPreviewImage(null); setShowRegister(true); }}
                disabled={isProcessing}
                className="bg-slate-900 text-white w-10 h-10 sm:w-auto sm:px-5 sm:py-3.5 rounded-xl sm:rounded-2xl font-black text-sm hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200 active:scale-95 flex items-center justify-center gap-2"
                title="ลงทะเบียนพนักงาน"
              >
                <span className="text-xl leading-none">+</span> 
                <span className="hidden md:inline text-xs sm:text-sm">ลงทะเบียน</span>
              </button>
              
              <button 
                onClick={() => setShowFilterModal(true)}
                disabled={isProcessing}
                className="bg-blue-600 text-white w-10 h-10 sm:w-auto sm:px-5 sm:py-3.5 rounded-xl sm:rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 active:scale-95 group flex items-center justify-center gap-2"
                title="ทำใบรายงาน"
              >
                <span className="text-lg group-hover:rotate-12 transition-transform">📊</span>
                <span className="hidden md:inline text-xs sm:text-sm">รายงาน</span>
              </button>
            </div>

            {/* 👤 ส่วนข้อมูลผู้ใช้งานและ Logout */}
            <div className="flex items-center gap-2 sm:gap-3 ml-1 pl-2 sm:pl-4 border-l border-slate-100">
              <div className="text-right hidden xl:block">
                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">
                  {admin.role === 'admin' ? 'Administrator' : 'Leader'}
                </p>
                <p className="font-black text-slate-900 text-sm leading-none truncate max-w-[100px]">
                  {admin.name}
                </p>
              </div>
              
              <button 
                onClick={handleLogout}
                disabled={isProcessing}
                className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-red-50 text-red-500 rounded-xl sm:rounded-2xl hover:bg-red-500 hover:text-white transition-all group border border-red-100"
                title="ออกจากระบบ"
              >
                <span className="text-lg sm:text-xl group-hover:scale-110 transition-transform">🚪</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 pt-12">
        {/* --- STATS CARDS --- */}
        <div className="justify-center grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 print:hidden">
          {[
            { label: "พนักงานทั้งหมด", val: employees.length, unit: "คน", icon: "👥", color: "blue" },
            { label: "ลงชื่อวันนี้", val: attendance.length, unit: "รายการ", icon: "📍", color: "emerald" },
            { label: "คำขอลางาน", val: leaves.filter(l => l.status === 'pending').length, unit: "รอนุมัติ", icon: "📝", color: "orange" },
            // ✅ เพิ่ม Card ที่ 4 เพื่อให้ Grid สมดุล (4 คอลัมน์)
            { label: "ไซต์งานทั้งหมด", val: allSites.length, unit: "แห่ง", icon: "🏢", color: "purple" },
          ].map((s, i) => (
            <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
              <div className="flex justify-between items-start mb-4">
                {/* ✅ ปรับ Tailwind Class สำหรับ Dynamic Color ให้ถูกต้อง */}
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform ${
                  s.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                  s.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                  s.color === 'orange' ? 'bg-orange-50 text-orange-600' :
                  'bg-purple-50 text-purple-600'
                }`}>
                  {s.icon}
                </div>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest pt-2">Live Data</span>
              </div>
              <div className="space-y-1">
                <p className="text-4xl font-black text-slate-900">{s.val}</p>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-tighter">
                  {s.label} <span className="text-xs opacity-50">({s.unit})</span>
                </p>
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
                      <th className="py-5 px-6 text-left bg-white border-b border-gray-100">แผนก</th>
                      <th className="py-5 px-6 text-left bg-white border-b border-gray-100">ไซต์งาน</th>
                      <th className="py-5 px-6 text-left bg-white border-b border-gray-100">ตำแหน่ง</th>
                      <th className="py-5 px-6 text-left bg-white border-b border-gray-100">ระดับสิทธิ์</th>
                      <th className="py-5 px-6 text-center bg-white border-b border-gray-100">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredEmployees.length > 0 ? (
                      filteredEmployees.map((e) => (
                        <tr key={e.id} className="group hover:bg-blue-50/40 transition-colors">
                          <td className="py-4 px-6">
                            <div className="w-12 h-12 relative rounded-2xl overflow-hidden border-2 border-white shadow-sm bg-slate-100">
                              <Image 
                                src={e.avatarUrl || "https://utfs.io/f/default-avatar-placeholder.png"} 
                                alt="profile" 
                                fill 
                                className="object-cover"
                              />
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="font-black text-gray-800">{e.firstName} {e.lastName}</div>
                            <div className="text-blue-500 font-mono text-[11px]">@{e.userName || e.id}</div>
                          </td>
                          <td className="py-4 px-6 font-bold text-gray-600">{e.departmentName || "ไม่ระบุแผนก"}</td>
                          <td className="py-4 px-6">
                            <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full font-bold text-[11px] uppercase tracking-wider">{e.siteName || e.site }</span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full font-bold text-[11px] uppercase tracking-wider">{e.position || "พนักงาน"}</span>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`font-black text-[10px] uppercase px-3 py-1 rounded-lg ${e.role === 'leader' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                              {e.role === 'leader' ? 'หัวหน้า' : 'พนักงาน'}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => handleEditEmployee(e)}
                                disabled={isProcessing}
                                className="w-10 h-10 flex items-center justify-center bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-all">
                                  ✏️
                              </button>
                              <button 
                                disabled={isProcessing}
                                className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"
                                onClick={() => handleDeleteEmployee(e.id)}>
                                {isProcessing ? "⏳" : "🗑️"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-24 text-center text-slate-400 italic font-black">ไม่พบข้อมูลพนักงาน...</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        </div>

      {/* --- 2. ATTENDANCE TABLE (ตารางเข้า-ออกงาน) --- */}
      <div className="print:hidden mt-12">
          <Section title="ตารางเข้า-ออกงาน">
            <div className="mb-6 relative max-w-md">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-gray-400">🔍</span>
              </div>
              <input 
                  type="text" 
                  placeholder="ค้นหาชื่อพนักงาน หรือ วันที่..." 
                  className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-100 bg-slate-50 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  value={searchAtt}
                  onChange={(e) => setSearchAtt(e.target.value)}
              />
            </div>
            <div className="rounded-[2rem] border border-slate-100 overflow-hidden bg-white shadow-sm">
              <div className="overflow-x-auto max-h-[580px] overflow-y-auto custom-scrollbar">
                <table className="min-w-[1300px] w-full text-sm border-separate border-spacing-0">
                  <thead className="sticky top-0 z-20 bg-white">
                    <tr className="text-gray-400 font-bold uppercase text-[11px] tracking-widest border-b border-gray-100">
                      <th className="py-5 px-6 text-left w-20 bg-white border-b border-gray-100">รูป</th>
                      <th className="py-5 px-6 text-left bg-white border-b border-gray-100">พนักงาน</th>
                      <th className="py-5 px-6 text-left bg-white border-b border-gray-100">วันที่</th>
                      <th className="py-5 px-6 text-center bg-white border-b border-gray-100">เวลาเข้า</th>
                      <th className="py-5 px-6 text-center bg-white border-b border-gray-100">เวลาออก</th>
                      <th className="py-5 px-6 text-center bg-white border-b border-gray-100">รูปเข้างาน</th>
                      <th className="py-5 px-6 text-center bg-white border-b border-gray-100">รูปออกงาน</th>
                      <th className="py-5 px-6 text-center bg-white border-b border-gray-100">พิกัดเข้างาน</th>
                      <th className="py-5 px-6 text-center bg-white border-b border-gray-100">พิกัดออกงาน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredAttendance.length > 0 ? (
                      filteredAttendance.map((a, index) => (
                        <tr key={index} className="group hover:bg-blue-50/40 transition-colors">
                          {/* 1. รูปโปรไฟล์พนักงาน */}
                          <td className="py-4 px-6">
                            <div className="w-12 h-12 relative rounded-2xl overflow-hidden border-2 border-white shadow-sm bg-slate-100">
                              <Image 
                                src={a.avatarUrl || "https://utfs.io/f/default-avatar-placeholder.png"} 
                                alt="profile" 
                                fill 
                                className="object-cover"
                              />
                            </div>
                          </td>
                          {/* 2. ชื่อ-นามสกุล และ Username */}
                          <td className="py-4 px-6">
                            <div className="font-black text-gray-800">{a.employeeName || "ไม่ระบุชื่อ"}</div>
                            <div className="text-blue-500 font-mono text-[11px]">@{a.userName || 'user'}</div>
                          </td>
                          <td className="py-4 px-6 font-bold text-gray-600">
                            {a.date ? new Date(a.date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) : "-"}
                          </td>
                          <td className="py-4 px-6 text-center font-black text-green-600 text-base">
                            {a.checkIn && !isNaN(new Date(a.checkIn).getTime()) ? (
                              new Date(a.checkIn).toLocaleTimeString('th-TH', { 
                                hour: '2-digit', 
                                minute: '2-digit', 
                                hour12: false 
                              })
                            ) : "-"}
                          </td>
                          <td className="py-4 px-6 text-center font-black text-red-600 text-base">
                            {a.checkIn && !isNaN(new Date(a.checkIn).getTime()) ? (
                              new Date(a.checkOut).toLocaleTimeString('th-TH', { 
                                hour: '2-digit', 
                                minute: '2-digit', 
                                hour12: false 
                              })
                            ) : "-"}
                          </td>
                          <td className="py-4 px-6 text-center">
                            <div className="flex justify-center">
                              {a.checkInPhoto || a.imageIn ? (
                                <div className="w-10 h-10 relative rounded-xl overflow-hidden border border-slate-100 cursor-zoom-in active:scale-90 transition-transform shadow-sm" onClick={() => setViewImage(a.checkInPhoto || a.imageIn)}>
                                  <Image src={a.checkInPhoto || a.imageIn} alt="In" fill className="object-cover" />
                                </div>
                              ) : <span className="text-slate-300 text-[10px] font-bold italic">N/A</span>}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <div className="flex justify-center">
                              {a.checkOutPhoto ? (
                                <div className="w-10 h-10 relative rounded-xl overflow-hidden border border-slate-100 cursor-zoom-in active:scale-90 transition-transform shadow-sm" onClick={() => setViewImage(a.checkOutPhoto)}>
                                  <Image src={a.checkOutPhoto} alt="Out" fill className="object-cover" />
                                </div>
                              ) : <span className="text-slate-300 text-[10px] font-bold italic">N/A</span>}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            {a.checkInLocation || a.locationIn ? (
                              <a 
                                href={`https://www.google.com/maps?q=${a.checkInLocation || a.locationIn}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-black hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-1 mx-auto w-fit shadow-sm"
                              >
                                📍 ดูแผนที่
                              </a>
                            ) : <span className="text-slate-300 text-[10px] font-bold italic">ไม่มีข้อมูล</span>}
                          </td>
                          <td className="py-4 px-6 text-center">
                            {a.checkOutLocation ? (
                              <a 
                                href={`https://www.google.com/maps?q=${a.checkOutLocation}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-black hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-1 mx-auto w-fit shadow-sm"
                              >
                                📍 ดูแผนที่
                              </a>
                            ) : <span className="text-slate-300 text-[10px] font-bold italic">ไม่มีข้อมูล</span>}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-24 text-center">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <span className="text-4xl opacity-20">📅</span>
                            <p className="text-slate-400 italic font-black tracking-wide">ไม่พบข้อมูลการลงเวลาในขณะนี้...</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        </div>

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
                <table className="min-w-[1200px] w-full text-sm border-separate border-spacing-0">
                  <thead className="sticky top-0 z-20 bg-white shadow-sm">
                    <tr className="text-gray-400 font-bold uppercase text-[11px] tracking-widest border-b border-gray-100">
                      <th className="py-5 px-6 text-left w-20 bg-white border-b border-gray-100">รูป</th>
                      <th className="py-4 px-4 text-left border-b border-gray-100 bg-white">พนักงาน</th>
                      <th className="py-4 px-4 text-center border-b border-gray-100 bg-white">ประเภท</th>
                      <th className="py-4 px-4 text-center border-b border-gray-100 bg-white">วันที่</th>
                      <th className="py-4 px-4 text-center border-b border-gray-100 bg-white">จำนวนวัน</th>
                      <th className="py-4 px-4 text-left border-b border-gray-100 bg-white">เหตุผล</th>
                      <th className="py-4 px-4 text-center border-b border-gray-100 bg-white">เอกสาร</th>
                      <th className="py-4 px-4 text-center border-b border-gray-100 bg-white">สถานะ</th>
                      <th className="py-4 px-4 text-center border-b border-gray-100 bg-white">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredLeaves.length > 0 ? (
                      filteredLeaves.map((l) => {
                        const start = new Date(l.startDate);
                        const end = new Date(l.endDate);
                        const diffTime = Math.abs(end.getTime() - start.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                        return (
                          <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-4 px-6">
                              <div className="w-12 h-12 relative rounded-2xl overflow-hidden border-2 border-white shadow-sm bg-slate-100">
                                <img 
                                  src={l.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(l.employeeName || 'User')}&background=random`} 
                                  alt="profile" 
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="font-black text-gray-800 text-base">{l.employeeName || "ไม่ระบุชื่อ"}</div>
                              <div className="text-blue-500 font-mono text-[11px] font-bold">@{l.userName || 'user'}</div>
                            </td>
                            <td className="py-4 px-4 text-center font-bold text-blue-600">{l.type}</td>
                            <td className="py-4 px-4 text-center text-gray-500 text-[10px] font-bold leading-tight">
                              {l.startDate} <br/> ถึง <br/> {l.endDate}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className="bg-orange-50 text-orange-600 px-3 py-1 rounded-lg font-black text-xs">
                                {isNaN(diffDays) ? "-" : `${diffDays} วัน`}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-gray-600 italic text-xs">"{l.reason || 'ไม่มีระบุเหตุผล'}"</td>
                            <td className="py-4 px-4 text-center">
                              <div className="flex justify-center">
                                {l.fileUrl ? ( // เปลี่ยนจาก attachmentUrl เป็น fileUrl ตาม Schema
                                  <div 
                                    className="w-10 h-10 relative rounded-lg overflow-hidden border border-slate-200 cursor-zoom-in hover:scale-110 transition-transform bg-slate-50 shadow-sm"
                                    onClick={() => setViewImage(l.fileUrl)}
                                  >
                                    <img src={l.fileUrl} alt="doc" className="w-full h-full object-cover" />
                                  </div>
                                ) : (
                                  <span className="text-slate-300 text-[10px]">ไม่มีแนบ</span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase ${
                                l.status === 'pending' ? 'bg-orange-100 text-orange-600' : 
                                l.status === 'approved' ? 'bg-green-100 text-green-600' : 
                                'bg-red-100 text-red-600'
                              }`}>
                                {l.status === 'pending' ? 'รออนุมัติ' : l.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex justify-center gap-2">
                                {l.status === 'pending' ? (
                                  <>
                                    <button onClick={() => updateLeaveStatus(l.id, "approved")} className="bg-green-600 text-white px-4 py-1.5 rounded-xl text-xs font-bold hover:scale-105 transition-transform shadow-md shadow-green-100">อนุมัติ</button>
                                    <button onClick={() => updateLeaveStatus(l.id, "rejected")} className="bg-white border border-red-200 text-red-500 px-4 py-1.5 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors">ปฏิเสธ</button>
                                  </>
                                ) : (
                                  <button onClick={() => updateLeaveStatus(l.id, "pending")} className="flex items-center gap-1 bg-amber-50 text-amber-600 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors">✏️ แก้ไข</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-20 text-center text-slate-400 italic font-bold">ไม่พบคำขอลา...</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        </div>
      </main>

      {/* --- 💼 MODAL: ADD DEPARTMENT --- */}
      {showAddDepartment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl">
            <h3 className="text-xl font-black text-slate-900 mb-6 uppercase italic">💼 เพิ่มแผนก</h3>
            <form onSubmit={handleAddDepartment} className="space-y-4">
              <input name="name" placeholder="ระบุชื่อแผนก..." required className="w-full border p-4 rounded-2xl bg-slate-50 font-bold outline-none focus:ring-2 focus:ring-amber-500" />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddDepartment(false)} className="flex-1 py-4 text-slate-400 font-bold uppercase text-[10px]">ยกเลิก</button>
                <button type="submit" className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-amber-100">บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 📍 MODAL: ADD SITE --- */}
      {showAddSite && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl">
            <h3 className="text-xl font-black text-slate-900 mb-6 uppercase italic">📍 เพิ่มไซต์งานใหม่</h3>
            <form onSubmit={handleAddSite} className="space-y-4">
              <input name="siteName" placeholder="ชื่อไซต์งาน..." required className="w-full border p-4 rounded-2xl bg-slate-50 font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
              <input name="address" placeholder="ที่อยู่ไซต์งาน..." className="w-full border p-4 rounded-2xl bg-slate-50 font-bold outline-none" />
              <input name="coordinates" placeholder="พิกัด (Lat, Lng)..." className="w-full border p-4 rounded-2xl bg-slate-50 font-bold outline-none" />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddSite(false)} className="flex-1 py-4 text-slate-400 font-bold uppercase text-[10px]">ยกเลิก</button>
                <button type="submit" disabled={isProcessing} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-emerald-100 disabled:bg-slate-300">
                  {isProcessing ? "กำลังบันทึก..." : "บันทึกไซต์"}
                </button>
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
              <input name="posName" placeholder="ระบุชื่อตำแหน่ง..." required className="w-full border p-4 rounded-2xl bg-slate-50 font-bold outline-none focus:ring-2 focus:ring-amber-500" />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddPosition(false)} className="flex-1 py-4 text-slate-400 font-bold uppercase text-[10px]">ยกเลิก</button>
                <button type="submit" disabled={isProcessing} className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-amber-100 disabled:bg-slate-300">
                  {isProcessing ? "กำลังบันทึก..." : "บันทึกตำแหน่ง"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 👤 MODAL: REGISTRATION & EDIT --- */}
      {showRegister && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-[500] p-4 backdrop-blur-md animate-in fade-in duration-300">
          <form onSubmit={handleSaveEmployee} className="bg-white p-8 rounded-[3.5rem] w-full max-w-2xl space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl custom-scrollbar">
            <h2 className="font-black text-2xl text-slate-900 uppercase italic border-b pb-4">
              {editingEmployee ? "✏️ แก้ไขข้อมูลพนักงาน" : "👤 ลงทะเบียนพนักงานใหม่"}
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-1 sm:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">รูปโปรไฟล์ (Profile Image)</label>
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200">
                  <div className="w-16 h-16 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 border-2 border-white shadow-sm relative">
                    <img 
                      src={previewImage || editingEmployee?.avatarUrl || "https://ui-avatars.com/api/?name=User"} 
                      className="w-full h-full object-cover"
                      alt="Preview"
                    />
                  </div>
                  <div className="flex-1">
                    <input 
                      type="file" 
                      name="avatar" 
                      accept="image/*"
                      onChange={handleImageChange}
                      className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-700 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Username {editingEmployee && "(แก้ไขไม่ได้)"}</label>
                <input 
                  name="userName" 
                  defaultValue={editingEmployee?.userName} 
                  placeholder="Username" 
                  required 
                  disabled={!!editingEmployee}
                  className={`w-full p-4 rounded-2xl font-bold border outline-none transition-all ${editingEmployee ? 'bg-slate-100 text-slate-400 border-transparent' : 'bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white'}`} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Password {editingEmployee && "(ล็อคไว้)"}</label>
                <input 
                  name="password" 
                  type="password" 
                  placeholder={editingEmployee ? "••••••••" : "รหัสผ่าน"} 
                  required={!editingEmployee} 
                  disabled={!!editingEmployee}
                  className={`w-full p-4 rounded-2xl font-bold border outline-none transition-all ${editingEmployee ? 'bg-slate-100 text-slate-400 border-transparent' : 'bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white'}`} 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">ชื่อจริง</label>
                <input name="firstName" defaultValue={editingEmployee?.firstName} required className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">นามสกุล</label>
                <input name="lastName" defaultValue={editingEmployee?.lastName} required className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">แผนก</label>
                <select name="departmentId" defaultValue={editingEmployee?.departmentId || ""} required className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none border border-transparent focus:border-blue-500 focus:bg-white transition-all appearance-none cursor-pointer">
                  <option value="" disabled hidden>เลือกแผนก...</option>
                  {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">ระดับสิทธิ์ (Role)</label>
                <select name="role" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none border border-transparent focus:border-blue-500 focus:bg-white transition-all appearance-none cursor-pointer">
                  <option value="employee">Employee</option>
                  <option value="leader">Leader</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">ตำแหน่ง</label>
                <select name="positionId" defaultValue={editingEmployee?.positionId} required className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer">
                  <option value="">เลือกตำแหน่ง...</option>
                  {positions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">ไซต์งาน</label>
                <select name="site_id" defaultValue={editingEmployee?.siteId} required className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer">
                  <option value="">เลือกไซต์งาน...</option>
                  {selectedRole === 'leader' && (
                    <option value="all_sites" className="text-blue-600 font-extrabold bg-blue-50">🌐 ทุกไซต์งาน (ALL SITES)</option>
                  )}
                  {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t mt-4">
              <button type="button" disabled={isProcessing} onClick={() => { setShowRegister(false); setEditingEmployee(null); setPreviewImage(null); setSelectedRole("employee"); }} className="px-6 py-4 font-bold text-slate-400 uppercase text-xs hover:text-slate-600 transition-colors disabled:opacity-50">ยกเลิก</button>
              <button type="submit" disabled={isProcessing} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 hover:bg-slate-800 transition-all disabled:bg-slate-300 flex items-center gap-2">
                {isProcessing ? "กำลังบันทึก..." : editingEmployee ? "💾 บันทึกการแก้ไข" : "➕ ลงทะเบียนพนักงาน"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- 📊 MODAL: FILTER REPORT --- */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[400] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative">
            <h3 className="text-xl font-black text-slate-900 text-center mb-6 uppercase italic">📊 กรองข้อมูลรายงาน</h3>
            <div className="space-y-4">
              <select onChange={(e) => setFilterDepartment(e.target.value)} className="w-full p-4 rounded-2xl bg-slate-50 font-bold outline-none border">
                <option value="">เลือกแผนก (ทั้งหมด)</option>
                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select onChange={(e) => setFilterSite(e.target.value)} className="w-full p-4 rounded-2xl bg-slate-50 font-bold outline-none border">
                <option value="">เลือกไซต์งาน (ทั้งหมด)</option>
                {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowFilterModal(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-bold text-slate-400 uppercase text-[10px]">ยกเลิก</button>
              <button onClick={() => { setShowFilterModal(false); setShowReport(true); }} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-blue-100">ดูรายงาน</button>
            </div>
          </div>
        </div>
      )}

      {/* --- 🖨️ MODAL: REPORT PREVIEW --- */}
      {showReport && (
        <div className="fixed inset-0 bg-slate-900/95 flex items-start justify-center z-[600] p-4 overflow-y-auto custom-scrollbar">
          <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl flex flex-col p-10 print:p-0 min-h-[80vh]">
            <div className="flex justify-between items-center mb-10 print:hidden">
              <div className="font-black text-xl">REPORT PREVIEW</div>
              <div className="flex gap-3">
                <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs shadow-lg shadow-blue-200">ปริ้นรายงาน (PDF)</button>
                <button onClick={() => setShowReport(false)} className="bg-slate-100 hover:bg-slate-200 px-6 py-3 rounded-2xl font-bold text-xs transition-colors">ปิดหน้าต่าง</button>
              </div>
            </div>

            <div className="border-b-4 border-slate-900 pb-6 mb-6 flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">{admin.company}</h2>
                <p className="text-blue-600 font-bold italic uppercase text-sm tracking-widest">Attendance Report: {reportDate}</p>
              </div>
              <div className="text-right text-[10px] font-bold text-slate-400 uppercase">พิมพ์เมื่อ: {reportDate} | {reportTime}</div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="p-4 text-left uppercase text-[10px]">Date</th>
                    <th className="p-4 text-left uppercase text-[10px]">Employee</th>
                    <th className="p-4 text-center uppercase text-[10px]">Check In</th>
                    <th className="p-4 text-center uppercase text-[10px]">Check Out</th>
                    <th className="p-4 text-right uppercase text-[10px]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendance.map((a: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-4 font-bold text-slate-500">{a.date}</td>
                      <td className="p-4">
                        <div className="font-black text-slate-900">{a.employeeName}</div>
                        <div className="text-[9px] text-slate-400 uppercase font-bold">{a.siteName}</div>
                      </td>
                      <td className="p-4 text-center text-emerald-600 font-black">{a.checkIn}</td>
                      <td className="p-4 text-center text-red-500 font-black">{a.checkOut || "--:--"}</td>
                      <td className="p-4 text-right">
                        <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase ${a.checkOut ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                          {a.checkOut ? 'Complete' : 'Working'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-auto pt-16 hidden print:grid grid-cols-2 gap-20">
              <div className="text-center border-t border-slate-300 pt-4">
                <p className="text-xs font-bold uppercase">ผู้อนุมัติรายงาน: {admin.name}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}