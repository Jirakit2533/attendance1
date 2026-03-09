import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db/db";
import { usersTable, attendanceTable, leaveTable, positionsTable, sitesTable, departmentsTable } from "@/db/schema";
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
    userName: usersTable.userName, // เพิ่มชื่อผู้ใช้
    position: positionsTable.name, // ชื่อตำแหน่ง
    site: sitesTable.name,         // ชื่อไซต์งาน
    department: departmentsTable.name, // ชื่อแผนก
    role: usersTable.role,
  })
  .from(usersTable)
  .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id))
  .leftJoin(sitesTable, eq(usersTable.site_id, sitesTable.id))
  .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id)) // Join ตารางแผนก
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
            isNull(usersTable.deletedAt)
          ))
          .orderBy(desc(leaveTable.startDate))
        : Promise.resolve([]),

      // 4. ประวัติเข้างานของทีม
      currentDept
        ? db.select({
            id: attendanceTable.id,
            userId: attendanceTable.user_id,
            firstName: usersTable.firstName,
            lastName: usersTable.lastName,
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
          })
          .from(attendanceTable)
          .innerJoin(usersTable, eq(attendanceTable.user_id, usersTable.id))
          .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id))
          .leftJoin(sitesTable, eq(usersTable.site_id, sitesTable.id))
          .where(and(
            eq(usersTable.departmentId, currentDept),
            ...siteCondition,
            ne(usersTable.id, user.id),
            isNull(usersTable.deletedAt)
          ))
          .orderBy(desc(attendanceTable.date), desc(attendanceTable.checkIn))
        : Promise.resolve([])
    ]);

    // 5. จัดเตรียมข้อมูล (Mapping)
    const finalProps = {
      userProfile: {
        ...user,
        name: `${user.firstName} ${user.lastName}`,
        isAllSites: isAllSitesLeader
      },
      // ข้อมูลการเข้างานของ Leader เอง (ตารางที่ 1)
      myRecords: myRecordsRaw.map(r => ({
        ...r,
        location: r.locationIn || r.locationOut || "ไม่ได้ระบุพิกัด",
        // ส่ง Property ที่ UI เรียกใช้
        position: user.positionName || "ไม่ระบุ", 
        site: user.siteName || "ทุกไซต์งาน",
        role: user.role === "leader" ? "หัวหน้างาน" : "พนักงาน" // ใช้เช็คสี Dot
      })),
      // ข้อมูลการเข้างานของทีม (ตารางที่ 2)
      initialAttendance: teamAttendanceRaw.map(t => ({
        ...t,
        employeeName: `${t.firstName || ''} ${t.lastName || ''}`.trim(),
        location: t.locationIn || t.locationOut || "ไม่ได้ระบุพิกัด",
        role: t.role === "leader" ? "หัวหน้างาน" : "พนักงาน"
      })),
      initialLeaves: allLeaveRequests.map(l => ({
        ...l,
        employeeName: `${l.firstName || ''} ${l.lastName || ''}`.trim(),
      })),
    };

    return <LeaderClientPage {...JSON.parse(JSON.stringify(finalProps))} />;

  } catch (error) {
    console.error("Leader Page Critical Error:", error);
    throw error;
  }
}