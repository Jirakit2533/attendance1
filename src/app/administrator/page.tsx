import { db } from "@/db/db";
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
import { redirect } from "next/navigation"; 
import AdminClientPage from "./adminClientPage";

export const dynamic = "force-dynamic"; // บังคับให้เป็น Dynamic ตลอดเวลา

export default async function AdminDashboardPage() {
  try {
    // 1. ตรวจสอบ Session Admin
    const cookieStore = await cookies();
    const adminId = cookieStore.get("session_user_id")?.value;

    if (!adminId) {
      redirect('/api/auth/logout-cleanup');
    }

    // 2. ดึงข้อมูลแอดมิน
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
      .where(and(
        eq(usersTable.id, adminId),
        isNull(usersTable.deletedAt)
      ))
      .limit(1);

    const currentAdmin = adminData[0];
    if (!currentAdmin) {
      redirect('/api/auth/logout-cleanup');
    }

    const companyId = currentAdmin.companyId;

    // 3. Fetch ข้อมูลแบบ Parallel พร้อมทำการ Join
    const [
      rawEmployees, 
      rawAttendance, 
      rawLeaves, 
      sitesData, 
      positionsData, 
      departmentsData
    ] = await Promise.all([
      // --- พนักงาน ---
      db.select({
        id: usersTable.id,
        userName: usersTable.userName, // ดึงมาใช้แก้ปัญหา UUID
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        role: usersTable.role,
        departmentId: usersTable.departmentId,
        positionName: positionsTable.name,
        siteName: sitesTable.name, // ชื่อไซต์ที่ Join มา
        siteId: usersTable.site_id,
        positionId: usersTable.positionId,
        avatarUrl: usersTable.avatarUrl,
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

      // --- การลงเวลา ---
      db.select({
        id: attendanceTable.id,
        date: attendanceTable.date,
        checkIn: attendanceTable.checkIn,
        checkOut: attendanceTable.checkOut,
        user_id: attendanceTable.user_id,
        locationIn: attendanceTable.locationIn,
        imageIn: attendanceTable.imageIn,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        siteName: sitesTable.name
      })
      .from(attendanceTable)
      .leftJoin(usersTable, eq(attendanceTable.user_id, usersTable.id))
      .leftJoin(sitesTable, eq(attendanceTable.site_id, sitesTable.id))
      .orderBy(desc(attendanceTable.date)),

      // --- การลางาน ---
      db.select({
        id: leaveTable.id,
        type: leaveTable.type,
        startDate: leaveTable.startDate,
        endDate: leaveTable.endDate,
        status: leaveTable.status,
        reason: leaveTable.reason,
        fileUrl: leaveTable.fileUrl,
        fileName: leaveTable.fileName,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        userName: usersTable.userName, 
        avatarUrl: usersTable.avatarUrl,
      })
      .from(leaveTable)
      .leftJoin(usersTable, eq(leaveTable.user_id, usersTable.id))
      .orderBy(desc(leaveTable.startDate)),

      // --- ข้อมูลพื้นฐาน ---
      db.select().from(sitesTable).where(eq(sitesTable.companyId, companyId || "")),
      db.select().from(positionsTable).where(eq(positionsTable.company_id, companyId || "")),
      db.select().from(departmentsTable).where(eq(departmentsTable.companyId, companyId || ""))
    ]);

    // 4. Mapping ข้อมูลให้ตรงกับ Client Page
    const employees = (rawEmployees || []).map(emp => {
      // ตรวจสอบ UserName: ถ้าเป็น UUID หรือค่าว่าง ให้ Fallback ไปที่ชื่อจริง
      const isUuid = emp.userName && emp.userName.length > 30;
      const finalUserName = isUuid ? emp.firstName?.toLowerCase() : (emp.userName || "user");

      return {
        id: String(emp.id || ""),
        userName: finalUserName, // แก้ไข: ใช้ชื่อตัวแปรที่ตรงกับที่ Client เรียก
        username: finalUserName, // ใส่เผื่อไว้ทั้งสองแบบป้องกัน Case Sensitive
        firstName: String(emp.firstName || ""),
        lastName: String(emp.lastName || ""),
        employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || "ไม่ระบุชื่อ",
        role: String(emp.role || "employee"),
        departmentId: emp.departmentId ? String(emp.departmentId) : null,
        positionId: emp.positionId ? String(emp.positionId) : null,
        siteId: emp.siteId ? String(emp.siteId) : null,
        site: String(emp.siteName || "ไม่ระบุ"), // แก้ไข: ส่งค่าชื่อไซต์ไปที่ e.site
        siteName: emp.siteName || "ไม่ระบุ",
        position: String(emp.positionName || "ไม่ระบุ"),
        avatarUrl: emp.avatarUrl || null,
      };
    });

    const attendance = (rawAttendance || []).map(at => ({
      id: String(at.id || ""),
      date: at.date ? String(at.date) : "",
      // ✅ ส่งค่าเดิมไปเลย ไม่ต้องสั่ง toLocaleTimeString ที่นี่
      checkIn: at.checkIn, 
      checkOut: at.checkOut,
      userId: String(at.user_id || ""),
      employeeName: `${at.firstName || ''} ${at.lastName || ''}`.trim() || "ไม่ระบุชื่อ",
      siteName: at.siteName || "General Site",
      locationIn: String(at.locationIn || "-"),
      imageIn: at.imageIn || null
    }));

    const leaves = (rawLeaves || []).map(l => ({
      id: String(l.id || ""),
      type: String(l.type || "ลากิจ"),
      startDate: l.startDate ? String(l.startDate) : "",
      endDate: l.endDate ? String(l.endDate) : "",
      status: String(l.status || "pending"),
      reason: String(l.reason || ""),
      fileUrl: l.fileUrl || null,
      fileName: l.fileName || null,
      employeeName: `${l.firstName || ''} ${l.lastName || ''}`.trim() || "ไม่ระบุพนักงาน",
      userName: String(l.userName || ""),
      avatarUrl: l.avatarUrl || null
    }));

    const sites = (sitesData || []).map(s => ({ id: String(s.id), name: String(s.name) }));
    const positions = (positionsData || []).map(p => ({ id: String(p.id), name: String(p.name) }));
    const departments = (departmentsData || []).map(d => ({ id: String(d.id), name: String(d.name) }));

    const adminProfile = {
      name: `${currentAdmin.firstName || ''} ${currentAdmin.lastName || ''}`.trim(),
      company: String(currentAdmin.companyName || "บริษัท"),
      role: "admin"
    };

    const rawProps = {
      initialEmployees: employees,
      initialAttendance: attendance,
      initialLeaves: leaves,
      admin: adminProfile,
      sites: sites,
      positions: positions,
      departments: departments
    };

    const safeProps = JSON.parse(
      JSON.stringify(rawProps, (key, value) => (value === undefined ? null : value))
    );

    return <AdminClientPage {...safeProps} />;

  } catch (error: any) {
    // 🛡️ 1. เช็คว่าเป็นคำสั่ง Redirect ของ Next.js หรือไม่
    // ถ้าใช่ ให้ปล่อยมันทำงาน (throw ต่อไป) เพื่อให้หน้าเว็บเปลี่ยนได้จริง
    if (error.message === 'NEXT_REDIRECT' || error.digest?.includes('NEXT_REDIRECT')) {
      throw error;
    }

    // 2. ถ้าไม่ใช่ Redirect (เป็น Error จริงๆ เช่น DB พัง) ให้ Log ออกมา
    console.error("Critical Dashboard Error:", error);
    
    // 3. ส่งไปหน้า Logout Cleanup เพื่อล้าง Session
    redirect('/api/auth/logout-cleanup');
  }
}