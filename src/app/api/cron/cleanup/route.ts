
// import { cleanupExpiredOvertime } from "@/features/over-time/overtime-status-actions";
// import { executeOTAction } from "@/features/over-time/otExecutionActions";
// import { db } from "@/db/db";
// import { overtimeTable, automationLogTable } from "@/db/schema";
// import { and, eq, gte } from "drizzle-orm";
// import { NextResponse } from "next/server";

// export const dynamic = "force-dynamic";
// export const maxDuration = 60;

// export async function GET(request: Request) {
//   const startTime = new Date();
//   const todayDate = startTime.toISOString().split("T")[0];

//   let logId: string | null = null;

//   try {
//     // 1. Authorization
//     const authHeader = request.headers.get("authorization");

//     if (
//       !process.env.CRON_SECRET ||
//       authHeader !== `Bearer ${process.env.CRON_SECRET}`
//     ) {
//       return new Response("Unauthorized", { status: 401 });
//     }

//     // 2. Create Cron Log
//     const [log] = await db
//       .insert(automationLogTable)
//       .values({
//         jobName: "ot-daily-automation",
//         date: todayDate,
//         startAt: startTime,
//         status: "success",
//         retryCount: 0,
//       })
//       .returning({ id: automationLogTable.id });

//     logId = log.id;

//     // 3. Cleanup expired OT
//     const cleanupResult = await cleanupExpiredOvertime();

//     // 4. Find pending OT attendance IDs (last 7 days)
//     const dateLimit = new Date(startTime);
//     dateLimit.setDate(dateLimit.getDate() - 7);

//     const minDate = dateLimit.toISOString().split("T")[0];

//     const pendingOTs = await db
//       .select({
//         attendanceId: overtimeTable.attendanceId,
//       })
//       .from(overtimeTable)
//       .where(
//         and(
//           eq(overtimeTable.status, "pending"),
//           gte(overtimeTable.date, minDate)
//         )
//       );

//     // One attendance should be processed only once per Cron run.
//     const attendanceIds = [
//       ...new Set(
//         pendingOTs
//           .map((ot) => ot.attendanceId)
//           .filter((id): id is string => Boolean(id))
//       ),
//     ];

//     // 5. Delegate all OT allocation and execution to otExecutionActions
//     let autoExecutedCount = 0;
//     let processedRequestCount = 0;
//     let failedCount = 0;

//     const executionResults = [];

//     for (const attendanceId of attendanceIds) {
//       try {
//         const result = await executeOTAction(
//           attendanceId,
//           "SYSTEM"
//         );

//         if (!result.success) {
//           failedCount++;

//           executionResults.push({
//             attendanceId,
//             success: false,
//             error: result.error,
//           });

//           continue;
//         }

//         autoExecutedCount +=
//           result.data?.processedOTCount ?? 0;

//         processedRequestCount +=
//           result.data?.processedRequestCount ?? 0;

//         executionResults.push({
//           attendanceId,
//           success: true,
//           data: result.data,
//         });
//       } catch (error) {
//         failedCount++;

//         executionResults.push({
//           attendanceId,
//           success: false,
//           error:
//             error instanceof Error
//               ? error.message
//               : String(error),
//         });
//       }
//     }

//     // 6. Update Cron Log
//     const endTime = new Date();

//     const totalChange =
//       cleanupResult.expiredRawCount +
//       cleanupResult.expiredRequestCount +
//       autoExecutedCount +
//       processedRequestCount;

//     await db
//       .update(automationLogTable)
//       .set({
//         status: failedCount > 0 ? "fault" : "success",
//         endAt: endTime,
//         durationMs:
//           endTime.getTime() - startTime.getTime(),

//         readCount: attendanceIds.length,
//         changeCount: totalChange,
//         executedCount: autoExecutedCount,

//         deletedCount:
//           cleanupResult.expiredRawCount +
//           cleanupResult.expiredRequestCount,

//         details: {
//           ...cleanupResult,
//           minDate,

//           pendingOTCount: pendingOTs.length,
//           attendanceCount: attendanceIds.length,

//           autoExecutedCount,
//           processedRequestCount,
//           failedCount,

//           executionResults,
//         },
//       })
//       .where(eq(automationLogTable.id, logId));

//     return NextResponse.json({
//       success: failedCount === 0,

//       message:
//         "ระบบ Cleanup และประมวลผล OT อัตโนมัติเสร็จสิ้น",

//       timestamp: endTime.toISOString(),

//       details: {
//         ...cleanupResult,
//         minDate,

//         pendingOTCount: pendingOTs.length,
//         attendanceCount: attendanceIds.length,

//         autoExecutedCount,
//         processedRequestCount,
//         failedCount,
//       },
//     });
//   } catch (error) {
//     const endTime = new Date();

//     if (logId) {
//       await db
//         .update(automationLogTable)
//         .set({
//           status: "fault",
//           endAt: endTime,
//           durationMs:
//             endTime.getTime() - startTime.getTime(),

//           details: {
//             error:
//               error instanceof Error
//                 ? error.message
//                 : String(error),

//             stack:
//               error instanceof Error
//                 ? error.stack
//                 : undefined,
//           },
//         })
//         .where(eq(automationLogTable.id, logId));
//     }

//     console.error("Cron Job Critical Error:", error);

//     return NextResponse.json(
//       {
//         success: false,
//         error: "Internal Server Error",
//         details:
//           error instanceof Error
//             ? error.message
//             : String(error),
//       },
//       { status: 500 }
//     );
//   }
// }





import { cleanupExpiredOvertime } from "@/features/over-time/overtime-status-actions";
import { executeOTAction } from "@/features/over-time/otExecutionActions";
import { db } from "@/db/db";
import { overtimeTable, automationLogTable } from "@/db/schema";
import { eq } from "drizzle-orm";
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

    // 3. Cleanup expired OT only
    const cleanupResult = await cleanupExpiredOvertime();

    // 4. Find all pending OT without date restriction
    const pendingOTs = await db
      .select({
        attendanceId: overtimeTable.attendanceId,
      })
      .from(overtimeTable)
      .where(eq(overtimeTable.status, "pending"));

    // Process each attendance only once per Cron run
    const attendanceIds = [
      ...new Set(
        pendingOTs
          .map((ot) => ot.attendanceId)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    // 5. Delegate OT processing to executeOTAction
    let autoExecutedCount = 0;
    let processedRequestCount = 0;
    let failedCount = 0;

    const executionResults = [];

    for (const attendanceId of attendanceIds) {
      try {
        const result = await executeOTAction(
          attendanceId,
          "SYSTEM"
        );

        if (!result.success) {
          failedCount++;

          executionResults.push({
            attendanceId,
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
          attendanceId,
          success: true,
          data: result.data,
        });
      } catch (error) {
        failedCount++;

        executionResults.push({
          attendanceId,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        });
      }
    }

    // 6. Update Cron Log
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
          attendanceCount: attendanceIds.length,

          autoExecutedCount,
          processedRequestCount,
          failedCount,

          executionResults,
        },
      })
      .where(eq(automationLogTable.id, logId));

    return NextResponse.json({
      success: failedCount === 0,

      message:
        "ระบบ Cleanup และประมวลผล OT อัตโนมัติเสร็จสิ้น",

      timestamp: endTime.toISOString(),

      details: {
        ...cleanupResult,

        dateFilter: "none",

        pendingOTCount: pendingOTs.length,
        attendanceCount: attendanceIds.length,

        autoExecutedCount,
        processedRequestCount,
        failedCount,
      },
    });
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
