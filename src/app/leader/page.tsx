import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { usersTable, attendanceTable, leaveTable } from "@/db/schema";
import { eq, desc, and, ne } from "drizzle-orm";
import LeaderClientPage from "./leaderClientPage";

export default async function LeaderPage() {
  const user = await getCurrentUser();

  // 1. ป้องกันคนที่ไม่ใช่ Leader หรือไม่มีข้อมูลสำคัญ
  if (!user || user.role !== "leader") {
    redirect("/login");
  }

  // ป้องกัน Error SQL: ตรวจสอบว่ามีค่า site และ department หรือไม่
  // หากไม่มีให้ส่งค่าว่างเป็น String เพื่อไม่ให้ Query พัง (หรือจะจัดการ Error ตามเหมาะสม)
  const currentDept = user.department ?? "";
  const currentSite = user.site_id ?? "";

  try {
    // --- 2. ดึงประวัติการเข้างานของตัว Leader เอง ---
    const myRecords = await db
      .select()
      .from(attendanceTable)
      .where(eq(attendanceTable.user_id, user.id))
      .orderBy(desc(attendanceTable.date));

    // --- 3. ดึงคำขอลา (Leader + ทีม) ---
    const allLeaveRequests = await db
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
      })
      .from(leaveTable)
      .innerJoin(usersTable, eq(leaveTable.user_id, usersTable.id))
      .where(
        and(
          eq(usersTable.department, currentDept),
          eq(usersTable.site_id, currentSite)
        )
      )
      .orderBy(desc(leaveTable.startDate));

    // --- 4. ดึงการเข้างานของพนักงานในทีม (ยกเว้นตัวเอง) ---
    const teamAttendance = await db
      .select({
        id: attendanceTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        positionId: usersTable.positionId,
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
      .where(
        and(
          eq(usersTable.department, currentDept),
          eq(usersTable.site_id, currentSite),
          ne(usersTable.id, user.id)
        )
      )
      .orderBy(desc(attendanceTable.date), desc(attendanceTable.checkIn));

    // --- 5. จัด Format ข้อมูล (เน้นความปลอดภัยของ Date และ String) ---
    
    const formattedMyRecords = (myRecords || []).map(r => ({
      date: r.date,
      checkIn: r.checkIn ? new Date(r.checkIn).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : "-",
      checkOut: r.checkOut ? new Date(r.checkOut).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : "-",
      location: r.locationIn || "-",
      imageUrl: r.imageIn || null,
      imageOutUrl: r.imageOut || null,
    }));

    const formattedTeamAttendance = (teamAttendance || []).map(t => ({
      employeeName: `${t.firstName || ''} ${t.lastName || ''}`.trim(),
      position: t.positionId || "พนักงาน",
      date: t.date,
      checkIn: t.checkIn ? new Date(t.checkIn).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : "-",
      checkOut: t.checkOut ? new Date(t.checkOut).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : "-",
      location: t.locationIn || "-",
      locationOut: t.locationOut || "-",
      imageUrl: t.imageIn || null,
      imageOutUrl: t.imageOut || null,
    }));

    const formattedLeaves = (allLeaveRequests || []).map(l => ({
      id: l.id,
      employeeName: `${l.firstName || ''} ${l.lastName || ''}`.trim(),
      type: l.type || "ลากิจ",
      startDate: l.startDate,
      endDate: l.endDate,
      reason: l.reason || "-",
      status: l.status || "pending",
      fileUrl: l.fileUrl || null,
    }));

    // ใช้ JSON Cleanse เพื่อป้องกันพวกค่า undefined หลุดไป Client
    const finalProps = JSON.parse(JSON.stringify({
      userProfile: user,
      initialRecords: formattedMyRecords,
      initialTeamAttendance: formattedTeamAttendance,
      initialLeaves: formattedLeaves,
    }));

    return <LeaderClientPage {...finalProps} />;

  } catch (error) {
    console.error("Leader Page Error:", error);
    return <div className="p-10 text-red-500 font-bold text-center">เกิดข้อผิดพลาดในการโหลดข้อมูลกรุณาลองใหม่อีกครั้ง</div>;
  }
}