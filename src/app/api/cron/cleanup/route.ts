
import { cleanupExpiredOvertime } from "@/features/over-time/overtime-status-actions";
import { executeOTAction } from "@/features/over-time/otExecutionActions";
import { db } from "@/db/db";
import { overtimeTable, automationLogTable } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const startTime = new Date();
  const todayDate = startTime.toISOString().split("T")[0];

  let logId: string | null = null;

  try {
    // 1. Authorization
    const authHeader = request.headers.get("authorization");

    if (
      !process.env.CRON_SECRET ||
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return new Response("Unauthorized", { status: 401 });
    }

    // 2. Create Cron Log
    const [log] = await db
      .insert(automationLogTable)
      .values({
        jobName: "ot-daily-automation",
        date: todayDate,
        startAt: startTime,
        status: "success",
        retryCount: 0,
      })
      .returning({ id: automationLogTable.id });

    logId = log.id;

    // 3. Cleanup expired OT
    const cleanupResult = await cleanupExpiredOvertime();

    // 4. Find pending OT that has not been calculated
    const pendingOTs = await db
      .select({
        attendanceId: overtimeTable.attendanceId,
        userId: overtimeTable.userId,
        date: overtimeTable.date,
      })
      .from(overtimeTable)
      .where(
        and(
          eq(overtimeTable.status, "pending"),
          eq(overtimeTable.overtimeApproved, 0)
        )
      );

    // 5. Group by User + Date
    // executeOTAction processes all eligible OT
    // belonging to the same user and date.
    const groupedOTs = new Map<
      string,
      {
        userId: string;
        date: string;
        attendanceId: string;
      }
    >();

    const attendanceIds = new Set<string>();

    for (const ot of pendingOTs) {
      if (!ot.userId || !ot.date || !ot.attendanceId) {
        continue;
      }

      attendanceIds.add(ot.attendanceId);

      const key = JSON.stringify([ot.userId, ot.date]);

      if (!groupedOTs.has(key)) {
        groupedOTs.set(key, {
          userId: ot.userId,
          date: ot.date,
          attendanceId: ot.attendanceId,
        });
      }
    }

    // 6. Execute each User + Date group once
    let autoExecutedCount = 0;
    let processedRequestCount = 0;
    let failedCount = 0;

    const executionResults = [];

    for (const group of groupedOTs.values()) {
      try {
        const result = await executeOTAction(
          group.attendanceId,
          "SYSTEM"
        );

        if (!result.success) {
          failedCount++;

          executionResults.push({
            userId: group.userId,
            date: group.date,
            attendanceId: group.attendanceId,
            success: false,
            error: result.error,
          });

          continue;
        }

        autoExecutedCount +=
          result.data?.processedOTCount ?? 0;

        processedRequestCount +=
          result.data?.processedRequestCount ?? 0;

        executionResults.push({
          userId: group.userId,
          date: group.date,
          attendanceId: group.attendanceId,
          success: true,
          data: result.data,
        });
      } catch (error) {
        failedCount++;

        executionResults.push({
          userId: group.userId,
          date: group.date,
          attendanceId: group.attendanceId,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        });
      }
    }

    // 7. Update Cron Log
    const endTime = new Date();

    const totalChange =
      cleanupResult.expiredRawCount +
      cleanupResult.expiredRequestCount +
      autoExecutedCount +
      processedRequestCount;

    await db
      .update(automationLogTable)
      .set({
        status: failedCount > 0 ? "fault" : "success",
        endAt: endTime,
        durationMs:
          endTime.getTime() - startTime.getTime(),

        readCount: pendingOTs.length,
        changeCount: totalChange,
        executedCount: autoExecutedCount,

        deletedCount:
          cleanupResult.expiredRawCount +
          cleanupResult.expiredRequestCount,

        details: {
          ...cleanupResult,

          dateFilter: "none",

          pendingOTCount: pendingOTs.length,
          attendanceCount: attendanceIds.size,
          groupCount: groupedOTs.size,

          autoExecutedCount,
          processedRequestCount,
          failedCount,

          executionResults,
        },
      })
      .where(eq(automationLogTable.id, logId));

    // 8. Return actual execution status
    return NextResponse.json(
      {
        success: failedCount === 0,

        message:
          failedCount === 0
            ? "ระบบ Cleanup และประมวลผล OT สำเร็จ"
            : "มีรายการ OT ที่ประมวลผลไม่สำเร็จ",

        timestamp: endTime.toISOString(),

        details: {
          ...cleanupResult,

          dateFilter: "none",

          pendingOTCount: pendingOTs.length,
          attendanceCount: attendanceIds.size,
          groupCount: groupedOTs.size,

          autoExecutedCount,
          processedRequestCount,
          failedCount,
        },
      },
      {
        status: failedCount > 0 ? 500 : 200,
      }
    );
  } catch (error) {
    const endTime = new Date();

    if (logId) {
      await db
        .update(automationLogTable)
        .set({
          status: "fault",
          endAt: endTime,
          durationMs:
            endTime.getTime() - startTime.getTime(),

          details: {
            error:
              error instanceof Error
                ? error.message
                : String(error),

            stack:
              error instanceof Error
                ? error.stack
                : undefined,
          },
        })
        .where(eq(automationLogTable.id, logId));
    }

    console.error("Cron Job Critical Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
