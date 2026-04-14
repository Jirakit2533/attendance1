"use server";

import { db } from "@/db/db";
import { companyTable, usersTable, adminsTable, superAdminTable, companyFeatureSelectedTable, featureLibraryTable } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
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

export async function saveCompanyAction(data: any) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return { success: false, error: "Unauthorized: ไม่พบข้อมูล Super Admin" };

    const isEdit = data.id && typeof data.id === "string";

    // --- CASE: แก้ไขข้อมูลเดิม (UPDATE) ---
    if (isEdit) {
      // 1. อัปเดตข้อมูลบริษัทหลัก
      await db.update(companyTable)
        .set({
          name: data.name,
          companyCode: data.companyCode,
          companyPrefix: data.companyPrefix || (data.companyCode ? data.companyCode.substring(0, 3).toUpperCase() : ""),
          address: data.address,
          phone: data.phone,
          email: data.email,
          otRoundingOption: data.otRoundingOption,
          updateByName: admin.name,
          updatedAt: new Date(),
        })
        .where(eq(companyTable.id, data.id));

      // 2. จัดการข้อมูล Feature Selected (Upsert ลง JSONB Table)
      if (data.selectedFeatures) {
        // 1. บันทึก/อัปเดตตาราง Selection และดึง ID กลับมา
        const [selection] = await db.insert(companyFeatureSelectedTable)
          .values({
            companyId: data.id,
            featureSelectedArray: data.selectedFeatures,
            updateBy: admin.id,
          })
          .onConflictDoUpdate({
            target: companyFeatureSelectedTable.companyId,
            set: {
              featureSelectedArray: data.selectedFeatures,
              updateBy: admin.id,
              updatedAt: sql`timezone('UTC', now())`
            }
          })
          .returning({ insertedId: companyFeatureSelectedTable.id });

        // 2. ถ้าได้ ID มา (ไม่ว่าจะ Insert ใหม่หรือ Update ของเดิม) ให้อัปเดตกลับไปที่ตาราง Company
        if (selection?.insertedId) {
          await db.update(companyTable)
            .set({
              companyFeatureSelectedId: selection.insertedId,
            })
            .where(eq(companyTable.id, data.id));
        }
      }

      revalidatePath("/superAdmin");
      return { success: true, message: "อัปเดตข้อมูลบริษัทสำเร็จ" };
    }

    // --- CASE: สร้างข้อมูลใหม่ (INSERT) ---
    else {
      const rawCode = data.companyCode || "";
      const autoPrefix = rawCode.length >= 3 ? rawCode.substring(0, 3).toUpperCase() : rawCode.toUpperCase();

      // 1. แทรกข้อมูลบริษัทใหม่
      const [newCompany] = await db.insert(companyTable).values({
        superAdminCreatorId: admin.id,
        companyCode: rawCode,
        companyPrefix: data.companyPrefix || autoPrefix || "COM",
        name: data.name || "",
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        otRoundingOption: data.otRoundingOption || "ACTUAL",
        createdByName: admin.name,
      }).returning();

      // 2. ถ้ามีฟีเจอร์ถูกเลือกมาพร้อมกัน ให้บันทึกลงตาราง Selection ด้วย
      if (newCompany && data.selectedFeatures) {
        await db.insert(companyFeatureSelectedTable).values({
          companyId: newCompany.id,
          featureSelectedArray: data.selectedFeatures,
          createdBy: admin.id,
        });
      }

      revalidatePath("/superAdmin");
      return { success: true, message: "สร้างบริษัทใหม่สำเร็จ" };
    }

  } catch (error: any) {
    console.error("Save Company Error:", error);
    if (error.code === '23505') {
      return { success: false, error: "รหัสบริษัทหรือชื่อบริษัทนี้มีอยู่ในระบบแล้ว" };
    }
    return { success: false, error: error.message || "ล้มเหลวในการบันทึกข้อมูลบริษัท" };
  }
}

export async function deleteCompanyAction(id: string) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return { success: false, error: "Unauthorized" };

    // 1. ลบข้อมูลที่ผูกกับบริษัทในตารางอื่นๆ ทั้งหมด (Manual Cleanup เพื่อความปลอดภัย)
    await db.delete(adminsTable).where(eq(adminsTable.company, id));
    await db.delete(usersTable).where(eq(usersTable.companyId, id));

    // 🚩 ลบข้อมูลฟีเจอร์ที่เลือกไว้ของบริษัทนี้ออกด้วย
    await db.delete(companyFeatureSelectedTable).where(eq(companyFeatureSelectedTable.companyId, id));

    // 2. ลบตัวบริษัทจริงออกจาก Table (Hard Delete ตามที่ Owner ต้องการ)
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

    // กำหนดค่า Role ให้เป็นมาตรฐานเดียวกัน (ตัวเล็กทั้งหมด)
    const targetRole = "admin";

    if (data.isEdit && data.id) {
      const updatePayload: any = {
        firstName,
        lastName,
        userName: data.username,
        role: targetRole, // ✅ บังคับอัปเดต Role ให้ถูกต้องทุกครั้งที่แก้ไข
        companyId: data.companyId,
        updatedAt: new Date(),
      };

      if (data.password && data.password.trim() !== "") {
        updatePayload.passwordHash = await bcrypt.hash(data.password, 10);
      }

      // อัปเดตตาราง Users
      await db.update(usersTable).set(updatePayload).where(eq(usersTable.id, data.id));

      // อัปเดตตาราง Admins
      await db.update(adminsTable)
        .set({
          company: data.companyId,
          email: email,
          updateByName: admin.name,
          updatedAt: new Date(),
        })
        .where(eq(adminsTable.user_id, data.id));

    } else {
      // ตรวจสอบ Username ซ้ำ
      const existingUser = await db.query.usersTable.findFirst({
        where: eq(usersTable.userName, data.username)
      });
      if (existingUser) return { success: false, error: "Username นี้ถูกใช้งานแล้ว" };

      const hashedPassword = await bcrypt.hash(data.password || "123456", 10);

      // สร้าง User ใหม่พร้อมระบุ Role ให้ชัดเจน
      const [newUser] = await db.insert(usersTable).values({
        firstName,
        lastName,
        userName: data.username,
        passwordHash: hashedPassword,
        role: targetRole, // ✅ ใช้ตัวแปรเดียวกัน
        companyId: data.companyId,
      }).returning({ id: usersTable.id });

      await db.insert(adminsTable).values({
        user_id: newUser.id,
        creatorId: admin.id,
        company: data.companyId,
        email: email,
        createdByName: admin.name,
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

/**
 * 🚩 ส่วนที่ 1: เพิ่มชื่อฟีเจอร์ใหม่เข้า Library Storage (Input Text)
 */
export async function addFeatureToLibraryAction(name: string, description?: string) {
  try {
    await db.insert(featureLibraryTable).values({
      name: name,
      description: description || "",
    });
    revalidatePath("/admin/features");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * 🚩 ส่วนที่ 2 & 3: บันทึกการเลือกฟีเจอร์ลง Selection Table (JSONB) 
 * และอัปเดต FK กลับไปที่ Company
 */
export async function saveCompanyFeatureSelectionAction(companyId: string, selectedFeatures: string[]) {
  try {
    // 1. บันทึกเข้าตาราง Selection (JSONB)
    const [selection] = await db.insert(companyFeatureSelectedTable).values({
      companyId: companyId,
      featureSelectedArray: selectedFeatures, // บันทึกเป็น jsonb ["feature1", "feature2"]
    }).onConflictDoUpdate({
      target: companyFeatureSelectedTable.companyId, // อย่าลืมใส่ Unique Index ที่ companyId ใน Schema ด้วย
      set: { featureSelectedArray: selectedFeatures }
    }).returning();

    // 2. อัปเดต FK ที่ companyTable
    await db.update(companyTable)
      .set({ companyFeatureSelectedId: selection.id })
      .where(eq(companyTable.id, companyId));

    revalidatePath("/admin/companies");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}