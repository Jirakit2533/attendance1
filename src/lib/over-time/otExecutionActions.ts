// @/lib/over-time/otExecutionActions.ts

"use server";

import { db } from "@/db";
import { overtimeTable, overtimeRequestsTable } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * API: Execute OT (คัดกรองและบันทึกยอดสรุป)
 * @param attendanceId - ID จากตารางบันทึกเวลา
 * @param adminId - ID ของผู้ที่กดยืนยันรายการนี้
 */
export async function executeOTAction(attendanceId: string, adminId: string) {
  try {
    const result = await db.transaction(async (tx) => {
      // 1. ดึงข้อมูล Raw OT (ดิบ) และเช็คว่ายังไม่เคยถูก Execute (Status ne 'approved')
      // หมายเหตุ: ผมใช้ ne 'approved' เพราะถ้าเคาะแล้วสถานะจะกลายเป็น approved
      const [rawOT] = await tx
        .select()
        .from(overtimeTable)
        .where(
          and(
            eq(overtimeTable.attendanceId, attendanceId),
            ne(overtimeTable.otStatusEnum, "approved") 
          )
        )
        .limit(1);

      if (!rawOT) {
        throw new Error("⚠️ ไม่พบข้อมูลโอทีดิบ หรือรายการนี้ถูกประมวลผลไปแล้ว");
      }

      // 2. ดึงคำขอ OT (Request) ที่ผ่านการอนุมัติ (Status = 'approved')
      // ใช้ความสัมพันธ์ของ userId และ date เพื่อหาใบคำขอที่ตรงกัน
      const [requestOT] = await tx
        .select()
        .from(overtimeRequestsTable)
        .where(
          and(
            eq(overtimeRequestsTable.userId, rawOT.userId!),
            eq(overtimeRequestsTable.date, rawOT.date),
            eq(overtimeRequestsTable.status, "approved")
          )
        )
        .limit(1);

      if (!requestOT) {
        throw new Error("⚠️ ไม่พบใบขออนุมัติโอทีที่ตรงกับวันดังกล่าว");
      }

      // 3. Algorithm: คัดกรองยอดสุทธิ (Refinement)
      const totalRawMinutes = (rawOT.overtimeBefore || 0) + (rawOT.overtimeAfter || 0);
      const finalizedMinutes = Math.min(totalRawMinutes, requestOT.overtimeByRequest);

      // 4. บันทึกผลลัพธ์กลับลงตารางเดิม (overtimeTable)
      await tx
        .update(overtimeTable)
        .set({
          overtimeApproved: finalizedMinutes,
          otStatusEnum: "approved",
          // หากคุณมีฟิลด์เก็บว่าใครเคาะรายการสุดท้าย สามารถเพิ่มได้ที่นี่
        })
        .where(eq(overtimeTable.id, rawOT.id));

      // 5. ปิดสถานะใบคำขอ (overtimeRequestsTable) 
      // เปลี่ยนเป็นสถานะอื่น (เช่น 'executed' หรือใช้ status เดิมหากต้องการเก็บประวัติ)
      // เพื่อป้องกันการนำใบคำขอเดิมไปใช้กับ Attendance อื่น (ถ้ามี)
      await tx
        .update(overtimeRequestsTable)
        .set({ status: "executed" as any }) 
        .where(eq(overtimeRequestsTable.id, requestOT.id));

      return { 
        success: true, 
        data: {
          rawMinutes: totalRawMinutes,
          approvedMinutes: finalizedMinutes,
          userName: rawOT.userName
        }
      };
    });

    revalidatePath("/admin/ot-management"); // ปรับ Path ตามหน้า UI ของคุณ
    return result;

  } catch (error: any) {
    console.error("❌ OT Execution Failed:", error.message);
    return { success: false, error: error.message };
  }
}