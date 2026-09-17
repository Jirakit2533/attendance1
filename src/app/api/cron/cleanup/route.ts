// src/app/api/cron/cleanup/route.ts

import { cleanupExpiredOvertime } from "@/features/over-time/overtime-status-actions";
import { db } from "@/db/db";
import { overtimeTable, overtimeRequestsTable, automationLogTable } from "@/db/schema"; 
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const startTime = new Date();
  const todayDate = startTime.toISOString().split('T')[0];
  let logId: string | null = null;

  try {
    // [LOG START]
    const [log] = await db.insert(automationLogTable).values({
      jobName: "ot-daily-automation",
      date: todayDate,
      startAt: startTime,
      status: "success",
      retryCount: 0,
    }).returning({ id: automationLogTable.id });
    logId = log.id;

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
    let matchCount = 0; 
    let skippedCount = 0;

    for (const rawOT of pendingOTs) {
      // 4. หา request ที่ match (อนุญาตให้มีหลายอันได้)
      const requests = await db
        .select()
        .from(overtimeRequestsTable)
        .where(
          and(
            eq(overtimeRequestsTable.userId, rawOT.userId!),
            eq(overtimeRequestsTable.date, rawOT.date!),
            eq(overtimeRequestsTable.status, "approved")
          )
        );

      // ❌ ไม่เจอ approved request เลย → skip
      if (requests.length === 0) {
        skippedCount++;
        console.log(
          `⏭️  SKIP: OT ID ${rawOT.id} | User ${rawOT.userId} | Date ${rawOT.date} | No approved requests`
        );
        continue;
      }

      // 5. คำนวณ raw minutes
      const totalRawMinutes =
        (rawOT.overtimeBefore || 0) +
        (rawOT.overtimeAfter || 0);

      // 6. รวม overtimeByRequest จากทั้งหมดที่ approved
      const totalRequestedMinutes = requests.reduce(
        (sum, req) => sum + (req.overtimeByRequest || 0),
        0
      );

      // 7. เลือกน้อยกว่า: raw ที่ทำได้ vs request ที่ขอ
      const finalizedMinutes = Math.min(
        totalRawMinutes,
        totalRequestedMinutes
      );

      // 8. update OT
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
        skippedCount++;
        console.log(
          `⚠️  RACE: OT ID ${rawOT.id} was updated elsewhere (race condition)`
        );
        continue;
      }

      // 9. ปิด request ทั้งหมด (อาจมีหลายอัน)
      await db
        .update(overtimeRequestsTable)
        .set({ status: "executed" as any })
        .where(
          and(
            eq(overtimeRequestsTable.userId, rawOT.userId!),
            eq(overtimeRequestsTable.date, rawOT.date!),
            eq(overtimeRequestsTable.status, "approved")
          )
        );

      matchCount++;
      autoExecutedCount++;
      
      console.log(
        `✅ EXECUTED: OT ID ${rawOT.id} | Raw ${totalRawMinutes} min | Requested ${totalRequestedMinutes} min (${requests.length} requests) | Approved ${finalizedMinutes} min`
      );
    }

    // [LOG UPDATE]
    if (logId) {
      const endTime = new Date();
      const totalChange = (cleanupResult.expiredRawCount + cleanupResult.expiredRequestCount) + matchCount;
      
      await db.update(automationLogTable).set({
        endAt: endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
        readCount: pendingOTs.length,
        changeCount: totalChange,
        executedCount: autoExecutedCount,
        deletedCount: (cleanupResult.expiredRawCount + cleanupResult.expiredRequestCount),
        details: {
          ...cleanupResult,
          totalReadInProcess: pendingOTs.length,
          autoExecutedCount,
          matchCount,
          skippedOrInvalid: skippedCount,
          performanceNote: `Read ${pendingOTs.length} rows | Executed ${autoExecutedCount} | Skipped ${skippedCount}`
        },
      }).where(eq(automationLogTable.id, logId));
    }

    return NextResponse.json({
      success: true,
      message: "ระบบทำความสะอาดและประมวลผล OT อัตโนมัติเสร็จสิ้น",
      timestamp: new Date().toISOString(),
      details: {
        ...cleanupResult,
        autoExecutedCount,
        readCount: pendingOTs.length,
        skippedCount,
      },
    });

  } catch (error: any) {
    if (logId) {
      await db.update(automationLogTable).set({
        status: "fault",
        details: { 
            error: error.message,
            stack: error.stack 
        },
      }).where(eq(automationLogTable.id, logId));
    }

    console.error("🚨 Cron Job Critical Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}