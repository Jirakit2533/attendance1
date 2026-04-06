// @/lib/over-time/overtime-status-actions.ts

import { db } from "@/db/db"; 
import { overtimeTable, overtimeRequestsTable } from "@/db/schema"; 
import { and, eq, lt, ne, sql } from "drizzle-orm"; 
import { subDays } from "date-fns"; // แนะนำให้ใช้ช่วยคำนวณวันที่

export async function cleanupExpiredOvertime() {
    // 1. ตั้งเกณฑ์ 7 วันย้อนหลัง
    const thresholdDate = subDays(new Date(), 7);
    const dateLimit = thresholdDate.toISOString().split('T')[0];

    try {
      return await db.transaction(async (tx) => {
        
        // --- ส่วนที่ 1: จัดการ OT ดิบ (overtimeTable) ---
        // Logic: ถ้ายัง 'pending' และเก่าเกิน 7 วัน -> เปลี่ยนเป็น 'expired'
        const expiredRaw = await tx.update(overtimeTable)
          .set({ 
            otStatusEnum: "expired", 
          })
          .where(
            and(
              eq(overtimeTable.otStatusEnum, "pending"),
              lt(overtimeTable.date, dateLimit)
            )
          )
          .returning({ id: overtimeTable.id }); // เพิ่มเพื่อให้ count ได้แม่นยำ

        // --- ส่วนที่ 2: จัดการใบคำขอ (overtimeRequestsTable) ---
        // Logic: ใบคำขอที่ยัง 'pending' หรือ 'approved' (แต่ไม่มีคนทำ)
        // ถ้าเก่าเกิน 7 วัน -> เปลี่ยนเป็น 'expired' ทั้งหมด
        const expiredRequests = await tx.update(overtimeRequestsTable)
          .set({ 
            status: "expired",
            remarks: sql`CONCAT(COALESCE(remarks, ''), ' [System: Auto-expired after 7 days]')`
          })
          .where(
            and(
              sql`${overtimeRequestsTable.status} IN ('pending', 'approved')`,
              lt(overtimeRequestsTable.date, dateLimit)
            )
          )
          .returning({ id: overtimeRequestsTable.id }); // เพิ่มเพื่อให้ count ได้แม่นยำ

        return { 
            expiredRawCount: expiredRaw.length || 0, 
            expiredRequestCount: expiredRequests.length || 0
        };
      });
    } catch (error) {
      console.error("🚨 Cleanup Status Error:", error);
      throw error; 
    }
}