
"use server";

import { db } from "@/db/db";
import {
  overtimeTable,
  overtimeRequestsTable,
  automationLogTable,
  attendanceTable,
  shiftsTable,
} from "@/db/schema";
import {
  eq,
  and,
  inArray,
  isNull,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * แปลง HH:mm เป็นนาที
 */
const toMinutes = (time: string): number => {
  const normalizedTime = time.trim().substring(0, 5);
  const [hours, minutes] = normalizedTime.split(":").map(Number);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(`รูปแบบเวลาไม่ถูกต้อง: ${time}`);
  }

  return hours * 60 + minutes;
};

type OTType = "before" | "after" | "invalid";

/**
 * จำแนกประเภท OT ตามเวลาเริ่มงานและเลิกงานของ Shift
 */
const getOTType = (
  timeStart: string,
  timeEnd: string,
  shiftStartMinutes: number,
  shiftEndMinutes: number
): OTType => {
  const startMinutes = toMinutes(timeStart);
  let endMinutes = toMinutes(timeEnd);

  // รองรับ OT ข้ามเที่ยงคืน
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  // OT ก่อนเริ่มงาน
  if (
    startMinutes < shiftStartMinutes &&
    endMinutes <= shiftStartMinutes
  ) {
    return "before";
  }

  // OT หลังเลิกงาน
  if (
    startMinutes >= shiftEndMinutes &&
    endMinutes > shiftEndMinutes
  ) {
    return "after";
  }

  return "invalid";
};

/**
 * API: Execute OT
 *
 * - ดึง OT Pending ของ User + Date
 * - JOIN Attendance กับ Shift
 * - แยก Request Before / After
 * - คำนวณ OT แต่ละรายการแยกจากกัน
 * - ไม่หักยอด Request สะสมระหว่าง OT
 * - Update OT และ Request
 */
export async function executeOTAction(
  attendanceId: string,
  adminId: string
) {
  const startTime = new Date();
  const todayDate = startTime.toISOString().split("T")[0];

  let logId: string | null = null;

  try {
    // =====================================================
    // 0. CREATE AUTOMATION LOG
    // =====================================================

    const [log] = await db
      .insert(automationLogTable)
      .values({
        jobName: "manual-ot-execution",
        date: todayDate,
        startAt: startTime,
        status: "success",
        retryCount: 0,
      })
      .returning({
        id: automationLogTable.id,
      });

    logId = log.id;

    // =====================================================
    // 1. FIND SELECTED OT
    // =====================================================

    const [rawOT] = await db
      .select()
      .from(overtimeTable)
      .where(
        and(
          eq(overtimeTable.attendanceId, attendanceId),
          eq(overtimeTable.status, "pending")
        )
      )
      .limit(1);

    if (!rawOT) {
      throw new Error("ไม่พบ OT ที่เป็น pending");
    }

    if (!rawOT.userId || !rawOT.date) {
      throw new Error("ข้อมูล User ID หรือ OT Date ไม่ถูกต้อง");
    }

    // =====================================================
    // 2. PROCESS ALL RELATED DATA IN TRANSACTION
    // =====================================================

    const result = await db.transaction(async (tx) => {

      // -------------------------------------------------
      // 2.1 FIND ALL ATTENDANCES + SHIFT OF USER / DATE
      // -------------------------------------------------

      const attendances = await tx
        .select({
          id: attendanceTable.id,
          userId: attendanceTable.user_id,
          date: attendanceTable.date,

          shiftId: shiftsTable.id,
          shiftStartTime: shiftsTable.startTime,
          shiftEndTime: shiftsTable.endTime,
        })
        .from(attendanceTable)
        .innerJoin(
          shiftsTable,
          eq(
            attendanceTable.shift_id,
            shiftsTable.id
          )
        )
        .where(
          and(
            eq(
              attendanceTable.user_id,
              rawOT.userId!
            ),
            eq(
              attendanceTable.date,
              rawOT.date!
            )
          )
        );

      console.log("ATTENDANCES:", {
        count: attendances.length,
        items: attendances.map((attendance) => ({
          attendanceId: attendance.id,
          userId: attendance.userId,
          date: attendance.date,
          shiftId: attendance.shiftId,
          shiftStartTime: attendance.shiftStartTime,
          shiftEndTime: attendance.shiftEndTime,
        })),
      });

      if (attendances.length === 0) {
        throw new Error(
          "ไม่พบ Attendance หรือ Shift ของ User และวันที่นี้"
        );
      }

      // -------------------------------------------------
      // 2.2 CREATE ATTENDANCE MAP
      // -------------------------------------------------

      const attendanceMap = new Map(
        attendances.map((attendance) => [
          attendance.id,
          attendance,
        ])
      );

      const attendanceIds = attendances.map(
        (attendance) => attendance.id
      );

      const shiftIds = [
        ...new Set(
          attendances.map(
            (attendance) => attendance.shiftId
          )
        ),
      ];

      // -------------------------------------------------
      // 2.3 GET ALL PENDING OTS
      // -------------------------------------------------

      const rawOTs = await tx
        .select()
        .from(overtimeTable)
        .where(
          and(
            eq(
              overtimeTable.userId,
              rawOT.userId!
            ),
            eq(
              overtimeTable.date,
              rawOT.date!
            ),
            eq(
              overtimeTable.status,
              "pending"
            ),
            inArray(
              overtimeTable.attendanceId,
              attendanceIds
            )
          )
        );

      console.log("RAW OTS:", {
        count: rawOTs.length,
        items: rawOTs.map((ot) => ({
          id: ot.id,
          attendanceId: ot.attendanceId,
          userId: ot.userId,
          date: ot.date,
          status: ot.status,
          timeStart: ot.timeStart,
          timeEnd: ot.timeEnd,
          overtimeBefore: ot.overtimeBefore,
          overtimeAfter: ot.overtimeAfter,
        })),
      });

      if (rawOTs.length === 0) {
        throw new Error(
          "ไม่พบ OT Pending ของ User และวันที่นี้"
        );
      }

      // -------------------------------------------------
      // 2.4 GET ALL APPROVED REQUESTS
      // -------------------------------------------------

      const requests = await tx
        .select()
        .from(overtimeRequestsTable)
        .where(
          and(
            eq(
              overtimeRequestsTable.userId,
              rawOT.userId!
            ),
            eq(
              overtimeRequestsTable.date,
              rawOT.date!
            ),
            eq(
              overtimeRequestsTable.status,
              "approved"
            ),
            isNull(
              overtimeRequestsTable.deletedAt
            ),
            inArray(
              overtimeRequestsTable.shiftId,
              shiftIds
            )
          )
        );

      console.log("REQUESTS:", {
        count: requests.length,
        items: requests.map((request) => ({
          id: request.id,
          shiftId: request.shiftId,
          timeStart: request.timeStart,
          timeEnd: request.timeEnd,
          overtimeByRequest: request.overtimeByRequest,
          status: request.status,
        })),
      });

      // =====================================================
      // 3. PREPARE REQUEST POOLS BY SHIFT
      // =====================================================

      type RequestItem = {
        request: (typeof requests)[number];
        requestedMinutes: number;
      };

      type RequestPool = {
        before: RequestItem[];
        after: RequestItem[];
      };

      const requestPoolByShift = new Map<
        string,
        RequestPool
      >();

      // สร้าง Pool แยกตาม Shift
      for (const shiftId of shiftIds) {
        requestPoolByShift.set(shiftId, {
          before: [],
          after: [],
        });
      }

      for (const request of requests) {
        const shift = attendances.find(
          (attendance) =>
            attendance.shiftId === request.shiftId
        );

        if (!shift) {
          continue;
        }

        const shiftStartMinutes = toMinutes(
          String(shift.shiftStartTime)
        );

        const shiftEndMinutes = toMinutes(
          String(shift.shiftEndTime)
        );

        const type = getOTType(
          String(request.timeStart),
          String(request.timeEnd),
          shiftStartMinutes,
          shiftEndMinutes
        );

        const pool = requestPoolByShift.get(
          request.shiftId
        );

        if (!pool) {
          continue;
        }

        const requestedMinutes = Number(
          request.overtimeByRequest || 0
        );

        if (
          !Number.isFinite(requestedMinutes) ||
          requestedMinutes < 0
        ) {
          throw new Error(
            `ยอด Request ไม่ถูกต้อง: ${request.id}`
          );
        }

        const requestItem: RequestItem = {
          request,
          requestedMinutes,
        };

        if (requestedMinutes === 0) {
          continue;
        }

        if (type === "before") {
          pool.before.push(requestItem);
        } else if (type === "after") {
          pool.after.push(requestItem);
        } else {
          console.warn(
            "INVALID REQUEST TIME:",
            request.id
          );
        }
      }

      console.log("REQUEST POOLS:", {
        items: Array.from(
          requestPoolByShift.entries()
        ).map(([shiftId, pool]) => ({
          shiftId,
          before: pool.before.map((item) => ({
            id: item.request.id,
            requestedMinutes: item.requestedMinutes,
          })),
          after: pool.after.map((item) => ({
            id: item.request.id,
            requestedMinutes: item.requestedMinutes,
          })),
        })),
      });

      // =====================================================
      // 4. PREPARE PROCESS VARIABLES
      // =====================================================

      const updatedOTs: (typeof rawOTs)[number][] = [];

      const executedRequestIds = new Set<string>();

      let totalRawMinutes = 0;
      let totalApprovedMinutes = 0;

      /**
       * จัดสรรนาที OT จาก Request Pool
       *
       * - ใช้ยอด Request ตั้งต้นทุกครั้ง
       * - ไม่แก้ไข requestedMinutes
       * - ไม่หักยอด Request ระหว่าง OT แต่ละรายการ
       * - คืนค่าเฉพาะ approvedMinutes
       */
      const allocateMinutes = (
        targetMinutes: number,
        requestPool: RequestItem[]
      ): number => {
        let remainingOTMinutes = targetMinutes;
        let approvedMinutes = 0;

        for (const item of requestPool) {
          if (remainingOTMinutes <= 0) {
            break;
          }

          const allocatedMinutes = Math.min(
            remainingOTMinutes,
            item.requestedMinutes
          );

          if (allocatedMinutes <= 0) {
            continue;
          }

          approvedMinutes += allocatedMinutes;
          remainingOTMinutes -= allocatedMinutes;

          // เก็บ Request ที่ถูกนำมาใช้
          executedRequestIds.add(
            item.request.id
          );

          console.log("ALLOCATE REQUEST:", {
            requestId: item.request.id,
            targetMinutes,
            requestedMinutes: item.requestedMinutes,
            allocatedMinutes,
            remainingOTMinutes,
          });
        }

        return approvedMinutes;
      };

      // =====================================================
      // 5. PROCESS EACH OT
      // =====================================================

      for (const ot of rawOTs) {
        const attendance = attendanceMap.get(
          ot.attendanceId
        );

        if (!attendance) {
          throw new Error(
            `ไม่พบ Attendance ของ OT: ${ot.id}`
          );
        }

        // -------------------------------------------------
        // 5.1 GET SHIFT TIME FROM DATABASE
        // -------------------------------------------------

        const shiftStartMinutes = toMinutes(
          String(attendance.shiftStartTime)
        );

        const shiftEndMinutes = toMinutes(
          String(attendance.shiftEndTime)
        );

        // -------------------------------------------------
        // 5.2 GET OT MINUTES SEPARATELY
        // -------------------------------------------------

        const otBefore = Number(
          ot.overtimeBefore || 0
        );

        const otAfter = Number(
          ot.overtimeAfter || 0
        );

        if (
          !Number.isFinite(otBefore) ||
          !Number.isFinite(otAfter) ||
          otBefore < 0 ||
          otAfter < 0
        ) {
          throw new Error(
            `ยอด OT ไม่ถูกต้อง: ${ot.id}`
          );
        }

        const rawMinutes = otBefore + otAfter;

        totalRawMinutes += rawMinutes;

        // -------------------------------------------------
        // 5.3 GET REQUEST POOL BY SHIFT
        // -------------------------------------------------

        const activeRequestPool =
          requestPoolByShift.get(
            attendance.shiftId
          );

        if (!activeRequestPool) {
          throw new Error(
            `ไม่พบ Request Pool ของ Shift: ${attendance.shiftId}`
          );
        }

        // -------------------------------------------------
        // 5.4 ALLOCATE BEFORE / AFTER SEPARATELY
        // -------------------------------------------------

        // Before ใช้เฉพาะ Request Before
        const approvedBefore = otBefore > 0
          ? allocateMinutes(
              otBefore,
              activeRequestPool.before
            )
          : 0;

        // After ใช้เฉพาะ Request After
        const approvedAfter = otAfter > 0
          ? allocateMinutes(
              otAfter,
              activeRequestPool.after
            )
          : 0;

        // ผลรวม Approved ของ OT รายการนี้
        const approvedMinutes =
          approvedBefore + approvedAfter;

        totalApprovedMinutes += approvedMinutes;

        // -------------------------------------------------
        // 5.5 DEBUG
        // -------------------------------------------------

        console.log("PROCESS OT:", {
          id: ot.id,
          attendanceId: ot.attendanceId,
          shiftId: attendance.shiftId,

          shiftStartMinutes,
          shiftEndMinutes,

          before: {
            rawMinutes: otBefore,
            requestMinutes: activeRequestPool.before.reduce(
              (sum, item) => sum + item.requestedMinutes,
              0
            ),
            approvedMinutes: approvedBefore,
          },

          after: {
            rawMinutes: otAfter,
            requestMinutes: activeRequestPool.after.reduce(
              (sum, item) => sum + item.requestedMinutes,
              0
            ),
            approvedMinutes: approvedAfter,
          },

          rawMinutes,
          approvedMinutes,
        });

        // -------------------------------------------------
        // 5.6 UPDATE OT
        // -------------------------------------------------

        const [updated] = await tx
          .update(overtimeTable)
          .set({
            overtimeApproved: approvedMinutes,
            status: "approved",
          })
          .where(
            and(
              eq(
                overtimeTable.id,
                ot.id
              ),
              eq(
                overtimeTable.status,
                "pending"
              )
            )
          )
          .returning();

        if (!updated) {
          throw new Error(
            `OT ${ot.id} ถูก process ไปแล้ว (race condition)`
          );
        }

        updatedOTs.push(updated);
      }

      // =====================================================
      // 6. UPDATE EXECUTED REQUESTS
      // =====================================================

      for (const requestId of executedRequestIds) {
        const [updatedRequest] = await tx
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
          )
          .returning({
            id: overtimeRequestsTable.id,
          });

        if (!updatedRequest) {
          throw new Error(
            `Request ${requestId} ถูกเปลี่ยนสถานะไปแล้ว`
          );
        }
      }

      // =====================================================
      // 7. RETURN TRANSACTION RESULT
      // =====================================================

      return {
        totalRawMinutes,
        totalApprovedMinutes,
        attendanceCount: attendances.length,
        requestCount: requests.length,
        processedOTCount: updatedOTs.length,
        processedRequestCount: executedRequestIds.size,
        updatedOTs,
      };
    });

    // =====================================================
    // 8. UPDATE SUCCESS LOG
    // =====================================================

    if (logId) {
      const endTime = new Date();

      await db
        .update(automationLogTable)
        .set({
          endAt: endTime,
          durationMs:
            endTime.getTime() - startTime.getTime(),
          readCount:
            result.attendanceCount +
            result.processedOTCount +
            result.requestCount,
          changeCount:
            result.processedOTCount +
            result.processedRequestCount,
          executedCount:
            result.processedOTCount,
          details: {
            attendanceId,
            rawMinutes: result.totalRawMinutes,
            approvedMinutes: result.totalApprovedMinutes,
            attendanceCount: result.attendanceCount,
            processedOTCount: result.processedOTCount,
            processedRequestCount: result.processedRequestCount,
            adminId,
          },
        })
        .where(
          eq(
            automationLogTable.id,
            logId
          )
        );
    }

    revalidatePath("/admin/ot-management");

    return {
      success: true,
      data: {
        rawMinutes: result.totalRawMinutes,
        approvedMinutes: result.totalApprovedMinutes,
        processedOTCount: result.processedOTCount,
        processedRequestCount: result.processedRequestCount,
        userName: rawOT.userName,
      },
    };

  } catch (error: any) {

    // =====================================================
    // 9. UPDATE FAILURE LOG
    // =====================================================

    if (logId) {
      await db
        .update(automationLogTable)
        .set({
          status: "fault",
          details: {
            error: error.message,
            attendanceId,
            adminId,
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
      "OT Execution Failed:",
      error.message
    );

    return {
      success: false,
      error: error.message,
    };
  }
}
