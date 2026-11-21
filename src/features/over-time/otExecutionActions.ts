
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
  asc,
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
 * Execute OT
 *
 * - ค้นหา OT ที่ pending หรือ approved และ overtimeApproved = 0
 * - รวม OT และ Request ภายใน Shift เดียวกัน
 * - แยกคำนวณ Before / After
 * - Approved ไม่เกินยอด Request รวม
 * - Approved ไม่เกินยอด OT จริงรวม
 * - กระจาย Approved กลับไปยัง OT แต่ละรายการ
 * - บันทึก Before + After ลง overtimeApproved ช่องเดียว
 * - เปลี่ยน Request ที่ถูกนำมาใช้เป็น executed
 * - Update OT และ Request ภายใน Transaction
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
          inArray(overtimeTable.status, [
            "pending",
            "approved",
          ]),
          eq(overtimeTable.overtimeApproved, 0)
        )
      )
      .limit(1);

    if (!rawOT) {
      throw new Error(
        "ไม่พบ OT ที่เป็น pending หรือ approved และยังไม่ได้คำนวณ"
      );
    }

    if (!rawOT.userId || !rawOT.date) {
      throw new Error(
        "ข้อมูล User ID หรือ OT Date ไม่ถูกต้อง"
      );
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
              rawOT.userId
            ),
            eq(
              attendanceTable.date,
              rawOT.date
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
      // 2.3 GET ALL ELIGIBLE OTS
      // -------------------------------------------------

      const rawOTs = await tx
        .select()
        .from(overtimeTable)
        .where(
          and(
            eq(
              overtimeTable.userId,
              rawOT.userId
            ),
            eq(
              overtimeTable.date,
              rawOT.date
            ),
            inArray(
              overtimeTable.status,
              [
                "pending",
                "approved",
              ]
            ),
            eq(
              overtimeTable.overtimeApproved,
              0
            ),
            inArray(
              overtimeTable.attendanceId,
              attendanceIds
            )
          )
        )
        .orderBy(
          asc(overtimeTable.id)
        );

      console.log("RAW OTS:", {
        count: rawOTs.length,
        items: rawOTs.map((ot) => ({
          id: ot.id,
          attendanceId: ot.attendanceId,
          userId: ot.userId,
          date: ot.date,
          status: ot.status,
          overtimeApproved: ot.overtimeApproved,
          overtimeBefore: ot.overtimeBefore,
          overtimeAfter: ot.overtimeAfter,
        })),
      });

      if (rawOTs.length === 0) {
        throw new Error(
          "ไม่พบ OT ที่เป็น pending หรือ approved และยังไม่ได้คำนวณ"
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
              rawOT.userId
            ),
            eq(
              overtimeRequestsTable.date,
              rawOT.date
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
        )
        .orderBy(
          asc(overtimeRequestsTable.timeStart),
          asc(overtimeRequestsTable.id)
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

      type OTItem = {
        ot: (typeof rawOTs)[number];
        minutes: number;
      };

      type OTGroup = {
        before: OTItem[];
        after: OTItem[];
      };

      const requestPoolByShift = new Map<
        string,
        RequestPool
      >();

      for (const shiftId of shiftIds) {
        requestPoolByShift.set(shiftId, {
          before: [],
          after: [],
        });
      }

      // -------------------------------------------------
      // 3.1 CLASSIFY REQUESTS
      // -------------------------------------------------

      const attendanceByShift = new Map(
        attendances.map((attendance) => [
          attendance.shiftId,
          attendance,
        ])
      );

      for (const request of requests) {
        if (!request.shiftId) {
          continue;
        }

        const shift = attendanceByShift.get(
          request.shiftId
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
          request.overtimeByRequest
        );

        if (
          !Number.isFinite(requestedMinutes) ||
          requestedMinutes < 0
        ) {
          throw new Error(
            `ยอด Request ไม่ถูกต้อง: ${request.id}`
          );
        }

        if (requestedMinutes === 0) {
          continue;
        }

        const requestItem: RequestItem = {
          request,
          requestedMinutes,
        };

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

      const approvedByOT = new Map<string, number>();

      let totalRawMinutes = 0;
      let totalApprovedMinutes = 0;

      // -------------------------------------------------
      // 4.1 GROUP OT BY SHIFT
      // -------------------------------------------------

      const otGroupsByShift = new Map<
        string,
        OTGroup
      >();

      for (const shiftId of shiftIds) {
        otGroupsByShift.set(shiftId, {
          before: [],
          after: [],
        });
      }

      for (const ot of rawOTs) {
        if (!ot.attendanceId) {
          throw new Error(
            `OT ${ot.id} ไม่มี Attendance ID`
          );
        }

        const attendance = attendanceMap.get(
          ot.attendanceId
        );

        if (!attendance) {
          throw new Error(
            `ไม่พบ Attendance ของ OT: ${ot.id}`
          );
        }

        const otBefore = Number(
          ot.overtimeBefore
        );

        const otAfter = Number(
          ot.overtimeAfter
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

        const group = otGroupsByShift.get(
          attendance.shiftId
        );

        if (!group) {
          throw new Error(
            `ไม่พบ OT Group ของ Shift: ${attendance.shiftId}`
          );
        }

        if (otBefore > 0) {
          group.before.push({
            ot,
            minutes: otBefore,
          });
        }

        if (otAfter > 0) {
          group.after.push({
            ot,
            minutes: otAfter,
          });
        }
      }

      // =====================================================
      // 5. AGGREGATE AND ALLOCATE OT
      // =====================================================

      /**
       * กระจาย Approved กลับไปยัง OT
       * ตามลำดับ UUID ที่ Query จัดเรียงไว้
       */
      const distributeApproved = (
        items: OTItem[],
        totalApproved: number
      ) => {
        let remainingMinutes = totalApproved;

        for (const item of items) {
          if (remainingMinutes <= 0) {
            break;
          }

          const allocatedMinutes = Math.min(
            item.minutes,
            remainingMinutes
          );

          if (allocatedMinutes <= 0) {
            continue;
          }

          const currentApproved =
            approvedByOT.get(item.ot.id) || 0;

          approvedByOT.set(
            item.ot.id,
            currentApproved + allocatedMinutes
          );

          remainingMinutes -= allocatedMinutes;

          console.log("DISTRIBUTE OT:", {
            otId: item.ot.id,
            rawMinutes: item.minutes,
            allocatedMinutes,
            remainingMinutes,
          });
        }
      };

      /**
       * เก็บ Request ที่ถูกนำมาใช้จริง
       *
       * หากใช้ Request เพียงบางส่วน
       * จะเปลี่ยนสถานะทั้ง Request เป็น executed
       */
      const collectExecutedRequests = (
        requestPool: RequestItem[],
        totalApproved: number
      ) => {
        let remainingMinutes = totalApproved;

        for (const item of requestPool) {
          if (remainingMinutes <= 0) {
            break;
          }

          const allocatedMinutes = Math.min(
            item.requestedMinutes,
            remainingMinutes
          );

          if (allocatedMinutes <= 0) {
            continue;
          }

          executedRequestIds.add(
            item.request.id
          );

          remainingMinutes -= allocatedMinutes;

          console.log("CONSUME REQUEST:", {
            requestId: item.request.id,
            requestedMinutes: item.requestedMinutes,
            allocatedMinutes,
            remainingMinutes,
          });
        }
      };

      // -------------------------------------------------
      // 5.1 PROCESS EACH SHIFT
      // -------------------------------------------------

      for (const [shiftId, otGroup] of otGroupsByShift) {
        const requestPool = requestPoolByShift.get(
          shiftId
        );

        if (!requestPool) {
          throw new Error(
            `ไม่พบ Request Pool ของ Shift: ${shiftId}`
          );
        }

        // BEFORE TOTALS

        const otBeforeTotal = otGroup.before.reduce(
          (sum, item) => sum + item.minutes,
          0
        );

        const requestBeforeTotal =
          requestPool.before.reduce(
            (sum, item) => sum + item.requestedMinutes,
            0
          );

        // AFTER TOTALS

        const otAfterTotal = otGroup.after.reduce(
          (sum, item) => sum + item.minutes,
          0
        );

        const requestAfterTotal =
          requestPool.after.reduce(
            (sum, item) => sum + item.requestedMinutes,
            0
          );

        // ---------------------------------------------
        // VALIDATE MATCHING REQUEST
        // ---------------------------------------------

        /**
         * Throw เฉพาะกรณี:
         * - มี OT จริง
         * - แต่ไม่มี Request ตรงกับทั้ง Before และ After
         *
         * หากมี Request ตรงเพียงด้านเดียว
         * จะอนุมัติเฉพาะด้านที่มี Request
         */
        const hasOT =
          otBeforeTotal > 0 || otAfterTotal > 0;

        const hasAnyMatchingRequest =
          requestBeforeTotal > 0 ||
          requestAfterTotal > 0;

        if (hasOT && !hasAnyMatchingRequest) {
          throw new Error(
            `ไม่สามารถอนุมัติ OT ของ Shift ${shiftId} ได้: ไม่พบ Request ที่ approved และยังไม่ถูกลบ ซึ่งตรงกับประเภท OT Before / After`
          );
        }

        // ---------------------------------------------
        // CALCULATE APPROVED TOTALS
        // ---------------------------------------------

        const approvedBeforeTotal = Math.min(
          otBeforeTotal,
          requestBeforeTotal
        );

        const approvedAfterTotal = Math.min(
          otAfterTotal,
          requestAfterTotal
        );

        // ---------------------------------------------
        // DISTRIBUTE APPROVED BACK TO OT
        // ---------------------------------------------

        distributeApproved(
          otGroup.before,
          approvedBeforeTotal
        );

        distributeApproved(
          otGroup.after,
          approvedAfterTotal
        );

        // ---------------------------------------------
        // COLLECT EXECUTED REQUESTS
        // ---------------------------------------------

        collectExecutedRequests(
          requestPool.before,
          approvedBeforeTotal
        );

        collectExecutedRequests(
          requestPool.after,
          approvedAfterTotal
        );

        console.log("SHIFT AGGREGATION:", {
          shiftId,

          before: {
            otTotal: otBeforeTotal,
            requestTotal: requestBeforeTotal,
            approvedTotal: approvedBeforeTotal,
          },

          after: {
            otTotal: otAfterTotal,
            requestTotal: requestAfterTotal,
            approvedTotal: approvedAfterTotal,
          },

          shiftRawMinutes:
            otBeforeTotal + otAfterTotal,

          shiftApprovedMinutes:
            approvedBeforeTotal + approvedAfterTotal,
        });
      }

      // =====================================================
      // 5.2 UPDATE EACH OT
      // =====================================================

      for (const ot of rawOTs) {
        const approvedMinutes =
          approvedByOT.get(ot.id) || 0;

        totalApprovedMinutes += approvedMinutes;

        console.log("PROCESS OT:", {
          id: ot.id,
          attendanceId: ot.attendanceId,
          rawBefore: Number(ot.overtimeBefore),
          rawAfter: Number(ot.overtimeAfter),
          approvedMinutes,
          previousStatus: ot.status,
        });

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
              inArray(
                overtimeTable.status,
                [
                  "pending",
                  "approved",
                ]
              ),
              eq(
                overtimeTable.overtimeApproved,
                0
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
            status: "executed",
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
              ),
              isNull(
                overtimeRequestsTable.deletedAt
              )
            )
          )
          .returning({
            id: overtimeRequestsTable.id,
          });

        if (!updatedRequest) {
          throw new Error(
            `Request ${requestId} ถูกเปลี่ยนสถานะไปแล้ว หรือถูกลบ`
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

  } catch (error: unknown) {

    // =====================================================
    // 9. UPDATE FAILURE LOG
    // =====================================================

    const errorMessage =
      error instanceof Error
        ? error.message
        : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";

    if (logId) {
      await db
        .update(automationLogTable)
        .set({
          status: "fault",
          details: {
            error: errorMessage,
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
      errorMessage
    );

    return {
      success: false,
      error: errorMessage,
    };
  }
}
