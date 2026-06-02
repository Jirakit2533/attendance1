import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db/db";
import {
  usersTable,
  attendanceTable,
  leaveTable,
  positionsTable,
  sitesTable,
  departmentsTable,
  shiftsTable,
  companyTable,
  overtimeRequestsTable, // ✅ เพิ่ม: นำเข้าตาราง OT
} from "@/db/schema";
import { eq, desc, and, ne, isNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import LeaderClientPage from "./leaderClientPage";
import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// ✅ ฟังก์ชันจัดรูปแบบวันที่ให้เป็นมาตรฐานเดียวกันทั้งหน้า (DD/MM/YYYY HH:mm)
const formatThaiDate = (date: Date | string | null) => {
  if (!date) return null;
  const d = new Date(date);
  
  // ตรวจสอบความถูกต้องของ Date Object
  if (isNaN(d.getTime())) return null;

  // ดึงค่าแยกส่วนและเติม 0 ข้างหน้าให้เป็น 2 หลัก
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear(); // ค.ศ.
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

export default async function LeaderPage() {
  const userFromAuth = await getCurrentUser();

  if (!userFromAuth || userFromAuth.role !== "leader") {
    redirect("/api/auth/logout-cleanup");
  }

  // สร้าง Alias สำหรับตาราง User และ Position เพื่อใช้ดึงข้อมูลผู้อนุมัติ
  const approverUser = alias(usersTable, "approverUser");
  const approverPosition = alias(positionsTable, "approverPosition");
  
  // ✅ สร้าง Alias แยกเฉพาะสำหรับ OT เพื่อป้องกันการ Join ทับซ้อนกับระบบลา
  const otApproverUser = alias(usersTable, "otApproverUser"); 
  const otEmployeePosition = alias(positionsTable, "otEmployeePosition");
  const otApproverPosition = alias(positionsTable, "otApproverPosition");

  // 1. ดึง Profile ของ Leader พร้อมข้อมูลบริษัท
  const userExists = await db
    .select({
      id: usersTable.id,
      role: usersTable.role,
      departmentId: usersTable.departmentId,
      site_id: usersTable.site_id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      avatarUrl: usersTable.avatarUrl,
      userName: usersTable.userName,
      position: positionsTable.name,
      site: sitesTable.name,
      department: departmentsTable.name,
      startTime: shiftsTable.startTime,
      endTime: shiftsTable.endTime,
      // ดึงข้อมูลบริษัทปัจจุบัน
      companyName: companyTable.name,
      companyLogo: companyTable.logoUrl,
      companyDescription: companyTable.description,
    })
    .from(usersTable)
    .leftJoin(positionsTable, and(eq(usersTable.positionId, positionsTable.id), isNull(positionsTable.deletedAt)))
    .leftJoin(sitesTable, and(eq(usersTable.site_id, sitesTable.id), isNull(sitesTable.deletedAt)))
    .leftJoin(
      departmentsTable,
      and(eq(usersTable.departmentId, departmentsTable.id), isNull(departmentsTable.deletedAt))
    )
    .leftJoin(shiftsTable, eq(usersTable.id, shiftsTable.userId))
    .leftJoin(companyTable, eq(usersTable.companyId, companyTable.id))
    .where(
      and(eq(usersTable.id, userFromAuth.id), isNull(usersTable.deletedAt))
    )
    .limit(1);

  if (userExists.length === 0) {
    redirect("/api/auth/logout-cleanup");
  }

  const user = userExists[0];
  const currentDept = user.departmentId;
  const currentSite = user.site_id;
  const isAllSitesLeader = !currentSite;

  try {
    // teamFilter: ยกเว้นตัวเอง และจัดการกรณี All Sites
    const teamFilter = and(
      eq(usersTable.departmentId, currentDept!),
      ne(usersTable.id, user.id),
      isNull(usersTable.deletedAt),
      isAllSitesLeader
        ? undefined 
        : eq(usersTable.site_id, currentSite!)
    );

    const [
      myRecordsRaw,
      allLeaveRequests,
      teamAttendanceRaw,
      myLeaveRequestsRaw,
      teamOTRequestsRaw, // ✅ ข้อมูล OT ของทีม
      myOTRequestsRaw,   // ✅ ข้อมูล OT ของตัวเอง
    ] = await Promise.all([
      // 2. ดึงประวัติเข้างานของตัวเอง
      db
        .select({
          id: attendanceTable.id,
          user_id: attendanceTable.user_id,
          date: attendanceTable.date,
          checkIn: attendanceTable.checkIn,
          checkOut: attendanceTable.checkOut,
          locationIn: attendanceTable.locationIn,
          locationOut: attendanceTable.locationOut,
          imageIn: attendanceTable.imageIn,
          imageOut: attendanceTable.imageOut,
          isLate: attendanceTable.isLate,
          isEarlyExit: attendanceTable.isEarlyExit,
          isOffsiteIn: attendanceTable.isOffsiteIn,
          isOffsiteOut: attendanceTable.isOffsiteOut,
          createdAt: attendanceTable.createdAt,
          site: attendanceTable.siteInNameSnapshot,
          department: attendanceTable.departmentNameSnapshot,
          startTime: attendanceTable.shiftStartTimeSnapshot,
          endTime: attendanceTable.shiftEndTimeSnapshot,
        })
        .from(attendanceTable)
        .where(eq(attendanceTable.user_id, user.id))
        .orderBy(desc(attendanceTable.date), desc(attendanceTable.checkIn))
        .limit(31),

      // 3. ข้อมูลคำขอลาของทีม
      currentDept
        ? db
            .select({
              id: leaveTable.id,
              user_id: leaveTable.user_id,
              firstName: usersTable.firstName,
              lastName: usersTable.lastName,
              type: leaveTable.type,
              startDate: leaveTable.startDate,
              endDate: leaveTable.endDate,
              startTime: leaveTable.startTime,
              endTime: leaveTable.endTime,
              totalHours: leaveTable.totalHours,
              reason: leaveTable.reason,
              status: leaveTable.status,
              fileUrl: leaveTable.fileUrl,
              remark: leaveTable.remark,
              createdAt: leaveTable.createdAt,
              approverFirst: approverUser.firstName,
              approverLast: approverUser.lastName,
              approverPosition: approverPosition.name,
              positionName: positionsTable.name,
              siteName: sitesTable.name,
            })
            .from(leaveTable)
            .innerJoin(usersTable, eq(leaveTable.user_id, usersTable.id))
            .leftJoin(
              positionsTable,
              and(eq(usersTable.positionId, positionsTable.id), isNull(positionsTable.deletedAt))
            )
            .leftJoin(sitesTable, and(eq(usersTable.site_id, sitesTable.id), isNull(sitesTable.deletedAt)))
            .leftJoin(
              approverUser,
              or(
                eq(leaveTable.approvedBy, approverUser.id),
                eq(leaveTable.rejectedBy, approverUser.id)
              )
            )
            .leftJoin(
              approverPosition,
              and(eq(approverUser.positionId, approverPosition.id), isNull(approverPosition.deletedAt))
            )
            .where(teamFilter)
            .orderBy(desc(leaveTable.createdAt))
            .limit(50)
        : Promise.resolve([]),

      // 4. ประวัติเข้างานของทีม
      currentDept
        ? db
            .select({
              id: attendanceTable.id,
              userId: attendanceTable.user_id,
              firstName: usersTable.firstName,
              lastName: usersTable.lastName,
              userName: usersTable.userName,
              avatarUrl: usersTable.avatarUrl,
              position: positionsTable.name,
              role: usersTable.role,
              date: attendanceTable.date,
              checkIn: attendanceTable.checkIn,
              checkOut: attendanceTable.checkOut,
              locationIn: attendanceTable.locationIn,
              locationOut: attendanceTable.locationOut,
              imageIn: attendanceTable.imageIn,
              imageOut: attendanceTable.imageOut,
              isLate: attendanceTable.isLate,
              isEarlyExit: attendanceTable.isEarlyExit,
              isOffsiteIn: attendanceTable.isOffsiteIn,
              isOffsiteOut: attendanceTable.isOffsiteOut,
              createdAt: attendanceTable.createdAt,
              site: attendanceTable.siteInNameSnapshot,
              startTime: attendanceTable.shiftStartTimeSnapshot,
              endTime: attendanceTable.shiftEndTimeSnapshot,
            })
            .from(attendanceTable)
            .leftJoin(usersTable, eq(attendanceTable.user_id, usersTable.id))
            .leftJoin(
              positionsTable,
              and(eq(usersTable.positionId, positionsTable.id), isNull(positionsTable.deletedAt))
            )
            .where(teamFilter)
            .orderBy(desc(attendanceTable.date), desc(attendanceTable.checkIn))
            .limit(100)
        : Promise.resolve([]),

      // 5. ประวัติการลาของตัวเอง
      db
        .select({
          id: leaveTable.id,
          user_id: leaveTable.user_id,
          type: leaveTable.type,
          startDate: leaveTable.startDate,
          endDate: leaveTable.endDate,
          startTime: leaveTable.startTime,
          endTime: leaveTable.endTime,
          totalHours: leaveTable.totalHours,
          reason: leaveTable.reason,
          status: leaveTable.status,
          fileUrl: leaveTable.fileUrl,
          remark: leaveTable.remark,
          createdAt: leaveTable.createdAt,
          approverFirst: approverUser.firstName,
          approverLast: approverUser.lastName,
          approverPosition: approverPosition.name,
        })
        .from(leaveTable)
        .leftJoin(
          approverUser,
          or(
            eq(leaveTable.approvedBy, approverUser.id),
            eq(leaveTable.rejectedBy, approverUser.id)
          )
        )
        .leftJoin(
          approverPosition,
          and(eq(approverUser.positionId, approverPosition.id), isNull(approverPosition.deletedAt))
        )
        .where(eq(leaveTable.user_id, user.id))
        .orderBy(desc(leaveTable.createdAt))
        .limit(30),

      // ✅ 7. ดึงข้อมูล OT ของทีม
      currentDept
        ? db
            .select({
              id: overtimeRequestsTable.id,
              userId: overtimeRequestsTable.userId,
              firstName: usersTable.firstName,
              lastName: usersTable.lastName,
              avatarUrl: usersTable.avatarUrl,
              userName: overtimeRequestsTable.userName, 
              positionName: otEmployeePosition.name,
              overtimeByRequest: overtimeRequestsTable.overtimeByRequest,
              timeStart: overtimeRequestsTable.timeStart,
              timeEnd: overtimeRequestsTable.timeEnd,
              date: overtimeRequestsTable.date,
              reason: overtimeRequestsTable.reason,
              remarks: overtimeRequestsTable.remarks,
              status: overtimeRequestsTable.status,
              createdAt: overtimeRequestsTable.createdAt,
              approverFirst: otApproverUser.firstName,
              approverLast: otApproverUser.lastName,
              approverPosition: otApproverPosition.name,
            })
            .from(overtimeRequestsTable)
            .innerJoin(usersTable, eq(overtimeRequestsTable.userId, usersTable.id))
            .leftJoin(otEmployeePosition, and(eq(usersTable.positionId, otEmployeePosition.id), isNull(otEmployeePosition.deletedAt)))
            .leftJoin(otApproverUser, or(eq(overtimeRequestsTable.approvedBy, otApproverUser.id), eq(overtimeRequestsTable.rejectedBy, otApproverUser.id)))
            .leftJoin(otApproverPosition, and(eq(otApproverUser.positionId, otApproverPosition.id), isNull(otApproverPosition.deletedAt)))
            .where(teamFilter)
            .orderBy(desc(overtimeRequestsTable.createdAt))
            .limit(50)
        : Promise.resolve([]),

      // ✅ 8. ดึงข้อมูล OT ของตัวเอง
      db
        .select({
          id: overtimeRequestsTable.id,
          userName: overtimeRequestsTable.userName,
          overtimeByRequest: overtimeRequestsTable.overtimeByRequest,
          timeStart: overtimeRequestsTable.timeStart,
          timeEnd: overtimeRequestsTable.timeEnd,
          date: overtimeRequestsTable.date,
          reason: overtimeRequestsTable.reason,
          remarks: overtimeRequestsTable.remarks,
          status: overtimeRequestsTable.status,
          createdAt: overtimeRequestsTable.createdAt,
          approverFirst: otApproverUser.firstName,
          approverLast: otApproverUser.lastName,
          approverPosition: otApproverPosition.name,
        })
        .from(overtimeRequestsTable)
        .leftJoin(otApproverUser, or(eq(overtimeRequestsTable.approvedBy, otApproverUser.id), eq(overtimeRequestsTable.rejectedBy, otApproverUser.id)))
        .leftJoin(otApproverPosition, and(eq(otApproverUser.positionId, otApproverPosition.id), isNull(otApproverPosition.deletedAt)))
        .where(eq(overtimeRequestsTable.userId, user.id))
        .orderBy(desc(overtimeRequestsTable.createdAt))
        .limit(30),
    ]);

    // 6. จัดเตรียมข้อมูล (Mapping)
    const finalProps = {
      companyData: {
        name: user.companyName || "บริษัทไม่ระบุชื่อ",
        logoUrl: user.companyLogo,
        description: user.companyDescription,
      },
      userProfile: {
        ...user,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        isAllSites: isAllSitesLeader,
        workShift:
          user.startTime && user.endTime
            ? `${user.startTime.substring(0, 5)} - ${user.endTime.substring(0, 5)}`
            : "ไม่ระบุกะงาน",
      },
      myRecords: (myRecordsRaw || []).map((r) => ({
        ...r,
        location: r.locationIn || r.locationOut || "ไม่ได้ระบุพิกัด",
        position: user.position || "ไม่ระบุ",
        site: r.site || "ไม่ระบุไซต์",
        role: user.role === "leader" ? "หัวหน้างาน" : "พนักงาน",
        checkIn: r.checkIn ? r.checkIn.substring(0, 5) : null,
        checkOut: r.checkOut ? r.checkOut.substring(0, 5) : null,
        isOffsiteIn: r.isOffsiteIn,
        isOffsiteOut: r.isOffsiteOut,
        createdAt: formatThaiDate(r.createdAt),
      })),
      initialAttendance: (teamAttendanceRaw || []).map((t) => ({
        ...t,
        employeeName:
          `${t.firstName || ""} ${t.lastName || ""}`.trim() ||
          t.userName ||
          "ไม่ระบุชื่อ",
        location: t.locationIn || t.locationOut || "ไม่ได้ระบุพิกัด",
        role: t.role === "leader" ? "หัวหน้างาน" : "พนักงาน",
        positionName: t.position || "พนักงาน",
        startTime: t.startTime || null,
        endTime: t.endTime || null,
        siteName: t.site || "ไม่ระบุไซต์",
        checkIn: t.checkIn ? t.checkIn.substring(0, 5) : null,
        checkOut: t.checkOut ? t.checkOut.substring(0, 5) : null,
        isOffsiteIn: t.isOffsiteIn,
        isOffsiteOut: t.isOffsiteOut,
        createdAt: formatThaiDate(t.createdAt),
      })),
      initialLeaves: (allLeaveRequests || []).map((l: any) => ({
        ...l,
        employeeName:
          `${l.firstName || ""} ${l.lastName || ""}`.trim() || "ไม่ระบุชื่อ",
        positionName: l.positionName || "พนักงาน",
        siteName: l.siteName || "ทุกไซต์งาน",
        remark: l.remark,
        createdAt: formatThaiDate(l.createdAt),
        approverFirst: l.approverFirst,
        approverLast: l.approverLast,
        approverPosition: l.approverPosition || "แอดมิน/HR",
      })),
      myLeaves: (myLeaveRequestsRaw || []).map((l: any) => ({
        ...l,
        start_date: l.startDate,
        end_date: l.endDate,
        remark: l.remark,
        createdAt: formatThaiDate(l.createdAt),
        approverFirst: l.approverFirst,
        approverLast: l.approverLast,
        approverPosition: l.approverPosition || "admin/HR",
      })),
      // ✅ Mapping ข้อมูล OT ของทีม
      initialOT: (teamOTRequestsRaw || []).map((ot) => ({
        ...ot,
        employeeName: `${ot.firstName || ""} ${ot.lastName || ""}`.trim() || "ไม่ระบุชื่อ",
        positionName: ot.positionName || "พนักงาน",
        avatarUrl: ot.avatarUrl,
        projectTag: ot.userName,
        date: ot.date, 
        createdAt: formatThaiDate(ot.createdAt),
        requestDate: formatThaiDate(ot.createdAt), 
        remark: ot.remarks, 
        approverFirst: ot.approverFirst,
        approverLast: ot.approverLast,
        approverName: ot.approverFirst ? `${ot.approverFirst} ${ot.approverLast || ""}`.trim() : "-",
        approverPosition: ot.approverPosition || "หัวหน้างาน",
      })),
      // ✅ Mapping ข้อมูล OT ของตัวเอง
      myOT: (myOTRequestsRaw || []).map((ot) => ({
        ...ot,
        projectTag: ot.userName,
        date: ot.date, 
        createdAt: formatThaiDate(ot.createdAt),
        requestDate: formatThaiDate(ot.createdAt), 
        remark: ot.remarks, 
        approverFirst: ot.approverFirst,
        approverLast: ot.approverLast,
        approverName: ot.approverFirst ? `${ot.approverFirst} ${ot.approverLast || ""}`.trim() : "-",
        approverPosition: ot.approverPosition || "แอดมิน/HR",
      })),
    };

    const safeData = JSON.parse(
      JSON.stringify(finalProps, (key, value) =>
        value === undefined ? null : value
      )
    );

    return <LeaderClientPage {...safeData} />;
  } catch (error) {
    console.error("Leader Page Critical Error:", error);
    throw error;
  }
}