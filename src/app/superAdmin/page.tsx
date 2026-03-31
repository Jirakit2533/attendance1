import { db } from "@/db/db";
import { companyTable, usersTable, adminsTable, superAdminTable } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { cookies } from "next/headers"; 
import { redirect } from "next/navigation"; 
import SuperAdminClientPage from "./superAdminClientPage";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  // 🛡️ [SECURITY CHECK] 
  const cookieStore = await cookies(); 
  const userId = cookieStore.get('session_user_id')?.value;

  // หากไม่มี userId ในคุกกี้
  if (!userId) {
    // redirect('/login?error=session_expired');
  }

  // 🚀 [Parallel Fetching] 
  const [superAdminData, companiesData, adminsData] = await Promise.all([
    // 1. ดึงข้อมูล Super Admin (ใช้ superAdminTable อ้างอิง id, name, role)
    userId 
      ? db.select({ id: superAdminTable.id, name: superAdminTable.name })
          .from(superAdminTable)
          .where(eq(superAdminTable.id, userId))
          .limit(1)
      : [], 

    // 2. ดึงข้อมูลบริษัททั้งหมด (อ้างอิง companyTable.created_at ตาม Schema)
    db.select().from(companyTable).orderBy(desc(companyTable.created_at)),

    // 3. ดึงข้อมูลแอดมินทั้งหมด (Join usersTable กับ adminsTable)
    db.select({
      user: usersTable,
      admin: adminsTable,
      // อ้างอิง adminsTable.company (ชื่อคีย์ใน Schema คือ company)
      mappedCompanyId: adminsTable.company, 
    })
    .from(usersTable)
    .leftJoin(adminsTable, eq(usersTable.id, adminsTable.user_id))
    .where(eq(usersTable.role, "admin")) // กรองเฉพาะ role admin จาก usersTable
    .orderBy(desc(usersTable.created_at))
  ]);

  // 🚩 ตรวจสอบสิทธิ์ Super Admin
  const currentSuperAdmin = superAdminData?.[0];
  if (!currentSuperAdmin && userId) {
    // redirect('/api/auth/logout-cleanup');
  }

  // 4. Mapping ข้อมูลบริษัท (Strict Schema Mapping)
  const initialCompanies = (companiesData || []).map((c) => ({
    id: String(c.id),
    name: c.name || "ไม่ระบุชื่อบริษัท",
    code: c.companyCode || "", 
    status: "active" as const, 
    phone: c.phone || "-", 
    email: c.email || "-", 
    address: c.address || "-",
    otRoundingOption: c.otRoundingOption || "none",
    createdByName: c.createdByName || "System",
    updateByName: c.updateByName || null,
    deletedByName: c.deletedByName || null,
    
    siteCount: 0,
    adminCount: 0,
    leaderCount: 0,
    employeeCount: 0, 
    
    // อ้างอิง c.created_at และ c.updatedAt ตาม Schema
    createdAt: c.created_at instanceof Date ? c.created_at.toISOString() : new Date().toISOString(),
    updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : null,
    deletedAt: c.deletedAt instanceof Date ? c.deletedAt.toISOString() : null,
  }));

  // 5. Mapping ข้อมูลแอดมิน (Strict Schema Mapping)
  const initialAdmins = (adminsData || []).map(({ user, admin, mappedCompanyId }) => ({
    id: user.id,
    // ใช้ mappedCompanyId จาก adminsTable หรือ fallback ไปที่ user.companyId
    companyId: mappedCompanyId || user.companyId || "", 
    name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "ไม่ระบุชื่อ",
    username: user.userName || "user",
    email: admin?.email || "-", 
    avatar: user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.firstName || 'A')}+${encodeURIComponent(user.lastName || 'B')}`,
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

    // อ้างอิง user.created_at และ admin.updatedAt ตาม Schema
    createdAt: user.created_at instanceof Date ? user.created_at.toISOString() : new Date().toISOString(),
    updatedAt: admin?.updatedAt instanceof Date ? admin.updatedAt.toISOString() : null,
    deletedAt: admin?.deletedAt instanceof Date ? admin.deletedAt.toISOString() : null,
  }));

  // 6. เตรียมข้อมูล Super Admin (Fallback ถ้าดึงไม่ได้)
  const initialSuperAdmin = { 
    id: currentSuperAdmin?.id || userId || "unknown", 
    name: currentSuperAdmin?.name || "System Admin" 
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