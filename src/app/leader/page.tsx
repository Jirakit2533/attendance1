import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db/db";
import { usersTable, attendanceTable, leaveTable, positionsTable, sitesTable, departmentsTable, shiftsTable, companyTable } from "@/db/schema"; 
import { eq, desc, and, ne, isNull, isNotNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import LeaderClientPage from "./leaderClientPage";

export const dynamic = "force-dynamic";

export default async function LeaderPage() {
  const userFromAuth = await getCurrentUser();

  if (!userFromAuth || userFromAuth.role !== "leader") {
    redirect("/api/auth/logout-cleanup");
  }

  // สร้าง Alias สำหรับตาราง User และ Position เพื่อใช้ดึงข้อมูลผู้อนุมัติ
  const approverUser = alias(usersTable, "approverUser");
  const approverPosition = alias(positionsTable, "approverPosition");

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
  .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id))
  .leftJoin(sitesTable, eq(usersTable.site_id, sitesTable.id))
  .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
  .leftJoin(shiftsTable, eq(usersTable.id, shiftsTable.userId)) 
  .leftJoin(companyTable, eq(usersTable.companyId, companyTable.id)) 
  .where(and(eq(usersTable.id, userFromAuth.id), isNull(usersTable.deletedAt)))
  .limit(1);

  if (userExists.length === 0) {
    redirect("/api/auth/logout-cleanup");
  }

  const user = userExists[0];
  const currentDept = user.departmentId;
  const currentSite = user.site_id;
  const isAllSitesLeader = !currentSite;

  try {
    const teamFilter = and(
      eq(usersTable.departmentId, currentDept!),
      ne(usersTable.id, user.id),
      isNull(usersTable.deletedAt),
      isAllSitesLeader 
        ? isNotNull(usersTable.site_id) 
        : eq(usersTable.site_id, currentSite!)
    );

    const [myRecordsRaw, allLeaveRequests, teamAttendanceRaw, myLeaveRequestsRaw] = await Promise.all([
      // 2. ดึงประวัติเข้างาน (ใช้ Snapshot)
      db.select({
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
        // Snapshot
        site: attendanceTable.siteNameSnapshot,
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
        ? db.select({
            id: leaveTable.id,
            user_id: leaveTable.user_id,
            firstName: usersTable.firstName,
            lastName: usersTable.lastName,
            type: leaveTable.type,
            startDate: leaveTable.startDate,
            endDate: leaveTable.endDate,
            reason: leaveTable.reason,
            status: leaveTable.status,
            fileUrl: leaveTable.fileUrl,
            remark: leaveTable.remark, 
            approverFirst: approverUser.firstName,
            approverLast: approverUser.lastName,
            approverPosition: approverPosition.name, 
            positionName: positionsTable.name,
            siteName: sitesTable.name,
          })
          .from(leaveTable)
          .innerJoin(usersTable, eq(leaveTable.user_id, usersTable.id))
          .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id))
          .leftJoin(sitesTable, eq(usersTable.site_id, sitesTable.id))
          .leftJoin(approverUser, or(eq(leaveTable.approvedBy, approverUser.id), eq(leaveTable.rejectedBy, approverUser.id)))
          .leftJoin(approverPosition, eq(approverUser.positionId, approverPosition.id))
          .where(teamFilter)
          .orderBy(desc(leaveTable.startDate))
        : Promise.resolve([]),

      // 4. ประวัติเข้างานของทีม (ใช้ Snapshot)
      currentDept
        ? db.select({
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
            site: attendanceTable.siteNameSnapshot,
            startTime: attendanceTable.shiftStartTimeSnapshot, 
            endTime: attendanceTable.shiftEndTimeSnapshot,    
          })
          .from(attendanceTable)
          .leftJoin(usersTable, eq(attendanceTable.user_id, usersTable.id)) 
          .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id))
          .where(teamFilter)
          .orderBy(desc(attendanceTable.date), desc(attendanceTable.checkIn))
        : Promise.resolve([]),

      // 5. ประวัติการลาของตัวเอง
      db.select({
        id: leaveTable.id,
        user_id: leaveTable.user_id,
        type: leaveTable.type,
        startDate: leaveTable.startDate,
        endDate: leaveTable.endDate,
        reason: leaveTable.reason,
        status: leaveTable.status,
        fileUrl: leaveTable.fileUrl,
        remark: leaveTable.remark, 
        approverFirst: approverUser.firstName,
        approverLast: approverUser.lastName,
        approverPosition: approverPosition.name,
      })
      .from(leaveTable)
      .leftJoin(approverUser, or(eq(leaveTable.approvedBy, approverUser.id), eq(leaveTable.rejectedBy, approverUser.id)))
      .leftJoin(approverPosition, eq(approverUser.positionId, approverPosition.id))
      .where(eq(leaveTable.user_id, user.id))
      .orderBy(desc(leaveTable.startDate))
    ]);

    // 6. จัดเตรียมข้อมูล (Mapping)
    const finalProps = {
      // ข้อมูลบริษัทสำหรับ UI
      companyData: {
        name: user.companyName || "บริษัทไม่ระบุชื่อ",
        logoUrl: user.companyLogo,
        description: user.companyDescription
      },
      userProfile: {
        ...user,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        isAllSites: isAllSitesLeader,
        workShift: user.startTime && user.endTime 
          ? `${user.startTime.substring(0, 5)} - ${user.endTime.substring(0, 5)}` 
          : "ไม่ระบุกะงาน"
      },
      myRecords: (myRecordsRaw || []).map(r => ({
        ...r,
        location: r.locationIn || r.locationOut || "ไม่ได้ระบุพิกัด",
        position: user.position || "ไม่ระบุ", 
        site: r.site || "ไม่ระบุไซต์", 
        role: user.role === "leader" ? "หัวหน้างาน" : "พนักงาน",
        checkIn: r.checkIn ? r.checkIn.substring(0, 5) : null,
        checkOut: r.checkOut ? r.checkOut.substring(0, 5) : null,
      })),
      initialAttendance: (teamAttendanceRaw || []).map(t => ({
        ...t,
        employeeName: `${t.firstName || ''} ${t.lastName || ''}`.trim() || t.userName || "ไม่ระบุชื่อ",
        location: t.locationIn || t.locationOut || "ไม่ได้ระบุพิกัด",
        role: t.role === "leader" ? "หัวหน้างาน" : "พนักงาน",
        positionName: t.position || "พนักงาน",
        startTime: t.startTime || null, 
        endTime: t.endTime || null,  
        siteName: t.site || "ไม่ระบุไซต์",
        checkIn: t.checkIn ? t.checkIn.substring(0, 5) : null,
        checkOut: t.checkOut ? t.checkOut.substring(0, 5) : null,    
      })),
      initialLeaves: (allLeaveRequests || []).map((l: any) => ({
        ...l,
        employeeName: `${l.firstName || ''} ${l.lastName || ''}`.trim() || "ไม่ระบุชื่อ",
        positionName: l.positionName || "พนักงาน",
        siteName: l.siteName || "ทุกไซต์งาน",
        remark: l.remark,
        approverFirst: l.approverFirst,
        approverLast: l.approverLast,
        approverPosition: l.approverPosition || "ไม่ระบุตำแหน่ง",
      })),
      myLeaves: (myLeaveRequestsRaw || []).map((l: any) => ({
        ...l,
        start_date: l.startDate, 
        end_date: l.endDate,    
        remark: l.remark,
        approverFirst: l.approverFirst,
        approverLast: l.approverLast,
        approverPosition: l.approverPosition || "admin/HR",
      })),
    };

    const safeData = JSON.parse(JSON.stringify(finalProps, (key, value) => 
        value === undefined ? null : value
    ));

    return <LeaderClientPage {...safeData} />;

  } catch (error) {
    console.error("Leader Page Critical Error:", error);
    throw error;
  }
}