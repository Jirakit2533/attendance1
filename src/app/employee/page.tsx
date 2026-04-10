import { getCurrentUser } from "@/lib/auth";
import EmployeeClientPage from "./employeeClientPage";
import { redirect } from "next/navigation";
import { db } from "@/db/db"; // นามเข้า db เพื่อเช็คความมีตัวตน
import {
  usersTable,
  positionsTable,
  sitesTable,
  departmentsTable,
  shiftsTable,
  leaveTable,
  companyTable,
  attendanceTable,
  overtimeRequestsTable, // ✅ เพิ่ม: นำเข้าตาราง OT
} from "@/db/schema"; // เพิ่ม companyTable และ attendanceTable
import { eq, and, isNull, or, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export const dynamic = "force-dynamic"; // บังคับให้เป็น Dynamic ตลอดเวลา


export default async function Page() {
  // 1. ดึงข้อมูล User จาก Session/Cookie เบื้องต้น
  const userFromAuth = await getCurrentUser();

  // 🛡️ [SECURITY CHECK] ถ้าไม่มีข้อมูลจาก auth หรือไม่มี ID ให้ดีดไปล้างคุกกี้
  if (!userFromAuth || !userFromAuth.id) {
    redirect("/api/auth/logout-cleanup");
  }

  // 🔍 ตรวจสอบกับฐานข้อมูลโดยตรงอีกครั้ง (เผื่อกรณี User ถูกลบไปแล้วแต่คุกกี้ยังค้าง)
  const userExists = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      avatarUrl: usersTable.avatarUrl,
      role: usersTable.role,
      userName: usersTable.userName, // ✅ เพิ่ม: เพื่อให้ Username Badge แสดงผล
      positionName: positionsTable.name,
      siteName: sitesTable.name,
      departmentName: departmentsTable.name, // ✅ เพิ่ม: เพื่อให้ชื่อแผนกแสดงผล
      // ✅ เพิ่ม: ดึงเวลาจาก shiftsTable
      startTime: shiftsTable.startTime,
      endTime: shiftsTable.endTime,
      // ✅ เพิ่มการดึงข้อมูลบริษัท
      companyName: companyTable.name,
      companyLogo: companyTable.logoUrl,
      companyDescription: companyTable.description,
    })
    .from(usersTable)
    .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id))
    .leftJoin(sitesTable, eq(usersTable.site_id, sitesTable.id))
    // ✅ ต้อง Join ตารางแผนกเพิ่มเพื่อให้ได้ชื่อแผนก (ไม่ใช่แค่ ID)
    .leftJoin(
      departmentsTable,
      eq(usersTable.departmentId, departmentsTable.id)
    )
    // ✅ เพิ่ม Join shiftsTable เพื่อเอาข้อมูลเวลา
    .leftJoin(shiftsTable, eq(usersTable.id, shiftsTable.userId))
    // ✅ Join เพื่อดึงข้อมูลบริษัท
    .leftJoin(companyTable, eq(usersTable.companyId, companyTable.id))
    .where(
      and(eq(usersTable.id, userFromAuth.id), isNull(usersTable.deletedAt))
    )
    .limit(1);

  // 🚩 ถ้าหาไม่เจอใน DB (ถูกลบไปแล้ว) ให้กวาดล้างคุกกี้ในมือถือทิ้งทันที
  if (userExists.length === 0) {
    redirect("/api/auth/logout-cleanup");
  }

  const user = userExists[0];

  // 2. ดึงข้อมูลประวัติการเข้างานโดยตรงเพื่อให้มั่นใจว่าได้ฟิลด์ Snapshot
  const dbRecords = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.user_id, user.id))
    /* ✅ แก้ไข: เรียงตามวันที่ล่าสุด และเวลาเข้างานล่าสุด */
    .orderBy(desc(attendanceTable.date), desc(attendanceTable.checkIn))
    .limit(20); // 🔥 เพิ่มการจำกัดจำนวนประวัติการเข้างาน

  // 🔍 ดึงข้อมูลการลาพร้อม Join หาชื่อผู้อนุมัติ/ผู้ปฏิเสธ และ "ชื่อตำแหน่ง" ของผู้อนุมัติ
  const approver = alias(usersTable, "approver");
  const approverPos = alias(positionsTable, "approverPos");

  const dbLeaves = await db
    .select({
      type: leaveTable.type,
      startDate: leaveTable.startDate,
      endDate: leaveTable.endDate,
      startTime: leaveTable.startTime, // ✅ เพิ่มดึงเวลาเริ่มต้น
      endTime: leaveTable.endTime,     // ✅ เพิ่มดึงเวลาสิ้นสุด
      totalHours: leaveTable.totalHours, // ✅ เพิ่มดึงจำนวนชั่วโมงรวม
      remark: leaveTable.remark,
      reason: leaveTable.reason,
      status: leaveTable.status,
      createdAt: leaveTable.createdAt, // ✅ ดึง createdAt มาใช้
      approverFirst: approver.firstName,
      approverLast: approver.lastName,
      approverPositionName: approverPos.name, // ✅ ดึงชื่อตำแหน่งของผู้อนุมัติ
    })
    .from(leaveTable)
    .leftJoin(
      approver,
      or(
        eq(leaveTable.approvedBy, approver.id),
        eq(leaveTable.rejectedBy, approver.id)
      )
    )
    .leftJoin(approverPos, eq(approver.positionId, approverPos.id)) // ✅ Join ต่อไปหาชื่อตำแหน่งของผู้อนุมัติ
    .where(eq(leaveTable.user_id, user.id))
    /* ✅ แก้ไข: ใช้ createdAt เรียงลำดับรายการที่เพิ่งสร้างล่าสุดไว้บนสุด (แม่นยำกว่าใช้วันที่ลา) */
    .orderBy(desc(leaveTable.createdAt))
    .limit(2); // 🔥 จำกัดจำนวนคำขอลางานให้เหลือเพียง 2 รายการล่าสุดตามที่สั่ง

  // 🔍 3. ดึงข้อมูล OT พร้อม Join หาชื่อผู้อนุมัติ
  const otApprover = alias(usersTable, "otApprover");
  const dbOT = await db
    .select({
      id: overtimeRequestsTable.id,
      overtimeByRequest: overtimeRequestsTable.overtimeByRequest,
      status: overtimeRequestsTable.status,
      remark: overtimeRequestsTable.remarks, // ✅ เปลี่ยน Alias เป็น remark ให้ตรงกับที่ใช้
      reason: overtimeRequestsTable.reason, // ✅ เพิ่ม: ดึงเหตุผลที่พนักงานกรอก
      createdAt: overtimeRequestsTable.createdAt,
      approverFirst: otApprover.firstName,
      approverLast: otApprover.lastName,
    })
    .from(overtimeRequestsTable)
    .leftJoin(
      otApprover,
      or(
        eq(overtimeRequestsTable.approvedBy, otApprover.id),
        eq(overtimeRequestsTable.rejectedBy, otApprover.id)
      )
    )
    .where(eq(overtimeRequestsTable.userId, user.id))
    .orderBy(desc(overtimeRequestsTable.createdAt))
    .limit(10); // 🔥 ดึงประวัติ OT 10 รายการล่าสุด

  // 4. Mapping ข้อมูล (เพิ่มฟิลด์สถานะเพื่อให้ตรงกับ UI)
  const initialRecords = (dbRecords || []).map((r) => ({
    date: r.date,
    // ปรับการแสดงผลเวลา (ตัดวินาทีออกถ้าเป็น string format)
    checkIn: r.checkIn ? String(r.checkIn).slice(0, 5) : "-",
    checkOut: r.checkOut ? String(r.checkOut).slice(0, 5) : "-",
    location: r.locationIn || "-",
    imageUrl: r.imageIn || "/profile.png",
    checkOutImageUrl: r.imageOut,
    position: user.positionName || "-",
    // ✅ เปลี่ยนไปใช้ข้อมูลจาก Snapshot ใน Record (r) แทน
    site: r.siteInNameSnapshot || "-",
    role: user.role === "leader" ? "หัวหน้างาน" : "พนักงาน",
    // ✅ เพิ่มสถานะเพื่อให้ Client Page ตรวจสอบการแสดงสี/ไอคอนได้เหมือน Admin
    isLate: r.isLate ?? 0,
    isEarlyExit: r.isEarlyExit ?? "0",
    // ✅ เปลี่ยนไปใช้ข้อมูลเวลาจาก Snapshot ใน Record (r) แทน
    startTime: r.shiftStartTimeSnapshot,
    endTime: r.shiftEndTimeSnapshot,
  }));

  const initialLeaves = (dbLeaves || []).map((l) => {
    // ✅ จัดการ Format createdAt เป็น วันที่/เดือน/ปี ชม.:นาที
    const formattedCreatedAt = (() => {
      if (!l.createdAt) return "-";
      
      const dateObj = new Date(l.createdAt);
      
      // 🛡️ ตรวจสอบว่า Date ถูกต้องหรือไม่
      if (isNaN(dateObj.getTime())) return "-";
    
      try {
        return dateObj
          .toLocaleString("en-GB", {
            timeZone: "UTC", // บังคับ Timezone เป็น UTC ตามมาตรฐานข้อมูลใน DB
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          })
          .replace(",", "");
      } catch (e) {
        return "-";
      }
    })();

    return {
      type: l.type,
      start: l.startDate,
      end: l.endDate,
      startTime: l.startTime, // ✅ ส่งเวลาเริ่มต้นไป UI
      endTime: l.endTime,     // ✅ ส่งเวลาสิ้นสุดไป UI
      totalHours: l.totalHours || 0, // ✅ ส่งค่าตัวเลขชั่วโมง/นาทีไปคำนวณที่ UI
      remark: l.remark,
      reason: l.reason,
      requestDate: formattedCreatedAt, // ✅ ชื่อคีย์สำหรับนำไปวางฝั่ง UI
      status:
        l.status === "pending"
          ? "รออนุมัติ"
          : l.status === "approved"
          ? "อนุมัติแล้ว"
          : l.status === "rejected"
          ? "ปฏิเสธ"
          : l.status,
      // ✅ ดึงชื่อผู้อนุมัติ และชื่อตำแหน่งผู้อนุมัติ จากข้อมูลที่ Join มา
      approverName: l.approverFirst
        ? `${l.approverFirst} ${l.approverLast || ""}`.trim()
        : "-",
      approverPosition: l.approverPositionName || "-", // ✅ ส่งชื่อตำแหน่งผู้อนุมัติไปแสดงผล
    };
  });

  // 5. Mapping ข้อมูล OT ให้ตรงกับคีย์ที่ UI ต้องการ
  const initialOT = (dbOT || []).map((ot) => ({
    createdAt: ot.createdAt,
    overtimeByRequest: ot.overtimeByRequest,
    status: ot.status,
    remark: ot.remark, // ✅ ส่งหมายเหตุแอดมิน (remarks เดิม)
    reason: ot.reason, // ✅ ส่งเหตุผลพนักงาน (reason ใหม่)
    approverName: ot.approverFirst
      ? `${ot.approverFirst} ${ot.approverLast || ""}`.trim()
      : "-",
  }));

  // เตรียมโปรไฟล์ให้ Client Page
  const userProfile = {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    userName: user.userName, // ✅ เพิ่มเพื่อให้ Badge Username แสดงผล
    position: user.positionName, // ✅ ส่งชื่อตำแหน่งเข้าไป
    site: user.siteName, // ✅ ส่งชื่อไซต์เข้าไป
    department: user.departmentName, 
    // ✅ ส่งเวลาเข้า-ออกงานไปที่หน้า Client
    startTime: user.startTime,
    endTime: user.endTime,
  };

  // สร้างชื่อคีย์สำหรับข้อมูลบริษัทเพื่อนำไปใช้ใน UI
  const companyData = {
    name: user.companyName || "Company Name",
    logoUrl: user.companyLogo || null,
    description: user.companyDescription || "",
  };

  return (
    <EmployeeClientPage
      userProfile={userProfile}
      initialRecords={initialRecords}
      initialLeaves={initialLeaves}
      initialOT={initialOT} // ✅ ส่งข้อมูล OT ไปยัง Client Page
      companyData={companyData} // ✅ ส่งข้อมูลบริษัทไปด้วย
    />
  );
}