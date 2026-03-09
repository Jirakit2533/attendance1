import { db } from "@/db/db";
import { companyTable, usersTable, adminsTable, superAdminTable } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { cookies } from "next/headers"; // Next.js 16+ cookies() returns a Promise
import { redirect } from "next/navigation"; 
import SuperAdminClientPage from "./superAdminClientPage";

export const dynamic = "force-dynamic"; // บังคับให้เป็น Dynamic ตลอดเวลา

export default async function SuperAdminPage() {
  // 🛡️ [SECURITY CHECK] ตรวจสอบความมีตัวตนใน Database
  // บรรทัดนี้สำคัญที่สุด: ต้องมี await นำหน้า cookies()
  const cookieStore = await cookies(); 
  const userId = cookieStore.get('session_user_id')?.value;

  // 1. ดึงข้อมูล Super Admin สำหรับ Profile และใช้ตรวจสอบตัวตน
  // ปรับให้ดึงแบบระบุ ID จากคุกกี้เพื่อเช็คว่า User นี้ยังอยู่ในสารบบไหม
  const superAdminData = await db
    .select({
      id: superAdminTable.id,
      name: superAdminTable.name,
    })
    .from(superAdminTable)
    .where(eq(superAdminTable.id, userId || "")) // ตรวจสอบ ID ตรงๆ
    .limit(1);

  // 🚩 ถ้า userId ในคุกกี้ไม่มีใน Table superAdmin (ถูกลบไปแล้ว) 
  // ให้ดีดไปหน้า API Cleanup เพื่อล้างคุกกี้ในมือถือทิ้งทันที
  if (superAdminData.length === 0) {
    redirect('/api/auth/logout-cleanup');
  }

  // 2. ดึงข้อมูลบริษัททั้งหมด
  const companiesData = await db
    .select()
    .from(companyTable)
    .orderBy(desc(companyTable.created_at));

  // 3. ดึงข้อมูลแอดมินทั้งหมด พร้อม Join ข้อมูลที่จำเป็น
  const adminsData = await db
    .select({
      user: usersTable,
      admin: adminsTable,
      mappedCompanyId: adminsTable.company, 
    })
    .from(usersTable)
    .leftJoin(adminsTable, eq(usersTable.id, adminsTable.user_id))
    .where(eq(usersTable.role, "admin"))
    .orderBy(desc(usersTable.created_at));

  // 4. Mapping ข้อมูลบริษัท (Company Mapping)
  const initialCompanies = companiesData.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.companyCode || "", 
    status: "active" as const, 
    phone: c.phone || "-", 
    email: c.email || "-", 
    address: c.address || "-",
    
    createdByName: c.createdByName || "System",
    updateByName: c.updateByName || null,
    deletedByName: c.deletedByName || null,
    
    siteCount: 0,
    adminCount: 0,
    leaderCount: 0,
    employeeCount: 0, 
    
    createdAt: c.created_at.toISOString(),
    updatedAt: c.updatedAt ? c.updatedAt.toISOString() : null,
    deletedAt: c.deletedAt ? c.deletedAt.toISOString() : null,
  }));

  // 5. Mapping ข้อมูลแอดมิน (Admin Mapping)
  const initialAdmins = adminsData.map(({ user, admin, mappedCompanyId }) => ({
    id: user.id,
    companyId: mappedCompanyId || user.companyId || "", 
    name: `${user.firstName} ${user.lastName}`,
    username: user.userName,
    email: admin?.email || "-", 
    avatar: user.avatarUrl || `https://ui-avatars.com/api/?name=${user.firstName}+${user.lastName}`,
    status: "active" as const,

    createdByName: admin?.createdByName || "System Admin",
    updateByName: admin?.updateByName || null,
    deletedByName: admin?.deletedByName || null,
    
    departmentCount: 0,
    siteCount: 0,
    positionCount: 0,
    adminCount: 0,
    leaderCount: 0,
    employeeCount: 0, 

    createdAt: user.created_at.toISOString(),
    updatedAt: admin?.updatedAt ? admin.updatedAt.toISOString() : null,
    deletedAt: admin?.deletedAt ? admin.deletedAt.toISOString() : null,
  }));

  // 6. เตรียมข้อมูล Super Admin เบื้องต้น
  const initialSuperAdmin = { 
    id: superAdminData[0].id, 
    name: superAdminData[0].name || "System Admin" 
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <SuperAdminClientPage 
        initialCompanies={initialCompanies} 
        initialAdmins={initialAdmins} 
        initialSuperAdmin={initialSuperAdmin}
      />
    </div>
  );
}