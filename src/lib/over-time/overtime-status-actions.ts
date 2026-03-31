import { db } from "@/db/db"; // 1. ดึงตัวเชื่อมต่อ Database มาใช้
import { overtimeTable, overtimeRequestsTable } from "@/db/schema"; // 2. ดึงโครงสร้างตารางมาใช้
import { and, eq, lte } from "drizzle-orm"; // 3. ดึงเครื่องมือสร้างเงื่อนไข SQL มาใช้

/**
 * ฟังก์ชันสำหรับตัดจบ OT ที่ไม่มีคำขอ หรือ คำขอที่ไม่มีคนทำจริง เกิน 72 ชม.
 */
export async function cleanupExpiredOvertime() {
    const threeDaysAgo = new Date();
    threeDaysAgo.setHours(threeDaysAgo.getHours() - 72);
  
    try {
      return await db.transaction(async (tx) => {
        // 1. ตัด OT ดิบที่ไม่มีคำขอมารองรับภายใน 3 วัน
        // ปรับให้ตรงกับ Schema: ใช้ status 'pending' ตามค่าเริ่มต้นของคุณ
        const expiredRaw = await tx.update(overtimeTable)
          .set({ status: "expired" })
          .where(
            and(
              eq(overtimeTable.status, "pending"),
              lte(overtimeTable.date, threeDaysAgo.toISOString().split('T')[0]) 
            )
          );
  
        // 2. ตัดคำขอที่อนุมัติแล้วแต่ไม่มีใครมาทำจริงภายใน 3 วัน
        const expiredRequests = await tx.update(overtimeRequestsTable)
          .set({ status: "expired" })
          .where(
            and(
              eq(overtimeRequestsTable.status, "approved"),
              lte(overtimeRequestsTable.date, threeDaysAgo.toISOString().split('T')[0])
            )
          );
  
        return { 
            expiredRawCount: expiredRaw.length, 
            expiredRequestCount: expiredRequests.length 
        };
      });
    } catch (error) {
      console.error("Cleanup Error:", error);
    }
}