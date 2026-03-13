"use client";
import Image from "next/image";

import { useRef, useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { logoutAction } from "@/server/auth";
import {
  checkInAction,
  checkOutAction,
  createLeaveRequest,
  changePasswordAction,
} from "./actions";

// --- เพิ่ม Component LoadingOverlay เหมือนหน้า Leader ---
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

interface Props {
  userProfile: any;
  initialRecords: any[];
  initialLeaves: any[];
  position: string;
  site: string;
}

export default function EmployeeClientPage({
  userProfile,
  initialRecords,
  initialLeaves,
}: Props) {
  const router = useRouter();

  const [records, setRecords] = useState<any[]>(initialRecords);
  const [leaves, setLeaves] = useState<any[]>(initialLeaves);
  const [isProcessing, setIsProcessing] = useState(false);

  // ✅ Sync ข้อมูลจาก Props เมื่อมีการสั่ง router.refresh()
  useEffect(() => {
    setRecords(initialRecords);
  }, [initialRecords]);

  useEffect(() => {
    setLeaves(initialLeaves);
  }, [initialLeaves]);

  const [showCamera, setShowCamera] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [readyToCapture, setReadyToCapture] = useState(false);

  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveSuccess, setLeaveSuccess] = useState(false);
  const [leaveType, setLeaveType] = useState("");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveError, setLeaveError] = useState("");

  const [leaveFileBase64, setLeaveFileBase64] = useState<string | null>(null);
  const [leaveFileName, setLeaveFileName] = useState("");
  const [leaveFilePreview, setLeaveFilePreview] = useState<string | null>(null);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwData, setPwData] = useState({ old: "", new: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ฟังก์ชันคำนวณจำนวนวันลา
  /* ---------------- VALIDATION & CALCULATION LOGIC ---------------- */

  const calculateLeaveDays = (start: string, end: string): number => {
    if (!start || !end) return 0;

    const startDate = new Date(start);
    const endDate = new Date(end);

    // ล้างค่าเวลาให้เหลือ 00:00:00 เพื่อคำนวณเฉพาะจำนวนวัน
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    // ถ้าวันสิ้นสุดมาก่อนวันเริ่มต้น ให้คืนค่าเป็น 0
    if (endDate < startDate) return 0;

    // คำนวณส่วนต่างมิลลิวินาที
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());

    // แปลงเป็นจำนวนวัน และ +1 (เพราะการลาวันที่ 1 ถึงวันที่ 1 คือการลา 1 วัน)
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  // เรียกใช้งานเพื่อให้ UI อัปเดต
  const totalDays = useMemo(
    () => calculateLeaveDays(leaveStart, leaveEnd),
    [leaveStart, leaveEnd]
  );

  // ตรวจสอบความถูกต้องก่อนส่งข้อมูล
  const validateLeaveDates = (start: string, end: string) => {
    if (!start || !end)
      return { isValid: false, error: "⚠️ กรุณาระบุวันที่เริ่มต้นและสิ้นสุด" };

    // ดึงวันที่ปัจจุบันแบบไทย (Asia/Bangkok) เพื่อใช้เปรียบเทียบ
    const now = new Date();
    const today = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
    );
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(end);
    endDate.setHours(0, 0, 0, 0);

    // 1. ตรวจสอบ: ห้ามลาล่วงลับย้อนหลัง (วันเริ่มลาต้องไม่น้อยกว่าวันนี้)
    if (startDate < today) {
      return {
        isValid: false,
        error:
          "⚠️ ไม่สามารถลาย้อนหลังได้ กรุณาเลือกวันที่เริ่มต้นเป็นตั้งแต่วันนี้เป็นต้นไป",
      };
    }

    // 2. ตรวจสอบ: วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่มต้น
    if (endDate < startDate) {
      return {
        isValid: false,
        error: "⚠️ วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น",
      };
    }

    return { isValid: true, error: "" };
  };

  // ตรวจสอบว่าวันที่เลือกถูกต้องตามกฎธุรกิจหรือไม่

  // ✅ คำนวณสถานะปุ่มจากข้อมูลปัจจุบัน (รองรับ Timezone ไทย)
  const todayStatus = useMemo(() => {
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    const todayRecord = records.find((r: any) => r.date === todayStr);
    
    return {
      // เช็คว่ามีค่า checkIn และไม่ใช่ค่าว่าง/ขีด
      hasCheckedIn: !!todayRecord?.checkIn && todayRecord.checkIn !== "-" && todayRecord.checkIn !== null,
      // เช็คว่ามีค่า checkOut และไม่ใช่ค่าว่าง/ขีด
      hasCheckedOut: !!todayRecord?.checkOut && todayRecord.checkOut !== "-" && todayRecord.checkOut !== null,
      record: todayRecord,
    };
  }, [records]);

  /* ---------------- CAMERA LOGIC ---------------- */
  const startCamera = async () => {
    try {
      setIsProcessing(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setShowCamera(true);
      await new Promise((r) => setTimeout(r, 300));
      if (!videoRef.current) throw new Error("video not ready");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setReadyToCapture(true);
    } catch (err) {
      alert("ไม่สามารถเข้าถึงกล้องได้ กรุณาตรวจสอบสิทธิ์การใช้งาน");
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * ฟังก์ชันลดขนาดรูปภาพโดยใช้ Canvas
   * คุมขนาดไม่ให้เกิน ~1MB และลดขนาดกว้างยาวลง
   */
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target.result;
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
          }
        };
      };
    });
  };

  /* ---------------- HANDLERS ---------------- */
  const handleCheckIn = () => {
    setIsCheckingOut(false);
    startCamera();
  };

  const handleCheckOut = () => {
    setIsCheckingOut(true);
    startCamera();
  };

  const handleCapture = async () => {
    if (!videoRef.current || !streamRef.current) return;
    setIsProcessing(true);

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);
    const capturedImg = canvas.toDataURL("image/png");

    streamRef.current.getTracks().forEach((t) => t.stop());
    setShowCamera(false);
    setReadyToCapture(false);

    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: true, // เพิ่มเพื่อกระตุ้นการใช้ GPS ความแม่นยำสูง
          timeout: 10000,
          maximumAge: 0,
        })
      );
      const locationStr = `${pos.coords.latitude.toFixed(
        6
      )}, ${pos.coords.longitude.toFixed(6)}`;

      if (isCheckingOut) {
        const res = await checkOutAction(
          userProfile.id,
          capturedImg,
          locationStr
        );
        if (res.success) {
          alert("ลงชื่อเลิกงานสำเร็จ");
          router.refresh();
        } else {
          alert(res.error || "บันทึกไม่สำเร็จ");
        }
      } else {
        const res = await checkInAction(
          userProfile.id,
          capturedImg,
          locationStr
        );
        if (res.success) {
          alert("ลงชื่อเข้างานสำเร็จ");
          router.refresh();
        } else {
          alert(res.error || "บันทึกไม่สำเร็จ");
        }
      }
    } catch (error: any) {
      // เพิ่มการแจ้งเตือนแยกตามสาเหตุโดยไม่ลบโครงสร้างเดิม
      if (error.code === 1) {
        alert("กรุณาอนุญาตสิทธิ์การเข้าถึงตำแหน่งในเบราว์เซอร์");
      } else if (error.code === 2 || error.code === 3) {
        alert(
          "ไม่สามารถระบุตำแหน่งได้ กรุณาเปิด GPS และตรวจสอบว่าอยู่ในที่โล่ง"
        );
      } else {
        alert(
          "เกิดข้อผิดพลาดในการบันทึกข้อมูลหรือพิกัด กรุณาเปิดตำแหน่ง GPS และลองอีกครั้ง"
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };
  /* ---------------- LEAVE HANDLERS ---------------- */

  // 1. ฟังก์ชันเลือกไฟล์และแปลงเป็น Base64
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessing(true); // เริ่มแสดง Loading
      try {
        // 🚀 เรียกใช้ฟังก์ชันที่คุณส่งมา (ส่งตัวแปร file เข้าไปโดยตรง)
        const compressedBase64 = await compressImage(file);

        setLeaveFileBase64(compressedBase64); // สำหรับส่งไป Server
        setLeaveFilePreview(compressedBase64); // สำหรับแสดงตัวอย่างรูป
        setLeaveFileName(file.name);
      } catch (error) {
        console.error("Compression failed:", error);
        alert("ไม่สามารถประมวลผลรูปภาพได้");
      } finally {
        setIsProcessing(false); // ปิด Loading
      }
    }
  };

  // 2. ฟังก์ชันส่งคำขอลางาน
  const submitLeave = async () => {
    setLeaveError("");

    // 1. เช็คค่าว่าง
    if (!leaveType || !leaveStart || !leaveEnd || !leaveReason) {
      setLeaveError("กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง");
      return;
    }

    // 2. เรียกใช้ Logic Validation ที่คุณเขียนไว้ (แทรกตรงนี้)
    const validation = validateLeaveDates(leaveStart, leaveEnd);
    if (!validation.isValid) {
      setLeaveError(validation.error);
      return;
    }

    setIsProcessing(true);
    try {
      // เรียกใช้ action โดยส่ง base64File และ fileName ไปด้วย
      const res = await createLeaveRequest({
        userId: userProfile.id,
        type: leaveType,
        start: leaveStart,
        end: leaveEnd,
        reason: leaveReason,
        base64File: leaveFileBase64 || undefined, // ส่งไฟล์รูปภาพ (ถ้ามี)
        fileName: leaveFileName,
      });

      if (res.success) {
        setLeaveSuccess(true);
        router.refresh();
        setTimeout(() => {
          setLeaveSuccess(false);
          setShowLeaveForm(false);
          // Reset States ทั้งหมด
          setLeaveType("");
          setLeaveStart("");
          setLeaveEnd("");
          setLeaveReason("");
          setLeaveFileBase64(null);
          setLeaveFileName("");
          setLeaveFilePreview(null);
        }, 2000);
      } else {
        setLeaveError(res.error || "เกิดข้อผิดพลาดในการส่งใบลา");
      }
    } catch (err) {
      setLeaveError("ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsProcessing(false);
    }
  };

  /* ---------------- OTHER ACTIONS ---------------- */
  const handleLogout = async () => {
    if (!confirm("ยืนยันการออกจากระบบ?")) return;
    setIsProcessing(true);
    try {
      await logoutAction();
      window.location.href = "/login";
    } catch (error) {
      window.location.href = "/login";
    }
  };

  const leaveDays = useMemo(() => {
    if (!leaveStart || !leaveEnd) return 0;
    const start = new Date(leaveStart);
    const end = new Date(leaveEnd);
    if (end < start) return 0;
    return (
      Math.ceil(
        Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1
    );
  }, [leaveStart, leaveEnd]);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* 🟢 TOP NAVIGATION */}
      <nav className="sticky top-0 z-40 w-full bg-white/70 backdrop-blur-xl border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex flex-col border-l-2 border-gray-100 pl-4">
              <h1 className="font-black text-gray-900 tracking-tighter text-xl leading-none">
                SIAM ROYAL <span className="text-blue-600">SYSTEM</span>
              </h1>
              <span className="text-[10px] text-gray-400 font-bold tracking-[0.2em] uppercase mt-1">
                ศูนย์นวัตกรรมแห่งอนาคต
              </span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-black text-gray-800">
                {userProfile.firstName} {/*{userProfile.lastName}*/}
              </span>
              <span className="text-[10px] text-green-500 font-black uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>{" "}
                Online
              </span>
            </div>
            <button
              onClick={handleLogout}
              disabled={isProcessing}
              className="group flex items-center gap-2 px-3 py-2 sm:px-5 sm:py-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100 hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95"
            >
              <span className="text-base sm:text-lg">
                {isProcessing ? "⏳" : "🚪"}
              </span>
              <span className="text-[10px] sm:text-sm font-bold uppercase tracking-tight">
                {isProcessing ? "..." : "ลงชื่อออก"}
              </span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-10">
        {/* 👤 PROFILE CARD */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm mb-10 flex flex-col md:flex-row items-center md:items-start gap-8 border border-white">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-10"></div>
           <Image
              src={
                userProfile?.avatarUrl ||
                userProfile?.profileImage ||
                `https://ui-avatars.com/api/?name=${
                  userProfile?.firstName || "User"
                }`
              }
              alt="Profile"
              width={140}
              height={140}
              className="rounded-[2rem] sm:rounded-[2.5rem] border-4 border-white shadow-2xl w-28 h-28 sm:w-36 sm:h-36 object-cover relative z-10"
              unoptimized
            />
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-2xl shadow-lg flex items-center justify-center z-20">
              <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="flex-1 text-center md:text-left pt-1">
            {/* ชื่อ-นามสกุล */}
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-1">
              ชื่อ : {userProfile.firstName} {/*{userProfile.lastName}*/}
            </h2>

            {/* ข้อมูลต่างๆ */}
            <div className="space-y-2 mb-6"> {/* ใช้ space-y เพื่อความเป็นระเบียบ */}
            <p className="text-gray-500 font-bold text-base sm:text-lg tracking-tight">
              ระดับ : {userProfile.role === "employee" ? "พนักงาน" : "ไม่ระบุ"}
            </p>
              <p className="text-gray-500 font-bold text-base sm:text-lg tracking-tight">
                ตำแหน่ง : {userProfile.position || "ไม่ได้ระบุตำแหน่ง" }
              </p>
              <p className="text-gray-500 font-bold text-base sm:text-lg tracking-tight">
                ไซต์งาน : {userProfile.site || "ทุกไซต์งาน" }
              </p>
              <p className="text-gray-500 font-bold text-base sm:text-lg tracking-tight">
                รอบเข้างาน : {userProfile.startTime && userProfile.endTime 
                  ? `${userProfile.startTime.slice(0, 5)} - ${userProfile.endTime.slice(0, 5)}` 
                  : "ยังไม่ระบุ"}
              </p>
            </div>

            {/* Badges ด้านล่าง */}
            <div className="flex flex-col justify-center md:justify-start items-center md:items-start gap-3 mt-4">
              <div className="w-fit"> {/* ใช้ w-fit เพื่อให้พื้นหลังกว้างพอดีตัวอักษร */}
                <span className="inline-flex items-center bg-gray-100 text-gray-500 text-[12px] px-4 py-2 rounded-xl font-black border border-gray-200 uppercase tracking-widest shadow-sm">
                  USERNAME: {userProfile.userName || "ไม่ได้ระบุ"}
                </span>
              </div>
              {userProfile.department && (
                <div className="w-fit">
                  <span className="inline-flex items-center bg-blue-50 text-blue-600 text-[12px] px-4 py-2 rounded-xl font-black border border-blue-100 uppercase tracking-widest shadow-sm">
                    แผนก: {userProfile.department}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full md:w-auto min-w-[240px]">
            {/* 1. ปุ่มลงชื่อเข้า/ออกงาน */}
            {!todayStatus.hasCheckedIn ? (
              <button
                onClick={handleCheckIn}
                disabled={isProcessing}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-5 rounded-[1.5rem] transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                {isProcessing ? "กำลังประมวลผล..." : "ลงชื่อเข้าทำงาน"}
              </button>
            ) : !todayStatus.hasCheckedOut ? (
              <button
                onClick={handleCheckOut}
                disabled={isProcessing}
                className="w-full bg-slate-900 hover:bg-black text-white font-black px-8 py-5 rounded-[1.5rem] transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                {isProcessing ? "กำลังประมวลผล..." : "ลงชื่อเลิกงาน"}
              </button>
            ) : (
              <div className="w-full bg-green-50 text-green-600 font-black px-8 py-5 rounded-[1.5rem] text-center border border-green-100 flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                บันทึกเวลาครบแล้ววันนี้
              </div>
            )}

            {/* 2. ปุ่มขอลางาน */}
            <button
              onClick={() => setShowLeaveForm(true)}
              className="w-full bg-white border-2 border-gray-100 hover:border-blue-600 hover:text-blue-600 text-gray-500 font-black px-8 py-5 rounded-[1.5rem] transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              ขอลางาน
            </button>

            {/* 3. ปุ่มเปลี่ยนรหัสผ่าน (เพิ่มใหม่ ดีไซน์หรู) */}
            <button
              onClick={() => setShowPasswordModal(true)}
              disabled={isProcessing}
              className="w-full relative group active:scale-[0.97] transition-all duration-300 disabled:opacity-50"
            >
              {/* 1. Background Layer: เงาฟุ้งด้านหลังปุ่มเมื่อ Hover */}
              <div className="absolute inset-0 bg-blue-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[1.5rem]"></div>

              {/* 2. Main Button Body */}
              <div className="relative flex items-center justify-center gap-3 px-8 py-5 rounded-[1.5rem] bg-white border-2 border-gray-50 group-hover:border-blue-500 group-hover:bg-blue-50/30 transition-all duration-300 shadow-sm group-hover:shadow-md">
                {/* 3. Icon Box: มีการหมุนและขยายเล็กน้อย */}
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white group-hover:rotate-12 group-hover:scale-110 transition-all duration-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                </div>

                {/* 4. Text: ใช้ฟอนต์หนาและเว้นระยะตัวอักษรให้ดูพรีเมียม */}
                <span className="text-[11px] font-black text-gray-400 group-hover:text-blue-600 uppercase tracking-[0.15em] transition-colors">
                  {isProcessing ? "กำลังประมวลผล..." : "เปลี่ยนรหัสผ่าน"}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* 📊 CONTENT AREA */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50 space-y-12">
          {!showLeaveForm && (
            <>
              <div className="space-y-6">
  <div className="flex items-center justify-between border-b border-gray-50 pb-6">
    <div className="flex items-center gap-3">
      <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
      <h2 className="font-black text-gray-900 text-xl tracking-tighter uppercase">
        ประวัติ <span className="text-gray-300">การเข้างาน</span>
      </h2>
    </div>
  </div>
  <div className="overflow-x-auto rounded-[2rem] border border-gray-50">
    {/* ปรับ min-w เพิ่มขึ้นเป็น 1200px เพื่อให้มีพื้นที่พอสำหรับทุกคอลัมน์ */}
    <table className="w-full text-sm min-w-[1200px] table-auto">
      <thead className="bg-gray-50/50 text-gray-400 uppercase text-[10px] font-black tracking-widest">
        <tr>
          <th className="p-6 text-left">วันที่</th>
          <th className="p-6 text-left">รอบเข้างาน</th>
          <th className="p-6 text-left">สถานะการเข้า-ออก</th>
          <th className="p-6 text-left">เวลาเข้า / รูปถ่าย</th>
          <th className="p-6 text-left">เวลาออก / รูปถ่าย</th>
          <th className="p-6 text-center">
            ตำแหน่ง / เขตรับผิดชอบ / ระดับสิทธิ์
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {records.length === 0 ? (
          <tr>
            <td
              colSpan={6}
              className="p-20 text-center text-gray-300 font-bold italic"
            >
              ยังไม่มีข้อมูลการเข้างานในระบบ
            </td>
          </tr>
        ) : (
          records.map((r, i) => (
            <tr
              key={i}
              className="hover:bg-blue-50/10 transition-colors"
            >
              <td className="p-6 font-bold text-gray-800 whitespace-nowrap">
                {r.date}
              </td>
              <td className="py-4 px-6 font-bold text-gray-600">
                <div className="flex flex-col gap-1 whitespace-nowrap">
                  {r.startTime && r.endTime ? (
                    <span className="text-[15px] text-gray-800">
                      {r.startTime.slice(0, 5)} - {r.endTime.slice(0, 5)}
                    </span>
                  ) : (
                    <span className="text-[14px] font-normal text-gray-400">ไม่มีกะงาน</span>
                  )}
                </div>
              </td>
              {/* ส่วนสถานะการเข้างานแบบเรียงซ้ายขวาพร้อมขีดคั่น */}
              <td className="p-6 font-bold whitespace-nowrap">
                <div className="flex items-center gap-0 border border-slate-200 rounded-lg overflow-hidden shadow-sm w-fit">
                  
                  {/* 1. ส่วนการเข้างาน (Check-in) */}
                  <div className="px-3 py-1.5 flex items-center justify-center min-w-[80px]">
                    {r.isLate === 1 ? (
                      <span className="text-red-600 text-sm">⚠️ สาย</span>
                    ) : (
                      <span className="text-emerald-600 text-sm">✅ ปกติ</span>
                    )}
                  </div>

                  {/* เส้นขีดคั่นแนวตั้ง */}
                  <div className="h-4 w-[1px] bg-slate-300"></div>

                  {/* 2. ส่วนการออกงาน (Check-out) */}
                  <div className="px-3 py-1.5 flex items-center justify-center min-w-[100px]">
                    {!r.checkOut || r.checkOut === "-" ? (
                      <span className="text-slate-400 text-sm font-normal">-</span>
                    ) : r.isEarlyExit === "1" ? (
                      <span className="text-orange-600 text-sm">🏃 เลิกก่อนเวลา</span>
                    ) : (
                      <span className="text-emerald-600 text-sm">✅ ปกติ</span>
                    )}
                  </div>

                </div>
              </td>
              <td className="p-6">
                <div className="flex items-center gap-3 whitespace-nowrap">
                  <span className="text-blue-600 font-black bg-blue-50 px-3 py-1.5 rounded-xl">
                    {r.checkIn}
                  </span>
                  {r.imageUrl && (
                    <Image
                      src={r.imageUrl}
                      alt="In"
                      width={40}
                      height={40}
                      className="rounded-xl border-2 border-white shadow-sm object-cover h-10 w-10"
                      unoptimized
                    />
                  )}
                </div>
              </td>
              <td className="p-6">
                <div className="flex items-center gap-3 whitespace-nowrap">
                  <span
                    className={
                      r.checkOut === "-"
                        ? "text-gray-300 font-black"
                        : "text-slate-900 font-black bg-slate-100 px-3 py-1.5 rounded-xl"
                    }
                  >
                    {r.checkOut}
                  </span>
                  {r.checkOutImageUrl && (
                    <Image
                      src={r.checkOutImageUrl}
                      alt="Out"
                      width={40}
                      height={40}
                      className="rounded-xl border-2 border-white shadow-sm object-cover h-10 w-10"
                      unoptimized
                    />
                  )}
                </div>
              </td>
              <td className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-center gap-3 py-1 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-gray-900 uppercase tracking-tight bg-indigo-600 text-white px-3 py-1 rounded-xl shadow-sm">
                      {r.position}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-lg border border-gray-200">
                      <span className="text-base">📍</span>
                      <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                        {r.site}
                      </span>
                    </div>
                    <span className="hidden sm:block text-gray-300">|</span>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2.5 h-2.5 rounded-full shadow-inner ${
                          r.role === "หัวหน้างาน"
                            ? "bg-amber-400"
                            : "bg-emerald-400"
                        }`}
                      ></div>
                      <span className="text-xs font-black text-gray-500 uppercase tracking-widest">
                        {r.role}
                      </span>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
</div>

              <div className="pt-10 border-t border-gray-50">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-2 h-8 bg-indigo-600 rounded-full"></div>
                  <h2 className="font-black text-gray-900 text-xl tracking-tighter uppercase">
                    คำขอ <span className="text-gray-300">ลางานของฉัน</span>
                  </h2>
                </div>
                {leaves.length === 0 ? (
                  <div className="bg-gray-50/50 p-16 rounded-[2.5rem] border-2 border-dashed border-gray-100 text-center text-gray-300 font-black uppercase text-sm">
                    ไม่มีประวัติการขอลางาน
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {leaves.map((l, i) => (
                      <div
                        key={i}
                        className="p-8 border border-gray-100 rounded-[2rem] bg-white hover:shadow-2xl hover:shadow-indigo-500/10 transition-all relative overflow-hidden group"
                      >
                        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <p className="font-black text-gray-900 text-lg uppercase tracking-tight">
                              {l.type}
                            </p>
                            <p className="text-xs font-bold text-indigo-500 mt-1">
                              {l.start} ถึง {l.end}
                            </p>
                          </div>
                          <span
                            className={`text-[9px] px-4 py-2 rounded-full font-black border uppercase tracking-widest ${
                              l.status === "อนุมัติแล้ว"
                                ? "bg-green-50 text-green-600 border-green-100"
                                : l.status === "ปฏิเสธ"
                                ? "bg-red-50 text-red-600 border-red-100"
                                : "bg-amber-50 text-amber-600 border-amber-100"
                            }`}
                          >
                            {l.status}
                          </span>
                        </div>
                        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 text-sm text-gray-600 font-medium italic">
                          {l.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* 📝 LEAVE FORM SECTION */}
          {showLeaveForm && (
            <div className="max-w-2xl mx-auto py-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase mb-2">
                  ยื่นเรื่อง <span className="text-indigo-600">ลางาน</span>
                </h2>
                <div className="w-12 h-1.5 bg-indigo-600 mx-auto rounded-full"></div>
              </div>

              {leaveSuccess ? (
                <div className="p-12 bg-green-50 border border-green-100 text-green-700 rounded-[3rem] text-center space-y-4 shadow-xl">
                  <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto text-white text-4xl">
                    ✓
                  </div>
                  <p className="font-black text-2xl tracking-tighter uppercase">
                    ส่งคำขอลาสำเร็จ
                  </p>
                </div>
              ) : (
                <div className="space-y-6 bg-gray-50/50 p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border border-gray-100 shadow-inner relative">
                  {/* 🔥 แจ้งเตือนข้อผิดพลาด - แสดงเมื่อมี error และล้างออกเมื่อมีการแก้ไขวันที่ */}
                  {leaveError && (
                    <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-[11px] font-black uppercase animate-in slide-in-from-top-2">
                      <span className="mr-2">⚠️</span> {leaveError}
                    </div>
                  )}

                  {/* 1. ประเภทการลา */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
                      ประเภทการลา
                    </label>
                    <select
                      className="w-full bg-white p-5 rounded-[1.5rem] font-black text-gray-700 outline-none shadow-sm border-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer hover:bg-gray-50"
                      value={leaveType}
                      onChange={(e) => {
                        setLeaveType(e.target.value);
                        setLeaveError(""); // ล้าง error เมื่อเปลี่ยนประเภท
                      }}
                    >
                      <option value="">โปรดระบุ</option>
                      <option value="ลาป่วย">ลาป่วย</option>
                      <option value="ลากิจ">ลากิจ</option>
                      <option value="ลาพักร้อน">ลาพักร้อน</option>
                    </select>
                  </div>

                  {/* 2. ส่วนวันที่ พร้อมระบบตรวจสอบความถูกต้อง */}
                  <div className="relative space-y-4">
                    {/* 🗓️ บล็อกแสดงผลจำนวนวัน (แสดงเฉพาะเมื่อวันที่ถูกต้องตาม Logic) */}
                    {totalDays > 0 &&
                      validateLeaveDates(leaveStart, leaveEnd).isValid && (
                        <div className="flex flex-col items-center justify-center py-4 animate-in zoom-in duration-300">
                          <div className="bg-indigo-600 px-8 py-3 rounded-[2rem] shadow-[0_10px_25px_-5px_rgba(79,70,229,0.4)] flex items-center gap-3">
                            <span className="text-[10px] font-black text-indigo-100 uppercase tracking-widest">
                              ระยะเวลา
                            </span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-3xl font-black text-white leading-none">
                                {totalDays}
                              </span>
                              <span className="text-sm font-bold text-white uppercase">
                                วัน
                              </span>
                            </div>
                          </div>
                          <div className="h-4 w-0.5 bg-gradient-to-b from-indigo-600 to-transparent opacity-20"></div>
                        </div>
                      )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative">
                      {/* วันเริ่มต้น */}
                      <div className="space-y-2 group">
                        <label
                          className={`text-[10px] font-black uppercase ml-4 transition-colors ${
                            leaveError?.includes("เริ่มต้น") ||
                            (leaveStart &&
                              !validateLeaveDates(leaveStart, leaveEnd).isValid)
                              ? "text-red-500"
                              : "text-gray-400 group-focus-within:text-indigo-500"
                          }`}
                        >
                          เริ่มต้น
                        </label>
                        <div className="relative">
                          <input
                            type="date"
                            className={`w-full p-5 rounded-[1.8rem] font-black text-gray-700 outline-none shadow-sm border-2 transition-all appearance-none ${
                              leaveError?.includes("เริ่มต้น")
                                ? "border-red-200 bg-red-50/50"
                                : "bg-white border-transparent focus:border-indigo-500"
                            }`}
                            value={leaveStart}
                            onChange={(e) => {
                              setLeaveStart(e.target.value);
                              setLeaveError(""); // ล้าง error ทันทีเพื่อให้สีแดงหายไป
                            }}
                          />
                        </div>
                      </div>

                      {/* วันสิ้นสุด */}
                      <div className="space-y-2 group">
                        <label
                          className={`text-[10px] font-black uppercase ml-4 transition-colors ${
                            leaveError?.includes("สิ้นสุด") ||
                            (leaveEnd &&
                              !validateLeaveDates(leaveStart, leaveEnd).isValid)
                              ? "text-red-500"
                              : "text-gray-400 group-focus-within:text-indigo-500"
                          }`}
                        >
                          สิ้นสุด
                        </label>
                        <div className="relative">
                          <input
                            type="date"
                            className={`w-full p-5 rounded-[1.8rem] font-black text-gray-700 outline-none shadow-sm border-2 transition-all appearance-none ${
                              leaveError?.includes("สิ้นสุด")
                                ? "border-red-200 bg-red-50/50"
                                : "bg-white border-transparent focus:border-indigo-500"
                            }`}
                            value={leaveEnd}
                            onChange={(e) => {
                              setLeaveEnd(e.target.value);
                              setLeaveError(""); // ล้าง error ทันทีเพื่อให้สีแดงหายไป
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. ระบุเหตุผล */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
                      ระบุเหตุผล
                    </label>
                    <textarea
                      className="w-full bg-white p-5 rounded-[1.5rem] font-medium min-h-[120px] outline-none shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-gray-300"
                      placeholder="เขียนเหตุผลประกอบการลาที่นี่..."
                      value={leaveReason}
                      onChange={(e) => {
                        setLeaveReason(e.target.value);
                        if (leaveError === "กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง")
                          setLeaveError("");
                      }}
                    />
                  </div>

                  {/* 4. อัปโหลดและบีบอัดรูปภาพ */}
                  <div className="space-y-3 mt-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
                      เอกสารประกอบ (ไม่เกิน 1MB)
                    </label>
                    <div className="relative group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                        id="leave-file-upload"
                        disabled={isProcessing}
                      />
                      <label
                        htmlFor="leave-file-upload"
                        className="flex flex-col items-center justify-center w-full bg-white border-2 border-dashed border-gray-200 p-6 rounded-[1.5rem] cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group shadow-sm active:scale-[0.98]"
                      >
                        {leaveFilePreview ? (
                          <div className="relative w-full h-32 flex justify-center">
                            <img
                              src={leaveFilePreview}
                              alt="Preview"
                              className="h-full object-contain rounded-xl shadow-md"
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-xl transition-all">
                              <span className="text-white text-[10px] font-black uppercase">
                                เปลี่ยนรูป
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center">
                            <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-2 text-gray-400 group-hover:text-indigo-600 group-hover:rotate-12 transition-all duration-300">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                            </div>
                            <p className="text-[11px] font-black text-gray-400 uppercase tracking-tighter">
                              คลิกเพื่อแนบหลักฐาน
                            </p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* 5. ปุ่มแอคชั่น */}
                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button
                      onClick={submitLeave}
                      disabled={
                        isProcessing || !!leaveError || !leaveStart || !leaveEnd
                      }
                      className="flex-[2] bg-indigo-600 text-white font-black py-6 rounded-[1.5rem] shadow-xl active:scale-95 hover:bg-indigo-700 transition-all uppercase tracking-tighter disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isProcessing ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        "ยืนยันการลา"
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowLeaveForm(false);
                        setLeaveFilePreview(null);
                        setLeaveFileBase64(null);
                        setLeaveError("");
                      }}
                      disabled={isProcessing}
                      className="flex-1 bg-white border-2 border-gray-200 text-gray-400 font-black py-6 rounded-[1.5rem] uppercase hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-30"
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* 🔐 MODAL CHANGE PASSWORD */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div
            className="absolute inset-0"
            onClick={() => !isProcessing && setShowPasswordModal(false)}
          ></div>

          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-300 relative z-10">
            <div className="p-8 sm:p-10">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
                  🔐
                </div>
                <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">
                  เปลี่ยนรหัสผ่านใหม่
                </h3>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
                  Security Update
                </p>
              </div>

              {pwError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-[10px] font-black uppercase animate-shake">
                  ⚠️ {pwError}
                </div>
              )}

              {pwSuccess && (
                <div className="mb-4 p-4 bg-green-50 border border-green-100 text-green-600 rounded-2xl text-[10px] font-black uppercase text-center">
                  🎉 เปลี่ยนรหัสผ่านสำเร็จแล้ว!
                </div>
              )}

              {!pwSuccess && (
                <div className="space-y-4">
                  {/* รหัสผ่านปัจจุบัน */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
                      รหัสผ่านปัจจุบัน
                    </label>
                    <div className="relative">
                      <input
                        type={showOldPw ? "text" : "password"}
                        className="w-full bg-gray-50 p-4 pr-12 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all"
                        value={pwData.old}
                        onChange={(e) => {
                          setPwData({ ...pwData, old: e.target.value });
                          setPwError("");
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPw(!showOldPw)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        {showOldPw ? "ซ่อน" : "ดู"}
                      </button>
                    </div>
                  </div>

                  {/* รหัสผ่านใหม่ */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
                      รหัสผ่านใหม่
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPw ? "text" : "password"}
                        className="w-full bg-gray-50 p-4 pr-12 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all"
                        value={pwData.new}
                        onChange={(e) => {
                          setPwData({ ...pwData, new: e.target.value });
                          setPwError("");
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(!showNewPw)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        {showNewPw ? "ซ่อน" : "ดู"}
                      </button>
                    </div>
                  </div>

                  {/* ยืนยันรหัสผ่านใหม่ */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
                      ยืนยันรหัสผ่านใหม่
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPw ? "text" : "password"}
                        className="w-full bg-gray-50 p-4 pr-12 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all"
                        value={pwData.confirm}
                        onChange={(e) => {
                          setPwData({ ...pwData, confirm: e.target.value });
                          setPwError("");
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw(!showConfirmPw)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        {showConfirmPw ? "ซ่อน" : "ดู"}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={async () => {
                        if (!pwData.old || !pwData.new || !pwData.confirm)
                          return setPwError("กรุณากรอกข้อมูลให้ครบ");
                        if (pwData.new !== pwData.confirm)
                          return setPwError("รหัสผ่านใหม่ไม่ตรงกัน");

                        setIsProcessing(true);
                        const res = await changePasswordAction({
                          userId: userProfile.id,
                          oldPassword: pwData.old,
                          newPassword: pwData.new,
                        });
                        setIsProcessing(false);

                        if (res.success) {
                          setPwSuccess(true);
                          setTimeout(() => {
                            setShowPasswordModal(false);
                            setPwSuccess(false);
                            setPwData({ old: "", new: "", confirm: "" });
                            // รีเซ็ตการเปิดตาด้วย
                            setShowOldPw(false);
                            setShowNewPw(false);
                            setShowConfirmPw(false);
                          }, 2000);
                        } else {
                          setPwError(res.error);
                        }
                      }}
                      disabled={isProcessing}
                      className="flex-[2] bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all uppercase text-xs tracking-widest disabled:opacity-50 disabled:grayscale"
                    >
                      {isProcessing ? "กำลังประมวลผล..." : "อัปเดตรหัสผ่าน"}
                    </button>
                    <button
                      onClick={() => {
                        setShowPasswordModal(false);
                        setPwError("");
                      }}
                      disabled={isProcessing}
                      className="flex-1 bg-gray-100 text-gray-400 font-black py-4 rounded-2xl uppercase text-xs tracking-widest disabled:opacity-30"
                    >
                      ปิด
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 📸 MODAL CAMERA */}
      {showCamera && (
        <div className="fixed inset-0 bg-slate-900/98 flex flex-col items-center justify-center z-[999] p-6 backdrop-blur-2xl">
          <div className="w-full max-w-[320px] relative">
            <div className="absolute -top-12 left-0 w-full flex justify-between px-2">
              <span className="text-blue-400 text-[10px] font-black tracking-widest uppercase animate-pulse">
                Scanning Identity...
              </span>
            </div>
            <div className="relative rounded-[3rem] overflow-hidden border-[10px] border-white/5 shadow-2xl bg-black aspect-[3/4]">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute inset-0 pointer-events-none">
                <div className="w-full h-full border-[20px] border-black/20 rounded-[2rem]">
                  <div className="w-full h-[2px] bg-blue-400 shadow-[0_0_20px_#60a5fa] absolute animate-scan"></div>
                </div>
              </div>
            </div>
            <div className="mt-12 flex flex-col items-center gap-10">
              {readyToCapture && !isProcessing && (
                <button
                  onClick={handleCapture}
                  className="w-20 h-20 bg-white rounded-full border-4 border-blue-600 shadow-[0_0_40px_rgba(255,255,255,0.2)] active:scale-75 transition-all"
                ></button>
              )}
              {isProcessing && (
                <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
              )}
              <button
                onClick={() => {
                  streamRef.current?.getTracks().forEach((t) => t.stop());
                  setShowCamera(false);
                }}
                className="text-white/30 font-black text-[25px] uppercase tracking-widest"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🟢 LOADING OVERLAY สำหรับเคสที่กดจากข้างนอก */}
      {isProcessing && !showCamera && (
        <div className="fixed inset-0 z-[1000] bg-white/60 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-[10px] font-black text-blue-600 tracking-widest uppercase">
              Processing...
            </p>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes scan {
          0% {
            top: 10%;
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            top: 90%;
            opacity: 0;
          }
        }
        .animate-scan {
          animation: scan 3s ease-in-out infinite;
        }
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-5px);
          }
          75% {
            transform: translateX(5px);
          }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
}
