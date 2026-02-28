"use server";

import { db } from "@/db";
import { companyTable, usersTable, adminsTable, superAdminTable } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

/* ================== HELPER: Get Current Super Admin ================== */
// ดึงข้อมูล Super Admin ที่ Login อยู่จาก Session
async function getCurrentSuperAdmin() {
  const cookieStore = await cookies();
  const adminId = cookieStore.get("session_user_id")?.value;
  if (!adminId) return null;

  const profile = await db.query.superAdminTable.findFirst({
    where: eq(superAdminTable.id, adminId),
  });
  
  if (!profile) return null;
  
  return { id: adminId, name: profile.name };
}

/* ================== FETCH ACTIONS ================== */

/** ดึงข้อมูลบริษัททั้งหมด */
export async function getCompanies() {
  try {
    const data = await db.select().from(companyTable).orderBy(desc(companyTable.createdAt));
    return { success: true, data };
  } catch (error) {
    console.error("Get Companies Error:", error);
    return { success: false, data: [] };
  }
}

/** ดึงข้อมูลแอดมินทั้งหมด พร้อมชื่อบริษัทที่สังกัด */
export async function getAdmins() {
  try {
    const data = await db
      .select({
        id: usersTable.id,
        userName: usersTable.userName,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        role: usersTable.role,
        companyId: companyTable.id,
        companyName: companyTable.name,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .innerJoin(adminsTable, eq(usersTable.id, adminsTable.user_id))
      .innerJoin(companyTable, eq(adminsTable.company, companyTable.id))
      .where(eq(usersTable.role, "admin"))
      .orderBy(desc(usersTable.createdAt));

    return { success: true, data };
  } catch (error) {
    console.error("Get Admins Error:", error);
    return { success: false, data: [] };
  }
}

/* ================== COMPANY ACTIONS ================== */

export async function saveCompanyAction(data: any) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return { success: false, error: "Unauthorized: ไม่พบข้อมูล Super Admin" };

    const isEdit = data.id && typeof data.id === "string" && !data.id.startsWith("COMP-");

    if (isEdit) {
      // ✅ แก้ไขบริษัท
      await db.update(companyTable)
        .set({
          name: data.name,
          address: data.address,
          updateBy: admin.name,
          updatedAt: new Date(),
        })
        .where(eq(companyTable.id, data.id));
    } else {
      // ✅ สร้างบริษัทใหม่
      await db.insert(companyTable).values({
        name: data.name,
        address: data.address,
        user_id: admin.id,
        createdBy: admin.name,
      });
    }

    revalidatePath("/superAdmin");
    return { success: true };
  } catch (error: any) {
    console.error("Save Company Error:", error);
    return { success: false, error: error.message || "ล้มเหลวในการบันทึกข้อมูลบริษัท" };
  }
}

export async function deleteCompanyAction(id: string) {
  try {
    await db.delete(companyTable).where(eq(companyTable.id, id));
    revalidatePath("/superAdmin");
    return { success: true };
  } catch (error) {
    console.error("Delete Company Error:", error);
    return { success: false, error: "ไม่สามารถลบบริษัทได้ เนื่องจากมีการใช้งานอยู่ (โปรดลบแอดมินในบริษัทนี้ออกก่อน)" };
  }
}

/* ================== ADMIN ACTIONS ================== */

export async function saveAdminAction(data: any) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return { success: false, error: "Unauthorized" };

    const nameParts = data.name.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    if (data.isEdit && data.id) {
      // ✅ แก้ไข Admin (แยกคำสั่ง)
      const updatePayload: any = {
        firstName,
        lastName,
        userName: data.username,
        updatedAt: new Date(),
      };

      if (data.password && data.password.trim() !== "") {
        updatePayload.passwordHash = await bcrypt.hash(data.password, 10);
      }

      await db.update(usersTable).set(updatePayload).where(eq(usersTable.id, data.id));
      
      await db.update(adminsTable)
        .set({
          company: data.companyId,
          updateBy: admin.name,
          updatedAt: new Date(),
        })
        .where(eq(adminsTable.user_id, data.id));

    } else {
      // ✅ สร้าง Admin ใหม่ (แยกคำสั่ง)
      const existingUser = await db.query.usersTable.findFirst({
        where: eq(usersTable.userName, data.username)
      });
      if (existingUser) return { success: false, error: "Username นี้ถูกใช้งานแล้ว" };

      const hashedPassword = await bcrypt.hash(data.password || "123456", 10);

      // รันคำสั่งที่ 1
      const [newUser] = await db.insert(usersTable).values({
        firstName,
        lastName,
        userName: data.username,
        passwordHash: hashedPassword,
        role: "admin",
        department: "Management",
        position: "HR Admin",
      }).returning({ id: usersTable.id });

      // รันคำสั่งที่ 2
      await db.insert(adminsTable).values({
        user_id: newUser.id,
        company: data.companyId,
        createdBy: admin.name,
      });
    }

    revalidatePath("/superAdmin");
    return { success: true };
  } catch (error: any) {
    console.error("ADMIN_SAVE_ERROR_LOG:", error);
    return { success: false, error: error.message || "บันทึกข้อมูลไม่สำเร็จ" };
  }
}

export async function deleteAdminAction(id: string) {
  try {
    await db.transaction(async (tx) => {
      await tx.delete(adminsTable).where(eq(adminsTable.user_id, id));
      await tx.delete(usersTable).where(eq(usersTable.id, id));
    });
    
    revalidatePath("/superAdmin");
    return { success: true };
  } catch (error) {
    console.error("Delete Admin Error:", error);
    return { success: false, error: "ไม่สามารถลบข้อมูลแอดมินได้" };
  }
}