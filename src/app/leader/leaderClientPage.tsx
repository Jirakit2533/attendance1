"use client";

import { useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { logoutAction } from "@/server/auth";

// Props ครบถ้วนตามต้นฉบับ
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

  const [checkedIn, setCheckedIn] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [readyToCapture, setReadyToCapture] = useState(false);

  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveSuccess, setLeaveSuccess] = useState(false);
  const [leaveType, setLeaveType] = useState("");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveError, setLeaveError] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // --- LOGIC แยกข้อมูลการลา ---
  const myLeaves = useMemo(() => 
    leaves.filter((l: any) => l.employeeName === `${userProfile.firstName} ${userProfile.lastName}`),
  [leaves, userProfile]);

  const teamLeaves = useMemo(() => 
    leaves.filter((l: any) => l.employeeName !== `${userProfile.firstName} ${userProfile.lastName}`),
  [leaves, userProfile]);

  /* ---------------- LEADER ACTIONS ---------------- */
  const handleApprove = (id: number) => {
    if(!confirm("ยืนยันการอนุมัติคำขอลาพักของพนักงาน?")) return;
    setLeaves(prev => prev.map(item => item.id === id ? { ...item, status: "อนุมัติแล้ว" } : item));
  };

  const handleReject = (id: number) => {
    const reason = prompt("ระบุเหตุผลที่ไม่บันทึกอนุมัติ (ถ้ามี):");
    if (reason === null) return;
    setLeaves(prev => prev.map(item => item.id === id ? { ...item, status: "ปฏิเสธ" } : item));
  };

  /* ---------------- CAMERA LOGIC ---------------- */
  const openCamera = async () => {
    try {
      setCheckingIn(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setShowCamera(true);
      await new Promise(r => setTimeout(r, 200));
      if (!videoRef.current) throw new Error("video not ready");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setReadyToCapture(true);
    } catch (err) {
      alert("ไม่สามารถเข้าถึงกล้องได้ กรุณาตรวจสอบสิทธิ์การใช้งาน");
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckIn = () => { setIsCheckingOut(false); openCamera(); };
  const handleCheckOut = () => { setIsCheckingOut(true); openCamera(); };

  const handleCapture = async () => {
    if (!videoRef.current || !streamRef.current) return;
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
        navigator.geolocation.getCurrentPosition(res, rej)
      );
      const now = new Date();

      if (isCheckingOut) {
        setRecords(prev =>
          prev.map((r, i) =>
            i === 0 ? { ...r, checkOut: now.toLocaleTimeString('th-TH'), checkOutImageUrl: capturedImage } : r
          )
        );
        setCheckedIn(false);
      } else {
        setRecords(prev => [
          {
            date: now.toLocaleDateString('th-TH'),
            checkIn: now.toLocaleTimeString('th-TH'),
            checkOut: "-",
            location: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`,
            imageUrl: capturedImage,
            checkOutImageUrl: "",
            position: userProfile.role === 'leader' ? "ฝ่ายบริหาร / หัวหน้าแผนก" : "พนักงาน",
          },
          ...prev,
        ]);
        setCheckedIn(true);
      }
    } catch (err) {
      alert("กรุณาเปิด GPS เพื่อยืนยันตำแหน่ง");
    }
  };

  const handleLogout = async () => {
    if(!confirm("ยืนยันการออกจากระบบ?")) return;
    document.cookie = "session_user_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "user_role=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    try {
        await logoutAction(); 
        window.location.href = "/login";
    } catch (error) {
        window.location.href = "/login";
    }
  };

  /* ---------------- LEAVE LOGIC ---------------- */
  const leaveDays = useMemo(() => {
    if (!leaveStart || !leaveEnd) return 0;
    const start = new Date(leaveStart);
    const end = new Date(leaveEnd);
    if (end < start) return 0;
    return (Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  }, [leaveStart, leaveEnd]);

  const submitLeave = () => {
    setLeaveError("");
    if (!leaveType || !leaveStart || !leaveEnd || !leaveReason) {
      setLeaveError("กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง");
      return;
    }
    const newLeave = {
      id: Date.now(),
      employeeName: `${userProfile.firstName} ${userProfile.lastName}`,
      type: leaveType,
      start: leaveStart,
      end: leaveEnd,
      reason: leaveReason,
      days: leaveDays,
      status: "รออนุมัติ",
    };
    setLeaves(prev => [newLeave, ...prev]);
    setLeaveSuccess(true);
    setTimeout(() => {
      setLeaveSuccess(false);
      setShowLeaveForm(false);
      setLeaveType(""); setLeaveStart(""); setLeaveEnd(""); setLeaveReason("");
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] transition-all duration-300">
      
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
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span> {userProfile.role} บันทึกเวลาอยู่
              </span>
            </div>
            <button onClick={handleLogout} className="p-2 sm:p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all">
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
              src="/profile.png"
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
            <p className="text-gray-500 font-bold text-base sm:text-lg mb-6 tracking-tight">หัวหน้าแผนก{userProfile.department}</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-2">
              <span className="bg-gray-50 text-gray-400 text-[10px] px-4 py-2 rounded-xl font-black border border-gray-100">ID: {userProfile.employeeId}</span>
              <span className="bg-blue-50 text-blue-500 text-[10px] px-4 py-2 rounded-xl font-black border border-blue-100 uppercase">{userProfile.department}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full md:w-auto min-w-[240px]">
            {!checkedIn ? (
              <button
                onClick={handleCheckIn}
                disabled={checkingIn}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-4 sm:py-5 rounded-[1.5rem] transition-all shadow-[0_15px_30px_-5px_rgba(37,99,235,0.3)] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 group uppercase text-sm"
              >
                <svg className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
                {checkingIn ? "กำลังเรียกกล้อง..." : "ลงชื่อเข้างาน"}
              </button>
            ) : (
              <button
                onClick={handleCheckOut}
                disabled={checkingIn}
                className="w-full bg-slate-900 hover:bg-black text-white font-black px-8 py-4 sm:py-5 rounded-[1.5rem] transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 group uppercase text-sm"
              >
                <svg className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {checkingIn ? "กำลังเรียกกล้อง..." : "ลงชื่อเลิกงาน"}
              </button>
            )}
            <button
              onClick={() => setShowLeaveForm(true)}
              className="w-full bg-white border-2 border-gray-100 hover:border-indigo-600 hover:text-indigo-600 text-gray-500 font-black px-8 py-4 sm:py-5 rounded-[1.5rem] transition-all active:scale-95 flex items-center justify-center gap-3 uppercase text-sm"
            >
              ขอลางาน (ส่วนตัว)
            </button>
          </div>
        </div>

        {/* 📊 DASHBOARD CONTENT */}
        {!showLeaveForm && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              
              {/* ตารางที่ 1: การเข้างานของฉัน (โครงสร้างใหม่) */}
              <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-gray-50">
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
                        <th className="p-6 text-left">แผนก / ตำแหน่ง / สถานที่</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {records.length === 0 ? (<tr><td colSpan={4} className="p-20 text-center text-gray-300 font-bold italic">ยังไม่มีข้อมูลการเข้างาน</td></tr>) : (
                        records.map((r, i) => (
                          <tr key={i} className="hover:bg-blue-50/10 transition-colors">
                            <td className="p-6 font-bold text-gray-800">{r.date}</td>
                            <td className="p-6">
                              <div className="flex items-center gap-3">
                                <span className="text-blue-600 font-black bg-blue-50 px-3 py-1.5 rounded-xl">{r.checkIn}</span>
                                {r.imageUrl && <Image src={r.imageUrl} alt="In" width={40} height={40} className="rounded-xl border-2 border-white shadow-sm" unoptimized />}
                              </div>
                            </td>
                            <td className="p-6">
                              <div className="flex items-center gap-3">
                                <span className={r.checkOut === "-" ? "text-gray-300 font-black" : "text-slate-900 font-black bg-slate-100 px-3 py-1.5 rounded-xl"}>{r.checkOut}</span>
                                {r.checkOutImageUrl && <Image src={r.checkOutImageUrl} alt="Out" width={40} height={40} className="rounded-xl border-2 border-white shadow-sm" unoptimized />}
                              </div>
                            </td>
                            <td className="p-6">
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-gray-700">{r.position}</span>
                                <span className="text-[10px] font-mono text-gray-400">📍 {r.location}</span>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ตารางที่ 2: คำขออนุมัติของฉัน */}
              <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-gray-50">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-2 h-8 bg-amber-400 rounded-full"></div>
                  <h2 className="font-black text-gray-900 text-xl tracking-tighter uppercase">คำขออนุมัติ <span className="text-gray-300">ของฉัน</span></h2>
                </div>
                <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead className="bg-gray-50/50 text-gray-400 uppercase text-[10px] font-black tracking-widest">
                      <tr><th className="p-6 text-left">ประเภท</th><th className="p-6 text-left">วันที่ลา</th><th className="p-6 text-left">เหตุผล</th><th className="p-6 text-center">สถานะ</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {myLeaves.length === 0 ? (<tr><td colSpan={4} className="p-16 text-center text-gray-300 font-bold italic">ไม่มีประวัติการลา</td></tr>) : (
                        myLeaves.map((l: any) => (
                          <tr key={l.id} className="hover:bg-amber-50/10">
                            <td className="p-6 font-black text-gray-800 uppercase">{l.type}</td>
                            <td className="p-6 text-xs text-gray-500 font-bold">{l.start} - {l.end}</td>
                            <td className="p-6 text-xs text-gray-400 italic line-clamp-1">{l.reason}</td>
                            <td className="p-6 text-center">
                              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase ${l.status === 'อนุมัติแล้ว' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>{l.status}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ตารางที่ 3: การเข้างานของพนักงานในทีม (โครงสร้างใหม่) */}
              <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-gray-50">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
                    <h2 className="font-black text-gray-900 text-xl tracking-tighter uppercase">การเข้างาน <span className="text-gray-300">ของพนักงานในทีม</span></h2>
                  </div>
                </div>
                <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                  <table className="w-full text-sm min-w-[800px]">
                    <thead className="bg-gray-50/50 text-gray-400 uppercase text-[10px] font-black tracking-widest">
                      <tr>
                        <th className="p-6 text-left">ชื่อพนักงาน</th>
                        <th className="p-6 text-left">เวลาเข้า / รูปถ่าย</th>
                        <th className="p-6 text-left">เวลาออก / รูปถ่าย</th>
                        <th className="p-6 text-left">แผนก / ตำแหน่ง / สถานที่</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {teamAttendance.map((t, i) => (
                        <tr key={i} className="hover:bg-emerald-50/10">
                          <td className="p-6"><span className="font-black text-gray-800 uppercase text-xs">{t.employeeName}</span></td>
                          <td className="p-6">
                            <div className="flex items-center gap-3">
                              <span className="text-emerald-600 font-black bg-emerald-50 px-3 py-1.5 rounded-xl">{t.checkIn || "--:--"}</span>
                              {t.imageUrl && <Image src={t.imageUrl} alt="In" width={40} height={40} className="rounded-xl border-2 border-white shadow-sm" unoptimized />}
                            </div>
                          </td>
                          <td className="p-6">
                            <div className="flex items-center gap-3">
                              <span className="text-gray-500 font-black bg-gray-100 px-3 py-1.5 rounded-xl">{t.checkOut || "--:--"}</span>
                              {t.checkOutImageUrl && <Image src={t.checkOutImageUrl} alt="Out" width={40} height={40} className="rounded-xl border-2 border-white shadow-sm" unoptimized />}
                            </div>
                          </td>
                          <td className="p-6">
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-gray-700">{userProfile.department}</span>
                              <span className="text-[10px] font-mono text-gray-400 uppercase">📍 SIAM ROYAL SYSTEM</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ตารางที่ 4: คำขออนุมัติลาพนักงาน (Side panel) */}
            <div className="lg:col-span-1 space-y-8">
              <div className="bg-white p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-gray-50 sticky top-32">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-2 h-8 bg-indigo-600 rounded-full"></div>
                  <h2 className="font-black text-gray-900 text-xl tracking-tighter uppercase">คำขอ <span className="text-gray-300">อนุมัติ</span></h2>
                </div>

                <div className="space-y-4">
                  {teamLeaves.length === 0 ? (
                    <div className="bg-gray-50/50 p-10 rounded-[1.5rem] border-2 border-dashed border-gray-100 text-center">
                      <p className="text-gray-300 font-black text-[10px] uppercase">ไม่มีรายการรอตรวจ</p>
                    </div>
                  ) : (
                    teamLeaves.map((l: any) => (
                      <div key={l.id} className="p-6 border border-gray-100 rounded-[1.5rem] bg-white hover:shadow-lg transition-all relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                        <p className="font-black text-gray-900 text-xs uppercase mb-1">{l.employeeName}</p>
                        <p className="text-[10px] font-bold text-indigo-500 uppercase mb-3">{l.type} ({l.days} วัน)</p>
                        <p className="text-[11px] text-gray-400 italic mb-5 line-clamp-2">"{l.reason}"</p>
                        {l.status === "รออนุมัติ" ? (
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => handleApprove(l.id)} className="bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-black py-2.5 rounded-xl uppercase">อนุมัติ</button>
                            <button onClick={() => handleReject(l.id)} className="bg-gray-50 text-gray-400 text-[9px] font-black py-2.5 rounded-xl uppercase">ปฏิเสธ</button>
                          </div>
                        ) : (
                          <div className={`text-center py-2 rounded-xl text-[9px] font-black uppercase ${l.status === 'อนุมัติแล้ว' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{l.status}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
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
              <div className="space-y-6 bg-gray-50/50 p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border border-gray-100 shadow-inner">
                {leaveError && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-xs font-black">{leaveError}</div>}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2">ประเภทการลา</label>
                  <select className="w-full bg-white p-5 rounded-[1.5rem] font-black text-gray-700 outline-none shadow-sm" value={leaveType} onChange={e => setLeaveType(e.target.value)}>
                    <option value="">โปรดระบุ</option>
                    <option value="ลาป่วย">ลาป่วย</option>
                    <option value="ลากิจ">ลากิจ</option>
                    <option value="ลาพักร้อน">ลาพักร้อน</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">เริ่มต้น</label>
                    <input type="date" className="w-full bg-white p-5 rounded-[1.5rem] font-bold outline-none" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">สิ้นสุด</label>
                    <input type="date" className="w-full bg-white p-5 rounded-[1.5rem] font-bold outline-none" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} />
                  </div>
                </div>
                <textarea className="w-full bg-white p-5 rounded-[1.5rem] font-medium min-h-[140px] outline-none" placeholder="เหตุผล..." value={leaveReason} onChange={e => setLeaveReason(e.target.value)} />
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <button onClick={submitLeave} className="flex-[2] bg-indigo-600 text-white font-black py-6 rounded-[1.5rem] shadow-xl active:scale-95 uppercase tracking-tighter">ยืนยันการลา</button>
                  <button onClick={() => setShowLeaveForm(false)} className="flex-1 bg-white border-2 border-gray-200 text-gray-400 font-black py-6 rounded-[1.5rem] uppercase tracking-tighter">ยกเลิก</button>
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
              {readyToCapture && (
                <button onClick={handleCapture} className="w-20 h-20 bg-white rounded-full border-4 border-blue-600 shadow-[0_0_40px_rgba(255,255,255,0.2)] active:scale-75 transition-all"></button>
              )}
              <button onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); setShowCamera(false); }} className="text-white/30 font-black text-[10px] uppercase tracking-widest">Abort</button>
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