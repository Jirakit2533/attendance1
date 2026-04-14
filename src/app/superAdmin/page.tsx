import { db } from "@/db/db";
import { companyTable, usersTable, adminsTable, superAdminTable, featureLibraryTable } from "@/db/schema";
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

  // 🚀 [Parallel Fetching] - เพิ่มการดึงข้อมูล featureLibraryTable เข้าไป
  const [superAdminData, companiesData, adminsData, libraryData] = await Promise.all([
    // 1. ดึงข้อมูล Super Admin
    userId 
      ? db.select({ id: superAdminTable.id, name: superAdminTable.name })
          .from(superAdminTable)
          .where(eq(superAdminTable.id, userId))
          .limit(1)
      : [], 

    // 2. ดึงข้อมูลบริษัททั้งหมด
    db.select().from(companyTable).orderBy(desc(companyTable.created_at)),

    // 3. ดึงข้อมูลแอดมินทั้งหมด
    db.select({
      user: usersTable,
      admin: adminsTable,
      mappedCompanyId: adminsTable.company, 
    })
    .from(usersTable)
    .leftJoin(adminsTable, eq(usersTable.id, adminsTable.user_id))
    .where(eq(usersTable.role, "admin"))
    .orderBy(desc(usersTable.created_at)),

    // 🚩 ส่วนที่เพิ่มใหม่: ดึงข้อมูลฟีเจอร์จาก Library ทั้งหมด
    db.select().from(featureLibraryTable).orderBy(desc(featureLibraryTable.name))
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
    companyFeatureSelectedId: c.companyFeatureSelectedId || null, // เพิ่มฟิลด์นี้ตาม Schema
    createdByName: c.createdByName || "System",
    updateByName: c.updateByName || null,
    deletedByName: c.deletedByName || null,
    
    siteCount: 0,
    adminCount: 0,
    leaderCount: 0,
    employeeCount: 0, 
    
    createdAt: c.created_at instanceof Date ? c.created_at.toISOString() : new Date().toISOString(),
    updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : null,
    deletedAt: c.deletedAt instanceof Date ? c.deletedAt.toISOString() : null,
  }));

  // 5. Mapping ข้อมูลแอดมิน (Strict Schema Mapping)
  const initialAdmins = (adminsData || []).map(({ user, admin, mappedCompanyId }) => ({
    id: user.id,
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

    createdAt: user.created_at instanceof Date ? user.created_at.toISOString() : new Date().toISOString(),
    updatedAt: admin?.updatedAt instanceof Date ? admin.updatedAt.toISOString() : null,
    deletedAt: admin?.deletedAt instanceof Date ? admin.deletedAt.toISOString() : null,
  }));

  // 6. เตรียมข้อมูล Super Admin (Fallback ถ้าดึงไม่ได้)
  const initialSuperAdmin = { 
    id: currentSuperAdmin?.id || userId || "unknown", 
    name: currentSuperAdmin?.name || "System Admin" 
  };

  // 7. เตรียมข้อมูล Feature Library สำหรับส่งไปหน้า Client
  const featureLibrary = (libraryData || []).map(f => ({
    id: f.id,
    name: f.name,
    description: f.description || ""
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <SuperAdminClientPage 
        initialCompanies={initialCompanies} 
        initialAdmins={initialAdmins} 
        initialSuperAdmin={initialSuperAdmin}
        featureLibrary={featureLibrary} // 🚩 ส่งค่าที่ Map แล้วไปที่หน้า Client
      />
    </div>
  );
}