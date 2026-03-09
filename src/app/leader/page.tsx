import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db/db";
import { usersTable, attendanceTable, leaveTable, positionsTable } from "@/db/schema";
import { eq, desc, and, ne, isNull } from "drizzle-orm";
import LeaderClientPage from "./leaderClientPage";

export const dynamic = "force-dynamic"; // บังคับให้เป็น Dynamic ตลอดเวลา

export default async function LeaderPage() {
  // 1. ดึงข้อมูล User จาก Session
  const userFromAuth = await getCurrentUser();

  // 🛡️ Security Check
  if (!userFromAuth || userFromAuth.role !== "leader") {
    redirect("/api/auth/logout-cleanup");
  }

  // 🔍 ดึง Profile ล่าสุด
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
  const isAllSitesLeader = !currentSite;

  try {
    // --- 2. ดึงประวัติการเข้างานของตัว Leader เอง ---
    const myRecordsRaw = await db
      .select()
      .from(attendanceTable)
      .where(eq(attendanceTable.user_id, user.id))
      .orderBy(desc(attendanceTable.date), desc(attendanceTable.checkIn))
      .limit(31); // ดึงเผื่อไว้สำหรับ Filter รายเดือน

    let allLeaveRequests: any[] = [];
    let teamAttendanceRaw: any[] = [];

    // --- 3. ดึงข้อมูลทีม ---
    if (currentDept) {
      const siteCondition = isAllSitesLeader ? [] : [eq(usersTable.site_id, currentSite!)];

      allLeaveRequests = await db
        .select({
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
          site_id: leaveTable.site_id,
        })
        .from(leaveTable)
        .innerJoin(usersTable, eq(leaveTable.user_id, usersTable.id))
        .where(
          and(
            eq(usersTable.departmentId, currentDept),
            ...siteCondition,
            isNull(usersTable.deletedAt)
          )
        )
        .orderBy(desc(leaveTable.startDate));

      teamAttendanceRaw = await db
        .select({
          id: attendanceTable.id,
          userId: attendanceTable.user_id, // เพิ่มเพื่อใช้ตรวจสอบใน Client
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
            ne(usersTable.id, user.id),
            isNull(usersTable.deletedAt)
          )
        )
        .orderBy(desc(attendanceTable.date), desc(attendanceTable.checkIn));
    }

    // --- 4. จัด Props (สำคัญ: ห้ามใส่ || "-" ที่นี่ เพื่อให้ Logic Client ทำงานได้) ---
    const finalProps = {
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
      // ✅ ส่งค่าดิบเพื่อให้วันนี้สถานะ hasCheckedOut เช็คเจอว่าเป็น null จริงๆ
      myRecords: myRecordsRaw.map(r => ({
        id: r.id,
        date: r.date,
        checkIn: r.checkIn, 
        checkOut: r.checkOut, 
        imageIn: r.imageIn,
        imageOut: r.imageOut,
        location: r.locationIn || r.locationOut || "ไม่ได้ระบุพิกัด",
        position: user.role
      })),
      // ✅ Mapping ข้อมูลทีมสำหรับ Filter
      initialAttendance: teamAttendanceRaw.map(t => ({
        ...t,
        employeeName: `${t.firstName || ''} ${t.lastName || ''}`.trim(),
        location: t.locationIn || t.locationOut || "ไม่ได้ระบุพิกัด"
      })),
      initialLeaves: allLeaveRequests.map(l => ({
        ...l,
        employeeName: `${l.firstName || ''} ${l.lastName || ''}`.trim(),
      })),
    };

    const serializedProps = JSON.parse(JSON.stringify(finalProps));
    return <LeaderClientPage {...serializedProps} />;

  } catch (error) {
    console.error("Leader Page Critical Error:", error);
    throw error; 
  }
}