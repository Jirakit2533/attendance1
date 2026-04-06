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
} from "@/db/schema";
import { getAdminContext } from "./actions";
import { desc, eq, and, or, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import AdminClientPage from "./adminClientPage";

export const dynamic = "force-dynamic"; // บังคับให้เป็น Dynamic ตลอดเวลา

export default async function AdminDashboardPage() {
  try {
    // 1. ตรวจสอบ Session Admin
    const cookieStore = await cookies();
    const adminId = cookieStore.get("session_user_id")?.value;

    if (!adminId) {
      redirect("/api/auth/logout-cleanup");
    }

    // 2. ดึงข้อมูลแอดมิน
    const currentAdmin = await getAdminContext();

    if (!currentAdmin) {
      redirect("/api/auth/logout-cleanup");
    }
    const companyId = currentAdmin.companyId;

    // 3. Fetch ข้อมูลแบบ Parallel (ห้ามลบ ห้ามเปลี่ยนส่วนที่ไม่เกี่ยวข้อง)
    const [
      rawEmployees,
      rawAttendance,
      rawLeaves,
      sitesData,
      positionsData,
      departmentsData,
      defaultShiftData,
      companyInfoData,
      rawOvertime, // เพิ่ม OT เข้ามาในชุด Parallel เพื่อ Performance
    ] = await Promise.all([
      // --- พนักงาน: ดึงผ่าน companyId แทน createdBy ---
      db
        .select({
          id: usersTable.id,
          userName: usersTable.userName,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          role: usersTable.role,
          departmentId: usersTable.departmentId,
          positionName: positionsTable.name,
          siteName: sitesTable.name,
          siteId: usersTable.site_id,
          positionId: usersTable.positionId,
          avatarUrl: usersTable.avatarUrl,
          startTime: shiftsTable.startTime,
          endTime: shiftsTable.endTime,
        })
        .from(usersTable)
        .leftJoin(sitesTable, eq(usersTable.site_id, sitesTable.id))
        .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id))
        .leftJoin(shiftsTable, eq(usersTable.id, shiftsTable.userId))
        .where(
          and(
            or(eq(usersTable.role, "employee"), eq(usersTable.role, "leader")),
            eq(usersTable.companyId, companyId || ""),
            isNull(usersTable.deletedAt)
          )
        )
        .orderBy(desc(usersTable.created_at)),

      // --- การลงเวลา: ดึงผ่าน companyId ของพนักงาน ---
      db
        .select({
          id: attendanceTable.id,
          date: attendanceTable.date,
          checkIn: attendanceTable.checkIn,
          checkOut: attendanceTable.checkOut,
          user_id: attendanceTable.user_id,
          locationIn: attendanceTable.locationIn,
          locationOut: attendanceTable.locationOut,
          imageIn: attendanceTable.imageIn,
          imageOut: attendanceTable.imageOut,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          siteInNameSnapshot: attendanceTable.siteInNameSnapshot,
          departmentNameSnapshot: attendanceTable.departmentNameSnapshot,
          siteName: sitesTable.name,
          siteIdInAttendance: attendanceTable.site_id,
          shiftStartTimeSnapshot: attendanceTable.shiftStartTimeSnapshot,
          startTime: shiftsTable.startTime,
          endTime: shiftsTable.endTime,
          isEarlyExit: attendanceTable.isEarlyExit,
          isLateFromDb: attendanceTable.isLate,
        })
        .from(attendanceTable)
        .innerJoin(usersTable, eq(attendanceTable.user_id, usersTable.id))
        .leftJoin(sitesTable, eq(attendanceTable.site_id, sitesTable.id))
        .leftJoin(shiftsTable, eq(attendanceTable.shift_id, shiftsTable.id))
        .where(
          and(
            eq(usersTable.companyId, companyId || ""),
            isNull(usersTable.deletedAt)
          )
        )
        .orderBy(desc(attendanceTable.date), desc(attendanceTable.createdAt)),

      // --- การลางาน: ดึงผ่าน companyId ของพนักงาน ---
      db
        .select({
          id: leaveTable.id,
          type: leaveTable.type,
          startDate: leaveTable.startDate,
          endDate: leaveTable.endDate,
          status: leaveTable.status,
          reason: leaveTable.reason,
          remark: leaveTable.remark,
          fileUrl: leaveTable.fileUrl,
          fileName: leaveTable.fileName,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          userName: usersTable.userName,
          avatarUrl: usersTable.avatarUrl,
        })
        .from(leaveTable)
        .leftJoin(usersTable, eq(leaveTable.user_id, usersTable.id))
        .where(
          and(
            eq(usersTable.companyId, companyId || ""),
            isNull(usersTable.deletedAt)
          )
        )
        .orderBy(desc(leaveTable.startDate)),

      // --- ข้อมูลพื้นฐาน ---
      db
        .select()
        .from(sitesTable)
        .where(eq(sitesTable.companyId, companyId || "")),
      db
        .select()
        .from(positionsTable)
        .where(eq(positionsTable.company_id, companyId || "")),
      db
        .select()
        .from(departmentsTable)
        .where(eq(departmentsTable.companyId, companyId || "")),

      db
        .select({
          startTime: shiftsTable.startTime,
          endTime: shiftsTable.endTime,
        })
        .from(shiftsTable)
        .where(
          and(
            eq(shiftsTable.companyId, companyId || ""),
            isNull(shiftsTable.userId)
          )
        )
        .limit(1),

      db
        .select()
        .from(companyTable)
        .where(eq(companyTable.id, companyId || ""))
        .limit(1),

      // --- OT Requests: ดึงข้อมูลและ Join ข้อมูลพนักงาน ---
      db
        .select({
          id: overtimeRequestsTable.id,
          userId: overtimeRequestsTable.userId,
          userName: overtimeRequestsTable.userName,
          employeeName: sql<string>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
          avatarUrl: usersTable.avatarUrl,
          requestDate: overtimeRequestsTable.createdAt,
          workingDate: overtimeRequestsTable.date,
          timeStart: overtimeRequestsTable.timeStart,
          timeEnd: overtimeRequestsTable.timeEnd,
          overtimeByRequest: overtimeRequestsTable.overtimeByRequest,
          reason: overtimeRequestsTable.reason, // ดึงจาก field reason
          status: overtimeRequestsTable.status,
          remarks: overtimeRequestsTable.remarks, // ดึงจาก field remarks
        })
        .from(overtimeRequestsTable)
        .leftJoin(usersTable, eq(overtimeRequestsTable.userId, usersTable.id))
        .where(
          and(
            eq(overtimeRequestsTable.companyId, companyId || ""),
            isNull(overtimeRequestsTable.deletedAt)
          )
        )
        .orderBy(desc(overtimeRequestsTable.createdAt)),
    ]);

    // 4. Mapping ข้อมูล
    const employees = (rawEmployees || []).map((emp) => {
      const isUuid = emp?.userName && emp.userName.length > 30;
      const finalUserName = isUuid
        ? emp.firstName?.toLowerCase()
        : emp?.userName || "user";

      return {
        id: String(emp?.id || ""),
        userName: finalUserName,
        username: finalUserName,
        firstName: String(emp?.firstName || ""),
        lastName: String(emp?.lastName || ""),
        employeeName: `${emp?.firstName || ""} ${emp?.lastName || ""}`.trim() || "ไม่ระบุชื่อ",
        role: String(emp?.role || "employee"),
        departmentId: emp?.departmentId ? String(emp.departmentId) : null,
        positionId: emp?.positionId ? String(emp.positionId) : null,
        siteId: emp?.siteId ? String(emp.siteId) : null,
        site: String(emp?.siteName || "ไม่ระบุ"),
        siteName: emp?.siteName || "ไม่ระบุ",
        position: String(emp?.positionName || "พนักงาน"),
        avatarUrl: emp?.avatarUrl || null,
        startTime: emp?.startTime || null,
        endTime: emp?.endTime || null,
      };
    });

    const attendance = (rawAttendance || []).map((at) => {
      let isLate = at.isLateFromDb ?? 0;
      if (!isLate && at?.checkIn) {
        const compareTime = at.shiftStartTimeSnapshot || at.startTime;
        if (compareTime) {
          const checkInTime = parseInt(at.checkIn.replace(/:/g, ""), 10);
          const startTime = parseInt(compareTime.replace(/:/g, ""), 10);
          if (checkInTime > startTime) isLate = 1;
        }
      }
      return {
        id: String(at?.id || ""),
        date: at?.date ? String(at.date) : "",
        checkIn: at?.checkIn || null,
        checkOut: at?.checkOut || null,
        userId: String(at?.user_id || ""),
        employeeName: `${at?.firstName || ""} ${at?.lastName || ""}`.trim() || "ไม่ระบุชื่อ",
        siteSnapName: at?.siteInNameSnapshot || at?.siteName || "ทั่วไป (ไม่มีไซต์)",
        departmentSnapName: at?.departmentNameSnapshot || "ไม่ระบุแผนก",
        siteName: at?.siteName || "ทั่วไป (ไม่มีไซต์)",
        locationIn: String(at?.locationIn || "-"),
        locationOut: String(at?.locationOut || "-"),
        imageIn: at?.imageIn || null,
        imageOut: at?.imageOut || null,
        startTime: at?.shiftStartTimeSnapshot || at?.startTime || null,
        endTime: at?.endTime || null,
        isLate: isLate,
        isEarlyExit: at.isEarlyExit ? String(at.isEarlyExit) : "-",
      };
    });

    const overtimeRequests = (rawOvertime || []).map((ot) => ({
      id: String(ot.id || ""),
      userId: String(ot.userId || ""),
      userName: String(ot.userName || ""),
      employeeName: String(ot.employeeName || "ไม่ระบุชื่อ"),
      avatarUrl: ot.avatarUrl || null,
      requestDate: ot.requestDate ? String(ot.requestDate) : null,
      workingDate: ot.workingDate ? String(ot.workingDate) : null,
      timeStart: ot.timeStart || "",
      timeEnd: ot.timeEnd || "",
      totalHours: String(ot.overtimeByRequest || "0"),
      reason: String(ot.reason || ""),
      status: String(ot.status || "pending"),
      remark: String(ot.remarks || ""), // Mapping จาก remarks เข้าตัวแปร remark
    }));

    const sites = (sitesData || []).map((s) => ({
      id: String(s?.id || ""),
      name: String(s?.name || ""),
      address: s?.address || "",
      coordinates: s?.coordinates || "",
    }));

    const adminProfile = {
      id: currentAdmin?.id || "",
      name: `${currentAdmin?.firstName || ""} ${currentAdmin?.lastName || ""}`.trim(),
      firstName: currentAdmin?.firstName || "",
      lastName: currentAdmin?.lastName || "",
      userName: currentAdmin?.userName || "",
      username: currentAdmin?.userName || "",
      email: currentAdmin?.email || "",
      phone: currentAdmin?.phone || "",
      avatarUrl: currentAdmin?.avatarUrl || null,
      company: String(currentAdmin?.companyName || "บริษัท"),
      role: "admin",
    };

    const rawProps = {
      initialEmployees: employees,
      initialAttendance: attendance,
      initialLeaves: (rawLeaves || []).map((l) => ({
        id: String(l?.id || ""),
        type: String(l?.type || "ลากิจ"),
        startDate: l?.startDate ? String(l.startDate) : "",
        endDate: l?.endDate ? String(l.endDate) : "",
        status: String(l?.status || "pending"),
        reason: String(l?.reason || ""),
        remark: String(l?.remark || ""),
        fileUrl: l?.fileUrl || null,
        fileName: l?.fileName || null,
        employeeName: `${l?.firstName || ""} ${l?.lastName || ""}`.trim() || "ไม่ระบุพนักงาน",
        userName: String(l?.userName || ""),
        avatarUrl: l?.avatarUrl || null,
      })),
      admin: adminProfile,
      sites: sites,
      hasMultiSiteActive: sites.some((s) => s.name === "ทุกไซต์"),
      positions: (positionsData || []).map((p) => ({
        id: String(p?.id || ""),
        name: String(p?.name || ""),
      })),
      departments: (departmentsData || []).map((d) => ({
        id: String(d?.id || ""),
        name: String(d?.name || ""),
      })),
      standardTime: {
        startTime: defaultShiftData?.[0]?.startTime || "08:00",
        endTime: defaultShiftData?.[0]?.endTime || "17:00",
      },
      initialCompanyData: companyInfoData?.[0] || null,
      initialOvertimeRequests: overtimeRequests,
    };

    const safeProps = JSON.parse(
      JSON.stringify(rawProps, (key, value) =>
        value === undefined ? null : value
      )
    );

    return <AdminClientPage {...safeProps} />;
  } catch (error: any) {
    if (
      error.message === "NEXT_REDIRECT" ||
      error.digest?.includes("NEXT_REDIRECT")
    ) {
      throw error;
    }
    console.error("Critical Dashboard Error:", error);
  }
}