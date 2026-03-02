"use server";

import { db } from "@/db";
import { 
  usersTable, 
  adminsTable, 
  companyTable, 
  sitesTable, 
  attendanceTable, 
  leaveTable,
  positionsTable,
  departmentsTable 
} from "@/db/schema";
import { eq, and, or, desc, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

// ✅ Import ตัวจัดการ Upload (ปรับให้ตรงกับ lib ของคุณ)
import { uploadToDrive, deleteFromDrive } from "@/lib/uploadthing-server";

/* ================== HELPERS ================== */

async function getAdminContext() {
  try {
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
  } catch (error) {
    console.error("Context Error:", error);
    return null;
  }
}

// Helper สำหรับ Logout (เรียกใช้ใน Client)
export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("session_user_id");
  cookieStore.delete("user_role");
  return { success: true };
}

/* ================== SITE, POSITION & DEPARTMENT ACTIONS ================== */

export async function saveSiteAction(data: { name: string; address: string; coordinates: string }) {
  try {
    const admin = await getAdminContext();
    if (!admin || !admin.companyId) return { success: false, error: "เซสชันหมดอายุ" };

    await db.insert(sitesTable).values({
      name: data.name,
      address: data.address,
      coodinates: data.coordinates,
      companyId: admin.companyId,
      createdBy: admin.id,
    });

    revalidatePath("/administrator");
    return { success: true, message: "บันทึกไซต์งานสำเร็จ" };
  } catch (error) {
    return { success: false, error: "ไม่สามารถบันทึกไซต์งานได้" };
  }
}

export async function savePositionAction(data: { name: string }) {
  try {
    const admin = await getAdminContext();
    if (!admin || !admin.companyId) return { success: false, error: "เซสชันหมดอายุ" };

    await db.insert(positionsTable).values({
      name: data.name,
      company_id: admin.companyId,
      createdBy: admin.id,
    });

    revalidatePath("/administrator");
    return { success: true, message: "บันทึกตำแหน่งสำเร็จ" };
  } catch (error) {
    return { success: false, error: "ไม่สามารถบันทึกตำแหน่งได้" };
  }
}

export async function createDepartmentAction(name: string) {
  try {
    const admin = await getAdminContext();
    if (!admin || !admin.companyId) return { success: false, error: "เซสชันหมดอายุ" };

    await db.insert(departmentsTable).values({
      name: name,
      companyId: admin.companyId,
      createdBy: admin.id,
    });

    revalidatePath("/administrator");
    return { success: true, message: "บันทึกแผนกสำเร็จ" };
  } catch (error) {
    console.error("Add Department Error:", error);
    return { success: false, error: "ไม่สามารถบันทึกแผนกได้" };
  }
}

/* ================== STAFF (USER) ACTIONS ================== */

export async function saveStaffAction(data: any) {
  try {
    const admin = await getAdminContext();
    if (!admin || !admin.companyId) return { success: false, error: "Unauthorized: ไม่ได้รับอนุญาต" };

    // 1. จัดการ Password
    let passwordHash = undefined;
    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, 10);
    }

    // 2. จัดการรูปภาพ (Base64 -> Uploadthing/Drive)
    let finalAvatarUrl = data.avatarUrl || null;
    let finalAvatarId = data.avatarId || null;

    if (data.avatarUrl && data.avatarUrl.startsWith("data:image")) {
      try {
        // ลบรูปเก่าถ้าเป็นการแก้ไข
        if (data.id && finalAvatarId) {
          await deleteFromDrive(finalAvatarId).catch(() => null);
        }

        const base64Data = data.avatarUrl.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const fileName = `profile_${Date.now()}.jpg`;

        const uploadResult = await uploadToDrive(buffer, fileName, "", "image/jpeg");
        finalAvatarUrl = uploadResult.url;
        finalAvatarId = uploadResult.fileId;
      } catch (uploadError: any) {
        console.error("Upload Error:", uploadError);
        // ไม่หยุดการทำงาน แต่ใช้ URL เดิมหรือว่างไว้
      }
    }

    // 3. เตรียม Payload (แมพชื่อ Field ให้ตรงกับ Schema)
    const payload: any = {
      userName: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role || "employee",
      companyId: admin.companyId,
      departmentId: data.departmentId || null,
      positionId: data.positionId || null,
      site_id: data.siteId || null,
      avatarUrl: finalAvatarUrl,
      avatarId: finalAvatarId,
      updateBy: admin.id,
      updatedAt: new Date(),
    };

    if (passwordHash) {
      payload.passwordHash = passwordHash;
    }

    // 4. บันทึกลง Database
    if (data.id) {
      // โหมดแก้ไข
      await db.update(usersTable)
        .set(payload)
        .where(eq(usersTable.id, data.id));
    } else {
      // โหมดสร้างใหม่
      payload.createdBy = admin.id;
      if (!payload.passwordHash) {
        payload.passwordHash = await bcrypt.hash("123456", 10); // Default password
      }
      await db.insert(usersTable).values(payload);
    }

    revalidatePath("/administrator");
    return { success: true, message: "บันทึกข้อมูลสำเร็จ" };
  } catch (error: any) {
    console.error("Save Staff Error:", error);
    return { success: false, error: error.message || "เกิดข้อผิดพลาดภายในระบบ" };
  }
}

export async function deleteStaffAction(staffId: string) {
  try {
    const admin = await getAdminContext();
    if (!admin) return { success: false, error: "Unauthorized" };

    await db.update(usersTable)
      .set({ 
        deletedAt: new Date(), 
        deletedBy: admin.id,
      })
      .where(eq(usersTable.id, staffId));

    revalidatePath("/administrator");
    return { success: true, message: "ลบพนักงานสำเร็จ" };
  } catch (error) {
    return { success: false, error: "ลบพนักงานไม่สำเร็จ" };
  }
}

/* ================== LEAVE ACTIONS ================== */

export async function updateLeaveStatusAction(leaveId: string, status: string) {
  try {
    const admin = await getAdminContext();
    if (!admin) return { success: false, error: "Unauthorized" };

    await db.update(leaveTable)
      .set({ 
        status: status as any, // หลีกเลี่ยง Enum mismatch
        approvedBy: admin.id 
      })
      .where(eq(leaveTable.id, leaveId));

    revalidatePath("/administrator");
    return { success: true, message: "อัปเดตสถานะสำเร็จ" };
  } catch (error) {
    return { success: false, error: "อัปเดตสถานะไม่สำเร็จ" };
  }
}

/* ================== FETCH DATA ACTIONS (Plain Objects only) ================== */

export async function getDepartmentsAction() {
  try {
    const admin = await getAdminContext();
    if (!admin || !admin.companyId) return { success: false, data: [] };
    
    const data = await db
      .select()
      .from(departmentsTable)
      .where(eq(departmentsTable.companyId, admin.companyId))
      .orderBy(desc(departmentsTable.created_at));
      
    // แปลงทุกอย่างเป็น Plain Object เพื่อป้องกัน TypeError ข้ามฝั่ง Client
    return { 
      success: true, 
      data: JSON.parse(JSON.stringify(data)) 
    };
  } catch (error) {
    return { success: false, data: [] };
  }
}