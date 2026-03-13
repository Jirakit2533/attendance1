import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db/db";
import { usersTable, attendanceTable, leaveTable, positionsTable, sitesTable, departmentsTable, shiftsTable } from "@/db/schema"; // เพิ่ม shiftsTable
import { eq, desc, and, ne, isNull, isNotNull } from "drizzle-orm";
import LeaderClientPage from "./leaderClientPage";

export const dynamic = "force-dynamic";

export default async function LeaderPage() {
  const userFromAuth = await getCurrentUser();

  if (!userFromAuth || userFromAuth.role !== "leader") {
    redirect("/api/auth/logout-cleanup");
  }

  // 1. ดึง Profile ของ Leader พร้อมชื่อตำแหน่ง ชื่อไซต์งาน และเวลาเข้า-ออกงาน
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
    startTime: shiftsTable.startTime, // ดึงเวลาเริ่มงานของ Leader
    endTime: shiftsTable.endTime,     // ดึงเวลาเลิกงานของ Leader
  })
  .from(usersTable)
  .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id))
  .leftJoin(sitesTable, eq(usersTable.site_id, sitesTable.id))
  .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
  .leftJoin(shiftsTable, eq(usersTable.id, shiftsTable.userId)) // เพิ่มการ Join shiftsTable ของ Leader
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
    // แก้ไข Logic เงื่อนไข Site ตามคำสั่ง: 
    // ถ้า Leader เป็น ทุกไซต์ (site_id เป็น null) ให้ดึงพนักงานทุกคนในแผนก รวมทั้ง Leader ที่ถูกกำหนดไซต์ด้วย
    // (ยกเว้นคนที่ไม่ระบุไซต์เหมือนกัน)
    const teamFilter = and(
      eq(usersTable.departmentId, currentDept!),
      ne(usersTable.id, user.id),
      isNull(usersTable.deletedAt),
      isAllSitesLeader 
        ? isNotNull(usersTable.site_id) 
        : eq(usersTable.site_id, currentSite!)
    );

    const [myRecordsRaw, allLeaveRequests, teamAttendanceRaw, myLeaveRequestsRaw] = await Promise.all([
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
            // เพิ่มฟิลด์เพื่อใช้ใน Mapping initialLeaves
            positionName: positionsTable.name,
            siteName: sitesTable.name,
          })
          .from(leaveTable)
          .innerJoin(usersTable, eq(leaveTable.user_id, usersTable.id))
          .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id))
          .leftJoin(sitesTable, eq(usersTable.site_id, sitesTable.id))
          .where(teamFilter)
          .orderBy(desc(leaveTable.startDate))
        : Promise.resolve([]),

      // 4. ประวัติเข้างานของทีม
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
            startTime: shiftsTable.startTime, 
            endTime: shiftsTable.endTime,    
          })
          .from(attendanceTable)
          .leftJoin(usersTable, eq(attendanceTable.user_id, usersTable.id)) 
          .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id))
          .leftJoin(sitesTable, eq(usersTable.site_id, sitesTable.id))
          .leftJoin(shiftsTable, eq(attendanceTable.shift_id, shiftsTable.id)) 
          .where(teamFilter)
          .orderBy(desc(attendanceTable.date), desc(attendanceTable.checkIn))
        : Promise.resolve([]),

      db.select({
        id: leaveTable.id,
        user_id: leaveTable.user_id,
        type: leaveTable.type,
        startDate: leaveTable.startDate,
        endDate: leaveTable.endDate,
        reason: leaveTable.reason,
        status: leaveTable.status,
        fileUrl: leaveTable.fileUrl,
      })
      .from(leaveTable)
      .where(eq(leaveTable.user_id, user.id))
      .orderBy(desc(leaveTable.startDate))
    ]);

    // 5. จัดเตรียมข้อมูล (Mapping พร้อมจัดการฟิลด์เวลา)
    const finalProps = {
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
        site: user.site || "ทุกไซต์งาน",
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
        siteName: t.site || "ทุกไซต์งาน",
        checkIn: t.checkIn ? t.checkIn.substring(0, 5) : null,
        checkOut: t.checkOut ? t.checkOut.substring(0, 5) : null,    
      })),
      initialLeaves: (allLeaveRequests || []).map(l => ({
        ...l,
        employeeName: `${l.firstName || ''} ${l.lastName || ''}`.trim() || "ไม่ระบุชื่อ",
        positionName: l.positionName || "พนักงาน",
        siteName: l.siteName || "ทุกไซต์งาน",
      })),
      myLeaves: (myLeaveRequestsRaw || []).map(l => ({
        ...l,
        start_date: l.startDate, 
        end_date: l.endDate,    
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