import { db } from "@/db";
import { 
  usersTable, 
  attendanceTable, 
  leaveTable, 
  sitesTable, 
  adminsTable, 
  companyTable,
  positionsTable,
  departmentsTable 
} from "@/db/schema";
import { desc, eq, and, or, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import AdminClientPage from "./adminClientPage";

export default async function AdminDashboardPage() {
  try {
    // 1. ดึง ID ของ Admin จาก Session
    const cookieStore = await cookies();
    const adminId = cookieStore.get("session_user_id")?.value;

    if (!adminId) {
      return (
        <div className="p-20 text-center">
          <div className="text-xl font-bold text-red-500">เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่</div>
        </div>
      );
    }

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

    // 3. Fetch ข้อมูลแบบ Parallel (ตรวจสอบชื่อ Field ให้ตรง Schema)
    const [rawEmployees, rawAttendance, rawLeaves, sitesData, positionsData, departmentsData] = await Promise.all([
      db.select({
        id: usersTable.id,
        username: usersTable.userName,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        role: usersTable.role,
        departmentId: usersTable.departmentId, // ✅ แก้ไขจาก department เป็น departmentId
        positionName: positionsTable.name,
        siteName: sitesTable.name,
        siteId: usersTable.site_id,
        positionId: usersTable.positionId,
        avatarUrl: usersTable.avatarUrl,
        avatarId: usersTable.avatarId,
      })
      .from(usersTable)
      .leftJoin(sitesTable, eq(usersTable.site_id, sitesTable.id))
      .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id))
      .where(
        and(
          or(eq(usersTable.role, 'employee'), eq(usersTable.role, 'leader')),
          eq(usersTable.createdBy, adminId),
          isNull(usersTable.deletedAt)
        )
      )
      .orderBy(desc(usersTable.created_at)),

      db.select().from(attendanceTable),
      db.select().from(leaveTable),
      db.select().from(sitesTable).where(eq(sitesTable.companyId, companyId)),
      db.select().from(positionsTable).where(eq(positionsTable.company_id, companyId)),
      db.select().from(departmentsTable).where(eq(departmentsTable.companyId, companyId))
    ]);

    // 4. Mapping ข้อมูลแบบละเอียด (ป้องกัน NULL และ Date Object พัง)
    const employees = (rawEmployees || []).map(emp => ({
      id: String(emp.id || ""),
      username: String(emp.username || ""),
      firstName: String(emp.firstName || ""),
      lastName: String(emp.lastName || ""),
      name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || "ไม่ระบุชื่อ",
      role: String(emp.role || "employee"),
      departmentId: emp.departmentId ? String(emp.departmentId) : null,
      positionId: emp.positionId ? String(emp.positionId) : null,
      siteId: emp.siteId ? String(emp.siteId) : null,
      position: String(emp.positionName || "ไม่ระบุ"),
      site: String(emp.siteName || "ไม่ระบุ"),
      avatarUrl: emp.avatarUrl || "",
      roleLabel: emp.role === 'leader' ? "หัวหน้างาน" : "พนักงาน"
    }));

    const attendance = (rawAttendance || []).map(at => ({
      id: String(at.id || ""),
      date: at.date ? String(at.date) : "",
      checkIn: at.checkIn ? new Date(at.checkIn).toISOString() : null,
      checkOut: at.checkOut ? new Date(at.checkOut).toISOString() : null,
      userId: String(at.user_id || ""),
      locationIn: String(at.locationIn || "-"),
      imageIn: at.imageIn || ""
    }));

    const leaves = (rawLeaves || []).map(l => ({
      id: String(l.id || ""),
      type: String(l.type || "ลากิจ"),
      startDate: l.startDate ? String(l.startDate) : "",
      endDate: l.endDate ? String(l.endDate) : "",
      status: String(l.status || "pending")
    }));

    const adminProfile = {
      name: `${currentAdmin.firstName || ''} ${currentAdmin.lastName || ''}`.trim(),
      company: String(currentAdmin.companyName || "บริษัท"),
      role: "admin"
    };

    // 5. บรรจุลง Props และ Clean ข้อมูลครั้งสุดท้ายด้วย JSON Parse/Stringify
    const cleanProps = JSON.parse(JSON.stringify({
      initialEmployees: employees,
      initialAttendance: attendance,
      initialLeaves: leaves,
      admin: adminProfile,
      sites: (sitesData || []).map(s => ({ id: String(s.id), name: String(s.name) })),
      positions: (positionsData || []).map(p => ({ id: String(p.id), name: String(p.name) })),
      departments: (departmentsData || []).map(d => ({ id: String(d.id), name: String(d.name) }))
    }));

    return <AdminClientPage {...cleanProps} />;

  } catch (error: any) {
    console.error("Database Error Detail:", error);
    return (
      <div className="p-20 text-center flex flex-col items-center gap-4">
        <div className="text-4xl">⚠️</div>
        <div className="text-xl font-bold text-slate-800">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>
        <div className="text-slate-500 max-w-md italic">{error.message}</div>
        <a 
          href="/administrator" 
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
        >
          ลองใหม่อีกครั้ง
        </a>
      </div>
    );
  }
}