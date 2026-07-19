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
  createPersonalOTAction,
  updateOTStatusAction,
} from "./actions";
import { CardSmall } from "@/components/ui/cardSmall";
import { OffsiteCheckOutConfirm } from "@/components/ui/OffsiteCheckOutConfirm";

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

/* ---------------- MAIN COMPONENT ---------------- */

export default function LeaderClientPage({
  userProfile,
  myRecords = [],
  initialLeaves = [],
  initialAttendance = [],
  myLeaves = [],
  companyData,
  initialOT = [],
  myOT,
}: any) {
  const router = useRouter();

  // --- States ---
  const [records, setRecords] = useState<any[]>(myRecords);
  const [leaves, setLeaves] = useState<any[]>(initialLeaves);
  const [teamAttendance, setTeamAttendance] =
    useState<any[]>(initialAttendance);
  const [overtimeRequests, setOvertimeRequests] = useState<any[]>(initialOT);

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

  const currentInitialOTString = JSON.stringify(initialOT);
  useEffect(() => {
    if (currentInitialOTString !== JSON.stringify(overtimeRequests)) {
      setOvertimeRequests(initialOT || []);
    }
  }, [currentInitialOTString]);

  const { startUpload: uploadAttendance } = useUploadThing("imageUploader");
  const { startUpload: uploadLeave } = useUploadThing("leaveFileUploader");

  const [showCamera, setShowCamera] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [readyToCapture, setReadyToCapture] = useState(false);
  const [searchAtt, setSearchAtt] = useState("");
  const [showSuccessCard, setShowSuccessCard] = useState(false);

  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveSuccess, setLeaveSuccess] = useState(false);
  const [leaveType, setLeaveType] = useState("");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveStartTime, setLeaveStartTime] = useState<string>("");
  const [leaveEndTime, setLeaveEndTime] = useState<string>("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveError, setLeaveError] = useState("");
  const [leaveFile, setLeaveFile] = useState<File | null>(null);
  const [leaveFilePreview, setLeaveFilePreview] = useState<string | null>(null);
  const [searchLeave, setSearchLeave] = useState("");
  const [leaveRemarks, setLeaveRemarks] = useState<Record<string, string>>({});
  const [viewRemarkId, setViewRemarkId] = useState<string | null>(null);
  const [pendingData, setPendingData] = useState<any>(null);

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
  const [showOffsitePopup, setShowOffsitePopup] = useState<boolean>(false);
  const [showLogoutConfirmPopup, setShowLogoutConfirmPopup] = useState<boolean>(false);
  const [showOTModal, setShowOTModal] = useState(false);
  const [otError, setOtError] = useState("");
  const [otSuccess, setOtSuccess] = useState(false);
  const [otRemarks, setOtRemarks] = useState<{ [key: string]: string }>({});
  const [isProcessingOT, setIsProcessingOT] = useState(false);

  const [searchOT, setSearchOT] = useState("");

  const [otData, setOtData] = useState({
    date: "",
    startTime: "17:00", // ตั้ง Default ไว้เวลาเลิกงานปกติ
    endTime: "19:00",
    siteId: "",
    reason: "",
  });

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

  const calculateTotalHours = (
    startDate: string,
    endDate: string,
    startTime: string,
    endTime: string
  ): number => {
    if (!startDate || !endDate || !startTime || !endTime) return 0;

    // สร้าง Object Date โดยรวมวันที่และเวลาเข้าด้วยกัน (Format ISO: YYYY-MM-DDTHH:mm:ss)
    const start = new Date(`${startDate}T${startTime}:00`);
    const end = new Date(`${endDate}T${endTime}:00`);

    // ป้องกันกรณี End 00:00 (วันถัดไป)
    if (endTime === "00:00") {
      end.setDate(end.getDate() + 1);
    }

    // คำนวณส่วนต่างเป็นมิลลิวินาที
    const diffInMs = end.getTime() - start.getTime();

    // แปลงเป็นชั่วโมง
    const diffInHours = diffInMs / (1000 * 60 * 60);

    // คืนค่าเป็นทศนิยม 1 ตำแหน่ง ถ้าค่าติดลบคืน 0
    return diffInHours > 0 ? parseFloat(diffInHours.toFixed(1)) : 0;
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
  const teamOT = useMemo(
    () =>
      (initialOT || []).filter(
        (ot: any) =>
          ot.userId !== userProfile.id && ot.user_id !== userProfile.id
      ),
    [initialOT, userProfile.id]
  );
  // กรองข้อมูล OT ตามชื่อพนักงาน หรือ โปรเจกต์
  const filteredOT = useMemo(() => {
    const searchTerm = searchOT.toLowerCase();
    return teamOT.filter(
      (ot: any) =>
        ot.employeeName?.toLowerCase().includes(searchTerm) ||
        ot.projectTag?.toLowerCase().includes(searchTerm) ||
        ot.reason?.toLowerCase().includes(searchTerm)
    );
  }, [teamOT, searchOT]);
  /* ---------------- OT ACTIONS ---------------- */

  /* -------------------------------------------------------------------------- */
  /* LEADER OT ACTIONS (จัดการอนุมัติ/ปฏิเสธ OT)                                     */
  /* -------------------------------------------------------------------------- */

  const handleOTRemarkChange = (id: string, value: string) => {
    setOtRemarks((prev) => ({ ...prev, [id]: value }));
  };

  const handleApproveOT = async (otId: string) => {
    if (!confirm("คุณต้องการอนุมัติการทำ OT นี้ใช่หรือไม่?")) return;
    setIsProcessingOT(true);
    try {
      // ดึงหมายเหตุ OT ที่พิมพ์ไว้
      const remark = otRemarks[otId] || "";
      const res = await updateOTStatusAction(
        otId,
        "approved",
        remark // ส่ง remark เป็นตัวที่ 3 ตามที่ Backend รับ (เอา userProfile.id ออก)
      );
      if (res.success) {
        router.refresh(); // สั่งให้หน้าจอรีเฟรชเพื่อเปลี่ยนสถานะปุ่ม
      } else {
        alert(res.error || "เกิดข้อผิดพลาดในการอนุมัติ OT");
      }
    } catch (error) {
      alert("ระบบขัดข้อง กรุณาลองใหม่ในภายหลัง");
    } finally {
      setIsProcessingOT(false);
    }
  };

  const handleRejectOT = async (otId: string) => {
    if (!confirm("คุณต้องการปฏิเสธการทำ OT นี้ใช่หรือไม่?")) return;
    setIsProcessingOT(true);
    try {
      const remark = otRemarks[otId] || "";
      const res = await updateOTStatusAction(
        otId,
        "rejected",
        remark // ส่ง remark เป็นตัวที่ 3 ตามที่ Backend รับ (เอา userProfile.id ออก)
      );
      if (res.success) {
        router.refresh(); // สั่งให้หน้าจอรีเฟรชเพื่อเปลี่ยนสถานะปุ่ม
      } else {
        alert(res.error || "เกิดข้อผิดพลาดในการปฏิเสธ OT");
      }
    } catch (error) {
      alert("ระบบขัดข้อง กรุณาลองใหม่ในภายหลัง");
    } finally {
      setIsProcessingOT(false);
    }
  };

  const resetOTStatus = async (otId: string) => {
    if (!confirm("คุณต้องการดึงรายการนี้กลับมาแก้ไขใหม่ใช่หรือไม่?")) return;
    setIsProcessingOT(true);
    try {
      const res = await updateOTStatusAction(
        otId,
        "pending",
        "" // ล้างหมายเหตุเมื่อดึงกลับมา (ส่งเป็นตัวที่ 3)
      );
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error || "ไม่สามารถแก้ไขสถานะได้");
      }
    } catch (error) {
      alert("ระบบขัดข้อง");
    } finally {
      setIsProcessingOT(false);
    }
  };

  /* ---------------- LEAVE LOGIC ---------------- */

  const submitLeave = async () => {
    // 1. ตรวจสอบข้อมูลพื้นฐาน (เพิ่มเงื่อนไขเช็คเวลาถ้าเป็นลาเป็นชั่วโมง)
    if (
      !leaveType ||
      !leaveStart ||
      !leaveEnd ||
      !leaveReason ||
      (leaveType === "ลาเป็นชั่วโมง" && (!leaveStartTime || !leaveEndTime))
    ) {
      setLeaveError("⚠️ กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    // 2. ตรวจสอบความถูกต้องของวันที่
    const dateCheck = validateLeaveDates(leaveStart, leaveEnd);
    if (!dateCheck.isValid) {
      setLeaveError(dateCheck.error);
      return;
    }

    // 3. ตรวจสอบเงื่อนไขเวลา (เฉพาะกรณีลาเป็นชั่วโมงและเป็นวันเดียวกัน)
    if (leaveType === "ลาเป็นชั่วโมง" && leaveStart === leaveEnd) {
      if (leaveStartTime >= leaveEndTime) {
        setLeaveError("⚠️ เวลาเริ่มต้นต้องน้อยกว่าเวลาสิ้นสุด");
        return;
      }
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

      // 4. เรียก Action พร้อมส่งค่าเวลาเพิ่มเข้าไป
      const res = await createLeaveRequestAction({
        userId: userProfile.id,
        type: leaveType,
        startDate: leaveStart,
        endDate: leaveEnd,
        startTime: leaveType === "ลาเป็นชั่วโมง" ? leaveStartTime : null, // ✅ ส่งเวลาเริ่มต้น
        endTime: leaveType === "ลาเป็นชั่วโมง" ? leaveEndTime : null, // ✅ ส่งเวลาสิ้นสุด
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
          setLeaveStartTime(""); // ✅ ล้างค่าเวลา
          setLeaveEndTime(""); // ✅ ล้างค่าเวลา
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

  // ✅ คำนวณสถานะปุ่มจากข้อมูลปัจจุบัน (รองรับ Timezone ไทย)d

  const todayStatus = useMemo(() => {
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    // 1. หา Record ที่ "ค้างอยู่" (มีการ Check-in แต่ยังไม่มี Check-out) - ไม่สนว่าจะเป็นวันไหน
    const pendingRecord = records.find(
      (r: any) =>
        !!r.checkIn && r.checkIn !== "-" && (!r.checkOut || r.checkOut === "-")
    );

    // 2. หา Record ของ "วันนี้" (todayStr) ที่มีการบันทึกครบถ้วนแล้ว (เอาไว้เช็คกรณีจบงานในวันเดียว)
    const todayRecord = records.find((r: any) => r.date === todayStr);

    // --- การตัดสินใจ (Priority Logic) ---

    // เคสที่ 1: ถ้ามีงานค้างอยู่ (ไม่ว่าจะค้างมาจากเมื่อวาน หรือเพิ่งเข้างานวันนี้)
    // ปุ่มต้องเป็น "ลงชื่อเลิกงาน" เท่านั้น
    if (pendingRecord) {
      return {
        hasCheckedIn: true,
        hasCheckedOut: false,
        record: pendingRecord,
        status: "PENDING_CHECKOUT",
      };
    }

    // เคสที่ 2: ถ้าไม่มีงานค้างแล้ว และ "วันนี้" มีการ Check-out ไปแล้ว
    // ปุ่มจะขึ้นว่า "บันทึกเวลาครบแล้ว" (เฉพาะกรณีเลิกงานในวันเดียวกัน)
    if (todayRecord && todayRecord.checkOut && todayRecord.checkOut !== "-") {
      return {
        hasCheckedIn: true,
        hasCheckedOut: true,
        record: todayRecord,
        status: "COMPLETED_TODAY",
      };
    }

    // เคสที่ 3: ไม่มีงานค้าง และยังไม่ได้เริ่มงานของวันนี้
    // หรือเพิ่งเลิกงานกะข้ามคืนมาสดๆ ร้อนๆ (ทำให้วันนี้กลายเป็นว่าง)
    // ปุ่มจะขึ้นว่า "ลงชื่อเข้าทำงาน"
    return {
      hasCheckedIn: false,
      hasCheckedOut: false,
      record: null,
      status: "READY_TO_CHECKIN",
    };
  }, [records]);
  /* ---------------- LEADER ACTIONS ---------------- */

  const handleRemarkChange = (id: string, value: string) => {
    setLeaveRemarks((prev) => ({ ...prev, [id]: value }));
  };

  const handleApprove = async (leaveId: string) => {
    if (!confirm("คุณต้องการอนุมัติคำขอลางานนี้ใช่หรือไม่?")) return;
    setIsProcessing(true);
    try {
      // ดึงหมายเหตุที่พิมพ์ไว้ส่งไปด้วย
      const remark = leaveRemarks[leaveId] || "";
      const res = await updateLeaveStatusAction(
        leaveId,
        "approved",
        userProfile.id,
        remark // ส่ง remark เข้าไปด้วย
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
      // ดึงหมายเหตุที่พิมพ์ไว้ส่งไปด้วย
      const remark = leaveRemarks[leaveId] || "";
      const res = await updateLeaveStatusAction(
        leaveId,
        "rejected",
        userProfile.id,
        remark // ส่ง remark เข้าไปด้วย
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

  // ==========================================
  // [ADDED/MODIFIED FOR POPUP FLOW] ฟังก์ชันคุมการเริ่มต้นลงเวลา (ก่อนเปิดกล้อง)
  // ==========================================
  const handleCheckInOrOut = async (type: "IN" | "OUT") => {
    setIsCheckingOut(type === "OUT");

    if (type === "OUT") {
      // 🚩 ดึงเวลาปัจจุบันมาเช็คเงื่อนไขออกงานก่อนกำหนด (ถอดแบบตัวอย่างของนาย)
      const now = new Date();
      const currentMin = now.getHours() * 60 + now.getMinutes();

      // ดึงเวลาเลิกงานจาก profile / shift snapshot (ถ้ามี) ตัวอย่างเช่น "17:00"
      const shiftEndTime = userProfile?.endTime || null;

      if (shiftEndTime) {
        const [endH, endM] = shiftEndTime.split(":").map(Number);
        const endTotalMin = endH * 60 + endM;

        // ถ้าเวลาปัจจุบันยังไม่ถึงเวลาเลิกงาน และห่างกันไม่เกิน 60 นาที ให้เปิดป๊อปอัพเตือนออกก่อนกำหนด
        if (currentMin < endTotalMin && (endTotalMin - currentMin) <= 60) {
          setPendingData({
            userId: userProfile.id,
            type: "OUT",
            image: "",
            fileId: undefined,
            location: "",
            departmentId: userProfile.departmentId || "",
            siteId: userProfile.site_id || null,
            isConfirmed: false,
            siteName: "ไซต์งานปัจจุบัน"
          });
          setShowLogoutConfirmPopup(true);
          return; // เบรกไว้ก่อน รอให้กดยืนยันใน Popup แล้วค่อยเรียก startCamera()
        }
      }
    }

    // หากเป็นขาเข้า (IN) หรือ ขาออกปกติที่ไม่อยู่ในเงื่อนไขเตือน ให้เปิดกล้องตาม Flow เดิมของนายทันที
    startCamera();
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
          maximumAge: 0,
        })
      ).catch((err) => {
        console.warn("Geolocation error:", err.message);
        return null;
      });

      if (!pos) throw new Error("ไม่สามารถระบุตำแหน่งพิกัดได้ กรุณาเปิด GPS");

      const blob = await (await fetch(capturedImage)).blob();
      const file = new File(
        [blob],
        `attendance_${userProfile.id}_${Date.now()}.jpg`,
        {
          type: "image/jpeg",
        }
      );

      // 3. อัปโหลดรูปภาพ
      const uploadRes = await uploadAttendance([file]);
      if (!uploadRes || uploadRes.length === 0)
        throw new Error("อัปโหลดรูปภาพไม่สำเร็จ");

      const uploadedFile = uploadRes[0];
      const locationStr = `${pos.coords.latitude.toFixed(
        6
      )}, ${pos.coords.longitude.toFixed(6)}`;

      // เตรียมข้อมูลสำหรับการส่ง Action (โครงสร้างตาม saveAttendanceAction)
      const attendancePayload = {
        userId: userProfile.id,
        type: (isCheckingOut ? "OUT" : "IN") as "IN" | "OUT",
        image: uploadedFile.ufsUrl || uploadedFile.url,
        fileId: uploadedFile.key,
        location: locationStr,
        departmentId: userProfile.departmentId || "",
        siteId: userProfile.site_id || null,
        isConfirmed: false, // ส่งครั้งแรกเป็น false เสมอ
      };

      // 4. เรียก Action บันทึกข้อมูล
      const result = await saveAttendanceAction(attendancePayload);

      // ป้องกันกรณี Server Crash แล้วส่ง result กลับมาเป็น undefined / null
      if (!result) {
        throw new Error("เซิร์ฟเวอร์ไม่ได้ส่งข้อมูลตอบกลับ กรุณาลองใหม่อีกครั้ง");
      }

      if (result.success) {
        setShowSuccessCard(true);
        router.refresh();
      } else {
        // ✅ ปรับ Logic: ถ้าได้รับสัญญาณยืนยันหรือสถานะ offsite จากเซิร์ฟเวอร์ ให้เปิด Pop-up ทันที
        if (
          result.OffsiteCheckInConfirm ||
          result.OffsiteCheckOutConfirm ||
          result.offsite
        ) {
          setPendingData({
            ...attendancePayload,
            siteName: result.siteName,
          });
          setShowOffsitePopup(true);
        } else {
          // กรณีที่ไม่มีสัญญาณยืนยัน และไม่ผ่าน (เช่น error อื่นๆ) ให้แจ้งเตือน
          alert("ข้อผิดพลาดจากระบบ: " + (result.error || "ไม่สามารถบันทึกเวลาได้เด้อ"));
        }
      }
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      console.error("Capture Error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmOffsite = async (isConfirmed = false) => {
    if (!pendingData) return;
    setIsProcessing(true);
    try {
      // 🚩 ส่งข้อมูลเดิมที่เก็บไว้ใน pendingData แต่เปลี่ยน isConfirmed เป็น true ตามที่ User กดยืนยัน
      const result = await saveAttendanceAction({
        userId: pendingData.userId,
        type: pendingData.type,
        image: pendingData.image,
        fileId: pendingData.fileId,
        location: pendingData.location,
        departmentId: pendingData.departmentId,
        siteId: pendingData.siteId,
        isConfirmed: isConfirmed,
      });

      if (result.success) {
        alert(
          pendingData.type === "OUT"
            ? "บันทึกออกงานนอกพื้นที่สำเร็จ"
            : "บันทึกเข้างานนอกพื้นที่สำเร็จ"
        );
        setShowOffsitePopup(false);
        setPendingData(null);
        router.refresh();
      } else {
        alert("ข้อผิดพลาด: " + result.error);
      }
    } catch (err) {
      console.error("Confirm Error:", err);
      alert("ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง");
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
  console.log(myLeaves);

  // ✅ อย่าลืมใส่ LoadingOverlay และส่วน Return ของ JSX ด้านล่างต่อจากนี้ตามเดิมของคุณนะครับ
  return (
    <div className="min-h-screen bg-[#f8fafc] transition-all duration-300">
      {isProcessing && <LoadingOverlay />}
      {/* 🟢 TOP NAVIGATION */}
      <nav className="sticky top-0 z-40 w-full bg-white/70 backdrop-blur-xl border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 sm:gap-4 group min-w-0">
            <div className="relative flex-shrink-0">
              <Image
                src={companyData?.logoUrl || "/logo.png"}
                alt={companyData?.name || "Company Logo"}
                width={64}
                height={64}
                className="w-10 h-10 sm:w-16 sm:h-16 object-cover rounded-xl shadow-sm"
              />
            </div>
            <div className="flex flex-col border-l-2 border-gray-100 pl-3 sm:pl-4 min-w-0">
              <h1 className="font-black text-gray-900 tracking-tighter text-base sm:text-xl leading-none uppercase truncate">
                {companyData?.name || "ชื่อบริษัท"}
              </h1>
              <span className="hidden sm:block text-[10px] text-gray-400 font-bold tracking-[0.2em] uppercase mt-1 max-w-[440px] line-clamp-2 leading-relaxed whitespace-normal break-words">
                {companyData?.description || "description"}
              </span>
              <span className="block text-[9px] md:text-[10px] font-bold text-blue-600 tracking-[0.2em] md:tracking-[0.25em] uppercase opacity-90 mt-1 truncate">
                Leader Panel
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-6 flex-shrink-0">
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
              className="group flex items-center gap-1.5 px-2.5 py-2 sm:px-5 sm:py-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100 hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95 w-fit"
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

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-10">
        {/* 👤 LEADER PROFILE CARD */}
        <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.03)] mb-10 flex flex-col md:flex-row items-center md:items-start gap-8 relative border border-white">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 rounded-full blur-2xl opacity-10"></div>
            <Image
              src={
                userProfile?.avatarUrl ||
                userProfile?.profileImage ||
                `https://ui-avatars.com/api/?name=${userProfile?.firstName || "User"
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
            <div className="space-y-2 mb-6">
              {" "}
              {/* ใช้ space-y เพื่อความเป็นระเบียบ */}
              <p className="text-gray-500 font-bold text-base sm:text-lg tracking-tight">
                ระดับ : {userProfile.role || "หัวหน้า"}
              </p>
              <p className="text-gray-500 font-bold text-base sm:text-lg tracking-tight">
                ตำแหน่ง : {userProfile.position || "ไม่ได้ระบุตำแหน่ง"}
              </p>
              <p className="text-gray-500 font-bold text-base sm:text-lg tracking-tight">
                ไซต์งาน : {userProfile.site || "ทุกไซต์งาน"}
              </p>
              <p className="text-gray-500 font-bold text-base sm:text-lg tracking-tight">
                รอบเข้างาน : {userProfile.workShift || "ไม่ได้ระบุ"}
              </p>
            </div>

            {/* Badges ด้านล่าง */}
            <div className="flex flex-col justify-center md:justify-start items-center md:items-start gap-3 mt-4">
              <div className="w-fit">
                {" "}
                {/* ใช้ w-fit เพื่อให้พื้นหลังกว้างพอดีตัวอักษร */}
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

          {/* {CHECK IN/OUT BUTTON} */}
          <div className="flex flex-col gap-4 mt-8 w-full md:w-64">
            {/* 1. เช็คว่ายังไม่ได้เข้างาน หรือ (เป็นกลุ่ม "ทุกไซต์" และเพิ่งเช็คเอาท์ไป) ให้โชว์ปุ่ม CHECK-IN */}
            {!todayStatus.hasCheckedIn ||
              (userProfile.site === "ทุกไซต์" && todayStatus.hasCheckedOut) ? (
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
            ) : todayStatus.hasCheckedIn && !todayStatus.hasCheckedOut ? (
              /* 2. ถ้าเข้างานแล้วแต่ยังไม่ออก ให้โชว์ปุ่ม CHECK-OUT */
              <button
                onClick={() => {
                  if (showOffsitePopup) return;
                  setIsCheckingOut(true);
                  openCamera();
                }}
                disabled={isProcessing}
                className="w-full bg-gray-900 hover:bg-black text-white font-black py-4 rounded-2xl uppercase tracking-tighter shadow-lg shadow-gray-200 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                ลงชื่อออกงาน (CHECK-OUT)
              </button>
            ) : (
              /* 3. กรณีมีไซต์ประจำและบันทึกครบแล้ว หรือสถานะอื่นๆ ที่นอกเหนือจากข้างบน */
              <div className="w-full bg-gray-50 border border-gray-100 text-gray-400 font-black py-4 rounded-2xl uppercase text-center text-xs tracking-widest">
                บันทึกเวลาครบแล้ว
              </div>
            )}

            {/* --- ส่วนที่ต้องวางแยกไว้ เพื่อรองรับ Logic ยืนยันนอกพื้นที่ --- */}
            {showOffsitePopup && (
              <OffsiteCheckOutConfirm
                siteName={pendingData?.siteName || "ไซต์งาน"}
                onCancel={() => {
                  setShowOffsitePopup(false);
                  setIsCheckingOut(false);
                }}
                onConfirm={async () => {
                  await handleFinalCheckOut(true);
                }}
              />
            )}

            {/* 4. ปุ่มลางาน */}
            <button
              onClick={() => setShowLeaveForm(true)}
              disabled={isProcessing}
              className="w-full bg-white border-2 border-gray-100 hover:border-indigo-600 hover:text-indigo-600 text-gray-500 font-black py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 uppercase text-sm"
            >
              ขอลางาน (ส่วนตัว)
            </button>
            {/* 4. ปุ่มขอ OT */}
            <button
              onClick={() => setShowOTModal(true)}
              disabled={isProcessing}
              className="w-full bg-white border-2 border-gray-100 hover:border-indigo-600 hover:text-indigo-600 text-gray-500 font-black py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 uppercase text-sm"
            >
              ขอทำ OT (ส่วนตัว)
            </button>

            {/* 5. ปุ่มเปลี่ยนรหัสผ่าน */}
            <button
              onClick={() => setShowPasswordModal(true)}
              disabled={isProcessing}
              className="w-full relative group active:scale-[0.97] transition-all duration-300 disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-blue-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[1.5rem]"></div>
              <div className="relative flex items-center justify-center gap-3 px-8 py-5 rounded-[1.5rem] bg-white border-2 border-gray-50 group-hover:border-blue-500 group-hover:bg-blue-50/30 transition-all duration-300 shadow-sm group-hover:shadow-md">
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
                    การเข้างาน ของฉัน
                  </h2>
                </div>

                {/* ปรับเพิ่ม max-h และ overflow-y-auto เพื่อให้ scroll ลงเมื่อเกิน 5 รายการ */}
                <div className="overflow-x-auto overflow-y-auto max-h-[460px] rounded-[1.5rem] -mx-6 px-6 sm:mx-0 sm:px-0 scrollbar-thin">
                  {/* ปรับ min-w เป็น 1100px เพื่อให้มีพื้นที่กว้างขึ้น ไม่ทับซ้อน */}
                  <table className="w-full text-sm min-w-[1100px] border-collapse">
                    <thead className="bg-gray-50/50 text-gray-600 uppercase text-[11px] font-black tracking-widest sticky top-0 z-10 backdrop-blur-md">
                      <tr>
                        <th className="p-4 text-left">วันที่</th>
                        <th className="p-4 text-left">รอบเข้างาน</th>
                        <th className="p-4 text-left">สถานะเวลา เข้า-ออก</th>
                        <th className="p-4 text-left">เวลาเข้า / รูปถ่าย</th>
                        <th className="p-4 text-left">เวลาออก / รูปถ่าย</th>
                        <th className="p-4 text-center">พื้นที่ปฏิบัติงาน</th>
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
                                {r.date
                                  ? new Date(r.date).toLocaleDateString(
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
                                  {r.startTime && r.endTime ? (
                                    <span className="text-[15px] text-gray-800">
                                      {r.startTime.slice(0, 5)} -{" "}
                                      {r.endTime.slice(0, 5)}
                                    </span>
                                  ) : (
                                    <span className="text-[14px] font-normal text-gray-400">
                                      ไม่มีกะงาน
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* สถานะ */}
                              <td className="p-4 font-bold whitespace-nowrap space-y-1">
                                {/* --- ส่วนของ "สาย" (เช็คได้ทันทีหลัง Check-in) --- */}
                                {r.isLate === 1 ? (
                                  <span className="text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 shadow-sm text-sm block w-fit">
                                    ⚠️ สาย
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm text-sm block w-fit">
                                    ✅ เข้างานปกติ
                                  </span>
                                )}

                                {/* --- ส่วนของ "ออกก่อนเวลา" (ต้องเช็คก่อนว่าออกหรือยัง) --- */}
                                {!r.checkOut ? (
                                  // กรณีที่ 1: ยังไม่ได้ลงชื่อออก
                                  <span className="text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm text-sm block w-fit italic">
                                    ⏳ รอลงชื่อออก...
                                  </span>
                                ) : r.isEarlyExit === 1 ||
                                  r.isEarlyExit === "1" ? (
                                  // กรณีที่ 2: ลงชื่อออกแล้ว และออกก่อนเวลา
                                  <span className="text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 shadow-sm text-sm block w-fit">
                                    🏃 ออกก่อนเวลา
                                  </span>
                                ) : (
                                  // กรณีที่ 3: ลงชื่อออกแล้ว และเวลาครบถ้วน
                                  <span className="text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm text-sm block w-fit">
                                    ✅ ออกงานปกติ
                                  </span>
                                )}
                              </td>
                              {/* เช็คอิน */}
                              <td className="p-4 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  <span className="text-blue-600 font-black bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
                                    {r.checkIn || "--:--"}
                                  </span>
                                  {displayImageIn && (
                                    <Image
                                      src={displayImageIn}
                                      alt="In"
                                      width={40}
                                      height={40}
                                      onClick={() =>
                                        setViewImage(displayImageIn)
                                      }
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
                                    {r.checkOut || "-"}
                                  </span>
                                  {displayImageOut && (
                                    <Image
                                      src={displayImageOut}
                                      alt="Out"
                                      width={40}
                                      height={40}
                                      onClick={() =>
                                        setViewImage(displayImageOut)
                                      }
                                      className="rounded-xl border-2 border-white shadow-sm object-cover h-10 w-10 cursor-zoom-in hover:border-blue-400 active:scale-95 transition-all"
                                      unoptimized
                                    />
                                  )}
                                </div>
                              </td>

                              {/* รายละเอียด - ปรับให้ใช้พื้นที่เต็มที่ */}
                              <td className="p-4">
                                <div className="flex items-center justify-center gap-3 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-lg border border-gray-200">
                                    <span className="text-base">📍</span>
                                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                                      {r.site || "ทุกไซต์งาน"}
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
              <div className="bg-white p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] shadow-sm border border-gray-50">
                <div className="flex items-center gap-3 mb-6 sm:mb-8">
                  <div className="w-1.5 h-6 sm:w-2 sm:h-8 bg-amber-400 rounded-full"></div>
                  <h2 className="font-black text-gray-900 text-lg sm:text-xl tracking-tighter uppercase">
                    คำขอลางานของฉัน
                  </h2>
                </div>
                <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                  <table className="w-full text-sm min-w-[500px] sm:min-w-[600px]">
                    <thead className="bg-gray-50/50 text-gray-600 uppercase text-[10px] sm:text-[12px] font-black tracking-widest">
                      <tr>
                        <th className="p-4 sm:p-6 text-center">ขอเมื่อ</th>
                        <th className="p-4 sm:p-6 text-left">
                          วันที่ / ประเภท
                        </th>
                        <th className="p-4 sm:p-6 text-center">
                          จำนวนวัน/ชั่วโมง
                        </th>
                        <th className="p-4 sm:p-6 text-left hidden md:table-cell">
                          เอกสาร & เหตุผล
                        </th>
                        <th className="p-4 sm:p-6 text-center">สถานะ</th>
                        <th className="p-4 sm:p-6 text-center hidden lg:table-cell">
                          หมายเหตุ
                        </th>
                        <th className="p-4 sm:p-6 text-center">
                          ผู้จัดการคำขอ
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {myLeaves.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="p-12 sm:p-16 text-center text-gray-300 font-bold italic"
                          >
                            ไม่มีประวัติการลา
                          </td>
                        </tr>
                      ) : (
                        [...myLeaves].map((l: any) => {
                          // ✅ โลจิกคำนวณ: ถ้ามี totalHours และน้อยกว่า 24 ชม. ให้แสดงเป็นชั่วโมง
                          const totalHours = Number(l.totalHours || 0);
                          const isHourly = totalHours > 0 && totalHours < 24;

                          // คำนวณวันกรณีไม่มี totalHours ส่งมา (Fallback)
                          const startDateVal =
                            l.startDate || l.start_date || l.start;
                          const endDateVal = l.endDate || l.end_date || l.end;

                          const start = new Date(startDateVal);
                          const end = new Date(endDateVal);

                          let diffDays = 0;
                          if (startDateVal && endDateVal) {
                            const diffTime = Math.abs(
                              end.getTime() - start.getTime()
                            );
                            diffDays =
                              Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                          }

                          // ฟอร์แมตวันที่สำหรับการแสดงผล ว/ด/ป
                          const formatDate = (dateStr: string) => {
                            if (!dateStr) return "-";
                            const d = new Date(dateStr);
                            if (isNaN(d.getTime())) return "-";
                            const day = String(d.getDate()).padStart(2, "0");
                            const month = String(d.getMonth() + 1).padStart(
                              2,
                              "0"
                            );
                            const year = d.getFullYear();
                            return `${day}/${month}/${year}`;
                          };

                          return (
                            <tr
                              key={l.id}
                              className="hover:bg-amber-50/10 transition-colors"
                            >
                              <td className="p-4 sm:p-6 text-center">
                                <div className="flex flex-col items-center justify-center">
                                  <span className="text-[11px] font-black text-gray-900">
                                    {l.createdAt}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4 sm:p-6">
                                <div className="flex flex-col gap-1">
                                  <div className="text-[11px] sm:text-[13px] text-gray-900 font-black">
                                    {formatDate(startDateVal)}
                                    <span className="text-gray-300 mx-1">
                                      →
                                    </span>
                                    {formatDate(endDateVal)}
                                  </div>
                                  <div className="inline-block bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-black text-[10px] w-fit uppercase">
                                    {l.type}
                                  </div>
                                  {isHourly && l.startTime && l.endTime && (
                                    <div className="text-[11px] text-amber-600 font-black flex items-center gap-1">
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="10"
                                        height="10"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                      </svg>
                                      {l.startTime.slice(0, 5)} -{" "}
                                      {l.endTime.slice(0, 5)}
                                    </div>
                                  )}
                                  <span className="text-[10px] text-gray-400 italic line-clamp-1 md:hidden">
                                    {l.reason}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4 sm:p-6 text-center">
                                {(() => {
                                  // 1. เตรียมเงื่อนไข
                                  const hours = Number(totalHours);
                                  const isHalfDay =
                                    isHourly && (hours === 4 || hours === 4.5);

                                  // 2. กำหนดสี (Badge Color)
                                  const badgeClass = isHalfDay
                                    ? "bg-purple-600 text-white shadow-purple-200" // สีสำหรับครึ่งวัน (แยกให้ชัดเจน)
                                    : isHourly
                                      ? "bg-blue-500 text-white shadow-blue-200"
                                      : "bg-orange-500 text-white shadow-orange-200";

                                  // 3. กำหนดข้อความที่จะแสดง
                                  const displayText = isHalfDay
                                    ? "ครึ่งวัน"
                                    : isHourly
                                      ? `${totalHours} ชั่วโมง`
                                      : `${isNaN(diffDays) || diffDays <= 0 ? "-" : diffDays} วัน`;

                                  return (
                                    <span
                                      className={`px-2.5 py-1 rounded-full font-black text-[10px] sm:text-xs shadow-sm whitespace-nowrap ${badgeClass}`}
                                    >
                                      {displayText}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="p-4 sm:p-6 hidden md:table-cell">
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
                                      ดูหลักฐาน
                                    </a>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 sm:p-6 text-center">
                                <span
                                  className={`px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-tighter shadow-sm border whitespace-nowrap
                  ${l.status === "approved" || l.status === "อนุมัติแล้ว"
                                      ? "bg-green-50 text-green-600 border-green-100"
                                      : l.status === "rejected" || l.status === "ปฏิเสธ"
                                        ? "bg-red-50 text-red-600 border-red-100"
                                        : "bg-amber-50 text-amber-600 border-amber-100"
                                    }`}
                                >
                                  {l.status === "pending" ||
                                    l.status === "รออนุมัติ"
                                    ? "รออนุมัติ"
                                    : l.status === "approved" ||
                                      l.status === "อนุมัติแล้ว"
                                      ? "อนุมัติแล้ว"
                                      : l.status === "rejected" ||
                                        l.status === "ปฏิเสธ"
                                        ? "ปฏิเสธ"
                                        : l.status}
                                </span>
                              </td>
                              <td className="p-4 sm:p-6 hidden lg:table-cell">
                                <div className="flex items-center gap-2 justify-center">
                                  {l.status !== "pending" && l.remark ? (
                                    <>
                                      <div className="relative group">
                                        <input
                                          type="text"
                                          readOnly
                                          value={l.remark}
                                          className="text-[11px] bg-gray-50 border border-gray-100 text-gray-500 rounded-lg px-3 py-1.5 w-24 xl:w-32 focus:outline-none cursor-default font-medium"
                                          title={l.remark}
                                        />
                                        <div className="absolute inset-0 bg-white/10 rounded-lg pointer-events-none"></div>
                                      </div>
                                      <div className="relative">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setViewRemarkId(
                                              viewRemarkId === l.id
                                                ? null
                                                : l.id
                                            )
                                          }
                                          className={`flex-shrink-0 p-1.5 rounded-lg transition-all border ${viewRemarkId === l.id
                                            ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200"
                                            : "bg-white text-indigo-500 border-gray-200 hover:border-indigo-200 hover:bg-indigo-50"
                                            }`}
                                        >
                                          <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          >
                                            <circle
                                              cx="11"
                                              cy="11"
                                              r="8"
                                            ></circle>
                                            <line
                                              x1="21"
                                              y1="21"
                                              x2="16.65"
                                              y2="16.65"
                                            ></line>
                                          </svg>
                                        </button>
                                        {viewRemarkId === l.id && (
                                          <>
                                            <div
                                              className="fixed inset-0 z-40"
                                              onClick={() =>
                                                setViewRemarkId(null)
                                              }
                                            ></div>
                                            <div className="absolute right-0 bottom-full mb-2 z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-xl p-3 animate-in fade-in zoom-in duration-200">
                                              <div className="flex justify-between items-center mb-2 pb-1 border-b border-gray-100">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                  หมายเหตุ
                                                </span>
                                                <button
                                                  onClick={() =>
                                                    setViewRemarkId(null)
                                                  }
                                                  className="text-gray-400 hover:text-gray-600"
                                                >
                                                  <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="12"
                                                    height="12"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="3"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                  >
                                                    <line
                                                      x1="18"
                                                      y1="6"
                                                      x2="6"
                                                      y2="18"
                                                    ></line>
                                                    <line
                                                      x1="6"
                                                      y1="6"
                                                      x2="18"
                                                      y2="18"
                                                    ></line>
                                                  </svg>
                                                </button>
                                              </div>
                                              <p className="text-xs text-gray-700 leading-relaxed break-words font-medium text-left">
                                                {l.remark}
                                              </p>
                                              <div className="absolute -bottom-1 right-3 w-2 h-2 bg-white border-r border-b border-gray-200 rotate-45"></div>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </>
                                  ) : (
                                    <span className="text-gray-200">—</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 sm:p-6 text-center">
                                {l.status !== "pending" &&
                                  l.status !== "รออนุมัติ" &&
                                  (l.approverFirst || l.approverName) ? (
                                  <div className="inline-flex flex-col items-center">
                                    <span className="text-[11px] sm:text-[13px] font-bold text-gray-900 tracking-tight whitespace-nowrap">
                                      {l.approverName ||
                                        `${l.approverFirst} ${l.approverLast || ""}`.trim()}
                                    </span>
                                    <span className="text-[8px] sm:text-[9px] text-indigo-500 font-black uppercase tracking-widest mt-0.5">
                                      {l.approverPosition || "-"}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-gray-300 font-medium">
                                    —
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ตารางที่ 3: คำขออนุมัติ OT ของฉัน */}
              <div className="bg-white p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] shadow-sm border border-gray-50">
                <div className="flex items-center gap-3 mb-6 sm:mb-8">
                  <div className="w-1.5 h-6 sm:w-2 sm:h-8 bg-amber-400 rounded-full"></div>
                  <h2 className="font-black text-gray-900 text-lg sm:text-xl tracking-tighter uppercase">
                    ประวัติคำขอ OT ของฉัน
                  </h2>
                </div>
                <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                  <table className="w-full text-sm min-w-[500px] sm:min-w-[600px]">
                    <thead className="bg-gray-50/50 text-gray-600 uppercase text-[10px] sm:text-[12px] font-black tracking-widest">
                      <tr>
                        <th className="p-4 sm:p-6 text-center">ขอเมื่อ</th>
                        <th className="p-4 sm:p-6 text-left">
                          วันที่ / ช่วงเวลา OT
                        </th>
                        <th className="p-4 sm:p-6 text-center">จำนวนชั่วโมง</th>
                        <th className="p-4 sm:p-6 text-left hidden md:table-cell">
                          เหตุผล / หมายเหตุ
                        </th>
                        <th className="p-4 sm:p-6 text-center">สถานะ</th>
                        <th className="p-4 sm:p-6 text-center">
                          ผู้จัดการคำขอ
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {myOT.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="p-12 sm:p-16 text-center text-gray-300 font-bold italic"
                          >
                            ไม่มีประวัติคำขอ OT
                          </td>
                        </tr>
                      ) : (
                        myOT.map((ot: any) => {
                          return (
                            <tr
                              key={ot.id}
                              className="hover:bg-amber-50/10 transition-colors"
                            >
                              {/* 1. วันที่สร้างคำขอ (createdAt) */}
                              <td className="px-4 py-2 text-sm text-gray-600 text-center">
                                {ot.createdAt
                                  ? ot.createdAt.split(" ")[0]
                                  : "-"}
                              </td>

                              {/* 2. วันที่ทำ OT และ ช่วงเวลา */}
                              <td className="p-4 sm:p-6">
                                <div className="flex flex-col gap-1">
                                  <div className="inline-block bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-black text-[13px] w-fit uppercase">
                                    {ot.date
                                      ? new Date(ot.date).toLocaleDateString(
                                        "th-TH",
                                        {
                                          day: "2-digit",
                                          month: "2-digit",
                                          year: "numeric",
                                        }
                                      )
                                      : "-"}
                                  </div>
                                  <div className="text-[10px] sm:text-[11px] text-gray-500 font-bold">
                                    {ot.timeStart?.slice(0, 5)} น.
                                    <span className="text-gray-300 mx-1">
                                      →
                                    </span>
                                    {ot.timeEnd?.slice(0, 5)} น.
                                  </div>
                                </div>
                              </td>

                              {/* 3. จำนวนชั่วโมง (overtimeByRequest) */}
                              <td className="p-4 sm:p-6 text-center">
                                <span className="bg-orange-500 text-white px-2.5 py-1 rounded-full font-black text-[10px] sm:text-xs shadow-sm shadow-orange-200 whitespace-nowrap">
                                  {ot.overtimeByRequest} นาที
                                </span>
                              </td>

                              {/* 4. เหตุผล และ หมายเหตุระบบ */}
                              <td className="p-4 sm:p-6 hidden md:table-cell">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs text-gray-700 font-bold line-clamp-1">
                                    {ot.reason || "ไม่ระบุเหตุผล"}
                                  </span>
                                  {ot.remarks && (
                                    <span className="text-[10px] text-gray-400 italic line-clamp-1">
                                      หมายเหตุ: {ot.remarks}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 5. สถานะ (status) */}
                              <td className="p-4 sm:p-6 text-center">
                                <span
                                  className={`px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-tighter shadow-sm border whitespace-nowrap
                                  ${ot.status === "approved"
                                      ? "bg-green-50 text-green-600 border-green-100"
                                      : ot.status === "rejected"
                                        ? "bg-red-50 text-red-600 border-red-100"
                                        : "bg-amber-50 text-amber-600 border-amber-100"
                                    }`}
                                >
                                  {ot.status === "pending"
                                    ? "รออนุมัติ"
                                    : ot.status === "approved"
                                      ? "อนุมัติแล้ว"
                                      : "ปฏิเสธ"}
                                </span>
                              </td>

                              {/* 6. ผู้จัดการคำขอ */}
                              <td className="p-4 sm:p-6 text-center">
                                {ot.status !== "pending" &&
                                  ot.approverName &&
                                  ot.approverName !== "-" ? (
                                  <div className="inline-flex flex-col items-center">
                                    <span className="text-[11px] sm:text-[13px] font-bold text-gray-900 tracking-tight whitespace-nowrap">
                                      {ot.approverName}
                                    </span>
                                    <span className="text-[8px] sm:text-[9px] text-indigo-500 font-black uppercase tracking-widest mt-0.5">
                                      {ot.status === "approved"
                                        ? "ผู้อนุมัติ"
                                        : "ผู้ปฏิเสธ"}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-gray-300 font-medium">
                                    —
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
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
                      {/* เพิ่ม min-width เป็น 1600px เพื่อขยายพื้นที่แนวนอน */}
                      <table className="min-w-[1600px] w-full text-sm border-separate border-spacing-0">
                        <thead className="sticky top-0 z-20">
                          <tr className="bg-slate-50/80 backdrop-blur-md text-slate-600 font-black uppercase text-[11px] tracking-[0.15em]">
                            <th className="py-6 px-6 text-left border-b border-slate-100">
                              พนักงาน
                            </th>
                            <th className="py-6 px-6 text-left border-b border-slate-100">
                              วันที่
                            </th>
                            <th className="py-6 px-6 text-left border-b border-slate-100">
                              รอบเข้างาน
                            </th>
                            <th className="py-6 px-6 text-center border-b border-slate-100">
                              เวลาเข้า
                            </th>
                            <th className="py-6 px-6 text-center border-b border-slate-100">
                              เวลาออก
                            </th>
                            <th className="py-6 px-6 text-left border-b border-slate-100">
                              สถานะเวลา เข้า-ออก
                            </th>
                            <th className="py-6 px-6 text-left border-b border-slate-100">
                              สถานะการลงชื่อพิกัด เข้า-ออก
                            </th>
                            <th className="py-6 px-6 text-left border-b border-slate-100">
                              ตำแหน่ง
                            </th>
                            <th className="py-6 px-6 text-left border-b border-slate-100">
                              ไซต์งาน
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
                                {/* ใช้ whitespace-nowrap เพื่อไม่ให้ชื่อพนักงานเบียดกัน */}
                                <td className="py-5 px-6 whitespace-nowrap">
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
                                <td className="py-5 px-6 font-bold text-slate-600 whitespace-nowrap">
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
                                <td className="p-4 font-bold text-gray-600 whitespace-nowrap">
                                  <div className="flex flex-col gap-1">
                                    {a.startTime && a.endTime ? (
                                      <span className="text-[15px] text-gray-800">
                                        {a.startTime.slice(0, 5)} -{" "}
                                        {a.endTime.slice(0, 5)}
                                      </span>
                                    ) : (
                                      <span className="text-[14px] font-normal text-gray-400">
                                        ไม่มีกะงาน
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-5 px-6 text-center font-black text-green-600 text-lg italic whitespace-nowrap">
                                  {a.checkIn ? a.checkIn : "--:--"}
                                </td>
                                <td className="py-5 px-6 text-center font-black text-red-600 text-lg italic whitespace-nowrap">
                                  {a.checkOut ? a.checkOut : "--:--"}
                                </td>
                                <td className="p-4 font-bold whitespace-nowrap flex flex-col gap-1">
                                  {/* --- ตรวจสอบการ "สาย" (รู้ผลทันทีที่ Check-in) --- */}
                                  {a.isLate === 1 ? (
                                    <span className="text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 shadow-sm text-sm w-fit">
                                      ⚠️ สาย
                                    </span>
                                  ) : (
                                    <span className="text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm text-sm w-fit">
                                      ✅ เข้างานปกติ
                                    </span>
                                  )}

                                  {/* --- ตรวจสอบการ "ออกก่อนเวลา" (ต้องรอ Check-out ก่อนถึงจะตัดสิน) --- */}
                                  {!a.checkOut ? (
                                    // กรณีที่ 1: ยังไม่กดออก
                                    <span className="text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm text-sm w-fit italic">
                                      ⏳ กำลังปฏิบัติงาน...
                                    </span>
                                  ) : a.isEarlyExit === 1 ||
                                    a.isEarlyExit === "1" ? (
                                    // กรณีที่ 2: กดออกแล้ว และออกก่อนเวลาจริง
                                    <span className="text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 shadow-sm text-sm w-fit">
                                      🏃 ออกก่อนเวลา
                                    </span>
                                  ) : (
                                    // กรณีที่ 3: กดออกแล้ว และอยู่จนครบเวลา
                                    <span className="text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm text-sm w-fit">
                                      ✅ ออกงานปกติ
                                    </span>
                                  )}
                                </td>
                                <td className="p-4 font-bold whitespace-nowrap">
                                  {String(a.isOffsiteIn) === "1" ? (
                                    <span className="text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 shadow-sm text-sm">
                                      ⚠️ เข้าไม่ตรง
                                    </span>
                                  ) : (
                                    <span className="text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm text-sm">
                                      ✅ ปกติ
                                    </span>
                                  )}
                                  {String(a.isOffsiteOut) === "1" ? (
                                    <span className="text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 shadow-sm text-sm">
                                      🏃 ออกไม่ตรง
                                    </span>
                                  ) : (
                                    <span className="text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm text-sm">
                                      ✅ ปกติ
                                    </span>
                                  )}
                                </td>
                                {/* ใช้ whitespace-nowrap เพื่อให้ตำแหน่งเรียงเป็นแถวเดียว */}
                                <td className="py-5 px-6 whitespace-nowrap">
                                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase">
                                    {a.positionName || "พนักงาน"}
                                  </span>
                                </td>
                                {/* ใช้ whitespace-nowrap เพื่อให้ไซต์งานเรียงเป็นแถวเดียว */}
                                <td className="py-5 px-6 whitespace-nowrap">
                                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase">
                                    {a.siteName || "พนักงาน"}
                                  </span>
                                </td>
                                <td className="py-5 px-6">
                                  <div className="flex justify-center gap-3">
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
                                            className={`absolute -bottom-2 -right-1 text-white text-[8px] px-1 rounded font-bold uppercase ${img.label === "In"
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
                                colSpan={10}
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

              {/* {ตารางขอลางานพนักงาน} */}
              <div className="print:hidden mt-12">
                <Section title="คำขอลางาน ของพนักงาน">
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
                    <div className="overflow-x-auto max-h-137.5 overflow-y-auto custom-scrollbar">
                      <table className="min-w-325 w-full text-sm border-separate border-spacing-0 table-fixed">
                        <thead className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-sm">
                          <tr className="text-slate-600 font-black uppercase text-[12px] tracking-[0.2em]">
                            <th className="py-6 px-6 text-left border-b border-slate-100 w-[250px]">
                              พนักงาน
                            </th>
                            <th className="py-6 px-4 text-center border-b border-slate-100 w-[180px]">
                              ขอเมื่อ
                            </th>
                            <th className="py-6 px-4 text-center border-b border-slate-100 w-[200px]">
                              วันที่ / ประเภท
                            </th>
                            <th className="py-6 px-4 text-center border-b border-slate-100 w-[120px]">
                              จำนวนวัน/ชั่วโมง
                            </th>
                            <th className="py-6 px-4 text-left border-b border-slate-100 w-[220px]">
                              เอกสาร & เหตุผล
                            </th>
                            <th className="py-6 px-4 text-center border-b border-slate-100 w-[130px]">
                              สถานะ
                            </th>
                            <th className="py-6 px-6 text-center border-b border-slate-100 w-[180px]">
                              จัดการ
                            </th>
                            <th className="py-6 px-6 text-center border-b border-slate-100 w-[200px]">
                              หมายเหตุ
                            </th>
                            <th className="py-6 px-6 text-center border-b border-slate-100 w-[180px]">
                              ผู้จัดการคำขอ
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredLeaves.length > 0 ? (
                            filteredLeaves.map((l) => {
                              const diffDays =
                                Math.ceil(
                                  Math.abs(
                                    new Date(l.endDate).getTime() -
                                    new Date(l.startDate).getTime()
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
                                      <div className="truncate">
                                        <div className="font-black text-slate-800 text-base leading-none mb-1 truncate">
                                          {l.employeeName || "ไม่ระบุชื่อ"}
                                        </div>
                                        <div className="text-indigo-500 font-mono text-[10px] font-bold italic truncate">
                                          @{l.positionName || "ไม่ได้ระบุ"}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-600 text-center">
                                    {l.createdAt || "-"}
                                  </td>

                                  {/* แก้ไขคอลัมน์ วันที่ / ประเภท ให้เหมือนต้นแบบ */}
                                  <td className="py-5 px-4">
                                    <div className="flex flex-col items-center justify-center gap-1.5">
                                      <div className="bg-indigo-600 text-white px-3 py-1 rounded-lg font-black text-[10px] tracking-wider shadow-sm shadow-indigo-100 uppercase">
                                        {l.type}
                                      </div>
                                      <div className="flex items-center gap-2 text-slate-500 font-bold text-[11px] bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                                        <span className="text-slate-700">
                                          {new Date(
                                            l.startDate
                                          ).toLocaleDateString("th-TH", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "2-digit",
                                          })}
                                        </span>
                                        <span className="text-indigo-300">
                                          →
                                        </span>
                                        <span className="text-slate-700">
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

                                  {/* แก้ไขคอลัมน์ จำนวนวัน/ชั่วโมง ให้เหมือนต้นแบบ */}
                                  <td className="py-5 px-4 text-center">
                                    <div className="inline-flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl px-4 py-2 border border-dashed border-slate-200">
                                      {(() => {
                                        const totalHrs =
                                          Number(l.totalHours) || 0;

                                        // 1. เช็คเงื่อนไข "ครึ่งวัน"
                                        const isHalfDay =
                                          totalHrs === 4 || totalHrs === 4.5;

                                        // 2. เช็คหน่วยวัน
                                        const isDayUnit = totalHrs >= 24;

                                        // กรณีครึ่งวัน: แสดงคำเดียว ไม่มีหน่วยด้านล่าง
                                        if (isHalfDay) {
                                          return (
                                            <span className="text-purple-600 font-black text-md leading-none tracking-tighter">
                                              ครึ่งวัน
                                            </span>
                                          );
                                        }

                                        // 3. กรณีปกติ (ชั่วโมง หรือ วัน): แสดงค่าตัวเลขพร้อมหน่วย
                                        const displayValue = isDayUnit
                                          ? (totalHrs / 24).toLocaleString(
                                            undefined,
                                            { maximumFractionDigits: 1 }
                                          )
                                          : totalHrs;

                                        return (
                                          <>
                                            <span className="text-indigo-600 font-black text-xl leading-none tracking-tighter">
                                              {displayValue}
                                            </span>
                                            <span className="text-slate-400 font-black text-[9px] uppercase tracking-widest mt-1 italic">
                                              {isDayUnit ? "วัน" : "ชั่วโมง"}
                                            </span>
                                          </>
                                        );
                                      })()}
                                    </div>
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
                                      className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase shadow-sm whitespace-nowrap ${l.status === "pending"
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
                                            disabled={isProcessing}
                                            onClick={() => handleApprove(l.id)}
                                            className="bg-emerald-600 text-white px-5 py-2 rounded-xl text-xs font-black hover:bg-emerald-700 hover:-translate-y-0.5 transition-all shadow-lg shadow-emerald-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                          >
                                            {isProcessing ? "..." : "อนุมัติ"}
                                          </button>
                                          <button
                                            disabled={isProcessing}
                                            onClick={() => handleReject(l.id)}
                                            className="bg-white border border-rose-200 text-rose-500 px-5 py-2 rounded-xl text-xs font-black hover:bg-rose-50 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            {isProcessing ? "..." : "ปฏิเสธ"}
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          disabled={isProcessing}
                                          onClick={() =>
                                            updateLeaveStatusAction(
                                              l.id,
                                              "pending"
                                            )
                                          }
                                          className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-black hover:bg-slate-200 transition-all flex items-center gap-2 italic disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          <span>
                                            {isProcessing ? "⏳" : "✏️"}
                                          </span>{" "}
                                          แก้ไข
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-4 px-4">
                                    <div className="relative flex items-center gap-2">
                                      <input
                                        type="text"
                                        placeholder="ระบุหมายเหตุ..."
                                        className={`border rounded-xl px-3 py-1.5 text-xs w-full transition-all outline-none ${l.status !== "pending"
                                          ? "bg-gray-50 text-gray-700 border-gray-200 shadow-sm"
                                          : "bg-white border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
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
                                        <div className="relative shrink-0">
                                          <button
                                            onClick={() =>
                                              setViewRemarkId(
                                                viewRemarkId === l.id
                                                  ? null
                                                  : l.id
                                              )
                                            }
                                            className={`shrink-0 p-1.5 rounded-lg transition-colors border ${viewRemarkId === l.id
                                              ? "bg-blue-600 text-white border-blue-600"
                                              : "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100"
                                              }`}
                                          >
                                            <svg
                                              xmlns="http://www.w3.org/2000/svg"
                                              width="14"
                                              height="14"
                                              viewBox="0 0 24 24"
                                              fill="none"
                                              stroke="currentColor"
                                              strokeWidth="2.5"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                            >
                                              <circle
                                                cx="11"
                                                cy="11"
                                                r="8"
                                              ></circle>
                                              <line
                                                x1="21"
                                                y1="21"
                                                x2="16.65"
                                                y2="16.65"
                                              ></line>
                                            </svg>
                                          </button>
                                          {viewRemarkId === l.id && (
                                            <>
                                              <div
                                                className="fixed inset-0 z-40"
                                                onClick={() =>
                                                  setViewRemarkId(null)
                                                }
                                              ></div>
                                              <div className="absolute right-0 bottom-full mb-2 z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-xl p-3 animate-in fade-in zoom-in duration-200">
                                                <div className="flex justify-between items-center mb-2 pb-1 border-b border-gray-100">
                                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                    หมายเหตุจากผู้อนุมัติ
                                                  </span>
                                                  <button
                                                    onClick={() =>
                                                      setViewRemarkId(null)
                                                    }
                                                    className="text-gray-400 hover:text-gray-600"
                                                  >
                                                    <svg
                                                      xmlns="http://www.w3.org/2000/svg"
                                                      width="12"
                                                      height="12"
                                                      viewBox="0 0 24 24"
                                                      fill="none"
                                                      stroke="currentColor"
                                                      strokeWidth="3"
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                    >
                                                      <line
                                                        x1="18"
                                                        y1="6"
                                                        x2="6"
                                                        y2="18"
                                                      ></line>
                                                      <line
                                                        x1="6"
                                                        y1="6"
                                                        x2="18"
                                                        y2="18"
                                                      ></line>
                                                    </svg>
                                                  </button>
                                                </div>
                                                <p className="text-xs text-gray-700 leading-relaxed wrap-break-word whitespace-normal text-left">
                                                  {l.remark}
                                                </p>
                                                <div className="absolute -bottom-1 right-3 w-2 h-2 bg-white border-r border-b border-gray-200 rotate-45"></div>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-6 text-center">
                                    {l.status !== "pending" &&
                                      l.approverFirst ? (
                                      <div className="inline-flex flex-col items-center">
                                        <span className="text-[13px] font-bold text-gray-900 tracking-tight whitespace-nowrap">
                                          {`${l.approverFirst} ${l.approverLast || ""}`.trim()}
                                        </span>
                                        <span className="text-[9px] text-indigo-500 font-black uppercase tracking-widest mt-0.5 whitespace-nowrap">
                                          {l.approverPosition}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-gray-300 font-medium">
                                        —
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td
                                colSpan={9}
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
              {/* {ตารางคำขอ OT พนักงาน} */}
              <div className="print:hidden mt-12">
                <Section title="คำขอทำ OT พนักงาน">
                  {/* Search Box */}
                  <div className="mb-6 relative max-w-sm">
                    <input
                      type="text"
                      placeholder="🔍 ค้นชื่อพนักงาน หรือ โปรเจกต์..."
                      className="w-full pl-6 pr-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                      value={searchOT}
                      onChange={(e) => setSearchOT(e.target.value)}
                    />
                  </div>

                  <div className="rounded-[2.5rem] border border-slate-100 overflow-hidden bg-white shadow-xl shadow-slate-200/50">
                    <div className="overflow-x-auto max-h-137.5 overflow-y-auto custom-scrollbar">
                      <table className="min-w-325 w-full text-sm border-separate border-spacing-0 table-fixed">
                        <thead className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-sm">
                          <tr className="text-slate-600 font-black uppercase text-[12px] tracking-[0.2em]">
                            <th className="py-6 px-6 text-left border-b border-slate-100 w-[250px]">
                              พนักงาน
                            </th>
                            <th className="py-6 px-4 text-center border-b border-slate-100 w-[180px]">
                              วันที่ขอ OT
                            </th>
                            <th className="py-6 px-4 text-center border-b border-slate-100 w-[180px]">
                              วันที่ทำ OT
                            </th>
                            <th className="py-6 px-4 text-center border-b border-slate-100 w-[200px]">
                              ช่วงเวลา
                            </th>
                            <th className="py-6 px-4 text-center border-b border-slate-100 w-[120px]">
                              จำนวน (นาที)
                            </th>
                            <th className="py-6 px-4 text-left border-b border-slate-100 w-[250px]">
                              งานที่ทำ & เหตุผล
                            </th>
                            <th className="py-6 px-4 text-center border-b border-slate-100 w-[130px]">
                              สถานะ
                            </th>
                            <th className="py-6 px-6 text-center border-b border-slate-100 w-[180px]">
                              จัดการ
                            </th>
                            <th className="py-6 px-6 text-center border-b border-slate-100 w-[200px]">
                              หมายเหตุ
                            </th>
                            <th className="py-6 px-6 text-center border-b border-slate-100 w-[180px]">
                              ผู้จัดการคำขอ
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredOT.length > 0 ? (
                            filteredOT.map((ot) => {
                              return (
                                <tr
                                  key={ot.id}
                                  className="group hover:bg-indigo-50/30 transition-all"
                                >
                                  <td className="py-5 px-6">
                                    <div className="flex items-center gap-4">
                                      <div className="w-12 h-12 relative rounded-2xl overflow-hidden border-2 border-white shadow-sm shrink-0">
                                        <img
                                          src={
                                            ot.avatarUrl ||
                                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                              ot.employeeName || "User"
                                            )}&background=random`
                                          }
                                          alt="profile"
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                      <div className="truncate">
                                        <div className="font-black text-slate-800 text-base leading-none mb-1 truncate">
                                          {ot.employeeName}
                                        </div>
                                        <div className="text-indigo-500 font-mono text-[10px] font-bold italic truncate">
                                          @{ot.positionName || "พนักงาน"}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-center font-bold text-slate-600">
                                    {/* แก้กลับมาใช้ ot.date เพื่อแสดงวันที่ทำ OT จริงที่ Map มาจาก Server */}
                                    {ot.requestDate || "-"}
                                  </td>
                                  <td className="px-4 py-2 text-center font-bold text-slate-600">
                                    {/* แก้กลับมาใช้ ot.date เพื่อแสดงวันที่ทำ OT จริงที่ Map มาจาก Server */}
                                    {ot.date || "-"}
                                  </td>
                                  <td className="py-5 px-4 text-center">
                                    <div className="inline-block bg-slate-100 text-slate-700 px-3 py-1 rounded-lg font-black text-[11px] mb-1">
                                      {ot.timeStart?.slice(0, 5)} -{" "}
                                      {ot.timeEnd?.slice(0, 5)}
                                    </div>
                                  </td>
                                  <td className="py-5 px-4 text-center">
                                    <span className="bg-indigo-600 text-white px-3 py-1 rounded-full font-black text-xs shadow-sm shadow-indigo-200">
                                      {ot.overtimeByRequest} น.
                                    </span>
                                  </td>
                                  <td className="py-5 px-4">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-indigo-600 font-bold text-[10px] uppercase">
                                        {ot.projectTag || "General Work"}
                                      </span>
                                      <p className="text-slate-600 italic text-xs leading-relaxed line-clamp-2">
                                        "{ot.reason || "ไม่มีระบุรายละเอียด"}"
                                      </p>
                                    </div>
                                  </td>
                                  <td className="py-5 px-4 text-center">
                                    <span
                                      className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase shadow-sm whitespace-nowrap ${ot.status === "pending"
                                        ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
                                        : ot.status === "approved"
                                          ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                                          : "bg-rose-100 text-rose-700 ring-1 ring-rose-200"
                                        }`}
                                    >
                                      {ot.status === "pending"
                                        ? "• รออนุมัติ"
                                        : ot.status === "approved"
                                          ? "✓ อนุมัติแล้ว"
                                          : "✕ ปฏิเสธ"}
                                    </span>
                                  </td>
                                  <td className="py-5 px-6">
                                    <div className="flex justify-center gap-2">
                                      {ot.status === "pending" ? (
                                        <>
                                          <button
                                            disabled={isProcessingOT}
                                            onClick={() =>
                                              handleApproveOT(ot.id)
                                            }
                                            className="bg-emerald-600 text-white px-5 py-2 rounded-xl text-xs font-black hover:bg-emerald-700 hover:-translate-y-0.5 transition-all shadow-lg shadow-emerald-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                          >
                                            {isProcessingOT ? "..." : "อนุมัติ"}
                                          </button>
                                          <button
                                            disabled={isProcessingOT}
                                            onClick={() =>
                                              handleRejectOT(ot.id)
                                            }
                                            className="bg-white border border-rose-200 text-rose-500 px-5 py-2 rounded-xl text-xs font-black hover:bg-rose-50 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            {isProcessingOT ? "..." : "ปฏิเสธ"}
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          disabled={isProcessingOT}
                                          onClick={() => resetOTStatus(ot.id)}
                                          className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-black hover:bg-slate-200 transition-all flex items-center gap-2 italic disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          <span>
                                            {isProcessingOT ? "⏳" : "✏️"}
                                          </span>{" "}
                                          แก้ไข
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-4 px-4">
                                    <div className="relative flex items-center gap-2">
                                      <input
                                        type="text"
                                        placeholder="ระบุหมายเหตุ..."
                                        className={`border rounded-xl px-3 py-1.5 text-xs w-full transition-all outline-none ${ot.status !== "pending"
                                          ? "bg-gray-50 text-gray-700 border-gray-200 shadow-sm"
                                          : "bg-white border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                                          }`}
                                        value={
                                          ot.status === "pending"
                                            ? (otRemarks[ot.id] ??
                                              ot.remark ??
                                              "")
                                            : (ot.remark ?? "-")
                                        }
                                        onChange={(e) =>
                                          handleOTRemarkChange(
                                            ot.id,
                                            e.target.value
                                          )
                                        }
                                        readOnly={ot.status !== "pending"}
                                      />
                                      {ot.status !== "pending" && ot.remark && (
                                        <div className="relative shrink-0">
                                          <button
                                            onClick={() =>
                                              setViewRemarkId(
                                                viewRemarkId === ot.id
                                                  ? null
                                                  : ot.id
                                              )
                                            }
                                            className={`shrink-0 p-1.5 rounded-lg transition-colors border ${viewRemarkId === ot.id
                                              ? "bg-blue-600 text-white border-blue-600"
                                              : "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100"
                                              }`}
                                          >
                                            <svg
                                              xmlns="http://www.w3.org/2000/svg"
                                              width="14"
                                              height="14"
                                              viewBox="0 0 24 24"
                                              fill="none"
                                              stroke="currentColor"
                                              strokeWidth="2.5"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                            >
                                              <circle
                                                cx="11"
                                                cy="11"
                                                r="8"
                                              ></circle>
                                              <line
                                                x1="21"
                                                y1="21"
                                                x2="16.65"
                                                y2="16.65"
                                              ></line>
                                            </svg>
                                          </button>
                                          {viewRemarkId === ot.id && (
                                            <>
                                              <div
                                                className="fixed inset-0 z-40"
                                                onClick={() =>
                                                  setViewRemarkId(null)
                                                }
                                              ></div>
                                              <div className="absolute right-0 bottom-full mb-2 z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-xl p-3 animate-in fade-in zoom-in duration-200">
                                                <div className="flex justify-between items-center mb-2 pb-1 border-b border-gray-100">
                                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                    หมายเหตุจากผู้อนุมัติ
                                                  </span>
                                                  <button
                                                    onClick={() =>
                                                      setViewRemarkId(null)
                                                    }
                                                    className="text-gray-400 hover:text-gray-600"
                                                  >
                                                    <svg
                                                      xmlns="http://www.w3.org/2000/svg"
                                                      width="12"
                                                      height="12"
                                                      viewBox="0 0 24 24"
                                                      fill="none"
                                                      stroke="currentColor"
                                                      strokeWidth="3"
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                    >
                                                      <line
                                                        x1="18"
                                                        y1="6"
                                                        x2="6"
                                                        y2="18"
                                                      ></line>
                                                      <line
                                                        x1="6"
                                                        y1="6"
                                                        x2="18"
                                                        y2="18"
                                                      ></line>
                                                    </svg>
                                                  </button>
                                                </div>
                                                <p className="text-xs text-gray-700 leading-relaxed wrap-break-word whitespace-normal text-left">
                                                  {ot.remark}
                                                </p>
                                                <div className="absolute -bottom-1 right-3 w-2 h-2 bg-white border-r border-b border-gray-200 rotate-45"></div>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-6 text-center">
                                    {ot.status !== "pending" &&
                                      (ot.approverFirst || ot.approverName) ? (
                                      <div className="inline-flex flex-col items-center">
                                        <span className="text-[13px] font-bold text-gray-900 tracking-tight whitespace-nowrap">
                                          {ot.approverName ||
                                            `${ot.approverFirst} ${ot.approverLast || ""}`.trim()}
                                        </span>
                                        <span className="text-[9px] text-indigo-500 font-black uppercase tracking-widest mt-0.5 whitespace-nowrap">
                                          {ot.approverPosition ||
                                            "Manager/Leader"}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-gray-300 font-medium">
                                        —
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td
                                colSpan={9}
                                className="py-24 text-center text-slate-300 italic font-black tracking-widest"
                              >
                                NO OT REQUESTS FOUND
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
            {/* Header Section */}
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase mb-2">
                ยื่นเรื่อง <span className="text-indigo-600">ลางาน</span>
              </h2>
              <div className="w-12 h-1.5 bg-indigo-600 mx-auto rounded-full"></div>
            </div>

            {leaveSuccess ? (
              /* Success State */
              <div className="p-12 bg-green-50 border border-green-100 text-green-700 rounded-[3rem] text-center space-y-4 shadow-xl">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto text-white text-4xl shadow-lg animate-bounce">
                  ✓
                </div>
                <p className="font-black text-2xl tracking-tighter uppercase">
                  ส่งคำขอลาสำเร็จ
                </p>
              </div>
            ) : (
              /* Form State */
              <div className="space-y-6 bg-gray-50/50 p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border border-gray-100 shadow-inner relative">
                {/* 🔥 Error Notification */}
                {leaveError && (
                  <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-[11px] font-black uppercase animate-shake">
                    <span className="mr-2">⚠️</span> {leaveError}
                  </div>
                )}

                {/* 1. Leave Type Selection */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
                    ประเภทการลา
                  </label>
                  <select
                    className="w-full bg-white p-5 rounded-[1.5rem] font-black text-gray-700 outline-none shadow-sm border-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
                    value={leaveType}
                    onChange={(e) => {
                      setLeaveType(e.target.value);
                      setLeaveError("");
                    }}
                  >
                    <option value="">โปรดระบุ</option>
                    <option value="ลาป่วย">ลาป่วย</option>
                    <option value="ลากิจ">ลากิจ</option>
                    <option value="ลาพักร้อน">ลาพักร้อน</option>
                    <option value="ลาเป็นชั่วโมง">ลาเป็นชั่วโมง</option>
                  </select>
                </div>

                {/* 2. Date Selection & Leave Days/Hours Counter */}
                <div className="relative space-y-4">
                  {/* Badge แสดงระยะเวลา (Logic ตามต้นแบบ) */}
                  {((leaveType !== "ลาเป็นชั่วโมง" &&
                    calculateLeaveDays(leaveStart, leaveEnd) > 0 &&
                    validateLeaveDates(leaveStart, leaveEnd).isValid) ||
                    (leaveType === "ลาเป็นชั่วโมง" &&
                      leaveStartTime &&
                      leaveEndTime &&
                      (leaveStart !== leaveEnd ||
                        leaveEndTime > leaveStartTime))) && (
                      <div className="flex flex-col items-center justify-center py-4 animate-in zoom-in duration-300">
                        <div className="bg-indigo-600 px-8 py-3 rounded-[2rem] shadow-[0_10px_25px_-5px_rgba(79,70,229,0.4)] flex items-center gap-3">
                          <span className="text-[10px] font-black text-indigo-100 uppercase tracking-widest">
                            ระยะเวลา
                          </span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-white leading-none">
                              {leaveType === "ลาเป็นชั่วโมง"
                                ? calculateTotalHours(
                                  leaveStart,
                                  leaveEnd,
                                  leaveStartTime,
                                  leaveEndTime
                                )
                                : calculateLeaveDays(leaveStart, leaveEnd)}
                            </span>
                            <span className="text-sm font-bold text-white uppercase">
                              {leaveType === "ลาเป็นชั่วโมง" ? "ชั่วโมง" : "วัน"}
                            </span>
                          </div>
                        </div>
                        <div className="h-4 w-0.5 bg-gradient-to-b from-indigo-600 to-transparent opacity-20"></div>
                      </div>
                    )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative">
                    {/* Start Date */}
                    <div className="space-y-2 group">
                      <label
                        className={`text-[10px] font-black uppercase ml-4 transition-colors ${leaveError?.includes("เริ่มต้น") ||
                          (leaveStart &&
                            !validateLeaveDates(leaveStart, leaveEnd).isValid)
                          ? "text-red-500"
                          : "text-gray-400 group-focus-within:text-indigo-500"
                          }`}
                      >
                        เริ่มต้น
                      </label>
                      <input
                        type="date"
                        className={`w-full bg-white p-5 rounded-[1.8rem] font-black outline-none shadow-sm border-2 transition-all appearance-none ${leaveError?.includes("เริ่มต้น")
                          ? "border-red-200 bg-red-50/50"
                          : "border-transparent focus:border-indigo-500 text-gray-700"
                          }`}
                        value={leaveStart}
                        onChange={(e) => {
                          setLeaveStart(e.target.value);
                          setLeaveError("");
                        }}
                      />
                    </div>

                    {/* End Date */}
                    <div className="space-y-2 group">
                      <label
                        className={`text-[10px] font-black uppercase ml-4 transition-colors ${leaveError?.includes("สิ้นสุด") ||
                          (leaveEnd &&
                            !validateLeaveDates(leaveStart, leaveEnd).isValid)
                          ? "text-red-500"
                          : "text-gray-400 group-focus-within:text-indigo-500"
                          }`}
                      >
                        สิ้นสุด
                      </label>
                      <input
                        type="date"
                        className={`w-full bg-white p-5 rounded-[1.8rem] font-black outline-none shadow-sm border-2 transition-all appearance-none ${leaveError?.includes("สิ้นสุด")
                          ? "border-red-200 bg-red-50/50"
                          : "border-transparent focus:border-indigo-500 text-gray-700"
                          }`}
                        value={leaveEnd}
                        onChange={(e) => {
                          setLeaveEnd(e.target.value);
                          setLeaveError("");
                        }}
                      />
                    </div>
                  </div>

                  {/* ส่วนเลือกเวลาสำหรับ ลาเป็นชั่วโมง (Logic ตามต้นแบบเป๊ะ) */}
                  {leaveType === "ลาเป็นชั่วโมง" && (
                    <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-4 duration-300">
                      <div className="space-y-2 group">
                        <label
                          className={`text-[10px] font-black uppercase ml-4 ${!leaveStart ? "text-red-500" : "text-gray-400"}`}
                        >
                          เวลาเริ่มต้น (24H)
                        </label>
                        <select
                          className={`w-full p-5 rounded-[1.8rem] font-black outline-none shadow-sm border-2 transition-all appearance-none cursor-pointer ${!leaveStart
                            ? "border-red-200 bg-red-50 text-red-600"
                            : "bg-white border-transparent focus:border-indigo-500 text-gray-700"
                            }`}
                          value={leaveStartTime}
                          onChange={(e) => {
                            if (!leaveStart || !leaveEnd) {
                              setLeaveError(
                                "กรุณาเลือกวันที่เริ่มต้นและสิ้นสุดก่อนเลือกเวลา"
                              );
                              return;
                            }
                            const newStart = e.target.value;
                            setLeaveStartTime(newStart);
                            if (
                              leaveStart === leaveEnd &&
                              leaveEndTime &&
                              leaveEndTime !== "00:00" &&
                              newStart >= leaveEndTime
                            ) {
                              setLeaveError(
                                "วันเดียวกัน เวลาเริ่มต้นต้องน้อยกว่าเวลาสิ้นสุด"
                              );
                            } else {
                              setLeaveError("");
                            }
                          }}
                        >
                          <option value="">
                            {!leaveStart ? "ระบุวันก่อน" : "เลือกเวลา"}
                          </option>
                          {Array.from({ length: 24 }).map((_, h) =>
                            [0, 30].map((m) => {
                              const t = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
                              return (
                                <option key={`start-${t}`} value={t}>
                                  {t}
                                </option>
                              );
                            })
                          )}
                        </select>
                      </div>
                      <div className="space-y-2 group">
                        <label
                          className={`text-[10px] font-black uppercase ml-4 ${!leaveEnd ? "text-red-500" : "text-gray-400"}`}
                        >
                          เวลาสิ้นสุด (24H)
                        </label>
                        <select
                          className={`w-full p-5 rounded-[1.8rem] font-black outline-none shadow-sm border-2 transition-all appearance-none cursor-pointer ${!leaveEnd ||
                            (leaveStart === leaveEnd &&
                              leaveEndTime &&
                              leaveEndTime !== "00:00" &&
                              leaveStartTime >= leaveEndTime)
                            ? "border-red-200 bg-red-50 text-red-600"
                            : "bg-white border-transparent focus:border-indigo-500 text-gray-700"
                            }`}
                          value={leaveEndTime}
                          onChange={(e) => {
                            if (!leaveStart || !leaveEnd) {
                              setLeaveError(
                                "กรุณาเลือกวันที่เริ่มต้นและสิ้นสุดก่อนเลือกเวลา"
                              );
                              return;
                            }
                            const newEnd = e.target.value;
                            setLeaveEndTime(newEnd);
                            if (
                              leaveStart === leaveEnd &&
                              leaveStartTime &&
                              newEnd !== "00:00" &&
                              newEnd <= leaveStartTime
                            ) {
                              setLeaveError(
                                "วันเดียวกัน เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น"
                              );
                            } else {
                              setLeaveError("");
                            }
                          }}
                        >
                          <option value="">
                            {!leaveEnd ? "ระบุวันก่อน" : "เลือกเวลา"}
                          </option>
                          {Array.from({ length: 24 }).map((_, h) =>
                            [0, 30].map((m) => {
                              const t = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
                              if (t === "00:00") return null;
                              return (
                                <option key={`end-${t}`} value={t}>
                                  {t}
                                </option>
                              );
                            })
                          )}
                          <option value="00:00">24:00</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Reason Textarea */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2">
                    ระบุเหตุผล
                  </label>
                  <textarea
                    className="w-full bg-white p-5 rounded-[1.5rem] font-medium min-h-[140px] outline-none shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all border-none resize-none"
                    placeholder="เขียนเหตุผลประกอบการลาที่นี่..."
                    value={leaveReason}
                    onChange={(e) => {
                      setLeaveReason(e.target.value);
                      if (leaveError === "กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง")
                        setLeaveError("");
                    }}
                  />
                </div>

                {/* 4. Image Upload & Compression */}
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
                      className="flex flex-col items-center justify-center w-full bg-white border-2 border-dashed border-gray-200 p-8 rounded-[1.5rem] cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group shadow-sm active:scale-[0.98]"
                    >
                      {leaveFilePreview ? (
                        <div className="relative w-full h-32 flex justify-center animate-in zoom-in">
                          <img
                            src={leaveFilePreview}
                            alt="Preview"
                            className="h-full object-contain rounded-lg shadow-md"
                          />
                          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <p className="text-white text-[10px] font-black uppercase">
                              เปลี่ยนรูปภาพ
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-gray-400 group-hover:text-indigo-600 group-hover:scale-110 transition-all">
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

                {/* 5. Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <button
                    onClick={submitLeave}
                    disabled={
                      isProcessing ||
                      !!leaveError ||
                      !leaveStart ||
                      !leaveEnd ||
                      (leaveType === "ลาเป็นชั่วโมง" &&
                        (!leaveStartTime ||
                          !leaveEndTime ||
                          (leaveStart === leaveEnd &&
                            leaveStartTime >= leaveEndTime)))
                    }
                    className="flex-[2] bg-indigo-600 text-white font-black py-6 rounded-[1.5rem] shadow-xl active:scale-95 hover:bg-indigo-700 transition-all uppercase tracking-tighter disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        กำลังประมวลผล...
                      </span>
                    ) : (
                      "ยืนยันการลา"
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowLeaveForm(false);
                      setLeaveFile(null);
                      setLeaveFilePreview(null);
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
      {showOffsitePopup && (
        <OffsiteConfirmPopup
          siteName={pendingData?.siteName || "ไซต์งาน"}
          onCancel={() => setShowOffsitePopup(false)}
          onConfirm={() => {
            // แก้ไขให้เรียกใช้ฟังก์ชันที่ถูกต้องตามที่ประกาศไว้ใน Server Action
            // โดยส่ง isConfirmed: true เข้าไปเพื่อข้ามขั้นตอนเช็คพิกัดซ้ำ
            saveAttendanceAction({
              ...pendingData!,
              isConfirmed: true,
            }).then((result) => {
              if (result.success) {
                setShowSuccessCard(true);
                setShowOffsitePopup(false);
                router.refresh();
              } else {
                alert("ข้อผิดพลาด: " + (result.error || "ไม่สามารถบันทึกเวลาได้"));
              }
            });
          }}
        />
      )}
      {/* --- 4. ปุ่มยืนยันออกงานก่อนกำหนด < 1 ชม. ของนาย --- */}
      {showLogoutConfirmPopup && (
        <LogoutConfirmPopup
          siteName={pendingData?.siteName || "ไซต์งาน"}
          onCancel={() => {
            setShowLogoutConfirmPopup(false);
            setIsCheckingOut(false);
          }}
          onConfirm={() => {
            setShowLogoutConfirmPopup(false); // ปิดป๊อปอัพเตือน

            // 🚩 รันคำสั่งเปิดกล้องเพื่อให้พนักงานกดถ่ายรูปตาม Flow เดิมของนาย
            // พอกดชัตเตอร์ถ่ายรูปเสร็จ ตัวปุ่มชัตเตอร์กล้องของนายจะเรียก executeAttendanceAction(true) ไปเองโดยอัตโนมัติ
            startCamera();
          }}
        />
      )}
      {showSuccessCard && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 transition-opacity">
          <CardSmall 
            title={isCheckingOut ? "ลงชื่อเลิกงานสำเร็จ" : "ลงชื่อเข้างานสำเร็จ"}
            onClose={() => setShowSuccessCard(false)} 
          />
        </div>
      )}
    </div>
  );
}
