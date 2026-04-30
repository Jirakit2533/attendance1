"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import * as XLSX from "xlsx";
import { logoutAction } from "@/server/auth";
import {
  saveSiteAction,
  savePositionAction,
  createDepartmentAction,
  updateLeaveStatusAction,
  handleRemarkChangeAction,
  saveStaffAction,
  deleteStaffAction,
  deleteSiteAction, 
  deletePositionAction, 
  updateSiteAction, 
  updatePositionAction,
  updateAdminProfileAction,
  updateCompanyAction,
  updateDepartmentAction,
  resetStaffPasswordAction,
  deleteDepartmentAction,
  updateOvertimeStatusAction,
} from "./actions";

export const dynamic = "force-dynamic";

// --- SUB-COMPONENTS ---
const Section = ({ title, children }) => (
  <section className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
    <div className="flex items-center gap-4 mb-8">
      <div className="h-10 w-2 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full shadow-lg shadow-blue-200"></div>
      <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">
        {title}
      </h2>
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
    <p className="mt-4 text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] animate-pulse">
      กำลังดำเนินการ...
    </p>
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

interface OvertimeRequest {
  id: string;
  userId: string;
  userName: string;
  employeeName: string;
  avatarUrl: string | null;
  requestDate: string | null;
  workingDate: string | null;
  timeStart: string;
  timeEnd: string;
  totalHours: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  remark: string;
}

interface AdminClientPageProps {
  initialEmployees?: any[];
  initialAttendance?: any[];
  initialLeaves?: any[];
  admin?: { name: string; company: string; id: string };
  sites?: any[];
  positions?: any[];
  departments?: any[];
  initialCompanyData?: any;
  hasMultiSiteActive?: boolean;
  initialOvertimeRequests?: OvertimeRequest[];
  currentAdminId?: string;
}

export default function AdminClientPage({
  initialEmployees = [],
  initialAttendance = [],
  initialLeaves = [],
  admin = { name: "", company: "" },
  sites = [],
  positions = [],
  departments = [],
  initialCompanyData,
  hasMultiSiteActive,
  initialOvertimeRequests = [],
  currentAdminId,
}: AdminClientPageProps) {
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

  // State สำหรับ Company Profile 
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [companyLogoPreview, setCompanyLogoPreview] = useState<string | null>(
    null
  );

  const [activeTab, setActiveTab] = useState("employee");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [isAllSite, setIsAllSite] = useState(false);

  const [showAddSite, setShowAddSite] = useState(false);
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [showAddDepartment, setShowAddDepartment] = useState(false);
  const [editingDept, setEditingDept] = useState<any>(null);

  const [searchEmp, setSearchEmp] = useState("");
  const [searchAtt, setSearchAtt] = useState("");
  const [searchLeave, setSearchLeave] = useState("");
  const router = useRouter();

  const [showAdminEdit, setShowAdminEdit] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showOldPass, setShowOldPass] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);

  const [showManageModal, setShowManageModal] = useState(false);
  const [editingSite, setEditingSite] = useState<any>(null);
  const [editingPos, setEditingPos] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState("employee"); // ใช้ในหน้า Register เพื่อเช็คสิทธิ์ Leader

  //  1. [STATE] ข้อมูลพื้นฐานสำหรับ Report
  const [showFilterModal, setShowFilterModal] = useState(false); // เปิด/ปิดหน้าเลือกพนักงาน
  const [showReport, setShowReport] = useState(false); // เปิด/ปิดหน้าแสดงตัวอย่างรายงาน
  const [reportData, setReportData] = useState<any[]>([]); // ถังเก็บข้อมูลที่จะโชว์ในตารางรายงาน
  const [leaveData, setLeaveData] = useState<any[]>([]);

  const [overtimeReques, setOvertimeReques] = useState<OvertimeRequest[]>(
    initialOvertimeRequests
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [otRemarks, setOtRemarks] = useState<Record<string, string>>({});

  // [STATE] เงื่อนไขการกรอง (Filters) 
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [filterSite, setFilterSite] = useState(""); // กรองตามไซส์งาน
  const [filterDepartment, setFilterDepartment] = useState(""); // กรองตามแผนก
  const [filterPosition, setFilterPosition] = useState<string>(""); // เก็บ ID ของตำแหน่ง
  const [searchTerm, setSearchTerm] = useState(""); // ช่องค้นหาชื่อพนักงานใน Modal
  const [selectedEmployees, setSelectedEmployees] = useState<any[]>([]); // รายชื่อพนักงานที่ถูกติ๊กเลือก
  const [exportFormat, setExportFormat] = useState("excel"); // รูปแบบไฟล์ที่จะโหลด ('excel' | 'pdf')
  const [reportType, setReportType] = useState<"attendance" | "overtime">( "attendance" );

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // เริ่มต้นเป็น false (ปิดอยู่)

  // ตรวจสอบว่ารหัสผ่านตรงกันหรือไม่ (เฉพาะเมื่อมีการพิมพ์ทั้งสองช่อง)
  const isMismatch =
    newPassword !== "" &&
    confirmPassword !== "" &&
    newPassword !== confirmPassword;

  // --- 📝 3. [VARIABLES] ตัวแปรสำหรับแสดงผลบนหัวเอกสาร (ไม่ต้องใช้ State) ---
  const formattedStartDate = startDate
    ? new Date(startDate).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "-";
  const formattedEndDate = endDate
    ? new Date(endDate).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "-";
  const reportDate = new Date().toLocaleDateString("th-TH"); // วันที่พิมพ์
  const reportTime = new Date().toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  }); // เวลาที่พิมพ์

  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const companyData = initialCompanyData;

  const allSite = "";

  // --- 3. Component Logo ---
  // --- ส่วนฟังก์ชันจัดการการบันทึกข้อมูลบริษัท ---

  // --- ส่วน Component Logo ---
  const Logo = () => (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 md:gap-3 group">
        {/* ปรับขนาดโลโก้ให้เล็กลงในมือถือ (w-10) และขนาดปกติในจอใหญ่ (md:w-16) */}
        <div className="w-10 h-10 md:w-16 md:h-16 bg-slate-50 rounded-xl md:rounded-2xl flex items-center justify-center overflow-hidden shadow-lg border border-slate-100">
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
    return (employees || [])
      .map((emp) => {
        // ค้นหาข้อมูลจาก Master Data เพื่อเอาชื่อมาแสดง (แทนที่จะแสดง ID)
        const deptObj = allDepartments.find(
          (d) => String(d.id) === String(emp.departmentId)
        );
        const siteObj = allSites.find(
          (s) => String(s.id) === String(emp.siteId || emp.site_id)
        );
        const posObj = allPositions.find(
          (p) => String(p.id) === String(emp.positionId)
        );

        // แก้ปัญหา UserName เป็น UUID
        const isUuid = emp.userName && emp.userName.length > 30;
        const displayUserName = isUuid
          ? emp.firstName?.toLowerCase()
          : emp.userName || "user";

        return {
          ...emp,
          userName: displayUserName,
          departmentName: deptObj ? deptObj.name : emp.department || "ไม่ระบุ",
          siteName: siteObj ? siteObj.name : emp.site || "ไม่ระบุ",
          positionName: posObj ? posObj.name : emp.position || "ไม่ระบุ",
        };
      })
      .filter(
        (e) =>
          (e?.firstName?.toLowerCase() || "").includes(
            searchEmp?.toLowerCase() || ""
          ) ||
          (e?.lastName?.toLowerCase() || "").includes(
            searchEmp?.toLowerCase() || ""
          ) ||
          (e?.userName?.toLowerCase() || "").includes(
            searchEmp?.toLowerCase() || ""
          )
      );
  }, [employees, searchEmp, allDepartments, allSites, allPositions]);

  // 1. Filter การเข้างานหลัก (ตัวเดิมที่คุณมีอยู่แล้ว) - ต้องอยู่ด้านบน
  const filteredAttendance = useMemo(() => {
    if (!attendance) return [];

    return attendance
      .map((att) => {
        // หาข้อมูลพนักงานมาประกบ
        const empInfo = employees?.find(
          (e) => String(e.id) === String(att.userId || att.user_id)
        );

        return {
          ...att, // ดึงค่าเดิมมาให้หมด (สำคัญ! ห้ามหาย)
          // ปรับจูน Key ให้เป็นมาตรฐานเดียวกันเพื่อใช้ในตาราง
          id: att.id,
          date: att.date || "---",
          checkIn: att.checkIn || att.check_in || "--:--",
          checkOut: att.checkOut || att.check_out || "--:--",
          siteName: att.siteName || "General",
          avatarUrl: att.avatarUrl || empInfo?.avatarUrl || null,
          employeeName:
            att.employeeName ||
            (empInfo ? `${empInfo.firstName} ${empInfo.lastName}` : "Unknown"),
          userId: att.userId || att.user_id,
        };
      })
      .filter((a) => {
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
    return (leaves || [])
      .map((leave) => {
        const empInfo = employees.find(
          (e) => String(e.id) === String(leave.userId || leave.user_id)
        );
        return {
          ...leave,
          avatarUrl: leave.avatarUrl || empInfo?.avatarUrl || null,
          employeeName:
            leave.employeeName ||
            (empInfo
              ? `${empInfo.firstName} ${empInfo.lastName}`
              : "พนักงานเก่า"),
        };
      })
      .filter(
        (l) =>
          (l?.employeeName?.toLowerCase() || "").includes(
            searchLeave?.toLowerCase() || ""
          ) ||
          (l?.type?.toLowerCase() || "").includes(
            searchLeave?.toLowerCase() || ""
          )
      );
  }, [leaves, employees, searchLeave]);

  // 4. Filter สำหรับช่องค้นหาใน Report
  // --- 1. กรองรายชื่อพนักงานในหน้า Modal (Member Selection) ---
  const filteredEmpSuggestions = useMemo(() => {
    return (initialEmployees || []).filter((emp) => {
      // ❗ กัน null / undefined object หลุดเข้ามา
      if (!emp || typeof emp !== "object") return false;

      // normalize search
      const search = searchTerm?.toLowerCase() || "";

      // 1. ตรวจสอบชื่อ/รหัสพนักงาน (Search)
      const matchesSearch =
        !searchTerm ||
        emp.employeeName?.toLowerCase().includes(search) ||
        emp.userName?.toLowerCase().includes(search) ||
        emp.firstName?.toLowerCase().includes(search) ||
        emp.lastName?.toLowerCase().includes(search);

      // 2. ตรวจสอบแผนก (Department)
      const matchesDept =
        !filterDepartment ||
        filterDepartment === "" ||
        filterDepartment === "ทุกแผนก" ||
        emp.departmentName === filterDepartment ||
        String(emp.departmentId) === String(filterDepartment);

      // 3. ตรวจสอบตำแหน่ง (Position)
      const matchesPos =
        !filterPosition ||
        filterPosition === "" ||
        filterPosition === "ทุกตำแหน่ง" ||
        emp.positionName === filterPosition ||
        emp.position === filterPosition ||
        String(emp.positionId) === String(filterPosition);

      // 4. ตรวจสอบไซต์งาน (Site)
      const matchesSite =
        !filterSite ||
        filterSite === "" ||
        filterSite === "ทุกไซต์งาน" ||
        filterSite === "ทุกไซต์" ||
        filterSite === "ทั้งหมด (All Filter)" ||
        emp.siteName === filterSite ||
        String(emp.siteId) === String(filterSite);

      // ต้องผ่านทุกเงื่อนไขถึงจะแสดงผล
      return matchesSearch && matchesDept && matchesPos && matchesSite;
    });
  }, [
    searchTerm,
    filterDepartment,
    filterPosition,
    filterSite,
    initialEmployees,
  ]);
  const filteredPositions = useMemo(() => {
    if (!filterDepartment) return allPositions; // ถ้าไม่เลือกแผนก ให้โชว์ทุกตำแหน่ง
    return allPositions.filter(
      (pos: any) => String(pos.departmentId) === String(filterDepartment)
    );
  }, [filterDepartment, allPositions]);

  // --- 2. Logic สำหรับการกรองข้อมูลที่จะนำไปออก Report ---
  const filteredEmployeeIds = useMemo(() => {
    return initialEmployees
      .filter((emp: any) => {
        // กรองตาม ID ปัจจุบัน (Current ID)
        const matchesDept =
          !filterDepartment ||
          String(emp.departmentId) === String(filterDepartment);
        const matchesSite =
          !filterSite || String(emp.siteId) === String(filterSite);
        return matchesDept && matchesSite;
      })
      .map((emp: any) => emp.userId); // ส่งเฉพาะ ID ออกไปให้ API
  }, [initialEmployees, filterDepartment, filterSite]);

  // {compress image}
  const compressImage = (file: File) => {
    return new Promise((resolve, reject) => {
      if (!file) return reject("No file provided"); // ✅ ป้องกันกรณี file เป็น null/undefined

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 800;
          let width = img.width,
            height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");

          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.6));
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

  // 2. ฟังก์ชันอัปเดตสถานะ OT
  // ฟังก์ชันช่วยดึง Remark ปัจจุบัน (ดูจากที่พิมพ์ค้างไว้ หรือถ้าไม่มีให้ดูจาก Data เดิม)
  const handleOTRemarkChange = (id: string, value: string) => {
    setOtRemarks((prev) => ({ ...prev, [id]: value }));
  };

  const handleApproveOT = async (otId: string) => {
    if (!confirm("ยืนยันการอนุมัติ OT นี้ใช่หรือไม่?")) return;
    setIsUpdating(true);
    try {
      const remark = otRemarks[otId] || "";
      // 🚩 เพิ่ม currentAdminId เป็นตัวที่ 4 ตรงนี้
      const res = await updateOvertimeStatusAction(
        otId,
        "approved",
        remark,
        currentAdminId
      );

      if (res.success) {
        setOvertimeReques((prev) =>
          prev.map((item) =>
            item.id === otId
              ? {
                  ...item,
                  status: "approved",
                  remarks: remark,
                  approvedBy: currentAdminId,
                }
              : item
          )
        );
        router.refresh();
      } else {
        alert(res.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error("Debug Error:", error);
      alert("ระบบขัดข้อง กรุณาลองใหม่");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRejectOT = async (otId: string) => {
    if (!confirm("ยืนยันการปฏิเสธ OT นี้ใช่หรือไม่?")) return;
    setIsUpdating(true);
    try {
      const remark = otRemarks[otId] || "";
      // 🚩 เพิ่ม currentAdminId เป็นตัวที่ 4 ตรงนี้
      const res = await updateOvertimeStatusAction(
        otId,
        "rejected",
        remark,
        currentAdminId
      );

      if (res.success) {
        setOvertimeReques((prev) =>
          prev.map((item) =>
            item.id === otId
              ? {
                  ...item,
                  status: "rejected",
                  remarks: remark,
                  rejectedBy: currentAdminId,
                }
              : item
          )
        );
        router.refresh();
      } else {
        alert(res.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error("Debug Error:", error);
      alert("ระบบขัดข้อง กรุณาลองใหม่");
    } finally {
      setIsUpdating(false);
    }
  };
  // --- ฟังก์ชันสำหรับ Download Excel ---
  const handleDownloadExcel = async (data: any[]) => {
    try {
      const XLSX = await import("xlsx");

      // 1. เตรียมข้อมูลสำหรับ Worksheet
      const worksheetData = data.map((item) => {
        // ข้อมูลพื้นฐานที่มีทุกประเภทรายงาน
        const baseData = {
          วันที่: item.date || "-",
          รหัสพนักงาน: item.empCode || "-",
          ชื่อ: item.firstName || "-",
          นามสกุล: item.lastName || "-",
        };

        // ตรวจสอบว่าเป็นรายงาน OT หรือไม่ (เช็คจาก reportType หรือ generatedType)
        const isOTReport =
          reportType === "overtime" ||
          reportType === "ot" ||
          item.generatedType === "overtime";

        if (!isOTReport) {
          // ส่วนของรายงานการเข้างาน (Attendance)
          return {
            ...baseData,
            กะงาน: `${item.shiftStartTimeSnapshot?.substring(0, 5) || "00:00"} - ${item.shiftEndTimeSnapshot?.substring(0, 5) || "00:00"}`,
            จุดปฏิบัติงาน: item.siteSnapName || item.siteName || "-",
            เวลาเข้า: item.checkIn?.substring(0, 5) || "--:--",
            เวลาออก: item.checkOut?.substring(0, 5) || "--:--",
            สถานะ: item.statusText || (item.isLate ? "สาย" : "ปกติ"),
          };
        } else {
          // ส่วนของรายงานโอที (OT)
          const totalMinutes =
            Number(item.otHours) || Number(item.overtimeByRequest) || 0;
          const h = Math.floor(totalMinutes / 60);
          const m = totalMinutes % 60;

          return {
            ...baseData,
            "เริ่ม (Time)": item.timeStart?.substring(0, 5) || "-",
            "สิ้นสุด (Time)": item.timeEnd?.substring(0, 5) || "-",
            "จำนวนชั่วโมง (ชม.นาที)": `${h}.${m.toString().padStart(2, "0")}`,
            จำนวนนาทีสุทธิ: totalMinutes,
            "สถานะ/หมายเหตุ":
              item.otRemark || item.reason || item.otStatus || "-",
            ผู้อนุมัติ: item.approvedByName || "-",
          };
        }
      });

      // 2. สร้าง Workbook และ Worksheet
      const ws = XLSX.utils.json_to_sheet(worksheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

      // 3. กำหนดชื่อไฟล์
      const dateStr = new Date()
        .toLocaleDateString("th-TH", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
        .replace(/\//g, "-");

      const typeLabel =
        reportType === "attendance" ? "Attendance" : "OT_Report";
      const fileName = `Report_${typeLabel}_${dateStr}.xlsx`;

      // 4. เขียนไฟล์และดาวน์โหลด
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error("Excel Export Error:", error);
      alert("ไม่สามารถดาวน์โหลดไฟล์ Excel ได้ในขณะนี้");
    }
  };
  const resetOTStatus = async (otId: string) => {
    if (!confirm("ต้องการดึงรายการกลับมาเป็นรออนุมัติใช่หรือไม่?")) return;
    setIsUpdating(true);
    try {
      const res = await updateOvertimeStatusAction(otId, "pending", "");

      if (res.success) {
        setOvertimeReques((prev) =>
          prev.map((item) =>
            item.id === otId ? { ...item, status: "pending", remark: "" } : item
          )
        );
        router.refresh();
      } else {
        alert(res.error || "ไม่สามารถแก้ไขสถานะได้");
      }
    } catch (error) {
      console.error("Debug Error:", error);
      alert("ระบบขัดข้อง");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDirectReset = async (targetUserId: string) => {
    // 1. ถามเพื่อยืนยันป้องกันการกดพลาด
    if (!confirm("ยืนยันการรีเซ็ตรหัสผ่านเป็น '1234' ?")) return;

    try {
      setIsResetting(true);

      // 2. เรียก Server Action ที่เราสร้างไว้
      const result = await resetStaffPasswordAction(targetUserId);

      if (result.success) {
        alert("✅ " + result.message);
        // หากมีฟังก์ชันปิด Modal หรือล้างฟอร์ม สามารถใส่ตรงนี้ได้
      } else {
        alert("❌ " + result.error);
      }
    } catch (error) {
      alert("❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setIsResetting(false);
    }
  };

  const handleGenerateReport = async () => {
    // 1. ป้องกันการกดซ้ำ และตรวจสอบว่ามีการเลือกพนักงานหรือไม่
    if (isProcessing || selectedEmployees.length === 0) {
      alert("กรุณาเลือกรายชื่อพนักงานที่ต้องการสร้างรายงาน");
      return;
    }

    // ตรวจสอบว่ามีการเลือกประเภทรายงานหรือยัง
    if (!reportType) {
      alert("กรุณาเลือกประเภทรายงานที่ต้องการสร้าง");
      return;
    }

    setIsProcessing(true);

    try {
      // 2. เลือก Endpoint ตามประเภทรายงาน
      const endpoint =
        reportType === "attendance"
          ? "/api/attendance/generate-report"
          : "/api/overtime/generate-report";

      // 3. ยิง API ตัวหลักเพียงตัวเดียว (Attendance จะรวมข้อมูล Leave มาให้แล้ว)
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeIds: selectedEmployees,
          startDate: startDate,
          endDate: endDate,
          format: exportFormat,
          reportType: reportType,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // 4. normalize data กัน undefined + กัน type mismatch
        let finalData = Array.isArray(result.data)
          ? result.data.filter(Boolean)
          : [];

        // จัดการข้อมูลการลา (Leave Data) ที่แนบมากับ API Attendance
        const finalLeaveData =
          result.leaveData && Array.isArray(result.leaveData)
            ? result.leaveData.map((leave: any) => ({
                ...leave,
                // ประกันว่า key ชื่อผู้อนุมัติจะถูกส่งต่อไปยัง UI อย่างถูกต้อง
                approvedByName: leave.approvedByName ?? "ไม่ระบุผู้อนุมัติ",
              }))
            : [];

        if (reportType === "overtime") {
          finalData = finalData.map((item: any) => ({
            ...item,
            // ข้อมูลจาก Schema ใหม่ที่ส่งมาจาก API
            // 1. ใช้ชื่อผู้อนุมัติที่ Join มาจาก Aliased Table
            approvedByName: item.approvedByName ?? "System Admin",
            approvedBy: item.approvedBy ?? null,

            // 2. ใช้ค่าชั่วโมงที่อนุมัติจริง (otHours) จาก overtimeTable
            // หากไม่มีให้ Fallback ไปที่ค่าที่ Request (overtimeByRequest)
            otHours: item.otHours ?? item.overtimeByRequest ?? 0,

            // 3. ใช้สถานะจากตารางหลัก (otStatus) ที่เป็น 'approved'
            status: item.otStatus ?? item.status,

            // 4. ข้อมูลเพิ่มเติม
            reason: item.reason ?? "-",
            remarks: item.remarks ?? "-",
            timeStart: item.timeStart ?? "-",
            timeEnd: item.timeEnd ?? "-",
            date: item.date,
            userName: item.userName ?? `${item.firstName} ${item.lastName}`,
          }));

          // ถ้าเป็น OT Report ปกติจะไม่มีข้อมูลลาแยกมา แต่เราล้าง State Leave ไว้กันเหนื่อย
          setLeaveData([]);
        }

        if (reportType === "attendance") {
          finalData = finalData.map((item: any) => ({
            ...item,
            approvedBy: item.approvedBy ?? null,
            approvedByName: item.approvedByName ?? null,
          }));

          // เก็บข้อมูลการลาเข้า State เฉพาะเมื่อเป็นรายงานลงเวลา
          setLeaveData(finalLeaveData);
        }

        // เก็บข้อมูลหลักเข้า State
        setReportData(finalData);

        setShowReport(true);
        setShowFilterModal(false);
        setIsMobileFilterOpen(false);
      } else {
        alert(
          result.message ||
            `ไม่พบข้อมูล${reportType === "attendance" ? "การลงเวลา" : "การทำงานล่วงเวลา"}ในช่วงวันที่เลือก`
        );
      }
    } catch (error) {
      console.error("Generate Report Error:", error);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsProcessing(false);
    }
  };
  const handleUpdateCompany = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSavingCompany(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      // 1. กำหนดค่าเริ่มต้นเป็น URL เดิมจาก Database
      let finalLogoUrl = companyData?.logoUrl || null;

      // 2. ตรวจสอบการอัปโหลดไฟล์ใหม่ (อ้างอิง name="companyLogo" จาก input)
      const fileInput = (
        e.currentTarget.elements.namedItem("companyLogo") as HTMLInputElement
      )?.files?.[0];

      if (fileInput) {
        // บีบอัดไฟล์เป็น Base64 ก่อนส่งผ่านฟังก์ชันที่ประกาศไว้ด้านบน
        finalLogoUrl = (await compressImage(fileInput)) as string;
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

        if (typeof setShowAdminEdit === "function") {
          setShowAdminEdit(false);
        }

        if (typeof setPreviewImage === "function") {
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
     ฟังก์ชันจัดการ ไซต์งาน (Sites)
     ========================================================================== */

  const handleUpdateSite = (site: any) => {
    setEditingSite(site);
    const [latVal, lngVal] = (site.coordinates || ",").split(",");

    // 🚩 ปรับปรุง: ถ้ามีค่าพิกัด ให้ตัดเหลือ 6 หลักทันทีที่ดึงมาแสดงในหน้าแก้ไข
    const formattedLat = latVal ? parseFloat(latVal).toFixed(6) : "";
    const formattedLng = lngVal ? parseFloat(lngVal).toFixed(6) : "";

    setLat(formattedLat);
    setLng(formattedLng);

    setIsAllSite(site.name === "ทุกไซต์");

    setShowAddSite(true);
    setShowManageModal(false);
  };

  const handleDeleteSite = async (id: string) => {
    // 1. ถามยืนยันก่อนลบ
    const isConfirmed = confirm(
      "⚠️ ยืนยันการลบไซต์งานนี้?\nข้อมูลพนักงานที่ผูกอยู่กับไซต์นี้อาจได้รับผลกระทบ"
    );
    if (!isConfirmed) return;

    const prev = [...allSites];
    // 🚀 Optimistic Update: หายทันทีจากหน้าจอและการ์ด
    setAllSites(allSites.filter((s) => s.id !== id));

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
     ฟังก์ชันจัดการ ตำแหน่ง (Positions)
     ========================================================================== */

  /* --- เตรียมข้อมูลเพื่อแก้ไขตำแหน่ง --- */
  const handleEditPos = (pos: any) => {
    setEditingPos(pos); // เก็บข้อมูลตำแหน่งที่เลือก
    setShowAddPosition(true); // เปิด Modal อันเดิม
    setShowManageModal(false);
  };

  /* --- บันทึกการแก้ไขตำแหน่งไปยัง Server --- */
  const handleUpdatePosition = async (id: string, name: string) => {
    const prev = [...allPositions];
    // 🚀 Optimistic Update: เปลี่ยนชื่อทันทีในตาราง
    setAllPositions(
      allPositions.map((p) => (p.id === id ? { ...p, name } : p))
    );

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

  /* --- ลบตำแหน่งงาน --- */
  const handleDeletePos = async (id: string) => {
    const isConfirmed = confirm(
      "⚠️ ยืนยันการลบตำแหน่งงานนี้?\nพนักงานที่ใช้ตำแหน่งนี้อาจได้รับผลกระทบ"
    );
    if (!isConfirmed) return;

    const prev = [...allPositions];
    // 🚀 Optimistic Update: ลบออกจาก UI ทันที
    setAllPositions(allPositions.filter((p) => p.id !== id));

    try {
      const res = await deletePositionAction(id);
      if (res.success) {
        alert("✅ ลบตำแหน่งเรียบร้อยแล้ว");
      } else {
        alert("❌ ไม่สามารถลบได้: " + res.error);
        setAllPositions(prev);
      }
    } catch (error) {
      alert("❌ เกิดข้อผิดพลาดในการเชื่อมต่อ");
      setAllPositions(prev);
    }
  };

  // --- 2. จัดการแผนก (Departments) ---
  const handleEditDept = (dept: any) => {
    // 1. เก็บข้อมูลแผนกที่จะแก้ไขลง State
    setEditingDept(dept);

    // 2. ปิดหน้าจัดการระบบ (ManageModal) เพื่อให้เห็นฟอร์มแก้ไขชัดเจน
    setShowManageModal(false);

    // 3. เปิดฟอร์มแก้ไข (ใช้อันเดียวกับฟอร์มเพิ่ม)
    setShowAddDepartment(true);
  };

  const handleDeleteDept = async (deptId: string) => {
    if (!confirm("คุณแน่ใจใช่ไหมที่จะลบแผนกนี้?")) return;
    setIsProcessing(true);
    try {
      const result = await deleteDepartmentAction(deptId);

      if (result.success) {
        setAllDepartments((prev) => prev.filter((d) => d.id !== deptId));
        alert("✅ ลบแผนกเรียบร้อยแล้ว");
      } else {
        // ✅ ตรงนี้จะแสดงข้อความ "ติดต่อผู้ให้บริการ" ที่เราแก้ไว้ใน Action
        alert("❌ " + result.error);
      }
    } catch (error) {
      // ✅ ตรงนี้ก็ต้องแก้ให้เหมือนกัน เผื่อกรณี Error หลุดมาถึงตรงนี้
      alert("❌ ไม่สามารถลบแผนกได้ หากต้องการลบแผนกกรุณาติดต่อผู้ให้บริการ");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddDepartment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = formData.get("name") as string;

    if (!name) return;
    setIsProcessing(true);

    try {
      if (editingDept) {
        // 📝 กรณี: แก้ไขแผนก (Update)
        const result = await updateDepartmentAction({
          id: editingDept.id,
          name: name,
        });

        if (result.success) {
          // อัปเดตข้อมูลใน State ทันทีเพื่อให้หน้าจอเปลี่ยนตาม
          setAllDepartments((prev) =>
            prev.map((d) =>
              d.id === editingDept.id ? { ...d, name: name } : d
            )
          );
          alert(`✅ แก้ไขแผนกเป็น "${name}" เรียบร้อยแล้ว`);

          // ล้างค่าและปิด Modal
          setEditingDept(null);
          setShowAddDepartment(false);
        } else {
          alert(result.error || "ไม่สามารถอัปเดตแผนกได้");
        }
      } else {
        // ➕ กรณี: เพิ่มแผนกใหม่ (Create)
        const result = await createDepartmentAction(name);

        if (result.success) {
          form.reset();
          // ใช้ id ที่ส่งกลับมาจาก database (ถ้ามี) หรือใช้ id ชั่วคราว
          setAllDepartments((prev) => [
            ...prev,
            { id: result.id || crypto.randomUUID(), name: name },
          ]);
          setShowAddDepartment(false);
          alert(`✅ เพิ่มแผนก "${name}" เรียบร้อยแล้ว`);
        } else {
          alert(result.error || "ไม่สามารถบันทึกแผนกได้");
        }
      }
    } catch (error) {
      console.error("Department Error:", error);
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
        // 🚩 ปรับปรุง: ตัดทศนิยมเหลือ 6 ตำแหน่ง (มาตรฐาน 10-11 ซม.) ทันทีที่ดึงค่าได้
        // การใช้ toFixed จะคืนค่าเป็น String ซึ่งเหมาะกับ setLat/setLng ที่คุณใช้พอดี
        const formattedLat = position.coords.latitude.toFixed(6);
        const formattedLng = position.coords.longitude.toFixed(6);

        setLat(formattedLat);
        setLng(formattedLng);

        setIsProcessing(false); // โหลดเสร็จแล้ว
      },
      (error) => {
        // จัดการข้อผิดพลาดให้ละเอียดขึ้นเพื่อให้ User ทราบสาเหตุ
        let errorMsg = "ไม่สามารถดึงพิกัดได้";
        if (error.code === 1)
          errorMsg = "กรุณาอนุญาตสิทธิ์การเข้าถึงตำแหน่ง (Location Permission)";
        else if (error.code === 2)
          errorMsg = "ไม่สามารถระบุตำแหน่งได้ (สัญญาณ GPS อ่อน)";
        else if (error.code === 3)
          errorMsg = "การดึงพิกัดใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง";

        alert(errorMsg);
        setIsProcessing(false); // จบการโหลดแม้จะ Error
      },
      {
        enableHighAccuracy: true, // 🎯 สำคัญมาก: เพื่อให้ได้พิกัดจากดาวเทียมที่แม่นยำที่สุด
        timeout: 15000, // เพิ่มเวลาเป็น 15 วินาที เผื่อกรณีอยู่ในอาคารที่สัญญาณเข้าถึงยาก
        maximumAge: 0, // บังคับให้ดึงพิกัดใหม่เสมอ ไม่เอาค่าเก่าที่ค้างอยู่ใน Cache
      }
    );
  };
  const handleAddSite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const formData = new FormData(e.currentTarget);
      const isAllSiteChecked = formData.get("isAllSite") === "on";
      const siteNameValue = isAllSiteChecked
        ? "ทุกไซต์"
        : (formData.get("siteName") as string);

      // 🚩 ปรับปรุง: ตัดทศนิยมเหลือ 6 ตำแหน่งก่อนส่งออกไป Action
      // ตรวจสอบก่อนว่ามีค่า lat, lng หรือไม่ (ป้องกันกรณี String ว่าง)
      const cleanLat = lat ? parseFloat(lat).toFixed(6) : "";
      const cleanLng = lng ? parseFloat(lng).toFixed(6) : "";

      const siteData = {
        name: siteNameValue,
        address: isAllSiteChecked
          ? "ไม่ประจำไซต์"
          : (formData.get("address") as string),
        lat: isAllSiteChecked ? "" : cleanLat,
        lng: isAllSiteChecked ? "" : cleanLng,
      };

      let res;
      if (editingSite) {
        res = await updateSiteAction(editingSite.id, siteData);
      } else {
        res = await saveSiteAction(siteData);
      }

      if (res.success) {
        if (editingSite) {
          setAllSites((prev: any[]) =>
            prev.map((s) =>
              s.id === editingSite.id
                ? { ...s, ...siteData, coordinates: `${cleanLat},${cleanLng}` }
                : s
            )
          );
        } else {
          const newSite = {
            id: res.id || res.data?.id || crypto.randomUUID(),
            ...siteData,
            coordinates: `${cleanLat},${cleanLng}`, // เก็บรูปแบบเดียวกับ DB เพื่อความเสถียรของ UI
          };
          setAllSites((prev: any[]) => [...prev, newSite]);
        }

        setShowAddSite(false);
        setEditingSite(null);
        setLat("");
        setLng("");
        setIsAllSite(false);
        setShowManageModal(true);
      } else {
        alert(res.error || "เกิดข้อผิดพลาดในการบันทึก");
      }
    } catch (err) {
      console.error(err);
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
      // ตรวจสอบว่าเป็นการแก้ไข (editingPos มีค่า) หรือเพิ่มใหม่
      const result = await savePositionAction({
        name,
        id: editingPos?.id, // ส่ง ID ไปถ้าเป็นการแก้ไข เพื่อให้ Server ทราบ
      });

      if (result.success) {
        form.reset();

        if (editingPos) {
          // กรณีแก้ไข: Map เพื่ออัปเดตตัวที่ ID ตรงกัน
          setAllPositions((prev) =>
            prev.map((pos) =>
              pos.id === editingPos.id ? { ...pos, name: name } : pos
            )
          );
        } else {
          // กรณีเพิ่มใหม่: ใช้ Logic เดิมของคุณ
          setAllPositions((prev) => [
            ...prev,
            { id: result.id || crypto.randomUUID(), name: name },
          ]);
        }

        setEditingPos(null); // ล้างค่า editing state หลังจากทำงานเสร็จ
        setShowAddPosition(false);
        setShowManageModal(true);
        alert(
          `✅ ${
            editingPos ? "แก้ไข" : "เพิ่ม"
          }ตำแหน่งงาน "${name}" เรียบร้อยแล้ว`
        );
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
    setLeaveRemarks((prev) => ({ ...prev, [id]: value }));
  };

  const updateLeaveStatus = async (id, status) => {
    // ปรับข้อความ Confirm ให้เป็นภาษาไทยที่อ่านง่าย
    const actionText =
      status === "approved"
        ? "อนุมัติ"
        : status === "rejected"
          ? "ปฏิเสธ"
          : "ดึงกลับมาเป็นรอนุมัติ";
    if (!confirm(`ยืนยันการ "${actionText}" คำขอลานี้?`)) return;

    setIsProcessing(true);
    try {
      // ดึงค่า remark จาก state ตาม id
      const remark = leaveRemarks[id] || "";

      // ✅ เรียก Action ส่ง id, status และ remark ไปบันทึก
      const result = await updateLeaveStatusAction(id, status, remark);

      if (result.success) {
        // 1. อัปเดต State ในหน้าจอทันทีเพื่อให้ UI ลื่นไหล (รวมถึงอัปเดต remark ในแถวด้วย)
        setLeaves((prev) =>
          prev.map((l) =>
            l.id === id
              ? {
                  ...l,
                  status,
                  remark: status !== "pending" ? remark || l.remark : l.remark,
                }
              : l
          )
        );

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
    if (!confirm("⚠️ ยืนยันการลบข้อมูลพนักงาน? ข้อมูลจะถูกย้ายไปที่ถังขยะ"))
      return;
    setIsProcessing(true);
    try {
      const result = await deleteStaffAction(id);
      if (result.success) {
        setEmployees((prev) => prev.filter((e) => e.id !== id));
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
      if (avatarFile && avatarFile.size > 0)
        finalAvatarUrl = await compressImage(avatarFile);

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
          ? passwordToSave
            ? { password: passwordToSave, oldPassword: oldPassword }
            : {}
          : { password: passwordToSave }),
        role: data.role,
        avatarUrl: finalAvatarUrl,
        positionId: data.positionId,
        siteId:
          siteInput === "all_sites" || siteInput === "" ? null : siteInput,
        departmentId: data.departmentId,
        // ✅ ข้อมูลเวลาทำงาน (คงเดิม)
        startTime: data.startTime,
        endTime: data.endTime,
      };

      const result = await saveStaffAction(payload);
      if (result.success) {
        alert(
          editingEmployee
            ? "✏️ แก้ไขข้อมูลพนักงานเรียบร้อย"
            : "👤 ลงทะเบียนพนักงานใหม่เรียบร้อย"
        );
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
    if (!confirm("ยืนยันการออกจากระบบแอดมิน?")) return;
    setIsProcessing(true);
    try {
      const cookiesToClear = [
        "session_user_id",
        "user_role",
        "role",
        "session",
      ];
      cookiesToClear.forEach((name) => {
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
                  <span className="text-lg md:text-2xl text-slate-500 group-hover:text-slate-900 transition-colors">
                    ☰
                  </span>
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
        <div
          className={`fixed inset-0 z-[1000] print:hidden transition-all duration-300 ${
            isSidebarOpen ? "visible" : "invisible"
          }`}
        >
          {/* Background Overlay */}
          <div
            className={`absolute inset-0 bg-slate-900/40 backdrop-blur-[3px] transition-opacity duration-300 ${
              isSidebarOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => setIsSidebarOpen(false)}
          />

          {/* Sidebar Panel - Animation Slide */}
          <aside
            className={`absolute left-0 top-0 h-full w-full max-w-[300px] md:max-w-[340px] bg-white shadow-2xl flex flex-col transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) transform ${
              isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {/* Sidebar Header - ปรับการจัดวางเป็น justify-between */}
            <div className="p-5 md:p-7 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-5">
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center bg-slate-900 rounded-xl md:rounded-2xl text-white hover:bg-slate-800 transition-all active:scale-90 shadow-xl"
                >
                  <span className="text-xl md:text-2xl">☰</span>
                </button>
                <h2 className="font-black text-slate-900 uppercase italic tracking-tighter text-lg md:text-xl">
                  Admin Menu
                </h2>
              </div>

              {/* ✅ ปุ่มแก้ไขข้อมูลบริษัท - อยู่ฝั่งขวาของ Header */}
              <button
                onClick={() => {
                  setShowCompanyModal(true);
                  setIsSidebarOpen(false);
                }}
                className="flex flex-col items-center gap-0.5 group active:scale-90 transition-all"
              >
                <span className="text-xl md:text-2xl group-hover:rotate-45 transition-transform duration-300">
                  ⚙️
                </span>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter group-hover:text-blue-600">
                  แก้ไขข้อมูลบริษัท
                </span>
              </button>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto px-6 md:px-7 pt-10 pb-8 flex flex-col justify-start space-y-8 md:space-y-12">
              {/* 👤 Profile Section */}
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-6 md:mb-8">
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-[2.5rem] md:rounded-[3rem] bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 flex items-center justify-center text-white font-black shadow-2xl border-4 border-white overflow-hidden">
                    {isUploading && (
                      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-10 flex items-center justify-center animate-spin">
                        ⏳
                      </div>
                    )}
                    {admin?.avatarUrl ? (
                      <img
                        src={admin.avatarUrl}
                        alt="profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl md:text-4xl uppercase italic tracking-tighter">
                        {admin?.name?.substring(0, 2)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 md:space-y-3 mb-6 md:mb-8">
                  <span className="px-4 py-1 bg-slate-900 text-white text-[9px] md:text-[10px] font-black rounded-full uppercase tracking-[0.25em] inline-block shadow-md">
                    {admin?.role || "Admin"}
                  </span>
                  <h3 className="font-black text-slate-900 text-xl md:text-2xl leading-tight tracking-tight">
                    {admin?.name || "ไม่พบชื่อผู้ใช้งาน"}
                  </h3>
                  <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-[0.15em]">
                    🏢 {admin?.company || "General Admin"}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowAdminEdit(true);
                    setIsSidebarOpen(false);
                  }}
                  className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 bg-blue-50/50 py-3 md:py-4 px-6 md:px-8 rounded-2xl hover:bg-blue-600 hover:text-white transition-all w-full border border-blue-100 shadow-sm active:scale-[0.98]"
                >
                  👤 แก้ไขโปรไฟล์แอดมิน
                </button>
              </div>

              <hr className="border-slate-100 mt-8 md:mt-12 mb-2" />

              {/* 🕹️ Navigation Actions */}
              <div className="space-y-4 md:space-y-5">
                <p className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">
                  จัดการโครงสร้าง
                </p>
                <div className="grid grid-cols-1 gap-3 md:gap-3.5">
                  <button
                    onClick={() => {
                      setShowAddSite(true);
                      setIsSidebarOpen(false);
                    }}
                    className="flex items-center gap-4 md:gap-5 p-4 md:p-5 bg-emerald-50/40 hover:bg-emerald-50 rounded-[1.2rem] md:rounded-[1.5rem] border border-emerald-100/50 transition-all group active:scale-[0.97]"
                  >
                    <span className="text-xl md:text-2xl group-hover:scale-125 transition-transform">
                      📍
                    </span>
                    <span className="text-[11px] md:text-xs font-black text-emerald-900 uppercase tracking-tighter">
                      เพิ่มไซต์ไซต์งาน
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setShowAddPosition(true);
                      setIsSidebarOpen(false);
                    }}
                    className="flex items-center gap-4 md:gap-5 p-4 md:p-5 bg-amber-50/40 hover:bg-amber-50 rounded-[1.2rem] md:rounded-[1.5rem] border border-amber-100/50 transition-all group active:scale-[0.97]"
                  >
                    <span className="text-xl md:text-2xl group-hover:scale-125 transition-transform">
                      💼
                    </span>
                    <span className="text-[11px] md:text-xs font-black text-amber-900 uppercase tracking-tighter">
                      เพิ่มตำแหน่งพนักงาน
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setShowAddDepartment(true);
                      setIsSidebarOpen(false);
                    }}
                    className="flex items-center gap-4 md:gap-5 p-4 md:p-5 bg-indigo-50/40 hover:bg-indigo-50 rounded-[1.2rem] md:rounded-[1.5rem] border border-indigo-100/50 transition-all group active:scale-[0.97]"
                  >
                    <span className="text-xl md:text-2xl group-hover:scale-125 transition-transform">
                      🏢
                    </span>
                    <span className="text-[11px] md:text-xs font-black text-indigo-900 uppercase tracking-tighter">
                      เพิ่มแผนก
                    </span>
                  </button>
                </div>
              </div>

              {/* 📊 Main Actions */}
              <div className="space-y-4 md:space-y-5 pt-2">
                <p className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">
                  เมนูหลัก
                </p>
                <div className="space-y-3 md:space-y-4">
                  <button
                    onClick={() => {
                      setShowRegister(true);
                      setIsSidebarOpen(false);
                    }}
                    className="w-full h-14 md:h-16 bg-slate-900 text-white rounded-[1.2rem] md:rounded-[1.5rem] font-black text-[11px] md:text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 md:gap-4 shadow-2xl hover:bg-slate-800 active:scale-95 transition-all"
                  >
                    <span className="text-xl md:text-2xl">+</span>{" "}
                    ลงทะเบียนพนักงาน
                  </button>

                  <button
                    onClick={() => {
                      setShowFilterModal(true);
                      setIsSidebarOpen(false);
                    }}
                    className="w-full h-14 md:h-16 bg-blue-600 text-white rounded-[1.2rem] md:rounded-[1.5rem] font-black text-[11px] md:text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 md:gap-4 shadow-2xl hover:bg-blue-500 active:scale-95 transition-all"
                  >
                    <span className="text-xl md:text-2xl">📊</span>{" "}
                    เรียกดูรายงาน
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar Footer */}
            <div className="p-8 md:p-10 border-t border-slate-100 bg-slate-50/30 text-center shrink-0">
              <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] opacity-50 italic">
                Gemini HR System v1.0
              </p>
            </div>
          </aside>
        </div>
      </>
      <main className="max-w-7xl mx-auto px-6 pt-12">
        {/* --- STATS CARDS --- */}
        <div className="justify-center grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 print:hidden">
          {[
            {
              label: "พนักงานทั้งหมด",
              val: employees.length,
              unit: "คน",
              icon: "👥",
              color: "blue",
            },
            {
              label: "ลงชื่อวันนี้",
              // ✅ กรองข้อมูลจาก attendanceTable โดยเทียบคอลัมน์ date กับวันที่ปัจจุบัน (YYYY-MM-DD)
              val: attendance.filter((a) => {
                const today = new Date().toLocaleDateString("en-CA"); // ได้รูปแบบ 'YYYY-MM-DD' ตามมาตรฐาน SQL Date
                return a.date === today;
              }).length,
              unit: "รายการ",
              icon: "📍",
              color: "emerald",
            },
            {
              label: "คำขอลางาน",
              val: leaves.filter((l) => l.status === "pending").length,
              unit: "รอนุมัติ",
              icon: "📝",
            },
          ].map((s, i) => (
            /* --- การ์ดปกติ 1-3: ปรับเป็นแนวนอนในมือถือ (flex-row) และแนวตั้งในจอใหญ่ (md:flex-col) --- */
            <div
              key={i}
              className="bg-white p-6 md:p-8 rounded-4xl md:rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-row md:flex-col items-center md:items-start gap-5 md:gap-0"
            >
              <div className="flex justify-between items-start md:mb-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform ${
                    s.color === "blue"
                      ? "bg-blue-50 text-blue-600"
                      : s.color === "emerald"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-orange-50 text-orange-600"
                  }`}
                >
                  {s.icon}
                </div>
              </div>
              <div className="space-y-1 flex-1 md:flex-none">
                <div className="flex items-baseline gap-2 md:block">
                  <p className="text-3xl md:text-4xl font-black text-slate-900">
                    {s.val}
                  </p>
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest md:hidden">
                    Live Data
                  </span>
                </div>
                <p className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-tighter">
                  {s.label}{" "}
                  <span className="text-[10px] md:text-xs opacity-50">
                    ({s.unit})
                  </span>
                </p>
              </div>
              <span className="hidden md:block text-[10px] font-black text-slate-300 uppercase tracking-widest pt-2">
                Live Data
              </span>
            </div>
          ))}

          {/* ✅ การ์ดที่ 4: ปรับขนาด Padding และความสูงให้พอดีกับอุปกรณ์เคลื่อนที่ */}
          <div
            onClick={() => setShowManageModal(true)}
            className="relative bg-white rounded-4xl md:rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden group flex flex-col h-full min-h-[220px] md:min-h-0"
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

            {/* ส่วนที่ 1: ไซต์งาน */}
            <div className="flex-1 p-4 md:p-5 flex items-center gap-4 hover:bg-purple-50/50 transition-colors border-b border-slate-50 pt-12 md:pt-10">
              <div className="w-10 h-10 md:w-11 md:h-11 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-lg md:text-xl group-hover:scale-110 transition-transform">
                🏢
              </div>
              <div>
                <p className="text-xl md:text-2xl font-black text-slate-900 leading-none">
                  {allSites.length}
                </p>
                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  ไซต์งานทั้งหมด
                </p>
              </div>
            </div>

            {/* ส่วนที่ 2: แผนก (เพิ่มใหม่) */}
            <div className="flex-1 p-4 md:p-5 flex items-center gap-4 hover:bg-blue-50/50 transition-colors border-b border-slate-50">
              <div className="w-10 h-10 md:w-11 md:h-11 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-lg md:text-xl group-hover:scale-110 transition-transform">
                📊
              </div>
              <div>
                <p className="text-xl md:text-2xl font-black text-slate-900 leading-none">
                  {allDepartments.length}
                </p>
                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  แผนกทั้งหมด
                </p>
              </div>
            </div>

            {/* ส่วนที่ 3: ตำแหน่ง */}
            <div className="flex-1 p-4 md:p-5 flex items-center gap-4 hover:bg-pink-50/50 transition-colors">
              <div className="w-10 h-10 md:w-11 md:h-11 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center text-lg md:text-xl group-hover:scale-110 transition-transform">
                💼
              </div>
              <div>
                <p className="text-xl md:text-2xl font-black text-slate-900 leading-none">
                  {positions.length}
                </p>
                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  ตำแหน่งทั้งหมด
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* --- Tab Navigator --- */}
        <div className="flex items-center gap-1 md:gap-2 bg-slate-100/50 p-1 md:p-1.5 rounded-full md:rounded-4xl w-full sm:w-fit mb-6 md:mb-8 border border-slate-200/60 backdrop-blur-sm print:hidden overflow-x-auto no-scrollbar">
          {[
            { id: "employee", label: "จัดการข้อมูลพนักงาน", icon: "👤" },
            { id: "attendance", label: "ตารางเข้า-ออกงาน", icon: "🕒" },
            { id: "leave", label: "คำขอลาพนักงาน", icon: "📝" },
            { id: "overtime", label: "คำขอ OT พนักงาน", icon: "⌛" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative flex items-center justify-center gap-2 px-3 py-2 md:px-6 md:py-2.5 rounded-full md:rounded-[1.5rem] text-xs md:text-sm font-bold transition-all duration-300 flex-1 sm:flex-none whitespace-nowrap
                ${
                  activeTab === tab.id
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50 scale-[1.02]"
                    : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                }
              `}
            >
              <span className="relative z-10 text-base md:text-sm">
                {tab.icon}
              </span>
              <span className="relative z-10 hidden sm:inline-block">
                {tab.label}
              </span>
              {/* แสดง Label แบบย่อบน Mobile เฉพาะ Tab ที่เลือก (Optional) */}
              {activeTab === tab.id && (
                <span className="relative z-10 inline-block sm:hidden text-[10px]">
                  {tab.label.split(" ")[0]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* --- ส่วนแสดงเนื้อหาตาม Tab ที่เลือก --- */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* --- Tab: จัดการข้อมูลพนักงาน --- */}
          {activeTab === "employee" && (
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
                    onChange={(e) => {
                      setSearchEmp(e.target.value);
                      setCurrentPage(1); // รีเซ็ตไปหน้าแรกเมื่อค้นหา
                    }}
                  />
                </div>

                {/* --- Mobile & Tablet Card View (5 Items Per Page) --- */}
                <div className="lg:hidden">
                  <div className="grid grid-cols-1 gap-4 mb-6">
                    {filteredEmployees.length > 0 ? (
                      filteredEmployees
                        .slice((currentPage - 1) * 5, currentPage * 5) // จำกัด 5 รายการต่อหน้า
                        .map((e) => (
                          <div
                            key={e.id}
                            className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm relative"
                          >
                            <div className="flex items-start gap-4 mb-4">
                              <div className="w-16 h-16 relative rounded-[1.5rem] overflow-hidden border-2 border-slate-50 shadow-sm bg-slate-100 flex-shrink-0">
                                <Image
                                  src={
                                    e.avatarUrl &&
                                    typeof e.avatarUrl === "string" &&
                                    e.avatarUrl.trim() !== ""
                                      ? e.avatarUrl
                                      : "https://utfs.io/f/default-avatar-placeholder.png"
                                  }
                                  alt="profile"
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-black text-gray-800 text-base truncate">
                                  {e.firstName} {e.lastName}
                                </div>
                                <div className="text-blue-500 font-mono text-xs truncate">
                                  @{e.userName || e.id}
                                </div>
                                <div className="mt-1">
                                  <span
                                    className={`inline-block font-black text-[9px] uppercase px-2 py-0.5 rounded-md ${
                                      e.role === "leader"
                                        ? "bg-blue-600 text-white"
                                        : "bg-slate-100 text-slate-400"
                                    }`}
                                  >
                                    {e.role === "leader"
                                      ? "หัวหน้า"
                                      : "พนักงาน"}
                                  </span>
                                </div>
                              </div>
                              <div className="relative group">
                                <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-50 transition-colors">
                                  <span className="text-gray-400 text-lg">
                                    ⋮
                                  </span>
                                </button>
                                <div className="absolute right-0 top-8 w-32 bg-white border border-slate-100 rounded-2xl shadow-xl z-30 hidden group-hover:block group-focus-within:block transition-all">
                                  <div className="p-2 flex flex-col gap-1">
                                    <button
                                      onClick={() => handleEditEmployee(e)}
                                      className="flex items-center gap-2 w-full px-3 py-2 text-xs font-bold text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                                    >
                                      <span>✏️</span> แก้ไข
                                    </button>
                                    <button
                                      onClick={() => handleDeleteEmployee(e.id)}
                                      className="flex items-center gap-2 w-full px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                    >
                                      <span>{isProcessing ? "⏳" : "🗑️"}</span>{" "}
                                      ลบข้อมูล
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                  แผนก
                                </span>
                                <span className="text-xs font-bold text-slate-600 truncate">
                                  {e.departmentName || "ไม่ระบุ"}
                                </span>
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                  ตำแหน่ง
                                </span>
                                <span className="text-xs font-bold text-blue-600 truncate">
                                  {e.position || "พนักงาน"}
                                </span>
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                  ไซต์งาน
                                </span>
                                <span className="text-xs font-bold text-purple-600 truncate">
                                  {!e.site || e.site === "ไม่ระบุ"
                                    ? "ทุกไซต์"
                                    : e.site}
                                </span>
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                  รอบเข้างาน
                                </span>
                                <span className="text-xs font-bold text-slate-800">
                                  {e.startTime && e.endTime
                                    ? `${e.startTime.slice(
                                        0,
                                        5
                                      )} - ${e.endTime.slice(0, 5)}`
                                    : "ยังไม่ระบุ"}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="py-10 text-center text-slate-400 italic font-black bg-white rounded-4xl border border-slate-100">
                        ไม่พบข้อมูลพนักงาน...
                      </div>
                    )}
                  </div>

                  {/* --- Pagination Controls for Mobile --- */}
                  {filteredEmployees.length > 5 && (
                    <div className="flex justify-center items-center gap-2 mt-8 mb-12">
                      {/* ปุ่มย้อนกลับ */}
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((prev) => prev - 1)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all font-bold"
                      >
                        {"<"}
                      </button>

                      {/* รายการตัวเลขหน้า (Logic ใหม่: ป้องกันตัวเลขยาวเหยียด) */}
                      <div className="flex gap-1">
                        {(() => {
                          const totalPages = Math.ceil(
                            filteredEmployees.length / 5
                          );
                          const pages = [];
                          const range = 1; // จำนวนหน้าที่จะโชว์ข้างๆ หน้าปัจจุบัน

                          for (let i = 1; i <= totalPages; i++) {
                            // เงื่อนไขการโชว์เลขหน้า: หน้าแรก, หน้าสุดท้าย, หน้าปัจจุบัน, และหน้ารอบข้างหน้าปัจจุบัน
                            if (
                              i === 1 ||
                              i === totalPages ||
                              (i >= currentPage - range &&
                                i <= currentPage + range)
                            ) {
                              pages.push(
                                <button
                                  key={i}
                                  onClick={() => setCurrentPage(i)}
                                  className={`w-10 h-10 rounded-xl font-black text-sm transition-all ${
                                    currentPage === i
                                      ? "bg-blue-600 text-white shadow-lg shadow-blue-100 scale-110"
                                      : "bg-white text-slate-400 border border-slate-100 hover:border-blue-200"
                                  }`}
                                >
                                  {i}
                                </button>
                              );
                            } else if (
                              i === currentPage - range - 1 ||
                              i === currentPage + range + 1
                            ) {
                              // แสดงจุดไข่ปลา (...)
                              pages.push(
                                <span
                                  key={i}
                                  className="w-10 h-10 flex items-center justify-center text-slate-400 font-bold"
                                >
                                  ...
                                </span>
                              );
                            }
                          }
                          return pages;
                        })()}
                      </div>

                      {/* ปุ่มไปข้างหน้า */}
                      <button
                        disabled={
                          currentPage ===
                          Math.ceil(filteredEmployees.length / 5)
                        }
                        onClick={() => setCurrentPage((prev) => prev + 1)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all font-bold"
                      >
                        {">"}
                      </button>
                    </div>
                  )}
                </div>

                {/* --- Desktop Table View (แสดงทั้งหมดพร้อม Scroll) --- */}
                <div className="hidden lg:block rounded-4xl border border-slate-100 overflow-hidden bg-white shadow-sm">
                  <div className="overflow-x-auto max-h-[580px] overflow-y-auto custom-scrollbar">
                    <table className="min-w-[1000px] w-full text-sm border-separate border-spacing-0">
                      <thead className="sticky top-0 z-20 bg-white">
                        <tr className="text-gray-400 font-bold uppercase text-[11px] tracking-widest border-b border-gray-100">
                          <th className="py-5 px-6 text-left w-20 bg-white border-b border-gray-100">
                            รูป
                          </th>
                          <th className="py-5 px-6 text-left bg-white border-b border-gray-100">
                            พนักงาน
                          </th>
                          <th className="py-5 px-6 text-left bg-white border-b border-gray-100">
                            แผนก
                          </th>
                          <th className="py-5 px-6 text-left bg-white border-b border-gray-100">
                            รอบเข้างาน
                          </th>
                          <th className="py-5 px-6 text-left bg-white border-b border-gray-100">
                            ไซต์งาน
                          </th>
                          <th className="py-5 px-6 text-left bg-white border-b border-gray-100">
                            ตำแหน่ง
                          </th>
                          <th className="py-5 px-6 text-left bg-white border-b border-gray-100">
                            ระดับสิทธิ์
                          </th>
                          <th className="py-5 px-6 text-center bg-white border-b border-gray-100">
                            จัดการ
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredEmployees.length > 0 ? (
                          filteredEmployees.map((e) => (
                            <tr
                              key={e.id}
                              className="group hover:bg-blue-50/40 transition-colors"
                            >
                              <td className="py-4 px-6">
                                <div className="w-12 h-12 relative rounded-2xl overflow-hidden border-2 border-white shadow-sm bg-slate-100">
                                  <Image
                                    src={
                                      e.avatarUrl &&
                                      typeof e.avatarUrl === "string" &&
                                      e.avatarUrl.trim() !== ""
                                        ? e.avatarUrl
                                        : "https://utfs.io/f/default-avatar-placeholder.png"
                                    }
                                    alt="profile"
                                    fill
                                    className="object-cover"
                                    unoptimized
                                  />
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                <div className="font-black text-gray-800">
                                  {e.firstName} {e.lastName}
                                </div>
                                <div className="text-blue-500 font-mono text-[11px]">
                                  @{e.userName || e.id}
                                </div>
                              </td>
                              <td className="py-4 px-6 font-bold text-gray-600">
                                {e.departmentName || "ไม่ระบุแผนก"}
                              </td>
                              <td className="py-4 px-6 font-bold text-gray-600">
                                <div className="flex flex-col">
                                  {e.startTime && e.endTime ? (
                                    <span className="text-[15px] text-black-600">
                                      {e.startTime.slice(0, 5)} -{" "}
                                      {e.endTime.slice(0, 5)}
                                    </span>
                                  ) : (
                                    <span className="text-[13px] text-slate-400 font-medium italic">
                                      ยังไม่ได้ระบุ
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full font-bold text-[11px] uppercase tracking-wider">
                                  {!e.site || e.site === "ไม่ระบุ"
                                    ? "ทุกไซต์"
                                    : e.site}
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full font-bold text-[11px] uppercase tracking-wider">
                                  {e.position || "พนักงาน"}
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                <span
                                  className={`font-black text-[10px] uppercase px-3 py-1 rounded-lg ${
                                    e.role === "leader"
                                      ? "bg-blue-600 text-white"
                                      : "bg-slate-100 text-slate-400"
                                  }`}
                                >
                                  {e.role === "leader" ? "หัวหน้า" : "พนักงาน"}
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                <div className="flex justify-center gap-2">
                                  <button
                                    onClick={() => handleEditEmployee(e)}
                                    disabled={isProcessing}
                                    className="w-10 h-10 flex items-center justify-center bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-all"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => handleDeleteEmployee(e.id)}
                                    disabled={isProcessing}
                                    className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"
                                  >
                                    {isProcessing ? "⏳" : "🗑️"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={8}
                              className="py-24 text-center text-slate-400 italic font-black"
                            >
                              ไม่พบข้อมูลพนักงาน...
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Section>
            </div>
          )}
          {/* --- Tab: ตารางเข้า-ออกงาน --- */}
          {activeTab === "attendance" && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                <span className="w-2 h-8 bg-emerald-500 rounded-full"></span>
                ตารางเข้า-ออกงานของพนักงาน
              </h2>

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

              <div className="rounded-4xl border border-slate-100 overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto max-h-[650px] overflow-y-auto custom-scrollbar">
                  <table className="min-w-[1800px] w-full text-sm border-separate border-spacing-0">
                    <thead className="sticky top-0 z-30 bg-white">
                      <tr className="text-gray-400 font-bold uppercase text-[11px] tracking-widest">
                        <th className="py-5 px-6 text-left w-20 bg-slate-50/50 border-b border-slate-100">
                          รูป
                        </th>
                        <th className="py-5 px-6 text-left bg-slate-50/50 border-b border-slate-100">
                          พนักงาน
                        </th>
                        <th className="py-5 px-6 text-left bg-slate-50/50 border-b border-slate-100">
                          วันที่
                        </th>
                        <th className="py-5 px-6 text-left bg-slate-50/50 border-b border-slate-100">
                          ไซต์งาน
                        </th>
                        <th className="py-5 px-6 text-left bg-slate-50/50 border-b border-slate-100">
                          รอบงาน
                        </th>
                        <th className="py-5 px-6 text-center bg-slate-50/50 border-b border-slate-100">
                          สถานะเข้า
                        </th>
                        <th className="py-5 px-6 text-center bg-slate-50/50 border-b border-slate-100">
                          สถานะออก
                        </th>
                        <th className="py-5 px-6 text-center bg-slate-50/50 border-b border-slate-100 text-emerald-600">
                          เวลาเข้า
                        </th>
                        <th className="py-5 px-6 text-center bg-slate-50/50 border-b border-slate-100 text-rose-600">
                          เวลาออก
                        </th>
                        <th className="py-5 px-6 text-center bg-slate-50/50 border-b border-slate-100">
                          รูปเข้า
                        </th>
                        <th className="py-5 px-6 text-center bg-slate-50/50 border-b border-slate-100">
                          รูปออก
                        </th>
                        <th className="py-5 px-6 text-center bg-slate-50/50 border-b border-slate-100">
                          พิกัดเข้า
                        </th>
                        <th className="py-5 px-6 text-center bg-slate-50/50 border-b border-slate-100">
                          พิกัดออก
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredAttendance.length > 0 ? (
                        filteredAttendance.map((a, index) => {
                          // Logic สำหรับแสดงตัวคั่นวันที่ (เหมือน Line)
                          const currentDate = a.date
                            ? new Date(a.date).toLocaleDateString("th-TH", {
                                day: "2-digit",
                                month: "long",
                                year: "numeric",
                              })
                            : "";
                          const prevDate =
                            index > 0 && filteredAttendance[index - 1].date
                              ? new Date(
                                  filteredAttendance[index - 1].date
                                ).toLocaleDateString("th-TH", {
                                  day: "2-digit",
                                  month: "long",
                                  year: "numeric",
                                })
                              : null;
                          const showDivider = currentDate !== prevDate;

                          return (
                            <React.Fragment key={index}>
                              {showDivider && (
                                <tr className="sticky top-[61px] z-20">
                                  <td
                                    colSpan={13}
                                    className="bg-slate-100/90 backdrop-blur-md py-3 px-6"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-[12px] font-black text-slate-500 uppercase tracking-tighter bg-white px-3 py-1 rounded-full shadow-sm">
                                        📅 {currentDate}
                                      </span>
                                      <div className="h-[1px] flex-grow bg-slate-200"></div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                              <tr className="group hover:bg-blue-50/30 transition-colors">
                                <td className="py-4 px-6">
                                  <div className="w-12 h-12 relative rounded-2xl overflow-hidden border-2 border-white shadow-sm bg-slate-100 group-hover:scale-105 transition-transform">
                                    <Image
                                      src={
                                        a.avatarUrl ||
                                        "https://utfs.io/f/default-avatar-placeholder.png"
                                      }
                                      alt="profile"
                                      fill
                                      className="object-cover"
                                    />
                                  </div>
                                </td>
                                <td className="py-4 px-6">
                                  <div className="font-black text-slate-800 text-base">
                                    {a.employeeName || "ไม่ระบุชื่อ"}
                                  </div>
                                  <div className="text-blue-500 font-bold text-[11px]">
                                    @{a.userName || "user"}
                                  </div>
                                </td>
                                <td className="py-4 px-6 font-bold text-slate-500 italic">
                                  {a.date
                                    ? new Date(a.date).toLocaleDateString(
                                        "th-TH",
                                        {
                                          day: "2-digit",
                                          month: "short",
                                          year: "2-digit",
                                        }
                                      )
                                    : "-"}
                                </td>
                                <td className="py-4 px-6">
                                  <div className="font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg inline-block">
                                    {a.siteSnapName || "ไม่ระบุไซต์"}
                                  </div>
                                </td>
                                <td className="py-4 px-6 font-bold text-slate-600">
                                  <div className="flex flex-col">
                                    {a.startTime && a.endTime ? (
                                      <span className="text-[14px] bg-white border border-slate-100 px-2 py-1 rounded shadow-sm w-fit">
                                        {a.startTime.slice(0, 5)} -{" "}
                                        {a.endTime.slice(0, 5)}
                                      </span>
                                    ) : (
                                      "-"
                                    )}
                                  </div>
                                </td>
                                <td className="p-6 text-center">
                                  {a.isLate === 1 ? (
                                    <span className="text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-100 font-black text-xs shadow-sm inline-flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>{" "}
                                      สาย
                                    </span>
                                  ) : (
                                    <span className="text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100 font-black text-xs shadow-sm">
                                      ✅ ปกติ
                                    </span>
                                  )}
                                </td>
                                <td className="p-6 text-center">
                                  {a.isEarlyExit === "1" ? (
                                    <span className="text-amber-600 bg-amber-50 px-3 py-2 rounded-xl border border-amber-100 font-black text-xs shadow-sm">
                                      ⚠️ ออกก่อน
                                    </span>
                                  ) : a.isEarlyExit === "0" ? (
                                    <span className="text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100 font-black text-xs shadow-sm">
                                      ✅ ปกติ
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>
                                <td className="py-4 px-6 text-center font-black text-emerald-600 text-lg">
                                  {a.checkIn
                                    ? a.checkIn.split(":").slice(0, 2).join(":")
                                    : "-"}
                                </td>
                                <td className="py-4 px-6 text-center font-black text-rose-600 text-lg">
                                  {a.checkOut
                                    ? a.checkOut
                                        .split(":")
                                        .slice(0, 2)
                                        .join(":")
                                    : "-"}
                                </td>
                                <td className="py-4 px-6">
                                  <div className="flex justify-center">
                                    {a.imageIn ? (
                                      <a
                                        href={a.checkInPhoto || a.imageIn}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-11 h-11 relative rounded-xl overflow-hidden border-2 border-white shadow-md cursor-pointer active:scale-95 transition-all hover:ring-2 hover:ring-blue-400 block"
                                      >
                                        <Image
                                          src={a.imageIn}
                                          alt="In"
                                          fill
                                          className="object-cover"
                                          unoptimized={true}
                                        />
                                      </a>
                                    ) : (
                                      <span className="text-slate-300 italic text-[10px]">
                                        N/A
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-4 px-6">
                                  <div className="flex justify-center">
                                    {a.imageOut ? (
                                      <a
                                        href={a.checkOutPhoto || a.imageOut}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-11 h-11 relative rounded-xl overflow-hidden border-2 border-white shadow-md cursor-pointer active:scale-95 transition-all hover:ring-2 hover:ring-blue-400 block"
                                      >
                                        <Image
                                          src={a.imageOut}
                                          alt="Out"
                                          fill
                                          className="object-cover"
                                          unoptimized={true}
                                        />
                                      </a>
                                    ) : (
                                      <span className="text-slate-300 italic text-[10px]">
                                        N/A
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-4 px-6 text-center">
                                  {a.locationIn ? (
                                    <a
                                      href={`https://www.google.com/maps?q=${a.locationIn}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[11px] bg-slate-900 text-white px-3 py-2 rounded-xl font-black hover:bg-blue-600 transition-all inline-flex items-center gap-1 shadow-sm"
                                    >
                                      📍 MAP IN
                                    </a>
                                  ) : (
                                    <span className="text-slate-300 text-[10px]">
                                      ไม่มีข้อมูล
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 px-6 text-center">
                                  {a.locationOut ? (
                                    <a
                                      href={`https://www.google.com/maps?q=${a.locationOut}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[11px] bg-slate-400 text-white px-3 py-2 rounded-xl font-black hover:bg-rose-600 transition-all inline-flex items-center gap-1 shadow-sm"
                                    >
                                      📍 MAP OUT
                                    </a>
                                  ) : (
                                    <span className="text-slate-300 text-[10px]">
                                      ไม่มีข้อมูล
                                    </span>
                                  )}
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={13} className="py-32 text-center">
                            <div className="flex flex-col items-center justify-center gap-3">
                              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-4xl animate-bounce">
                                📅
                              </div>
                              <p className="text-slate-400 font-black text-xl tracking-tight">
                                ไม่พบข้อมูลการลงเวลาในขณะนี้
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
          {/* --- Tab: คำขอลาพนักงาน --- */}
          {activeTab === "leave" && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3 px-4 md:px-0">
                <span className="w-2 h-8 bg-amber-500 rounded-full"></span>
                คำขอลาพนักงาน
              </h2>

              {/* Search Bar */}
              <div className="mb-6 relative max-w-md px-4 md:px-0">
                <div className="absolute inset-y-0 left-4 md:left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-gray-400">🔍</span>
                </div>
                <input
                  type="text"
                  placeholder="ค้นชื่อพนักงาน หรือ ประเภทลา..."
                  className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-100 bg-slate-50 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  value={searchLeave}
                  onChange={(e) => {
                    setSearchLeave(e.target.value);
                    setCurrentPage(1); // Reset หน้าเมื่อมีการค้นหา
                  }}
                />
              </div>

              {/* Logic สำหรับ Pagination */}
              {(() => {
                const indexOfLastItem = currentPage * itemsPerPage;
                const indexOfFirstItem = indexOfLastItem - itemsPerPage;
                const currentItems = filteredLeaves.slice(
                  indexOfFirstItem,
                  indexOfLastItem
                );
                const totalPages = Math.ceil(
                  filteredLeaves.length / itemsPerPage
                );

                return (
                  <>
                    {/* --- Desktop Table View --- */}
                    <div className="hidden lg:block rounded-4xl border border-slate-100 overflow-hidden bg-white shadow-sm">
                      <div className="overflow-x-auto max-h-[580px] overflow-y-auto custom-scrollbar">
                        <table className="min-w-[1400px] w-full text-sm border-separate border-spacing-0">
                          <thead className="sticky top-0 z-20 bg-white">
                            <tr className="text-gray-400 font-bold uppercase text-[11px] tracking-widest border-b border-gray-100">
                              <th className="py-5 px-6 text-left w-20 bg-white border-b border-gray-100">
                                รูป
                              </th>
                              <th className="py-5 px-6 text-left bg-white border-b border-gray-100">
                                พนักงาน
                              </th>
                              <th className="py-5 px-6 text-center bg-white border-b border-gray-100">
                                วันที่ขอ
                              </th>
                              <th className="py-5 px-6 text-center bg-white border-b border-gray-100">
                                วันที่/ประเภท
                              </th>
                              <th className="py-5 px-6 text-center bg-white border-b border-gray-100">
                                จำนวนวัน/ชั่วโมง
                              </th>
                              <th className="py-5 px-6 text-left bg-white border-b border-gray-100">
                                เหตุผล
                              </th>
                              <th className="py-5 px-6 text-center bg-white border-b border-gray-100">
                                เอกสาร
                              </th>
                              <th className="py-5 px-6 text-center bg-white border-b border-gray-100">
                                สถานะ
                              </th>
                              <th className="py-5 px-6 text-center bg-white border-b border-gray-100">
                                จัดการคำขอ
                              </th>
                              <th className="py-5 px-6 text-center bg-white border-b border-gray-100">
                                หมายเหตุ
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {currentItems.length > 0 ? (
                              currentItems.map((l) => {
                                const start = new Date(l.startDate);
                                const end = new Date(l.endDate);
                                const diffTime = Math.abs(
                                  end.getTime() - start.getTime()
                                );
                                const diffDays =
                                  Math.ceil(diffTime / (1000 * 60 * 60 * 24)) +
                                  1;

                                return (
                                  <tr
                                    key={l.id}
                                    className="group hover:bg-blue-50/40 transition-colors"
                                  >
                                    <td className="py-4 px-6">
                                      <div className="w-12 h-12 relative rounded-2xl overflow-hidden border-2 border-white shadow-sm bg-slate-100">
                                        <Image
                                          src={
                                            l.avatarUrl ||
                                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                              l.employeeName || "User"
                                            )}&background=random`
                                          }
                                          alt="profile"
                                          fill
                                          className="object-cover"
                                        />
                                      </div>
                                    </td>
                                    <td className="py-4 px-6">
                                      <div className="font-black text-gray-800 text-base">
                                        {l.employeeName || "ไม่ระบุชื่อ"}
                                      </div>
                                      <div className="text-blue-500 font-mono text-[11px] font-bold">
                                        @{l.userName || "user"}
                                      </div>
                                    </td>
                                    <td className="py-4 px-6 text-center font-bold text-blue-600">
                                      {l.createdAt
                                        ? new Date(l.createdAt).toLocaleString(
                                            "th-TH"
                                          )
                                        : "-"}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <div className="flex flex-col items-center gap-1.5">
                                        {/* ประเภทการลา: เน้นให้เด่นขึ้นด้วยพื้นหลังอ่อนๆ */}
                                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[12px] font-semibold">
                                          {l.type}
                                        </span>

                                        {/* ช่วงวันที่: ใช้สีเทาเข้มขึ้นเพื่อให้ตัดกับพื้นหลังขาว และจัดเรียงแนวนอนพร้อม Icon เล็กๆ (ถ้ามี) */}
                                        <div className="flex-row gap-1 items-center text-[13px] text-gray-600 font-medium">
                                          <span>
                                            {new Date(
                                              l.startDate
                                            ).toLocaleDateString("th-TH", {
                                              day: "2-digit",
                                              month: "short",
                                              year: "2-digit",
                                            })}
                                          </span>
                                          <span className="text-gray-400">
                                            -
                                          </span>
                                          <span>
                                            {new Date(
                                              l.endDate
                                            ).toLocaleDateString("th-TH", {
                                              day: "2-digit",
                                              month: "short",
                                              year: "2-digit",
                                            })}
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-4 px-2 text-center">
                                      <div className="flex flex-col items-center gap-1">
                                        <div className="flex justify-center">
                                          {(() => {
                                            const hrs =
                                              Number(l.totalHours) || 0;
                                            const isHalfDay =
                                              hrs === 4 || hrs === 4.5;
                                            const isDayUnit = hrs >= 24;

                                            // ปรับคลาสให้เป็นระเบียบ: ใช้ min-w-[80px] แทนการอัด px เยอะๆ
                                            const baseClass =
                                              "min-w-[85px] py-1.5 rounded-lg font-black text-[10px] sm:text-[11px] border uppercase tracking-wider inline-block text-center shadow-sm";

                                            if (isHalfDay) {
                                              return (
                                                <span
                                                  className={`${baseClass} bg-purple-50 text-purple-600 border-purple-100`}
                                                >
                                                  ครึ่งวัน
                                                </span>
                                              );
                                            }

                                            return (
                                              <span
                                                className={`${baseClass} ${
                                                  isDayUnit
                                                    ? "bg-orange-50 text-orange-600 border-orange-100"
                                                    : "bg-blue-50 text-blue-600 border-blue-100"
                                                }`}
                                              >
                                                {isDayUnit
                                                  ? `${(hrs / 24).toFixed(1).replace(".0", "")}\u00A0วัน`
                                                  : (() => {
                                                      const fullHours =
                                                        Math.floor(hrs);
                                                      const minutes =
                                                        Math.round(
                                                          (hrs - fullHours) * 60
                                                        );
                                                      return `${fullHours}.${minutes.toString().padStart(2, "0")}\u00A0ชม.`;
                                                    })()}
                                              </span>
                                            );
                                          })()}
                                        </div>

                                        {/* แสดงเวลา Start - End ไว้ข้างใต้ปุ่ม และเช็คค่าว่าง */}
                                        {l.startTime && l.endTime && (
                                          <span className="text-[9px] text-slate-400 font-bold tracking-tighter tabular-nums leading-none">
                                            {l.startTime.slice(0, 5)} -{" "}
                                            {l.endTime.slice(0, 5)}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-4 px-6 text-gray-600 italic text-xs max-w-[200px] truncate">
                                      "{l.reason || "ไม่มีระบุเหตุผล"}"
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                      <div className="flex justify-center">
                                        {l?.fileUrl?.trim() ? (
                                          <a
                                            href={l.fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="relative w-10 h-10 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all block"
                                          >
                                            <Image
                                              src={l.fileUrl}
                                              alt="doc"
                                              fill
                                              className="object-cover"
                                              unoptimized={true}
                                            />
                                          </a>
                                        ) : (
                                          <span className="text-slate-400 text-sm font-bold">
                                            -
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-4 px-2 text-center">
                                      <div className="flex justify-center">
                                        <span
                                          className={`min-w-[90px] py-1.5 rounded-full text-[10px] font-black uppercase shadow-sm border text-center tracking-tight ${
                                            l.status === "pending"
                                              ? "bg-orange-50 text-orange-600 border-orange-200"
                                              : l.status === "approved"
                                                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                                                : "bg-red-50 text-red-600 border-red-200"
                                          }`}
                                        >
                                          {l.status === "pending"
                                            ? "รออนุมัติ"
                                            : l.status === "approved"
                                              ? "อนุมัติแล้ว"
                                              : "ปฏิเสธ"}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-4 px-6">
                                      <div className="flex justify-center gap-2">
                                        {l.status === "pending" ? (
                                          <>
                                            <button
                                              onClick={() =>
                                                updateLeaveStatus(
                                                  l.id,
                                                  "approved"
                                                )
                                              }
                                              className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:scale-105 active:scale-95 transition-all shadow-md shadow-emerald-100"
                                            >
                                              อนุมัติ
                                            </button>
                                            <button
                                              onClick={() =>
                                                updateLeaveStatus(
                                                  l.id,
                                                  "rejected"
                                                )
                                              }
                                              className="bg-white border border-red-200 text-red-500 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-50 active:scale-95 transition-all"
                                            >
                                              ปฏิเสธ
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            onClick={() =>
                                              updateLeaveStatus(l.id, "pending")
                                            }
                                            className="flex items-center gap-1 bg-slate-50 text-slate-600 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-100 active:scale-95 transition-all"
                                          >
                                            ✏️ แก้ไข
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-4 px-6">
                                      <div className="relative flex items-center gap-2 min-w-[200px]">
                                        <input
                                          type="text"
                                          placeholder="ระบุหมายเหตุ..."
                                          className={`border rounded-xl px-3 py-2 text-xs w-full transition-all outline-none ${
                                            l.status !== "pending"
                                              ? "bg-slate-50 text-slate-500 border-slate-100"
                                              : "bg-white border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                                          }`}
                                          value={
                                            l.status === "pending"
                                              ? (leaveRemarks[l.id] ??
                                                l.remark ??
                                                "")
                                              : (l.remark ?? "-")
                                          }
                                          onChange={(e) =>
                                            handleRemarkChange(
                                              l.id,
                                              e.target.value
                                            )
                                          }
                                          readOnly={l.status !== "pending"}
                                        />
                                        {l.status !== "pending" && l.remark && (
                                          <button
                                            onClick={() =>
                                              setViewRemarkId(
                                                viewRemarkId === l.id
                                                  ? null
                                                  : l.id
                                              )
                                            }
                                            className={`p-2 rounded-lg border transition-all ${
                                              viewRemarkId === l.id
                                                ? "bg-blue-600 text-white border-blue-600"
                                                : "bg-blue-50 text-blue-600 border-blue-100"
                                            }`}
                                          >
                                            🔍
                                          </button>
                                        )}
                                        {viewRemarkId === l.id && (
                                          <div className="absolute right-0 bottom-full mb-3 z-50 w-64 bg-white border border-slate-100 rounded-2xl shadow-2xl p-4 animate-in fade-in zoom-in duration-200">
                                            <p className="text-xs text-slate-600 leading-relaxed font-bold">
                                              {l.remark}
                                            </p>
                                            <div className="absolute -bottom-1.5 right-3 w-3 h-3 bg-white border-r border-b border-slate-100 rotate-45"></div>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td
                                  colSpan={10}
                                  className="py-24 text-center text-slate-400 italic font-black"
                                >
                                  ไม่พบคำขอลางานในขณะนี้...
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* --- Mobile Card View --- */}
                    <div className="lg:hidden grid grid-cols-1 gap-4 px-4 pb-20">
                      {currentItems.length > 0 ? (
                        currentItems.map((l) => {
                          const start = new Date(l.startDate);
                          const end = new Date(l.endDate);

                          // 1. ดึงค่าตรงๆ จาก Object 'l'
                          const hrs = Number(l.totalHours) || 0;

                          // 2. เช็คเงื่อนไขตาม Logic
                          const isHalfDay = hrs === 4 || hrs === 4.5;
                          const isDayUnit = hrs >= 24;

                          // 3. เตรียมตัวแปรสำหรับแสดงผลใน Paragraph
                          let durationLabel = "";
                          if (isHalfDay) {
                            durationLabel = "ครึ่งวัน";
                          } else if (isDayUnit) {
                            // 24 ชม. = 1 วัน
                            const dayCalc = (hrs / 24)
                              .toFixed(1)
                              .replace(".0", "");
                            durationLabel = `${dayCalc} วัน`;
                          } else {
                            // แก้ไขส่วนนี้ให้แสดงผลเป็น ชั่วโมง.นาที
                            const fullHours = Math.floor(hrs);
                            const minutes = Math.round((hrs - fullHours) * 60);
                            durationLabel = `${fullHours}.${minutes.toString().padStart(2, "0")} ชั่วโมง`;
                          }

                          return (
                            <div
                              key={l.id}
                              className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden text-left"
                            >
                              <div
                                className={`absolute top-0 right-12 px-4 py-1 rounded-b-xl text-[9px] font-black uppercase ${
                                  l.status === "pending"
                                    ? "bg-orange-100 text-orange-600"
                                    : l.status === "approved"
                                      ? "bg-emerald-100 text-emerald-600"
                                      : "bg-red-100 text-red-600"
                                }`}
                              >
                                {l.status === "pending"
                                  ? "รออนุมัติ"
                                  : l.status === "approved"
                                    ? "อนุมัติแล้ว"
                                    : "ปฏิเสธ"}
                              </div>

                              <div className="absolute top-4 right-4">
                                <button
                                  onClick={() =>
                                    setViewRemarkId(
                                      viewRemarkId === l.id ? null : l.id
                                    )
                                  }
                                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-50 transition-colors text-slate-400 text-xl"
                                >
                                  ⋮
                                </button>
                                {viewRemarkId === l.id && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-40"
                                      onClick={() => setViewRemarkId(null)}
                                    />
                                    <div className="absolute right-0 top-12 z-50 w-64 bg-white border border-slate-100 rounded-3xl shadow-2xl p-4 animate-in fade-in zoom-in duration-200">
                                      <p className="text-[10px] font-black text-slate-400 uppercase mb-3 px-1 text-left">
                                        จัดการคำขอ / หมายเหตุ
                                      </p>
                                      <textarea
                                        placeholder="ระบุหมายเหตุที่นี่..."
                                        className="w-full h-24 p-3 rounded-2xl border border-slate-100 bg-slate-50 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none mb-3 resize-none text-left"
                                        value={
                                          leaveRemarks[l.id] ?? l.remark ?? ""
                                        }
                                        onChange={(e) =>
                                          handleRemarkChange(
                                            l.id,
                                            e.target.value
                                          )
                                        }
                                      />
                                      <div className="grid grid-cols-2 gap-2">
                                        <button
                                          onClick={() => {
                                            updateLeaveStatus(l.id, "approved");
                                            setViewRemarkId(null);
                                          }}
                                          className="py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black"
                                        >
                                          อนุมัติ
                                        </button>
                                        <button
                                          onClick={() => {
                                            updateLeaveStatus(l.id, "rejected");
                                            setViewRemarkId(null);
                                          }}
                                          className="py-2.5 bg-red-500 text-white rounded-xl text-xs font-black"
                                        >
                                          ปฏิเสธ
                                        </button>
                                      </div>
                                      {l.status !== "pending" && (
                                        <button
                                          onClick={() => {
                                            updateLeaveStatus(l.id, "pending");
                                            setViewRemarkId(null);
                                          }}
                                          className="w-full mt-2 py-2 text-slate-500 text-[10px] font-bold border border-dashed border-slate-200 rounded-xl text-center"
                                        >
                                          ย้อนเป็นรออนุมัติ
                                        </button>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>

                              <div className="flex items-start gap-4 mb-4">
                                <div className="w-14 h-14 relative rounded-2xl overflow-hidden border-2 border-slate-50 bg-slate-50 shadow-sm flex-shrink-0">
                                  <Image
                                    src={
                                      l.avatarUrl ||
                                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                        l.employeeName || "User"
                                      )}&background=random`
                                    }
                                    alt="profile"
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-black text-slate-800 text-lg leading-none truncate">
                                    {l.employeeName || "ไม่ระบุชื่อ"}
                                  </h3>
                                  <p className="text-blue-500 font-mono text-xs font-bold mt-1 truncate">
                                    @{l.userName || "user"}
                                  </p>
                                  <div className="mt-1 font-bold text-blue-600 text-xs uppercase">
                                    {l.type}
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-slate-50 p-3 rounded-2xl">
                                  <p className="text-[10px] text-slate-400 font-black uppercase mb-1">
                                    ระยะเวลา
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <p
                                      className={`
                                        px-3 py-1 rounded-lg font-black text-[11px] border uppercase tracking-wider w-fit shadow-sm
                                            ${
                                              isHalfDay
                                                ? "bg-purple-50 text-purple-600 border-purple-100"
                                                : isDayUnit
                                                  ? "bg-orange-50 text-orange-600 border-orange-100"
                                                  : "bg-blue-50 text-blue-600 border-blue-100"
                                            }
                                          `}
                                    >
                                      {durationLabel}
                                    </p>

                                    {l.startTime && l.endTime && (
                                      <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded-md">
                                        <span className="text-[10px] text-slate-600 font-black tracking-tight">
                                          {l.startTime.slice(0, 5)} -{" "}
                                          {l.endTime.slice(0, 5)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="bg-orange-50 p-3 rounded-2xl text-center">
                                  <p className="text-[10px] text-orange-400 font-black uppercase mb-1">
                                    วันที่ลา
                                  </p>
                                  <p className="text-[10px] font-bold text-orange-600 leading-tight">
                                    {new Date(l.startDate).toLocaleDateString(
                                      "th-TH"
                                    )}{" "}
                                    -{" "}
                                    {new Date(l.endDate).toLocaleDateString(
                                      "th-TH"
                                    )}
                                  </p>
                                </div>
                              </div>

                              <div className="mb-4 text-left">
                                <p className="text-[10px] text-slate-400 font-black uppercase mb-1 px-1">
                                  เหตุผลการลา
                                </p>
                                <p className="text-xs text-slate-600 italic font-medium bg-slate-50/50 p-3 rounded-2xl border border-slate-50">
                                  "{l.reason || "ไม่มีระบุเหตุผล"}"
                                </p>
                              </div>

                              <div className="flex gap-2 mt-2">
                                {l.fileUrl?.trim() ? (
                                  <button
                                    onClick={() => setViewImage(l.fileUrl)}
                                    className="flex-1 py-3 bg-slate-900 text-white rounded-2xl text-[11px] font-black flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all"
                                  >
                                    📄 ดูเอกสาร
                                  </button>
                                ) : (
                                  <div className="flex-1 py-3 bg-slate-100 text-slate-400 rounded-2xl text-[11px] font-black flex items-center justify-center gap-2 border border-slate-200/50">
                                    🚫 ไม่มีเอกสารแนบมา
                                  </div>
                                )}
                                {l.remark && l.status !== "pending" && (
                                  <div className="flex-1 p-3 bg-blue-50 text-blue-700 rounded-2xl text-[10px] font-bold border border-blue-100 truncate flex items-center justify-center">
                                    📌 {l.remark}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-20 text-center bg-white rounded-[2.5rem] border border-slate-100 text-slate-400 italic font-black">
                          ไม่พบคำขอลางาน...
                        </div>
                      )}
                    </div>

                    {/* --- Pagination Controls --- */}
                    {totalPages > 1 && (
                      <div className="flex justify-center items-center gap-2 mt-8 mb-12">
                        <button
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((prev) => prev - 1)}
                          className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all font-bold"
                        >
                          {"<"}
                        </button>

                        <div className="flex gap-1">
                          {[...Array(totalPages)].map((_, i) => (
                            <button
                              key={i + 1}
                              onClick={() => setCurrentPage(i + 1)}
                              className={`w-10 h-10 rounded-xl font-black text-sm transition-all ${
                                currentPage === i + 1
                                  ? "bg-blue-600 text-white shadow-lg shadow-blue-100 scale-110"
                                  : "bg-white text-slate-400 border border-slate-100 hover:border-blue-200"
                              }`}
                            >
                              {i + 1}
                            </button>
                          ))}
                        </div>

                        <button
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage((prev) => prev + 1)}
                          className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all font-bold"
                        >
                          {">"}
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </section>
          )}
          {/* --- Tab: Overtime Requests --- */}
          {activeTab === "overtime" && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3 px-4 md:px-0">
                <span className="w-2 h-8 bg-purple-500 rounded-full"></span>
                คำขอ OT พนักงาน
              </h2>

              {/* Search Bar */}
              <div className="mb-6 relative max-w-md px-4 md:px-0">
                <div className="absolute inset-y-0 left-4 md:left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-gray-400">🔍</span>
                </div>
                <input
                  type="text"
                  placeholder="ค้นชื่อพนักงาน หรือ ประเภทลา..."
                  className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-100 bg-slate-50 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  value={searchLeave}
                  onChange={(e) => {
                    setSearchLeave(e.target.value);
                    setCurrentPage(1); // Reset หน้าเมื่อมีการค้นหา
                  }}
                />
              </div>

              {/* Logic สำหรับ Pagination */}
              {(() => {
                const indexOfLastItem = currentPage * itemsPerPage;
                const indexOfFirstItem = indexOfLastItem - itemsPerPage;
                const currentItems = filteredLeaves.slice(
                  indexOfFirstItem,
                  indexOfLastItem
                );
                const totalPages = Math.ceil(
                  filteredLeaves.length / itemsPerPage
                );

                return (
                  <>
                    {/* --- Desktop Table View --- */}
                    <div className="hidden lg:block rounded-4xl border border-slate-100 overflow-hidden bg-white shadow-sm">
                      <div className="overflow-x-auto max-h-[580px] overflow-y-auto custom-scrollbar">
                        <table className="min-w-[1400px] w-full text-sm border-separate border-spacing-0">
                          <thead className="sticky top-0 z-20 bg-white">
                            <tr className="text-gray-400 font-bold uppercase text-[11px] tracking-widest border-b border-gray-100">
                              <th className="py-5 px-6 text-left w-20 bg-white border-b border-gray-100">
                                รูป
                              </th>
                              <th className="py-5 px-6 text-left bg-white border-b border-gray-100">
                                พนักงาน
                              </th>
                              <th className="py-5 px-6 text-center bg-white border-b border-gray-100">
                                วันที่ขอ OT
                              </th>
                              <th className="py-5 px-6 text-center bg-white border-b border-gray-100">
                                วันที่ทำ OT
                              </th>
                              <th className="py-5 px-6 text-center bg-white border-b border-gray-100">
                                เวลาที่ขอ
                              </th>
                              <th className="py-5 px-6 text-left bg-white border-b border-gray-100">
                                เหตุผล
                              </th>
                              <th className="py-5 px-6 text-center bg-white border-b border-gray-100">
                                สถานะคำขอ
                              </th>
                              <th className="py-5 px-6 text-center bg-white border-b border-gray-100">
                                จัดการคำขอ
                              </th>
                              <th className="py-5 px-6 text-center bg-white border-b border-gray-100">
                                หมายเหตุ
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {overtimeReques.length > 0 ? (
                              overtimeReques.map((l) => {
                                // ✅ ใช้ฟังก์ชัน getEffectiveRemark ที่เราเขียนไว้ใน State
                                const currentRemark =
                                  otRemarks[l.id] ?? l.remark ?? "";

                                return (
                                  <tr
                                    key={l.id}
                                    className="group hover:bg-blue-50/40 transition-colors"
                                  >
                                    {/* 1. รูปพนักงาน */}
                                    <td className="py-4 px-6">
                                      <div className="w-12 h-12 relative rounded-2xl overflow-hidden border-2 border-white shadow-sm bg-slate-100">
                                        <Image
                                          src={
                                            l.avatarUrl ||
                                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                              l.employeeName || "User"
                                            )}&background=random`
                                          }
                                          alt="profile"
                                          fill
                                          className="object-cover"
                                        />
                                      </div>
                                    </td>

                                    {/* 2. ชื่อพนักงาน */}
                                    <td className="py-4 px-6">
                                      <div className="font-black text-gray-800 text-base">
                                        {l.employeeName || "ไม่ระบุชื่อ"}
                                      </div>
                                      <div className="text-blue-500 font-mono text-[11px] font-bold">
                                        @{l.userName || "user"}
                                      </div>
                                    </td>

                                    {/* 3. วันที่ขอ OT */}
                                    <td className="py-4 px-6 text-center text-gray-500 text-[11px] font-bold leading-tight">
                                      {l.requestDate
                                        ? new Date(
                                            l.requestDate
                                          ).toLocaleDateString("th-TH")
                                        : "-"}
                                    </td>

                                    {/* 4. วันที่ทำ OT */}
                                    <td className="py-4 px-6 text-center text-gray-800 font-bold text-sm">
                                      {l.workingDate
                                        ? new Date(
                                            l.workingDate
                                          ).toLocaleDateString("th-TH", {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric",
                                          })
                                        : "-"}
                                    </td>

                                    {/* 5. เวลาที่ขอ */}
                                    <td className="py-4 px-6 text-center">
                                      <div className="text-gray-800 font-bold text-xs">
                                        {l.timeStart?.slice(0, 5) || "00:00"} -{" "}
                                        {l.timeEnd?.slice(0, 5) || "00:00"}
                                      </div>
                                      <div className="text-blue-600 text-[10px] font-black uppercase">
                                        OT : {l.totalHours} นาที
                                      </div>
                                    </td>

                                    {/* 6. เหตุผล */}
                                    <td className="py-4 px-6 text-gray-600 italic text-xs max-w-[200px] truncate">
                                      "{l.reason || "ไม่มีระบุเหตุผล"}"
                                    </td>

                                    {/* 7. สถานะ */}
                                    <td className="py-4 px-6 text-center">
                                      <span
                                        className={`min-w-[90px] py-1.5 rounded-full text-[10px] font-black uppercase shadow-sm border text-center tracking-tight ${
                                          l.status === "pending"
                                            ? "bg-orange-100 text-orange-600 border-orange-200"
                                            : l.status === "approved"
                                              ? "bg-emerald-100 text-emerald-600 border-emerald-200"
                                              : l.status === "executed"
                                                ? "bg-blue-100 text-blue-600 border-blue-200"
                                                : "bg-red-100 text-red-600 border-red-200"
                                        }`}
                                      >
                                        {l.status === "pending"
                                          ? "รออนุมัติ"
                                          : l.status === "approved"
                                            ? "อนุมัติแล้ว"
                                            : l.status === "executed"
                                              ? "เสร็จสมบูรณ์"
                                              : "ปฏิเสธ"}
                                      </span>
                                    </td>

                                    {/* 8. ปุ่มจัดการ */}
                                    <td className="py-4 px-6">
                                      <div className="flex justify-center gap-2">
                                        {l.status === "pending" ? (
                                          <>
                                            <button
                                              disabled={isProcessing}
                                              onClick={() =>
                                                handleApproveOT(l.id)
                                              }
                                              className="disabled:opacity-50 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:scale-105 active:scale-95 transition-all shadow-md"
                                            >
                                              อนุมัติ
                                            </button>
                                            <button
                                              disabled={isProcessing}
                                              onClick={() =>
                                                handleRejectOT(l.id)
                                              }
                                              className="disabled:opacity-50 bg-white border border-red-200 text-red-500 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-50"
                                            >
                                              ปฏิเสธ
                                            </button>
                                          </>
                                        ) : l.status === "executed" ? (
                                          <div className="text-[10px] font-bold text-slate-400 italic bg-slate-50 px-4 py-2 rounded-xl border border-dashed border-slate-200">
                                            🔒 ล็อครายการแล้ว
                                          </div>
                                        ) : (
                                          <button
                                            disabled={isProcessing}
                                            onClick={() => resetOTStatus(l.id)}
                                            className="disabled:opacity-50 flex items-center gap-1 bg-slate-50 text-slate-600 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-100"
                                          >
                                            ✏️ แก้ไข
                                          </button>
                                        )}
                                      </div>
                                    </td>

                                    {/* 9. ช่องหมายเหตุ */}
                                    <td className="py-4 px-6">
                                      <div className="relative flex items-center gap-2 min-w-[200px]">
                                        <input
                                          type="text"
                                          placeholder="ระบุหมายเหตุ..."
                                          className={`border rounded-xl px-3 py-2 text-xs w-full transition-all outline-none ${
                                            l.status !== "pending"
                                              ? "bg-slate-50 text-slate-500 border-slate-100"
                                              : "bg-white border-slate-200 focus:border-blue-400"
                                          }`}
                                          value={currentRemark}
                                          onChange={(e) =>
                                            handleOTRemarkChange(
                                              l.id,
                                              e.target.value
                                            )
                                          }
                                          readOnly={
                                            l.status !== "pending" ||
                                            isProcessing
                                          }
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td
                                  colSpan={9}
                                  className="py-24 text-center text-slate-400 italic font-black"
                                >
                                  ไม่พบคำขอ OT ในขณะนี้...
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* --- Mobile Card View --- */}
                    <div className="lg:hidden grid grid-cols-1 gap-4 px-4 pb-20">
                      {currentItems.length > 0 ? (
                        currentItems.map((l) => {
                          const start = new Date(l.startDate);
                          const end = new Date(l.endDate);
                          const dDays =
                            Math.ceil(
                              Math.abs(end.getTime() - start.getTime()) /
                                (1000 * 60 * 60 * 24)
                            ) + 1;

                          return (
                            <div
                              key={l.id}
                              className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden text-left"
                            >
                              {/* Status Badge */}
                              <div
                                className={`absolute top-0 right-12 px-4 py-1 rounded-b-xl text-[9px] font-black uppercase ${
                                  l.status === "pending"
                                    ? "bg-orange-100 text-orange-600"
                                    : l.status === "approved"
                                      ? "bg-emerald-100 text-emerald-600"
                                      : "bg-red-100 text-red-600"
                                }`}
                              >
                                {l.status === "pending"
                                  ? "รออนุมัติ"
                                  : l.status === "approved"
                                    ? "อนุมัติแล้ว"
                                    : "ปฏิเสธ"}
                              </div>

                              {/* Action Menu & Remark Popover */}
                              <div className="absolute top-4 right-4">
                                <button
                                  onClick={() =>
                                    setViewRemarkId(
                                      viewRemarkId === l.id ? null : l.id
                                    )
                                  }
                                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-50 transition-colors text-slate-400 text-xl"
                                >
                                  ⋮
                                </button>
                                {viewRemarkId === l.id && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-40"
                                      onClick={() => setViewRemarkId(null)}
                                    />
                                    <div className="absolute right-0 top-12 z-50 w-64 bg-white border border-slate-100 rounded-3xl shadow-2xl p-4 animate-in fade-in zoom-in duration-200">
                                      <p className="text-[10px] font-black text-slate-400 uppercase mb-3 px-1 text-left">
                                        จัดการคำขอ / หมายเหตุ
                                      </p>
                                      <textarea
                                        placeholder="ระบุหมายเหตุที่นี่..."
                                        className="w-full h-24 p-3 rounded-2xl border border-slate-100 bg-slate-50 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none mb-3 resize-none text-left"
                                        value={
                                          leaveRemarks[l.id] ?? l.remark ?? ""
                                        }
                                        onChange={(e) =>
                                          handleRemarkChange(
                                            l.id,
                                            e.target.value
                                          )
                                        }
                                      />
                                      <div className="grid grid-cols-2 gap-2">
                                        <button
                                          onClick={() => {
                                            updateLeaveStatus(l.id, "approved");
                                            setViewRemarkId(null);
                                          }}
                                          className="py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black"
                                        >
                                          อนุมัติ
                                        </button>
                                        <button
                                          onClick={() => {
                                            updateLeaveStatus(l.id, "rejected");
                                            setViewRemarkId(null);
                                          }}
                                          className="py-2.5 bg-red-500 text-white rounded-xl text-xs font-black"
                                        >
                                          ปฏิเสธ
                                        </button>
                                      </div>
                                      {l.status !== "pending" && (
                                        <button
                                          onClick={() => {
                                            updateLeaveStatus(l.id, "pending");
                                            setViewRemarkId(null);
                                          }}
                                          className="w-full mt-2 py-2 text-slate-500 text-[10px] font-bold border border-dashed border-slate-200 rounded-xl text-center"
                                        >
                                          ย้อนเป็นรออนุมัติ
                                        </button>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* Profile Section */}
                              <div className="flex items-start gap-4 mb-4">
                                <div className="w-14 h-14 relative rounded-2xl overflow-hidden border-2 border-slate-50 bg-slate-50 shadow-sm flex-shrink-0">
                                  <Image
                                    src={
                                      l.avatarUrl ||
                                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                        l.employeeName || "User"
                                      )}&background=random`
                                    }
                                    alt="profile"
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-black text-slate-800 text-lg leading-none truncate">
                                    {l.employeeName || "ไม่ระบุชื่อ"}
                                  </h3>
                                  <p className="text-blue-500 font-mono text-xs font-bold mt-1 truncate">
                                    @{l.userName || "user"}
                                  </p>
                                  <div className="mt-1 font-bold text-blue-600 text-xs uppercase">
                                    {l.type}
                                  </div>
                                </div>
                              </div>

                              {/* Duration & Dates */}
                              <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-slate-50 p-3 rounded-2xl">
                                  <p className="text-[10px] text-slate-400 font-black uppercase mb-1">
                                    ระยะเวลา
                                  </p>
                                  <p className="text-sm font-black text-slate-700">
                                    {isNaN(dDays) ? "-" : `${dDays} วัน`}
                                  </p>
                                </div>
                                <div className="bg-orange-50 p-3 rounded-2xl text-center">
                                  <p className="text-[10px] text-orange-400 font-black uppercase mb-1">
                                    วันที่ลา
                                  </p>
                                  <p className="text-[10px] font-bold text-orange-600 leading-tight">
                                    {new Date(l.startDate).toLocaleDateString(
                                      "th-TH"
                                    )}{" "}
                                    -{" "}
                                    {new Date(l.endDate).toLocaleDateString(
                                      "th-TH"
                                    )}
                                  </p>
                                </div>
                              </div>

                              {/* Reason Section */}
                              <div className="mb-4 text-left">
                                <p className="text-[10px] text-slate-400 font-black uppercase mb-1 px-1">
                                  เหตุผลการลา
                                </p>
                                <p className="text-xs text-slate-600 italic font-medium bg-slate-50/50 p-3 rounded-2xl border border-slate-50">
                                  "{l.reason || "ไม่มีระบุเหตุผล"}"
                                </p>
                              </div>

                              {/* Footer Actions / Info */}
                              <div className="flex gap-2 mt-2">
                                {l.fileUrl?.trim() ? (
                                  <button
                                    onClick={() => setViewImage(l.fileUrl)}
                                    className="flex-1 py-3 bg-slate-900 text-white rounded-2xl text-[11px] font-black flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all"
                                  >
                                    📄 ดูเอกสาร
                                  </button>
                                ) : (
                                  <div className="flex-1 py-3 bg-slate-100 text-slate-400 rounded-2xl text-[11px] font-black flex items-center justify-center gap-2 border border-slate-200/50">
                                    🚫 ไม่มีเอกสารแนบมา
                                  </div>
                                )}
                                {l.remark && l.status !== "pending" && (
                                  <div className="flex-1 p-3 bg-blue-50 text-blue-700 rounded-2xl text-[10px] font-bold border border-blue-100 truncate flex items-center justify-center">
                                    📌 {l.remark}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-20 text-center bg-white rounded-[2.5rem] border border-slate-100 text-slate-400 italic font-black">
                          ไม่พบคำขอลางาน...
                        </div>
                      )}
                    </div>

                    {/* --- Pagination Controls --- */}
                    {totalPages > 1 && (
                      <div className="flex justify-center items-center gap-2 mt-8 mb-12">
                        <button
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((prev) => prev - 1)}
                          className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all font-bold"
                        >
                          {"<"}
                        </button>

                        <div className="flex gap-1">
                          {[...Array(totalPages)].map((_, i) => (
                            <button
                              key={i + 1}
                              onClick={() => setCurrentPage(i + 1)}
                              className={`w-10 h-10 rounded-xl font-black text-sm transition-all ${
                                currentPage === i + 1
                                  ? "bg-blue-600 text-white shadow-lg shadow-blue-100 scale-110"
                                  : "bg-white text-slate-400 border border-slate-100 hover:border-blue-200"
                              }`}
                            >
                              {i + 1}
                            </button>
                          ))}
                        </div>

                        <button
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage((prev) => prev + 1)}
                          className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-all font-bold"
                        >
                          {">"}
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </section>
          )}
        </div>
      </main>

      {/* --- 💼 MODAL: ADD DEPARTMENT --- */}
      {showAddDepartment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[700] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-900 mb-6 uppercase italic flex items-center gap-2">
              {editingDept ? "📝 แก้ไขแผนก" : "💼 เพิ่มแผนก"}
            </h3>
            <form
              onSubmit={async (e) => {
                await handleAddDepartment(e);
                // เมื่อบันทึกสำเร็จ ให้เด้งกลับไปหน้าจัดการระบบ
                setShowManageModal(true);
              }}
              className="space-y-4"
            >
              <input
                key={editingDept?.id || "new"}
                name="name"
                placeholder="ระบุชื่อแผนก..."
                required
                defaultValue={editingDept?.name || ""}
                className={`w-full border p-4 rounded-2xl bg-slate-50 font-bold outline-none focus:ring-2 ${
                  editingDept ? "focus:ring-blue-500" : "focus:ring-amber-500"
                }`}
              />
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddDepartment(false);
                    setEditingDept(null);
                    // กดยกเลิกก็ให้เด้งกลับไปหน้าจัดการระบบ
                    setShowManageModal(true);
                  }}
                  className="flex-1 py-4 text-slate-400 font-bold uppercase text-[10px]"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className={`flex-1 py-4 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg transition-all ${
                    isProcessing ? "opacity-50" : ""
                  } ${
                    editingDept
                      ? "bg-blue-600 shadow-blue-100"
                      : "bg-amber-600 shadow-amber-100"
                  }`}
                >
                  {isProcessing ? "กำลังประมวลผล..." : "บันทึก"}
                </button>
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
              <span
                className={`${
                  editingSite
                    ? "bg-blue-100 text-blue-600"
                    : "bg-emerald-100 text-emerald-600"
                } p-2 rounded-lg text-sm not-italic`}
              >
                {editingSite ? "✏️" : "📍"}
              </span>
              {editingSite ? "แก้ไขไซต์งาน" : "เพิ่มไซต์งานใหม่"}
            </h3>

            <form onSubmit={handleAddSite} className="space-y-5">
              <div className="space-y-3">
                <input
                  name="siteName"
                  id="siteNameInput"
                  defaultValue={allSite ? "ทุกไซต์" : editingSite?.name || ""}
                  readOnly={isAllSite}
                  placeholder="ชื่อไซต์งาน..."
                  required
                  className={`w-full border-none p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-300 ${
                    isAllSite
                      ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                      : "bg-slate-50"
                  }`}
                />

                {/* ✅ ส่วน Logic ตรวจสอบและแสดงสถานะ "ทุกไซต์" */}
                {!editingSite &&
                  (hasMultiSiteActive ? (
                    // แสดงข้อความเมื่อมี "ทุกไซต์" อยู่ในระบบแล้ว
                    <div className="p-4 rounded-4xl border-2 border-emerald-100 bg-emerald-50/30 flex flex-col items-center text-center space-y-1">
                      <span className="text-[14px]">✅</span>
                      <span className="text-[10px] font-black text-emerald-600 uppercase italic">
                        Multi-Site System Ready
                      </span>
                      <p className="text-[9px] text-slate-500 font-bold leading-tight">
                        คุณได้สร้าง "ทุกไซต์" เรียบร้อยแล้ว
                        ระบบพร้อมให้พนักงานลงเวลาได้ทุกสถานที่
                      </p>
                    </div>
                  ) : (
                    // แสดงปุ่มเปิดโหมดถ้ายังไม่มีในฐานข้อมูล
                    <div
                      id="special-site-logic"
                      className="p-4 rounded-4xl border-2 border-dashed border-slate-100 bg-slate-50/50 space-y-3 transition-all"
                    >
                      <label className="flex items-center justify-between cursor-pointer group">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-slate-700 uppercase italic">
                            เปิดโหมด "ทุกไซต์"
                          </span>
                          <p className="text-[9px] text-slate-400 font-bold leading-tight max-w-[180px]">
                            พนักงานจะสามารถเลือกไซต์นี้เพื่อเข้าทำงานได้ทุกสถานที่
                          </p>
                        </div>
                        <div className="relative">
                          <input
                            type="checkbox"
                            name="isAllSite"
                            className="sr-only peer"
                            checked={isAllSite}
                            onChange={(e) => setIsAllSite(e.target.checked)}
                          />
                          <div className="w-12 h-7 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </div>
                      </label>
                    </div>
                  ))}

                <input
                  key={isAllSite ? "ทุกไซต์" : editingSite?.address || ""}
                  name="address"
                  defaultValue={
                    isAllSite ? "ทุกไซต์" : (editingSite?.address ?? "")
                  }
                  readOnly={isAllSite}
                  placeholder="ที่อยู่ไซต์งาน..."
                  className={`w-full border-none p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-300 ${
                    isAllSite
                      ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                      : "bg-slate-50"
                  }`}
                />
              </div>

              <div className="space-y-3 relative">
                <button
                  type="button"
                  disabled={isProcessing || isAllSite}
                  onClick={handleGetCurrentLocation}
                  className={`w-full py-4 relative overflow-hidden text-white rounded-2xl font-black uppercase text-[12px] shadow-lg transition-all flex items-center justify-center gap-3 border-b-4 
              ${
                isProcessing || isAllSite
                  ? "bg-slate-400 border-slate-500 cursor-not-allowed"
                  : "bg-blue-600 border-blue-800 hover:bg-blue-700 active:scale-95 shadow-blue-100"
              }`}
                >
                  {isProcessing ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
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

                <div
                  className={`flex gap-2 transition-opacity duration-300 ${
                    isProcessing || isAllSite ? "opacity-30" : "opacity-60"
                  }`}
                >
                  <div
                    className={`flex-1 rounded-xl border border-slate-200 p-2 ${
                      isAllSite ? "bg-slate-200" : "bg-slate-50"
                    }`}
                  >
                    <span className="block text-[8px] text-slate-400 uppercase font-bold ml-1">
                      Lat
                    </span>
                    <input
                      name="latitude"
                      value={isAllSite ? "" : lat}
                      readOnly={isProcessing || isAllSite}
                      onChange={(e) => setLat(e.target.value)}
                      placeholder="0.0000"
                      className="w-full bg-transparent outline-none font-bold text-xs px-1"
                    />
                  </div>
                  <div
                    className={`flex-1 rounded-xl border border-slate-200 p-2 ${
                      isAllSite ? "bg-slate-200" : "bg-slate-50"
                    }`}
                  >
                    <span className="block text-[8px] text-slate-400 uppercase font-bold ml-1">
                      Lng
                    </span>
                    <input
                      name="longitude"
                      value={isAllSite ? "" : lng}
                      readOnly={isProcessing || isAllSite}
                      onChange={(e) => setLng(e.target.value)}
                      placeholder="0.0000"
                      className="w-full bg-transparent outline-none font-bold text-xs px-1"
                    />
                  </div>
                </div>
                <p className="text-center text-[9px] text-slate-400 font-bold uppercase italic">
                  * หากดึงพิกัดไม่ได้ กรุณาอนุญาตสิทธิ์เข้าถึงตำแหน่ง
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => {
                    setShowAddSite(false);
                    setEditingSite(null);
                    setIsAllSite(false);
                  }}
                  className="flex-1 py-4 text-slate-400 font-bold uppercase text-[10px] disabled:opacity-30"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className={`flex-[2] py-4 ${
                    editingSite
                      ? "bg-blue-600 shadow-blue-100"
                      : "bg-emerald-600 shadow-emerald-100"
                  } text-white rounded-2xl font-black uppercase text-[10px] shadow-xl disabled:bg-slate-300`}
                >
                  {isProcessing
                    ? "กำลังบันทึก..."
                    : editingSite
                      ? "ยืนยันการแก้ไข"
                      : "ยืนยันเพิ่มไซต์งาน"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 💼 MODAL: ADD POSITION --- */}
      {showAddPosition && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[600] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-900 mb-6 uppercase italic flex items-center gap-2">
              <span className="bg-amber-100 text-amber-600 p-2 rounded-lg text-sm not-italic">
                💼
              </span>
              จัดการตำแหน่งงาน
            </h3>

            <form onSubmit={handleAddPosition} className="space-y-5">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 italic">
                  ชื่อตำแหน่งงาน (Position Name)
                </label>
                <input
                  name="posName"
                  type="text"
                  placeholder="เช่น Senior Developer, HR Manager..."
                  required
                  autoFocus
                  className="w-full bg-slate-50 border-none p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-300 text-slate-700"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setShowAddPosition(false)}
                  className="flex-1 py-4 text-slate-400 font-bold uppercase text-[10px] hover:text-slate-600 transition-colors disabled:opacity-30"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-[2] py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl shadow-amber-100 transition-all active:scale-95 disabled:bg-slate-300"
                >
                  {isProcessing ? "กำลังบันทึก..." : "ยืนยันเพิ่มตำแหน่ง"}
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
              <button
                type="button"
                onClick={() => setShowAdminEdit(false)}
                className="text-slate-300 hover:text-red-500 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* ส่วนอัปโหลดรูป */}
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="w-28 h-28 rounded-4xl bg-slate-100 overflow-hidden border-4 border-white shadow-lg relative group">
                <img
                  src={
                    previewImage ||
                    admin?.avatarUrl ||
                    `https://ui-avatars.com/api/?name=${admin?.name}&background=random`
                  }
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
                <h3 className="text-[11px] font-black text-blue-600 uppercase tracking-[0.2em] px-2">
                  ข้อมูลทั่วไป
                </h3>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                    Username (แก้ไขไม่ได้)
                  </label>
                  <input
                    value={admin?.userName || admin?.username}
                    readOnly
                    className="w-full bg-slate-100 p-4 rounded-2xl font-bold text-slate-500 cursor-not-allowed outline-none border border-transparent"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                    ชื่อ-นามสกุล
                  </label>
                  <input
                    name="name"
                    defaultValue={admin?.name}
                    required
                    className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                    อีเมลติดต่อ
                  </label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={admin?.email}
                    placeholder="admin@example.com"
                    className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                    เบอร์โทรศัพท์
                  </label>
                  <input
                    name="phone"
                    type="tel"
                    defaultValue={admin?.phone}
                    placeholder="08x-xxx-xxxx"
                    className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all"
                  />
                </div>
              </div>

              {/* ส่วนเปลี่ยนรหัสผ่าน */}
              <div className="space-y-4 bg-slate-50/50 p-4 rounded-4xl border border-slate-100">
                <div className="px-2">
                  <h3 className="text-[11px] font-black text-red-500 uppercase tracking-[0.2em]">
                    ตั้งค่าความปลอดภัย
                  </h3>
                </div>

                {/* รหัสผ่านเดิม */}
                <div className="space-y-1 text-slate-900">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                    รหัสผ่านเดิม (เพื่อยืนยัน)
                  </label>
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
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                    รหัสผ่านใหม่
                  </label>
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
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                    ยืนยันรหัสผ่านใหม่
                  </label>
                  <div className="relative group">
                    <input
                      name="confirmPassword"
                      type={showPass ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full p-4 pr-12 rounded-2xl font-bold border outline-none transition-all focus:ring-4 
          ${
            isMismatch
              ? "bg-red-50 border-red-500 focus:ring-red-500/10 text-red-600 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
              : "bg-white border-slate-200 focus:border-blue-500 focus:ring-blue-500/5"
          }`}
                      placeholder="ระบุรหัสใหม่อีกครั้ง"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors z-10 
          ${
            isMismatch
              ? "text-red-400 hover:text-red-600"
              : "text-slate-300 hover:text-blue-500"
          }`}
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
              <span>
                {editingEmployee
                  ? "✏️ แก้ไขข้อมูลพนักงาน"
                  : "👤 ลงทะเบียนพนักงานใหม่"}
              </span>
              {editingEmployee && (
                <button
                  type="button"
                  disabled={isResetting} // ป้องกันการกดซ้ำขณะกำลังทำงาน
                  onClick={() => handleDirectReset(editingEmployee.id)}
                  className={`text-[10px] px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors ${
                    isResetting
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  }`}
                >
                  {isResetting
                    ? "⏳ กำลังรีเซ็ต..."
                    : "🔄 รีเซ็ตรหัสผ่านเป็น '1234'"}
                </button>
              )}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* รูปโปรไฟล์ */}
              <div className="col-span-1 sm:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                  รูปโปรไฟล์
                </label>
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200">
                  <div className="w-16 h-16 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 border-2 border-white shadow-sm relative">
                    <img
                      src={
                        previewImage ||
                        editingEmployee?.avatarUrl ||
                        "https://ui-avatars.com/api/?name=User"
                      }
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
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                  Username {editingEmployee && "(แก้ไขไม่ได้)"}
                </label>
                <input
                  name="userName"
                  defaultValue={editingEmployee?.userName}
                  placeholder="ชื่อผู้ใช้งาน..."
                  required
                  disabled={!!editingEmployee}
                  onInput={(e) => {
                    // 1. กรองเอาเฉพาะ a-z, A-Z และ 0-9
                    // 2. แปลงเป็นตัวพิมพ์เล็กทั้งหมดด้วย .toLowerCase()
                    e.currentTarget.value = e.currentTarget.value
                      .replace(/[^a-zA-Z0-9]/g, "")
                      .toLowerCase();
                  }}
                  className={`w-full p-4 rounded-2xl font-bold border outline-none transition-all ${
                    editingEmployee
                      ? "bg-slate-100 text-slate-400 border-transparent"
                      : "bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white"
                  }`}
                />
              </div>

              {/* ช่องรหัสผ่านเดิม (แสดงเฉพาะตอนแก้ไข) */}
              {editingEmployee && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-red-500 uppercase ml-2">
                    รหัสผ่านเดิม (เพื่อยืนยันการเปลี่ยน)
                  </label>
                  <div className="relative">
                    <input
                      name="oldPassword"
                      type={showOldPass ? "text" : "password"}
                      placeholder="ระบุรหัสผ่านปัจจุบัน..."
                      className="w-full p-4 pr-12 bg-red-50 border-transparent focus:border-red-500 focus:bg-white rounded-2xl font-bold border outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPass(!showOldPass)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-lg opacity-50 hover:opacity-100 transition-opacity"
                    >
                      {showOldPass ? "ดู" : "ซ่อน"}
                    </button>
                  </div>
                </div>
              )}

              {/* Password ใหม่ */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                  {editingEmployee
                    ? "รหัสผ่านใหม่ (ว่างไว้ถ้าไม่เปลี่ยน)"
                    : "Password"}
                </label>
                <div className="relative">
                  <input
                    id="reg-password"
                    name="password"
                    type={showPass ? "text" : "password"}
                    placeholder={
                      editingEmployee ? "พิมพ์รหัสผ่านใหม่..." : "รหัสผ่าน"
                    }
                    required={!editingEmployee}
                    className="w-full p-4 pr-12 bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl font-bold border outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-lg opacity-50 hover:opacity-100 transition-opacity"
                  >
                    {showPass ? "ดู" : "ซ่อน"}
                  </button>
                </div>
              </div>

              {/* Confirm Password ใหม่ */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="reg-confirm"
                    name="confirmPassword"
                    type={showConfirmPass ? "text" : "password"}
                    placeholder="ยืนยันรหัสผ่านใหม่"
                    required={!editingEmployee}
                    className="w-full p-4 pr-12 bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl font-bold border outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-lg opacity-50 hover:opacity-100 transition-opacity"
                  >
                    {showConfirmPass ? "ดู" : "ซ่อน"}
                  </button>
                </div>
              </div>

              {/* ชื่อ-นามสกุล */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                  ชื่อจริง
                </label>
                <input
                  name="firstName"
                  defaultValue={editingEmployee?.firstName}
                  required
                  className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                  นามสกุล
                </label>
                <input
                  name="lastName"
                  defaultValue={editingEmployee?.lastName}
                  required
                  className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all"
                />
              </div>

              {/* --- ✨ ส่วนแก้ไขข้อมูลเพิ่มเติม ✨ --- */}
              {editingEmployee && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-blue-500 uppercase ml-2">
                      เวลาเข้างาน
                    </label>
                    <input
                      type="time"
                      name="startTime"
                      defaultValue={editingEmployee?.startTime || "08:00"}
                      className="w-full bg-blue-50/50 p-4 rounded-2xl font-bold border border-blue-100 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-blue-500 uppercase ml-2">
                      เวลาเลิกงาน
                    </label>
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
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                  ระดับสิทธิ์ (Role)
                </label>
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
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                  แผนก (Department)
                </label>
                <select
                  name="departmentId"
                  key={
                    editingEmployee
                      ? `edit-dept-${editingEmployee.id}`
                      : "reg-dept"
                  }
                  defaultValue={editingEmployee?.departmentId || ""}
                  required
                  className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="">เลือกแผนก...</option>
                  {departments?.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* ตำแหน่งงาน (Position) */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                  ตำแหน่งงาน (Position)
                </label>
                <select
                  name="positionId"
                  key={
                    editingEmployee
                      ? `edit-pos-${editingEmployee.id}`
                      : "reg-pos"
                  }
                  defaultValue={editingEmployee?.positionId || ""}
                  required
                  className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="">เลือกตำแหน่ง...</option>
                  {positions?.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* ไซต์งาน */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                  ไซต์งาน
                </label>
                <select
                  name="site_id"
                  key={
                    editingEmployee
                      ? `edit-site-${editingEmployee.id}`
                      : "reg-site"
                  }
                  defaultValue={editingEmployee?.siteId || ""}
                  required
                  className="w-full bg-slate-50 p-4 rounded-2xl font-bold border border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="">เลือกไซต์งาน...</option>
                  {sites.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
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
                {isProcessing
                  ? "กำลังบันทึก..."
                  : editingEmployee
                    ? "💾 บันทึกการแก้ไข"
                    : "➕ ลงทะเบียนพนักงาน"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- 📊 MODAL (Report Generator) --- */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-slate-100 z-[500] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 font-sans">
          {/* --- 1. Header --- */}
          <div className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between shadow-sm sticky top-0 z-[530]">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileFilterOpen(true)}
                className="lg:hidden w-10 h-10 bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center gap-1 shadow-sm active:scale-95 transition-all"
              >
                <span className="w-5 h-[2px] bg-slate-400 rounded-full"></span>
                <span className="w-5 h-[2px] bg-slate-400 rounded-full"></span>
                <span className="w-5 h-[2px] bg-slate-400 rounded-full"></span>
              </button>

              <div className="w-10 h-10 bg-blue-600 rounded-xl hidden lg:flex items-center justify-center text-white text-xl shadow-lg shadow-blue-100">
                {isProcessing ? (
                  <span className="animate-spin text-lg">⏳</span>
                ) : (
                  "📊"
                )}
              </div>
              <div>
                <h3 className="text-base lg:text-lg font-black text-slate-900 leading-none mb-1 uppercase italic">
                  สร้างรายงาน
                </h3>
                <p className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {isProcessing
                    ? "กำลังประมวลผลข้อมูล..."
                    : "ระบบสร้างรายงานและคัดกรองรายชื่อ"}
                </p>
              </div>
            </div>
            <button
              disabled={isProcessing}
              onClick={() => setShowFilterModal(false)}
              className="w-10 h-10 lg:w-12 lg:h-12 flex items-center justify-center bg-slate-100 text-slate-400 rounded-full hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-50"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row relative">
            {/* --- 2. Side Bar: Filters --- */}
            {isMobileFilterOpen && (
              <div
                className="fixed inset-0 bg-slate-900/40 z-[510] lg:hidden backdrop-blur-sm animate-in fade-in duration-300"
                onClick={() => setIsMobileFilterOpen(false)}
              ></div>
            )}

            <div
              className={`
          fixed inset-y-0 left-0 w-80 bg-white z-[520] p-6 overflow-y-auto shadow-2xl transition-transform duration-300 transform
          lg:relative lg:translate-x-0 lg:shadow-none lg:z-0 lg:border-r lg:border-slate-200
          ${isMobileFilterOpen ? "translate-x-0" : "-translate-x-full"}
        `}
            >
              <div className="flex items-center justify-between mb-6 lg:block">
                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>{" "}
                  เงื่อนไขรายงาน
                </h4>
                <button
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="lg:hidden text-slate-400 font-bold"
                >
                  ปิด ✕
                </button>
              </div>

              {/* ปรับปรุงพื้นที่ด้านล่าง Sidebar ไม่ให้โดน Footer ทับบน Mobile */}
              <div className="space-y-6 pb-32 lg:pb-6">
                {/* ประเภทรายงาน (Report Type) */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">
                    ประเภทรายงาน (Report Type)
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setReportType("attendance")}
                      className={`p-3.5 rounded-2xl text-[11px] font-black uppercase border transition-all flex items-center gap-3 ${
                        reportType === "attendance"
                          ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100"
                          : "bg-slate-50 border-slate-100 text-slate-400 hover:border-blue-200"
                      }`}
                    >
                      <span className="text-base">📅</span> รายงานการเข้างาน
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportType("overtime")}
                      className={`p-3.5 rounded-2xl text-[11px] font-black uppercase border transition-all flex items-center gap-3 ${
                        reportType === "overtime"
                          ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-100"
                          : "bg-slate-50 border-slate-100 text-slate-400 hover:border-orange-200"
                      }`}
                    >
                      <span className="text-base">⏰</span> รายงาน OT
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">
                    รูปแบบไฟล์ (Format)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setExportFormat("excel")}
                      className={`p-4 rounded-xl text-xs font-black uppercase border transition-all ${
                        exportFormat === "excel"
                          ? "bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/10"
                          : "bg-slate-50 border-slate-100 text-slate-400"
                      }`}
                    >
                      📗 Excel
                    </button>
                    <button
                      onClick={() => setExportFormat("pdf")}
                      className={`p-4 rounded-xl text-xs font-black uppercase border transition-all ${
                        exportFormat === "pdf"
                          ? "bg-red-50 border-red-500 text-red-700 ring-2 ring-red-500/10"
                          : "bg-slate-50 border-slate-100 text-slate-400"
                      }`}
                    >
                      📕 PDF
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">
                    ช่วงวันที่ (Date Range)
                  </label>
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

                {/* ระดับ 1: แผนก */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">
                    แผนก (Department)
                  </label>
                  <select
                    value={filterDepartment || ""}
                    disabled={isProcessing}
                    onChange={(e) => {
                      setFilterDepartment(e.target.value);
                      setFilterPosition("");
                    }}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 ring-blue-500/10 transition-all"
                  >
                    <option value="">ทุกแผนก</option>
                    {allDepartments?.map((d: any) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ระดับ 2: ตำแหน่ง */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">
                    ตำแหน่ง (Position)
                  </label>
                  <select
                    value={filterPosition || ""}
                    disabled={isProcessing}
                    onChange={(e) => setFilterPosition(e.target.value)}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 ring-blue-500/10 transition-all"
                  >
                    <option value="">ทุกตำแหน่ง</option>
                    {Array.from(
                      new Set(
                        initialEmployees
                          .filter(
                            (emp: any) =>
                              !filterDepartment ||
                              emp.departmentName === filterDepartment
                          )
                          .map((emp: any) => emp.positionName)
                      )
                    )
                      .filter(Boolean)
                      .sort()
                      .map((posName) => (
                        <option key={String(posName)} value={String(posName)}>
                          {String(posName)}
                        </option>
                      ))}
                  </select>
                </div>

                {/* ระดับ 3: ไซต์งาน */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 ml-1 uppercase">
                    สถานที่ปฏิบัติงาน (Site)
                  </label>
                  <select
                    value={filterSite || ""}
                    disabled={isProcessing}
                    onChange={(e) => setFilterSite(e.target.value)}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 ring-blue-500/10 transition-all"
                  >
                    <option value="">ทั้งหมด (All Filter)</option>

                    {Array.from(
                      new Map(
                        (initialEmployees ?? [])
                          .filter((emp: any) => {
                            if (!emp) return false;

                            const matchesDept =
                              !filterDepartment ||
                              emp.departmentName === filterDepartment;

                            const matchesPos =
                              !filterPosition ||
                              emp.positionName === filterPosition;

                            return matchesDept && matchesPos;
                          })
                          .filter((emp: any) => emp?.siteId && emp?.siteName)
                          .map((emp: any) => [emp.siteId, emp.siteName])
                      )
                    )
                      .sort((a, b) => {
                        const aName = a?.[1] ?? "";
                        const bName = b?.[1] ?? "";
                        return aName.localeCompare(bName);
                      })
                      .map(([siteId, siteName]) => (
                        <option key={String(siteId)} value={String(siteId)}>
                          {String(siteName ?? "")}
                        </option>
                      ))}
                  </select>
                </div>

                {(filterDepartment || filterSite || filterPosition) && (
                  <button
                    onClick={() => {
                      setFilterDepartment("");
                      setFilterSite("");
                      setFilterPosition("");
                    }}
                    className="w-full py-2 text-[10px] font-black text-slate-400 uppercase hover:text-blue-600 transition-colors"
                  >
                    ล้างตัวกรองทั้งหมด
                  </button>
                )}

                <button
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="lg:hidden w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-blue-100"
                >
                  ตกลงและบันทึกฟิลเตอร์
                </button>
              </div>
            </div>

            {/* --- 3. Right Side: Member Selection --- */}
            <div className="flex-1 flex flex-col bg-slate-50/50 overflow-hidden">
              <div className="p-4 lg:p-6 bg-white border-b border-slate-200 flex flex-col sm:flex-row gap-3 lg:gap-4 justify-between items-center">
                <div className="relative w-full sm:max-w-md">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="ค้นหา..."
                    value={searchTerm}
                    className="w-full pl-11 pr-4 py-3 lg:py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 ring-blue-500/5 transition-all"
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button
                  disabled={isProcessing}
                  onClick={() => {
                    const visibleIds =
                      filteredEmpSuggestions?.map((e: any) => e.id) || [];
                    if (selectedEmployees.length === visibleIds.length)
                      setSelectedEmployees([]);
                    else setSelectedEmployees(visibleIds);
                  }}
                  className="w-full sm:w-auto whitespace-nowrap px-6 lg:px-8 py-3 lg:py-4 bg-white border border-slate-200 rounded-2xl text-[10px] lg:text-xs font-black text-slate-600 uppercase hover:bg-slate-900 hover:text-white shadow-sm transition-all active:scale-95"
                >
                  {selectedEmployees.length ===
                  (filteredEmpSuggestions?.length || 0)
                    ? "ล้างการเลือก"
                    : "เลือกทั้งหมด"}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 lg:p-6 pb-40 lg:pb-6 relative">
                <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-2 lg:gap-4">
                  {filteredEmpSuggestions?.length > 0 ? (
                    filteredEmpSuggestions.map((emp: any) => {
                      const isSelected = selectedEmployees.includes(emp.id);
                      const siteDisplayName =
                        emp.siteName ||
                        allSites.find(
                          (s) => String(s.id) === String(emp.siteId)
                        )?.name ||
                        "ทั่วไป";
                      const posDisplayName =
                        emp.position ||
                        allPositions.find(
                          (p) => String(p.id) === String(emp.positionId)
                        )?.name ||
                        "พนักงาน";

                      return (
                        <div
                          key={emp.id}
                          onClick={() => {
                            if (isSelected)
                              setSelectedEmployees(
                                selectedEmployees.filter((id) => id !== emp.id)
                              );
                            else
                              setSelectedEmployees([
                                ...selectedEmployees,
                                emp.id,
                              ]);
                          }}
                          className={`relative flex flex-col lg:flex-row items-center gap-2 lg:gap-4 p-3 lg:p-5 rounded-3xl lg:rounded-[2.2rem] border-2 transition-all cursor-pointer select-none ${
                            isSelected
                              ? "bg-blue-50 border-blue-500 shadow-lg shadow-blue-100 ring-2 ring-blue-500/10"
                              : "bg-white border-slate-100 shadow-sm hover:border-blue-200"
                          }`}
                        >
                          <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl overflow-hidden bg-blue-100 flex-shrink-0 border border-slate-100">
                            {emp.avatarUrl ? (
                              <img
                                src={emp.avatarUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-sm lg:text-xl font-black text-blue-600">
                                {emp.firstName?.substring(0, 1) || "?"}
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1 text-center lg:text-left">
                            <p
                              className={`text-[10px] lg:text-sm font-black uppercase truncate ${
                                isSelected ? "text-blue-700" : "text-slate-900"
                              }`}
                            >
                              {emp.firstName}
                            </p>
                            <div className="hidden lg:flex flex-col gap-0.5 mt-1">
                              <p className="text-[9px] font-bold text-blue-600 uppercase tracking-tight truncate italic">
                                📍 {siteDisplayName}
                              </p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate">
                                💼 {posDisplayName}
                              </p>
                            </div>
                          </div>

                          {isSelected && (
                            <div className="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full animate-pulse lg:hidden"></div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-full py-20 text-center text-slate-300 italic uppercase font-black tracking-widest text-[10px]">
                      ไม่พบข้อมูลพนักงาน
                    </div>
                  )}
                </div>
              </div>

              {/* --- 4. Sticky Footer --- */}
              <div className="p-4 lg:p-8 bg-white border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.06)] fixed bottom-0 left-0 right-0 lg:relative z-[540]">
                <div className="max-w-7xl mx-auto flex flex-col items-center gap-3 lg:gap-6">
                  <div
                    className={`px-6 py-2 rounded-full text-white text-[10px] font-black transition-all transform ${
                      selectedEmployees.length > 0
                        ? "bg-blue-600 scale-105 shadow-xl shadow-blue-200"
                        : "bg-slate-300"
                    }`}
                  >
                    เลือกแล้ว {selectedEmployees.length} ท่าน
                  </div>

                  <div className="flex gap-2 w-full">
                    <button
                      disabled={isProcessing}
                      type="button"
                      onClick={() => {
                        setShowFilterModal(false);
                        setSelectedEmployees([]);
                      }}
                      className="flex-1 py-3.5 lg:py-5 bg-red-50 text-red-500 rounded-2xl lg:rounded-[1.5rem] font-black uppercase text-[10px] lg:text-sm hover:bg-red-500 hover:text-white transition-all active:scale-95"
                    >
                      ยกเลิก
                    </button>

                    <button
                      disabled={isProcessing || selectedEmployees.length === 0}
                      type="button"
                      onClick={handleGenerateReport}
                      className={`flex-[2.5] py-3.5 lg:py-5 rounded-2xl lg:rounded-[1.5rem] font-black uppercase text-[10px] lg:text-sm tracking-widest shadow-2xl transition-all flex items-center justify-center gap-2 active:scale-95 ${
                        selectedEmployees.length === 0
                          ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                          : reportType === "overtime"
                            ? "bg-orange-500 text-white hover:bg-orange-600 shadow-orange-200"
                            : "bg-slate-900 text-white hover:bg-blue-600"
                      }`}
                    >
                      {isProcessing ? "กำลังประมวลผล..." : "แสดงเอกสาร"}
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
        <div className="fixed inset-0 bg-slate-900/95 flex flex-col items-center z-[600] p-4 overflow-y-auto custom-scrollbar font-sans print:overflow-visible print:bg-white print:p-0 print:relative">
          {/* สไตล์สำหรับคุมขนาด PDF/A4 ตอนสั่งพิมพ์ */}
          <style
            dangerouslySetInnerHTML={{
              __html: `
        @media print {
          @page { 
            size: A4; 
            margin: 0; 
          }
          body { 
            -webkit-print-color-adjust: exact; 
          }
          #report-content {
            width: 210mm !important;
          }
          .page-break-after-always {
            page-break-after: always;
            page-break-inside: avoid;
          }
        }
        `,
            }}
          />

          {/* --- Header Controller (ซ่อนเมื่อพิมพ์) --- */}
          <div className="w-full max-w-[210mm] bg-white mb-4 p-4 rounded-2xl shadow-xl flex justify-between items-center print:hidden border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm ${exportFormat === "excel" ? "bg-emerald-500" : "bg-red-500"} text-white`}
              >
                {exportFormat === "excel" ? "📗" : "📕"}
              </div>
              <div>
                <h2 className="font-bold text-lg text-slate-800 uppercase leading-none">
                  {exportFormat === "excel"
                    ? "เอกสารประเภท Excel"
                    : "เอกสารประเภท PDF"}
                </h2>
                <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase">
                  {reportType === "attendance"
                    ? "รายงานการเข้างาน"
                    : "รายงานการทำโอที (OT)"}{" "}
                  • {Array.isArray(reportData) ? reportData.length : 0} รายการ
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  จำนวนเอกสาร:{" "}
                </span>
                <span className="text-[11px] font-black text-blue-600">
                  {reportType === "ot" ||
                  reportType === "overtime" ||
                  (Array.isArray(reportData) &&
                    reportData[0]?.generatedType === "overtime")
                    ? (() => {
                        const safeData = Array.isArray(reportData)
                          ? reportData
                          : [];
                        const userIds = [
                          ...new Set(safeData.map((item: any) => item?.userId)),
                        ];
                        let totalPages = 0;
                        userIds.forEach((id) => {
                          const userRows = safeData.filter(
                            (item: any) => item?.userId === id
                          ).length;
                          totalPages += Math.ceil(userRows / 15);
                        });
                        return totalPages || 1;
                      })()
                    : Math.ceil(
                        (Array.isArray(reportData) ? reportData.length : 0) / 15
                      ) || 1}{" "}
                  หน้า
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    exportFormat === "pdf"
                      ? window.print()
                      : handleDownloadExcel(
                          Array.isArray(reportData) ? reportData : []
                        )
                  }
                  className={`px-6 py-2.5 rounded-xl font-bold text-[11px] uppercase shadow-lg transition-all active:scale-95 text-white ${exportFormat === "excel" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-900 hover:bg-blue-600"}`}
                >
                  {exportFormat === "pdf"
                    ? "พิมพ์รายงาน / Save PDF"
                    : "ดาวน์โหลด Excel"}
                </button>
                <button
                  onClick={() => {
                    setShowReport(false);
                    setShowFilterModal(true);
                    setIsMobileFilterOpen(false);
                  }}
                  className="bg-slate-100 hover:bg-red-50 hover:text-red-500 px-6 py-2.5 rounded-xl font-bold text-[11px] uppercase transition-all text-slate-400"
                >
                  ย้อนกลับ
                </button>
              </div>
            </div>
          </div>

          <div
            id="report-content"
            className="w-full flex flex-col items-center gap-8 print:gap-0 print:block print:w-full"
          >
            {(() => {
              let pages: any[] = [];
              const rowsPerPage = 15;

              const safeReportData = Array.isArray(reportData)
                ? reportData
                : [];
              const safeLeaveData = Array.isArray(leaveData) ? leaveData : [];

              const isOTReport =
                reportType === "overtime" ||
                reportType === "ot" ||
                safeReportData[0]?.generatedType === "overtime";

              if (isOTReport) {
                const userIds = Array.from(
                  new Set(safeReportData.map((item: any) => item?.userId))
                );

                userIds.forEach((id) => {
                  const userData = safeReportData.filter(
                    (item: any) => item?.userId === id
                  );

                  const totalForUser = userData.reduce(
                    (sum, item) =>
                      sum +
                      (Number(item?.otHours) ||
                        Number(item?.overtimeByRequest) ||
                        0),
                    0
                  );
                  const totalPagesForUser = Math.ceil(
                    userData.length / rowsPerPage
                  );

                  for (let i = 0; i < userData.length; i += rowsPerPage) {
                    const isLastPageForUser =
                      i + rowsPerPage >= userData.length;
                    pages.push({
                      items: userData.slice(i, i + rowsPerPage),
                      totalOtMinutes: isLastPageForUser ? totalForUser : null,
                      isLastPageForUser,
                      currentUser: userData[0],
                      currentPageForUser: Math.floor(i / rowsPerPage) + 1,
                      totalPagesForUser,
                      leaves: isLastPageForUser
                        ? safeLeaveData.filter((l: any) => l.userId === id)
                        : [],
                    });
                  }
                });
              } else {
                for (let i = 0; i < safeReportData.length; i += rowsPerPage) {
                  const isLastPage = i + rowsPerPage >= safeReportData.length;
                  pages.push({
                    items: safeReportData.slice(i, i + rowsPerPage),
                    totalOtMinutes: null,
                    isLastPageForUser: isLastPage,
                    currentPageForUser: Math.floor(i / rowsPerPage) + 1,
                    totalPagesForUser:
                      Math.ceil(safeReportData.length / rowsPerPage) || 1,
                    leaves: isLastPage ? safeLeaveData : [],
                  });
                }
              }

              return pages.map((pageObj: any, pageIndex: number) => {
                const group = Array.isArray(pageObj.items) ? pageObj.items : [];

                return (
                  <div
                    key={pageIndex}
                    className="bg-white w-full max-w-[210mm] min-h-[297mm] shadow-2xl flex flex-col p-12 print:p-10 print:m-0 print:shadow-none print:w-[210mm] print:min-h-[297mm] relative page-break-after-always overflow-hidden font-sans"
                  >
                    {/* Header */}
                    <div className="border-b-4 border-slate-900 pb-4 mb-4 flex justify-between items-start">
                      <div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 uppercase">
                          {admin?.company || "COMPANY NAME"}
                        </h2>
                        <p className="text-slate-600 font-bold text-[12px] mt-1 uppercase">
                          {!isOTReport
                            ? "สรุปรายการการเข้างานพนักงาน"
                            : `สรุปรายการการทำโอที (OT): ${group[0]?.firstName} ${group[0]?.lastName}`}
                        </p>
                        <p className="text-blue-600 font-bold text-[10px] mt-0.5">
                          ประจำวันที่: {formattedStartDate} — {formattedEndDate}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-medium text-slate-400 leading-tight">
                          พิมพ์เมื่อ: {reportDate} {reportTime} <br />
                          Ref:{" "}
                          {Math.random()
                            .toString(36)
                            .substring(2, 8)
                            .toUpperCase()}
                        </div>
                        <div className="mt-2 text-[10px] font-bold text-slate-900 uppercase tracking-widest">
                          หน้าที่ {pageObj.currentPageForUser} จาก{" "}
                          {pageObj.totalPagesForUser}
                        </div>
                      </div>
                    </div>

                    {/* Main Data Table */}
                    <div className="flex-1">
                      <table className="w-full text-left border-collapse border border-slate-300">
                        <thead>
                          <tr className="bg-slate-900 text-white">
                            <th className="px-3 py-2 font-bold text-[10px] uppercase border border-slate-300 w-24 text-center">
                              วันที่
                            </th>
                            <th className="px-3 py-2 font-bold text-[10px] uppercase border border-slate-300">
                              ชื่อ-นามสกุล / รหัส
                            </th>
                            {!isOTReport ? (
                              <>
                                <th className="px-3 py-2 font-bold text-[10px] uppercase border border-slate-300 text-center w-20">
                                  กะงาน
                                </th>
                                <th className="px-3 py-2 font-bold text-[10px] uppercase border border-slate-300 text-center">
                                  จุดปฏิบัติงาน
                                </th>
                                <th className="px-3 py-2 font-bold text-[10px] uppercase border border-slate-300 text-center w-32">
                                  ลงเวลา
                                </th>
                                <th className="px-3 py-2 font-bold text-[10px] uppercase border border-slate-300 text-right w-20">
                                  สถานะ
                                </th>
                              </>
                            ) : (
                              <>
                                <th className="px-3 py-2 font-bold text-[10px] uppercase border border-slate-300 text-center w-20">
                                  เริ่ม (Time)
                                </th>
                                <th className="px-3 py-2 font-bold text-[10px] uppercase border border-slate-300 text-center w-20">
                                  สิ้นสุด (Time)
                                </th>
                                <th className="px-3 py-2 font-bold text-[10px] uppercase border border-slate-300 text-center w-24">
                                  ชั่วโมงอนุมัติ
                                </th>
                                <th className="px-3 py-2 font-bold text-[10px] uppercase border border-slate-300 text-right w-24">
                                  สถานะ/เหตุผล
                                </th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {group.map((a: any, i: number) => (
                            <tr key={i} className="text-[10px] leading-tight">
                              <td className="px-3 py-2 text-center border border-slate-200">
                                {a.date}
                              </td>
                              <td className="px-3 py-2 border border-slate-200 uppercase font-bold text-slate-900">
                                {a.firstName} {a.lastName}
                              </td>
                              {!isOTReport ? (
                                <>
                                  <td className="px-3 py-2 text-center border border-slate-200">
                                    {a.shiftStartTimeSnapshot?.substring(0, 5)}-
                                    {a.shiftEndTimeSnapshot?.substring(0, 5)}
                                  </td>
                                  <td className="px-3 py-2 text-center border border-slate-200 truncate max-w-[150px]">
                                    {a.siteSnapName || "-"}
                                  </td>
                                  <td className="px-3 py-2 text-center border border-slate-200 font-bold">
                                    {a.checkIn?.substring(0, 5) || "--:--"} -{" "}
                                    {a.checkOut?.substring(0, 5) || "--:--"}
                                  </td>
                                  <td className="px-3 py-2 text-right border border-slate-200 font-black">
                                    {a.statusText}
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-3 py-2 text-center border border-slate-200">
                                    {a.timeStart?.substring(0, 5) || "-"}
                                  </td>
                                  <td className="px-3 py-2 text-center border border-slate-200">
                                    {a.timeEnd?.substring(0, 5) || "-"}
                                  </td>
                                  <td className="px-3 py-2 text-center border border-slate-200 font-bold text-blue-600">
                                    {(() => {
                                      const totalMinutes =
                                        Number(a.otHours) ||
                                        Number(a.overtimeByRequest) ||
                                        0;
                                      const h = Math.floor(totalMinutes / 60);
                                      const m = totalMinutes % 60;
                                      return `${h}.${m.toString().padStart(2, "0")}`;
                                    })()}{" "}
                                    ชม.
                                  </td>
                                  <td className="px-3 py-2 text-right border border-slate-200 truncate max-w-[120px]">
                                    {a.otRemark ||
                                      a.reason ||
                                      a.otStatus ||
                                      "-"}
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* --- Leave Information Section --- */}
                      {pageObj.leaves && pageObj.leaves.length > 0 && (
                        <div className="mt-4">
                          <div className="flex items-center gap-2 mb-2 border-l-4 border-red-500 pl-3">
                            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                              รายการข้อมูลการลาที่ได้รับการอนุมัติ (Leave
                              Records)
                            </h3>
                          </div>
                          <table className="w-full border-collapse border border-slate-300">
                            <thead className="bg-slate-50">
                              <tr className="text-[9px] uppercase text-slate-500">
                                <th className="px-3 py-1.5 border border-slate-300 text-center w-40">
                                  ช่วงวันที่ลา (เริ่ม - สิ้นสุด)
                                </th>
                                <th className="px-3 py-1.5 border border-slate-300">
                                  ชื่อ-นามสกุล ผู้ลา
                                </th>
                                <th className="px-3 py-1.5 border border-slate-300 text-center w-20">
                                  จำนวน (วัน)
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {pageObj.leaves.map((l: any, li: number) => (
                                <tr
                                  key={li}
                                  className="text-[9px] border-b border-slate-200"
                                >
                                  <td className="px-3 py-1.5 border border-slate-200 text-center font-medium">
                                    {l.startDate} ถึง {l.endDate}
                                  </td>
                                  <td className="px-3 py-1.5 border border-slate-200 font-bold text-slate-700">
                                    {l.fullName}
                                  </td>
                                  <td className="px-3 py-1.5 border border-slate-200 text-center font-bold text-red-600">
                                    {l.totalDays}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* --- Footer (ส่วนลายเซ็นและสรุปผล) --- */}
                    {pageObj.isLastPageForUser && (
                      <div className="mt-auto border-t-2 border-slate-100 pt-4 print:pb-2">
                        <div className="flex justify-between items-end">
                          {/* ฝั่งซ้าย: สรุปตัวเลข */}
                          <div className="space-y-1">
                            {isOTReport && (
                              <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
                                <p className="text-[10px] font-bold text-blue-600 uppercase">
                                  รวมเวลาโอทีทั้งหมด (สุทธิ)
                                </p>
                                <p className="text-xl font-black text-blue-900">
                                  {(() => {
                                    const totalMinutes =
                                      Number(pageObj.totalOtMinutes) || 0;
                                    const h = Math.floor(totalMinutes / 60);
                                    const m = totalMinutes % 60;
                                    return `${h}.${m.toString().padStart(2, "0")}`;
                                  })()}{" "}
                                  <span className="text-xs font-bold">
                                    ชั่วโมง
                                  </span>
                                </p>
                              </div>
                            )}
                            <p className="text-[9px] text-slate-400 italic">
                              * เอกสารนี้จัดทำโดยระบบอัตโนมัติ
                              ข้อมูลมีความถูกต้องตามการบันทึกในระบบ
                            </p>
                          </div>

                          {/* ฝั่งขวา: ลายเซ็น */}
                          <div className="flex gap-8">
                            <div className="text-center w-40">
                              <div className="h-10 border-b border-slate-300 mb-2"></div>
                              <p className="text-[10px] font-bold text-slate-900 uppercase">
                                ผู้จัดทำ/พนักงาน
                              </p>
                              <p className="text-[9px] text-slate-400">
                                (...................................................)
                              </p>
                            </div>
                            <div className="text-center w-40">
                              <div className="h-10 border-b border-slate-300 mb-2 flex items-end justify-center">
                                <span className="text-[10px] font-black text-slate-800 mb-1 uppercase italic">
                                  {group.find(
                                    (item: any) =>
                                      item?.approvedByName &&
                                      item.approvedByName !== "-"
                                  )?.approvedByName || ""}
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-900 uppercase">
                                ผู้อนุมัติ (Approver)
                              </p>
                              <p className="text-[9px] text-slate-400">
                                วันที่: ...... / ...... / ......
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
      {/* --- 🖨️ MODAL: EDIT SITE & POSITION --- */}
      {showManageModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[600] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
              <h3 className="text-2xl font-black text-slate-900 uppercase italic flex items-center gap-3">
                <span className="bg-slate-900 text-white p-2 rounded-xl not-italic text-sm">
                  ⚙️
                </span>
                จัดการระบบ (ไซต์งาน / ตำแหน่ง / แผนก)
              </h3>
              <button
                onClick={() => setShowManageModal(false)}
                className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all font-black"
              >
                ✕
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-10 custom-scrollbar">
              {/* --- 1. ไซต์งาน --- */}
              <section>
                <h4 className="text-sm font-black text-purple-600 mb-4 uppercase tracking-widest flex items-center gap-2">
                  🏢 รายการไซต์งาน ({allSites.length})
                </h4>
                <div className="bg-slate-50 rounded-3xl overflow-hidden border border-slate-100">
                  <table className="w-full text-left text-sm font-bold">
                    <thead className="bg-slate-100 text-slate-400 text-[10px] uppercase">
                      <tr>
                        <th className="p-4">ชื่อไซต์งาน</th>
                        <th className="p-4 text-center">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allSites.map((site) => (
                        <tr
                          key={site.id}
                          className={`transition-colors group ${
                            site.name === "ทุกไซต์"
                              ? "bg-orange-50 hover:bg-orange-100"
                              : "hover:bg-white"
                          }`}
                        >
                          <td
                            className={`p-4 ${
                              site.name === "ทุกไซต์"
                                ? "text-orange-700"
                                : "text-slate-700"
                            }`}
                          >
                            {site.name}
                          </td>
                          <td className="p-4 flex justify-center gap-2">
                            {site.name !== "ทุกไซต์" && (
                              <button
                                onClick={() => handleUpdateSite(site)}
                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                📝
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteSite(site.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* --- 2. ตำแหน่ง --- */}
              <section>
                <h4 className="text-sm font-black text-pink-600 mb-4 uppercase tracking-widest flex items-center gap-2">
                  💼 รายการตำแหน่งพนักงาน ({allPositions.length})
                </h4>
                <div className="bg-slate-50 rounded-3xl overflow-hidden border border-slate-100">
                  <table className="w-full text-left text-sm font-bold">
                    <thead className="bg-slate-100 text-slate-400 text-[10px] uppercase">
                      <tr>
                        <th className="p-4">ชื่อตำแหน่ง</th>
                        <th className="p-4 text-center">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allPositions.map((pos) => (
                        <tr
                          key={pos.id}
                          className="hover:bg-white transition-colors"
                        >
                          <td className="p-4 text-slate-700">{pos.name}</td>
                          <td className="p-4 flex justify-center gap-2">
                            <button
                              onClick={() => handleEditPos(pos)}
                              className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              📝
                            </button>
                            <button
                              onClick={() => handleDeletePos(pos.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* --- 3. แผนก --- */}
              <section>
                <h4 className="text-sm font-black text-blue-600 mb-4 uppercase tracking-widest flex items-center gap-2">
                  📊 รายการแผนก ({allDepartments.length})
                </h4>
                <div className="bg-slate-50 rounded-3xl overflow-hidden border border-slate-100">
                  <table className="w-full text-left text-sm font-bold">
                    <thead className="bg-slate-100 text-slate-400 text-[10px] uppercase">
                      <tr>
                        <th className="p-4">ชื่อแผนก</th>
                        <th className="p-4 text-center">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allDepartments.map((dept) => (
                        <tr
                          key={dept.id}
                          className="hover:bg-white transition-colors"
                        >
                          <td className="p-4 text-slate-700">{dept.name}</td>
                          <td className="p-4 flex justify-center gap-2">
                            <button
                              onClick={() => handleEditDept(dept)}
                              className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              📝
                            </button>
                            <button
                              onClick={() => handleDeleteDept(dept.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              🗑️
                            </button>
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

      {/* {MODAL : UPDATE COMPANY} */}
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
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                  โลโก้บริษัท
                </label>
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200">
                  <div className="w-20 h-20 rounded-2xl bg-white overflow-hidden flex-shrink-0 border shadow-sm relative">
                    <img
                      src={
                        companyLogoPreview ||
                        companyData?.logoUrl ||
                        "/logo.png"
                      }
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
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                  ชื่อบริษัท (Company Name)
                </label>
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
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                  รายละเอียดบริษัท (Description)
                </label>
                <input
                  name="description"
                  defaultValue={companyData?.description}
                  placeholder="ระบุรายละเอียดหรือสโลแกนบริษัท..."
                  className="w-full p-4 bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl font-bold border outline-none transition-all"
                />
              </div>

              {/* เบอร์โทรศัพท์ */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                  เบอร์โทรศัพท์
                </label>
                <input
                  name="phone"
                  defaultValue={companyData?.phone}
                  placeholder="02-XXX-XXXX"
                  className="w-full p-4 bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl font-bold border outline-none transition-all"
                />
              </div>

              {/* ที่อยู่ */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                  ที่อยู่บริษัท
                </label>
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
                  <span className="text-slate-500 italic font-normal text-[9px] lowercase">
                    *password required
                  </span>
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
                  isSavingCompany
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
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
