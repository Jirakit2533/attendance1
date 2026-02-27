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
  checkOutImageUrl?: string; // เพิ่มฟิลด์รูปเลิกงาน
  position: string;
};

type LeaveItem = {
  type: string;
  start: string;
  end: string;
  reason: string;
  days: number;
  status: "รออนุมัติ";
};

export default function EmployeePage() {
  const router = useRouter();

  const [records, setRecords] = useState<RecordItem[]>([]);
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);

  const [checkedIn, setCheckedIn] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false); // เช็คว่าเป็นการเลิกงานหรือไม่
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

  /* ---------------- CAMERA LOGIC (SHARED) ---------------- */
  const startCamera = async () => {
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
    startCamera();
  };

  const handleCheckOut = () => {
    setIsCheckingOut(true);
    startCamera();
  };

  const handleCapture = async () => {
    if (!videoRef.current || !streamRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);
    const capturedImg = canvas.toDataURL("image/png");

    streamRef.current.getTracks().forEach(t => t.stop());
    setShowCamera(false);
    setReadyToCapture(false);

    const pos = await new Promise<GeolocationPosition>((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej)
    );
    const now = new Date();

    if (isCheckingOut) {
      // กรณีลงชื่อเลิกงาน
      setRecords(prev =>
        prev.map((r, i) =>
          i === 0 ? { ...r, checkOut: now.toLocaleTimeString('th-TH'), checkOutImageUrl: capturedImg } : r
        )
      );
      setCheckedIn(false);
    } else {
      // กรณีลงชื่อเข้างาน
      setRecords(prev => [
        {
          date: now.toLocaleDateString('th-TH'),
          checkIn: now.toLocaleTimeString('th-TH'),
          checkOut: "-",
          location: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`,
          imageUrl: capturedImg,
          position: "ฝ่ายไอที / พัฒนาซอฟต์แวร์",
        },
        ...prev,
      ]);
      setCheckedIn(true);
    }
  };

  const handleLogout = () => {
    setCheckedIn(false);
    setRecords([]);
    setLeaves([]);
    router.push("/login");
  };

  /* ---------------- LEAVE LOGIC ---------------- */
  const leaveDays = useMemo(() => {
    if (!leaveStart || !leaveEnd) return 0;
    const start = new Date(leaveStart);
    const end = new Date(leaveEnd);
    if (end < start) return 0;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }, [leaveStart, leaveEnd]);

  const submitLeave = () => {
    setLeaveError("");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(leaveStart);
    const end = new Date(leaveEnd);

    if (!leaveType || !leaveStart || !leaveEnd || !leaveReason) {
      setLeaveError("กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง");
      return;
    }
    if (start < today) {
      setLeaveError("ไม่สามารถเลือกวันลาย้อนหลังได้");
      return;
    }
    if (end < start) {
      setLeaveError("วันสิ้นสุดต้องไม่มาก่อนวันเริ่มต้น");
      return;
    }

    setLeaves(prev => [
      {
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
    }, 2500);
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
              <h1 className="font-black text-gray-900 tracking-tighter text-xl leading-none">
                SIAM ROYAL <span className="text-blue-600">SYSTEM</span>
              </h1>
              <span className="text-[10px] text-gray-400 font-bold tracking-[0.2em] uppercase mt-1">ศูนย์นวัตกรรมแห่งอนาคต</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-black text-gray-800">นายสมชาย ใจดี</span>
              <span className="text-[10px] text-green-500 font-black uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> เข้าสู่ระบบแล้ว
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

      <main className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-10">
        {/* 👤 PROFILE CARD */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.03)] mb-10 flex flex-col md:flex-row items-center md:items-start gap-8 relative border border-white">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-10"></div>
            <Image
              src="/profile.png"
              alt="Profile"
              width={140}
              height={140}
              className="rounded-[2.5rem] border-4 border-white shadow-2xl w-32 h-32 md:w-36 md:h-36 object-cover relative z-10"
            />
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-2xl shadow-lg flex items-center justify-center z-20">
              <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </div>

          <div className="flex-1 text-center md:text-left pt-2">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
              พนักงานประจำ
            </div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-1">นายสมชาย ใจดี</h2>
            <p className="text-gray-500 font-bold text-lg mb-6">นักพัฒนาซอฟต์แวร์อาวุโส</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-2">
              <span className="bg-gray-50 text-gray-400 text-[10px] px-4 py-2 rounded-xl font-black border border-gray-100">รหัส: EMP-00123</span>
              <span className="bg-blue-50 text-blue-500 text-[10px] px-4 py-2 rounded-xl font-black border border-blue-100 uppercase">ไอที / ดีวอปส์</span>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {checkingIn ? "กำลังเรียกกล้อง..." : "ลงชื่อเข้าทำงาน"}
              </button>
            ) : (
              <button
                onClick={handleCheckOut}
                disabled={checkingIn}
                className="w-full bg-slate-900 hover:bg-black text-white font-black px-8 py-5 rounded-[1.5rem] transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 group"
              >
                <svg className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {checkingIn ? "กำลังเรียกกล้อง..." : "ลงชื่อเลิกงาน"}
              </button>
            )}
            <button
              onClick={() => setShowLeaveForm(true)}
              className="w-full bg-white border-2 border-gray-100 hover:border-blue-600 hover:text-blue-600 text-gray-500 font-black px-8 py-5 rounded-[1.5rem] transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              ขอลางาน
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
                    <h2 className="font-black text-gray-900 text-xl tracking-tighter uppercase">ประวัติ <span className="text-gray-300">การเข้างาน</span></h2>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-[2rem] border border-gray-50">
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
                      {records.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-20 text-center text-gray-300 font-bold italic">ยังไม่มีข้อมูลการเข้างานในระบบ</td>
                        </tr>
                      )}
                      {records.map((r, i) => (
                        <tr key={i} className="hover:bg-blue-50/10 transition-colors group">
                          <td className="p-6 font-bold text-gray-800">{r.date}</td>
                          <td className="p-6">
                            <div className="flex items-center gap-3">
                              <span className="text-blue-600 font-black bg-blue-50 px-3 py-1.5 rounded-xl">{r.checkIn}</span>
                              <Image src={r.imageUrl} alt="Check In" width={40} height={40} className="rounded-xl border-2 border-white shadow-sm unoptimized" unoptimized />
                            </div>
                          </td>
                          <td className="p-6">
                            <div className="flex items-center gap-3">
                              <span className={r.checkOut === "-" ? "text-gray-300 font-black" : "text-slate-900 font-black bg-slate-100 px-3 py-1.5 rounded-xl"}>{r.checkOut}</span>
                              {r.checkOutImageUrl && (
                                <Image src={r.checkOutImageUrl} alt="Check Out" width={40} height={40} className="rounded-xl border-2 border-white shadow-sm unoptimized" unoptimized />
                              )}
                            </div>
                          </td>
                          <td className="p-6">
                            <div className="flex flex-col">
                               <span className="text-xs font-black text-gray-700">{r.position}</span>
                               <span className="text-[10px] font-mono text-gray-400">📍 {r.location}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Leave History Section */}
              <div className="pt-10 border-t border-gray-50">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-2 h-8 bg-indigo-600 rounded-full"></div>
                    <h2 className="font-black text-gray-900 text-xl tracking-tighter uppercase">คำขอ <span className="text-gray-300">ลางานของฉัน</span></h2>
                </div>

                {leaves.length === 0 ? (
                  <div className="bg-gray-50/50 p-16 rounded-[2.5rem] border-2 border-dashed border-gray-100 text-center">
                    <p className="text-gray-300 font-black uppercase tracking-[0.2em] text-sm">ไม่มีประวัติการขอลางาน</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {leaves.map((l, i) => (
                      <div key={i} className="p-8 border border-gray-100 rounded-[2rem] bg-white hover:shadow-2xl hover:shadow-indigo-500/10 transition-all relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
                        <div className="flex justify-between items-start mb-6">
                          <div>
                             <p className="font-black text-gray-900 text-lg uppercase tracking-tight">{l.type}</p>
                             <p className="text-xs font-bold text-indigo-500 mt-1">{l.start} ถึง {l.end}</p>
                          </div>
                          <span className="text-[9px] bg-amber-50 text-amber-600 px-4 py-2 rounded-full font-black border border-amber-100 uppercase tracking-widest">
                            {l.status}
                          </span>
                        </div>
                        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                           <span className="font-black uppercase text-[9px] text-gray-400 block mb-2 tracking-widest">รายละเอียด:</span>
                           <p className="text-sm text-gray-600 font-medium italic">{l.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Leave Form */}
          {showLeaveForm && (
            <div className="max-w-2xl mx-auto py-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase mb-2">ยื่นเรื่อง <span className="text-blue-600">ลางาน</span></h2>
                <div className="w-12 h-1.5 bg-blue-600 mx-auto rounded-full"></div>
              </div>

              {leaveSuccess ? (
                <div className="p-12 bg-green-50 border border-green-100 text-green-700 rounded-[3rem] text-center space-y-4 shadow-xl shadow-green-500/10">
                  <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto text-white text-4xl shadow-lg">✓</div>
                  <p className="font-black text-2xl tracking-tighter uppercase">ส่งข้อมูลสำเร็จ</p>
                  <p className="text-sm font-bold opacity-70 uppercase tracking-widest">ระบบกำลังบันทึกข้อมูลการลาของคุณ</p>
                </div>
              ) : (
                <div className="space-y-6 bg-gray-50/50 p-10 rounded-[3rem] border border-gray-100 shadow-inner">
                  {leaveError && (
                    <div className="p-5 bg-red-50 text-red-600 border border-red-100 rounded-[1.5rem] text-xs font-black flex items-center gap-3 animate-shake">
                      <div className="w-2 h-2 bg-red-600 rounded-full animate-ping"></div> {leaveError}
                    </div>
                  )}

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">ประเภทการลา</label>
                    <select
                      className="w-full bg-white border-2 border-transparent p-5 rounded-[1.5rem] font-black text-gray-700 focus:border-blue-500 outline-none transition-all shadow-sm cursor-pointer"
                      value={leaveType}
                      onChange={e => setLeaveType(e.target.value)}
                    >
                      <option value="">เลือกประเภทการลา</option>
                      <option value="ลาป่วย">ลาป่วย (SICK LEAVE)</option>
                      <option value="ลากิจ">ลากิจ (PERSONAL LEAVE)</option>
                      <option value="ลาพักร้อน">ลาพักร้อน (ANNUAL LEAVE)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">ตั้งแต่วันที่</label>
                      <input type="date" className="w-full bg-white border-2 border-transparent p-5 rounded-[1.5rem] font-bold text-gray-700 focus:border-blue-500 outline-none shadow-sm" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">ถึงวันที่</label>
                      <input type="date" className="w-full bg-white border-2 border-transparent p-5 rounded-[1.5rem] font-bold text-gray-700 focus:border-blue-500 outline-none shadow-sm" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} />
                    </div>
                  </div>

                  {leaveDays > 0 && (
                    <div className="bg-blue-600 text-white p-5 rounded-[1.5rem] text-center shadow-lg shadow-blue-500/20">
                      <p className="text-sm font-black uppercase tracking-widest">สรุปจำนวนวันลา: {leaveDays} วัน</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">เหตุผลการลางาน</label>
                    <textarea
                      className="w-full bg-white border-2 border-transparent p-5 rounded-[1.5rem] font-medium text-gray-700 focus:border-blue-500 outline-none shadow-sm min-h-[160px] resize-none"
                      placeholder="กรุณาระบุรายละเอียดหรือเหตุผลในการลา..."
                      value={leaveReason}
                      onChange={e => setLeaveReason(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button onClick={submitLeave} className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-6 rounded-[1.5rem] transition-all shadow-xl active:scale-95 uppercase tracking-tighter">ยืนยันการส่งข้อมูล</button>
                    <button onClick={() => { setShowLeaveForm(false); setLeaveError(""); }} className="flex-1 bg-white border-2 border-gray-200 text-gray-400 font-black px-8 py-6 rounded-[1.5rem] transition-all hover:bg-gray-50 active:scale-95 uppercase tracking-tighter">ยกเลิก</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* 📸 MODAL CAMERA (SHARED) */}
      {showCamera && (
        <div className="fixed inset-0 bg-slate-900/98 flex flex-col items-center justify-center z-[999] p-6 backdrop-blur-2xl">
          <div className="w-full max-w-sm relative">
            <div className="absolute -top-12 left-0 w-full flex justify-between px-2">
              <span className="text-blue-400 text-[10px] font-black tracking-widest uppercase animate-pulse">
                {isCheckingOut ? "สแกนยืนยันการเลิกงาน" : "สแกนยืนยันการเข้างาน"}
              </span>
              <span className="text-white/20 text-[10px] font-mono tracking-tighter">SRS_SECURITY_v2</span>
            </div>
            
            <div className="relative rounded-[3.5rem] overflow-hidden border-[10px] border-white/5 shadow-2xl bg-black aspect-[3/4]">
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
              <div className="absolute inset-0 pointer-events-none">
                <div className="w-full h-full border-[30px] border-black/20 rounded-[3rem]">
                   <div className="w-full h-full border-2 border-white/10 rounded-[2rem] relative">
                      <div className={`absolute top-0 left-0 w-full h-[2px] ${isCheckingOut ? 'bg-amber-400 shadow-[0_0_20px_#fbbf24]' : 'bg-blue-400 shadow-[0_0_20px_#60a5fa]'} animate-scan`}></div>
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
                  <div className={`w-20 h-20 border-4 ${isCheckingOut ? 'border-amber-500' : 'border-blue-600'} rounded-full flex items-center justify-center`}>
                    <div className="w-14 h-14 bg-slate-900 rounded-full"></div>
                  </div>
                </button>
              )}
              <button 
                onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); setShowCamera(false); }}
                className="text-white/30 hover:text-red-400 font-black text-[10px] tracking-[0.4em] uppercase transition-all"
              >
                ยกเลิกขั้นตอน
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes scan {
          0% { top: 10%; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
        .animate-scan { animation: scan 3s ease-in-out infinite; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
}