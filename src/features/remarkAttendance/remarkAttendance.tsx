"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// 🚩 นำเข้า Action สำหรับ Update Remark โดยเฉพาะ เพื่อเลี่ยงตัวดักลงชื่อซ้ำใน Action หลัก
import { remarkAttendanceAction } from "./procedure"; 

interface RemarkModalProps {
  attendanceId: string;
  role: "employee" | "leader";
  initialRemark?: string | null;
  // 🚩 รับมาเพื่อความปลอดภัยของ Props เดิม
  executeAttendanceAction: (isConfirmed?: boolean, remark?: string) => Promise<void>;
}

export default function RemarkModal({
  attendanceId,
  role,
  initialRemark,
  executeAttendanceAction, // 🚩 รับฟังก์ชันมาใช้งาน
}: RemarkModalProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  // ✅ ฟังก์ชันจัดการการส่งฟอร์ม: เปลี่ยนมาเรียก remarkAttendanceAction เพื่อ Update ข้อมูลเดิม
  const handleFormAction = async (formData: FormData) => {
    setIsPending(true);
    // เพิ่ม Log ฝั่ง Client เพื่อดูว่ากดแล้วฟังก์ชันทำงานไหม
    console.log("Submit clicked, sending Data..."); 

    try {
      const res = await remarkAttendanceAction(formData);
      
      // 🔍 DEBUG: พ่น Alert ดูค่าที่ Server ตอบกลับมา
      // alert(JSON.stringify(res)); // เปิดบรรทัดนี้ถ้าอยากดู Object ทั้งหมดที่ส่งกลับมา

      if (res?.success !== false) {
        alert("✅ บันทึกหมายเหตุสำเร็จ!"); 

        const modal = document.getElementById(
          "remark_modal"
        ) as HTMLDialogElement;
        if (modal) modal.close();
        
        router.refresh(); 
      } else {
        // กรณี Server ตอบกลับมาว่า success: false
        alert("❌ Server Error: " + (res?.error || "บันทึกไม่สำเร็จ"));
      }
      
    } catch (err: any) {
      // กรณีตายที่ Network หรือ Runtime Error
      console.error("Client Catch Error:", err);
      alert("🚨 Fatal Error: " + (err?.message || "เชื่อมต่อ Server ไม่ได้"));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <dialog
      id="remark_modal"
      className="modal backdrop-blur-md bg-black/30 transition-all duration-300"
    >
      <div className="modal-box relative bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-2xl max-w-lg w-full border border-gray-100 dark:border-slate-800">
        {/* Header */}
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            บันทึกหมายเหตุ
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            ระบุเหตุผลหรือข้อมูลเพิ่มเติมสำหรับการลงเวลานี้ (
            {role === "employee" ? "พนักงาน" : "หัวหน้า"})
          </p>
        </div>

        {/* Form Body */}
        <form action={handleFormAction} className="space-y-6">
          {/* 🚩 ใส่ key เพื่อบังคับให้ React อัปเดต value ใหม่ทุกครั้งที่ attendanceId เปลี่ยน */}
          <input 
            key={attendanceId} 
            type="hidden" 
            name="attendanceId" 
            value={attendanceId || ""} 
            readOnly 
          />
          <input type="hidden" name="role" value={role} />

          <div className="relative">
            <textarea
              key={`remark-${attendanceId}`} 
              name="remark"
              defaultValue={initialRemark ?? ""}
              required
              rows={5}
              disabled={isPending}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none bg-gray-50 dark:bg-slate-800 dark:text-white disabled:opacity-50"
              placeholder="กรุณาพิมพ์หมายเหตุที่นี่..."
            ></textarea>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="px-8 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-500/30 transition-all active:scale-95 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  กำลังบันทึก...
                </>
              ) : (
                "บันทึกข้อมูล"
              )}
            </button>
          </div>
        </form>

        {/* Close Icon Button */}
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            const modal = document.getElementById(
              "remark_modal"
            ) as HTMLDialogElement;
            if (modal) modal.close();
          }}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors disabled:opacity-50"
        >
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
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </dialog>
  );
}