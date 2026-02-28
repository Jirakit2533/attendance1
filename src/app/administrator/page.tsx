import { db } from "@/db";
import { 
  usersTable, 
  attendanceTable, 
  leaveTable, 
  sitesTable, 
  adminsTable, 
  companyTable,
  positionsTable // ✅ เพิ่มการนำเข้าตารางตำแหน่ง
} from "@/db/schema";
import { desc, eq, and, or } from "drizzle-orm";
import { cookies } from "next/headers";
import AdminClientPage from "./adminClientPage";

export default async function AdminDashboardPage() {
  try {
    // 1. ดึง ID ของ Admin จาก Session
    const cookieStore = await cookies();
    const adminId = cookieStore.get("session_user_id")?.value;

    if (!adminId) throw new Error("Unauthorized: ไม่พบข้อมูลเซสชัน");

    // 2. ดึงข้อมูลแอดมินและบริษัท
    const adminData = await db
      .select({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        companyId: adminsTable.company, 
        companyName: companyTable.name,
      })
      .from(usersTable)
      .innerJoin(adminsTable, eq(usersTable.id, adminsTable.user_id))
      .innerJoin(companyTable, eq(adminsTable.company, companyTable.id))
      .where(eq(usersTable.id, adminId))
      .limit(1);

    const currentAdmin = adminData[0];
    if (!currentAdmin) throw new Error("ไม่พบสิทธิ์การดูแลบริษัทสำหรับบัญชีนี้");

    const companyId = currentAdmin.companyId;

    // 3. Fetch ข้อมูลที่กรองตาม UUID Schema ใหม่
    const [rawEmployees, rawAttendance, rawLeaves, sitesData, positionsData] = await Promise.all([
      // ดึงพนักงาน + Join ชื่อตำแหน่ง และ ชื่อไซต์
      db.select({
        id: usersTable.id,
        username: usersTable.userName,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        role: usersTable.role,
        department: usersTable.department,
        positionName: positionsTable.name, // ✅ ดึงชื่อตำแหน่งจากการ Join
        siteName: sitesTable.name,         // ✅ ดึงชื่อไซต์จากการ Join
        siteId: usersTable.site_id,
        positionId: usersTable.positionId,
      })
      .from(usersTable)
      .leftJoin(sitesTable, eq(usersTable.site_id, sitesTable.id))
      .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id)) // ✅ Join ตำแหน่งเพิ่ม
      .where(
        and(
          or(eq(usersTable.role, 'employee'), eq(usersTable.role, 'leader')),
          eq(usersTable.createdBy, adminId)
        )
      ),

      db.select().from(attendanceTable).orderBy(desc(attendanceTable.date)),
      db.select().from(leaveTable).orderBy(desc(leaveTable.startDate)),
      
      // ✅ ดึงไซต์งานของบริษัทนี้
      db.select().from(sitesTable).where(eq(sitesTable.companyId, companyId)),

      // ✅ ดึงตำแหน่งงานของบริษัทนี้ (ไม่ใช่ Array ข้อความคงที่แล้ว)
      db.select().from(positionsTable).where(eq(positionsTable.company_id, companyId))
    ]);

    // 4. Mapping ข้อมูลพนักงาน
    const employees = rawEmployees.map(emp => ({
      ...emp,
      name: `${emp.firstName} ${emp.lastName}`,
      position: emp.positionName || "ไม่ระบุ", // ใช้ชื่อที่ Join มาได้
      site: emp.siteName || "ไม่ระบุ",
      roleLabel: emp.role === 'leader' ? "หัวหน้างาน" : "พนักงาน"
    }));

    const adminProfile = {
      name: `${currentAdmin.firstName} ${currentAdmin.lastName}`,
      company: currentAdmin.companyName,
      role: "admin"
    };

    return (
      <AdminClientPage 
        initialEmployees={employees} 
        initialAttendance={rawAttendance} 
        initialLeaves={rawLeaves}
        admin={adminProfile}
        sites={sitesData} // ✅ ส่งเป็น Array of Objects [{id, name, ...}]
        positions={positionsData} // ✅ ส่งเป็น Array of Objects [{id, name, ...}]
      />
    );

  } catch (error: any) {
    console.error("Database Error:", error);
    // ... ส่วน Error UI เดิมของคุณ ...
    return <div className="p-20 text-center">เกิดข้อผิดพลาด: {error.message}</div>;
  }
}