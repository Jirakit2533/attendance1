// @/features/remarkAttendance/remarkAttendance.tsx
"use client";

import { remarkAttendanceAction } from "./procedure";

interface RemarkModalProps {
  attendanceId: string;
  role: 'employee' | 'leader';
  initialRemark?: string | null;
}

export default function RemarkModal({ attendanceId, role, initialRemark }: RemarkModalProps) {
  // ใช้ Action จาก procedure.ts
  const actionToRun = remarkAttendanceAction; 

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
            ระบุเหตุผลหรือข้อมูลเพิ่มเติมสำหรับการลงเวลานี้ ({role === 'employee' ? 'พนักงาน' : 'หัวหน้า'})
          </p>
        </div>
        
        {/* Form Body */}
        <form action={actionToRun} className="space-y-6">
          <input type="hidden" name="attendanceId" value={attendanceId} />
          <input type="hidden" name="role" value={role} />
          
          <div className="relative">
            <textarea 
              name="remark" 
              defaultValue={initialRemark ?? ""}
              required
              rows={5}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none bg-gray-50 dark:bg-slate-800 dark:text-white" 
              placeholder="กรุณาพิมพ์หมายเหตุที่นี่..."
            ></textarea>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3">
            <button 
              type="button" 
              className="px-6 py-2.5 rounded-xl text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              onClick={() => {
                const modal = document.getElementById('remark_modal') as HTMLDialogElement;
                if (modal) modal.close();
              }}
            >
              ยกเลิก
            </button>
            
            <button 
              type="submit" 
              className="px-8 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-500/30 transition-all active:scale-95"
            >
              บันทึกข้อมูล
            </button>
          </div>
        </form>

        {/* Close Icon Button */}
        <button 
          type="button"
          onClick={() => {
            const modal = document.getElementById('remark_modal') as HTMLDialogElement;
            if (modal) modal.close();
          }}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </dialog>
  );
}