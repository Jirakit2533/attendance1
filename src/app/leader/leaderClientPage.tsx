"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { logoutAction } from "@/server/auth";
import { useUploadThing } from "@/lib/uploadthing";
import {
  saveAttendanceAction,
  createLeaveRequestAction,
  updateLeaveStatusAction,
  changePasswordAction,
} from "./actions";

/* ---------------- COMPONENTS ---------------- */

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
    <div className="flex items-center gap-4 mb-8">
      <div className="h-10 w-2 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full shadow-lg shadow-blue-200"></div>
      <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">
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

/* ---------------- MAIN COMPONENT ---------------- */

export default function LeaderClientPage({
  userProfile,
  myRecords = [],
  initialLeaves = [],
  initialAttendance = [],
}: any) {
  const router = useRouter();

  // --- States ---
  const [records, setRecords] = useState<any[]>(myRecords);
  const [leaves, setLeaves] = useState<any[]>(initialLeaves);
  const [teamAttendance, setTeamAttendance] =
    useState<any[]>(initialAttendance);

  // Sync states when props change
  useEffect(() => {
    setRecords(myRecords);
  }, [myRecords]);
  useEffect(() => {
    setLeaves(initialLeaves);
  }, [initialLeaves]);
  useEffect(() => {
    setTeamAttendance(initialAttendance);
  }, [initialAttendance]);

  const { startUpload: uploadAttendance } = useUploadThing("imageUploader");
  const { startUpload: uploadLeave } = useUploadThing("leaveFileUploader");

  const [showCamera, setShowCamera] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [readyToCapture, setReadyToCapture] = useState(false);
  const [searchAtt, setSearchAtt] = useState("");

  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveSuccess, setLeaveSuccess] = useState(false);
  const [leaveType, setLeaveType] = useState("");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveError, setLeaveError] = useState("");
  const [leaveFile, setLeaveFile] = useState<File | null>(null);
  const [leaveFilePreview, setLeaveFilePreview] = useState<string | null>(null);
  const [searchLeave, setSearchLeave] = useState("");

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwData, setPwData] = useState({ old: "", new: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);

  // ฟังก์ชันคำนวณจำนวนวันลา
  /* ---------------- VALIDATION & CALCULATION LOGIC ---------------- */

  const calculateLeaveDays = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);

    // ล้างค่าเวลาให้เหลือแต่ช่วงวันที่เพื่อการคำนวณที่แม่นยำ
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    if (endDate < startDate) return 0;

    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    // หารด้วยจำนวนมิลลิวินาทีในหนึ่งวัน และ +1 เพื่อให้นับวันแรกด้วย
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  // ตรวจสอบว่าวันที่เลือกถูกต้องตามกฎธุรกิจหรือไม่
  const validateLeaveDates = (start: string, end: string) => {
    if (!start || !end) return { isValid: true, error: "" }; // ยังกรอกไม่ครบ ไม่ต้องด่า

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (startDate < today) {
      return {
        isValid: false,
        error: "⚠️ ไม่สามารถลาล่วงลับย้อนหลังได้ กรุณาตรวจสอบวันที่เริ่มต้น",
      };
    }

    if (endDate < startDate) {
      return {
        isValid: false,
        error: "⚠️ วันที่สิ้นสุดต้องอยู่หลังหรือวันเดียวกับวันที่เริ่มต้น",
      };
    }

    return { isValid: true, error: "" };
  };

  /* ---------------- HELPER FUNCTIONS ---------------- */
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new (window as any).Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 800; // คุมขนาดให้ไม่เกิน 800px เพื่อประหยัดพื้นที่
          let width = img.width;
          let height = img.height;

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
            ctx.fillStyle = "#FFFFFF"; // เติมพื้นหลังสีขาว
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.6)); // บีบอัดคุณภาพ 60%
          }
        };
      };
    });
  };

  /* ---------------- LEAVE LOGIC ---------------- */

  const submitLeave = async () => {
    if (!leaveType || !leaveStart || !leaveEnd || !leaveReason) {
      setLeaveError("⚠️ กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    const dateCheck = validateLeaveDates(leaveStart, leaveEnd);
    if (!dateCheck.isValid) {
      setLeaveError(dateCheck.error);
      return;
    }

    setIsProcessing(true);
    setLeaveError("");

    try {
      let fileUrl = "";
      let fileId = ""; // ✅ เตรียมตัวแปรเก็บ ID
      let fileName = ""; // ✅ เตรียมตัวแปรเก็บชื่อไฟล์

      if (leaveFile) {
        const uploadRes = await uploadLeave([leaveFile]);
        if (uploadRes && uploadRes[0]) {
          fileUrl = uploadRes[0].url;
          fileId = uploadRes[0].key || uploadRes[0].fileId; // ✅ เก็บ Key จาก UploadThing
          fileName = leaveFile.name; // ✅ เก็บชื่อไฟล์ต้นฉบับ
        }
      }

      // เรียก Action
      const res = await createLeaveRequestAction({
        userId: userProfile.id,
        // 💡 ข้อแนะนำ: ถึงแม้จะส่งตรงนี้ไป แต่ผมแนะนำให้ใช้ Server Action
        // เวอร์ชั่นที่ผมแก้ให้ก่อนหน้าที่ดึงจาก DB โดยตรงจะชัวร์กว่าครับ
        type: leaveType,
        startDate: leaveStart,
        endDate: leaveEnd,
        reason: leaveReason,
        fileUrl: fileUrl,
        fileId: fileId, // ✅ ส่งไปให้ครบ
        fileName: fileName, // ✅ ส่งไปให้ครบ
      });

      if (res.success) {
        setLeaveSuccess(true);
        router.refresh();
        setTimeout(() => {
          setShowLeaveForm(false);
          setLeaveSuccess(false);
          setLeaveType("");
          setLeaveStart("");
          setLeaveEnd("");
          setLeaveReason("");
          setLeaveFile(null);
          setLeaveFilePreview(null);
        }, 2000);
      } else {
        setLeaveError(res.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }
    } catch (err) {
      setLeaveError("ระบบขัดข้อง กรุณาลองใหม่ภายหลัง");
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  /* ---------------- CAMERA & ATTENDANCE LOGIC ---------------- */

  const openCamera = async () => {
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

  /* ---------------- MEMOIZED VALUES ---------------- */

  // ✅ 1. แยกใบลาของตัวเอง (เอาเฉพาะ ID ของเราเท่านั้น)
  const myLeaves = useMemo(
    () =>
      leaves.filter(
        (l: any) => l.user_id === userProfile.id || l.userId === userProfile.id
      ),
    [leaves, userProfile.id]
  );

  // ✅ 2. แยกใบลาของลูกน้องในทีม (เอาทุกคน "ยกเว้น" ID ของเรา)
  const teamLeaves = useMemo(
    () =>
      leaves.filter(
        (l: any) => l.user_id !== userProfile.id && l.userId !== userProfile.id
      ),
    [leaves, userProfile.id]
  );

  // ✅ 3. กรองข้อมูลการลาของทีมเพื่อแสดงในตาราง (จะสะอาดทันทีเพราะ teamLeaves กรองออกไปแล้ว)
  const filteredLeaves = useMemo(() => {
    const term = searchLeave.toLowerCase();
    return teamLeaves.filter(
      (l: any) =>
        l.employeeName?.toLowerCase().includes(term) ||
        l.type?.toLowerCase().includes(term) ||
        (l.reason && l.reason.toLowerCase().includes(term))
    );
  }, [teamLeaves, searchLeave]);

  // ✅ 4. กรองข้อมูลการเข้างานของทีม (Attendance)
  const filteredAttendance = useMemo(() => {
    const searchTerm = searchAtt.toLowerCase();
    return teamAttendance.filter(
      (item: any) =>
        item.employeeName?.toLowerCase().includes(searchTerm) ||
        item.positionName?.toLowerCase().includes(searchTerm) ||
        item.date?.includes(searchTerm)
    );
  }, [teamAttendance, searchAtt]);

  const todayStatus = useMemo(() => {
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    const todayRecord = records.find((r: any) => r.date === todayStr);

    // ตัดช่องว่างออกก่อนเช็ค (กรณี DB คืนค่าเป็น "  ")
    const checkOutValue = todayRecord?.checkOut?.toString().trim();

    return {
      hasCheckedIn: !!todayRecord?.checkIn,
      // เช็คว่ามีค่า และค่าต้องไม่เท่ากับ "-" และไม่ว่างเปล่า
      hasCheckedOut:
        !!checkOutValue && checkOutValue !== "-" && checkOutValue !== "",
      record: todayRecord,
    };
  }, [records]);
  /* ---------------- LEADER ACTIONS ---------------- */

  const handleApprove = async (leaveId: string) => {
    if (!confirm("คุณต้องการอนุมัติคำขอลางานนี้ใช่หรือไม่?")) return;
    setIsProcessing(true);
    try {
      const res = await updateLeaveStatusAction(
        leaveId,
        "approved",
        userProfile.id
      );
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error || "เกิดข้อผิดพลาดในการอนุมัติ");
      }
    } catch (error) {
      alert("ระบบขัดข้อง กรุณาลองใหม่ในภายหลัง");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (leaveId: string) => {
    if (!confirm("คุณต้องการปฏิเสธคำขอลางานนี้ใช่หรือไม่?")) return;
    setIsProcessing(true);
    try {
      const res = await updateLeaveStatusAction(
        leaveId,
        "rejected",
        userProfile.id
      );
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error || "เกิดข้อผิดพลาดในการปฏิเสธ");
      }
    } catch (error) {
      alert("ระบบขัดข้อง กรุณาลองใหม่ในภายหลัง");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current || !streamRef.current) return;
    setIsProcessing(true);

    // 1. สร้าง Canvas และบีบอัดเป็น JPEG (คุณภาพ 70%)
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);
    const capturedImage = canvas.toDataURL("image/jpeg", 0.7);

    // ปิดกล้องคืนทรัพยากร
    streamRef.current.getTracks().forEach((t) => t.stop());
    setShowCamera(false);
    setReadyToCapture(false);

    try {
      // 2. ดึงพิกัด (High Accuracy)
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { 
          enableHighAccuracy: true, 
          timeout: 10000, // ปรับเป็น 10 วิ เพื่อไม่ให้ User รอนานเกินไป
          maximumAge: 0 
        })
      ).catch((err) => {
        console.warn("Geolocation error:", err.message);
        return null; 
      });

      const blob = await (await fetch(capturedImage)).blob();
      const file = new File([blob], `attendance_${userProfile.id}_${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      // 3. อัปโหลดรูปภาพ (ใช้ UploadThing หรือ Library ของคุณ)
      const uploadRes = await uploadAttendance([file]);
      if (!uploadRes || uploadRes.length === 0) throw new Error("อัปโหลดรูปภาพไม่สำเร็จ");

      const uploadedFile = uploadRes[0];
      
      // 4. เรียก Action บันทึกข้อมูล (Logic สาย/ออกก่อน จะถูกคำนวณที่ตัว saveAttendanceAction)
      const result = await saveAttendanceAction({
        userId: userProfile.id,
        type: isCheckingOut ? "OUT" : "IN",
        image: uploadedFile.ufsUrl || uploadedFile.url,
        fileId: uploadedFile.key,
        location: pos 
          ? `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`
          : "ไม่ทราบพิกัด (GPS ปิด)", 
        departmentId: userProfile.departmentId, 
        siteId: userProfile.site_id,           
      });

      if (result.success) {
        alert(isCheckingOut ? "บันทึกออกงานสำเร็จ" : "บันทึกเข้างานสำเร็จ");
        // ✅ ใช้ window.location.reload() หรือ router.refresh() 
        // เพื่อให้ข้อมูลในตาราง (isLate/isEarlyExit) อัปเดตล่าสุดจาก DB
        router.refresh(); 
      } else {
        alert("ข้อผิดพลาดจากระบบ: " + result.error);
      }
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      console.error("Capture Error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("ไฟล์มีขนาดใหญ่เกินไป (จำกัด 5MB)");
        return;
      }
      setLeaveFile(file);
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => setLeaveFilePreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setLeaveFilePreview(null);
      }
    }
  };

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

  // ✅ อย่าลืมใส่ LoadingOverlay และส่วน Return ของ JSX ด้านล่างต่อจากนี้ตามเดิมของคุณนะครับ
  return (
    <div className="min-h-screen bg-[#f8fafc] transition-all duration-300">
      {isProcessing && <LoadingOverlay />}
      {/* 🟢 TOP NAVIGATION */}
      <nav className="sticky top-0 z-40 w-full bg-white/70 backdrop-blur-xl border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 group">
            <div className="relative">
              <Image
                src="/logo.png"
                alt="SRS Logo"
                width={40}
                height={40}
                className="w-8 h-8 sm:w-10 sm:h-10"
              />
            </div>
            <div className="flex flex-col border-l-2 border-gray-100 pl-4">
              <h1 className="font-black text-gray-900 tracking-tighter text-lg sm:text-xl leading-none uppercase">
                SRS <span className="text-blue-600">Leader</span> Panel
              </h1>
              <span className="text-[8px] sm:text-[10px] text-gray-400 font-bold tracking-[0.2em] uppercase mt-1">
                ระบบบริหารจัดการระดับสูง
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-black text-gray-800 uppercase tracking-tight">
                {userProfile.firstName}
              </span>
              <span className="text-[10px] text-blue-500 font-black uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>{" "}
                ONLINE
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

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-10">
        {/* 👤 LEADER PROFILE CARD */}
        <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.03)] mb-10 flex flex-col md:flex-row items-center md:items-start gap-8 relative border border-white">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 rounded-full blur-2xl opacity-10"></div>
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
            <div className="absolute -bottom-2 -right-2 w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-2xl shadow-lg flex items-center justify-center z-20">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-blue-500 rounded-full animate-pulse"></div>
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
                ระดับ : {userProfile.role || "หัวหน้า" }
              </p>
              <p className="text-gray-500 font-bold text-base sm:text-lg tracking-tight">
                ตำแหน่ง : {userProfile.position || "ไม่ได้ระบุตำแหน่ง" }
              </p>
              <p className="text-gray-500 font-bold text-base sm:text-lg tracking-tight">
                ไซต์งาน : {userProfile.site || "ทุกไซต์งาน" }
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

          <div className="flex flex-col gap-4 mt-8 w-full md:w-64">
            {/* 1. ยังไม่ได้เช็คอินวันนี้ */}
            {!todayStatus.hasCheckedIn && (
              <button
                onClick={() => {
                  setIsCheckingOut(false);
                  openCamera();
                }}
                disabled={isProcessing}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl uppercase tracking-tighter shadow-lg shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                ลงชื่อเข้างาน (CHECK-IN)
              </button>
            )}

            {/* 2. เช็คอินแล้ว แต่ยังไม่ออก */}
            {todayStatus.hasCheckedIn && !todayStatus.hasCheckedOut && (
              <button
                onClick={() => {
                  setIsCheckingOut(true);
                  openCamera();
                }}
                disabled={isProcessing}
                className="w-full bg-gray-900 hover:bg-black text-white font-black py-4 rounded-2xl uppercase tracking-tighter shadow-lg shadow-gray-200 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                ลงชื่อออกงาน (CHECK-OUT)
              </button>
            )}

            {/* 3. เช็คครบแล้ว (Disabled) */}
            {todayStatus.hasCheckedIn && todayStatus.hasCheckedOut && (
              <div className="w-full bg-gray-50 border border-gray-100 text-gray-400 font-black py-4 rounded-2xl uppercase text-center text-xs tracking-widest">
                วันนี้บันทึกเวลาครบแล้ว
              </div>
            )}

            {/* 4. ปุ่มลางาน */}
            <button
              onClick={() => setShowLeaveForm(true)}
              disabled={isProcessing}
              className="w-full bg-white border-2 border-gray-100 hover:border-indigo-600 hover:text-indigo-600 text-gray-500 font-black py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 uppercase text-sm"
            >
              ขอลางาน (ส่วนตัว)
            </button>

            {/* 5. ปุ่มเปลี่ยนรหัสผ่าน (เพิ่มใหม่) */}
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

        {/* 📊 DASHBOARD CONTENT */}
        {!showLeaveForm && (
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="lg:col-span-2 space-y-8">
              {/* ตารางที่ 1: การเข้างานของฉัน */}
              <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-gray-50 overflow-hidden">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                  <h2 className="font-black text-gray-900 text-xl tracking-tighter uppercase">
                    การเข้างาน <span className="text-gray-300">ของฉัน</span>
                  </h2>
                </div>

                <div className="overflow-x-auto rounded-[1.5rem] -mx-6 px-6 sm:mx-0 sm:px-0">
                  {/* ปรับ min-w เป็น 1100px เพื่อให้มีพื้นที่กว้างขึ้น ไม่ทับซ้อน */}
                  <table className="w-full text-sm min-w-[1100px] border-collapse">
                    <thead className="bg-gray-50/50 text-gray-400 uppercase text-[10px] font-black tracking-widest">
                      <tr>
                        <th className="p-4 text-left">วันที่</th>
                        <th className="p-4 text-left">รอบเข้างาน</th>
                        <th className="p-4 text-left">สถานะการเข้างาน</th>
                        <th className="p-4 text-left">เวลาเข้า / รูปถ่าย</th>
                        <th className="p-4 text-left">เวลาออก / รูปถ่าย</th>
                        <th className="p-4 text-center">
                          ตำแหน่ง  /  เขตรับผิดชอบ  /  ระดับสิทธิ์
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
                            ยังไม่มีข้อมูลการเข้างาน
                          </td>
                        </tr>
                      ) : (
                        records.map((r, i) => {
                          const formatTime = (time: any) => {
                            if (!time || time === "-" || time === "null")
                              return "-";
                            if (typeof time === "string") {
                              const timePart = time.includes(" ")
                                ? time.split(" ")[1]
                                : time;
                              return timePart.split(":").slice(0, 2).join(":");
                            }
                            return new Date(time).toLocaleTimeString("th-TH", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            });
                          };

                          const displayImageIn = r.imageIn || r.image_in;
                          const displayImageOut = r.imageOut || r.image_out;

                          return (
                            <tr
                              key={i}
                              className="hover:bg-blue-50/10 transition-colors"
                            >
                              {/* วันที่ */}
                              <td className="p-4 font-bold text-gray-800 whitespace-nowrap">
                                {r.date || "-"}
                              </td>

                              {/* รอบเข้างาน */}
                              <td className="p-4 font-bold text-gray-600 whitespace-nowrap">
                                <div className="flex flex-col gap-1">
                                  {r.startTime && r.endTime ? (
                                    <span className="text-[15px] text-gray-800">
                                      {r.startTime.slice(0, 5)} - {r.endTime.slice(0, 5)}
                                    </span>
                                  ) : (
                                    <span className="text-[14px] font-normal text-gray-400">ไม่มีกะงาน</span>
                                  )}
                                </div>
                              </td>

                              {/* สถานะ */}
                              <td className="p-4 font-bold whitespace-nowrap">
                                {r.isLate === 1 ? (
                                  <span className="text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 shadow-sm text-sm">
                                    ⚠️ สาย
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm text-sm">
                                    ✅ ปกติ
                                  </span>
                                )}
                              </td>

                              {/* เช็คอิน */}
                              <td className="p-4 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  <span className="text-blue-600 font-black bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
                                    {r.checkIn && r.checkIn !== "-"
                                      ? (r.checkIn.includes("T")
                                          ? r.checkIn.split("T")[1]
                                          : r.checkIn.includes(" ")
                                          ? r.checkIn.split(" ")[1]
                                          : r.checkIn
                                        ).slice(0, 5)
                                      : "--:--"}
                                  </span>
                                  {displayImageIn && (
                                    <Image
                                      src={displayImageIn}
                                      alt="In"
                                      width={40}
                                      height={40}
                                      onClick={() => setViewImage(displayImageIn)}
                                      className="rounded-xl border-2 border-white shadow-sm object-cover h-10 w-10 cursor-zoom-in hover:border-blue-400 active:scale-95 transition-all"
                                      unoptimized
                                    />
                                  )}
                                </div>
                              </td>

                              {/* เช็คเอาท์ */}
                              <td className="p-4 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  <span
                                    className={
                                      !r.checkOut || r.checkOut === "-"
                                        ? "text-gray-300 font-black px-3"
                                        : "text-slate-900 font-black bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200"
                                    }
                                  >
                                    {r.checkOut && r.checkOut !== "-"
                                      ? (r.checkOut.includes("T")
                                          ? r.checkOut.split("T")[1]
                                          : r.checkOut.includes(" ")
                                          ? r.checkOut.split(" ")[1]
                                          : r.checkOut
                                        ).slice(0, 5)
                                      : "-"}
                                  </span>
                                  {displayImageOut && (
                                    <Image
                                      src={displayImageOut}
                                      alt="Out"
                                      width={40}
                                      height={40}
                                      onClick={() => setViewImage(displayImageOut)}
                                      className="rounded-xl border-2 border-white shadow-sm object-cover h-10 w-10 cursor-zoom-in hover:border-blue-400 active:scale-95 transition-all"
                                      unoptimized
                                    />
                                  )}
                                </div>
                              </td>

                              {/* รายละเอียด - ปรับให้ใช้พื้นที่เต็มที่ */}
                              <td className="p-4">
                                <div className="flex items-center gap-3 whitespace-nowrap">
                                  <span className="text-sm font-black text-gray-900 uppercase tracking-tight bg-indigo-600 text-white px-3 py-1 rounded-xl shadow-sm">
                                    {userProfile.position}
                                  </span>

                                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-lg border border-gray-200">
                                    <span className="text-base">📍</span>
                                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                                      {userProfile.siteName || "ทุกไซต์งาน"}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
                                    <div
                                      className={`w-2.5 h-2.5 rounded-full shadow-inner ${
                                        userProfile.role === "leader" || userProfile.role === "หัวหน้างาน"
                                          ? "bg-amber-400"
                                          : "bg-emerald-400"
                                      }`}
                                    ></div>
                                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">
                                      {userProfile.role === "leader" ? "หัวหน้างาน" : "พนักงาน"}
                                    </span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ตารางที่ 2: คำขออนุมัติลางานของฉัน */}
              <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-gray-50">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-2 h-8 bg-amber-400 rounded-full"></div>
                  <h2 className="font-black text-gray-900 text-xl tracking-tighter uppercase">
                    คำขออนุมัติ{" "}
                    <span className="text-gray-300">ลางานของฉัน</span>
                  </h2>
                </div>
                <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead className="bg-gray-50/50 text-gray-400 uppercase text-[10px] font-black tracking-widest">
                      <tr>
                        <th className="p-6 text-left">ประเภท</th>
                        <th className="p-6 text-left">วันที่ลา</th>
                        <th className="p-6 text-left">เหตุผล / หลักฐาน</th>
                        <th className="p-6 text-center">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {myLeaves.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="p-16 text-center text-gray-300 font-bold italic"
                          >
                            ไม่มีประวัติการลา
                          </td>
                        </tr>
                      ) : (
                        myLeaves.map((l: any) => (
                          <tr
                            key={l.id}
                            className="hover:bg-amber-50/10 transition-colors"
                          >
                            <td className="p-6 font-black text-gray-800 uppercase tracking-tighter">
                              {l.type}
                            </td>
                            <td className="p-6 text-[11px] text-gray-500 font-bold">
                              {l.startDate || l.start_date}{" "}
                              <span className="text-gray-300 mx-1">→</span>{" "}
                              {l.endDate || l.end_date}
                            </td>
                            <td className="p-6">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-gray-400 italic line-clamp-1">
                                  {l.reason}
                                </span>
                                {l.fileUrl && (
                                  <a
                                    href={l.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-[10px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest transition-all mt-1 w-fit group"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-3 w-3 group-hover:scale-110 transition-transform"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={3}
                                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                                      />
                                    </svg>
                                    ดูหลักฐานแนบ
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="p-6 text-center">
                              <span
                                className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm border
                                ${
                                  l.status === "approved" ||
                                  l.status === "อนุมัติแล้ว"
                                    ? "bg-green-50 text-green-600 border-green-100"
                                    : l.status === "rejected" ||
                                      l.status === "ปฏิเสธ"
                                    ? "bg-red-50 text-red-600 border-red-100"
                                    : "bg-amber-50 text-amber-600 border-amber-100"
                                }`}
                              >
                                {l.status === "pending"
                                  ? "รออนุมัติ"
                                  : l.status === "approved"
                                  ? "อนุมัติแล้ว"
                                  : l.status === "rejected"
                                  ? "ปฏิเสธ"
                                  : l.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ตารางที่ 3: การเข้างานของพนักงานในทีม */}
              <div className="print:hidden mt-12">
                <Section title="ตารางเข้า-ออกงาน ของพนักงาน">
                  {/* Search Bar */}
                  <div className="mb-6 relative max-w-md group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-500">
                      <span className="text-lg">🔍</span>
                    </div>
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อพนักงาน หรือ วันที่..."
                      className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all shadow-sm"
                      value={searchAtt}
                      onChange={(e) => setSearchAtt(e.target.value)}
                    />
                  </div>

                  <div className="rounded-[2.5rem] border border-slate-100 overflow-hidden bg-white shadow-xl shadow-slate-200/50">
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
                      <table className="min-w-[1300px] w-full text-sm border-separate border-spacing-0">
                        <thead className="sticky top-0 z-20">
                          <tr className="bg-slate-50/80 backdrop-blur-md text-slate-500 font-black uppercase text-[11px] tracking-[0.15em]">
                            <th className="py-6 px-6 text-left border-b border-slate-100">
                              พนักงาน
                            </th>
                            <th className="py-6 px-6 text-left border-b border-slate-100">
                              วันที่
                            </th>
                            <th className="py-6 px-6 text-left border-b border-slate-100">
                              รอบเข้างาน
                            </th>
                            <th className="py-6 px-6 text-left border-b border-slate-100">
                              สถานะากรเข้างาน
                            </th>
                            <th className="py-6 px-6 text-left border-b border-slate-100">
                              ตำแหน่ง
                            </th>
                            <th className="py-6 px-6 text-left border-b border-slate-100">
                              ไซต์งาน
                            </th>
                            <th className="py-6 px-6 text-center border-b border-slate-100">
                              เวลาเข้า
                            </th>
                            <th className="py-6 px-6 text-center border-b border-slate-100">
                              เวลาออก
                            </th>
                            <th className="py-6 px-6 text-center border-b border-slate-100">
                              หลักฐานเข้า-ออก
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredAttendance.length > 0 ? (
                            filteredAttendance.map((a: any, index: number) => (
                              <tr
                                key={index}
                                className="group hover:bg-blue-50/30 transition-all"
                              >
                                <td className="py-5 px-6">
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 relative rounded-2xl overflow-hidden border-2 border-white shadow-sm bg-slate-100">
                                      <Image
                                        src={
                                          a.avatarUrl ||
                                          "https://utfs.io/f/default-avatar-placeholder.png"
                                        }
                                        alt="profile"
                                        fill
                                        className="object-cover"
                                        unoptimized
                                      />
                                    </div>
                                    <div>
                                      <div className="font-black text-slate-800 text-base">
                                        {a.employeeName}
                                      </div>
                                      <div className="text-blue-500 font-mono text-[10px] font-bold tracking-tight uppercase">
                                        @{a.userName || "user"}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-5 px-6 font-bold text-slate-600">
                                  {/* แสดงวันที่แบบ 04/03/2026 */}
                                  {a.date
                                    ? new Date(a.date).toLocaleDateString(
                                        "th-TH",
                                        {
                                          day: "2-digit",
                                          month: "2-digit",
                                          year: "numeric",
                                        }
                                      )
                                    : "-"}
                                </td>
                                {/* รอบเข้างาน */}
                                <td className="p-4 font-bold text-gray-600 whitespace-nowrap">
                                  <div className="flex flex-col gap-1">
                                    {a.startTime && a.endTime ? (
                                      <span className="text-[15px] text-gray-800">
                                        {a.startTime.slice(0, 5)} - {a.endTime.slice(0, 5)}
                                      </span>
                                    ) : (
                                      <span className="text-[14px] font-normal text-gray-400">ไม่มีกะงาน</span>
                                    )}
                                  </div>
                                </td>

                                {/* สถานะ */}
                                <td className="p-4 font-bold whitespace-nowrap">
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
                                <td className="py-5 px-6">
                                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase">
                                    {a.positionName || "พนักงาน"}
                                  </span>
                                </td>
                                <td className="py-5 px-6 text-center font-black text-green-600 text-lg italic">
                                  {a.checkIn
                                    ? new Date(a.checkIn).toLocaleTimeString(
                                        "th-TH",
                                        { hour: "2-digit", minute: "2-digit" }
                                      )
                                    : "--:--"}
                                </td>
                                <td className="py-5 px-6 text-center font-black text-red-600 text-lg italic">
                                  {a.checkOut
                                    ? new Date(a.checkOut).toLocaleTimeString(
                                        "th-TH",
                                        { hour: "2-digit", minute: "2-digit" }
                                      )
                                    : "--:--"}
                                </td>
                                <td className="py-5 px-6">
                                  <div className="flex justify-center gap-3">
                                    {/* แก้ไขเป็น imageIn และ imageOut ให้ตรงกับที่ส่งมาจาก Server */}
                                    {[
                                      { url: a.imageIn, label: "In" },
                                      { url: a.imageOut, label: "Out" },
                                    ].map((img, i) =>
                                      img.url ? (
                                        <div
                                          key={i}
                                          className="relative group/img"
                                        >
                                          <div
                                            onClick={() =>
                                              setViewImage(img.url)
                                            }
                                            className="w-11 h-11 rounded-xl overflow-hidden border-2 border-white shadow-sm cursor-zoom-in hover:border-blue-400 active:scale-95 transition-all bg-slate-100"
                                          >
                                            <Image
                                              src={img.url}
                                              alt={img.label}
                                              fill
                                              className="object-cover"
                                              unoptimized
                                            />
                                          </div>
                                          <span
                                            className={`absolute -bottom-2 -right-1 text-white text-[8px] px-1 rounded font-bold uppercase ${
                                              img.label === "In"
                                                ? "bg-green-500"
                                                : "bg-red-500"
                                            }`}
                                          >
                                            {img.label}
                                          </span>
                                        </div>
                                      ) : (
                                        <div
                                          key={i}
                                          className="w-11 h-11 rounded-xl border border-dashed border-slate-200 flex items-center justify-center text-[8px] text-slate-300 font-bold italic uppercase"
                                        >
                                          No {img.label}
                                        </div>
                                      )
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={6}
                                className="py-32 text-center bg-slate-50/30"
                              >
                                <div className="flex flex-col items-center justify-center gap-4">
                                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-4xl animate-bounce">
                                    📅
                                  </div>
                                  <p className="text-slate-400 italic font-black text-lg tracking-tight">
                                    ไม่พบข้อมูลการลงเวลาของทีมคุณ...
                                  </p>
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

              {/* ตารางที่ 4: คำขออนุมัติลางานของพนักงาน */}
              <div className="print:hidden mt-12">
                <Section title="คำขอลางาน">
                  {/* Search Box */}
                  <div className="mb-6 relative max-w-sm">
                    <input
                      type="text"
                      placeholder="🔍 ค้นชื่อพนักงาน หรือ ประเภทลา..."
                      className="w-full pl-6 pr-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                      value={searchLeave}
                      onChange={(e) => setSearchLeave(e.target.value)}
                    />
                  </div>

                  <div className="rounded-[2.5rem] border border-slate-100 overflow-hidden bg-white shadow-xl shadow-slate-200/50">
                    <div className="overflow-x-auto max-h-[550px] overflow-y-auto custom-scrollbar">
                      <table className="min-w-[1200px] w-full text-sm border-separate border-spacing-0">
                        <thead className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-sm">
                          <tr className="text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">
                            <th className="py-6 px-6 text-left border-b border-slate-100">
                              พนักงาน
                            </th>
                            <th className="py-6 px-4 text-center border-b border-slate-100">
                              ประเภท & ระยะเวลา
                            </th>
                            <th className="py-6 px-4 text-center border-b border-slate-100">
                              จำนวน
                            </th>
                            <th className="py-6 px-4 text-left border-b border-slate-100 w-1/4">
                              เหตุผล & เอกสาร
                            </th>
                            <th className="py-6 px-4 text-center border-b border-slate-100">
                              สถานะ
                            </th>
                            <th className="py-6 px-6 text-center border-b border-slate-100">
                              จัดการ
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredLeaves.length > 0 ? (
                            filteredLeaves.map((l) => {
                              const diffDays =
                                Math.ceil(
                                  Math.abs(
                                    new Date(l.endDate) - new Date(l.startDate)
                                  ) /
                                    (1000 * 60 * 60 * 24)
                                ) + 1;
                              return (
                                <tr
                                  key={l.id}
                                  className="group hover:bg-indigo-50/30 transition-all"
                                >
                                  <td className="py-5 px-6">
                                    <div className="flex items-center gap-4">
                                      <div className="w-12 h-12 relative rounded-2xl overflow-hidden border-2 border-white shadow-sm shrink-0">
                                        <img
                                          src={
                                            l.avatarUrl ||
                                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                              l.employeeName || "User"
                                            )}&background=random`
                                          }
                                          alt="profile"
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                      <div>
                                        <div className="font-black text-slate-800 text-base leading-none mb-1">
                                          {l.employeeName || "ไม่ระบุชื่อ"}
                                        </div>
                                        <div className="text-indigo-500 font-mono text-[10px] font-bold italic">
                                          @{l.userName || "user"}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-5 px-4 text-center">
                                    <div className="inline-block bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg font-black text-[11px] mb-1">
                                      {l.type}
                                    </div>
                                    <div className="text-slate-400 text-[10px] font-bold uppercase tracking-tighter">
                                      {l.startDate} → {l.endDate}
                                    </div>
                                  </td>
                                  <td className="py-5 px-4 text-center">
                                    <span className="bg-orange-500 text-white px-3 py-1 rounded-full font-black text-xs shadow-sm shadow-orange-200">
                                      {isNaN(diffDays)
                                        ? "-"
                                        : `${diffDays} วัน`}
                                    </span>
                                  </td>
                                  <td className="py-5 px-4">
                                    <div className="flex items-start gap-3">
                                      {l.fileUrl && (
                                        <div
                                          onClick={() =>
                                            setViewImage(l.fileUrl)
                                          }
                                          className="w-10 h-10 shrink-0 rounded-xl overflow-hidden border border-slate-200 cursor-zoom-in hover:ring-2 hover:ring-indigo-400 transition-all bg-slate-50"
                                        >
                                          <img
                                            src={l.fileUrl}
                                            alt="doc"
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      )}
                                      <p className="text-slate-600 italic text-xs leading-relaxed line-clamp-2">
                                        "{l.reason || "ไม่มีระบุเหตุผล"}"
                                      </p>
                                    </div>
                                  </td>
                                  <td className="py-5 px-4 text-center">
                                    <span
                                      className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase shadow-sm ${
                                        l.status === "pending"
                                          ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
                                          : l.status === "approved"
                                          ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                                          : "bg-rose-100 text-rose-700 ring-1 ring-rose-200"
                                      }`}
                                    >
                                      {l.status === "pending"
                                        ? "• รออนุมัติ"
                                        : l.status === "approved"
                                        ? "✓ อนุมัติแล้ว"
                                        : "✕ ปฏิเสธ"}
                                    </span>
                                  </td>
                                  <td className="py-5 px-6">
                                    <div className="flex justify-center gap-2">
                                      {l.status === "pending" ? (
                                        <>
                                          <button
                                            onClick={() =>
                                              updateLeaveStatusAction(
                                                l.id,
                                                "approved"
                                              )
                                            }
                                            className="bg-emerald-600 text-white px-5 py-2 rounded-xl text-xs font-black hover:bg-emerald-700 hover:-translate-y-0.5 transition-all shadow-lg shadow-emerald-200 active:scale-95"
                                          >
                                            อนุมัติ
                                          </button>
                                          <button
                                            onClick={() =>
                                              updateLeaveStatusAction(
                                                l.id,
                                                "rejected"
                                              )
                                            }
                                            className="bg-white border border-rose-200 text-rose-500 px-5 py-2 rounded-xl text-xs font-black hover:bg-rose-50 transition-all active:scale-95"
                                          >
                                            ปฏิเสธ
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          onClick={() =>
                                            updateLeaveStatusAction(l.id, "pending")
                                          }
                                          className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-black hover:bg-slate-200 transition-all flex items-center gap-2 italic"
                                        >
                                          <span>✏️</span> แก้ไขสถานะ
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td
                                colSpan={6}
                                className="py-24 text-center text-slate-300 italic font-black tracking-widest"
                              >
                                NO LEAVE REQUESTS FOUND
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Section>
              </div>
            </div>
          </div>
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
                {/* 🔥 แจ้งเตือนข้อผิดพลาด */}
                {leaveError && (
                  <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-[11px] font-black uppercase animate-shake">
                    {leaveError}
                  </div>
                )}

                {/* 1. ประเภทการลา */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
                    ประเภทการลา
                  </label>
                  <select
                    className="w-full bg-white p-5 rounded-[1.5rem] font-black text-gray-700 outline-none shadow-sm border-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                  >
                    <option value="">โปรดระบุ</option>
                    <option value="ลาป่วย">ลาป่วย</option>
                    <option value="ลากิจ">ลากิจ</option>
                    <option value="ลาพักร้อน">ลาพักร้อน</option>
                  </select>
                </div>

                {/* 2. ส่วนวันที่ พร้อมระบบตรวจสอบความถูกต้อง */}
                <div className="relative space-y-4">
                  {calculateLeaveDays(leaveStart, leaveEnd) > 0 &&
                    validateLeaveDates(leaveStart, leaveEnd).isValid && (
                      <div className="flex flex-col items-center justify-center py-4 animate-in zoom-in duration-300">
                        <div className="bg-indigo-600 px-8 py-3 rounded-[2rem] shadow-xl flex items-center gap-3">
                          <span className="text-[10px] font-black text-indigo-100 uppercase tracking-widest">
                            ระยะเวลา
                          </span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-white leading-none">
                              {calculateLeaveDays(leaveStart, leaveEnd)}
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
                          !validateLeaveDates(leaveStart, leaveEnd).isValid &&
                          leaveStart
                            ? "text-red-500"
                            : "text-gray-400 group-focus-within:text-indigo-500"
                        }`}
                      >
                        เริ่มต้น
                      </label>
                      <input
                        type="date"
                        className={`w-full bg-white p-5 rounded-[1.8rem] font-black outline-none shadow-sm border-2 transition-all ${
                          !validateLeaveDates(leaveStart, leaveEnd).isValid &&
                          leaveStart
                            ? "border-red-200"
                            : "border-transparent focus:border-indigo-500"
                        }`}
                        value={leaveStart}
                        onChange={(e) => setLeaveStart(e.target.value)}
                      />
                    </div>
                    {/* วันสิ้นสุด */}
                    <div className="space-y-2 group">
                      <label
                        className={`text-[10px] font-black uppercase ml-4 transition-colors ${
                          !validateLeaveDates(leaveStart, leaveEnd).isValid &&
                          leaveEnd
                            ? "text-red-500"
                            : "text-gray-400 group-focus-within:text-indigo-500"
                        }`}
                      >
                        สิ้นสุด
                      </label>
                      <input
                        type="date"
                        className={`w-full bg-white p-5 rounded-[1.8rem] font-black outline-none shadow-sm border-2 transition-all ${
                          !validateLeaveDates(leaveStart, leaveEnd).isValid &&
                          leaveEnd
                            ? "border-red-200"
                            : "border-transparent focus:border-indigo-500"
                        }`}
                        value={leaveEnd}
                        onChange={(e) => setLeaveEnd(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. ระบุเหตุผล */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
                    ระบุเหตุผล
                  </label>
                  <textarea
                    className="w-full bg-white p-5 rounded-[1.5rem] font-medium min-h-[140px] outline-none shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="เขียนเหตุผลประกอบการลาที่นี่..."
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                  />
                </div>

                {/* 4. อัปโหลดและบีบอัดรูปภาพ */}
                <div className="space-y-3 mt-4">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
                    เอกสารประกอบ (ถ้ามี)
                  </label>
                  <div className="relative group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setIsProcessing(true);
                          try {
                            const compressed = await compressImage(file);
                            setLeaveFilePreview(compressed);
                            const res = await fetch(compressed);
                            const blob = await res.blob();
                            setLeaveFile(
                              new File([blob], file.name, {
                                type: "image/jpeg",
                              })
                            );
                          } catch (err) {
                            console.error("Compression Error:", err);
                          } finally {
                            setIsProcessing(false);
                          }
                        }
                      }}
                      className="hidden"
                      id="leave-file-upload"
                      disabled={isProcessing}
                    />
                    <label
                      htmlFor="leave-file-upload"
                      className="flex flex-col items-center justify-center w-full bg-white border-2 border-dashed border-gray-200 p-8 rounded-[1.5rem] cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group shadow-sm"
                    >
                      {leaveFilePreview ? (
                        <div className="relative w-full h-32 flex justify-center">
                          <img
                            src={leaveFilePreview}
                            alt="Preview"
                            className="h-full object-contain rounded-lg shadow-md"
                          />
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-gray-400 group-hover:text-indigo-600 transition-all">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-6 w-6"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M12 4v16m8-8H4"
                              />
                            </svg>
                          </div>
                          <p className="text-xs font-black text-gray-400 uppercase tracking-tighter group-hover:text-indigo-600">
                            แนบรูปภาพ
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
                    disabled={isProcessing}
                    className="flex-[2] bg-indigo-600 text-white font-black py-6 rounded-[1.5rem] shadow-xl active:scale-95 hover:bg-indigo-700 transition-all uppercase tracking-tighter disabled:opacity-50"
                  >
                    {isProcessing ? "กำลังประมวลผล..." : "ยืนยันการลา"}
                  </button>
                  <button
                    onClick={() => {
                      setShowLeaveForm(false);
                      setLeaveFile(null);
                      setLeaveFilePreview(null);
                      setLeaveError("");
                    }}
                    disabled={isProcessing}
                    className="flex-1 bg-white border-2 border-gray-200 text-gray-400 font-black py-6 rounded-[1.5rem] uppercase hover:bg-gray-50 transition-all disabled:opacity-30"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
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

      {/* 🖼️ Modal สำหรับขยายรูป */}
      {viewImage && (
        <div 
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 transition-all"
          onClick={() => setViewImage(null)} // คลิกข้างนอกเพื่อปิด
        >
          <div className="relative group max-w-5xl w-full h-full flex items-center justify-center">
            {/* ปุ่มปิด (X) */}
            <button className="absolute -top-10 right-0 text-white text-xl font-black bg-white/10 w-10 h-10 rounded-full hover:bg-white/20">
              ✕
            </button>
            
            {/* รูปภาพขนาดใหญ่ */}
            <div className="relative w-full h-[85vh] animate-in zoom-in-95 duration-200">
              <Image
                src={viewImage}
                alt="Preview"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          </div>
        </div>
      )}

      {/* 🏁 FOOTER */}
      <footer className="max-w-7xl mx-auto p-10 opacity-20 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="bg-gray-800 text-white w-6 h-6 rounded flex items-center justify-center text-[10px] font-black">
            S
          </div>
          <span className="text-[10px] font-black tracking-[0.3em] text-gray-900 uppercase">
            Siam Royal System © 2026
          </span>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes scan {
          0% {
            top: 10%;
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            top: 90%;
            opacity: 0;
          }
        }
        .animate-scan {
          animation: scan 3s linear infinite;
        }
      `}</style>
    </div>
  );
}
