"use server";

import { db } from "@/db";
import { 
  usersTable, 
  adminsTable, 
  companyTable, 
  sitesTable, 
  attendanceTable, 
  leaveTable,
  positionsTable 
} from "@/db/schema";
import { eq, and, or, desc, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

/* ================== HELPERS ================== */

async function getAdminContext() {
  const cookieStore = await cookies();
  const adminId = cookieStore.get("session_user_id")?.value;
  if (!adminId) return null;

  const adminData = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      companyId: adminsTable.company,
    })
    .from(usersTable)
    .innerJoin(adminsTable, eq(usersTable.id, adminsTable.user_id))
    .where(eq(usersTable.id, adminId))
    .limit(1);

  return adminData[0] || null;
}

/* ================== SITE & POSITION ACTIONS ================== */

export async function saveSiteAction(data: { name: string; address: string; coordinates: string }) {
  try {
    const admin = await getAdminContext();
    if (!admin) return { success: false, error: "Unauthorized" };

    await db.insert(sitesTable).values({
      name: data.name,
      address: data.address,
      coodinates: data.coordinates,
      companyId: admin.companyId,
      createdBy: admin.id,
    });

    revalidatePath("/administrator");
    return { success: true };
  } catch (error) {
    return { success: false, error: "ไม่สามารถบันทึกไซต์งานได้" };
  }
}

export async function savePositionAction(data: { name: string }) {
  try {
    const admin = await getAdminContext();
    if (!admin) return { success: false, error: "Unauthorized" };

    await db.insert(positionsTable).values({
      name: data.name,
      company_id: admin.companyId,
      createdBy: admin.id,
    });

    revalidatePath("/administrator");
    return { success: true };
  } catch (error) {
    return { success: false, error: "ไม่สามารถบันทึกตำแหน่งได้" };
  }
}

/* ================== STAFF (USER) ACTIONS ================== */

export async function saveStaffAction(data: any) {
  try {
    const admin = await getAdminContext();
    if (!admin) return { success: false, error: "Unauthorized" };

    const hashedPassword = data.password 
      ? await bcrypt.hash(data.password, 10) 
      : undefined;

    // เตรียมข้อมูลพนักงาน (รวม Base64 Avatar)
    const payload: any = {
      userName: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role || "employee",
      department: data.department,
      positionId: data.positionId,
      site_id: data.siteId,
      avatar: data.avatar, // ✅ บันทึกรูปภาพแบบ Base64 String
      updateBy: admin.id,
      updatedAt: new Date(),
    };

    if (data.isEdit && data.id) {
      if (hashedPassword) payload.passwordHash = hashedPassword;
      await db.update(usersTable).set(payload).where(eq(usersTable.id, data.id));
    } else {
      payload.passwordHash = hashedPassword || await bcrypt.hash("123456", 10);
      payload.createdBy = admin.id;
      await db.insert(usersTable).values(payload);
    }

    revalidatePath("/administrator");
    return { success: true };
  } catch (error: any) {
    console.error("Save Staff Error:", error);
    return { success: false, error: "ล้มเหลวในการบันทึกข้อมูลพนักงาน" };
  }
}

// ✅ เพิ่มฟังก์ชันลบพนักงาน (Soft Delete)
export async function deleteStaffAction(staffId: string) {
  try {
    const admin = await getAdminContext();
    if (!admin) return { success: false, error: "Unauthorized" };

    await db.update(usersTable)
      .set({ 
        deletedAt: new Date(), 
        deletedBy: admin.id 
      })
      .where(eq(usersTable.id, staffId));

    revalidatePath("/administrator");
    return { success: true };
  } catch (error) {
    return { success: false, error: "ลบพนักงานไม่สำเร็จ" };
  }
}

/* ================== LEAVE ACTIONS ================== */

// ✅ เพิ่มฟังก์ชันอัปเดตสถานะการลา
export async function updateLeaveStatusAction(leaveId: string, status: string) {
  try {
    const admin = await getAdminContext();
    if (!admin) return { success: false, error: "Unauthorized" };

    await db.update(leaveTable)
      .set({ 
        status: status, 
        approvedBy: admin.id 
      })
      .where(eq(leaveTable.id, leaveId));

    revalidatePath("/administrator");
    return { success: true };
  } catch (error) {
    return { success: false, error: "อัปเดตสถานะไม่สำเร็จ" };
  }
}

/* ================== FETCH DATA ACTIONS ================== */

export async function getStaffData() {
  try {
    const admin = await getAdminContext();
    if (!admin) return { success: false, data: [] };

    const staff = await db
      .select({
        id: usersTable.id,
        username: usersTable.userName,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        role: usersTable.role,
        department: usersTable.department,
        positionName: positionsTable.name,
        siteName: sitesTable.name,
        avatar: usersTable.avatar, // ดึงรูปมาแสดงด้วย
        createdAt: usersTable.created_at,
      })
      .from(usersTable)
      .leftJoin(sitesTable, eq(usersTable.site_id, sitesTable.id))
      .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id))
      .where(
        and(
          or(eq(usersTable.role, "employee"), eq(usersTable.role, "leader")),
          eq(usersTable.createdBy, admin.id),
          isNull(usersTable.deletedAt) // ✅ กรองเอาเฉพาะคนที่ยังไม่ถูกลบ
        )
      )
      .orderBy(desc(usersTable.created_at));

    return { success: true, data: staff };
  } catch (error) {
    console.error("Fetch Staff Error:", error);
    return { success: false, data: [] };
  }
}

export async function getSitesAction() {
  try {
    const admin = await getAdminContext();
    if (!admin) return { success: false, data: [] };
    const data = await db.select().from(sitesTable).where(eq(sitesTable.companyId, admin.companyId)).orderBy(desc(sitesTable.created_at));
    return { success: true, data };
  } catch (error) {
    return { success: false, data: [] };
  }
}

export async function getPositionsAction() {
  try {
    const admin = await getAdminContext();
    if (!admin) return { success: false, data: [] };

    const data = await db
      .select()
      .from(positionsTable)
      .where(eq(positionsTable.company_id, admin.companyId))
      .orderBy(desc(positionsTable.created_at));

    return { success: true, data };
  } catch (error) {
    return { success: false, data: [] };
  }
}