import { db } from "@/db";
import { companyTable, usersTable } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import SuperAdminClientPage from "./superAdminClientPage";

export default async function SuperAdminPage() {
  // ดึงข้อมูลบริษัทจริงจาก DB
  const companiesData = await db
    .select()
    .from(companyTable)
    .orderBy(desc(companyTable.created_at));

  // ดึงข้อมูล Admin จริงจาก DB
  const adminsData = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.role, "admin"))
    .orderBy(desc(usersTable.created_at));

  // Mapping ข้อมูลให้เข้ากับ Schema ของ UI
  const initialCompanies = companiesData.map(c => ({
    id: c.id,
    name: c.name,
    code: c.name.substring(0, 3).toUpperCase(),
    status: "active" as const,
    phone: "-", 
    email: "-",
    address: c.address,
    siteCount: 0,
    adminCount: 0,
    leaderCount: 0,
    staffCount: 0,
    createdAt: c.created_at.toISOString(),
  }));

  const initialAdmins = adminsData.map(a => ({
    id: a.id,
    companyId: "", 
    name: `${a.firstName} ${a.lastName}`,
    username: a.userName,
    email: "-",
    avatar: `https://ui-avatars.com/api/?name=${a.firstName}`,
    status: "active" as const,
    siteCount: 0,
    leaderManaged: 0,
    staffManaged: 0,
    createdAt: a.created_at.toISOString(),
  }));

  return (
    <SuperAdminClientPage 
      initialCompanies={initialCompanies} 
      initialAdmins={initialAdmins} 
    />
  );
}