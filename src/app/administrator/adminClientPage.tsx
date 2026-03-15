"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import * as XLSX from 'xlsx';
import { saveSiteAction, 
         savePositionAction, 
         createDepartmentAction,
         updateLeaveStatusAction,
         handleRemarkChangeAction,
         saveStaffAction, 
         deleteStaffAction, 
         logoutAction,
         deleteSiteAction,      // ✅ เพิ่มอันนี้
         deletePositionAction,  // ✅ เพิ่มอันนี้ (สำหรับปุ่มลบตำแหน่ง)
         updateSiteAction,      // ✅ เพิ่มอันนี้ (สำหรับปุ่มแก้ไขไซต์)
         updatePositionAction,  
         updateAdminProfileAction,
         updateCompanyAction,
        } from "./actions"; 
import { usersTable } from '@/db/schema';
        
 
export const dynamic = "force-dynamic";

// --- SUB-COMPONENTS ---
const Section = ({ title, children }) => (
  <section className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
    <div className="flex items-center gap-4 mb-8">
      <div className="h-10 w-2 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full shadow-lg shadow-blue-200"></div>
      <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">{title}</h2>
    </div>
    {children}
  </section>
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

const NavIconButton = ({ icon, label, color, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 bg-white text-slate-600 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-tight hover:bg-${color}-50 hover:text-${color}-600 transition-all border border-transparent hover:border-${color}-100 shadow-sm`}
  >
    <span>{icon}</span>
    <span className="hidden lg:inline">{label}</span>
  </button>
);

export default function AdminClientPage({ 
  initialEmployees = [], 
  initialAttendance = [], 
  initialLeaves = [],
  admin = { name: "", company: "" },
  sites = [],
  positions = [],
  departments = [],
  initialCompanyData,
}) {
  // --- STATE MANAGEMENT ---
  const [employees, setEmployees] = useState(initialEmployees || []);
  const [attendance, setAttendance] = useState(initialAttendance || []);
  const [leaves, setLeaves] = useState(initialLeaves || []);
  const [leaveRemarks, setLeaveRemarks] = useState<Record<string, string>>({});
  const [viewRemarkId, setViewRemarkId] = useState<string | null>(null);

  // ตรวจสอบว่าใช้ useState ไม่ใช่ดึงจาก props ตรงๆ ในตาราง
  const [allSites, setAllSites] = useState(sites); 
  const [allPositions, setAllPositions] = useState(positions);
  const [allDepartments, setAllDepartments] = useState(departments);

  const [coords, setCoords] = useState("");
  const [isLocating, setIsLocating] = useState(false);

  // --- State สำหรับ Company Profile ---
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [companyLogoPreview, setCompanyLogoPreview] = useState<string | null>(null);

  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  
  const [showAddSite, setShowAddSite] = useState(false);
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [showAddDepartment, setShowAddDepartment] = useState(false); 
  
  const [searchEmp, setSearchEmp] = useState("");
  const [searchAtt, setSearchAtt] = useState("");
  const [searchLeave, setSearchLeave] = useState("");
  
  const [showAdminEdit, setShowAdminEdit] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showOldPass, setShowOldPass] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [viewImage, setViewImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false); 

  const [showManageModal, setShowManageModal] = useState(false);
  const [editingSite, setEditingSite] = useState<any>(null);
  const [editingPos, setEditingPos] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState("employee");  // ใช้ในหน้า Register เพื่อเช็คสิทธิ์ Leader

// --- 📊 1. [STATE] ข้อมูลพื้นฐานสำหรับ Report ---
const [showFilterModal, setShowFilterModal] = useState(false);    // เปิด/ปิดหน้าเลือกพนักงาน
const [showReport, setShowReport] = useState(false);            // เปิด/ปิดหน้าแสดงตัวอย่างรายงาน
const [reportData, setReportData] = useState<any[]>([]);        // ถังเก็บข้อมูลที่จะโชว์ในตารางรายงาน


// --- 📅 2. [STATE] เงื่อนไขการกรอง (Filters) ---
const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
const [filterSite, setFilterSite] = useState("");              // กรองตามไซส์งาน
const [filterDepartment, setFilterDepartment] = useState("");  // กรองตามแผนก
const [searchTerm, setSearchTerm] = useState('');              // ช่องค้นหาชื่อพนักงานใน Modal
const [selectedEmployees, setSelectedEmployees] = useState<any[]>([]); // รายชื่อพนักงานที่ถูกติ๊กเลือก
const [exportFormat, setExportFormat] = useState('excel');      // รูปแบบไฟล์ที่จะโหลด ('excel' | 'pdf')

const [newPassword, setNewPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");

const [isSidebarOpen, setIsSidebarOpen] = useState(false); // เริ่มต้นเป็น false (ปิดอยู่)

// ตรวจสอบว่ารหัสผ่านตรงกันหรือไม่ (เฉพาะเมื่อมีการพิมพ์ทั้งสองช่อง)
const isMismatch = newPassword !== "" && confirmPassword !== "" && newPassword !== confirmPassword;

// --- 📝 3. [VARIABLES] ตัวแปรสำหรับแสดงผลบนหัวเอกสาร (ไม่ต้องใช้ State) ---
const formattedStartDate = startDate ? new Date(startDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
const formattedEndDate = endDate ? new Date(endDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
const reportDate = new Date().toLocaleDateString('th-TH');      // วันที่พิมพ์
const reportTime = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); // เวลาที่พิมพ์


const [lat, setLat] = useState("");
const [lng, setLng] = useState("");

const companyData = initialCompanyData;

  // --- 3. Component Logo ---
 // --- ส่วนฟังก์ชันจัดการการบันทึกข้อมูลบริษัท ---
 
  // --- ส่วน Component Logo ---
  const Logo = () => (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 md:gap-3 group cursor-pointer">
        {/* ปรับขนาดโลโก้ให้เล็กลงในมือถือ (w-10) และขนาดปกติในจอใหญ่ (md:w-16) */}
        <div className="w-10 h-10 md:w-16 md:h-16 bg-slate-50 rounded-xl md:rounded-2xl flex items-center justify-center overflow-hidden shadow-lg group-hover:rotate-6 transition-transform border border-slate-100">
          <img 
            src={companyData?.logoUrl || "/logo.png"} 
            alt="Logo"
            className="w-full h-full object-cover" 
          />
        </div>    
        
        <div className="flex flex-col justify-center gap-0">
          {/* ชื่อบริษัท: ลดขนาดฟอนต์ในมือถือเพื่อให้ไม่เบียดปุ่ม Logout */}
          <span className="block font-black text-sm md:text-xl tracking-tighter text-slate-900 leading-tight">
            {companyData?.name}
          </span>
          
          {/* คำอธิบาย: ซ่อนในมือถือ (hidden) และแสดงในจอใหญ่ (md:block) เพื่อรักษาพื้นที่ Header */}
          <div className="hidden md:flex flex-col gap-0.5">
            <span className="block text-[12px] font-medium text-slate-600 leading-normal max-w-[400px] whitespace-normal">
              {companyData?.description}
            </span>
          </div>
  
          {/* ป้าย Panel: ปรับขนาดให้เล็กลงในมือถือ */}
          <span className="block text-[8px] md:text-[10px] font-bold text-blue-600 tracking-[0.15em] md:tracking-[0.25em] uppercase opacity-90">
            Admin Panel
          </span>
        </div>
      </div>
      
      {/* ปุ่มแก้ไข: ซ่อนในมือถือเพื่อความสะอาดของ Header หรือแสดงเมื่อเปิด Sidebar เท่านั้น */}
      <button 
        type="button"
        onClick={() => setShowCompanyModal(true)}
        className="hidden md:flex text-[9px] font-bold text-slate-400 hover:text-blue-500 transition-colors items-center gap-1 ml-1 w-fit uppercase outline-none"
      >
        <span>⚙️ แก้ไขโปรไฟล์บริษัท</span>
      </button>
    </div>
  );

  // Filter State for Report

  useEffect(() => {

    window.history.pushState(null, "", window.location.href);

    const handlePopState = () => {

      window.history.pushState(null, "", window.location.href);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []); // ทำงานครั้งเดียวตอน Mount

  
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

// 1. Filter การเข้างานหลัก (ตัวเดิมที่คุณมีอยู่แล้ว) - ต้องอยู่ด้านบน
const filteredAttendance = useMemo(() => {
  if (!attendance) return [];
  
  return attendance.map(att => {
    // หาข้อมูลพนักงานมาประกบ
    const empInfo = employees?.find(e => String(e.id) === String(att.userId || att.user_id));
    
    return {
      ...att, // ดึงค่าเดิมมาให้หมด (สำคัญ! ห้ามหาย)
      // ปรับจูน Key ให้เป็นมาตรฐานเดียวกันเพื่อใช้ในตาราง
      id: att.id,
      date: att.date || "---",
      checkIn: att.checkIn || att.check_in || "--:--", 
      checkOut: att.checkOut || att.check_out || "--:--",
      siteName: att.siteName || "General",
      avatarUrl: att.avatarUrl || empInfo?.avatarUrl || null,
      employeeName: att.employeeName || (empInfo ? `${empInfo.firstName} ${empInfo.lastName}` : "Unknown"),
      userId: att.userId || att.user_id
    };
  }).filter(a => {
    const search = (searchAtt || "").toLowerCase();
    return (
      a.employeeName.toLowerCase().includes(search) || 
      a.date.toString().includes(search) ||
      a.siteName.toLowerCase().includes(search)
    );
  });
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
      // ใช้ String() ครอบทั้งสองฝั่งเพื่อให้มั่นใจว่าเปรียบเทียบกันได้
      const matchSite = filterSite === "" || String(e.siteId) === String(filterSite);
      const matchDept = filterDepartment === "" || String(e.departmentId) === String(filterDepartment);
      
      const s = searchTerm.toLowerCase();
      const matchSearch = searchTerm === "" || 
                          e.firstName?.toLowerCase().includes(s) || 
                          e.lastName?.toLowerCase().includes(s) || 
                          e.id?.toString().includes(s);
      
      return matchSite && matchDept && matchSearch;
    });
  }, [employees, filterSite, filterDepartment, searchTerm]);

  const handleDownloadExcel = (data: any[]) => {
    if (data.length === 0) {
      alert("ไม่มีข้อมูลที่จะส่งออก");
      return;
    }
  
    const excelData = data.map(item => ({
      'วันที่': item.date,
      'ชื่อพนักงาน': item.employeeName,
      'รหัสพนักงาน': item.userId || item.user_id,
      'เวลาเข้า': item.checkIn,
      'เวลาออก': item.checkOut || '-',
      'สถานที่': item.siteName || '-',
      'สถานะ': item.checkOut ? 'เสร็จสิ้น' : 'กำลังปฏิบัติงาน'
    }));
  
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance_Report");
    
    // ดาวน์โหลดไฟล์พร้อมตั้งชื่อตามช่วงวันที่
    XLSX.writeFile(wb, `Report_${startDate}_to_${endDate}.xlsx`);
  };


  const compressImage = (file: File) => {
    return new Promise((resolve, reject) => {
      if (!file) return reject("No file provided"); // ✅ ป้องกันกรณี file เป็น null/undefined

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 800; 
          let width = img.width, height = img.height;
          
          if (width > height) { 
            if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } 
          } else { 
            if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } 
          }
          
          canvas.width = width; 
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.6)); 
          } else {
            reject("Canvas context not available");
          }
        };
        img.onerror = (err) => reject(err); // ✅ เพิ่ม error handling
      };
      reader.onerror = (err) => reject(err); // ✅ เพิ่ม error handling
    });
  };

  // --- HANDLERS ---

  const handleUpdateCompany = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSavingCompany(true);
    
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    try {
      // 1. กำหนดค่าเริ่มต้นเป็น URL เดิมจาก Database
      let finalLogoUrl = companyData?.logoUrl || null;

      // 2. ตรวจสอบการอัปโหลดไฟล์ใหม่ (อ้างอิง name="companyLogo" จาก input)
      const fileInput = (e.currentTarget.elements.namedItem('companyLogo') as HTMLInputElement)?.files?.[0];
      
      if (fileInput) {
        // บีบอัดไฟล์เป็น Base64 ก่อนส่งผ่านฟังก์ชันที่ประกาศไว้ด้านบน
        finalLogoUrl = await compressImage(fileInput) as string;
      } else if (companyLogoPreview) {
        // กรณีมีรูปใน preview แต่ไม่ได้เลือกไฟล์ใหม่
        finalLogoUrl = companyLogoPreview;
      }

      const payload = {
        companyName: data.companyName,
        description: data.description,
        phone: data.phone,
        email: data.email,
        address: data.address,
        confirmPassword: data.confirmPassword, 
        logoUrl: finalLogoUrl, // ส่ง Base64 หรือ URL เดิมไปที่ Server
      };

      // 3. ส่ง Payload ไปที่ Server Action
      const result = await updateCompanyAction(payload);
      
      if (result.success) {
        alert("🏢 อัปเดตข้อมูลบริษัทเรียบร้อย");
        setCompanyLogoPreview(null); // ล้างค่า Preview
        setShowCompanyModal(false);
        window.location.reload(); 
      } else {
        alert("❌ เกิดข้อผิดพลาด: " + result.error);
      }
    } catch (error) {
      console.error("Save Error:", error);
      alert("❌ ไม่สามารถบันทึกข้อมูลได้");
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleUpdateAdmin = async (formData: FormData) => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);

      const currentPass = formData.get("currentPassword") as string;
      const newPass = formData.get("newPassword") as string;
      const confirmPass = formData.get("confirmPassword") as string;

      if (!currentPass || currentPass.trim() === "") {
        alert("⚠️ กรุณาระบุรหัสผ่านเดิมเพื่อยืนยันการแก้ไขข้อมูล");
        setIsProcessing(false);
        return;
      }

      if (newPass && newPass !== confirmPass) {
        alert("❌ รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน!");
        setIsProcessing(false);
        return;
      }

      // ✨ [จุดที่เพิ่ม] ดึงรูปจาก State (เช่น previewImage) มาใส่ใน formData
      // ต้องเช็คชื่อตัวแปรที่ใช้เก็บรูปในหน้า Client ของคุณ (สมมติว่าชื่อ previewImage)
      if (previewImage && previewImage.startsWith("data:image")) {
        formData.set("avatarUrl", previewImage);
      }

      // 🚀 ส่งข้อมูลไปที่ Server Action
      const result = await updateAdminProfileAction(admin.id, formData);

      if (result.success) {
        alert("✅ " + (result.message || "บันทึกข้อมูลโปรไฟล์สำเร็จ!"));
        
        if (typeof setShowAdminEdit === 'function') {
          setShowAdminEdit(false);
        }
        
        if (typeof setPreviewImage === 'function') {
          setPreviewImage(null);
        }
      } else {
        alert("❌ " + (result.error || "ไม่สามารถบันทึกข้อมูลได้"));
      }

    } catch (error: any) {
      console.error("Submit Error:", error);
      alert("🚨 เกิดข้อผิดพลาดร้ายแรง: ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    } finally {
      setIsProcessing(false);
    }
  };
/* ==========================================================================
   ฟังก์ชันจัดการ ไซต์งาน
   ========================================================================== */


/* --- ฟังก์ชันแก้ไขไซต์งาน --- */
  const handleUpdateSite = (site: any) => {
    setEditingSite(site); // เก็บข้อมูลไซต์ที่เลือกลง State
    const [latVal, lngVal] = (site.coodinates || ",").split(","); // แยกพิกัด
    setLat(latVal || "");
    setLng(lngVal || "");
    setShowAddSite(true); // เปิด Modal อันเดิมที่มีอยู่แล้ว
    setShowManageModal(false)
  };

  /* --- ฟังก์ชันแก้ไขตำแหน่ง --- */
  const handleEditPos = (pos: any) => {
    setEditingPos(pos); // เก็บข้อมูลตำแหน่งที่เลือก
    setShowAddPosition(true); // เปิด Modal อันเดิม
    setShowManageModal(false)
  };

    const handleDeleteSite = async (id: string) => {
      // 1. ถามยืนยันก่อนลบ
      const isConfirmed = confirm("⚠️ ยืนยันการลบไซต์งานนี้?\nข้อมูลพนักงานที่ผูกอยู่กับไซต์นี้อาจได้รับผลกระทบ");
      if (!isConfirmed) return;
    
      const prev = [...allSites];
      // 🚀 Optimistic Update: หายทันทีจากหน้าจอและการ์ด
      setAllSites(allSites.filter(s => s.id !== id));
    
      try {
        const res = await deleteSiteAction(id);
        if (res.success) {
          // 2. แจ้งเมื่อลบสำเร็จ
          alert("✅ ลบไซต์งานเรียบร้อยแล้ว");
        } else {
          // 3. แจ้งเมื่อเกิดข้อผิดพลาด (เช่น ติด Foreign Key)
          alert("❌ ไม่สามารถลบได้: " + res.error);
          setAllSites(prev); // คืนค่ากลับมาในตาราง
        }
      } catch (error) {
        alert("❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
        setAllSites(prev);
      }
    };
  
  /* ==========================================================================
     ฟังก์ชันจัดการ ตำแหน่ง
     ========================================================================== */
  const handleUpdatePosition = async (id: string, name: string) => {
    const prev = [...allPositions];
    // 🚀 เปลี่ยนชื่อทันทีในตาราง
    setAllPositions(allPositions.map(p => p.id === id ? { ...p, name } : p));
  
    try {
      const res = await updatePositionAction(id, name);
      if (res.success) {
        alert("✅ อัปเดตชื่อตำแหน่งเรียบร้อยแล้ว");
      } else {
        alert("❌ ไม่สามารถแก้ไขได้: " + res.error);
        setAllPositions(prev);
      }
    } catch (error) {
      alert("❌ เกิดข้อผิดพลาดในการเชื่อมต่อ");
      setAllPositions(prev);
    }
  };
  
  const handleDeletePos = async (id: string) => {
    // 1. ถามยืนยันก่อนลบ
    const isConfirmed = confirm("⚠️ ยืนยันการลบตำแหน่งนี้?\nพนักงานที่ใช้ตำแหน่งนี้จะไม่มีตำแหน่งระบุในระบบ");
    if (!isConfirmed) return;
  
    const prev = [...allPositions];
    // 🚀 หายทันทีจากตารางและการ์ด
    setAllPositions(allPositions.filter(p => p.id !== id));
  
    try {
      const res = await deletePositionAction(id);
      if (res.success) {
        // 2. แจ้งเมื่อลบสำเร็จ
        alert("✅ ลบตำแหน่งเรียบร้อยแล้ว");
      } else {
        // 3. แจ้งเมื่อลบไม่สำเร็จ
        alert("❌ ไม่สามารถลบได้: " + res.error);
        setAllPositions(prev); // คืนค่าข้อมูลกลับมา
      }
    } catch (error) {
      alert("❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
      setAllPositions(prev);
    }
  };
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert("เบราว์เซอร์ของคุณไม่รองรับการดึงพิกัด");
      return;
    }
  
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoords(`${latitude}, ${longitude}`); // เก็บลง State
        setIsLocating(false);
      },
      (error) => {
        console.error(error);
        alert("ไม่สามารถดึงพิกัดได้ โปรดตรวจสอบการอนุญาตสิทธิ์ตำแหน่ง");
        setIsLocating(false);
      },
      { enableHighAccuracy: true } // ใช้ความแม่นยำสูง
    );
  };

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

const handleGetCurrentLocation = () => {
  setIsProcessing(true); // เริ่มกระบวนการโหลด
  
  if (!navigator.geolocation) {
    alert("เบราว์เซอร์ของคุณไม่รองรับการดึงพิกัด");
    setIsProcessing(false);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      setLat(position.coords.latitude.toString());
      setLng(position.coords.longitude.toString());
      setIsProcessing(false); // โหลดเสร็จแล้ว
    },
    (error) => {
      alert("ไม่สามารถดึงพิกัดได้ กรุณาเปิด GPS หรืออนุญาตสิทธิ์");
      setIsProcessing(false); // จบการโหลดแม้จะ Error
    },
    { enableHighAccuracy: true, timeout: 10000 } // เพิ่มความแม่นยำและ Timeout
  );
};
const handleAddSite = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setIsProcessing(true);

  try {
    const formData = new FormData(e.currentTarget);
    const siteData = {
      name: formData.get("siteName") as string,
      address: formData.get("address") as string,
      lat: lat,
      lng: lng,
    };

    const res = editingSite
      ? await updateSiteAction(editingSite.id, siteData)
      : await saveSiteAction(siteData);

    if (res.success) {
      alert(res.message);
      setShowAddSite(false);
    } else {
      alert(res.error);
    }
  } catch (error) {
    console.error("Error adding site:", error);
    alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
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
        setShowManageModal(true);
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
    setSelectedRole(emp.role || "employee");
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleRemarkChange = (id: string, value: string) => {
    setLeaveRemarks(prev => ({ ...prev, [id]: value }));
  };

  const updateLeaveStatus = async (id, status) => {
    // ปรับข้อความ Confirm ให้เป็นภาษาไทยที่อ่านง่าย
    const actionText = status === 'approved' ? 'อนุมัติ' : status === 'rejected' ? 'ปฏิเสธ' : 'ดึงกลับมาเป็นรอนุมัติ';
    if (!confirm(`ยืนยันการ "${actionText}" คำขอลานี้?`)) return;

    setIsProcessing(true);
    try {
      // ดึงค่า remark จาก state ตาม id
      const remark = leaveRemarks[id] || "";

      // ✅ เรียก Action ส่ง id, status และ remark ไปบันทึก
      const result = await updateLeaveStatusAction(id, status, remark);
      
      if (result.success) {
        // 1. อัปเดต State ในหน้าจอทันทีเพื่อให้ UI ลื่นไหล (รวมถึงอัปเดต remark ในแถวด้วย)
        setLeaves(prev => prev.map(l => l.id === id ? { ...l, status, remark: status !== 'pending' ? (remark || l.remark) : l.remark } : l));
        
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

  
    try {
      let finalAvatarUrl = editingEmployee?.avatarUrl || ""; 
      if (avatarFile && avatarFile.size > 0) finalAvatarUrl = await compressImage(avatarFile);
  
      const siteInput = data.site_id;
      
      // 🔐 การจัดการ Password
      const passwordToSave = data.password;
      const oldPassword = data.oldPassword; // ดึงค่ารหัสผ่านเดิมจากฟอร์ม
      
      const payload = {
        id: editingEmployee?.id,
        firstName: data.firstName,
        lastName: data.lastName,
        userName: data.userName,
        // ✅ เพิ่ม logic: ส่ง password และ oldPassword เฉพาะเมื่อมีการกรอกรหัสผ่านใหม่ในโหมดแก้ไข
        ...(editingEmployee 
          ? (passwordToSave ? { password: passwordToSave, oldPassword: oldPassword } : {}) 
          : { password: passwordToSave }
        ),
        role: data.role, 
        avatarUrl: finalAvatarUrl,
        positionId: data.positionId,
        siteId: (siteInput === "all_sites" || siteInput === "") ? null : siteInput,
        departmentId: data.departmentId, 
        // ✅ ข้อมูลเวลาทำงาน (คงเดิม)
        startTime: data.startTime,
        endTime: data.endTime,
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 overflow-x-hidden">
    {/* --- 💎 REFINED PROFESSIONAL ADMIN HEADER (STATIC - อยู่กับที่ ไม่เลื่อนตาม) --- */}
    {isProcessing && <LoadingOverlay />}
    <>
      {/* --- HEADER --- */}
      <header className="pt-1 bg-white border-b border-slate-200 shadow-md shadow-slate-200/30 print:hidden relative w-full">
  <div className="max-w-7xl mx-auto px-4 md:px-8 text-slate-900">
    {/* ปรับ py-3 สำหรับมือถือเพื่อให้ดู Compact และ py-6 สำหรับจอใหญ่ */}
    <div className="py-3 md:py-6 flex items-center justify-between relative z-10">
      
      {/* กลุ่มฝั่งซ้าย: จัดวาง Hamburger และ Logo */}
      <div className="flex items-center gap-3 md:gap-6">
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center bg-slate-50 rounded-lg md:rounded-2xl border border-slate-200 hover:bg-slate-100 transition-all active:scale-90 shadow-sm group"
        >
          <span className="text-lg md:text-2xl text-slate-500 group-hover:text-slate-900 transition-colors">☰</span>
        </button>
        
        {/* จัดตำแหน่ง Logo ให้กึ่งกลางแนวตั้งพอดีกับปุ่มเมนู */}
        <div className="flex items-center">
          <Logo />
        </div>
      </div>
      
      {/* กลุ่มฝั่งขวา: ปุ่มลงชื่อออก */}
      <button 
        onClick={handleLogout}
        className="group flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-3 px-3 md:px-6 py-1.5 md:py-2.5 bg-white text-red-600 rounded-xl md:rounded-2xl border border-red-50/50 md:border-red-100 hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-sm min-w-[65px] md:min-w-fit"
      >
        {/* ไอคอนประตู: ปรับขนาดให้พอดีกับเลย์เอาต์แนวตั้งในมือถือ */}
        <span className="text-lg md:text-xl group-hover:rotate-12 transition-transform leading-none">
          🚪
        </span>
        
        {/* ข้อความ: แสดงผลตลอดเวลาแต่ปรับสไตล์ให้เข้ากับอุปกรณ์ */}
        <span className="text-[8px] md:text-[11px] font-black uppercase tracking-[0.05em] md:tracking-[0.2em] leading-none">
          ลงชื่อออก
        </span>
      </button>
    </div>
  </div>
</header>

 {/* --- SIDEBAR OVERLAY & PANEL --- */}
        <div className={`fixed inset-0 z-[1000] print:hidden transition-all duration-300 ${isSidebarOpen ? 'visible' : 'invisible'}`}>
          {/* Background Overlay */}
          <div 
            className={`absolute inset-0 bg-slate-900/40 backdrop-blur-[3px] transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}
            onClick={() => setIsSidebarOpen(false)}
          />
          
          {/* Sidebar Panel - Animation Slide */}
          <aside 
            className={`absolute left-0 top-0 h-full w-full max-w-[300px] md:max-w-[340px] bg-white shadow-2xl flex flex-col transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
          >
            
            {/* Sidebar Header */}
            <div className="p-5 md:p-7 border-b border-slate-100 flex items-center gap-5 bg-white shrink-0">
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center bg-slate-900 rounded-xl md:rounded-2xl text-white hover:bg-slate-800 transition-all active:scale-90 shadow-xl"
              >
                <span className="text-xl md:text-2xl">☰</span>
              </button>
              <h2 className="font-black text-slate-900 uppercase italic tracking-tighter text-lg md:text-xl">Admin Menu</h2>
            </div>

            {/* Sidebar Content - เปลี่ยน justify-center เป็น justify-start และเพิ่ม pt-10 */}
            <div className="flex-1 overflow-y-auto px-6 md:px-7 pt-10 pb-8 flex flex-col justify-start space-y-8 md:space-y-12">
              
              {/* 👤 Profile Section */}
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-6 md:mb-8">
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-[2.5rem] md:rounded-[3rem] bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 flex items-center justify-center text-white font-black shadow-2xl border-4 border-white overflow-hidden transform hover:rotate-3 transition-transform">
                    {isUploading && (
                      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-10 flex items-center justify-center animate-spin">⏳</div>
                    )}
                    {admin?.avatarUrl ? (
                      <img src={admin.avatarUrl} alt="profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl md:text-4xl uppercase italic tracking-tighter">{admin?.name?.substring(0, 2)}</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 md:space-y-3 mb-6 md:mb-8">
                  <span className="px-4 py-1 bg-slate-900 text-white text-[9px] md:text-[10px] font-black rounded-full uppercase tracking-[0.25em] inline-block shadow-md">
                    {admin?.role || 'Admin'}
                  </span>
                  <h3 className="font-black text-slate-900 text-xl md:text-2xl leading-tight tracking-tight">{admin?.name || 'ไม่พบชื่อผู้ใช้งาน'}</h3>
                  <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-[0.15em]">🏢 {admin?.company || 'General Admin'}</p>
                </div>

                <button 
                  onClick={() => { setShowAdminEdit(true); setIsSidebarOpen(false); }}
                  className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 bg-blue-50/50 py-3 md:py-4 px-6 md:px-8 rounded-2xl hover:bg-blue-600 hover:text-white transition-all w-full border border-blue-100 shadow-sm active:scale-[0.98]"
                >
                  👤 แก้ไขโปรไฟล์แอดมิน
                </button>
              </div>

              <hr className="border-slate-100 mt-8 md:mt-12 mb-2" />

              {/* 🕹️ Navigation Actions */}
              <div className="space-y-4 md:space-y-5">
                <p className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">จัดการโครงสร้าง</p>
                <div className="grid grid-cols-1 gap-3 md:gap-3.5">
                  <button 
                    onClick={() => { setShowAddSite(true); setIsSidebarOpen(false); }}
                    className="flex items-center gap-4 md:gap-5 p-4 md:p-5 bg-emerald-50/40 hover:bg-emerald-50 rounded-[1.2rem] md:rounded-[1.5rem] border border-emerald-100/50 transition-all group active:scale-[0.97]"
                  >
                    <span className="text-xl md:text-2xl group-hover:scale-125 transition-transform">📍</span>
                    <span className="text-[11px] md:text-xs font-black text-emerald-900 uppercase tracking-tighter">จัดการไซต์งาน</span>
                  </button>

                  <button 
                    onClick={() => { setShowAddDepartment(true); setIsSidebarOpen(false); }}
                    className="flex items-center gap-4 md:gap-5 p-4 md:p-5 bg-indigo-50/40 hover:bg-indigo-50 rounded-[1.2rem] md:rounded-[1.5rem] border border-indigo-100/50 transition-all group active:scale-[0.97]"
                  >
                    <span className="text-xl md:text-2xl group-hover:scale-125 transition-transform">🏢</span>
                    <span className="text-[11px] md:text-xs font-black text-indigo-900 uppercase tracking-tighter">จัดการแผนก</span>
                  </button>

                  <button 
                    onClick={() => { setShowAddPosition(true); setIsSidebarOpen(false); }}
                    className="flex items-center gap-4 md:gap-5 p-4 md:p-5 bg-amber-50/40 hover:bg-amber-50 rounded-[1.2rem] md:rounded-[1.5rem] border border-amber-100/50 transition-all group active:scale-[0.97]"
                  >
                    <span className="text-xl md:text-2xl group-hover:scale-125 transition-transform">💼</span>
                    <span className="text-[11px] md:text-xs font-black text-amber-900 uppercase tracking-tighter">จัดการตำแหน่ง</span>
                  </button>
                </div>
              </div>

              {/* 📊 Main Actions */}
              <div className="space-y-4 md:space-y-5 pt-2">
                <p className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">เมนูหลัก</p>
                <div className="space-y-3 md:space-y-4">
                  <button 
                    onClick={() => { setShowRegister(true); setIsSidebarOpen(false); }}
                    className="w-full h-14 md:h-16 bg-slate-900 text-white rounded-[1.2rem] md:rounded-[1.5rem] font-black text-[11px] md:text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 md:gap-4 shadow-2xl hover:bg-slate-800 active:scale-95 transition-all"
                  >
                    <span className="text-xl md:text-2xl">+</span> ลงทะเบียนพนักงาน
                  </button>
                  
                  <button 
                    onClick={() => { setShowFilterModal(true); setIsSidebarOpen(false); }}
                    className="w-full h-14 md:h-16 bg-blue-600 text-white rounded-[1.2rem] md:rounded-[1.5rem] font-black text-[11px] md:text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 md:gap-4 shadow-2xl hover:bg-blue-500 active:scale-95 transition-all"
                  >
                    <span className="text-xl md:text-2xl">📊</span> เรียกดูรายงาน
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar Footer */}
            <div className="p-8 md:p-10 border-t border-slate-100 bg-slate-50/30 text-center shrink-0">
              <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] opacity-50 italic">Gemini HR System v1.0</p>
            </div>
          </aside>
        </div>
      </>
      <main className="max-w-7xl mx-auto px-6 pt-12">
       {/* --- STATS CARDS --- */}
        <div className="justify-center grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 print:hidden">
          {[
            { label: "พนักงานทั้งหมด", val: employees.length, unit: "คน", icon: "👥", color: "blue" },
            { label: "ลงชื่อวันนี้", val: attendance.length, unit: "รายการ", icon: "📍", color: "emerald" },
            { label: "คำขอลางาน", val: leaves.filter(l => l.status === 'pending').length, unit: "รอนุมัติ", icon: "📝" },
          ].map((s, i) => (
            /* --- การ์ดปกติ 1-3: ปรับเป็นแนวนอนในมือถือ (flex-row) และแนวตั้งในจอใหญ่ (md:flex-col) --- */
            <div key={i} className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-row md:flex-col items-center md:items-start gap-5 md:gap-0">
              <div className="flex justify-between items-start md:mb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform ${
                  s.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                  s.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'
                }`}>
                  {s.icon}
                </div>
              </div>
              <div className="space-y-1 flex-1 md:flex-none">
                <div className="flex items-baseline gap-2 md:block">
                  <p className="text-3xl md:text-4xl font-black text-slate-900">{s.val}</p>
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest md:hidden">Live Data</span>
                </div>
                <p className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-tighter">
                  {s.label} <span className="text-[10px] md:text-xs opacity-50">({s.unit})</span>
                </p>
              </div>
              <span className="hidden md:block text-[10px] font-black text-slate-300 uppercase tracking-widest pt-2">Live Data</span>
            </div>
          ))}

          {/* ✅ การ์ดที่ 4: ปรับขนาด Padding และความสูงให้พอดีกับอุปกรณ์เคลื่อนที่ */}
          <div 
            onClick={() => setShowManageModal(true)} 
            className="relative bg-white rounded-[2rem] md:rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden group flex flex-col h-full min-h-[160px] md:min-h-0"
          >
            {/* 🏷️ Badge มุมขวาบน */}
            <div className="absolute top-4 right-5 z-10 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
              </span>
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter bg-blue-50 px-3 py-1 rounded-full border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                กดเพื่อแก้ไข
              </span>
            </div>

            {/* ครึ่งบน: ไซต์งาน */}
            <div className="flex-1 p-5 md:p-6 flex items-center gap-4 hover:bg-purple-50/50 transition-colors border-b border-slate-50 pt-12 md:pt-10">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-lg md:text-xl group-hover:scale-110 transition-transform">🏢</div>
              <div>
                <p className="text-xl md:text-2xl font-black text-slate-900 leading-none">{allSites.length}</p>
                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">ไซต์งานทั้งหมด</p>
              </div>
            </div>

            {/* ครึ่งล่าง: ตำแหน่ง */}
            <div className="flex-1 p-5 md:p-6 flex items-center gap-4 hover:bg-pink-50/50 transition-colors">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center text-lg md:text-xl group-hover:scale-110 transition-transform">💼</div>
              <div>
                <p className="text-xl md:text-2xl font-black text-slate-900 leading-none">{positions.length}</p>
                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">ตำแหน่งทั้งหมด</p>
              </div>
            </div>
          </div>
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
                      <th className="py-5 px-6 text-left bg-white border-b border-gray-100">รอบเข้างาน</th>
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
                          <td className="py-4 px-6 font-bold text-gray-600">
                            <div className="flex flex-col">
                              {e.startTime && e.endTime ? (
                                <span className="text-[15px] text-black-600">
                                  {e.startTime.slice(0, 5)} - {e.endTime.slice(0, 5)}
                                </span>
                              ) : (
                                <span className="text-[13px] text-slate-400 font-medium italic">
                                  ยังไม่ได้ระบุ
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {(() => {
                              // เช็คว่าถ้า e.site ไม่มีค่า, เป็นค่าว่าง หรือเป็น "ไม่ระบุ" ให้เปลี่ยนเป็น "ทุกไซต์"
                              const displaySite = (e.site === "ไม่ระบุ" || !e.site) ? "ทุกไซต์" : e.site;

                              return (
                                <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full font-bold text-[11px] uppercase tracking-wider">
                                  {displaySite}
                                </span>
                              );
                            })()}
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
          <Section title="ตารางเข้า-ออกงานของพนักงาน">
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
                {/* ✅ ขยายความกว้างขั้นต่ำของตารางเป็น 1800px เพื่อการแสดงผลที่กว้างขึ้น */}
                <table className="min-w-[1800px] w-full text-sm border-separate border-spacing-0">
                  <thead className="sticky top-0 z-20 bg-white">
                    <tr className="text-gray-400 font-bold uppercase text-[11px] tracking-widest border-b border-gray-100">
                      <th className="py-5 px-6 text-left w-20 bg-white border-b border-gray-100">รูป</th>
                      <th className="py-5 px-6 text-left bg-white border-b border-gray-100">พนักงาน</th>
                      <th className="py-5 px-6 text-left bg-white border-b border-gray-100">วันที่</th>
                      <th className="py-5 px-6 text-left bg-white border-b border-gray-100">ไซต์งาน</th>
                      <th className="py-5 px-6 text-left bg-white border-b border-gray-100">รอบเข้างาน</th>
                      <th className="py-5 px-6 text-center bg-white border-b border-gray-100">สถานะการเข้างาน</th>
                      <th className="py-5 px-6 text-center bg-white border-b border-gray-100">สถานะการออกงาน</th>
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
                            <div className="font-black text-gray-600">{a.siteName || "ไม่ระบุชื่อ"}</div>
                          </td>
                          <td className="py-4 px-6 font-bold text-gray-600">
                            <div className="flex flex-col">
                              {a.startTime && a.endTime && (
                                <span className="text-[15px] text-black-600">
                                  {a.startTime.slice(0, 5)} - {a.endTime.slice(0, 5)}
                                </span>
                              )}
                            </div>
                          </td>
                          {/* ส่วนสถานะการเข้างานตามเงื่อนไขที่สั่ง */}
                          <td className="p-6 font-bold whitespace-nowrap">
                            {a.isLate === 1 ? (
                              <span className="text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 shadow-sm text-sm">
                                ⚠️ สาย
                              </span>
                            ) : (
                              <span className="text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm text-sm">
                                ✅ ปกติ
                              </span>
                            )}
                          </td>
                          <td className="p-6 font-bold whitespace-nowrap">
                            {a.isEarlyExit === "1" ? (
                              <span className="text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 shadow-sm text-sm">
                                ⚠️ ออกก่อนเวลา
                              </span>
                            ) : a.isEarlyExit === "0" ? (
                              <span className="text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm text-sm">
                                ✅ ปกติ
                              </span>
                            ) : (
                              <span className="text-gray-400 font-medium px-3">-</span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-center font-black text-green-600 text-base">
                            {a.checkIn ? (
                              a.checkIn.split(':').slice(0, 2).join(':')
                            ) : "-"}
                          </td>
                          <td className="py-4 px-6 text-center font-black text-red-600 text-base">
                            {a.checkOut ? (
                              a.checkOut.split(':').slice(0, 2).join(':')
                            ) : "-"}
                          </td>
                          <td className="py-4 px-6 text-center">
                            <div className="flex justify-center">
                              {a.imageIn ? (
                                <div className="w-10 h-10 relative rounded-xl overflow-hidden border border-slate-100 cursor-zoom-in active:scale-90 transition-transform shadow-sm" onClick={() => setViewImage(a.checkInPhoto || a.imageIn)}>
                                  <Image src={a.imageIn} alt="In" fill className="object-cover" />
                                </div>
                              ) : <span className="text-slate-300 text-[10px] font-bold italic">N/A</span>}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <div className="flex justify-center">
                              {a.imageOut ? (
                                <div className="w-10 h-10 relative rounded-xl overflow-hidden border border-slate-100 cursor-zoom-in active:scale-90 transition-transform shadow-sm" onClick={() => setViewImage(a.checkOutPhoto)}>
                                  <Image src={a.imageOut} alt="Out" fill className="object-cover" />
                                </div>
                              ) : <span className="text-slate-300 text-[10px] font-bold italic">N/A</span>}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            {a.locationIn ? (
                              <a 
                                href={`https://www.google.com/maps?q=${a.locationIn}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-black hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-1 mx-auto w-fit shadow-sm"
                              >
                                📍 ดูแผนที่
                              </a>
                            ) : <span className="text-slate-300 text-[10px] font-bold italic">ไม่มีข้อมูล</span>}
                          </td>
                          <td className="py-4 px-6 text-center">
                            {a.locationOut ? (
                              <a 
                                href={`https://www.google.com/maps?q=${a.locationOut}`} 
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
                        <td colSpan={13} className="py-24 text-center">
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
          <Section title="คำขอลางานของพนักงาน">
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
                      <th className="py-4 px-4 text-center border-b border-gray-100 bg-white">จัดการคำขอ</th>
                      <th className="py-4 px-4 text-center border-b border-gray-100 bg-white">หมายเหตุ</th>
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
                              {l.startDate} <br/> - <br/> {l.endDate}
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
                            <td className="py-4 px-4">
                              <div className="relative flex items-center gap-2 min-w-[180px]">
                                <input 
                                  type="text" 
                                  placeholder="ระบุหมายเหตุ..."
                                  className={`border rounded-xl px-3 py-1.5 text-xs w-full transition-all outline-none ${
                                    l.status !== 'pending' 
                                      ? 'bg-gray-50 text-gray-700 border-gray-200 shadow-sm' 
                                      : 'bg-white border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100'
                                  }`}
                                  value={l.status === 'pending' ? (leaveRemarks[l.id] ?? l.remark ?? "") : (l.remark ?? "-")}
                                  onChange={(e) => handleRemarkChange(l.id, e.target.value)}
                                  readOnly={l.status !== 'pending'}
                                />

                                {/* ปุ่มกดดูข้อความ และ Modal ขนาดเล็ก */}
                                {l.status !== 'pending' && l.remark && (
                                  <div className="relative">
                                    <button
                                      onClick={() => setViewRemarkId(viewRemarkId === l.id ? null : l.id)}
                                      className={`flex-shrink-0 p-1.5 rounded-lg transition-colors border ${
                                        viewRemarkId === l.id 
                                          ? 'bg-blue-600 text-white border-blue-600' 
                                          : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'
                                      }`}
                                      title="คลิกเพื่อดูหมายเหตุเต็ม"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                      </svg>
                                    </button>

                                    {/* Modal เล็ก (Popover) */}
                                    {viewRemarkId === l.id && (
                                      <>
                                        {/* Backdrop ใสสำหรับกดปิดเมื่อคลิกที่อื่น */}
                                        <div className="fixed inset-0 z-40" onClick={() => setViewRemarkId(null)}></div>
                                        
                                        <div className="absolute right-0 bottom-full mb-2 z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-xl p-3 animate-in fade-in zoom-in duration-200">
                                          <div className="flex justify-between items-center mb-2 pb-1 border-b border-gray-100">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">หมายเหตุจากผู้อนุมัติ</span>
                                            <button onClick={() => setViewRemarkId(null)} className="text-gray-400 hover:text-gray-600">
                                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </button>
                                          </div>
                                          <p className="text-xs text-gray-700 leading-relaxed break-words">
                                            {l.remark}
                                          </p>
                                          {/* ลูกศรชี้ลง */}
                                          <div className="absolute -bottom-1 right-3 w-2 h-2 bg-white border-r border-b border-gray-200 rotate-45"></div>
                                        </div>
                                      </>
                                    )}
                                  </div>
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
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[600] flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
      <h3 className="text-xl font-black text-slate-900 mb-6 uppercase italic flex items-center gap-2">
        <span className={`${editingSite ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'} p-2 rounded-lg text-sm not-italic`}>
          {editingSite ? '✏️' : '📍'}
        </span>
        {editingSite ? "แก้ไขไซต์งาน" : "เพิ่มไซต์งานใหม่"}
      </h3>
      
      <form 
        onSubmit={async (e) => {
          e.preventDefault();
          if (isProcessing) return;
          setIsProcessing(true);

          try {
            const formData = new FormData(e.currentTarget);
            const siteData = {
              name: formData.get("siteName") as string,
              address: formData.get("address") as string,
              lat: lat, // ใช้พิกัดจาก State ที่ดึงมา
              lng: lng,
            };

            let res;
            if (editingSite) {
              // ✅ กรณีแก้ไข: เรียก updateSiteAction พร้อม ID ตามที่ประกาศใน Server Action
              res = await updateSiteAction(editingSite.id, siteData);
            } else {
              // ➕ กรณีเพิ่มใหม่: เรียก saveSiteAction ตามปกติ
              res = await saveSiteAction(siteData);
            }

            if (res.success) {
              setShowAddSite(false);
              setEditingSite(null);
              // ล้างค่าพิกัดหลังบันทึก
              setLat("");
              setLng("");
            } else {
              alert(res.error || "เกิดข้อผิดพลาดในการบันทึก");
            }
          } catch (err) {
            console.error(err);
          } finally {
            setIsProcessing(false);
          }
        }} 
        className="space-y-5"
      >
        <div className="space-y-3">
          <input 
            name="siteName" 
            defaultValue={editingSite?.name || ""} 
            placeholder="ชื่อไซต์งาน..." 
            required 
            className="w-full border-none p-4 rounded-2xl bg-slate-50 font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-300" 
          />
          <input 
            name="address" 
            defaultValue={editingSite?.address || ""} 
            placeholder="ที่อยู่ไซต์งาน..." 
            className="w-full border-none p-4 rounded-2xl bg-slate-50 font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-300" 
          />
        </div>

        {/* 📍 ส่วนพิกัด: เพิ่มระบบกันกดซ้ำและ Loading Overlay */}
        <div className="space-y-3 relative">
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleGetCurrentLocation}
            className={`w-full py-4 relative overflow-hidden text-white rounded-2xl font-black uppercase text-[12px] shadow-lg transition-all flex items-center justify-center gap-3 border-b-4 
              ${isProcessing 
                ? 'bg-slate-400 border-slate-500 cursor-not-allowed' 
                : 'bg-blue-600 border-blue-800 hover:bg-blue-700 active:scale-95 shadow-blue-100'
              }`}
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>กำลังประมวลผล...</span>
              </>
            ) : (
              <>
                <span className="text-lg">🎯</span> 
                กดเพื่อดึงพิกัดจากเครื่อง
              </>
            )}
          </button>

          <div className={`flex gap-2 transition-opacity duration-300 ${isProcessing ? 'opacity-30' : 'opacity-60'}`}>
            <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 p-2">
              <span className="block text-[8px] text-slate-400 uppercase font-bold ml-1">Lat</span>
              <input 
                name="latitude" 
                value={lat} 
                readOnly={isProcessing}
                onChange={(e) => setLat(e.target.value)}
                placeholder="0.0000"
                className="w-full bg-transparent outline-none font-bold text-xs px-1" 
              />
            </div>
            <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 p-2">
              <span className="block text-[8px] text-slate-400 uppercase font-bold ml-1">Lng</span>
              <input 
                name="longitude" 
                value={lng} 
                readOnly={isProcessing}
                onChange={(e) => setLng(e.target.value)}
                placeholder="0.0000"
                className="w-full bg-transparent outline-none font-bold text-xs px-1" 
              />
            </div>
          </div>
          <p className="text-center text-[9px] text-slate-400 font-bold uppercase italic">* หากดึงพิกัดไม่ได้ กรุณาอนุญาตสิทธิ์เข้าถึงตำแหน่ง</p>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <button 
            type="button" 
            disabled={isProcessing}
            onClick={() => { setShowAddSite(false); setEditingSite(null); }} 
            className="flex-1 py-4 text-slate-400 font-bold uppercase text-[10px] disabled:opacity-30"
          >
            ยกเลิก
          </button>
          <button 
            type="submit" 
            disabled={isProcessing} 
            className={`flex-[2] py-4 ${editingSite ? 'bg-blue-600 shadow-blue-100' : 'bg-emerald-600 shadow-emerald-100'} text-white rounded-2xl font-black uppercase text-[10px] shadow-xl disabled:bg-slate-300`}
          >
            {isProcessing ? "กำลังบันทึก..." : editingSite ? "ยืนยันการแก้ไข" : "ยืนยันเพิ่มไซต์งาน"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
{/* --- 🎯 MODAL: ADD POSITION --- */}
{showAddPosition && (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[600] flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl">
      <h3 className="text-xl font-black text-slate-900 mb-6 uppercase italic">
        {editingPos ? "✏️ แก้ไขตำแหน่งงาน" : "💼 เพิ่มตำแหน่งงาน"}
      </h3>
      <form 
        onSubmit={async (e) => {
          e.preventDefault();
          if (isProcessing) return;
          setIsProcessing(true);

          try {
            const formData = new FormData(e.currentTarget);
            const posName = formData.get("posName") as string;

            let res;
            if (editingPos) {
              // ✅ กรณีแก้ไข: ส่งค่า String และรอผลลัพธ์
              res = await updatePositionAction(editingPos.id, posName);
            } else {
              // ✅ กรณีเพิ่มใหม่: เรียก savePositionAction
              res = await savePositionAction({ name: posName });
            }

            if (res.success) {
              // ✅ อัปเดตข้อมูลหน้าจอทันทีหลังทำรายการสำเร็จ
              setShowAddPosition(false);
              setEditingPos(null);
            } else {
              alert(res.error || "ไม่สามารถบันทึกข้อมูลได้");
            }
          } catch (err) {
            console.error(err);
          } finally {
            setIsProcessing(false);
          }
        }} 
        className="space-y-4"
      >
        <input 
          name="posName" 
          defaultValue={editingPos?.name || ""} 
          placeholder="ระบุชื่อตำแหน่ง..." 
          required 
          disabled={isProcessing}
          className="w-full border p-4 rounded-2xl bg-slate-50 font-bold outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50" 
        />
        <div className="flex gap-2 pt-2">
          <button 
            type="button" 
            disabled={isProcessing}
            onClick={() => { setShowAddPosition(false); setEditingPos(null); }} 
            className="flex-1 py-4 text-slate-400 font-bold uppercase text-[10px] disabled:opacity-30"
          >
            ยกเลิก
          </button>
          <button 
            type="submit" 
            disabled={isProcessing} 
            className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-amber-100 disabled:bg-slate-300"
          >
            {isProcessing ? "กำลังบันทึก..." : editingPos ? "อัปเดตตำแหน่ง" : "บันทึกตำแหน่ง"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
{/* --- 🛡️ MODAL: EDIT ADMIN PROFILE --- */}
{showAdminEdit && (
  <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-[500] p-4 backdrop-blur-md animate-in fade-in duration-300">
    <form 
      onSubmit={async (e) => {
        e.preventDefault();
        
        // 🛡️ ป้องกันการกดซ้ำขณะระบบกำลังทำงาน
        if (isProcessing) return;

        const formData = new FormData(e.currentTarget);
        const newPassword = formData.get("newPassword") as string;
        const confirmPassword = formData.get("confirmPassword") as string;
        const currentPassword = formData.get("currentPassword") as string;

        // 1. ตรวจสอบรหัสผ่านใหม่ (Client-side Validation)
        if (newPassword && newPassword !== confirmPassword) {
          alert("❌ รหัสผ่านใหม่ไม่ตรงกัน!");
          return;
        }

        // 2. บังคับให้ใส่รหัสผ่านเดิมเพื่อยืนยันตัวตน
        if (!currentPassword) {
          alert("⚠️ กรุณาระบุรหัสผ่านเดิมเพื่อยืนยันการบันทึกข้อมูล");
          return;
        }

        // 🚀 3. เรียกใช้งานฟังก์ชันบันทึกข้อมูลจริง
        await handleUpdateAdmin(formData); 
      }} 
      className="bg-white p-8 rounded-[3rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl custom-scrollbar"
    >
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="font-black text-2xl text-slate-900 uppercase italic">
          ⚙️ ตั้งค่าโปรไฟล์ผู้ดูแล
        </h2>
        <button type="button" onClick={() => setShowAdminEdit(false)} className="text-slate-300 hover:text-red-500 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      
      {/* ส่วนอัปโหลดรูป */}
      <div className="flex flex-col items-center gap-2 py-2">
        <div className="w-28 h-28 rounded-[2rem] bg-slate-100 overflow-hidden border-4 border-white shadow-lg relative group">
          <img 
            src={previewImage || admin?.avatarUrl || `https://ui-avatars.com/api/?name=${admin?.name}&background=random`} 
            className="w-full h-full object-cover"
            alt="Admin Preview"
          />
          <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
            <span className="text-white font-bold text-[10px] uppercase">
              {isProcessing ? "⏳ กำลังอัปโหลด..." : "เปลี่ยนรูป"}
            </span>
            <input 
              type="file" 
              name="avatar" 
              disabled={isProcessing}
              accept="image/*" 
              onChange={handleImageChange} 
              className="hidden" 
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ข้อมูลทั่วไป */}
        <div className="space-y-4">
          <h3 className="text-[11px] font-black text-blue-600 uppercase tracking-[0.2em] px-2">ข้อมูลทั่วไป</h3>
          
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Username (แก้ไขไม่ได้)</label>
            <input 
              value={admin?.userName || admin?.username} 
              readOnly 
              className="w-full bg-slate-100 p-4 rounded-2xl font-bold text-slate-500 cursor-not-allowed outline-none border border-transparent" 
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">ชื่อ-นามสกุล</label>
            <input name="name" defaultValue={admin?.name} required className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all" />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">อีเมลติดต่อ</label>
            <input name="email" type="email" defaultValue={admin?.email} placeholder="admin@example.com" className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all" />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">เบอร์โทรศัพท์</label>
            <input name="phone" type="tel" defaultValue={admin?.phone} placeholder="08x-xxx-xxxx" className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all" />
          </div>
        </div>

        {/* ส่วนเปลี่ยนรหัสผ่าน */}
        <div className="space-y-4 bg-slate-50/50 p-4 rounded-[2rem] border border-slate-100">
  <div className="px-2">
    <h3 className="text-[11px] font-black text-red-500 uppercase tracking-[0.2em]">ตั้งค่าความปลอดภัย</h3>
  </div>

  {/* รหัสผ่านเดิม */}
  <div className="space-y-1 text-slate-900">
    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">รหัสผ่านเดิม (เพื่อยืนยัน)</label>
    <div className="relative group">
      <input 
        name="currentPassword" 
        type={showPass ? "text" : "password"}
        className="w-full bg-white p-4 pr-12 rounded-2xl font-bold border border-slate-200 focus:border-red-500 outline-none transition-all focus:ring-4 focus:ring-red-500/5" 
        placeholder="••••••••"
      />
      <button 
        type="button" 
        onClick={() => setShowPass(!showPass)}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-blue-500 transition-colors z-10"
      >
        {showPass ? "ปิด" : "เปิด"}
      </button>
    </div>
  </div>

  <div className="h-px bg-slate-200 my-2"></div>

  {/* รหัสผ่านใหม่ */}
  <div className="space-y-1 text-slate-900">
    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">รหัสผ่านใหม่</label>
    <div className="relative group">
      <input 
        name="newPassword" 
        type={showPass ? "text" : "password"}
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className="w-full bg-white p-4 pr-12 rounded-2xl font-bold border border-slate-200 focus:border-blue-500 outline-none transition-all focus:ring-4 focus:ring-blue-500/5" 
        placeholder="ระบุรหัสใหม่"
      />
      <button 
        type="button" 
        onClick={() => setShowPass(!showPass)}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-blue-500 transition-colors z-10"
      >
        {showPass ? "ปิด" : "เปิด"}
      </button>
    </div>
  </div>

  {/* ยืนยันรหัสผ่านใหม่ */}
  <div className="space-y-1 text-slate-900">
    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">ยืนยันรหัสผ่านใหม่</label>
    <div className="relative group">
      <input 
        name="confirmPassword" 
        type={showPass ? "text" : "password"}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className={`w-full p-4 pr-12 rounded-2xl font-bold border outline-none transition-all focus:ring-4 
          ${isMismatch 
            ? "bg-red-50 border-red-500 focus:ring-red-500/10 text-red-600 shadow-[0_0_15px_rgba(239,68,68,0.1)]" 
            : "bg-white border-slate-200 focus:border-blue-500 focus:ring-blue-500/5"
          }`} 
        placeholder="ระบุรหัสใหม่อีกครั้ง"
      />
      <button 
        type="button" 
        onClick={() => setShowPass(!showPass)}
        className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors z-10 
          ${isMismatch ? "text-red-400 hover:text-red-600" : "text-slate-300 hover:text-blue-500"}`}
      >
        {showPass ? "ปิด" : "เปิด"}
      </button>
      
      {/* แจ้งเตือนเมื่อไม่ตรงกัน */}
      {isMismatch && (
        <div className="flex items-center gap-1 mt-1.5 ml-2">
          <span className="text-[10px] text-red-500 font-black uppercase tracking-wider animate-pulse">
            ❌ รหัสผ่านไม่ตรงกัน
          </span>
        </div>
      )}
    </div>
  </div>
</div>
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t mt-4">
        <button 
          type="button" 
          disabled={isProcessing}
          onClick={() => setShowAdminEdit(false)} 
          className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] tracking-widest hover:text-slate-600 transition-colors disabled:opacity-50"
        >
          ยกเลิก
        </button>
        <button 
          type="submit" 
          disabled={isProcessing}
          className={`px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl transition-all ${
            isProcessing 
              ? "bg-slate-400 cursor-not-allowed" 
              : "bg-slate-900 text-white active:scale-95 hover:bg-blue-600"
          }`}
        >
          {isProcessing ? "⏳ กำลังบันทึก..." : "💾 บันทึกข้อมูล"}
        </button>
      </div>
    </form>
  </div>
)}

{/* --- 👤 MODAL: REGISTRATION & EDIT --- */}
{showRegister && (
  <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-[500] p-4 backdrop-blur-md animate-in fade-in duration-300">
    <form 
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const pwd = formData.get("password") as string;
        const confirmPwd = formData.get("confirmPassword") as string;
        const oldPwd = formData.get("oldPassword") as string;
        
        if (editingEmployee && pwd && !oldPwd) {
          alert("กรุณากรอกรหัสผ่านเดิมเพื่อยืนยันการเปลี่ยนแปลง");
          return;
        }

        if ((!editingEmployee || pwd) && pwd !== confirmPwd) {
          alert("รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน");
          return;
        }

        handleSaveEmployee(e);
      }} 
      className="bg-white p-8 rounded-[3.5rem] w-full max-w-2xl space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl custom-scrollbar"
    >
      <h2 className="font-black text-2xl text-slate-900 uppercase italic border-b pb-4 flex justify-between items-center">
        <span>{editingEmployee ? "✏️ แก้ไขข้อมูลพนักงาน" : "👤 ลงทะเบียนพนักงานใหม่"}</span>
        {editingEmployee && (
          <button
            type="button"
            onClick={() => {
              if(confirm("ยืนยันการรีเซ็ตรหัสผ่านเป็น '1234' ? (ระบบจะเติมรหัสผ่านใหม่ให้อัตโนมัติ แต่คุณยังต้องกรอกรหัสผ่านเดิมเพื่อบันทึก)")) {
                const pInput = document.getElementById('reg-password') as HTMLInputElement;
                const cInput = document.getElementById('reg-confirm') as HTMLInputElement;
                if(pInput && cInput) {
                  pInput.value = "1234";
                  cInput.value = "1234";
                  alert("เตรียมรีเซ็ตเป็น 1234 แล้ว **กรุณากรอกรหัสผ่านเดิมในช่องด้านล่าง** ก่อนกดบันทึก");
                }
              }
            }}
            className="text-[10px] px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors font-bold flex items-center gap-1"
          >
            🔄 รีเซ็ตรหัสผ่าน
          </button>
        )}
      </h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* รูปโปรไฟล์ */}
        <div className="col-span-1 sm:col-span-2 space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2">รูปโปรไฟล์</label>
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

        {/* Username */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Username {editingEmployee && "(แก้ไขไม่ได้)"}</label>
          <input 
            name="userName" 
            defaultValue={editingEmployee?.userName} 
            placeholder="ชื่อผู้ใช้งาน..." 
            required 
            disabled={!!editingEmployee}
            onInput={(e) => {
              e.currentTarget.value = e.currentTarget.value.replace(/[^a-zA-Z0-9]/g, '');
            }}
            className={`w-full p-4 rounded-2xl font-bold border outline-none transition-all ${
              editingEmployee 
                ? 'bg-slate-100 text-slate-400 border-transparent' 
                : 'bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white'
            }`} 
          />
        </div>

        {/* ช่องรหัสผ่านเดิม (แสดงเฉพาะตอนแก้ไข) */}
        {editingEmployee && (
          <div className="space-y-1">
            <label className="text-[10px] font-black text-red-500 uppercase ml-2">รหัสผ่านเดิม (เพื่อยืนยันการเปลี่ยน)</label>
            <div className="relative">
              <input 
                name="oldPassword" 
                type={showOldPass ? "text" : "password"} 
                placeholder="ระบุรหัสผ่านปัจจุบัน..." 
                className="w-full p-4 pr-12 bg-red-50 border-transparent focus:border-red-500 focus:bg-white rounded-2xl font-bold border outline-none transition-all" 
              />
              <button type="button" onClick={() => setShowOldPass(!showOldPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-lg opacity-50 hover:opacity-100 transition-opacity">
                {showOldPass ? "ดู" : "ซ่อน"}
              </button>
            </div>
          </div>
        )}

        {/* Password ใหม่ */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
            {editingEmployee ? "รหัสผ่านใหม่ (ว่างไว้ถ้าไม่เปลี่ยน)" : "Password"}
          </label>
          <div className="relative">
            <input 
              id="reg-password"
              name="password" 
              type={showPass ? "text" : "password"} 
              placeholder={editingEmployee ? "พิมพ์รหัสผ่านใหม่..." : "รหัสผ่าน"} 
              required={!editingEmployee} 
              className="w-full p-4 pr-12 bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl font-bold border outline-none transition-all" 
            />
            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-lg opacity-50 hover:opacity-100 transition-opacity">
              {showPass ? "ดู" : "ซ่อน"}
            </button>
          </div>
        </div>

        {/* Confirm Password ใหม่ */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Confirm Password</label>
          <div className="relative">
            <input 
              id="reg-confirm"
              name="confirmPassword" 
              type={showConfirmPass ? "text" : "password"} 
              placeholder="ยืนยันรหัสผ่านใหม่" 
              required={!editingEmployee} 
              className="w-full p-4 pr-12 bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl font-bold border outline-none transition-all" 
            />
            <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-lg opacity-50 hover:opacity-100 transition-opacity">
              {showConfirmPass ? "ดู" : "ซ่อน"}
            </button>
          </div>
        </div>

        {/* ชื่อ-นามสกุล */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2">ชื่อจริง</label>
          <input name="firstName" defaultValue={editingEmployee?.firstName} required className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2">นามสกุล</label>
          <input name="lastName" defaultValue={editingEmployee?.lastName} required className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all" />
        </div>

        {/* --- ✨ ส่วนแก้ไขข้อมูลเพิ่มเติม ✨ --- */}
        {editingEmployee && (
          <>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-blue-500 uppercase ml-2">เวลาเข้างาน</label>
              <input 
                type="time" 
                name="startTime" 
                defaultValue={editingEmployee?.startTime || "08:00"} 
                className="w-full bg-blue-50/50 p-4 rounded-2xl font-bold border border-blue-100 focus:border-blue-500 outline-none transition-all" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-blue-500 uppercase ml-2">เวลาเลิกงาน</label>
              <input 
                type="time" 
                name="endTime" 
                defaultValue={editingEmployee?.endTime || "17:00"} 
                className="w-full bg-blue-50/50 p-4 rounded-2xl font-bold border border-blue-100 focus:border-blue-500 outline-none transition-all" 
              />
            </div>
          </>
        )}

        {/* ระดับสิทธิ์ (Role) */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2">ระดับสิทธิ์ (Role)</label>
          <select 
            name="role" 
            value={selectedRole} 
            onChange={(e) => setSelectedRole(e.target.value)} 
            className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none border border-transparent focus:border-blue-500 focus:bg-white transition-all appearance-none cursor-pointer"
          >
            <option value="employee">Employee</option>
            <option value="leader">Leader</option>
          </select>
        </div>

        {/* แผนก (Department) */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2">แผนก (Department)</label>
          <select 
            name="departmentId" 
            key={editingEmployee ? `edit-dept-${editingEmployee.id}` : 'reg-dept'} 
            defaultValue={editingEmployee?.departmentId || ""} 
            required 
            className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="">เลือกแผนก...</option>
            {departments?.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* ตำแหน่งงาน (Position) */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2">ตำแหน่งงาน (Position)</label>
          <select 
            name="positionId" 
            key={editingEmployee ? `edit-pos-${editingEmployee.id}` : 'reg-pos'} 
            defaultValue={editingEmployee?.positionId || ""} 
            required 
            className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="">เลือกตำแหน่ง...</option>
            {positions?.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* ไซต์งาน */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2">ไซต์งาน</label>
          <select 
            name="site_id" 
            key={editingEmployee ? `edit-site-${editingEmployee.id}` : 'reg-site'} 
            defaultValue={editingEmployee?.siteId || ""}
            required 
            className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="all_sites" className="text-blue-600 font-extrabold bg-blue-50">🌐 ทุกไซต์งาน (ALL SITES)</option>
            {sites.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t mt-4">
        <button 
          type="button" 
          disabled={isProcessing} 
          onClick={() => { 
            setShowRegister(false); 
            setEditingEmployee(null); 
            setPreviewImage(null); 
            setSelectedRole("employee"); 
          }} 
          className="px-6 py-4 font-bold text-slate-400 uppercase text-xs hover:text-slate-600 transition-colors disabled:opacity-50"
        >
          ยกเลิก
        </button>
        <button 
          type="submit" 
          disabled={isProcessing} 
          className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 hover:bg-slate-800 transition-all disabled:bg-slate-300 flex items-center gap-2"
        >
          {isProcessing ? "กำลังบันทึก..." : editingEmployee ? "💾 บันทึกการแก้ไข" : "➕ ลงทะเบียนพนักงาน"}
        </button>
      </div>
    </form>
  </div>
)}

{/* --- 📊 MODAL (Report Generator) --- */}
{showFilterModal && (
  <div className="fixed inset-0 bg-slate-100 z-[500] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 font-sans">
    
    {/* State สำหรับเปิด-ปิด Sidebar บนมือถือ (เพิ่มเฉพาะจุดนี้) */}
    {/* const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false); */}

    {/* --- 1. Header --- */}
    <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        {/* ปุ่มเปิด Filter บนมือถือ (ปรับเปลี่ยนรูปเป็น 3 ขีด สีขาว-เทา) */}
        <button 
          onClick={() => setIsMobileFilterOpen(true)}
          className="lg:hidden w-10 h-10 bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center gap-1 shadow-sm active:scale-95 transition-all"
        >
          <span className="w-5 h-[2px] bg-slate-400 rounded-full"></span>
          <span className="w-5 h-[2px] bg-slate-400 rounded-full"></span>
          <span className="w-5 h-[2px] bg-slate-400 rounded-full"></span>
        </button>
        
        <div className="w-10 h-10 bg-blue-600 rounded-xl hidden lg:flex items-center justify-center text-white text-xl shadow-lg shadow-blue-100">
          {isProcessing ? <span className="animate-spin text-lg">⏳</span> : "📊"}
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-900 leading-none mb-1 uppercase italic">สร้างรายงาน</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {isProcessing ? "กำลังประมวลผลข้อมูล..." : "ระบบสร้างรายงานและคัดกรองรายชื่อ"}
          </p>
        </div>
      </div>
      <button 
        disabled={isProcessing}
        onClick={() => setShowFilterModal(false)}
        className="w-12 h-12 flex items-center justify-center bg-slate-100 text-slate-400 rounded-full hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-50"
      >
        ✕
      </button>
    </div>

    <div className="flex-1 overflow-hidden flex flex-col lg:flex-row relative">
      
      {/* --- 2. Side Bar: Filters (Desktop: Normal / Mobile: Drawer) --- */}
      
      {/* Overlay สำหรับมือถือเมื่อเปิด Sidebar */}
      {isMobileFilterOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 z-[510] lg:hidden backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setIsMobileFilterOpen(false)}
        ></div>
      )}

      <div className={`
        fixed inset-y-0 left-0 w-80 bg-white z-[520] p-6 overflow-y-auto shadow-2xl transition-transform duration-300 transform
        lg:relative lg:translate-x-0 lg:shadow-none lg:z-0 lg:border-r lg:border-slate-200
        ${isMobileFilterOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between mb-6 lg:block">
           <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span> เงื่อนไขรายงาน
          </h4>
          <button onClick={() => setIsMobileFilterOpen(false)} className="lg:hidden text-slate-400 font-bold">ปิด ✕</button>
        </div>
        
        <div className="space-y-6">
          {/* 2.1 รูปแบบไฟล์ */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">รูปแบบไฟล์ (Format)</label>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setExportFormat('excel')}
                className={`p-4 rounded-xl text-xs font-black uppercase border transition-all ${exportFormat === 'excel' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/10' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
              >
                📗 Excel
              </button>
              <button 
                onClick={() => setExportFormat('pdf')}
                className={`p-4 rounded-xl text-xs font-black uppercase border transition-all ${exportFormat === 'pdf' ? 'bg-red-50 border-red-500 text-red-700 ring-2 ring-red-500/10' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
              >
                📕 PDF
              </button>
            </div>
          </div>

          {/* 2.2 ช่วงวันที่ */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">ช่วงวันที่ (Date Range)</label>
            <div className="grid grid-cols-1 gap-2">
              <input 
                type="date" 
                disabled={isProcessing} 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 ring-blue-500/10 outline-none transition-all" 
              />
              <input 
                type="date" 
                disabled={isProcessing} 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 ring-blue-500/10 outline-none transition-all" 
              />
            </div>
          </div>

          {/* 2.3 แผนก */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">แผนก (Department)</label>
            <select 
              value={filterDepartment || ""}
              disabled={isProcessing} 
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 ring-blue-500/10 transition-all"
            >
              <option value="">ทุกแผนก</option>
              {allDepartments?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* 2.4 ไซส์งาน */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">สถานที่ปฏิบัติงาน (Site)</label>
            <select 
              value={filterSite || ""}
              disabled={isProcessing} 
              onChange={(e) => setFilterSite(e.target.value)}
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 ring-blue-500/10 transition-all"
            >
              <option value="">ทุกไซส์งาน (All Sites)</option>
              {allSites?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          
          <button 
            onClick={() => setIsMobileFilterOpen(false)}
            className="lg:hidden w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs"
          >
            ตกลงและบันทึกฟิลเตอร์
          </button>
        </div>
      </div>

      {/* --- 3. Right Side: Member Selection --- */}
      <div className="flex-1 flex flex-col bg-slate-50/50">
        <div className="p-6 bg-white border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:max-w-md">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input 
              type="text" 
              placeholder="ค้นหาชื่อ หรือ รหัสพนักงาน..."
              value={searchTerm}
              className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 ring-blue-500/5 transition-all"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            disabled={isProcessing}
            onClick={() => {
              const visibleIds = filteredEmpSuggestions?.map((e: any) => e.id) || [];
              if (selectedEmployees.length === visibleIds.length) setSelectedEmployees([]);
              else setSelectedEmployees(visibleIds);
            }}
            className="whitespace-nowrap px-8 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-600 uppercase hover:bg-slate-900 hover:text-white shadow-sm transition-all active:scale-95"
          >
            {selectedEmployees.length === (filteredEmpSuggestions?.length || 0) ? "ล้างการเลือก" : "เลือกพนักงานทั้งหมด"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 relative">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredEmpSuggestions?.length > 0 ? filteredEmpSuggestions.map((emp: any) => {
              const siteName = allSites.find(s => String(s.id) === String(emp.siteId))?.name || "ทั่วไป";
              const posName = allPositions.find(p => String(p.id) === String(emp.positionId))?.name || "พนักงาน";

              return (
                <label 
                  key={emp.id} 
                  className={`flex items-center gap-4 p-5 rounded-[2.2rem] border-2 transition-all cursor-pointer select-none ${selectedEmployees.includes(emp.id) ? 'bg-blue-50 border-blue-500 shadow-lg shadow-blue-100' : 'bg-white border-slate-100 shadow-sm hover:border-blue-200'}`}
                >
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      checked={selectedEmployees.includes(emp.id)}
                      onChange={() => {
                        if (selectedEmployees.includes(emp.id)) setSelectedEmployees(selectedEmployees.filter(id => id !== emp.id));
                        else setSelectedEmployees([...selectedEmployees, emp.id]);
                      }}
                      className="w-6 h-6 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                    />
                  </div>

                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-blue-100 flex-shrink-0 border border-slate-100">
                    {emp.avatarUrl ? (
                      <img src={emp.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl font-black text-blue-600">
                        {emp.firstName?.substring(0, 1) || "?"}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-900 truncate uppercase">
                      {emp.firstName} {emp.lastName}
                    </p>
                    <div className="flex flex-col gap-0.5 mt-1">
                       <p className="text-[9px] font-bold text-blue-600 uppercase tracking-tight truncate italic">📍 {siteName}</p>
                       <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate">💼 {posName}</p>
                    </div>
                  </div>
                </label>
              );
            }) : (
              <div className="col-span-full py-32 text-center text-slate-300 italic uppercase font-black tracking-widest text-xs">
                ไม่พบข้อมูลพนักงาน
              </div>
            )}
          </div>
        </div>

        {/* --- 4. Sticky Footer --- */}
        <div className="p-8 bg-white border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.04)]">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={`px-8 py-3.5 rounded-full text-white text-xs font-black transition-all transform ${selectedEmployees.length > 0 ? 'bg-blue-600 scale-105 shadow-xl shadow-blue-200' : 'bg-slate-300'}`}>
                เลือกรายชื่อแล้ว {selectedEmployees.length} ท่าน
              </div>
            </div>
            
            <div className="flex gap-4 w-full sm:w-auto">
              <button 
                disabled={isProcessing}
                type="button"
                onClick={() => { setShowFilterModal(false); setSelectedEmployees([]); }} 
                className="flex-1 sm:px-12 py-5 bg-red-50 text-red-500 rounded-[1.5rem] font-black uppercase text-sm hover:bg-red-500 hover:text-white transition-all active:scale-95"
              >
                ยกเลิก
              </button>
              
              <button 
                disabled={isProcessing || selectedEmployees.length === 0}
                type="button"
                onClick={async () => {
                  setIsProcessing(true);
                  const finalData = (filteredAttendance || []).filter(a => {
                    const currentId = String(a.userId || a.user_id || "");
                    const isEmployeeSelected = selectedEmployees.some(id => String(id) === currentId);
                    const isInDateRange = a.date >= startDate && a.date <= endDate;
                    return isEmployeeSelected && isInDateRange;
                  });

                  if (finalData.length === 0) {
                    alert("⚠️ ไม่พบข้อมูลการลงเวลาของพนักงานที่เลือกในช่วงวันที่นี้");
                    setIsProcessing(false);
                    return;
                  }

                  setReportData(finalData);
                  await new Promise(res => setTimeout(res, 800));
                  setShowReport(true);
                  setShowFilterModal(false);
                  setIsProcessing(false);
                }}
                className={`flex-[2.5] sm:px-16 py-5 rounded-[1.5rem] font-black uppercase text-sm tracking-widest shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95 ${
                  selectedEmployees.length === 0 
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                    : 'bg-slate-900 text-white hover:bg-blue-600 hover:-translate-y-1'
                }`}
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>กำลังประมวลผล...</span>
                  </div>
                ) : (
                  "แสดงเอกสารก่อนดาวน์โหลด"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
)}
{/* --- 🖨️ MODAL: REPORT PREVIEW --- */}
{showReport && (
  <div className="fixed inset-0 bg-slate-900/95 flex items-start justify-center z-[600] p-4 overflow-y-auto custom-scrollbar font-sans">
    <div id="report-content" className="bg-white w-full max-w-[210mm] min-h-[297mm] rounded-[3rem] shadow-2xl flex flex-col p-12 print:p-0 print:m-0 relative">
      
      {/* Header Controller (ซ่อนเมื่อพิมพ์) */}
      <div className="flex justify-between items-center mb-10 print:hidden border-b border-slate-100 pb-6">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg ${exportFormat === 'excel' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
            {exportFormat === 'excel' ? "📗" : "📕"}
          </div>
          <div>
            <h2 className="font-black text-xl tracking-tighter text-slate-800 uppercase italic">
              {exportFormat === 'excel' ? "เอกสาร EXCEL" : "เอกสาร PDF"}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
              {exportFormat === 'excel' ? "ร่างข้อมูลสำหรับไฟล์ Excel" : "ร่างตัวอย่างเอกสารสำหรับไฟล์ PDF"} • {reportData.length} รายการ
            </p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={() => exportFormat === 'pdf' ? window.print() : handleDownloadExcel(reportData)} 
            className={`px-10 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl transition-all active:scale-95 text-white ${exportFormat === 'excel' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-900 hover:bg-blue-600'}`}
          >
            {exportFormat === 'pdf' ? "พิมพ์รายงาน / บันทึก PDF 🖨️" : "ยืนยันดาวน์โหลด EXCEL 📥"}
          </button>
          <button 
            onClick={() => {
              setShowReport(false);      // 1. ปิดหน้า Report Preview
              setShowFilterModal(true); // 2. เปิดหน้า Modal ตัวกรองขึ้นมาใหม่
            }} 
            className="bg-slate-100 hover:bg-red-50 hover:text-red-500 px-8 py-4 rounded-2xl font-black text-[10px] uppercase transition-all text-slate-400"
          >
            ย้อนกลับ
          </button>
        </div>
      </div>

      {/* เนื้อหาใบรายงาน - ส่วนหัว */}
      <div className="border-b-8 border-slate-900 pb-8 mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-slate-900 uppercase leading-none">{admin.company || "ชื่อบริษัท"}</h2>
          <p className="text-blue-600 font-black text-sm tracking-widest mt-3 uppercase italic">
            รายงานสรุปการลงเวลาทำงาน: {formattedStartDate} — {formattedEndDate}
          </p>
        </div>
        <div className="text-right text-[10px] font-bold text-slate-400 leading-relaxed uppercase italic">
          ออกรายงานเมื่อ: {reportDate} {reportTime}<br/>
          เลขที่อ้างอิง: {Math.random().toString(36).substring(2, 11).toUpperCase()}
        </div>
      </div>

      {/* ตารางข้อมูลรายงาน */}
      <div className={`overflow-hidden rounded-[2.5rem] border border-slate-200 shadow-sm ${exportFormat === 'excel' ? 'bg-slate-50/50' : 'bg-white'}`}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className={exportFormat === 'excel' ? "bg-emerald-700 text-white" : "bg-slate-900 text-white"}>
              <th className="p-5 font-black text-[10px] uppercase tracking-wider border-r border-white/10 w-32 text-center">วันที่</th>
              <th className="p-5 font-black text-[10px] uppercase tracking-wider border-r border-white/10">ข้อมูลพนักงาน</th>
              <th className="p-5 font-black text-[10px] uppercase tracking-wider text-center border-r border-white/10 w-28">เวลาเข้า</th>
              <th className="p-5 font-black text-[10px] uppercase tracking-wider text-center border-r border-white/10 w-28">เวลาออก</th>
              <th className="p-5 font-black text-[10px] uppercase tracking-wider text-right w-40">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 italic font-medium text-slate-700">
            {reportData.length > 0 ? reportData.map((a: any, i: number) => {
              const empInfo = initialEmployees?.find((e: any) => String(e.id) === String(a.userId || a.user_id));
              return (
                <tr key={i} className="hover:bg-white transition-colors page-break-inside-avoid">
                  <td className="p-5 font-bold text-slate-500 text-xs text-center border-r border-slate-100">{a.date}</td>
                  <td className="p-5 border-r border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0">
                        {a.avatarUrl || empInfo?.avatarUrl ? (
                          <img src={a.avatarUrl || empInfo?.avatarUrl} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-lg">?</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-black text-slate-900 text-sm uppercase truncate leading-none mb-1">
                          {a.employeeName || (empInfo ? `${empInfo.firstName} ${empInfo.lastName}` : "ไม่ทราบชื่อ")}
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter italic">
                          รหัส: {a.userId || a.user_id} | ไซต์งาน: {a.siteName || "ทั่วไป"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-5 text-center text-emerald-600 font-black text-sm border-r border-slate-100">{a.checkIn || "--:--"}</td>
                  <td className="p-5 text-center text-red-500 font-black text-sm border-r border-slate-100">{a.checkOut || "--:--"}</td>
                  <td className="p-5 text-right bg-slate-50/30">
                    <span className={`text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-tighter ${a.checkOut ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                      {a.checkOut ? 'เสร็จสมบูรณ์' : 'กำลังปฏิบัติงาน'}
                    </span>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={5} className="p-20 text-center font-bold text-slate-300 italic uppercase tracking-widest">ไม่พบข้อมูลการลงเวลา</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ส่วนท้ายรายงาน (Signature & Stamp) - ผลักลงด้านล่างสุด */}
      <div className="mt-auto pt-16 grid grid-cols-2 gap-20 px-10 pb-10">
        <div className="text-center">
          <div className="border-t-2 border-slate-200 pt-6">
            <p className="text-[11px] font-black text-slate-900 uppercase">(Jirakit Nuchsongsin)</p>
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest italic leading-none">ลายมือชื่อผู้มีอำนาจลงนาม</p>
            <p className="text-[10px] text-slate-800 mt-10 italic uppercase font-bold">วันที่: ____ / ____ / ____</p>
          </div>
        </div>
        <div className="flex items-center justify-center border-2 border-dashed border-slate-100 rounded-[2.5rem] h-32 relative">
          <span className="text-[10px] font-black text-slate-200 uppercase tracking-[0.4em] rotate-12 select-none">ตราประทับดิจิทัลทางการ</span>
        </div>
      </div>

      {/* Footer Print Only */}
      <div className="pt-8 text-center border-t border-slate-50 hidden print:block">
        <p className="text-[8px] text-slate-300 font-medium uppercase tracking-[0.5em]">รายงานนี้ได้รับการสร้างโดยระบบโดยอัตโนมัติ ไม่จำเป็นต้องใช้ลายมือชื่อหากมีการประทับตรา</p>
      </div>
    </div>
  </div>
)}

{/* --- CSS สำหรับพิมพ์ --- */}
<style dangerouslySetInnerHTML={{ __html: `
  @media print {
    @page { size: A4 portrait; margin: 0; }
    body { background: white !important; -webkit-print-color-adjust: exact; }
    .print\\:hidden { display: none !important; }
    #report-content { 
      box-shadow: none !important; 
      width: 210mm !important;
      height: 297mm !important;
      margin: 0 !important; 
      padding: 15mm !important;
      border-radius: 0 !important;
      position: relative !important;
      overflow: hidden !important;
    }
    .page-break-inside-avoid { page-break-inside: avoid; }
    .mt-auto { margin-top: auto !important; }
  }
` }} />

{/* --- 🖨️ MODAL: EDIT SITE & POSITION --- */}
{showManageModal && (
  <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[600] flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
        <h3 className="text-2xl font-black text-slate-900 uppercase italic flex items-center gap-3">
          <span className="bg-slate-900 text-white p-2 rounded-xl not-italic text-sm">⚙️</span>
          จัดการระบบ (ไซต์งาน & ตำแหน่ง)
        </h3>
        <button onClick={() => setShowManageModal(false)} className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all font-black">✕</button>
      </div>

      <div className="p-8 overflow-y-auto space-y-10 custom-scrollbar">
        {/* --- ตารางที่ 1: ไซต์งาน --- */}
        <section>
          <h4 className="text-sm font-black text-purple-600 mb-4 uppercase tracking-widest flex items-center gap-2">🏢 รายการไซต์งาน ({allSites.length})</h4>
          <div className="bg-slate-50 rounded-3xl overflow-hidden border border-slate-100">
            <table className="w-full text-left text-sm font-bold">
              <thead className="bg-slate-100 text-slate-400 text-[10px] uppercase">
                <tr>
                  <th className="p-4">ชื่อไซต์งาน</th>
                  <th className="p-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allSites.map(site => (
                  <tr key={site.id} className="hover:bg-white transition-colors group">
                    <td className="p-4 text-slate-700">{site.name}</td>
                    <td className="p-4 flex justify-center gap-2">
                      <button onClick={() => handleUpdateSite(site)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">📝</button>
                      <button onClick={() => handleDeleteSite(site.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* --- ตารางที่ 2: ตำแหน่ง --- --- */}
        <section>
          <h4 className="text-sm font-black text-pink-600 mb-4 uppercase tracking-widest flex items-center gap-2">💼 รายการตำแหน่ง ({positions.length})</h4>
          <div className="bg-slate-50 rounded-3xl overflow-hidden border border-slate-100">
            <table className="w-full text-left text-sm font-bold">
              <thead className="bg-slate-100 text-slate-400 text-[10px] uppercase">
                <tr>
                  <th className="p-4">ชื่อตำแหน่ง</th>
                  <th className="p-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {positions.map(pos => (
                  <tr key={pos.id} className="hover:bg-white transition-colors">
                    <td className="p-4 text-slate-700">{pos.name}</td>
                    <td className="p-4 flex justify-center gap-2">
                      <button onClick={() => handleEditPos(pos)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">📝</button>
                      <button onClick={() => handleDeletePos(pos.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  </div>
)}
{showCompanyModal && (
  <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-[600] p-4 backdrop-blur-md animate-in fade-in duration-300">
    <form 
      onSubmit={handleUpdateCompany} // ✅ เปลี่ยนมาเรียกใช้ฟังก์ชันบันทึกข้อมูล
      className="bg-white p-8 rounded-[3.5rem] w-full max-w-lg space-y-5 shadow-2xl"
    >
      <h2 className="font-black text-2xl text-slate-900 uppercase italic border-b pb-4">
        🏢 แก้ไขโปรไฟล์บริษัท
      </h2>

      <div className="space-y-4">
        {/* ส่วนอัปโหลดโลโก้บริษัท */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2">โลโก้บริษัท</label>
          <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200">
            <div className="w-20 h-20 rounded-2xl bg-white overflow-hidden flex-shrink-0 border shadow-sm relative">
              <img 
                src={companyLogoPreview || companyData?.logoUrl || "/logo.png"} 
                className="w-full h-full object-contain"
                alt="Company Logo"
              />
            </div>
            <div className="flex-1">
              <input 
                type="file" 
                name="companyLogo" 
                accept="image/*"
                onChange={(e) => {
                   const file = e.target.files?.[0];
                   if (file) {
                     setCompanyLogoPreview(URL.createObjectURL(file));
                   }
                }}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* ชื่อบริษัท */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2">ชื่อบริษัท (Company Name)</label>
          <input 
            name="companyName" 
            defaultValue={companyData?.name} 
            placeholder="ระบุชื่อบริษัท..."
            required 
            className="w-full p-4 bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl font-bold border outline-none transition-all" 
          />
        </div>

        {/* รายละเอียดบริษัท (Description) - เพิ่มใหม่ตามสั่ง */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2">รายละเอียดบริษัท (Description)</label>
          <input 
            name="description" 
            defaultValue={companyData?.description} 
            placeholder="ระบุรายละเอียดหรือสโลแกนบริษัท..."
            className="w-full p-4 bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl font-bold border outline-none transition-all" 
          />
        </div>

        {/* เบอร์โทรศัพท์ */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2">เบอร์โทรศัพท์</label>
          <input 
            name="phone" 
            defaultValue={companyData?.phone} 
            placeholder="02-XXX-XXXX"
            className="w-full p-4 bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl font-bold border outline-none transition-all" 
          />
        </div>

        {/* ที่อยู่ */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2">ที่อยู่บริษัท</label>
          <textarea 
            name="address" 
            defaultValue={companyData?.address} 
            placeholder="เลขที่อาคาร, ถนน, แขวง/ตำบล..."
            rows={2}
            className="w-full p-4 bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl font-bold border outline-none transition-all resize-none" 
          />
        </div>

        {/* --- เพิ่มช่องยืนยันรหัสผ่าน --- */}
        <div className="space-y-1 pt-2 border-t border-slate-100">
          <label className="text-[10px] font-slate-50 text-red-500 uppercase ml-2 flex justify-between">
            <span>ยืนยันรหัสผ่านเพื่อบันทึกการเปลี่ยนแปลง</span>
            <span className="text-slate-500 italic font-normal text-[9px] lowercase">*password required</span>
          </label>
          <div className="relative group">
            <input 
              type={showPass ? "text" : "password"}
              name="confirmPassword" 
              placeholder="กรุณากรอกรหัสผ่านของคุณ..."
              required 
              className="w-full p-4 bg-gray-300 text-white placeholder:text-slate-500 border-transparent focus:border-blue-500 rounded-2xl font-bold border outline-none transition-all pr-12" 
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors text-xs font-bold"
            >
              {showPass ? "ซ่อน" : "ดู"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t mt-4">
        <button 
          type="button" 
          onClick={() => {
            setShowCompanyModal(false);
            setShowPass(false); // Reset password visibility
          }}
          className="px-6 py-4 font-bold text-slate-400 uppercase text-xs hover:text-slate-600 transition-colors"
        >
          ยกเลิก
        </button>
        <button 
          type="submit" 
          disabled={isSavingCompany}
          className={`px-10 py-4 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all flex items-center gap-2 ${
            isSavingCompany ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isSavingCompany ? (
            <>
              <span className="animate-spin">⏳</span> 
              กำลังบันทึก...
            </>
          ) : (
            <>
              <span>💾</span> 
              อัปเดตข้อมูลบริษัท
            </>
          )}
        </button>
      </div>
    </form>
  </div>
)}
    </div>
  );
}