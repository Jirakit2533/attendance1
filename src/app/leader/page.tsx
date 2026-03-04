import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { usersTable, attendanceTable, leaveTable, positionsTable } from "@/db/schema";
import { eq, desc, and, ne, isNull } from "drizzle-orm";
import LeaderClientPage from "./leaderClientPage";

export default async function LeaderPage() {
  // 1. ดึงข้อมูล User จาก Session
  const userFromAuth = await getCurrentUser();

  // 🛡️ Security Check: ต้องมี Session และเป็น Leader เท่านั้น
  if (!userFromAuth || userFromAuth.role !== "leader") {
    redirect("/api/auth/logout-cleanup");
  }

  // 🔍 ดึง Profile ล่าสุดเพื่อเช็ค Department และ Site
  const userExists = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, userFromAuth.id), isNull(usersTable.deletedAt)))
    .limit(1);

  if (userExists.length === 0) {
    redirect("/api/auth/logout-cleanup");
  }

  const user = userExists[0];
  const currentDept = user.departmentId;
  const currentSite = user.site_id;

  // 💡 หัวใจสำคัญ: ถ้า site_id เป็น null แสดงว่าดูได้ "ทุกไซต์" ในแผนกนั้น
  const isAllSitesLeader = !currentSite;

  try {
    // --- 2. ดึงประวัติการเข้างานของตัว Leader เอง ---
    const myRecords = await db
      .select()
      .from(attendanceTable)
      .where(eq(attendanceTable.user_id, user.id))
      .orderBy(desc(attendanceTable.date), desc(attendanceTable.checkIn))
      .limit(10);

    // เตรียมตัวแปรสำหรับข้อมูลทีม
    let allLeaveRequests: any[] = [];
    let teamAttendance: any[] = [];

    // --- 3. ดึงข้อมูลทีม (กรองตามเงื่อนไข Dept และ Site) ---
    if (currentDept) {
      // 🏗️ สร้าง Filter สำหรับ Site
      // ถ้าเป็น All Sites (site_id is null) ไม่ต้องใส่เงื่อนไข site_id ใน where clause
      // ถ้าไม่ใช่ ให้กรองเฉพาะพนักงานที่อยู่ site_id เดียวกับหัวหน้า
      const siteCondition = isAllSitesLeader ? [] : [eq(usersTable.site_id, currentSite!)];

      // ดึงคำขอลาของทีม
      allLeaveRequests = await db
        .select({
          id: leaveTable.id,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          type: leaveTable.type,
          startDate: leaveTable.startDate,
          endDate: leaveTable.endDate,
          reason: leaveTable.reason,
          status: leaveTable.status,
          fileUrl: leaveTable.fileUrl,
          site_id: leaveTable.site_id,
        })
        .from(leaveTable)
        .innerJoin(usersTable, eq(leaveTable.user_id, usersTable.id))
        .where(
          and(
            eq(usersTable.departmentId, currentDept),
            ...siteCondition, // ใส่เงื่อนไข site ถ้ามี
            isNull(usersTable.deletedAt)
          )
        )
        .orderBy(desc(leaveTable.startDate));

      // ดึงการเข้างานของพนักงานในทีม (ยกเว้นตัวหัวหน้าเอง)
      teamAttendance = await db
        .select({
          id: attendanceTable.id,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          userName: usersTable.userName,
          avatarUrl: usersTable.avatarUrl,
          positionName: positionsTable.name,
          date: attendanceTable.date,
          checkIn: attendanceTable.checkIn,
          checkOut: attendanceTable.checkOut,
          locationIn: attendanceTable.locationIn,
          locationOut: attendanceTable.locationOut,
          imageIn: attendanceTable.imageIn,
          imageOut: attendanceTable.imageOut,
          site_id: attendanceTable.site_id,
        })
        .from(attendanceTable)
        .innerJoin(usersTable, eq(attendanceTable.user_id, usersTable.id))
        .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id))
        .where(
          and(
            eq(usersTable.departmentId, currentDept),
            ...siteCondition,
            ne(usersTable.id, user.id), // ไม่เอาตัวเองมาโชว์ในตารางทีม
            isNull(usersTable.deletedAt)
          )
        )
        .orderBy(desc(attendanceTable.date), desc(attendanceTable.checkIn));
    }

    // --- 4. จัด Props และทำ Serialization ---
    // หมายเหตุ: เราจะไม่ Format วันที่ตรงนี้ เพื่อให้ Client Component นำไปคำนวณหรือใช้ต่อได้สะดวก
    const finalProps = JSON.parse(JSON.stringify({
      userProfile: {
        id: user.id,
        role: user.role,
        departmentId: user.departmentId,
        site_id: user.site_id,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName} ${user.lastName}`,
        avatarUrl: user.avatarUrl,
        isAllSites: isAllSitesLeader
      },
      myRecords: myRecords,
      initialAttendance: teamAttendance.map(t => ({
        ...t,
        employeeName: `${t.firstName || ''} ${t.lastName || ''}`.trim(),
      })),
      initialLeaves: allLeaveRequests.map(l => ({
        ...l,
        employeeName: `${l.firstName || ''} ${l.lastName || ''}`.trim(),
      })),
    }));

    return <LeaderClientPage {...finalProps} />;

  } catch (error) {
    console.error("Leader Page Critical Error:", error);
    throw error; 
  }
}