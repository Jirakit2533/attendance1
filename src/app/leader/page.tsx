import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { usersTable, attendanceTable, leaveTable } from "@/db/schema";
import { eq, desc, and, ne } from "drizzle-orm";
import LeaderClientPage from "./leaderClientPage";

export default async function LeaderPage() {
  const user = await getCurrentUser();

  // ป้องกันคนที่ไม่ใช่ Leader เข้าถึง
  if (!user || user.role !== "leader") {
    redirect("/login");
  }

  // --- 1. ดึงประวัติการเข้างานของตัว Leader เอง ---
  const myRecords = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.user_id, user.id))
    .orderBy(desc(attendanceTable.date));

  // --- 2. ดึงคำขอลาของพนักงาน (เฉพาะแผนกเดียวกัน + ไซต์เดียวกัน + ไม่ใช่ตัวเอง) ---
  const teamLeaveRequests = await db
    .select({
      id: leaveTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      type: leaveTable.type,
      startDate: leaveTable.startDate,
      endDate: leaveTable.endDate,
      reason: leaveTable.reason,
      status: leaveTable.status,
    })
    .from(leaveTable)
    .innerJoin(usersTable, eq(leaveTable.user_id, usersTable.id))
    .where(
      and(
        eq(usersTable.department, user.department), // แผนกเดียวกัน
        eq(usersTable.site_id, user.site_id),       // ไซต์เดียวกัน
        ne(usersTable.id, user.id),                 // ไม่เอาของตัวเอง
        eq(leaveTable.status, "pending")            // เฉพาะที่รออนุมัติ
      )
    );

  // --- 3. เพิ่มเติม: ดึงการเข้างานของพนักงานในทีม (แผนกเดียวกัน + ไซต์เดียวกัน) ---
  const teamAttendance = await db
    .select({
      id: attendanceTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      position: usersTable.position,
      date: attendanceTable.date,
      checkIn: attendanceTable.checkIn,
      checkOut: attendanceTable.checkOut,
      locationIn: attendanceTable.locationIn,
      imageIn: attendanceTable.imageIn,
    })
    .from(attendanceTable)
    .innerJoin(usersTable, eq(attendanceTable.user_id, usersTable.id))
    .where(
      and(
        eq(usersTable.department, user.department), // แผนกเดียวกัน
        eq(usersTable.site_id, user.site_id),       // ไซต์เดียวกัน
        ne(usersTable.id, user.id)                  // ไม่เอาของตัวเอง
      )
    )
    .orderBy(desc(attendanceTable.date), desc(attendanceTable.checkIn));

  // --- จัด Format ข้อมูลส่งไปให้ Client Component ---
  
  const formattedMyRecords = myRecords.map(r => ({
    date: r.date,
    checkIn: r.checkIn ? new Date(r.checkIn).toLocaleTimeString('th-TH') : "-",
    checkOut: r.checkOut ? new Date(r.checkOut).toLocaleTimeString('th-TH') : "-",
    location: r.locationIn,
    imageUrl: r.imageIn,
  }));

  const formattedTeamAttendance = teamAttendance.map(t => ({
    name: `${t.firstName} ${t.lastName}`,
    position: t.position,
    date: t.date,
    checkIn: t.checkIn ? new Date(t.checkIn).toLocaleTimeString('th-TH') : "-",
    checkOut: t.checkOut ? new Date(t.checkOut).toLocaleTimeString('th-TH') : "-",
    location: t.locationIn,
    imageUrl: t.imageIn,
  }));

  const formattedLeaves = teamLeaveRequests.map(l => ({
    id: l.id,
    employeeName: `${l.firstName} ${l.lastName}`,
    type: l.type,
    start: l.startDate,
    end: l.endDate,
    reason: l.reason,
    status: "รออนุมัติ"
  }));

  return (
    <LeaderClientPage 
      userProfile={user}
      myRecords={formattedMyRecords}
      teamAttendance={formattedTeamAttendance}
      teamLeaves={formattedLeaves}
    />
  );
}