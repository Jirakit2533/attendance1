import { db } from "@/db/db";
import {
  usersTable,
  attendanceTable,
  leaveTable,
  sitesTable,
  adminsTable,
  companyTable,
  positionsTable,
  departmentsTable,
  shiftsTable,
  overtimeRequestsTable,
  overtimeTable,
} from "@/db/schema";
import { getAdminContext } from "./actions";
import { desc, eq, and, or, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import AdminClientPage from "./adminClientPage";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  try {
    // 1. ตรวจสอบ Session Admin
    const cookieStore = await cookies();
    const adminId =
      cookieStore.get("session_user_id")?.value;

    if (!adminId) {
      redirect("/api/auth/logout-cleanup");
    }

    // 2. ดึงข้อมูลแอดมิน
    const currentAdmin =
      await getAdminContext();

    if (!currentAdmin) {
      redirect("/api/auth/logout-cleanup");
    }

    const companyId =
      currentAdmin.companyId;

    // 3. Fetch ข้อมูลแบบ Parallel
    const [
      rawEmployees,
      rawAttendance,
      rawLeaves,
      sitesData,
      positionsData,
      departmentsData,
      defaultShiftData,
      companyInfoData,
      rawOvertime,
      rawApprovedOvertime,
    ] = await Promise.all([
      // --- พนักงาน ---
      db
        .select({
          id: usersTable.id,
          userName: usersTable.userName,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          role: usersTable.role,
          departmentId:
            usersTable.departmentId,
          departmentName:
            departmentsTable.name,
          positionName:
            positionsTable.name,
          siteName: sitesTable.name,
          siteId: usersTable.site_id,
          positionId:
            usersTable.positionId,
          avatarUrl:
            usersTable.avatarUrl,
          startTime:
            shiftsTable.startTime,
          endTime:
            shiftsTable.endTime,
        })
        .from(usersTable)
        .leftJoin(
          sitesTable,
          eq(
            usersTable.site_id,
            sitesTable.id
          )
        )
        .leftJoin(
          positionsTable,
          eq(
            usersTable.positionId,
            positionsTable.id
          )
        )
        .leftJoin(
          departmentsTable,
          eq(
            usersTable.departmentId,
            departmentsTable.id
          )
        )
        .leftJoin(
          shiftsTable,
          eq(
            usersTable.id,
            shiftsTable.userId
          )
        )
        .where(
          and(
            or(
              eq(
                usersTable.role,
                "employee"
              ),
              eq(
                usersTable.role,
                "leader"
              )
            ),
            eq(
              usersTable.companyId,
              companyId || ""
            ),
            isNull(
              usersTable.deletedAt
            )
          )
        )
        .orderBy(
          desc(
            usersTable.created_at
          )
        ),

      // --- Attendance ---
      db
        .select({
          id: attendanceTable.id,
          date: attendanceTable.date,
          checkIn:
            attendanceTable.checkIn,
          checkOut:
            attendanceTable.checkOut,
          user_id:
            attendanceTable.user_id,
          locationIn:
            attendanceTable.locationIn,
          locationOut:
            attendanceTable.locationOut,
          imageIn:
            attendanceTable.imageIn,
          imageOut:
            attendanceTable.imageOut,
          firstName:
            usersTable.firstName,
          lastName:
            usersTable.lastName,
          siteInNameSnapshot:
            attendanceTable.siteInNameSnapshot,
          departmentNameSnapshot:
            attendanceTable.departmentNameSnapshot,
          siteName:
            sitesTable.name,
          siteIdInAttendance:
            attendanceTable.site_id,
          shiftStartTimeSnapshot:
            attendanceTable.shiftStartTimeSnapshot,
          startTime:
            shiftsTable.startTime,
          endTime:
            shiftsTable.endTime,
          isEarlyExit:
            attendanceTable.isEarlyExit,
          isLateFromDb:
            attendanceTable.isLate,
        })
        .from(attendanceTable)
        .innerJoin(
          usersTable,
          eq(
            attendanceTable.user_id,
            usersTable.id
          )
        )
        .leftJoin(
          sitesTable,
          eq(
            attendanceTable.site_id,
            sitesTable.id
          )
        )
        .leftJoin(
          shiftsTable,
          eq(
            attendanceTable.shift_id,
            shiftsTable.id
          )
        )
        .where(
          and(
            eq(
              usersTable.companyId,
              companyId || ""
            ),
            isNull(
              usersTable.deletedAt
            )
          )
        )
        .orderBy(
          desc(
            attendanceTable.date
          ),
          desc(
            attendanceTable.createdAt
          )
        ),

      // --- Leave ---
      db
        .select({
          id: leaveTable.id,
          type: leaveTable.type,
          startDate:
            leaveTable.startDate,
          endDate:
            leaveTable.endDate,
          startTime:
            leaveTable.startTime,
          endTime:
            leaveTable.endTime,
          status:
            leaveTable.status,
          reason:
            leaveTable.reason,
          remark:
            leaveTable.remark,
          fileUrl:
            leaveTable.fileUrl,
          fileName:
            leaveTable.fileName,
          firstName:
            usersTable.firstName,
          lastName:
            usersTable.lastName,
          userName:
            usersTable.userName,
          avatarUrl:
            usersTable.avatarUrl,
          totalHours:
            leaveTable.totalHours,
          createdAt:
            leaveTable.createdAt,
        })
        .from(leaveTable)
        .leftJoin(
          usersTable,
          eq(
            leaveTable.user_id,
            usersTable.id
          )
        )
        .where(
          and(
            eq(
              usersTable.companyId,
              companyId || ""
            ),
            isNull(
              usersTable.deletedAt
            )
          )
        )
        .orderBy(
          desc(
            leaveTable.createdAt
          )
        ),

      // --- Sites ---
      db
        .select()
        .from(sitesTable)
        .where(
          and(
            eq(
              sitesTable.companyId,
              companyId || ""
            ),
            isNull(
              sitesTable.deletedAt
            )
          )
        ),

      // --- Positions ---
      db
        .select()
        .from(positionsTable)
        .where(
          and(
            eq(
              positionsTable.company_id,
              companyId || ""
            ),
            isNull(
              positionsTable.deletedAt
            )
          )
        ),

      // --- Departments ---
      db
        .select()
        .from(departmentsTable)
        .where(
          and(
            eq(
              departmentsTable.companyId,
              companyId || ""
            ),
            isNull(
              departmentsTable.deletedAt
            )
          )
        ),

      // --- Default Shift ---
      db
        .select({
          startTime:
            shiftsTable.startTime,
          endTime:
            shiftsTable.endTime,
        })
        .from(shiftsTable)
        .where(
          and(
            eq(
              shiftsTable.companyId,
              companyId || ""
            ),
            isNull(
              shiftsTable.userId
            )
          )
        )
        .limit(1),

      // --- Company ---
      db
        .select()
        .from(companyTable)
        .where(
          eq(
            companyTable.id,
            companyId || ""
          )
        )
        .limit(1),

      // --- OT Requests ---
      // ไม่ JOIN overtimeTable
      db
        .select({
          requestId:
            overtimeRequestsTable.id,
          userId:
            overtimeRequestsTable.userId,
          userName:
            overtimeRequestsTable.userName,
          workingDate:
            overtimeRequestsTable.date,
          createdAt:
            overtimeRequestsTable.createdAt,
          timeStart:
            overtimeRequestsTable.timeStart,
          timeEnd:
            overtimeRequestsTable.timeEnd,
          overtimeByRequest:
            overtimeRequestsTable.overtimeByRequest,
          status:
            overtimeRequestsTable.status,

          firstName:
            usersTable.firstName,
          lastName:
            usersTable.lastName,

          employeeName:
            sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,

          avatarUrl:
            usersTable.avatarUrl,
          positionName:
            positionsTable.name,
          departmentName:
            departmentsTable.name,
        })
        .from(
          overtimeRequestsTable
        )
        .leftJoin(
          usersTable,
          eq(
            overtimeRequestsTable.userId,
            usersTable.id
          )
        )
        .leftJoin(
          positionsTable,
          eq(
            usersTable.positionId,
            positionsTable.id
          )
        )
        .leftJoin(
          departmentsTable,
          eq(
            usersTable.departmentId,
            departmentsTable.id
          )
        )
        .where(
          and(
            eq(
              overtimeRequestsTable.companyId,
              companyId || ""
            ),
            isNull(
              usersTable.deletedAt
            )
          )
        )
        .orderBy(
          desc(
            overtimeRequestsTable.createdAt
          )
        ),

      // --- OT Result ---
      // ดึง OT ที่ approved/executed แยกจาก Request
      db
        .select({
          id: overtimeTable.id,
          userId:
            overtimeTable.userId,
          date:
            overtimeTable.date,
          overtimeApproved:
            overtimeTable.overtimeApproved,
          status:
            overtimeTable.status,
        })
        .from(overtimeTable)
        .where(
          and(
            eq(
              overtimeTable.companyId,
              companyId || ""
            ),
            or(
              eq(
                overtimeTable.status,
                "approved"
              ),
              eq(
                overtimeTable.status,
                "executed"
              )
            )
          )
        ),
    ]);

    // =========================================================
    // Mapping พนักงาน
    // =========================================================
    const employees =
      (rawEmployees || []).map(
        (emp) => {
          const isUuid =
            emp?.userName &&
            emp.userName.length > 30;

          const finalUserName =
            isUuid
              ? emp.firstName?.toLowerCase()
              : emp?.userName ||
                "user";

          return {
            id: String(
              emp?.id || ""
            ),
            userName:
              finalUserName,
            username:
              finalUserName,
            firstName: String(
              emp?.firstName || ""
            ),
            lastName: String(
              emp?.lastName || ""
            ),
            employeeName:
              `${emp?.firstName || ""} ${emp?.lastName || ""}`.trim() ||
              "ไม่ระบุชื่อ",
            role: String(
              emp?.role ||
                "employee"
            ),
            departmentId:
              emp?.departmentId
                ? String(
                    emp.departmentId
                  )
                : null,
            departmentName:
              emp?.departmentName ||
              "ไม่ระบุแผนก",
            positionId:
              emp?.positionId
                ? String(
                    emp.positionId
                  )
                : null,
            positionName:
              emp?.positionName ||
              "พนักงาน",
            siteId:
              emp?.siteId
                ? String(
                    emp.siteId
                  )
                : null,
            site: String(
              emp?.siteName ||
                "ไม่ระบุ"
            ),
            siteName:
              emp?.siteName ||
              "ไม่ระบุ",
            position: String(
              emp?.positionName ||
                "พนักงาน"
            ),
            avatarUrl:
              emp?.avatarUrl ||
              null,
            startTime:
              emp?.startTime ||
              null,
            endTime:
              emp?.endTime ||
              null,
          };
        }
      );

    // =========================================================
    // Mapping Attendance
    // =========================================================
    const attendance =
      (rawAttendance || []).map(
        (at) => {
          let isLate =
            at.isLateFromDb ?? 0;

          if (
            !isLate &&
            at?.checkIn
          ) {
            const compareTime =
              at.shiftStartTimeSnapshot ||
              at.startTime;

            if (compareTime) {
              const checkInTime =
                parseInt(
                  at.checkIn.replace(
                    /:/g,
                    ""
                  ),
                  10
                );

              const startTime =
                parseInt(
                  compareTime.replace(
                    /:/g,
                    ""
                  ),
                  10
                );

              if (
                checkInTime >
                startTime
              ) {
                isLate = 1;
              }
            }
          }

          return {
            id: String(
              at?.id || ""
            ),
            date: at?.date
              ? String(at.date)
              : "",
            checkIn:
              at?.checkIn ||
              null,
            checkOut:
              at?.checkOut ||
              null,
            userId: String(
              at?.user_id || ""
            ),
            employeeName:
              `${at?.firstName || ""} ${at?.lastName || ""}`.trim() ||
              "ไม่ระบุชื่อ",
            siteSnapName:
              at?.siteInNameSnapshot ||
              at?.siteName ||
              "ทั่วไป (ไม่มีไซต์)",
            departmentSnapName:
              at?.departmentNameSnapshot ||
              "ไม่ระบุแผนก",
            siteName:
              at?.siteName ||
              "ทั่วไป (ไม่มีไซต์)",
            locationIn:
              String(
                at?.locationIn ||
                  "-"
              ),
            locationOut:
              String(
                at?.locationOut ||
                  "-"
              ),
            imageIn:
              at?.imageIn ||
              null,
            imageOut:
              at?.imageOut ||
              null,
            startTime:
              at?.shiftStartTimeSnapshot ||
              at?.startTime ||
              null,
            endTime:
              at?.endTime ||
              null,
            isLate,
            isEarlyExit:
              at.isEarlyExit
                ? String(
                    at.isEarlyExit
                  )
                : "-",
          };
        }
      );

    // =========================================================
    // รวม overtimeApproved ของ OT ทุกตัว
    // ตาม User + Date
    // =========================================================
    const approvedMinutesByUserDate =
      new Map<string, number>();

    for (
      const ot of rawApprovedOvertime ||
      []
    ) {
      const key =
        `${ot.userId}_${ot.date}`;

      const current =
        approvedMinutesByUserDate.get(
          key
        ) || 0;

      approvedMinutesByUserDate.set(
        key,
        current +
          Number(
            ot.overtimeApproved ||
              0
          )
      );
    }

    // =========================================================
    // สร้าง Request
    // 1 Request = 1 row
    // =========================================================
    const overtimeRequests =
      (rawOvertime || []).map(
        (request) => ({
          id: String(
            request.requestId ||
              ""
          ),

          userId: String(
            request.userId || ""
          ),

          userName: String(
            request.userName || ""
          ),

          firstName:
            request.firstName ||
            "",

          lastName:
            request.lastName ||
            "",

          employeeName: String(
            request.employeeName ||
              "ไม่ระบุชื่อ"
          ),

          avatarUrl:
            request.avatarUrl ||
            null,

          date:
            request.workingDate
              ? String(
                  request.workingDate
                )
              : "",

          workingDate:
            request.workingDate
              ? String(
                  request.workingDate
                )
              : "",

          timeStart:
            request.timeStart ||
            "",

          timeEnd:
            request.timeEnd ||
            "",

          startTime:
            "08:00:00",

          overtimeByRequest:
            Number(
              request.overtimeByRequest ||
                0
            ),

          overtimeBefore: 0,
          overtimeAfter: 0,

          overtimeApproved: 0,

          status: String(
            request.status ||
              "pending"
          ),

          positionName:
            request.positionName ||
            "พนักงาน",

          departmentName:
            request.departmentName ||
            "ไม่ระบุแผนก",

          requestDate:
            request.createdAt
              ? new Date(
                  request.createdAt
                ).toISOString()
              : null,

          rawCreatedAt:
            request.createdAt
              ? new Date(
                  request.createdAt
                ).getTime()
              : 0,
        })
      );

    // =========================================================
    // จัดกลุ่ม Request ตาม User + Date
    // =========================================================
    const requestGroups =
      new Map<
        string,
        typeof overtimeRequests
      >();

    for (
      const request of overtimeRequests
    ) {
      const key =
        `${request.userId}_${request.date}`;

      if (
        !requestGroups.has(
          key
        )
      ) {
        requestGroups.set(
          key,
          []
        );
      }

      requestGroups
        .get(key)!
        .push(request);
    }

    // =========================================================
    // Allocate OT จริงให้ Request
    // =========================================================
    for (
      const [
        key,
        requests,
      ] of requestGroups
    ) {
      let remainingApproved =
        approvedMinutesByUserDate.get(
          key
        ) || 0;

      // Request เก่าสุดรับยอดก่อน
      requests.sort(
        (a, b) =>
          a.rawCreatedAt -
          b.rawCreatedAt
      );

      for (
        const request of requests
      ) {
        if (
          request.status !==
            "approved" &&
          request.status !==
            "executed"
        ) {
          continue;
        }

        if (
          remainingApproved <=
          0
        ) {
          break;
        }

        const approvedForRequest =
          Math.min(
            remainingApproved,
            request.overtimeByRequest
          );

        request.overtimeApproved =
          approvedForRequest;

        remainingApproved -=
          approvedForRequest;
      }
    }

    // =========================================================
    // Final sort: ล่าสุดก่อน
    // =========================================================
    overtimeRequests.sort(
      (a, b) =>
        b.rawCreatedAt -
        a.rawCreatedAt
    );

    // =========================================================
    // Sites
    // =========================================================
    const sites =
      (sitesData || []).map(
        (s) => ({
          id: String(
            s?.id || ""
          ),
          name: String(
            s?.name || ""
          ),
          address:
            s?.address || "",
          coordinates:
            s?.coordinates || "",
        })
      );

    // =========================================================
    // Admin Profile
    // =========================================================
    const adminProfile = {
      id:
        currentAdmin?.id || "",
      name:
        `${currentAdmin?.firstName || ""} ${currentAdmin?.lastName || ""}`.trim(),
      firstName:
        currentAdmin?.firstName ||
        "",
      lastName:
        currentAdmin?.lastName ||
        "",
      userName:
        currentAdmin?.userName ||
        "",
      username:
        currentAdmin?.userName ||
        "",
      email:
        currentAdmin?.email ||
        "",
      phone:
        currentAdmin?.phone ||
        "",
      avatarUrl:
        currentAdmin?.avatarUrl ||
        null,
      company: String(
        currentAdmin?.companyName ||
          "บริษัท"
      ),
      role: "admin",
    };

    // =========================================================
    // Props
    // =========================================================
    const rawProps = {
      currentAdminId:
        adminId,

      initialEmployees:
        employees,

      initialAttendance:
        attendance,

      initialLeaves:
        (rawLeaves || []).map(
          (l) => ({
            id: String(
              l?.id || ""
            ),
            type: String(
              l?.type ||
                "ลากิจ"
            ),
            startDate:
              l?.startDate
                ? String(
                    l.startDate
                  )
                : "",
            endDate:
              l?.endDate
                ? String(
                    l.endDate
                  )
                : "",
            startTime:
              l?.startTime ||
              null,
            endTime:
              l?.endTime ||
              null,
            status: String(
              l?.status ||
                "pending"
            ),
            reason: String(
              l?.reason || ""
            ),
            remark: String(
              l?.remark || ""
            ),
            fileUrl:
              l?.fileUrl ||
              null,
            fileName:
              l?.fileName ||
              null,
            employeeName:
              `${l?.firstName || ""} ${l?.lastName || ""}`.trim() ||
              "ไม่ระบุพนักงาน",
            userName: String(
              l?.userName || ""
            ),
            avatarUrl:
              l?.avatarUrl ||
              null,
            totalHours:
              l?.totalHours ||
              0,
            createdAt:
              l?.createdAt
                ? String(
                    l.createdAt
                  )
                : null,
          })
        ),

      admin: adminProfile,

      sites,

      hasMultiSiteActive:
        sites.some(
          (s) =>
            s.name ===
            "ทุกไซต์"
        ),

      positions:
        (
          positionsData || []
        ).map(
          (p) => ({
            id: String(
              p?.id || ""
            ),
            name: String(
              p?.name || ""
            ),
          })
        ),

      departments:
        (
          departmentsData ||
          []
        ).map(
          (d) => ({
            id: String(
              d?.id || ""
            ),
            name: String(
              d?.name || ""
            ),
          })
        ),

      standardTime: {
        startTime:
          defaultShiftData?.[0]
            ?.startTime ||
          "08:00",
        endTime:
          defaultShiftData?.[0]
            ?.endTime ||
          "17:00",
      },

      initialCompanyData:
        companyInfoData?.[0] ||
        null,

      initialOvertimeRequests:
        overtimeRequests,
    };

    const safeProps =
      JSON.parse(
        JSON.stringify(
          rawProps,
          (key, value) =>
            value === undefined
              ? null
              : value
        )
      );

    return (
      <AdminClientPage
        {...safeProps}
      />
    );
  } catch (error: any) {
    if (
      error.message ===
        "NEXT_REDIRECT" ||
      error.digest?.includes(
        "NEXT_REDIRECT"
      )
    ) {
      throw error;
    }

    console.error(
      "Critical Dashboard Error:",
      error
    );
  }
}