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
  position: string; // ADDED
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

  /* ---------------- CHECK IN ---------------- */
  const handleCheckIn = async () => {
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

  const handleCapture = async () => {
    if (!videoRef.current || !streamRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);

    streamRef.current.getTracks().forEach(t => t.stop());
    setShowCamera(false);
    setReadyToCapture(false);

    const pos = await new Promise<GeolocationPosition>((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej)
    );

    const now = new Date();

    setRecords(prev => [
      {
        date: now.toLocaleDateString(),
        checkIn: now.toLocaleTimeString(),
        checkOut: "-",
        location: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`,
        imageUrl: canvas.toDataURL("image/png"),
        position: "IT / Development", // ADDED (mock position)
      },
      ...prev,
    ]);

    setCheckedIn(true);
  };

  const handleCheckOut = () => {
    const now = new Date();
    setCheckedIn(false);

    setRecords(prev =>
      prev.map((r, i) =>
        i === 0 ? { ...r, checkOut: now.toLocaleTimeString() } : r
      )
    );
  };

  /* ---------------- LOGOUT ---------------- */
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
    return (
      Math.floor(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1
    );
  }, [leaveStart, leaveEnd]);

  const submitLeave = () => {
    setLeaveError("");

    if (!leaveType || !leaveStart || !leaveEnd) {
      setLeaveError("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    if (new Date(leaveEnd) < new Date(leaveStart)) {
      setLeaveError("วันสิ้นสุดต้องไม่ก่อนวันเริ่มลา");
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
      setLeaveError("");
    }, 3000);
  };

  /* ---------------- CANCEL LEAVE FORM ---------------- */
  const cancelLeaveForm = () => {
    setShowLeaveForm(false);
    setLeaveType("");
    setLeaveStart("");
    setLeaveEnd("");
    setLeaveReason("");
    setLeaveError("");
    setLeaveSuccess(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-2 sm:p-4 md:p-6 lg:p-10 transition-all duration-300">
      
      {/* PROFILE SECTION - Optimized for Mobile Stacking */}
      <div className="max-w-5xl mx-auto bg-white p-4 sm:p-6 md:p-8 rounded-2xl shadow-md mb-6 flex flex-col md:flex-row items-center md:items-start gap-6">
        <div className="relative group">
          <Image
            src="/profile.png"
            alt="Profile"
            width={120}
            height={120}
            className="rounded-full border-4 border-blue-400 shadow-sm w-28 h-28 md:w-32 md:h-32 object-cover"
          />
          <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
        </div>

        <div className="flex-1 text-center md:text-left">
          <h1 className="text-xl md:text-2xl font-black text-gray-800">นายสมชาย ใจดี</h1>
          <p className="text-blue-600 font-semibold text-sm md:text-base">Siam Royal System</p>
          <div className="mt-2 flex flex-wrap justify-center md:justify-start gap-2">
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-md font-medium uppercase">EMP-00123</span>
            <span className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-md font-medium italic">IT / Development</span>
          </div>
        </div>

        {/* Action Buttons - Full width on Mobile */}
        <div className="flex flex-col gap-3 w-full md:w-auto min-w-[180px]">
          {!checkedIn ? (
            <button
              onClick={handleCheckIn}
              disabled={checkingIn}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-3 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              {checkingIn ? "กำลังเตรียมกล้อง..." : "ลงชื่อเข้าทำงาน"}
            </button>
          ) : (
            <button
              onClick={handleCheckOut}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-3 rounded-xl transition-all shadow-lg active:scale-95"
            >
              ลงชื่อเลิกงาน
            </button>
          )}

          <button
            onClick={() => setShowLeaveForm(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-3 rounded-xl transition-all shadow-lg active:scale-95"
          >
            ขอลางาน
          </button>

          <button
            onClick={handleLogout}
            className="w-full bg-gray-700 hover:bg-gray-800 text-white font-bold px-5 py-3 rounded-xl transition-all active:scale-95 text-sm"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="max-w-5xl mx-auto bg-white p-4 sm:p-6 md:p-8 rounded-2xl shadow-md space-y-10">
        {!showLeaveForm && (
          <>
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <h2 className="font-black text-gray-800 text-lg uppercase tracking-tight italic">ประวัติการลงชื่อทำงาน</h2>
                <span className="text-[10px] text-gray-400 font-bold hidden sm:inline">REAL-TIME SYNC</span>
              </div>

              {/* Responsive Table Wrapper */}
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-sm border-collapse min-w-[600px] sm:min-w-0">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold tracking-widest">
                    <tr>
                      <th className="p-4 text-left border-b">วันที่</th>
                      <th className="p-4 text-left border-b">เข้า</th>
                      <th className="p-4 text-left border-b">ออก</th>
                      <th className="p-4 text-left border-b">ตำแหน่งงาน</th>
                      <th className="p-4 text-left border-b">พิกัด</th>
                      <th className="p-4 text-center border-b">รูป</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {records.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-10 text-center text-gray-400 italic">ไม่มีข้อมูลการลงเวลา</td>
                      </tr>
                    )}
                    {records.map((r, i) => (
                      <tr key={i} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="p-4 font-bold text-gray-700">{r.date}</td>
                        <td className="p-4"><span className="text-green-600 font-black">{r.checkIn}</span></td>
                        <td className="p-4"><span className="text-red-500 font-black">{r.checkOut}</span></td>
                        <td className="p-4 text-gray-500 font-medium italic">{r.position}</td>
                        <td className="p-4 text-[10px] font-mono text-gray-400 bg-gray-50/50">{r.location}</td>
                        <td className="p-4">
                          <div className="flex justify-center">
                            <Image
                              src={r.imageUrl}
                              alt="Attendance"
                              width={48}
                              height={48}
                              className="rounded-lg border shadow-sm group-hover:scale-125 transition-transform"
                              unoptimized
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Leave History Section */}
            <div className="pt-6 border-t border-gray-100">
              <h2 className="font-black text-gray-800 text-lg uppercase tracking-tight italic mb-4">คำขอลางาน</h2>

              {leaves.length === 0 && (
                <div className="bg-gray-50 p-6 rounded-xl border-2 border-dashed border-gray-200 text-center">
                  <p className="text-gray-400 text-sm">ยังไม่มีประวัติการขอลางานในระบบ</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {leaves.map((l, i) => (
                  <div key={i} className="p-4 border border-gray-100 rounded-2xl shadow-sm bg-white hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-black text-gray-800 text-base">{l.type}</p>
                      <span className="text-[11px] bg-yellow-50 text-yellow-600 px-3 py-1 rounded-full font-bold border border-yellow-100">
                        {l.status}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-blue-600 mb-2">
                      {l.start} – {l.end} <span className="text-gray-400 mx-1">|</span> {l.days} วัน
                    </p>
                    <div className="bg-gray-50 p-3 rounded-xl">
                      <p className="text-xs text-gray-600 leading-relaxed italic">
                        <span className="font-bold uppercase text-[9px] text-gray-400 block mb-1">REASON:</span>
                        {l.reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* LEAVE FORM - Desktop/Mobile Adaptive Form */}
        {showLeaveForm && (
          <div className="max-w-2xl mx-auto space-y-6 py-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black text-gray-800 tracking-tight">แบบฟอร์มการขอลางาน</h2>
              <p className="text-gray-400 text-sm">กรุณาระบุประเภทและเหตุผลการลาให้ชัดเจน</p>
            </div>

            {leaveSuccess && (
              <div className="p-6 bg-green-50 border border-green-200 text-green-700 rounded-2xl text-center font-black animate-bounce">
                ✅ ส่งคำขอลางานเรียบร้อย ระบบจะดำเนินการในลำดับถัดไป
              </div>
            )}

            {!leaveSuccess && (
              <div className="space-y-5 bg-gray-50/50 p-5 rounded-3xl border border-gray-100 shadow-inner">
                {leaveError && (
                  <div className="p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                    {leaveError}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest ml-1">ประเภทการลา</label>
                  <select
                    className="w-full bg-white border border-gray-200 p-4 rounded-xl font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                    onChange={e => setLeaveType(e.target.value)}
                  >
                    <option value="">เลือกประเภทการลา</option>
                    <option>ลาป่วย (SICK LEAVE)</option>
                    <option>ลากิจ (PERSONAL LEAVE)</option>
                    <option>ลาพักร้อน (ANNUAL LEAVE)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest ml-1">ตั้งแต่วันที่</label>
                    <input
                      type="date"
                      className="w-full bg-white border border-gray-200 p-4 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                      onChange={e => setLeaveStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest ml-1">ถึงวันที่</label>
                    <input
                      type="date"
                      className="w-full bg-white border border-gray-200 p-4 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                      onChange={e => setLeaveEnd(e.target.value)}
                    />
                  </div>
                </div>

                {leaveDays > 0 && (
                  <div className="bg-blue-600 text-white p-3 rounded-xl text-center">
                    <p className="text-sm font-black italic">รวมจำนวนวันลาทั้งหมด: {leaveDays} วัน</p>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest ml-1">เหตุผลการลา</label>
                  <textarea
                    className="w-full bg-white border border-gray-200 p-4 rounded-xl font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm min-h-[120px]"
                    placeholder="ระบุเหตุผลการลาเพื่อการพิจารณา..."
                    onChange={e => setLeaveReason(e.target.value)}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    onClick={submitLeave}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-black px-6 py-4 rounded-xl transition-all shadow-lg shadow-green-100 active:scale-95"
                  >
                    ส่งคำขอลา
                  </button>

                  <button
                    onClick={cancelLeaveForm}
                    className="flex-1 bg-white border-2 border-gray-200 hover:bg-gray-100 text-gray-500 font-black px-6 py-4 rounded-xl transition-all active:scale-95"
                  >
                    ยกเลิก / ปิดฟอร์ม
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL CAMERA - Professional Overlay */}
      {showCamera && (
        <div className="fixed inset-0 bg-slate-900/95 flex flex-col items-center justify-center z-[999] p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm relative">
            <div className="absolute -top-10 left-0 w-full flex justify-between px-2">
              <span className="text-white text-[10px] font-black tracking-widest uppercase animate-pulse flex items-center gap-2">
                <span className="w-2 h-2 bg-red-600 rounded-full"></span> LIVE FEED
              </span>
              <span className="text-white/40 text-[10px] font-mono tracking-tighter uppercase">SCAN_MODE_USER_FACE</span>
            </div>
            
            <div className="relative rounded-[2.5rem] overflow-hidden border-4 border-white shadow-[0_0_50px_rgba(255,255,255,0.1)]">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full aspect-[3/4] object-cover scale-x-[-1]"
              />
              {/* Camera Scanner UI Overlay */}
              <div className="absolute inset-0 pointer-events-none border-[30px] border-black/20">
                <div className="w-full h-full border-2 border-dashed border-white/30 rounded-2xl relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4/5 h-[2px] bg-blue-400/50 blur-[2px] animate-scan"></div>
                </div>
              </div>
            </div>

            <div className="mt-10 flex flex-col items-center gap-6">
              {readyToCapture && (
                <button
                  onClick={handleCapture}
                  className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl active:scale-75 transition-transform"
                >
                  <div className="w-16 h-16 border-4 border-slate-900 rounded-full flex items-center justify-center">
                    <div className="w-12 h-12 bg-slate-900 rounded-full"></div>
                  </div>
                </button>
              )}
              
              <button 
                onClick={() => {
                  streamRef.current?.getTracks().forEach(t => t.stop());
                  setShowCamera(false);
                }}
                className="text-white/50 hover:text-white font-bold text-sm tracking-widest uppercase transition-colors"
              >
                ยกเลิกการลงชื่อ (Cancel)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL CSS FOR SCAN ANIMATION */}
      <style jsx global>{`
        @keyframes scan {
          0% { top: 10%; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
        .animate-scan {
          position: absolute;
          animation: scan 3s linear infinite;
        }
      `}</style>
    </div>
  );
}