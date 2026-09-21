// src/app/api/cron/cleanup/route.ts

import { cleanupExpiredOvertime } from "@/features/over-time/overtime-status-actions";
import { db } from "@/db/db";
import {
  overtimeTable,
  overtimeRequestsTable,
  automationLogTable,
} from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const startTime = new Date();
  const todayDate = startTime.toISOString().split("T")[0];
  let logId: string | null = null;

  try {
    // [LOG START]
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

    // ---------------------------------------------------------
    // 3. ดึง OT pending ที่ยังอยู่ในช่วง 7 วันล่าสุด
    // ---------------------------------------------------------
    const dateLimit = new Date(startTime);
    dateLimit.setDate(dateLimit.getDate() - 7);

    const minDate = dateLimit.toISOString().split("T")[0];

    const pendingOTs = await db
      .select()
      .from(overtimeTable)
      .where(
        and(
          eq(overtimeTable.status, "pending"),
          gte(overtimeTable.date, minDate)
        )
      );

    console.log("PENDING OTS:", {
      count: pendingOTs.length,
      minDate,
      items: pendingOTs.map((ot) => ({
        id: ot.id,
        attendanceId: ot.attendanceId,
        userId: ot.userId,
        date: ot.date,
        status: ot.status,
        overtimeBefore: ot.overtimeBefore,
        overtimeAfter: ot.overtimeAfter,
      })),
    });

    let autoExecutedCount = 0;
    let matchCount = 0;
    let skippedCount = 0;
    let processedGroupCount = 0;
    let processedRequestCount = 0;

    // ---------------------------------------------------------
    // 4. จัดกลุ่ม OT ตาม User + Date
    // ---------------------------------------------------------
    const groupedOTs = new Map<
      string,
      typeof pendingOTs
    >();

    for (const ot of pendingOTs) {
      if (!ot.userId || !ot.date) {
        skippedCount++;

        console.log("SKIP INVALID OT:", {
          id: ot.id,
          attendanceId: ot.attendanceId,
          userId: ot.userId,
          date: ot.date,
        });

        continue;
      }

      const groupKey = `${ot.userId}_${ot.date}`;

      const group = groupedOTs.get(groupKey);

      if (group) {
        group.push(ot);
      } else {
        groupedOTs.set(groupKey, [ot]);
      }
    }

    console.log("OT GROUPS:", {
      count: groupedOTs.size,
      groups: Array.from(groupedOTs.entries()).map(
        ([key, ots]) => ({
          key,
          otCount: ots.length,
          attendanceIds: ots.map(
            (ot) => ot.attendanceId
          ),
        })
      ),
    });

    // ---------------------------------------------------------
    // 5. Process ทีละ User + Date
    // ---------------------------------------------------------
    for (const [groupKey, rawOTs] of groupedOTs) {
      const firstOT = rawOTs[0];

      if (!firstOT.userId || !firstOT.date) {
        skippedCount++;
        continue;
      }

      console.log("PROCESS GROUP:", {
        groupKey,
        userId: firstOT.userId,
        date: firstOT.date,
        otCount: rawOTs.length,
        attendanceIds: rawOTs.map(
          (ot) => ot.attendanceId
        ),
      });

      // -------------------------------------------------------
      // 6. ดึง Request approved ทั้งหมดของ User + Date
      // -------------------------------------------------------
      const requests = await db
        .select()
        .from(overtimeRequestsTable)
        .where(
          and(
            eq(
              overtimeRequestsTable.userId,
              firstOT.userId
            ),
            eq(
              overtimeRequestsTable.date,
              firstOT.date
            ),
            eq(
              overtimeRequestsTable.status,
              "approved"
            )
          )
        );

      if (requests.length === 0) {
        skippedCount++;

        console.log(
          `SKIP GROUP: User ${firstOT.userId} | Date ${firstOT.date} | No approved requests`
        );

        continue;
      }

      console.log("GROUP REQUESTS:", {
        groupKey,
        requestCount: requests.length,
        totalRequestedMinutes: requests.reduce(
          (sum, req) =>
            sum +
            Number(req.overtimeByRequest || 0),
          0
        ),
      });

      // -------------------------------------------------------
      // 7. เตรียม Request Pool
      // -------------------------------------------------------
      const requestPool = requests.map(
        (requestItem) => ({
          request: requestItem,
          remainingMinutes: Number(
            requestItem.overtimeByRequest || 0
          ),
        })
      );

      const executedRequestIds: string[] = [];

      // -------------------------------------------------------
      // 8. Loop OT ทุก attendanceId ของ User + Date
      // -------------------------------------------------------
      for (const rawOT of rawOTs) {
        console.log("PROCESS OT:", {
          id: rawOT.id,
          attendanceId: rawOT.attendanceId,
          userId: rawOT.userId,
          date: rawOT.date,
        });

        const totalRawMinutes =
          Number(rawOT.overtimeBefore || 0) +
          Number(rawOT.overtimeAfter || 0);

        let remainingOTMinutes =
          totalRawMinutes;

        let approvedMinutes = 0;

        // -----------------------------------------------------
        // 9. Allocate Request ให้ OT ตัวนี้
        // -----------------------------------------------------
        for (const requestItem of requestPool) {
          if (
            remainingOTMinutes <= 0 ||
            requestItem.remainingMinutes <= 0
          ) {
            continue;
          }

          const allocatedMinutes = Math.min(
            remainingOTMinutes,
            requestItem.remainingMinutes
          );

          approvedMinutes +=
            allocatedMinutes;

          remainingOTMinutes -=
            allocatedMinutes;

          requestItem.remainingMinutes -=
            allocatedMinutes;

          // Request ตัวนี้ถูกใช้หมด
          if (
            requestItem.remainingMinutes === 0
          ) {
            executedRequestIds.push(
              requestItem.request.id
            );
          }
        }

        console.log("OT CALCULATION:", {
          id: rawOT.id,
          attendanceId: rawOT.attendanceId,
          rawMinutes: totalRawMinutes,
          approvedMinutes,
          remainingOTMinutes,
        });

        // -----------------------------------------------------
        // 10. Update OT ตัวนี้
        // -----------------------------------------------------
        const [updated] = await db
          .update(overtimeTable)
          .set({
            overtimeApproved:
              approvedMinutes,
            status: "approved",
          })
          .where(
            and(
              eq(
                overtimeTable.id,
                rawOT.id
              ),
              eq(
                overtimeTable.status,
                "pending"
              )
            )
          )
          .returning();

        if (!updated) {
          skippedCount++;

          console.log(
            `RACE: OT ID ${rawOT.id} | Attendance ${rawOT.attendanceId} was updated elsewhere`
          );

          continue;
        }

        autoExecutedCount++;

        console.log(
          `EXECUTED: OT ID ${rawOT.id} | Attendance ${rawOT.attendanceId} | Raw ${totalRawMinutes} min | Approved ${approvedMinutes} min`
        );
      }

      // -------------------------------------------------------
      // 11. ปิด Request ที่ถูกใช้จนหมด
      // -------------------------------------------------------
      const uniqueExecutedRequestIds = [
        ...new Set(executedRequestIds),
      ];

      for (const requestId of uniqueExecutedRequestIds) {
        await db
          .update(overtimeRequestsTable)
          .set({
            status: "executed" as any,
          })
          .where(
            and(
              eq(
                overtimeRequestsTable.id,
                requestId
              ),
              eq(
                overtimeRequestsTable.status,
                "approved"
              )
            )
          );
      }

      processedRequestCount +=
        uniqueExecutedRequestIds.length;

      processedGroupCount++;
      matchCount++;

      console.log("GROUP COMPLETE:", {
        groupKey,
        processedOTCount: rawOTs.length,
        processedRequestCount:
          uniqueExecutedRequestIds.length,
        attendanceIds: rawOTs.map(
          (ot) => ot.attendanceId
        ),
      });
    }

    // ---------------------------------------------------------
    // 12. LOG UPDATE
    // ---------------------------------------------------------
    if (logId) {
      const endTime = new Date();

      const totalChange =
        cleanupResult.expiredRawCount +
        cleanupResult.expiredRequestCount +
        autoExecutedCount +
        processedRequestCount;

      await db
        .update(automationLogTable)
        .set({
          endAt: endTime,
          durationMs:
            endTime.getTime() -
            startTime.getTime(),

          readCount:
            pendingOTs.length +
            processedRequestCount,

          changeCount: totalChange,

          executedCount:
            autoExecutedCount,

          deletedCount:
            cleanupResult.expiredRawCount +
            cleanupResult.expiredRequestCount,

          details: {
            ...cleanupResult,

            minDate,

            totalReadInProcess:
              pendingOTs.length,

            processedGroupCount,

            autoExecutedCount,

            matchCount,

            processedRequestCount,

            skippedOrInvalid:
              skippedCount,

            performanceNote:
              `Read ${pendingOTs.length} OT rows | Groups ${processedGroupCount} | Executed ${autoExecutedCount} OT | Executed ${processedRequestCount} Requests | Skipped ${skippedCount}`,
          },
        })
        .where(
          eq(
            automationLogTable.id,
            logId
          )
        );
    }

    return NextResponse.json({
      success: true,

      message:
        "ระบบทำความสะอาดและประมวลผล OT อัตโนมัติเสร็จสิ้น",

      timestamp:
        new Date().toISOString(),

      details: {
        ...cleanupResult,

        minDate,

        autoExecutedCount,

        processedGroupCount,

        processedRequestCount,

        readCount:
          pendingOTs.length,

        skippedCount,
      },
    });
  } catch (error: any) {
    if (logId) {
      await db
        .update(automationLogTable)
        .set({
          status: "fault",
          details: {
            error: error.message,
            stack: error.stack,
          },
        })
        .where(
          eq(
            automationLogTable.id,
            logId
          )
        );
    }

    console.error(
      "🚨 Cron Job Critical Error:",
      error
    );

    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error.message,
      },
      { status: 500 }
    );
  }
}