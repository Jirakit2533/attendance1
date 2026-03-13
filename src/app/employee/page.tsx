import { getAttendanceHistory } from "@/server/attendance";
import { getLeaveHistory } from "@/server/leave";
import { getCurrentUser } from "@/lib/auth"; 
import EmployeeClientPage from "./employeeClientPage";
import { redirect } from "next/navigation";
import { db } from "@/db/db"; // นำเข้า db เพื่อเช็คความมีตัวตน
import { usersTable, positionsTable, sitesTable, departmentsTable, shiftsTable } from "@/db/schema";
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
    userName: usersTable.userName,      // ✅ เพิ่ม: เพื่อให้ Username Badge แสดงผล
    positionName: positionsTable.name, 
    siteName: sitesTable.name,          
    departmentName: departmentsTable.name, // ✅ เพิ่ม: เพื่อให้ชื่อแผนกแสดงผล
    // ✅ เพิ่ม: ดึงเวลาจาก shiftsTable
    startTime: shiftsTable.startTime,
    endTime: shiftsTable.endTime
  })
  .from(usersTable)
  .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id))
  .leftJoin(sitesTable, eq(usersTable.site_id, sitesTable.id))
  // ✅ ต้อง Join ตารางแผนกเพิ่มเพื่อให้ได้ชื่อแผนก (ไม่ใช่แค่ ID)
  .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id)) 
  // ✅ เพิ่ม Join shiftsTable เพื่อเอาข้อมูลเวลา
  .leftJoin(shiftsTable, eq(usersTable.id, shiftsTable.userId))
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

  // 3. Mapping ข้อมูล (เพิ่มฟิลด์สถานะเพื่อให้ตรงกับ UI)
  const initialRecords = dbRecords.map(r => ({
    date: r.date,
    // ปรับการแสดงผลเวลา (ตัดวินาทีออกถ้าเป็น string format)
    checkIn: r.checkIn ? String(r.checkIn).slice(0, 5) : "-",
    checkOut: r.checkOut ? String(r.checkOut).slice(0, 5) : "-",
    location: r.locationIn || "-",
    imageUrl: r.imageIn || "/profile.png",
    checkOutImageUrl: r.imageOut,
    position: user.positionName || "-",
    site: user.siteName || "-",
    role: user.role === "leader" ? "หัวหน้างาน" : "พนักงาน",
    // ✅ เพิ่มสถานะเพื่อให้ Client Page ตรวจสอบการแสดงสี/ไอคอนได้เหมือน Admin
    isLate: r.isLate ?? 0,
    isEarlyExit: r.isEarlyExit ?? 0,
    startTime: user.startTime, 
    endTime: user.endTime,
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
    userName: user.userName,     // ✅ เพิ่มเพื่อให้ Badge Username แสดงผล
    position: user.positionName, // ✅ ส่งชื่อตำแหน่งเข้าไป
    site: user.siteName,         // ✅ ส่งชื่อไซต์เข้าไป
    department: user.departmentName, // ✅ อย่าลืม Join แผนกใน Query ด้านบนด้วยถ้าต้องการโชว์
    // ✅ ส่งเวลาเข้า-ออกงานไปที่หน้า Client
    startTime: user.startTime,
    endTime: user.endTime
  };

  return (
    <EmployeeClientPage 
      userProfile={userProfile}
      initialRecords={initialRecords}
      initialLeaves={initialLeaves}
    />
  );
}