"use server";

import { db } from "@/db/db";
import { companyTable, usersTable, adminsTable, superAdminTable } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

/* ================== HELPER: Get Current Super Admin ================== */
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
    const data = await db.select().from(companyTable).orderBy(desc(companyTable.created_at));
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
        email: adminsTable.email,
        companyId: companyTable.id,
        companyName: companyTable.name,
        createdAt: usersTable.created_at,
      })
      .from(usersTable)
      .innerJoin(adminsTable, eq(usersTable.id, adminsTable.user_id))
      .innerJoin(companyTable, eq(adminsTable.company, companyTable.id))
      .where(eq(usersTable.role, "admin"))
      .orderBy(desc(usersTable.created_at));

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

    const isEdit = data.id && typeof data.id === "string";

    if (isEdit) {
      await db.update(companyTable)
        .set({
          name: data.name,
          companyCode: data.companyCode, 
          address: data.address,
          phone: data.phone,
          email: data.email,
          updateByName: admin.name, // 📍 แก้ให้ตรง Schema: updateBy -> updateByName
          updatedAt: new Date(),
        })
        .where(eq(companyTable.id, data.id));
    } else {
      await db.insert(companyTable).values({
        companyCode: data.companyCode,
        name: data.name,
        address: data.address,
        phone: data.phone,
        email: data.email,
        creatorId: admin.id,      // 📍 แก้ให้ตรง Schema: user_id -> creatorId
        createdByName: admin.name, // 📍 แก้ให้ตรง Schema: createdBy -> createdByName
      });
    }

    revalidatePath("/superAdmin");
    return { success: true };
  } catch (error: any) {
    console.error("Save Company Error:", error);
    if (error.code === '23505') return { success: false, error: "รหัสบริษัทนี้ถูกใช้งานแล้ว" };
    return { success: false, error: error.message || "ล้มเหลวในการบันทึกข้อมูลบริษัท" };
  }
}

export async function deleteCompanyAction(id: string) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return { success: false, error: "Unauthorized" };

    // ใช้การอัปเดตชื่อผู้ลบก่อนจะลบจริง (ถ้าต้องการเก็บ Log ชื่อคนลบใน DB ก่อนหายไป)
    // หรือถ้า Schema ลบแบบ Hard Delete (ลบถาวร) บรรทัดนี้อาจไม่จำเป็น แต่ใส่ไว้ให้ตามโครงสร้างคุณครับ
    await db.update(companyTable).set({ deletedByName: admin.name }).where(eq(companyTable.id, id));

    await db.delete(adminsTable).where(eq(adminsTable.company, id));
    await db.delete(usersTable).where(eq(usersTable.companyId, id));

    const result = await db.delete(companyTable)
      .where(eq(companyTable.id, id))
      .returning({ deletedId: companyTable.id });

    if (result.length === 0) {
      return { success: false, error: "ไม่พบข้อมูลบริษัท หรือบริษัทถูกลบไปแล้ว" };
    }

    revalidatePath("/superAdmin");
    return { success: true };

  } catch (error: any) {
    console.error("❌ Delete Company Error:", error);
    if (error.code === '23503') {
      return { 
        success: false, 
        error: "ไม่สามารถลบได้: กรุณาลบ Site งานหรือข้อมูลอื่นๆ ที่เกี่ยวข้องกับบริษัทนี้ออกก่อน" 
      };
    }
    return { success: false, error: "ล้มเหลว: " + (error.message || "Unknown error") };
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
    const email = data.email || ""; 

    if (data.isEdit && data.id) {
      const updatePayload: any = {
        firstName,
        lastName,
        userName: data.username,
        companyId: data.companyId,
        updatedAt: new Date(),
      };

      if (data.password && data.password.trim() !== "") {
        updatePayload.passwordHash = await bcrypt.hash(data.password, 10);
      }

      await db.update(usersTable).set(updatePayload).where(eq(usersTable.id, data.id));
      
      await db.update(adminsTable)
        .set({
          company: data.companyId,
          email: email,
          updateByName: admin.name, // 📍 แก้ให้ตรง Schema: updateBy -> updateByName
          updatedAt: new Date(),
        })
        .where(eq(adminsTable.user_id, data.id));

    } else {
      const existingUser = await db.query.usersTable.findFirst({
        where: eq(usersTable.userName, data.username)
      });
      if (existingUser) return { success: false, error: "Username นี้ถูกใช้งานแล้ว" };

      const hashedPassword = await bcrypt.hash(data.password || "123456", 10);

      const [newUser] = await db.insert(usersTable).values({
        firstName,
        lastName,
        userName: data.username,
        passwordHash: hashedPassword,
        role: "admin",
        companyId: data.companyId,
      }).returning({ id: usersTable.id });

      await db.insert(adminsTable).values({
        user_id: newUser.id,
        creatorId: admin.id,      // 📍 เพิ่มตาม Schema: เก็บ ID คนสร้าง
        company: data.companyId,
        email: email,
        createdByName: admin.name, // 📍 แก้ให้ตรง Schema: createdBy -> createdByName
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
    await db.delete(adminsTable).where(eq(adminsTable.user_id, id));
    await db.delete(usersTable).where(eq(usersTable.id, id));
    
    revalidatePath("/superAdmin");
    return { success: true };
  } catch (error) {
    console.error("Delete Admin Error:", error);
    return { success: false, error: "ไม่สามารถลบข้อมูลแอดมินได้" };
  }
}