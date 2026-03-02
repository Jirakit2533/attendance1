"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { logoutAction } from "@/server/auth";
import { useUploadThing } from "@/lib/uploadthing";
import { 
  saveAttendanceAction, 
  createLeaveRequestAction,
  updateLeaveStatusAction 
} from "./actions";

// --- เพิ่ม Component LoadingOverlay เพื่อใช้แสดงตอนประมวลผล ---
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

export default function LeaderClientPage({ 
  userProfile, 
  initialRecords = [], 
  initialLeaves = [], 
  initialTeamAttendance = [] 
}: any) {
  const router = useRouter();

  const [records, setRecords] = useState<any[]>(initialRecords);
  const [leaves, setLeaves] = useState<any[]>(initialLeaves);
  const [teamAttendance, setTeamAttendance] = useState<any[]>(initialTeamAttendance);

  // ✅ เพิ่ม useEffect เพื่อคอย Update State เมื่อ Server ส่งข้อมูลชุดใหม่มาให้ (router.refresh)
  useEffect(() => {
    setRecords(initialRecords);
  }, [initialRecords]);

  useEffect(() => {
    setLeaves(initialLeaves);
  }, [initialLeaves]);

  useEffect(() => {
    setTeamAttendance(initialTeamAttendance);
  }, [initialTeamAttendance]);

  const { startUpload: uploadAttendance } = useUploadThing("imageUploader");
  const { startUpload: uploadLeave } = useUploadThing("leaveFileUploader");
  
  const [showCamera, setShowCamera] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // Global Loading State
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [readyToCapture, setReadyToCapture] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveSuccess, setLeaveSuccess] = useState(false);
  const [leaveType, setLeaveType] = useState("");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveError, setLeaveError] = useState("");
  const [leaveFile, setLeaveFile] = useState<File | null>(null);
  const [leaveFilePreview, setLeaveFilePreview] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /* ---------------- MEMOIZED VALUES ---------------- */
  const myLeaves = useMemo(() => leaves.filter((l: any) => l.employeeName === `${userProfile.firstName} ${userProfile.lastName}`), [leaves, userProfile]);
  const teamLeaves = useMemo(() => leaves.filter((l: any) => l.employeeName !== `${userProfile.firstName} ${userProfile.lastName}`), [leaves, userProfile]);
  
  const todayStatus = useMemo(() => {
    const now = new Date();
    // ✅ ใช้ Timezone ไทย เพื่อให้ตรงกับวันที่บันทึกใน Server
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    
    const todayRecord = records.find((r: any) => r.date === todayStr);

    return {
      hasCheckedIn: !!todayRecord?.checkIn,
      hasCheckedOut: !!todayRecord?.checkOut && todayRecord.checkOut !== "-" && todayRecord.checkOut !== null,
      record: todayRecord
    };
  }, [records]);

  /* ---------------- LEADER ACTIONS ---------------- */
  const handleApprove = async (leaveId: string) => {
    if (!confirm("คุณต้องการอนุมัติคำขอลางานนี้ใช่หรือไม่?")) return;
  
    setIsProcessing(true); // แสดง Loading Overlay
    try {
      const res = await updateLeaveStatusAction(leaveId, "อนุมัติแล้ว", userProfile.id);
      if (res.success) {
        // ไม่ต้องทำอะไรเพิ่ม revalidatePath จะอัปเดต UI ให้เอง
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
      const res = await updateLeaveStatusAction(leaveId, "ปฏิเสธ", userProfile.id);
      if (res.success) {
        // ข้อมูลจะถูกดึงใหม่โดยอัตโนมัติ
      } else {
        alert(res.error || "เกิดข้อผิดพลาดในการปฏิเสธ");
      }
    } catch (error) {
      alert("ระบบขัดข้อง กรุณาลองใหม่ในภายหลัง");
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
      await new Promise(r => setTimeout(r, 300));
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

  const handleCapture = async () => {
    if (!videoRef.current || !streamRef.current) return;
    setIsProcessing(true);
    
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);
    const capturedImage = canvas.toDataURL("image/png");
    
    streamRef.current.getTracks().forEach(t => t.stop());
    setShowCamera(false);
    setReadyToCapture(false);
    
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 })
      );
      
      const blob = await (await fetch(capturedImage)).blob();
      const file = new File([blob], `attendance_${userProfile.id}.png`, { type: "image/png" });
  
      const uploadRes = await uploadAttendance([file]);
      if (!uploadRes) throw new Error("อัปโหลดรูปภาพไม่สำเร็จ");
  
      const uploadedFile = uploadRes[0];
      const result = await saveAttendanceAction({
        userId: userProfile.id,
        type: isCheckingOut ? "OUT" : "IN",
        image: uploadedFile.url,
        fileId: uploadedFile.key,
        location: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`
      });
  
      if (result.success) {
        alert("บันทึกเวลาสำเร็จ");
        router.refresh(); // ดึงข้อมูลชุดใหม่มาใส่ Props ทันที
      } else {
        alert("Error: " + result.error);
      }
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการบันทึกพิกัดหรือข้อมูล");
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
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setLeaveFilePreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setLeaveFilePreview(null); 
      }
    }
  };


    const handleLogout = async () => {
      if(!confirm("ยืนยันการออกจากระบบ?")) return;
      setIsProcessing(true);
      try {
          await logoutAction(); 
          window.location.href = "/login";
      } catch (error) {
          window.location.href = "/login";
      }
    };

  const submitLeave = async () => {
    setLeaveError("");
    if (!leaveType || !leaveStart || !leaveEnd || !leaveReason) {
      setLeaveError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    setIsProcessing(true);
    try {
      let fileUrl = "";
      let fileId = "";
      let fileName = "";

      if (leaveFile) {
        const uploadRes = await uploadLeave([leaveFile]);
        if (uploadRes && uploadRes.length > 0) {
          fileUrl = uploadRes[0].url;
          fileId = uploadRes[0].key;
          fileName = leaveFile.name;
        } else {
          throw new Error("อัปโหลดเอกสารไม่สำเร็จ");
        }
      }

      const res = await createLeaveRequestAction({
        userId: userProfile.id,
        type: leaveType,
        startDate: leaveStart,
        endDate: leaveEnd,
        reason: leaveReason,
        fileUrl: fileUrl,
        fileId: fileId,
        fileName: fileName || "no_file"
      });

      if (res.success) {
        setLeaveSuccess(true);
        setLeaveType(""); setLeaveStart(""); setLeaveEnd(""); setLeaveReason("");
        setLeaveFile(null); setLeaveFilePreview(null);
        router.refresh();
        setTimeout(() => {
          setLeaveSuccess(false);
          setShowLeaveForm(false);
        }, 2000);
      } else {
        setLeaveError(res.error || "เกิดข้อผิดพลาดในการบันทึก");
      }
    } catch (error: any) {
      setLeaveError(error.message || "ไม่สามารถส่งใบลาได้");
    } finally {
      setIsProcessing(false);
    }
  };

  // ✅ อย่าลืมใส่ LoadingOverlay และส่วน Return ของ JSX ด้านล่างต่อจากนี้ตามเดิมของคุณนะครับ
  return (
    <div className="min-h-screen bg-[#f8fafc] transition-all duration-300">
      {/* 🔴 Full-screen Loading Overlay */}
      {isProcessing && <LoadingOverlay />}

      {/* 🟢 TOP NAVIGATION */}
      <nav className="sticky top-0 z-40 w-full bg-white/70 backdrop-blur-xl border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 group">
            <div className="relative">
              <Image src="/logo.png" alt="SRS Logo" width={40} height={40} className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
            <div className="flex flex-col border-l-2 border-gray-100 pl-4">
              <h1 className="font-black text-gray-900 tracking-tighter text-lg sm:text-xl leading-none uppercase">
                SRS <span className="text-blue-600">Leader</span> Panel
              </h1>
              <span className="text-[8px] sm:text-[10px] text-gray-400 font-bold tracking-[0.2em] uppercase mt-1">ระบบบริหารจัดการระดับสูง</span>
            </div>
          </div> 
          <div className="flex items-center gap-2 sm:gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-black text-gray-800 uppercase tracking-tight">{userProfile.firstName}</span>
              <span className="text-[10px] text-blue-500 font-black uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span> ONLINE
              </span>
            </div>
            <button 
              onClick={handleLogout} 
              disabled={isProcessing}
              className="p-2 sm:p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all disabled:opacity-30"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
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
                src={userProfile?.avatarUrl || userProfile?.profileImage || `https://ui-avatars.com/api/?name=${userProfile?.firstName || 'User'}`}
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

          <div className="flex-1 text-center md:text-left pt-2">
            <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
              Leader / Head of Dept
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-1">{userProfile.firstName} {userProfile.lastName}</h2>
            <p className="text-gray-500 font-bold text-base sm:text-lg mb-6 tracking-tight">หัวหน้าแผนก {userProfile.department}</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-2">
              <span className="bg-gray-50 text-gray-400 text-[10px] px-4 py-2 rounded-xl font-black border border-gray-100 uppercase tracking-widest">ID: {userProfile.employeeId}</span>
              <span className="bg-blue-50 text-blue-500 text-[10px] px-4 py-2 rounded-xl font-black border border-blue-100 uppercase tracking-widest">{userProfile.department}</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-4 mt-8 w-full md:w-64">
            {/* 1. ยังไม่ได้เช็คอินวันนี้ */}
            {!todayStatus.hasCheckedIn && (
              <button 
                onClick={() => { setIsCheckingOut(false); openCamera(); }}
                disabled={isProcessing}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl uppercase tracking-tighter shadow-lg shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                ลงชื่อเข้างาน (CHECK-IN)
              </button>
            )}

            {/* 2. เช็คอินแล้ว แต่ยังไม่ออก */}
            {todayStatus.hasCheckedIn && !todayStatus.hasCheckedOut && (
              <button 
                onClick={() => { setIsCheckingOut(true); openCamera(); }}
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

            <button
              onClick={() => setShowLeaveForm(true)}
              disabled={isProcessing}
              className="w-full bg-white border-2 border-gray-100 hover:border-indigo-600 hover:text-indigo-600 text-gray-500 font-black py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 uppercase text-sm"
            >
              ขอลางาน (ส่วนตัว)
            </button>
          </div>
        </div>

        {/* 📊 DASHBOARD CONTENT */}
        {!showLeaveForm && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              
              {/* ตารางที่ 1: การเข้างานของฉัน */}
              <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-gray-50 overflow-hidden">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                  <h2 className="font-black text-gray-900 text-xl tracking-tighter uppercase">การเข้างาน <span className="text-gray-300">ของฉัน</span></h2>
                </div>
                <div className="overflow-x-auto rounded-[1.5rem] -mx-6 px-6 sm:mx-0 sm:px-0">
                  <table className="w-full text-sm min-w-[800px]">
                    <thead className="bg-gray-50/50 text-gray-400 uppercase text-[10px] font-black tracking-widest">
                      <tr>
                        <th className="p-6 text-left">วันที่</th>
                        <th className="p-6 text-left">เวลาเข้า / รูปถ่าย</th>
                        <th className="p-6 text-left">เวลาออก / รูปถ่าย</th>
                        <th className="p-6 text-left">รายละเอียด / สถานที่</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {records.length === 0 ? (
                        <tr><td colSpan={4} className="p-20 text-center text-gray-300 font-bold italic">ยังไม่มีข้อมูลการเข้างาน</td></tr>
                      ) : (
                        records.map((r, i) => (
                          <tr key={i} className="hover:bg-blue-50/10 transition-colors">
                            <td className="p-6 font-bold text-gray-800">{r.date}</td>
                            <td className="p-6">
                              <div className="flex items-center gap-3">
                                <span className="text-blue-600 font-black bg-blue-50 px-3 py-1.5 rounded-xl">{r.checkIn || "--:--"}</span>
                                {r.imageUrl && <Image src={r.imageUrl} alt="In" width={40} height={40} className="rounded-xl border-2 border-white shadow-sm object-cover h-10 w-10" unoptimized />}
                              </div>
                            </td>
                            <td className="p-6">
                              <div className="flex items-center gap-3">
                                <span className={!r.checkOut || r.checkOut === "-" ? "text-gray-300 font-black" : "text-slate-900 font-black bg-slate-100 px-3 py-1.5 rounded-xl"}>
                                  {r.checkOut || "-"}
                                </span>
                                {r.imageOutUrl && <Image src={r.imageOutUrl} alt="Out" width={40} height={40} className="rounded-xl border-2 border-white shadow-sm object-cover h-10 w-10" unoptimized />}
                              </div>
                            </td>
                            <td className="p-6">
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-gray-700 uppercase tracking-tighter">{r.position || userProfile.role}</span>
                                <span className="text-[10px] font-mono text-gray-400 truncate max-w-[150px]">📍 {r.location || "ไม่ได้ระบุพิกัด"}</span>
                              </div>
                            </td>
                          </tr>
                        ))
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
                    คำขออนุมัติ <span className="text-gray-300">ลางานของฉัน</span>
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
                        <tr><td colSpan={4} className="p-16 text-center text-gray-300 font-bold italic">ไม่มีประวัติการลา</td></tr>
                      ) : (
                        myLeaves.map((l: any) => (
                          <tr key={l.id} className="hover:bg-amber-50/10 transition-colors">
                            <td className="p-6 font-black text-gray-800 uppercase tracking-tighter">{l.type}</td>
                            <td className="p-6 text-[11px] text-gray-500 font-bold">
                              {l.startDate || l.start_date} <span className="text-gray-300 mx-1">→</span> {l.endDate || l.end_date}
                            </td>
                            <td className="p-6">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-gray-400 italic line-clamp-1">{l.reason}</span>
                                {l.fileUrl && (
                                  <a href={l.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[10px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest transition-all mt-1 w-fit group">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                    ดูหลักฐานแนบ
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="p-6 text-center">
                              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm border
                                ${l.status === 'อนุมัติแล้ว' ? 'bg-green-50 text-green-600 border-green-100' : 
                                  l.status === 'ปฏิเสธ' ? 'bg-red-50 text-red-600 border-red-100' : 
                                  'bg-amber-50 text-amber-600 border-amber-100'}`}
                              >
                                {l.status}
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
              <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-gray-50">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
                    <h2 className="font-black text-gray-900 text-xl tracking-tighter uppercase">การเข้างาน <span className="text-gray-300">ของพนักงาน</span></h2>
                  </div>
                </div>
                <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                  <table className="w-full text-sm min-w-[800px]">
                    <thead className="bg-gray-50/50 text-gray-400 uppercase text-[10px] font-black tracking-widest">
                      <tr>
                        <th className="p-6 text-left">ชื่อพนักงาน</th>
                        <th className="p-6 text-left">เวลาเข้า / รูปถ่าย</th>
                        <th className="p-6 text-left">เวลาออก / รูปถ่าย</th>
                        <th className="p-6 text-left">แผนก / ตำแหน่ง</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {teamAttendance.length === 0 ? (
                        <tr><td colSpan={4} className="p-12 text-center text-gray-300 font-black text-xs uppercase tracking-widest">ยังไม่มีข้อมูลการเข้างานวันนี้</td></tr>
                      ) : (
                        teamAttendance.map((t, i) => (
                          <tr key={i} className="hover:bg-emerald-50/10">
                            <td className="p-6"><span className="font-black text-gray-800 uppercase text-xs">{t.employeeName}</span></td>
                            <td className="p-6">
                              <div className="flex items-center gap-3">
                                <span className="text-emerald-600 font-black bg-emerald-50 px-3 py-1.5 rounded-xl">{t.checkIn || "--:--"}</span>
                                {t.imageUrl && <Image src={t.imageUrl} alt="In" width={40} height={40} className="rounded-xl border-2 border-white shadow-sm h-10 w-10 object-cover" unoptimized />}
                              </div>
                            </td>
                            <td className="p-6">
                              <div className="flex items-center gap-3">
                                <span className="text-gray-500 font-black bg-gray-100 px-3 py-1.5 rounded-xl">{t.checkOut || "--:--"}</span>
                                {t.imageOutUrl && <Image src={t.imageOutUrl} alt="Out" width={40} height={40} className="rounded-xl border-2 border-white shadow-sm h-10 w-10 object-cover" unoptimized />}
                              </div>
                            </td>
                            <td className="p-6">
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-gray-700 uppercase tracking-tighter">{userProfile.department}</span>
                                <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">📍 HQ STATION</span>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ตารางที่ 4: คำขออนุมัติลางานของพนักงาน */}
            <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-gray-50 mt-8 h-fit">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 bg-indigo-600 rounded-full"></div>
                  <h2 className="font-black text-gray-900 text-xl tracking-tighter uppercase">
                    คำขออนุมัติ <span className="text-gray-300">ลางานของพนักงาน</span>
                  </h2>
                </div>
                <div className="bg-indigo-50 px-4 py-1.5 rounded-full">
                  <span className="text-indigo-600 text-[10px] font-black uppercase tracking-widest">
                    {teamLeaves.filter((l: any) => l.status === 'รออนุมัติ').length} รายการรอตรวจ
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                <table className="w-full text-sm min-w-[800px]">
                  <thead className="bg-gray-50/50 text-gray-400 uppercase text-[10px] font-black tracking-widest">
                    <tr>
                      <th className="p-6 text-left">พนักงาน</th>
                      <th className="p-6 text-left">ประเภท / วันที่</th>
                      <th className="p-6 text-left">เหตุผล / หลักฐาน</th>
                      <th className="p-6 text-center">สถานะ</th>
                      <th className="p-6 text-center">จัดการคำขอ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {teamLeaves.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-16 text-center text-gray-300 font-bold italic">
                          ไม่มีรายการคำขอลา
                        </td>
                      </tr>
                    ) : (
                      teamLeaves.map((l: any) => (
                        <tr key={l.id} className="hover:bg-gray-50/50 transition-colors group">
                          <td className="p-6">
                            <div className="flex flex-col">
                              <span className="font-black text-gray-900 uppercase tracking-tighter text-sm">{l.employeeName}</span>
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">ID: #{l.id.toString().slice(-4)}</span>
                            </div>
                          </td>
                          <td className="p-6">
                            <div className="flex flex-col gap-1">
                              <span className="text-indigo-600 font-black text-xs uppercase">{l.type}</span>
                              <span className="text-[11px] text-gray-500 font-bold">
                                {l.startDate || l.start_date} <span className="text-gray-300 mx-1">→</span> {l.endDate || l.end_date}
                              </span>
                            </div>
                          </td>
                          <td className="p-6">
                            <div className="flex flex-col gap-1 max-w-[250px]">
                              <span className="text-xs text-gray-400 italic line-clamp-1">"{l.reason || 'ไม่ได้ระบุเหตุผล'}"</span>
                              {l.fileUrl && (
                                <a href={l.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[10px] font-black text-blue-500 hover:text-blue-700 uppercase tracking-widest transition-all w-fit">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                  </svg>
                                  เปิดดูหลักฐาน
                                </a>
                              )}
                            </div>
                          </td>

                          {/* --- คอลัมน์สถานะ (ใหม่) --- */}
                          <td className="p-6 text-center">
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm border
                              ${l.status === 'รออนุมัติ' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                                l.status === 'อนุมัติแล้ว' ? 'bg-green-50 text-green-600 border-green-100' : 
                                'bg-red-50 text-red-600 border-red-100'}`}
                            >
                              {l.status}
                            </span>
                          </td>

                          {/* --- คอลัมน์จัดการคำขอ --- */}
                          <td className="p-6 text-center">
                            {/* เช็คทั้งภาษาไทยและอังกฤษ และตัดช่องว่างออกเพื่อความแม่นยำ */}
                            {(l.status?.trim() === "รออนุมัติ" || l.status?.toLowerCase().trim() === "pending") ? (
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  onClick={() => handleApprove(l.id)}
                                  disabled={isProcessing}
                                  className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-tighter transition-all active:scale-95 shadow-sm disabled:opacity-30"
                                >
                                  {isProcessing ? "..." : "อนุมัติ"}
                                </button>
                                <button 
                                  onClick={() => handleReject(l.id)}
                                  disabled={isProcessing}
                                  className="bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-400 text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-tighter transition-all active:scale-95 disabled:opacity-30"
                                >
                                  {isProcessing ? "..." : "ปฏิเสธ"}
                                </button>
                              </div>
                            ) : (
                              /* ถ้าสถานะเป็น 'อนุมัติแล้ว' หรือ 'ปฏิเสธ' จะมาเข้าเงื่อนไขนี้ */
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] text-gray-300 font-bold uppercase tracking-widest italic">
                                  ดำเนินการแล้ว
                                </span>
                                {/* (Optional) แสดงชื่อคนตรวจถ้ามีข้อมูล */}
                                {l.approvedBy && <span className="text-[9px] text-gray-300">โดย Leader</span>}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 📝 LEAVE FORM SECTION */}
        {showLeaveForm && (
          <div className="max-w-2xl mx-auto py-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase mb-2">ยื่นเรื่อง <span className="text-indigo-600">ลางาน</span></h2>
              <div className="w-12 h-1.5 bg-indigo-600 mx-auto rounded-full"></div>
            </div>
            
            {leaveSuccess ? (
              <div className="p-12 bg-green-50 border border-green-100 text-green-700 rounded-[3rem] text-center space-y-4 shadow-xl">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto text-white text-4xl">✓</div>
                <p className="font-black text-2xl tracking-tighter uppercase">ส่งคำขอลาสำเร็จ</p>
              </div>
            ) : (
              <div className="space-y-6 bg-gray-50/50 p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border border-gray-100 shadow-inner relative">
                {leaveError && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-xs font-black uppercase">{leaveError}</div>}
                
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2">ประเภทการลา</label>
                  <select className="w-full bg-white p-5 rounded-[1.5rem] font-black text-gray-700 outline-none shadow-sm border-none focus:ring-2 focus:ring-indigo-500 transition-all" value={leaveType} onChange={e => setLeaveType(e.target.value)}>
                    <option value="">โปรดระบุ</option>
                    <option value="ลาป่วย">ลาป่วย</option>
                    <option value="ลากิจ">ลากิจ</option>
                    <option value="ลาพักร้อน">ลาพักร้อน</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">เริ่มต้น</label>
                    <input type="date" className="w-full bg-white p-5 rounded-[1.5rem] font-bold outline-none shadow-sm" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">สิ้นสุด</label>
                    <input type="date" className="w-full bg-white p-5 rounded-[1.5rem] font-bold outline-none shadow-sm" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2">ระบุเหตุผล</label>
                  <textarea className="w-full bg-white p-5 rounded-[1.5rem] font-medium min-h-[140px] outline-none shadow-sm" placeholder="เขียนเหตุผลประกอบการลาที่นี่..." value={leaveReason} onChange={e => setLeaveReason(e.target.value)} />
                </div>

                <div className="space-y-3 mt-4">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2">เอกสารประกอบ (ถ้ามี)</label>
                  <div className="relative group">
                    <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="hidden" id="leave-file-upload" disabled={isProcessing} />
                    <label htmlFor="leave-file-upload" className="flex flex-col items-center justify-center w-full bg-white border-2 border-dashed border-gray-200 p-8 rounded-[1.5rem] cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group shadow-sm">
                      {leaveFilePreview ? (
                        <div className="relative w-full h-32">
                          <img src={leaveFilePreview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-all">
                            <span className="text-white text-xs font-black uppercase tracking-widest">เปลี่ยนไฟล์</span>
                          </div>
                        </div>
                      ) : leaveFile ? (
                        <div className="text-center py-4">
                          <div className="text-indigo-600 font-black text-sm mb-1">📄 {leaveFile.name}</div>
                          <p className="text-[10px] text-gray-400 uppercase">คลิกเพื่อเปลี่ยนไฟล์</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-gray-400 group-hover:scale-110 group-hover:text-indigo-600 transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                            </svg>
                          </div>
                          <p className="text-xs font-black text-gray-400 uppercase tracking-tighter group-hover:text-indigo-600">กดเพื่อแนบรูปภาพหรือ PDF</p>
                          <p className="text-[9px] text-gray-300 mt-1 uppercase">จำกัดขนาดไม่เกิน 5MB</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <button 
                    onClick={submitLeave} 
                    disabled={isProcessing}
                    className="flex-[2] bg-indigo-600 text-white font-black py-6 rounded-[1.5rem] shadow-xl active:scale-95 hover:bg-indigo-700 transition-all uppercase tracking-tighter disabled:opacity-50"
                  >
                    {isProcessing ? "กำลังประมวลผล..." : "ยืนยันการลา"}
                  </button>
                  <button 
                    onClick={() => { setShowLeaveForm(false); setLeaveFile(null); setLeaveFilePreview(null); }} 
                    disabled={isProcessing}
                    className="flex-1 bg-white border-2 border-gray-200 text-gray-400 font-black py-6 rounded-[1.5rem] uppercase tracking-tighter hover:bg-gray-50 transition-all disabled:opacity-30"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 📸 MODAL CAMERA */}
      {showCamera && (
        <div className="fixed inset-0 bg-slate-900/98 flex flex-col items-center justify-center z-[999] p-6 backdrop-blur-2xl">
          <div className="w-full max-w-[320px] relative">
            <div className="absolute -top-12 left-0 w-full flex justify-between px-2">
              <span className="text-blue-400 text-[10px] font-black tracking-widest uppercase animate-pulse">Scanning Identity...</span>
            </div>
            <div className="relative rounded-[3rem] overflow-hidden border-[10px] border-white/5 shadow-2xl bg-black aspect-[3/4]">
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
              <div className="absolute inset-0 pointer-events-none">
                <div className="w-full h-full border-[20px] border-black/20 rounded-[2rem]">
                  <div className="w-full h-[2px] bg-blue-400 shadow-[0_0_20px_#60a5fa] absolute animate-scan"></div>
                </div>
              </div>
            </div>
            <div className="mt-12 flex flex-col items-center gap-10">
              {readyToCapture && !isProcessing && (
                <button onClick={handleCapture} className="w-20 h-20 bg-white rounded-full border-4 border-blue-600 shadow-[0_0_40px_rgba(255,255,255,0.2)] active:scale-75 transition-all"></button>
              )}
              {isProcessing && <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>}
              <button onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); setShowCamera(false); }} className="text-white/30 font-black text-[25px] uppercase tracking-widest">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* 🏁 FOOTER */}
      <footer className="max-w-7xl mx-auto p-10 opacity-20 text-center">
        <div className="flex items-center justify-center gap-2">
            <div className="bg-gray-800 text-white w-6 h-6 rounded flex items-center justify-center text-[10px] font-black">S</div>
            <span className="text-[10px] font-black tracking-[0.3em] text-gray-900 uppercase">Siam Royal System © 2026</span>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes scan { 0% { top: 10%; opacity: 0; } 50% { opacity: 1; } 100% { top: 90%; opacity: 0; } }
        .animate-scan { animation: scan 3s linear infinite; }
      `}</style>
    </div>
  );
}