// app/api/cron/cleanup/route.ts

import { cleanupExpiredOvertime } from "@/lib/over-time/overtime-status-actions";
import { db } from "@/db/db";
import { overtimeTable, overtimeRequestsTable } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 1. Check Authorization
    const authHeader = request.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return new Response("Unauthorized", { status: 401 });
    }

    // 2. Cleanup ของเก่า
    const cleanupResult = await cleanupExpiredOvertime();

    // 3. ดึง OT ที่ยัง pending ทั้งหมด
    const pendingOTs = await db
      .select()
      .from(overtimeTable)
      .where(eq(overtimeTable.status, "pending"));

    let autoExecutedCount = 0;

    for (const rawOT of pendingOTs) {
      // 4. หา request ที่ match (user + วันเดียวกันแบบ timezone ไทย)
      const requests = await db
        .select()
        .from(overtimeRequestsTable)
        .where(
          and(
            eq(overtimeRequestsTable.userId, rawOT.userId!),
            sql`
              DATE(${overtimeRequestsTable.date} AT TIME ZONE 'Asia/Bangkok')
              =
              DATE(${rawOT.date} AT TIME ZONE 'Asia/Bangkok')
            `,
            eq(overtimeRequestsTable.status, "approved")
          )
        );

      // ไม่เจอ หรือ ซ้ำ → ข้าม
      if (requests.length !== 1) continue;

      const requestOT = requests[0];

      // 5. คำนวณ OT
      const totalRawMinutes =
        (rawOT.overtimeBefore || 0) +
        (rawOT.overtimeAfter || 0);

      const finalizedMinutes = Math.min(
        totalRawMinutes,
        requestOT.overtimeByRequest
      );

      // 6. update OT (กัน race condition ด้วย where pending)
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

      if (updated.length === 0) continue;

      // 7. ปิด request
      await db
        .update(overtimeRequestsTable)
        .set({ status: "executed" as any })
        .where(eq(overtimeRequestsTable.id, requestOT.id));

      autoExecutedCount++;
    }

    return NextResponse.json({
      success: true,
      message: "ระบบทำความสะอาดและประมวลผล OT อัตโนมัติเสร็จสิ้น",
      timestamp: new Date().toISOString(),
      details: {
        ...cleanupResult,
        autoExecutedCount,
      },
    });
  } catch (error: any) {
    console.error("🚨 Cron Job Critical Error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error.message,
      },
      { status: 500 }
    );
  }
}