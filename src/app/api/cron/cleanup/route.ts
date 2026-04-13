// src/app/api/cron/cleanup/route.ts

import { cleanupExpiredOvertime } from "@/features/over-time/overtime-status-actions";
import { db } from "@/db/db";
import { overtimeTable, overtimeRequestsTable, automationLogTable } from "@/db/schema"; 
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // เพิ่มประกันเวลาให้รันได้นานสูงสุด 60 วินาทีตามที่แนะนำ

export async function GET(request: Request) {
  const startTime = new Date();
  const todayDate = startTime.toISOString().split('T')[0];
  let logId: string | null = null;

  try {
    // [LOG START] บันทึกจุดเริ่มต้นและจองสถานะ success ไว้ก่อน
    const [log] = await db.insert(automationLogTable).values({
      jobName: "ot-daily-automation",
      date: todayDate,
      startAt: startTime,
      status: "success",
      retryCount: 0,
    }).returning({ id: automationLogTable.id });
    logId = log.id;

    // 1. Check Authorization (คงเดิม)
    const authHeader = request.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return new Response("Unauthorized", { status: 401 });
    }

    // 2. Cleanup ของเก่า (คงเดิม)
    const cleanupResult = await cleanupExpiredOvertime();

    // 3. ดึง OT ที่ยัง pending ทั้งหมด (คงเดิม)
    // จุดนี้คือการดึงข้อมูลทั้งหมดที่ "มองเห็น" ในขณะนั้นมาไว้บน Memory เพื่อเตรียม Process
    const pendingOTs = await db
      .select()
      .from(overtimeTable)
      .where(eq(overtimeTable.status, "pending"));

    let autoExecutedCount = 0;
    let matchCount = 0; 

    for (const rawOT of pendingOTs) {
      // 4. หา request ที่ match (คงเดิม)
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

      // ไม่เจอ หรือ ซ้ำ → ข้าม
      if (requests.length !== 1) continue;

      matchCount++; // นับเมื่อเจอคู่ที่ถูกต้อง
      const requestOT = requests[0];

      // 5. คำนวณ OT (คงเดิม)
      const totalRawMinutes =
        (rawOT.overtimeBefore || 0) +
        (rawOT.overtimeAfter || 0);

      const finalizedMinutes = Math.min(
        totalRawMinutes,
        requestOT.overtimeByRequest
      );

      // 6. update OT (คงเดิม)
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

      // 7. ปิด request (คงเดิม)
      await db
        .update(overtimeRequestsTable)
        .set({ status: "executed" as any })
        .where(eq(overtimeRequestsTable.id, requestOT.id));

      autoExecutedCount++;
    }

    // [LOG UPDATE] บันทึกข้อมูลสรุปทั้งหมดลง Log (ใช้จำนวนที่ Fetch มาจริงบันทึกลง readCount)
    if (logId) {
      const endTime = new Date();
      // ค่านี้คือจำนวนแถวทั้งหมดที่ API "หยิบขึ้นมาอ่าน" ในรอบนี้จริงๆ เพื่อตรวจสอบประสิทธิภาพภายใต้เวลาจำกัด
      const actualReadCount = pendingOTs.length; 
      const totalChange = (cleanupResult.expiredRawCount + cleanupResult.expiredRequestCount) + matchCount;
      
      await db.update(automationLogTable).set({
        endAt: endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
        readCount: actualReadCount, // บันทึกจำนวนที่ "กวาดสายตาอ่าน" ไปทั้งหมดในรอบนี้
        changeCount: totalChange,
        executedCount: autoExecutedCount,
        deletedCount: (cleanupResult.expiredRawCount + cleanupResult.expiredRequestCount),
        details: {
          ...cleanupResult,
          totalReadInProcess: actualReadCount, // ยืนยันยอดอ่านในรายละเอียด JSON
          autoExecutedCount,
          matchCount,
          skippedOrInvalid: actualReadCount - matchCount,
          performanceNote: `Read ${actualReadCount} rows and executed ${autoExecutedCount} rows within timeframe`
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
      },
    });

  } catch (error: any) {
    // [LOG ERROR] กรณีพังหรือ Timeout เปลี่ยนสถานะเป็น fault เพื่อแสดงผลหน้า Login
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