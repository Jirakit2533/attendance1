import { getAttendanceHistory } from "@/server/attendance";
import { getLeaveHistory } from "@/server/leave";
import { getCurrentUser } from "@/lib/auth"; // 1. ต้อง import ตัวนี้มาใช้ดึง session
import EmployeeClientPage from "./employeeClientPage"; // 2. ต้อง import UI มาแสดงผล
import { redirect } from "next/navigation";

export default async function Page() {
  // 3. เปิดใช้งานการดึง User (ห้ามคอมเมนต์ออก)
  const user = await getCurrentUser();

  // 4. ถ้าไม่มี User (ไม่ได้ Login) ให้ดีดกลับไปหน้า Login ทันที
  if (!user) {
    redirect("/login");
  }

  // 5. ดึงข้อมูลจากฐานข้อมูลจริง
  const dbRecords = await getAttendanceHistory(user.id);
  const dbLeaves = await getLeaveHistory(user.id);

  // แปลงข้อมูลจาก DB ให้ตรงกับ Interface ของ Client
  const initialRecords = dbRecords.map(r => ({
    date: r.date, // ปกติเก็บเป็น string YYYY-MM-DD อยู่แล้ว
    checkIn: r.checkIn ? new Date(r.checkIn).toLocaleTimeString('th-TH') : "-",
    checkOut: r.checkOut ? new Date(r.checkOut).toLocaleTimeString('th-TH') : "-",
    location: r.locationIn || "-",
    imageUrl: r.imageIn || "/profile.png", // ใช้รูปโปรไฟล์สำรองถ้าไม่มีรูปถ่าย
    checkOutImageUrl: r.imageOut,
    position: user.position || "พนักงาน"
  }));

  const initialLeaves = dbLeaves.map(l => ({
    type: l.type,
    start: l.startDate,
    end: l.endDate,
    reason: l.reason,
    days: 0,
    status: l.status === "pending" ? "รออนุมัติ" : l.status
  }));

  return (
    <EmployeeClientPage 
      userProfile={user}
      initialRecords={initialRecords}
      initialLeaves={initialLeaves}
    />
  );
}