// @/lib/over-time/overtime-status-actions.ts

import { db } from "@/db/db"; 
import { overtimeTable, overtimeRequestsTable } from "@/db/schema"; 
import { and, eq, sql } from "drizzle-orm"; 

export async function cleanupExpiredOvertime() {
    // ใช้เวลาไทย (ไม่ต้องใช้ date-fns-tz) (คงเดิม)
    const dateLimit = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toLocaleDateString("en-CA", {
      timeZone: "Asia/Bangkok",
    });

    try {
        // --- ส่วนที่ 1: OT ดิบ --- (คงเดิม)
        const expiredRaw = await db.update(overtimeTable)
          .set({ 
            status: "expired", 
          })
          .where(
            and(
              eq(overtimeTable.status, "pending"),
              sql`
                DATE(${overtimeTable.date} AT TIME ZONE 'Asia/Bangkok') < ${dateLimit}
              `
            )
          )
          .returning({ id: overtimeTable.id });

        // --- ส่วนที่ 2: ใบคำขอ --- (คงเดิม)
        const expiredRequests = await db.update(overtimeRequestsTable)
          .set({ 
            status: "expired",
            remarks: sql`CONCAT(COALESCE(remarks, ''), ' [System: Auto-expired after 7 days]')`
          })
          .where(
            and(
              sql`${overtimeRequestsTable.status} IN ('pending', 'approved')`,
              sql`
                DATE(${overtimeRequestsTable.date} AT TIME ZONE 'Asia/Bangkok') < ${dateLimit}
              `
            )
          )
          .returning({ id: overtimeRequestsTable.id });

        // คืนค่าจำนวนรายการที่ถูกจัดการ เพื่อนำไปบวกเป็น changeCount ใน API หลัก (คงเดิม)
        return { 
            expiredRawCount: expiredRaw.length || 0, 
            expiredRequestCount: expiredRequests.length || 0
        };
        
    } catch (error) {
      console.error("🚨 Cleanup Status Error:", error);
      throw error; 
    }
}