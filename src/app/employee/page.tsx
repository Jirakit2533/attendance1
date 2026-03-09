import { getAttendanceHistory } from "@/server/attendance";
import { getLeaveHistory } from "@/server/leave";
import { getCurrentUser } from "@/lib/auth"; 
import EmployeeClientPage from "./employeeClientPage";
import { redirect } from "next/navigation";
import { db } from "@/db/db"; // นำเข้า db เพื่อเช็คความมีตัวตน
import { usersTable, positionsTable, sitesTable } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

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
    positionName: positionsTable.name, // ✅ ดึงชื่อตำแหน่ง
    siteName: sitesTable.name,         // ✅ ดึงชื่อไซต์
  })
  .from(usersTable)
  .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id)) // ✅ Join Position
  .leftJoin(sitesTable, eq(usersTable.site_id, sitesTable.id))             // ✅ Join Site
  .where(and(
    eq(usersTable.id, userFromAuth.id),
    isNull(usersTable.deletedAt)
  ))
  .limit(1);

  // 🚩 ถ้าหาไม่เจอใน DB (ถูกลบไปแล้ว) ให้กวาดล้างคุกกี้ในมือถือทิ้งทันที
  if (userExists.length === 0) {
    redirect("/api/auth/logout-cleanup");
  }

  const user = userExists[0];

  // 2. ดึงข้อมูลจากฐานข้อมูลจริงโดยใช้ ID ที่ตรวจสอบแล้ว
  const dbRecords = await getAttendanceHistory(user.id);
  const dbLeaves = await getLeaveHistory(user.id);

  // 3. Mapping ข้อมูล (คงเดิมตาม Logic ของคุณ)
  const initialRecords = dbRecords.map(r => ({
    date: r.date,
    checkIn: r.checkIn ? new Date(r.checkIn).toLocaleTimeString('th-TH') : "-",
    checkOut: r.checkOut ? new Date(r.checkOut).toLocaleTimeString('th-TH') : "-",
    location: r.locationIn || "-",
    imageUrl: r.imageIn || "/profile.png",
    checkOutImageUrl: r.imageOut,
    position: user.positionName || "-",
    site: user.siteName || "-",
    role: user.roleName === "leader" ? "หัวหน้างาน" : "พนักงาน" // ปรับตาม role จริงจาก DB
  }));

  const initialLeaves = dbLeaves.map(l => ({
    type: l.type,
    start: l.startDate,
    end: l.endDate,
    reason: l.reason,
    days: 0,
    status: l.status === "pending" ? "รออนุมัติ" : 
            l.status === "approved" ? "อนุมัติ" : 
            l.status === "rejected" ? "ปฏิเสธ" : l.status
  }));

  // เตรียมโปรไฟล์ให้ Client Page
  const userProfile = {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    // เพิ่ม field อื่นๆ ที่ EmployeeClientPage จำเป็นต้องใช้
  };

  return (
    <EmployeeClientPage 
      userProfile={userProfile}
      initialRecords={initialRecords}
      initialLeaves={initialLeaves}
    />
  );
}