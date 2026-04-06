// @/lib/over-time/otExecutionActions.ts

"use server";

import { db } from "@/db/db";
import { overtimeTable, overtimeRequestsTable } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * API: Execute OT (คัดกรองและบันทึกยอดสรุป)
 * @param attendanceId - ID จากตารางบันทึกเวลา
 * @param adminId - ID ของผู้ที่กดยืนยันรายการนี้
 */
export async function executeOTAction(attendanceId: string, adminId: string) {
  try {
    // 1. ดึง OT ที่ยัง pending เท่านั้น
    const [rawOT] = await db
      .select()
      .from(overtimeTable)
      .where(
        and(
          eq(overtimeTable.attendanceId, attendanceId),
          eq(overtimeTable.status, "pending")
        )
      )
      .limit(1);

    if (!rawOT) {
      throw new Error("⚠️ ไม่พบ OT ที่เป็น pending");
    }

    // 2. หา request โดยเทียบ “วัน” (timezone ไทย)
    // 2. หา request โดยเทียบ “วัน” (เทียบตรงๆ ง่ายกว่า)
const requests = await db
.select()
.from(overtimeRequestsTable)
.where(
  and(
    eq(overtimeRequestsTable.userId, rawOT.userId!),
    eq(overtimeRequestsTable.date, rawOT.date!), // เทียบวันที่ตรงๆ
    eq(overtimeRequestsTable.status, "approved")
  )
);

    if (requests.length === 0) {
      throw new Error("⚠️ ไม่พบ request ที่ approved และตรงวัน");
    }

    if (requests.length > 1) {
      throw new Error("❌ พบ request ซ้ำในวันเดียว (data คุณพัง)");
    }

    const requestOT = requests[0];

    // 3. คำนวณ OT
    const totalRawMinutes =
      (rawOT.overtimeBefore || 0) + (rawOT.overtimeAfter || 0);

    const finalizedMinutes = Math.min(
      totalRawMinutes,
      requestOT.overtimeByRequest
    );

    // 4. update OT (กัน race condition ด้วย where pending)
    const updated = await db
      .update(overtimeTable)
      .set({
        overtimeApproved: finalizedMinutes,
        status: "approved",
      })
      .where(
        and(
          eq(overtimeTable.id, rawOT.id),
          eq(overtimeTable.status, "pending")
        )
      )
      .returning();

    if (updated.length === 0) {
      throw new Error("❌ OT ถูก process ไปแล้ว (race condition)");
    }

    // 5. ปิด request
    await db
      .update(overtimeRequestsTable)
      .set({ status: "executed" as any })
      .where(eq(overtimeRequestsTable.id, requestOT.id));

    revalidatePath("/admin/ot-management");

    return {
      success: true,
      data: {
        rawMinutes: totalRawMinutes,
        approvedMinutes: finalizedMinutes,
        userName: rawOT.userName,
      },
    };

  } catch (error: any) {
    console.error("❌ OT Execution Failed:", error.message);

    return {
      success: false,
      error: error.message,
    };
  }
}