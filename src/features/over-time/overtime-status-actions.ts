// @/lib/over-time/overtime-status-actions.ts

import { db } from "@/db/db";
import { overtimeTable, overtimeRequestsTable } from "@/db/schema";
import { and, eq, lt, inArray, sql } from "drizzle-orm";

export async function cleanupExpiredOvertime() {
  // ใช้ timestamp ตรง ๆ (UTC-based, ปลอดภัยกว่า)
  const now = new Date();
  const dateLimit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    // --- ส่วนที่ 1: OT ดิบ ---
    const expiredRaw = await db
      .update(overtimeTable)
      .set({
        status: "expired",
      })
      .where(
        and(
          eq(overtimeTable.status, "pending"),
          lt(overtimeTable.date, dateLimit) // เทียบ timestamp ตรง ๆ
        )
      )
      .returning({ id: overtimeTable.id });

    // --- ส่วนที่ 2: ใบคำขอ ---
    const expiredRequests = await db
      .update(overtimeRequestsTable)
      .set({
        status: "expired",
        remarks: sql`
          CASE 
            WHEN remarks IS NULL OR remarks = '' 
              THEN '[System: Auto-expired after 7 days]'
            WHEN remarks LIKE '%Auto-expired after 7 days%' 
              THEN remarks
            ELSE CONCAT(remarks, ' [System: Auto-expired after 7 days]')
          END
        `,
      })
      .where(
        and(
          inArray(overtimeRequestsTable.status, ["pending"]), 
          // 🔥 ตัด approved ออก (ถ้าอยากให้โดนด้วยค่อยใส่กลับ)
          lt(overtimeRequestsTable.date, dateLimit)
        )
      )
      .returning({ id: overtimeRequestsTable.id });

    return {
      expiredRawCount: expiredRaw.length || 0,
      expiredRequestCount: expiredRequests.length || 0,
    };
  } catch (error) {
    console.error("🚨 Cleanup Status Error:", error);
    throw error;
  }
}