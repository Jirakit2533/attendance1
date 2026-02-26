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
  position: string;
};

type LeaveItem = {
  id: number; // เพิ่ม ID เพื่อให้ง่ายต่อการอ้างอิงตอน Approve/Reject
  employeeName: string; // เพิ่มชื่อพนักงานเพื่อให้หัวหน้าทราบว่าเป็นของใคร
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
  // ตัวอย่างข้อมูลพนักงานที่ส่งมา (Mock data เพื่อให้เห็นตารางตอนเริ่มต้น)
  const [leaves, setLeaves] = useState<LeaveItem[]>([
    { id: 1, employeeName: "สมหมาย รักดี", type: "ลาพักร้อน", start: "2026-03-01", end: "2026-03-03", reason: "ไปธุระครอบครัว", days: 3, status: "รออนุมัติ" }
  ]);

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

  /* ---------------- LEADER ACTIONS ---------------- */
  const handleApprove = (id: number) => {
    setLeaves(prev => prev.map(item => item.id === id ? { ...item, status: "อนุมัติแล้ว" } : item));
  };

  const handleReject = (id: number) => {
    setLeaves(prev => prev.map(item => item.id === id ? { ...item, status: "ปฏิเสธ" } : item));
  };

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
      alert("ไม่สามารถเข้าถึงกล้องได้: " + err);
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
    try {
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
          position: "IT / Development",
        },
        ...prev,
      ]);
      setCheckedIn(true);
    } catch (err) {
      alert("กรุณาเปิดการแชร์ตำแหน่งพิกัด (GPS)");
    }
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
    return (Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
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
        id: Date.now(),
        employeeName: "นายสมชาย ใจดี", // ในที่นี้คือส่งในนามตัวเอง
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
    }, 2000);
  };

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
    <div className="min-h-screen bg-gray-100 p-4 md:p-6 space-y-6">
      
      {/* 1. PROFILE SECTION */}
      <div className="max-w-5xl mx-auto bg-white p-6 rounded-2xl shadow flex flex-col md:flex-row items-center md:items-start gap-6">
        <Image src="/profile.png" alt="Profile" width={120} height={120} className="rounded-full border-4 border-blue-500 shadow-sm" />
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-2xl font-bold text-gray-800">นายสมชาย ใจดี (Leader)</h1>
          <p className="text-blue-600 font-medium text-lg">Siam Royal System</p>
          <p className="text-gray-500 font-mono">EMP-00123 · IT / Development</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 w-full md:w-auto">
          {!checkedIn ? (
            <button onClick={handleCheckIn} disabled={checkingIn} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-xl transition-colors font-bold shadow-lg shadow-green-100">
              {checkingIn ? "กำลังเปิดกล้อง..." : "ลงชื่อเข้าทำงาน"}
            </button>
          ) : (
            <button onClick={handleCheckOut} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl transition-colors font-bold shadow-lg shadow-red-100">
              ลงชื่อเลิกงาน
            </button>
          )}
          <button onClick={() => setShowLeaveForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl transition-colors font-bold shadow-lg shadow-blue-100">
            ขอลางาน
          </button>
          <button onClick={handleLogout} className="bg-gray-700 hover:bg-gray-800 text-white px-6 py-2 rounded-xl transition-colors font-bold">
            ออกจากระบบ
          </button>
        </div>
      </div>

      {/* 2. MAIN CONTENT AREA */}
      <div className="max-w-5xl mx-auto space-y-8">
        {!showLeaveForm && (
          <>
            {/* ATTENDANCE TABLE SECTION */}
            <div className="bg-white p-6 rounded-2xl shadow overflow-hidden border border-gray-100">
              <h2 className="font-black text-gray-700 text-lg mb-4 border-l-4 border-blue-600 pl-3">ประวัติการลงชื่อทำงาน</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 uppercase">
                    <tr>
                      <th className="p-3 text-left">วันที่</th>
                      <th className="p-3">เข้างาน</th>
                      <th className="p-3">เลิกงาน</th>
                      <th className="p-3">ตำแหน่งงาน</th>
                      <th className="p-3">พิกัด</th>
                      <th className="p-3">รูปภาพ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {records.length === 0 && (
                      <tr><td colSpan={6} className="p-8 text-center text-gray-400">ยังไม่มีข้อมูลการเข้างาน</td></tr>
                    )}
                    {records.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-3 font-medium text-gray-700">{r.date}</td>
                        <td className="p-3 text-center text-green-600 font-bold">{r.checkIn}</td>
                        <td className="p-3 text-center text-red-600 font-bold">{r.checkOut}</td>
                        <td className="p-3 text-center text-gray-500">{r.position}</td>
                        <td className="p-3 text-center"><span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[10px] font-mono">{r.location}</span></td>
                        <td className="p-3 text-center"><div className="relative w-12 h-12 mx-auto"><Image src={r.imageUrl} alt="" fill className="rounded-lg object-cover border border-gray-200" unoptimized /></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* LEAVE MANAGEMENT SECTION (FOR LEADER) */}
            <div className="bg-white p-6 rounded-2xl shadow overflow-hidden border border-gray-100">
              <h2 className="font-black text-gray-700 text-lg mb-4 border-l-4 border-purple-600 pl-3">จัดการคำขอลางาน (พนักงาน)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 uppercase">
                    <tr>
                      <th className="p-3 text-left">ชื่อพนักงาน</th>
                      <th className="p-3 text-left">ประเภท</th>
                      <th className="p-3">วันที่เริ่ม - สิ้นสุด</th>
                      <th className="p-3">รวมวันลา</th>
                      <th className="p-3 text-left">เหตุผล</th>
                      <th className="p-3 text-center">สถานะ / การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leaves.length === 0 && (
                      <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">ยังไม่มีคำขอลางานส่งมา</td></tr>
                    )}
                    {leaves.map((l) => (
                      <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-3 font-bold text-gray-700">{l.employeeName}</td>
                        <td className="p-3 text-gray-800">{l.type}</td>
                        <td className="p-3 text-center text-gray-600">{l.start} ถึง {l.end}</td>
                        <td className="p-3 text-center font-bold text-purple-600">{l.days} วัน</td>
                        <td className="p-3 text-left text-gray-500 max-w-[150px] truncate">{l.reason}</td>
                        <td className="p-3 text-center">
                          {l.status === "รออนุมัติ" ? (
                            <div className="flex justify-center gap-2">
                              <button onClick={() => handleApprove(l.id)} className="bg-green-100 text-green-700 px-3 py-1 rounded-lg font-bold hover:bg-green-600 hover:text-white transition-all text-[10px]">อนุมัติ</button>
                              <button onClick={() => handleReject(l.id)} className="bg-red-100 text-red-700 px-3 py-1 rounded-lg font-bold hover:bg-red-600 hover:text-white transition-all text-[10px]">ปฏิเสธ</button>
                            </div>
                          ) : (
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                              l.status === 'อนุมัติแล้ว' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                            }`}>
                              {l.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* 3. LEAVE FORM SECTION */}
        {showLeaveForm && (
          <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-xl border-t-4 border-blue-600 space-y-6 animate-in fade-in zoom-in duration-300">
            <h2 className="text-2xl font-black text-gray-800">แบบฟอร์มคำขอลางาน</h2>
            {leaveSuccess && (<div className="p-4 bg-green-100 border border-green-200 text-green-700 rounded-xl text-center font-bold">✓ ส่งคำขอลางานสำเร็จ ระบบกำลังอัปเดต...</div>)}
            {!leaveSuccess && (
              <>
                {leaveError && (<div className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-xl text-sm font-bold">⚠️ {leaveError}</div>)}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">ประเภทการลา</label>
                    <select className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-blue-500 outline-none transition-all" value={leaveType} onChange={e => setLeaveType(e.target.value)}>
                      <option value="">กรุณาเลือกประเภท...</option>
                      <option>ลาป่วย (Sick Leave)</option>
                      <option>ลากิจ (Personal Leave)</option>
                      <option>ลาพักร้อน (Vacation Leave)</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">เริ่มวันที่</label>
                      <input type="date" className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-blue-500 outline-none" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">ถึงวันที่</label>
                      <input type="date" className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-blue-500 outline-none" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} />
                    </div>
                  </div>
                  {leaveDays > 0 && (<div className="bg-blue-50 p-3 rounded-xl flex justify-between items-center"><span className="text-blue-700 font-bold">คำนวณวันลาทั้งหมด:</span><span className="text-2xl font-black text-blue-800">{leaveDays} <span className="text-sm">วัน</span></span></div>)}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">ระบุเหตุผลการลา</label>
                    <textarea className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-blue-500 outline-none h-32" placeholder="เขียนรายละเอียดเพิ่มเติม..." value={leaveReason} onChange={e => setLeaveReason(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button onClick={submitLeave} className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-xl font-black transition-transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-green-100">ส่งคำขอลา</button>
                  <button onClick={cancelLeaveForm} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-3 rounded-xl font-bold transition-colors">ยกเลิก</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 4. CAMERA OVERLAY */}
      {showCamera && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-[100] p-4 backdrop-blur-md">
          <div className="relative w-full max-w-sm aspect-video sm:aspect-square bg-gray-800 rounded-3xl overflow-hidden border-4 border-white shadow-2xl">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-0 border-[40px] border-black/20 pointer-events-none flex items-center justify-center"><div className="w-64 h-64 border-2 border-white/50 border-dashed rounded-full"></div></div>
          </div>
          <div className="flex gap-6 mt-8">
            <button onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); setShowCamera(false); }} className="bg-white/10 hover:bg-white/20 text-white w-16 h-16 rounded-full flex items-center justify-center transition-colors">✕</button>
            {readyToCapture && (<button onClick={handleCapture} className="bg-white text-blue-600 w-20 h-20 rounded-full flex items-center justify-center text-xl font-black shadow-2xl hover:scale-110 active:scale-90 transition-transform">SNAP</button>)}
          </div>
          <p className="text-white/60 text-sm mt-4">กรุณาวางใบหน้าให้ตรงกับกรอบ</p>
        </div>
      )}
    </div>
  );
}