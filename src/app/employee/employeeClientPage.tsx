"use client";
import Image from "next/image";

import { useRef, useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAllSitesAction } from "@/app/employee/actions";
import { logoutAction } from "@/server/auth";
import {
  checkInAction,
  checkOutAction,
  createLeaveRequest,
  changePasswordAction,
  createPersonalOTAction,
} from "./actions";

import { OffsiteCheckOutConfirm } from "@/app/component/modal/OffsiteCheckOutConfirm";

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

// --- ส่วนที่เพิ่ม: Component Popup สำหรับยืนยันเมื่ออยู่นอกพื้นที่ ---
const OffsiteConfirmPopup = ({
  onConfirm,
  onCancel,
  siteName,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  siteName: string;
}) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl border border-amber-100">
      <div className="text-center">
        <div className="flex justify-center mb-4 text-amber-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-12 h-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          อยู่นอกพื้นที่งาน
        </h3>
        <p className="text-gray-600 mb-6 text-sm">
          คุณไม่ได้อยู่ในรัศมีของไซต์งาน{" "}
          <span className="font-semibold text-blue-600"></span> <br />
          ต้องการยืนยันการบันทึกข้อมูลหรือไม่?
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 font-semibold text-gray-700 bg-gray-100 rounded-xl active:scale-95 transition-transform"
        >
          ยกเลิก
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 px-4 py-2.5 font-semibold text-white bg-amber-500 rounded-xl hover:bg-amber-600 shadow-md active:scale-95 transition-transform"
        >
          ยืนยัน
        </button>
      </div>
    </div>
  </div>
);

interface Props {
  userProfile: any;
  initialRecords: any[];
  initialLeaves: any[];
  initialOT?: any[]; // ✅ ถูกต้องแล้ว
  position: string;
  site: string;
  companyData: {
    name: string;
    logoUrl: string | null;
    description: string;
  };
}

export default function EmployeeClientPage({
  userProfile,
  initialRecords,
  initialLeaves,
  companyData,
  initialOT = [], // ✨ แก้ไขตรงนี้จาก : เป็น = เพื่อกำหนดค่า Default และให้ตัวแปรถูกประกาศ
}: Props) {
  const router = useRouter();

  const [records, setRecords] = useState<any[]>(initialRecords);
  const [leaves, setLeaves] = useState<any[]>(initialLeaves);

  // ✅ ต้องประกาศ State นี้เพื่อให้ UI ที่บรรทัด 1088 ใช้งานได้ และไม่ขึ้น undefined
  const [overtimeRequests, setOvertimeRequests] = useState<any[]>(initialOT);

  const [isProcessing, setIsProcessing] = useState(false);

  // ✅ Sync ข้อมูลจาก Props เมื่อมีการสั่ง router.refresh()
  useEffect(() => {
    setRecords(initialRecords);
  }, [initialRecords]);

  useEffect(() => {
    setLeaves(initialLeaves);
  }, [initialLeaves]);

  // ✅ ตอนนี้ initialOT จะถูกมองเห็นแล้ว เพราะถูกประกาศไว้ใน Props ด้านบน
  useEffect(() => {
    setOvertimeRequests(initialOT);
  }, [initialOT]);

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

  const [showOffsitePopup, setShowOffsitePopup] = useState(false);
  const [pendingData, setPendingData] = useState<any>(null);

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

  const [showOTModal, setShowOTModal] = useState(false);
  const [otError, setOtError] = useState("");
  const [otSuccess, setOtSuccess] = useState(false);
  const [isProcessingOT, setIsProcessingOT] = useState(false);

  const [otData, setOtData] = useState({
    date: "",
    startTime: "17:00", // ตั้ง Default ไว้เวลาเลิกงานปกติ
    endTime: "19:00",
    siteId: "",
    reason: "",
  });

  const calculateOTHours = (startStr: string, endStr: string) => {
    const [startH, startM] = startStr.split(":").map(Number);
    const [endH, endM] = endStr.split(":").map(Number);

    const startDate = new Date(0, 0, 0, startH, startM);
    const endDate = new Date(0, 0, 0, endH, endM);

    let diff = endDate.getTime() - startDate.getTime();
    if (diff < 0) diff += 24 * 60 * 60 * 1000; // รองรับเคสข้ามคืน

    return (diff / (1000 * 60 * 60)).toFixed(1);
  };

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

    // ดึงวันที่ปัจจุบันแบบไทย (UTC) เพื่อใช้เปรียบเทียบ
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

  // ✅ คำนวณสถานะปุ่มจากข้อมูลปัจจุบัน (รองรับ Timezone ไทย)d
  const todayStatus = useMemo(() => {
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat("en-CA", {
      // แก้ตรงนี้จาก UTC เป็น Asia/Bangkok
      timeZone: "Asia/Bangkok", 
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    const todayRecord = records.find((r: any) => r.date === todayStr);

    return {
      hasCheckedIn:
        !!todayRecord?.checkIn &&
        todayRecord.checkIn !== "-" &&
        todayRecord.checkIn !== null,
      hasCheckedOut:
        !!todayRecord?.checkOut &&
        todayRecord.checkOut !== "-" &&
        todayRecord.checkOut !== null,
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
  const compressImage = (file: any) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event: any) => {
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

  // ✅ ฟังก์ชันช่วยเรียก Action สำหรับงาน Attendance (รักษาโครงสร้างเดิม)
  const executeAttendanceAction = async (isConfirmed = false) => {
    setIsProcessing(true);
    try {
      const { id, img, loc } = pendingData;
      let res;
      if (isCheckingOut) {
        res = await checkOutAction(id, img, loc, isConfirmed);
      } else {
        res = await checkInAction(id, img, loc, isConfirmed);
      }

      if (res.success) {
        if (res.OffsiteCheckOutConfirm) {
          setPendingData({ ...pendingData, siteName: res.siteName });
          setShowOffsitePopup(true);
        } else {
          alert(isCheckingOut ? "ลงชื่อเลิกงานสำเร็จ" : "ลงชื่อเข้างานสำเร็จ");
          setShowOffsitePopup(false);
          router.refresh();
        }
      } else {
        alert(res.error || "บันทึกไม่สำเร็จ");
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsProcessing(false);
    }
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
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        })
      );
      const locationStr = `${pos.coords.latitude.toFixed(
        6
      )}, ${pos.coords.longitude.toFixed(6)}`;

      // 1. เก็บข้อมูลไว้ใน state
      const currentData = {
        id: userProfile.id,
        img: capturedImg,
        loc: locationStr,
      };
      setPendingData(currentData);

      // 2. ลองส่งข้อมูลครั้งแรก (isConfirmed = false)
      let res;
      if (isCheckingOut) {
        res = await checkOutAction(
          currentData.id,
          currentData.img,
          currentData.loc,
          false
        );
      } else {
        res = await checkInAction(
          currentData.id,
          currentData.img,
          currentData.loc,
          false
        );
      }

      if (res.success) {
        // กรณีสำเร็จปกติ (ไม่อยู่นอกพื้นที่)
        alert(isCheckingOut ? "ลงชื่อเลิกงานสำเร็จ" : "ลงชื่อเข้างานสำเร็จ");
        router.refresh();
      } else {
        // 🚩 จุดแก้ไข: ถ้า success เป็น false แต่มี OffsiteCheckOutConfirm เป็น true ให้เปิด Popup แทนการ Alert Error
        if (res.OffsiteCheckOutConfirm) {
          setPendingData({ ...currentData, siteName: res.siteName });
          setShowOffsitePopup(true);
        } else {
          // กรณี Error จริงๆ (เช่น พิกัดเพี้ยน หรือ Error อื่นจาก Server)
          alert(res.error || "บันทึกไม่สำเร็จ");
        }
      }
    } catch (error: any) {
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
  const handleFileChange = async (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessing(true); // เริ่มแสดง Loading
      try {
        // 🚀 เรียกใช้ฟังก์ชันที่คุณส่งมา (ส่งตัวแปร file เข้าไปโดยตรง)
        const compressedBase64 = await compressImage(file);

        setLeaveFileBase64(compressedBase64 as string); // สำหรับส่งไป Server
        setLeaveFilePreview(compressedBase64 as string); // สำหรับแสดงตัวอย่างรูป
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

  const handleOTSubmit = async () => {
    if (!userProfile?.id) {
      return setOtError("ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
    }

    if (!otData.date) return setOtError("กรุณาระบุวันที่ทำ OT");
    if (!otData.reason.trim())
      return setOtError("กรุณาระบุเหตุผลหรือลักษณะงาน");

    try {
      setIsProcessingOT(true);
      setOtError("");

      const res = await createPersonalOTAction({
        userId: userProfile.id,
        userName: userProfile.name,
        date: otData.date,
        startTime: otData.startTime,
        endTime: otData.endTime,
        reason: otData.reason,
      });

      if (res.success) {
        setOtSuccess(true);
        router.refresh();

        setTimeout(() => {
          setShowOTModal(false);
          setOtSuccess(false);
          setOtData({
            date: "",
            startTime: "17:00",
            endTime: "19:00",
            reason: "",
          });
        }, 2500);
      } else {
        setOtError(res.error || res.message || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      setOtError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    } finally {
      setIsProcessingOT(false);
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

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* 🟢 TOP NAVIGATION */}
      <nav className="sticky top-0 z-40 w-full bg-white/70 backdrop-blur-xl border-b border-gray-100 shadow-sm">
        {/* ✅ ปรับจาก px-6 เป็น px-4 สำหรับมือถือ เพื่อลดช่องว่างส่วนเกินด้านข้าง */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* ส่วนโลโก้ด้านซ้าย: ปรับขนาดตามหน้า Leader ที่คุณชอบ (w-12 ถึง sm:w-16) */}
            <div className="flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-xl shadow-lg shadow-blue-200 overflow-hidden">
              <img
                src={companyData?.logoUrl || "/logo.png"}
                alt={companyData?.name || "Logo"}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${
                    companyData?.name || "CP"
                  }&background=2563eb&color=fff`;
                }}
              />
            </div>

            <div className="flex flex-col border-l-2 border-gray-100 pl-4">
              <h1 className="font-black text-gray-900 tracking-tighter text-lg sm:text-xl leading-none uppercase">
                {companyData?.name || "ชื่อบริษัท"}
              </h1>

              {/* ซ่อน Description ในมือถือ และจำกัดความกว้างตามที่คุณปรับจูนไว้ */}
              <span className="hidden sm:block text-[10px] text-gray-400 font-bold tracking-[0.2em] uppercase mt-1 max-w-[440px] line-clamp-2 leading-relaxed whitespace-normal break-words">
                {companyData?.description || "description"}
              </span>

              {/* ปรับแต่ง Employee Panel ให้เป็นสีน้ำเงินสไตล์เดียวกับ Leader */}
              <span className="block text-[9px] md:text-[10px] font-bold text-blue-600 tracking-[0.2em] md:tracking-[0.25em] uppercase opacity-90 mt-1">
                Employee Panel
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-6">
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
              className="group flex items-center gap-1.5 px-2.5 py-2 sm:px-5 sm:py-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100 hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95 w-fit max-w-fit"
            >
              <span className="text-base sm:text-lg leading-none">
                {isProcessing ? "⏳" : "🚪"}
              </span>
              <span className="text-[9px] sm:text-sm font-bold uppercase tracking-tight leading-none">
                {isProcessing ? "..." : "ลงชื่อออก"}
              </span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-10">
        {/* 👤 PROFILE CARD */}
        <div className="bg-white p-5 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm mb-6 sm:mb-10 flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8 border border-white">
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
              className="rounded-[1.5rem] sm:rounded-[2.5rem] border-4 border-white shadow-2xl w-24 h-24 sm:w-36 sm:h-36 object-cover relative z-10"
              unoptimized
            />
            <div className="absolute -bottom-1 -right-1 w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-xl sm:rounded-2xl shadow-lg flex items-center justify-center z-20">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="flex-1 text-center md:text-left pt-1">
            {/* ชื่อ-นามสกุล */}
            <h2 className="text-xl sm:text-3xl font-black text-gray-900 tracking-tight mb-1">
              ชื่อ : {userProfile.firstName} {/*{userProfile.lastName}*/}
            </h2>

            {/* ข้อมูลต่างๆ */}
            <div className="space-y-1 sm:space-y-2 mb-4 sm:mb-6">
              {" "}
              {/* ใช้ space-y เพื่อความเป็นระเบียบ */}
              <p className="text-gray-500 font-bold text-sm sm:text-lg tracking-tight">
                ระดับ :{" "}
                {userProfile.role === "employee" ? "พนักงาน" : "ไม่ระบุ"}
              </p>
              <p className="text-gray-500 font-bold text-sm sm:text-lg tracking-tight">
                ตำแหน่ง : {userProfile.position || "ไม่ได้ระบุตำแหน่ง"}
              </p>
              <p className="text-gray-500 font-bold text-sm sm:text-lg tracking-tight">
                เขตรับผิดชอบ : {userProfile.site || "ทุกไซต์งาน"}
              </p>
              <p className="text-gray-500 font-bold text-sm sm:text-lg tracking-tight">
                รอบเข้างาน :{" "}
                {userProfile.startTime && userProfile.endTime
                  ? `${userProfile.startTime.slice(
                      0,
                      5
                    )} - ${userProfile.endTime.slice(0, 5)}`
                  : "ยังไม่ระบุ"}
              </p>
            </div>

            {/* Badges ด้านล่าง */}
            <div className="flex flex-col justify-center md:justify-start items-center md:items-start gap-2 mt-4">
              <div className="w-fit">
                {" "}
                {/* ใช้ w-fit เพื่อให้พื้นหลังกว้างพอดีตัวอักษร */}
                <span className="inline-flex items-center bg-gray-100 text-gray-500 text-[10px] sm:text-[12px] px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl font-black border border-gray-200 uppercase tracking-widest shadow-sm">
                  USERNAME: {userProfile.userName || "ไม่ได้ระบุ"}
                </span>
              </div>
              {userProfile.department && (
                <div className="w-fit">
                  <span className="inline-flex items-center bg-blue-50 text-blue-600 text-[10px] sm:text-[12px] px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl font-black border border-blue-100 uppercase tracking-widest shadow-sm">
                    แผนก: {userProfile.department}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2.5 w-full md:w-auto min-w-[200px] sm:min-w-[240px]">
            {/* 1. ปุ่มลงชื่อเข้า/ออกงาน (Logic แบบสลับปุ่มเดียวและวนลูป) */}
            {!todayStatus.hasCheckedIn ||
            (userProfile.site === "ทุกไซต์" && todayStatus.hasCheckedOut) ? (
              <button
                onClick={handleCheckIn}
                disabled={isProcessing}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-4 sm:px-8 sm:py-5 rounded-[1.2rem] sm:rounded-[1.5rem] transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 text-sm sm:text-base"
              >
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5"
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
            ) : todayStatus.hasCheckedIn && !todayStatus.hasCheckedOut ? (
              <button
                onClick={() => {
                  // เพิ่มการตรวจสอบสถานะ Pop-up ก่อนเรียก handleCheckOut
                  if (showOffsitePopup) return;
                  handleCheckOut();
                }}
                disabled={isProcessing}
                className="w-full bg-slate-900 hover:bg-black text-white font-black px-6 py-4 sm:px-8 sm:py-5 rounded-[1.2rem] sm:rounded-[1.5rem] transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 text-sm sm:text-base"
              >
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5"
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
              <div className="w-full bg-green-50 text-green-600 font-black px-6 py-4 sm:px-8 sm:py-5 rounded-[1.2rem] sm:rounded-[1.5rem] text-center border border-green-100 flex items-center justify-center gap-2 text-sm sm:text-base">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                บันทึกเวลาครบแล้ว
              </div>
            )}

            {/* 2. ปุ่มขอลางาน */}
            <button
              onClick={() => setShowLeaveForm(true)}
              className="w-full bg-white border-2 border-gray-100 hover:border-blue-600 hover:text-blue-600 text-gray-500 font-black px-6 py-4 sm:px-8 sm:py-5 rounded-[1.2rem] sm:rounded-[1.5rem] transition-all active:scale-95 flex items-center justify-center gap-3 text-sm sm:text-base"
            >
              ขอลางาน
            </button>
            <button
              onClick={() => setShowOTModal(true)}
              className="w-full bg-white border-2 border-gray-100 hover:border-blue-600 hover:text-blue-600 text-gray-500 font-black px-6 py-4 sm:px-8 sm:py-5 rounded-[1.2rem] sm:rounded-[1.5rem] transition-all active:scale-95 flex items-center justify-center gap-3 text-sm sm:text-base"
            >
              ขอทำOT
            </button>

            {/* 3. ปุ่มเปลี่ยนรหัสผ่าน */}
            <button
              onClick={() => setShowPasswordModal(true)}
              disabled={isProcessing}
              className="w-full relative group active:scale-[0.97] transition-all duration-300 disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-blue-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[1.2rem] sm:rounded-[1.5rem]"></div>
              <div className="relative flex items-center justify-center gap-3 px-6 py-4 sm:px-8 sm:py-5 rounded-[1.2rem] sm:rounded-[1.5rem] bg-white border-2 border-gray-50 group-hover:border-blue-500 group-hover:bg-blue-50/30 transition-all duration-300 shadow-sm group-hover:shadow-md">
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-50 rounded-lg sm:rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white group-hover:rotate-12 group-hover:scale-110 transition-all duration-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5 sm:h-4 sm:w-4"
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
                <span className="text-[10px] sm:text-[11px] font-black text-gray-400 group-hover:text-blue-600 uppercase tracking-[0.1em] sm:tracking-[0.15em] transition-colors">
                  {isProcessing ? "กำลังประมวลผล..." : "เปลี่ยนรหัสผ่าน"}
                </span>
              </div>
            </button>

            {/* ส่วนเรียกใช้ Pop-up ยืนยันนอกพื้นที่ */}
            {showOffsitePopup && (
              <OffsiteCheckOutConfirm
                siteName={pendingData?.siteName || "ไซต์งาน"}
                onCancel={() => {
                  setShowOffsitePopup(false);
                  setIsCheckingOut?.(false);
                }}
                onConfirm={async () => {
                  // เรียก handleCheckOut อีกครั้งโดยส่งพารามิเตอร์ยืนยัน (ถ้าฟังก์ชันรองรับ)
                  // หรือเรียก API บันทึกข้อมูลโดยตรง
                  await handleFinalCheckOut?.(true);
                }}
              />
            )}
          </div>
        </div>

        {/* 📊 CONTENT AREA */}
        <div className="bg-white p-5 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-gray-50 space-y-8 sm:space-y-12">
          {!showLeaveForm && (
            <>
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-gray-50 pb-4 sm:pb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 sm:w-2 sm:h-8 bg-blue-600 rounded-full"></div>
                    <h2 className="font-black text-gray-900 text-lg sm:text-xl tracking-tighter uppercase">
                      ประวัติการเข้างาน <span className="text-gray-300"></span>
                    </h2>
                  </div>
                </div>

                {/* ✅ ปรับความกว้างรวมของตารางให้ลดลง (min-w) เพื่อไม่ให้แผ่กว้างเกินไป */}
                <div className="overflow-x-auto overflow-y-auto max-h-[450px] sm:max-h-[350px] rounded-[1.5rem] sm:rounded-[2rem] border border-gray-50">
                  <table className="w-full text-xs sm:text-sm min-w-[700px] sm:min-w-[800px] table-auto">
                    <thead className="bg-gray-50/50 text-gray-400 uppercase text-[9px] sm:text-[10px] font-black tracking-widest sticky top-0 z-10 backdrop-blur-md">
                      <tr>
                        <th className="p-4 text-left w-[120px]">วันที่</th>
                        <th className="p-4 text-left w-[150px]">รอบเข้างาน</th>
                        <th className="p-4 text-left w-[200px]">
                          สถานะการเข้า-ออก
                        </th>
                        <th className="p-4 text-left w-[120px]">เวลาเข้า</th>
                        <th className="p-4 text-left w-[120px]">เวลาออก</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {records.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="p-10 sm:p-20 text-center text-gray-300 font-bold italic"
                          >
                            ยังไม่มีข้อมูลการเข้างานในระบบ
                          </td>
                        </tr>
                      ) : (
                        [...records]
                          .sort((a, b) => {
                            const dateA = new Date(
                              `${a.date} ${
                                a.checkIn !== "-" ? a.checkIn : "00:00"
                              }`
                            ).getTime();
                            const dateB = new Date(
                              `${b.date} ${
                                b.checkIn !== "-" ? b.checkIn : "00:00"
                              }`
                            ).getTime();
                            return dateB - dateA;
                          })
                          .map((r, i) => (
                            <tr
                              key={i}
                              className="hover:bg-blue-50/10 transition-colors"
                            >
                              <td className="p-4 font-bold text-gray-800 whitespace-nowrap">
                                {r.date}
                              </td>
                              <td className="p-4 font-bold text-gray-600">
                                <div className="flex flex-col gap-1 whitespace-nowrap">
                                  {r.startTime && r.endTime ? (
                                    <span className="text-[13px] sm:text-[15px] text-gray-800">
                                      {r.startTime.slice(0, 5)} -{" "}
                                      {r.endTime.slice(0, 5)}
                                    </span>
                                  ) : (
                                    <span className="text-[12px] sm:text-[14px] font-normal text-gray-400">
                                      ไม่มีกะงาน
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 font-bold whitespace-nowrap">
                                <div className="flex items-center gap-0 border border-slate-200 rounded-lg overflow-hidden shadow-sm w-fit bg-white text-[11px] sm:text-xs">
                                  {/* ส่วนการเข้างาน */}
                                  <div className="px-2 py-1 flex items-center justify-center min-w-[65px]">
                                    {r.isLate === 1 ? (
                                      <span className="text-red-600">
                                        ⚠️ สาย
                                      </span>
                                    ) : (
                                      <span className="text-emerald-600">
                                        ✅ ปกติ
                                      </span>
                                    )}
                                  </div>
                                  <div className="h-3 w-[1px] bg-slate-300"></div>
                                  {/* ส่วนการออกงาน */}
                                  <div className="px-2 py-1 flex items-center justify-center min-w-[65px]">
                                    {!r.checkOut || r.checkOut === "-" ? (
                                      <span className="text-slate-400">-</span>
                                    ) : r.isEarlyExit === "1" ? (
                                      <span className="text-orange-600">
                                        🏃 เลิกก่อน
                                      </span>
                                    ) : (
                                      <span className="text-emerald-600">
                                        ✅ ปกติ
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center whitespace-nowrap">
                                  <span className="text-blue-600 font-black bg-blue-50 px-2.5 py-1 rounded-lg">
                                    {r.checkIn}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center whitespace-nowrap">
                                  <span
                                    className={
                                      r.checkOut === "-"
                                        ? "text-gray-300 font-black px-2.5 py-1"
                                        : "text-slate-900 font-black bg-slate-100 px-2.5 py-1 rounded-lg"
                                    }
                                  >
                                    {r.checkOut}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* {ตารางคำขอลางาน} */}
              <div className="pt-10 border-t border-gray-50">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-2 h-8 bg-indigo-600 rounded-full"></div>
                  <h2 className="font-black text-gray-900 text-xl tracking-tighter uppercase">
                    คำขอลางานของฉัน
                  </h2>
                </div>
                {leaves.length === 0 ? (
                  <div className="bg-gray-50/50 p-16 rounded-[2.5rem] border-2 border-dashed border-gray-100 text-center text-gray-300 font-black uppercase text-sm">
                    ไม่มีประวัติการขอลางาน
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* ✅ นำ .slice().reverse() ออกเพื่อให้เรียงลำดับตามที่ API ส่งมา (createdAt desc) */}
                    {leaves.map((l, i) => (
                      <div
                        key={i}
                        className="p-8 border border-gray-100 rounded-[2rem] bg-white hover:shadow-2xl hover:shadow-indigo-500/10 transition-all relative overflow-hidden group"
                      >
                        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <div className="text-[13px] font-black text-gray-600">
                              ขอเมื่อ : {l.requestDate}
                            </div>
                            <p className="font-black text-indigo-900 text-lg uppercase tracking-tight">
                              {l.type}
                            </p>
                            <p className="text-xs font-bold text-black-500 mt-1">
                              ตั้งแต่ {l.start} ถึง {l.end}
                            </p>
                          </div>
                          <span
                            className={`text-[11px] px-4 py-2 rounded-full font-black border uppercase tracking-widest ${
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
                        <div className="mt-4 py-4 border-y border-gray-100">
                          <div className="text-[16px] font-bold text-gray-900 leading-relaxed">
                            <span className="text-indigo-600 mr-2 font-black">
                              หมายเหตุ:
                            </span>
                            {l.remark || "-"}
                          </div>
                          <div className="text-[16px] font-bold text-gray-900 leading-relaxed">
                            <span className="text-indigo-600 mr-2 font-black">
                              ผู้จัดการคำขอ:
                            </span>
                            {l.approverName || "-"}
                          </div>
                          <div className="text-[12px] font-bold text-gray-900 leading-relaxed">
                            <span className="text-indigo-600 mr-2 font-black">
                              ตำแหน่ง:
                            </span>
                            {l.approverPosition || "-"}
                          </div>
                        </div>
                        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 text-sm text-gray-600 font-medium italic">
                          {l.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* {ตารางคำขอOT} */}

              <div className="pt-10 border-t border-gray-50">
                {/* Header Section */}
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-2 h-8 bg-indigo-600 rounded-full"></div>
                  <h2 className="font-black text-gray-900 text-xl tracking-tighter uppercase">
                    คำขอ OT ของฉัน
                  </h2>
                </div>

                {overtimeRequests.length === 0 ? (
                  /* Empty State */
                  <div className="bg-gray-50/50 p-16 rounded-[2.5rem] border-2 border-dashed border-gray-100 text-center text-gray-300 font-black uppercase text-sm">
                    ไม่มีประวัติการขอ OT
                  </div>
                ) : (
                  /* Grid List */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {overtimeRequests.map((ot, i) => (
                      <div
                        key={i}
                        className="p-8 border border-gray-100 rounded-[2rem] bg-white hover:shadow-2xl hover:shadow-indigo-500/10 transition-all relative overflow-hidden group"
                      >
                        {/* Accent Line */}
                        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>

                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <div className="text-[13px] font-black text-gray-600">
                              ส่งคำขอเมื่อ :{" "}
                              {new Date(ot.createdAt).toLocaleDateString(
                                "th-TH"
                              )}
                            </div>
                            <p className="font-black text-indigo-900 text-lg uppercase tracking-tight">
                              ทำงานล่วงเวลา (OT)
                            </p>
                            <p className="text-xs font-bold text-gray-500 mt-1">
                              วันที่ทำ: {ot.date} | {ot.startTime} -{" "}
                              {ot.endTime}
                            </p>
                          </div>

                          {/* Status Badge */}
                          <span
                            className={`text-[11px] px-4 py-2 rounded-full font-black border uppercase tracking-widest ${
                              ot.status === "approved"
                                ? "bg-green-50 text-green-600 border-green-100"
                                : ot.status === "rejected"
                                ? "bg-red-50 text-red-600 border-red-100"
                                : "bg-amber-50 text-amber-600 border-amber-100"
                            }`}
                          >
                            {ot.status === "approved"
                              ? "อนุมัติแล้ว"
                              : ot.status === "rejected"
                              ? "ปฏิเสธ"
                              : "รออนุมัติ"}
                          </span>
                        </div>

                        <div className="mt-4 py-4 border-y border-gray-100">
                          {/* OT Duration */}
                          <div className="text-[16px] font-bold text-gray-900 leading-relaxed">
                            <span className="text-indigo-600 mr-2 font-black">
                              รวมเวลาที่ขอ:
                            </span>
                            {ot.overtimeByRequest} นาที (~
                            {(ot.overtimeByRequest / 60).toFixed(2)} ชม.)
                          </div>

                          {/* Approver Info */}
                          <div className="text-[16px] font-bold text-gray-900 leading-relaxed">
                            <span className="text-indigo-600 mr-2 font-black">
                              ผู้อนุมัติ:
                            </span>
                            {ot.approverName || "-"}
                          </div>

                          {/* บันทึกระบบ (จากฝั่ง Admin/Leader) */}
                          <div className="text-[12px] font-bold text-gray-400 leading-relaxed truncate">
                            <span className="text-indigo-600 mr-2 font-black">
                              บันทึกระบบ:
                            </span>
                            {ot.remark || "-"}
                          </div>
                        </div>

                        {/* Reason Box (เหตุผลที่พนักงานกรอก) */}
                        <div className="mt-4 bg-gray-50 p-5 rounded-2xl border border-gray-100 text-sm text-gray-600 font-medium italic">
                          <span className="font-bold not-italic text-gray-900 block mb-1">
                            เหตุผลที่ขอ:
                          </span>
                          {ot.reason || "ไม่ระบุเหตุผล"}
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

      {/* {MODAL OT REQUEST} */}
      {showOTModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div
            className="absolute inset-0"
            onClick={() =>
              !isProcessingOT && !otSuccess && setShowOTModal(false)
            }
          ></div>

          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-300 relative z-10">
            <div className="p-8 sm:p-10">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
                  ⏰
                </div>
                <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">
                  ขออนุมัติทำงานล่วงเวลา
                </h3>
                <p className="text-orange-500 text-[10px] font-black uppercase tracking-widest mt-1">
                  Overtime Request
                </p>
              </div>

              {otError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-[10px] font-black uppercase animate-shake">
                  ⚠️ {otError}
                </div>
              )}

              {otSuccess ? (
                <div className="py-6 text-center space-y-4 animate-in zoom-in">
                  <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto text-white text-3xl shadow-lg">
                    ✓
                  </div>
                  <p className="font-black text-green-600 uppercase tracking-tighter">
                    ส่งคำขอ OT สำเร็จแล้ว!
                  </p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase animate-pulse">
                    กำลังปิดหน้าต่างอัตโนมัติ...
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* วันที่ต้องการทำ OT */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
                      วันที่ต้องการทำ OT
                    </label>
                    <input
                      type="date"
                      className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-500 transition-all"
                      value={otData.date}
                      onChange={(e) => {
                        setOtData({ ...otData, date: e.target.value });
                        setOtError("");
                      }}
                    />
                  </div>

                  {/* 🕒 ส่วนเลือกเวลา เริ่ม - สิ้นสุด */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
                        ตั้งแต่กี่โมง
                      </label>
                      <input
                        type="time"
                        className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-500 transition-all cursor-pointer"
                        value={otData.startTime}
                        onChange={(e) =>
                          setOtData({ ...otData, startTime: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
                        ถึงกี่โมง
                      </label>
                      <input
                        type="time"
                        className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-500 transition-all cursor-pointer"
                        value={otData.endTime}
                        onChange={(e) =>
                          setOtData({ ...otData, endTime: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  {/* 📊 แสดงจำนวนชั่วโมงที่คำนวณได้ */}
                  {otData.startTime && otData.endTime && (
                    <div className="p-4 bg-orange-50/50 border border-dashed border-orange-200 rounded-2xl flex items-center justify-between">
                      <span className="text-[10px] font-black text-orange-600 uppercase ml-2 italic">
                        Total Hours
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-orange-600 italic">
                          {(() => {
                            const start = otData.startTime.split(":");
                            const end = otData.endTime.split(":");
                            const startDate = new Date(
                              0,
                              0,
                              0,
                              parseInt(start[0]),
                              parseInt(start[1]),
                              0
                            );
                            const endDate = new Date(
                              0,
                              0,
                              0,
                              parseInt(end[0]),
                              parseInt(end[1]),
                              0
                            );
                            let diff = endDate.getTime() - startDate.getTime();
                            if (diff < 0) diff += 24 * 60 * 60 * 1000; // รองรับเคสข้ามคืน
                            return (diff / (1000 * 60 * 60)).toFixed(1);
                          })()}
                        </span>
                        <span className="text-[10px] font-black text-orange-400 uppercase">
                          ชั่วโมง
                        </span>
                      </div>
                    </div>
                  )}

                  {/* เหตุผล */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
                      เหตุผล/งานที่ทำ
                    </label>
                    <textarea
                      className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-500 transition-all min-h-[80px]"
                      placeholder="ระบุรายละเอียดสั้นๆ..."
                      value={otData.reason}
                      onChange={(e) =>
                        setOtData({ ...otData, reason: e.target.value })
                      }
                    />
                  </div>

                  {/* ปุ่มกด */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleOTSubmit}
                      disabled={isProcessingOT}
                      className="flex-[2] bg-orange-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all uppercase text-xs tracking-widest disabled:opacity-50"
                    >
                      {isProcessingOT ? "กำลังบันทึก..." : "ยืนยันส่งคำขอ"}
                    </button>
                    <button
                      onClick={() => {
                        setShowOTModal(false);
                        setOtError("");
                      }}
                      disabled={isProcessingOT}
                      className="flex-1 bg-gray-100 text-gray-400 font-black py-4 rounded-2xl uppercase text-xs tracking-widest"
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
      {/* --- 3. FLOATING POPUPS & CAMERA --- */}
      {showOffsitePopup && (
        <OffsiteConfirmPopup
          siteName={pendingData?.siteName || "ไซต์งาน"}
          onCancel={() => setShowOffsitePopup(false)}
          onConfirm={() => executeAttendanceAction(true)}
        />
      )}
    </div>
  );
}
