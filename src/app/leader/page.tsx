"use client";

import { useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type RecordItem = {
  date: string;
  checkIn: string;
  checkOut: string;
  location: string;
  imageUrl: string;
  checkOutImageUrl?: string; // เพิ่มฟิลด์รูปตอนเลิกงาน
  position: string;
};

type LeaveItem = {
  id: number;
  employeeName: string;
  type: string;
  start: string;
  end: string;
  reason: string;
  days: number;
  status: "รออนุมัติ" | "อนุมัติแล้ว" | "ปฏิเสธ";
};

export default function LeaderPage() {
  const router = useRouter();

  const [records, setRecords] = useState<RecordItem[]>([]);
  const [leaves, setLeaves] = useState<LeaveItem[]>([
    { id: 1, employeeName: "สมหมาย รักดี", type: "ลาพักร้อน", start: "2026-03-01", end: "2026-03-03", reason: "ไปธุระครอบครัว", days: 3, status: "รออนุมัติ" }
  ]);

  const [checkedIn, setCheckedIn] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false); // เพิ่มเพื่อเช็คว่ากำลังออกงานหรือไม่
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

  /* ---------------- LEADER ACTIONS ---------------- */
  const handleApprove = (id: number) => {
    setLeaves(prev => prev.map(item => item.id === id ? { ...item, status: "อนุมัติแล้ว" } : item));
  };

  const handleReject = (id: number) => {
    setLeaves(prev => prev.map(item => item.id === id ? { ...item, status: "ปฏิเสธ" } : item));
  };

  /* ---------------- CAMERA LOGIC (Shared) ---------------- */
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

  const handleCheckIn = () => {
    setIsCheckingOut(false);
    openCamera();
  };

  const handleCheckOut = () => {
    setIsCheckingOut(true);
    openCamera();
  };

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
        // กรณีเลิกงาน: อัปเดตข้อมูลแถวบนสุด (ล่าสุด)
        setRecords(prev =>
          prev.map((r, i) =>
            i === 0 ? { ...r, checkOut: now.toLocaleTimeString('th-TH'), checkOutImageUrl: capturedImage } : r
          )
        );
        setCheckedIn(false);
      } else {
        // กรณีเข้างาน: เพิ่มแถวใหม่
        setRecords(prev => [
          {
            date: now.toLocaleDateString('th-TH'),
            checkIn: now.toLocaleTimeString('th-TH'),
            checkOut: "-",
            location: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`,
            imageUrl: capturedImage,
            checkOutImageUrl: "",
            position: "ฝ่ายบริหาร / หัวหน้าแผนก",
          },
          ...prev,
        ]);
        setCheckedIn(true);
      }
    } catch (err) {
      alert("กรุณาเปิด GPS เพื่อยืนยันตำแหน่ง");
    }
  };

  const handleLogout = () => {
    router.push("/login");
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
    setLeaves(prev => [
      {
        id: Date.now(),
        employeeName: "นายสมชาย ใจดี",
        type: leaveType,
        start: leaveStart,
        end: leaveEnd,
        reason: leaveReason,
        days: leaveDays,
        status: "รออนุมัติ",
      },
      ...prev,
    ]);
    setLeaveSuccess(true);
    setTimeout(() => {
      setLeaveSuccess(false);
      setShowLeaveForm(false);
      setLeaveType("");
      setLeaveStart("");
      setLeaveEnd("");
      setLeaveReason("");
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] transition-all duration-300">
      
      {/* 🟢 TOP NAVIGATION */}
      <nav className="sticky top-0 z-40 w-full bg-white/70 backdrop-blur-xl border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 group">
            <div className="relative">
              <Image src="/logo.png" alt="SRS Logo" width={40} height={40} className="w-10 h-10" />
            </div>
            <div className="flex flex-col border-l-2 border-gray-100 pl-4">
              <h1 className="font-black text-gray-900 tracking-tighter text-xl leading-none uppercase">
                SRS <span className="text-blue-600">Leader</span> Panel
              </h1>
              <span className="text-[10px] text-gray-400 font-bold tracking-[0.2em] uppercase mt-1">ระบบบริหารจัดการระดับสูง</span>
            </div>
          </div> 
          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-black text-gray-800 uppercase tracking-tight">Management Mode</span>
              <span className="text-[10px] text-blue-500 font-black uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span> แอดมินล็อกอินอยู่
              </span>
            </div>
            <button onClick={handleLogout} className="p-3 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all duration-300 group">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-10">
        
        {/* 👤 LEADER PROFILE CARD */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.03)] mb-10 flex flex-col md:flex-row items-center md:items-start gap-8 relative border border-white">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 rounded-full blur-2xl opacity-10"></div>
            <Image
              src="/profile.png"
              alt="Profile"
              width={140}
              height={140}
              className="rounded-[2.5rem] border-4 border-white shadow-2xl w-32 h-32 md:w-36 md:h-36 object-cover relative z-10"
            />
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-2xl shadow-lg flex items-center justify-center z-20">
              <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
            </div>
          </div>

          <div className="flex-1 text-center md:text-left pt-2">
            <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
              Leader / Head of Dept
            </div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-1">นายสมชาย ใจดี</h2>
            <p className="text-gray-500 font-bold text-lg mb-6 tracking-tight">หัวหน้าแผนกพัฒนาซอฟต์แวร์</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-2">
              <span className="bg-gray-50 text-gray-400 text-[10px] px-4 py-2 rounded-xl font-black border border-gray-100">ID: EMP-00123</span>
              <span className="bg-blue-50 text-blue-500 text-[10px] px-4 py-2 rounded-xl font-black border border-blue-100 uppercase">IT INFRASTRUCTURE</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full md:w-auto min-w-[240px]">
            {!checkedIn ? (
              <button
                onClick={handleCheckIn}
                disabled={checkingIn}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-5 rounded-[1.5rem] transition-all shadow-[0_15px_30px_-5px_rgba(37,99,235,0.3)] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 group"
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
                className="w-full bg-slate-900 hover:bg-black text-white font-black px-8 py-5 rounded-[1.5rem] transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 group"
              >
                <svg className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {checkingIn ? "กำลังเรียกกล้อง..." : "ลงชื่อเลิกงาน"}
              </button>
            )}
            <button
              onClick={() => setShowLeaveForm(true)}
              className="w-full bg-white border-2 border-gray-100 hover:border-indigo-600 hover:text-indigo-600 text-gray-500 font-black px-8 py-5 rounded-[1.5rem] transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              ขอลางาน (ส่วนตัว)
            </button>
          </div>
        </div>

        {/* 📊 DASHBOARD CONTENT */}
        {!showLeaveForm && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                    <h2 className="font-black text-gray-900 text-xl tracking-tighter uppercase">การเข้างาน <span className="text-gray-300">ของฉัน</span></h2>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-[2rem] border border-gray-50">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead className="bg-gray-50/50 text-gray-400 uppercase text-[10px] font-black tracking-widest">
                      <tr>
                        <th className="p-6 text-left">วันที่</th>
                        <th className="p-6 text-center">ลงเวลา</th>
                        <th className="p-6 text-center">พิกัด</th>
                        <th className="p-6 text-center">รูปเข้างาน</th>
                        <th className="p-6 text-center">รูปเลิกงาน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {records.length === 0 ? (
                        <tr><td colSpan={5} className="p-16 text-center text-gray-300 font-bold italic">ไม่พบข้อมูลในวันนี้</td></tr>
                      ) : (
                        records.map((r, i) => (
                          <tr key={i} className="hover:bg-blue-50/10 transition-colors group">
                            <td className="p-6 font-bold text-gray-800">{r.date}</td>
                            <td className="p-6 text-center">
                              <div className="flex flex-col">
                                <span className="text-blue-600 font-black bg-blue-50 px-3 py-1.5 rounded-xl">{r.checkIn}</span>
                                <span className="text-[10px] text-gray-300 font-bold mt-1 uppercase">ถึง {r.checkOut}</span>
                              </div>
                            </td>
                            <td className="p-6 text-center">
                              <span className="text-[10px] font-mono text-gray-400 block bg-gray-50 py-1 rounded-lg">📍 {r.location}</span>
                            </td>
                            <td className="p-6 text-center">
                              <Image src={r.imageUrl} alt="CheckIn" width={44} height={44} className="rounded-xl border-2 border-white shadow-md mx-auto unoptimized" unoptimized />
                            </td>
                            <td className="p-6 text-center">
                              {r.checkOutImageUrl ? (
                                <Image src={r.checkOutImageUrl} alt="CheckOut" width={44} height={44} className="rounded-xl border-2 border-white shadow-md mx-auto unoptimized" unoptimized />
                              ) : (
                                <span className="text-[10px] text-gray-200 font-black uppercase tracking-tighter">No Photo</span>
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

            <div className="lg:col-span-1 space-y-8">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-2 h-8 bg-indigo-600 rounded-full"></div>
                  <h2 className="font-black text-gray-900 text-xl tracking-tighter uppercase">คำขอ <span className="text-gray-300">อนุมัติ</span></h2>
                </div>

                <div className="space-y-4">
                  {leaves.length === 0 ? (
                    <div className="bg-gray-50/50 p-10 rounded-[2rem] border-2 border-dashed border-gray-100 text-center">
                      <p className="text-gray-300 font-black text-xs uppercase">ไม่มีรายการรอดำเนินการ</p>
                    </div>
                  ) : (
                    leaves.map((l) => (
                      <div key={l.id} className="p-6 border border-gray-100 rounded-[2rem] bg-white hover:shadow-xl transition-all relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="font-black text-gray-900 text-base uppercase tracking-tight">{l.employeeName}</p>
                            <span className="text-[10px] font-bold text-indigo-500 uppercase">{l.type} ({l.days} วัน)</span>
                          </div>
                          {l.status === "รออนุมัติ" && <span className="w-2 h-2 bg-amber-400 rounded-full animate-ping"></span>}
                        </div>
                        <p className="text-xs text-gray-500 font-medium italic mb-6 line-clamp-2">"{l.reason}"</p>
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-center text-[10px] font-mono text-gray-400 mb-2">
                            <span>{l.start}</span>
                            <span>→</span>
                            <span>{l.end}</span>
                          </div>
                          {l.status === "รออนุมัติ" ? (
                            <div className="grid grid-cols-2 gap-2">
                              <button onClick={() => handleApprove(l.id)} className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black py-2.5 rounded-xl transition-all uppercase tracking-widest">อนุมัติ</button>
                              <button onClick={() => handleReject(l.id)} className="bg-gray-100 hover:bg-rose-50 hover:text-rose-500 text-gray-400 text-[10px] font-black py-2.5 rounded-xl transition-all uppercase">ปฏิเสธ</button>
                            </div>
                          ) : (
                            <div className={`text-center py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${l.status === "อนุมัติแล้ว" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                              {l.status}
                            </div>
                          )}
                        </div>
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
              <div className="space-y-6 bg-gray-50/50 p-10 rounded-[3rem] border border-gray-100 shadow-inner">
                {leaveError && (
                  <div className="p-5 bg-red-50 text-red-600 border border-red-100 rounded-[1.5rem] text-xs font-black flex items-center gap-3">
                    <div className="w-2 h-2 bg-red-600 rounded-full animate-ping"></div> {leaveError}
                  </div>
                )}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">ประเภทการลา</label>
                  <select
                    className="w-full bg-white border-2 border-transparent p-5 rounded-[1.5rem] font-black text-gray-700 focus:border-indigo-500 outline-none transition-all shadow-sm"
                    value={leaveType}
                    onChange={e => setLeaveType(e.target.value)}
                  >
                    <option value="">โปรดระบุประเภท</option>
                    <option value="ลาป่วย">ลาป่วย (SICK)</option>
                    <option value="ลากิจ">ลากิจ (PERSONAL)</option>
                    <option value="ลาพักร้อน">ลาพักร้อน (ANNUAL)</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">เริ่มต้น</label>
                    <input type="date" className="w-full bg-white border-2 border-transparent p-5 rounded-[1.5rem] font-bold text-gray-700 focus:border-indigo-500 outline-none shadow-sm" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">สิ้นสุด</label>
                    <input type="date" className="w-full bg-white border-2 border-transparent p-5 rounded-[1.5rem] font-bold text-gray-700 focus:border-indigo-500 outline-none shadow-sm" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">เหตุผลความจำเป็น</label>
                  <textarea
                    className="w-full bg-white border-2 border-transparent p-5 rounded-[1.5rem] font-medium text-gray-700 focus:border-indigo-500 outline-none shadow-sm min-h-[140px] resize-none"
                    placeholder="กรุณาระบุรายละเอียด..."
                    value={leaveReason}
                    onChange={e => setLeaveReason(e.target.value)}
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <button onClick={submitLeave} className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black px-8 py-6 rounded-[1.5rem] transition-all shadow-xl active:scale-95 uppercase tracking-tighter">ยืนยันการลา</button>
                  <button onClick={() => setShowLeaveForm(false)} className="flex-1 bg-white border-2 border-gray-200 text-gray-400 font-black px-8 py-6 rounded-[1.5rem] transition-all hover:bg-gray-50 active:scale-95 uppercase tracking-tighter">ยกเลิก</button>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* 📸 MODAL CAMERA */}
      {showCamera && (
        <div className="fixed inset-0 bg-slate-900/98 flex flex-col items-center justify-center z-[999] p-6 backdrop-blur-2xl">
          <div className="w-full max-w-sm relative">
            <div className="absolute -top-12 left-0 w-full flex justify-between px-2">
              <span className="text-blue-400 text-[10px] font-black tracking-widest uppercase animate-pulse">
                {isCheckingOut ? "Scanning Out Identity" : "Scanning Admin Identity"}
              </span>
              <span className="text-white/20 text-[10px] font-mono tracking-tighter">SECURE_VERIFY_V3</span>
            </div>
            <div className="relative rounded-[3.5rem] overflow-hidden border-[10px] border-white/5 shadow-2xl bg-black aspect-[3/4]">
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
              <div className="absolute inset-0 pointer-events-none">
                <div className="w-full h-full border-[30px] border-black/20 rounded-[3rem]">
                   <div className="w-full h-full border-2 border-white/10 rounded-[2rem] relative">
                      <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-400 shadow-[0_0_20px_#60a5fa] animate-scan"></div>
                   </div>
                </div>
              </div>
            </div>
            <div className="mt-16 flex flex-col items-center gap-10">
              {readyToCapture && (
                <button
                  onClick={handleCapture}
                  className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.2)] active:scale-75 transition-all group"
                >
                  <div className="w-20 h-20 border-4 border-blue-600 rounded-full flex items-center justify-center">
                    <div className="w-14 h-14 bg-slate-900 rounded-full"></div>
                  </div>
                </button>
              )}
              <button 
                onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); setShowCamera(false); }}
                className="text-white/30 hover:text-red-400 font-black text-[10px] tracking-[0.4em] uppercase transition-all"
              >
                Abort Scanning
              </button>
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
        @keyframes scan {
          0% { top: 10%; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
        .animate-scan { animation: scan 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}