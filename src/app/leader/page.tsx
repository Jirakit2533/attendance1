import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db/db";
import { usersTable, attendanceTable, leaveTable, positionsTable, sitesTable, departmentsTable, shiftsTable } from "@/db/schema"; // เพิ่ม shiftsTable
import { eq, desc, and, ne, isNull } from "drizzle-orm";
import LeaderClientPage from "./leaderClientPage";

export const dynamic = "force-dynamic";

export default async function LeaderPage() {
  const userFromAuth = await getCurrentUser();

  if (!userFromAuth || userFromAuth.role !== "leader") {
    redirect("/api/auth/logout-cleanup");
  }

  // 1. ดึง Profile ของ Leader พร้อมชื่อตำแหน่งและชื่อไซต์งาน
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
  })
  .from(usersTable)
  .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id))
  .leftJoin(sitesTable, eq(usersTable.site_id, sitesTable.id))
  .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
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
    const siteCondition = isAllSitesLeader ? [] : [eq(usersTable.site_id, currentSite!)];

    const [myRecordsRaw, allLeaveRequests, teamAttendanceRaw] = await Promise.all([
      // 2. ดึงประวัติเข้างานของตัว Leader เอง
      db.select()
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
          })
          .from(leaveTable)
          .innerJoin(usersTable, eq(leaveTable.user_id, usersTable.id))
          .where(and(
            eq(usersTable.departmentId, currentDept),
            ...siteCondition,
            ne(usersTable.id, user.id),
            isNull(usersTable.deletedAt)
          ))
          .orderBy(desc(leaveTable.startDate))
        : Promise.resolve([]),

      // 4. ประวัติเข้างานของทีม (แก้ไข Join shiftsTable เพื่อดึง startTime/endTime)
      currentDept
        ? db.select({
            id: attendanceTable.id,
            userId: attendanceTable.user_id,
            firstName: usersTable.firstName,
            lastName: usersTable.lastName,
            userName: usersTable.userName, 
            avatarUrl: usersTable.avatarUrl, 
            position: positionsTable.name,
            site: sitesTable.name,
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
            startTime: shiftsTable.startTime, // ดึงจาก shiftsTable
            endTime: shiftsTable.endTime,     // ดึงจาก shiftsTable
          })
          .from(attendanceTable)
          .leftJoin(usersTable, eq(attendanceTable.user_id, usersTable.id)) 
          .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id))
          .leftJoin(sitesTable, eq(usersTable.site_id, sitesTable.id))
          .leftJoin(shiftsTable, eq(attendanceTable.shift_id, shiftsTable.id)) // เพิ่ม Join shiftsTable
          .where(and(
            eq(usersTable.departmentId, currentDept),
            ...siteCondition,
            ne(usersTable.id, user.id),
            isNull(usersTable.deletedAt)
          ))
          .orderBy(desc(attendanceTable.date), desc(attendanceTable.checkIn))
        : Promise.resolve([])
    ]);

    // 5. จัดเตรียมข้อมูล (Mapping พร้อมป้องกัน Undefined/Null)
    const finalProps = {
      userProfile: {
        ...user,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        isAllSites: isAllSitesLeader
      },
      myRecords: (myRecordsRaw || []).map(r => ({
        ...r,
        location: r.locationIn || r.locationOut || "ไม่ได้ระบุพิกัด",
        position: user.position || "ไม่ระบุ", 
        site: user.site || "ทุกไซต์งาน",
        role: user.role === "leader" ? "หัวหน้างาน" : "พนักงาน"
      })),
      initialAttendance: (teamAttendanceRaw || []).map(t => ({
        ...t,
        employeeName: `${t.firstName || ''} ${t.lastName || ''}`.trim() || t.userName || "ไม่ระบุชื่อ",
        location: t.locationIn || t.locationOut || "ไม่ได้ระบุพิกัด",
        role: t.role === "leader" ? "หัวหน้างาน" : "พนักงาน",
        positionName: t.position || "พนักงาน",
        startTime: t.startTime || null, // ป้องกัน undefined
        endTime: t.endTime || null      // ป้องกัน undefined
      })),
      initialLeaves: (allLeaveRequests || []).map(l => ({
        ...l,
        employeeName: `${l.firstName || ''} ${l.lastName || ''}`.trim() || "ไม่ระบุชื่อ",
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