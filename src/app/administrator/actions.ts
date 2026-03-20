"use server";

import { db } from "@/db/db";
import {
  usersTable,
  adminsTable,
  companyTable,
  sitesTable,
  attendanceTable,
  leaveTable,
  positionsTable,
  departmentsTable,
  shiftsTable,
} from "@/db/schema";
import { eq, and, desc, isNull, or, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

// ✅ Import ตัวจัดการ Upload (ปรับให้ตรงกับ lib ของคุณ)
import { uploadToDrive, deleteFromDrive } from "@/lib/uploadthing-server";

/* ==========================================================================
   HELPERS
   ========================================================================== */

/**
 * ดึงข้อมูล Admin/User ที่ Login อยู่จาก Session Cookie
 */
/**
 * ปรับปรุง getAdminContext ให้ปลอดภัยขึ้น
 */
async function getAdminContext() {
  try {
    const cookieStore = await cookies();
    const adminId = cookieStore.get("session_user_id")?.value;

    // 🛡️ ดักจับ: ถ้าไม่มี ID ให้คืน null ทันที ไม่ต้องไป Query ต่อให้พัง
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
      .where(and(
        eq(usersTable.id, adminId),
        isNull(usersTable.deletedAt)
      ))
      .limit(1);

    // 🛡️ ดักจับ: ถ้า Query แล้วไม่เจอ (เช่น Admin ถูกลบ หรือเปลี่ยน Role)
    if (!adminData || adminData.length === 0) return null;

    return adminData[0];
  } catch (error) {
    console.error("Context Error:", error);
    return null;
  }
}

/**
 * ออกจากระบบ
 */
export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("session_user_id");
  cookieStore.delete("user_role");
  return { success: true };
}

/* ==========================================================================
   SITE ACTIONS
   ========================================================================== */

// ปรับปรุงให้รับค่า lat, lng แยกกันตามที่ส่งมาจาก UI ใหม่
export async function saveSiteAction(data: { name: string; address: string; lat: string; lng: string }) {
  try {
    const admin = await getAdminContext();
    if (!admin || !admin.companyId) return { success: false, error: "เซสชันหมดอายุ" };

    // ตรวจสอบว่ามีชื่อไซต์นี้อยู่ในบริษัทแล้วหรือไม่
    const existingSite = await db.query.sitesTable.findFirst({
      where: (sites, { and, eq }) => and(
        eq(sites.name, data.name),
        eq(sites.companyId, admin.companyId)
      ),
    });

    if (existingSite) {
      return { success: false, error: `ตรวจพบข้อมูลซ้ำ: มีไซต์งานชื่อ "${data.name}" อยู่ในระบบแล้ว` };
    }

    // นำ lat และ lng มาต่อกันเป็น "lat,lng" เพื่อลง field coordinates (ตาม schema ของคุณ)
    const combinedCoordinates = `${data.lat},${data.lng}`;

    await db.insert(sitesTable).values({
      name: data.name,
      address: data.address,
      coordinates: combinedCoordinates, // บันทึกเข้า field เดิมใน DB
      companyId: admin.companyId,
      createdBy: admin.id,
    });

    revalidatePath("/administrator");
    return { success: true, message: "บันทึกไซต์งานสำเร็จ" };
  } catch (error) {
    console.error("Save Site Error:", error);
    return { success: false, error: "ไม่สามารถบันทึกไซต์งานได้" };
  }
}

/* ==========================================================================
   POSITION ACTIONS
   ========================================================================== */
export async function savePositionAction(data: { name: string }) {
  try {
    const admin = await getAdminContext();
    if (!admin || !admin.companyId) return { success: false, error: "เซสชันหมดอายุ" };

    // ตรวจสอบชื่อตำแหน่งซ้ำ
    const existingPos = await db.query.positionsTable.findFirst({
      where: (pos, { and, eq }) => and(
        eq(pos.name, data.name),
        eq(pos.company_id, admin.companyId)
      ),
    });

    if (existingPos) {
      return { success: false, error: `ตำแหน่ง "${data.name}" ถูกเพิ่มไว้ในระบบก่อนหน้านี้แล้ว` };
    }

    await db.insert(positionsTable).values({
      name: data.name,
      company_id: admin.companyId, // ตาม schema: company_id
      createdBy: admin.id,
    });

    revalidatePath("/administrator");
    return { success: true, message: "บันทึกตำแหน่งสำเร็จ" };
  } catch (error) {
    return { success: false, error: "ไม่สามารถบันทึกตำแหน่งได้" };
  }
}

/* ==========================================================================
   DEPARTMENT ACTIONS
   ========================================================================== */

export async function createDepartmentAction(name: string) {
  try {
    const admin = await getAdminContext();
    if (!admin || !admin.companyId) return { success: false, error: "เซสชันหมดอายุ" };

    // ตรวจสอบชื่อแผนกซ้ำ
    const existingDept = await db.query.departmentsTable.findFirst({
      where: (dept, { and, eq }) => and(
        eq(dept.name, name),
        eq(dept.companyId, admin.companyId)
      ),
    });

    if (existingDept) {
      return { success: false, error: `แผนก "${name}" มีอยู่ในระบบแล้ว ไม่สามารถเพิ่มซ้ำได้` };
    }

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
/* ==========================================================================
   STAFF (USER) ACTIONS (ฉบับปรับปรุงบันทึก User และ shiftsTable - FIXED)
   ========================================================================== */

export async function saveStaffAction(data: any) {
  try {
    const admin = await getAdminContext();
    if (!admin || !admin.companyId) return { success: false, error: "Unauthorized: ไม่ได้รับอนุญาต" };

    // --- 1. จัดการ Username ---
    let inputUsername = data.userName || data.username;

    if (!data.id && (!inputUsername || inputUsername.trim() === "")) {
      return { success: false, error: "กรุณาระบุชื่อผู้ใช้งาน (Username)" };
    }

    // 2. จัดการ Password (เพิ่ม Logic ตรวจสอบรหัสผ่านเดิมกรณีแก้ไข)
    let passwordHash = undefined;
    if (data.password && data.password.trim() !== "") {

      // ✅ เพิ่มการตรวจสอบรหัสผ่านเดิมกรณีที่เป็นการแก้ไข (data.id มีค่า)
      if (data.id) {
        const userForAuth = await db.select({ passwordHash: usersTable.passwordHash })
          .from(usersTable)
          .where(eq(usersTable.id, data.id))
          .limit(1);

        if (userForAuth.length > 0 && userForAuth[0].passwordHash) {
          const isOldPasswordCorrect = await bcrypt.compare(data.oldPassword || "", userForAuth[0].passwordHash);
          if (!isOldPasswordCorrect) {
            return { success: false, error: "รหัสผ่านเดิมไม่ถูกต้อง ไม่สามารถเปลี่ยนรหัสผ่านใหม่ได้" };
          }
        }
      }

      passwordHash = await bcrypt.hash(data.password, 10);
    }

    // 3. จัดการรูปภาพ (Avatar)
    let finalAvatarUrl = data.avatarUrl || null;
    let finalAvatarId = data.avatarId || null;

    if (data.avatarUrl && data.avatarUrl.startsWith("data:image")) {
      try {
        if (data.id) {
          const existingUser = await db.select({ avatarId: usersTable.avatarId })
            .from(usersTable)
            .where(eq(usersTable.id, data.id))
            .limit(1);

          if (existingUser[0]?.avatarId) {
            await deleteFromDrive(existingUser[0].avatarId).catch(() => null);
          }
        } else if (data.avatarId) {
          await deleteFromDrive(data.avatarId).catch(() => null);
        }

        const base64Data = data.avatarUrl.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const fileName = `profile_${Date.now()}.jpg`;
        const uploadResult = await uploadToDrive(buffer, fileName, "", "image/jpeg");
        finalAvatarUrl = uploadResult.ufsUrl || uploadResult.url;
        finalAvatarId = uploadResult.fileId;
      } catch (uploadError) {
        console.error("Upload Error:", uploadError);
      }
    }

    // --- 4. เตรียม Payload ---
    const payload: any = {
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role || "employee",
      companyId: admin.companyId,
      departmentId: data.departmentId || null,
      positionId: data.positionId || null,
      site_id: (data.siteId === "all_sites" || !data.siteId) ? null : data.siteId,
      avatarUrl: finalAvatarUrl,
      avatarId: finalAvatarId,
      updateBy: admin.id,
      updatedAt: new Date(),
    };

    if (!data.id) {
      payload.userName = inputUsername;
      payload.createdBy = admin.id;
      // กรณีลงทะเบียนใหม่ ถ้าไม่มีรหัสผ่านส่งมา ให้ใช้ default "123456"
      payload.passwordHash = passwordHash || await bcrypt.hash("123456", 10);
    } else {
      // กรณีแก้ไข: จะอัปเดตรหัสผ่านเฉพาะเมื่อมีการส่ง passwordHash มาเท่านั้น
      if (passwordHash) payload.passwordHash = passwordHash;

      if (inputUsername && inputUsername.length < 30) {
        payload.userName = inputUsername;
      }
    }

    // 5. บันทึกลง Database
    let targetUserId = data.id;

    if (data.id) {
      await db.update(usersTable)
        .set(payload)
        .where(eq(usersTable.id, data.id));
    } else {
      const insertedUser = await db.insert(usersTable).values(payload).returning({ id: usersTable.id });
      targetUserId = insertedUser[0].id;
    }

    // ✅ 6. บันทึกข้อมูลลง shiftsTable (ห้ามลบ/ห้ามลด logic เดิม)
    if (targetUserId && data.startTime && data.endTime) {
      const existingShift = await db.select()
        .from(shiftsTable)
        .where(eq(shiftsTable.userId, targetUserId))
        .limit(1);

      const shiftPayload = {
        userId: targetUserId,
        name: "-", // เพิ่มเพื่อให้ผ่านเงื่อนไข notNull ใน schema
        startTime: data.startTime,
        endTime: data.endTime,
        companyId: admin.companyId,
        siteId: (data.siteId === "all_sites" || !data.siteId) ? null : data.siteId, // เพิ่มความเชื่อมโยงไซต์งาน
        updatedAt: new Date(),
      };

      if (existingShift.length > 0) {
        await db.update(shiftsTable)
          .set(shiftPayload)
          .where(eq(shiftsTable.userId, targetUserId));
      } else {
        await db.insert(shiftsTable).values(shiftPayload);
      }
    }

    revalidatePath("/administrator");
    return { success: true, message: "บันทึกข้อมูลพนักงานสำเร็จ" };
  } catch (error: any) {
    console.error("DEBUG - FULL ERROR:", error);

    const fullErrorString = JSON.stringify(error) || String(error);

    const isDuplicate =
      error.code === "23505" ||
      fullErrorString.includes("23505") ||
      fullErrorString.toLowerCase().includes("unique") ||
      fullErrorString.toLowerCase().includes("already exists") ||
      fullErrorString.toLowerCase().includes("duplicate");

    if (isDuplicate) {
      return { success: false, error: "ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว" };
    }

    return { success: false, error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" };
  }
}
/* ==========================================================================
   DELETE STAFF ACTION (Soft Delete + ลบรูปภาพ)
   ========================================================================== */
export async function deleteStaffAction(id: string) {
  try {
    const admin = await getAdminContext();
    if (!admin) return { success: false, error: "Unauthorized: เซสชันหมดอายุ" };

    // ✅ 1. ค้นหา avatarId ของพนักงานก่อนลบออกจาก Database
    const userToDelete = await db.select({ avatarId: usersTable.avatarId })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    // ✅ 2. ถ้ามีรูปในระบบจัดเก็บ (UploadThing) ให้ลบออกทันที
    if (userToDelete[0]?.avatarId) {
      await deleteFromDrive(userToDelete[0].avatarId).catch((err) => {
        console.error("Failed to delete image from storage:", err);
      });
    }

    // ✅ 3. เปลี่ยนจาก update เป็น delete เพื่อลบแถวข้อมูลออกจาก Database ถาวร
    await db.delete(usersTable)
      .where(eq(usersTable.id, id));

    revalidatePath("/administrator");
    return { success: true, message: "ลบพนักงานและรูปโปรไฟล์ออกจากระบบถาวรแล้ว" };
  } catch (error: any) {
    console.error("Delete Staff Error:", error);

    // 💡 คำแนะนำ: หากเจอ Error ตรงนี้ มักเกิดจากพนักงานมีประวัติในตาราง attendance หรือ leave 
    // ซึ่งติดเงื่อนไข Foreign Key (Database Constraint)
    return {
      success: false,
      error: "ไม่สามารถลบได้ถาวร เนื่องจากพนักงานคนนี้มีประวัติการเข้างานหรือการลาในระบบ"
    };
  }
}

/* ==========================================================================
   LEAVE ACTIONS
   ========================================================================== */

export async function updateLeaveStatusAction(leaveId: string, status: string, remark?: string) {
  try {
    const admin = await getAdminContext();
    if (!admin) return { success: false, error: "Unauthorized: เซสชันหมดอายุ" };

    const updateData: any = {
      status,
      remark: remark || null // บันทึกหมายเหตุลงในฟิลด์ remark
    };

    if (status === 'approved') {
      updateData.approvedBy = admin.id;
      updateData.approvedAt = new Date();
      updateData.rejectedBy = null;
      updateData.rejectedAt = null;
    } else if (status === 'rejected') {
      updateData.rejectedBy = admin.id;
      updateData.rejectedAt = new Date();
      updateData.approvedBy = null;
      updateData.approvedAt = null;
    } else {
      // กรณีดึงกลับเป็น pending (แก้ไข)
      updateData.approvedBy = null;
      updateData.approvedAt = null;
      updateData.rejectedBy = null;
      updateData.rejectedAt = null;
    }

    await db.update(leaveTable)
      .set(updateData)
      .where(eq(leaveTable.id, leaveId));

    revalidatePath("/administrator");
    // เพิ่ม revalidatePath สำหรับหน้า leader ด้วยเพื่อให้ข้อมูลอัปเดตทันที
    revalidatePath("/leader");

    const statusText = status === 'approved' ? 'อนุมัติ' : status === 'rejected' ? 'ปฏิเสธ' : 'แก้ไข';
    return { success: true, message: `${statusText}คำขอลาสำเร็จ` };
  } catch (error: any) {
    console.error("Update Leave Status Error:", error);
    return { success: false, error: "ไม่สามารถอัปเดตสถานะได้" };
  }
}
/* ==========================================================================
   FETCH DATA ACTIONS
   ========================================================================== */

export async function getDepartmentsAction() {
  try {
    const admin = await getAdminContext();
    if (!admin || !admin.companyId) return { success: false, data: [] };

    const data = await db
      .select()
      .from(departmentsTable)
      .where(
        and(
          eq(departmentsTable.companyId, admin.companyId),
          isNull(departmentsTable.deletedAt)
        )
      )
      .orderBy(desc(departmentsTable.created_at));

    return {
      success: true,
      data: JSON.parse(JSON.stringify(data))
    };
  } catch (error) {
    return { success: false, data: [] };
  }
}
/* ==========================================================================
   FETCH DATA ACTIONS (เพิ่มฟังก์ชันเช็คการดึงเวลาจาก DB)
   ========================================================================== */

export async function getAttendanceAction() {
  try {
    const admin = await getAdminContext();
    if (!admin || !admin.companyId) return { success: false, data: [] };

    // ✅ ดึงข้อมูลพร้อมระบุฟิลด์ และ Join ชื่อพนักงานมาแสดงผล
    const data = await db
      .select({
        id: attendanceTable.id,
        userId: attendanceTable.userId,
        firstName: usersTable.firstName,  // เพิ่มการดึงชื่อ
        lastName: usersTable.lastName,    // เพิ่มการดึงนามสกุล
        checkIn: attendanceTable.check_in,
        checkOut: attendanceTable.check_out,
        date: attendanceTable.date,
      })
      .from(attendanceTable)
      .innerJoin(usersTable, eq(attendanceTable.userId, usersTable.id)) // Join เพื่อเอาชื่อ
      .where(eq(usersTable.companyId, admin.companyId)) // กรองเฉพาะบริษัทตัวเอง
      .orderBy(desc(attendanceTable.date), desc(attendanceTable.check_in));

    // ตรวจสอบใน Terminal
    console.log("🔍 Attendance Sample with User Name:", data[0]);

    return {
      success: true,
      data: JSON.parse(JSON.stringify(data))
    };
  } catch (error) {
    console.error("Fetch Attendance Error:", error);
    return { success: false, data: [] };
  }
}

/* ==========================================================================
 DELETE & UPDATE ACTIONS (SITES & POSITIONS)
 ========================================================================== */

/** * ลบไซต์งาน 
 */
export async function deleteSiteAction(id: string) {
  try {
    const admin = await getAdminContext();
    if (!admin) return { success: false, error: "Unauthorized" };

    await db.delete(sitesTable).where(eq(sitesTable.id, id));

    revalidatePath("/administrator");
    return { success: true, message: "ลบไซต์งานสำเร็จ" };
  } catch (error) {
    return { success: false, error: "ไม่สามารถลบได้ เนื่องจากมีการใช้งานไซต์งานนี้อยู่" };
  }
}

/** * ลบตำแหน่ง 
 */
export async function deletePositionAction(id: string) {
  try {
    const admin = await getAdminContext();
    if (!admin) return { success: false, error: "Unauthorized" };

    await db.delete(positionsTable).where(eq(positionsTable.id, id));

    revalidatePath("/administrator");
    return { success: true, message: "ลบตำแหน่งสำเร็จ" };
  } catch (error) {
    return { success: false, error: "ไม่สามารถลบได้ เนื่องจากมีพนักงานใช้ตำแหน่งนี้อยู่" };
  }
}

/** * แก้ไขไซต์งาน 
 */
export async function updateSiteAction(id: string, data: { name: string; address: string; lat: string; lng: string }) {
  try {
    const admin = await getAdminContext();
    if (!admin) return { success: false, error: "Unauthorized" };

    const combinedCoordinates = `${data.lat},${data.lng}`;

    await db.update(sitesTable)
      .set({
        name: data.name,
        address: data.address,
        coordinates: combinedCoordinates,
        updatedAt: new Date(),
      })
      .where(eq(sitesTable.id, id));

    revalidatePath("/administrator");
    return { success: true, message: "อัปเดตไซต์งานสำเร็จ" };
  } catch (error) {
    return { success: false, error: "ไม่สามารถอัปเดตข้อมูลได้" };
  }
}

/** * แก้ไขตำแหน่ง 
 */
export async function updatePositionAction(id: string, name: string) {
  try {
    const admin = await getAdminContext();
    if (!admin) return { success: false, error: "Unauthorized" };

    await db.update(positionsTable)
      .set({ name, updatedAt: new Date() })
      .where(eq(positionsTable.id, id));

    revalidatePath("/administrator");
    return { success: true, message: "อัปเดตตำแหน่งสำเร็จ" };
  } catch (error) {
    return { success: false, error: "ไม่สามารถอัปเดตข้อมูลได้" };
  }
}

/* ==========================================================================
 UPDATE ADMIN
 ========================================================================== */



export async function updateAdminProfileAction(adminId: string, formData: FormData) {
  try {
    const adminContext = await getAdminContext();
    if (!adminContext || adminContext.id !== adminId) {
      return { success: false, error: "Unauthorized: สิทธิ์ไม่ถูกต้อง" };
    }

    // --- 1. ดึงข้อมูลจาก FormData ---
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;

    // รับค่า avatarUrl มาเช็คว่าเป็น Base64 หรือไม่
    let avatarUrlInput = formData.get("avatarUrl") as string;
    let finalAvatarUrl = avatarUrlInput; // ค่าเริ่มต้นเป็นค่าเดิมที่ส่งมา
    let finalAvatarId = formData.get("avatarId") as string;

    // --- 2. ดึงข้อมูลเดิมเพื่อตรวจสอบ Security และหาไฟล์เก่า ---
    const userWithAdmin = await db
      .select({
        id: usersTable.id,
        passwordHash: usersTable.passwordHash,
        companyId: adminsTable.company,
        oldAvatarId: usersTable.avatarId,
      })
      .from(usersTable)
      .innerJoin(adminsTable, eq(usersTable.id, adminsTable.user_id))
      .where(and(eq(usersTable.id, adminId), isNull(usersTable.deletedAt)))
      .limit(1);

    const targetUser = userWithAdmin[0];
    if (!targetUser) return { success: false, error: "ไม่พบข้อมูลผู้ดูแล" };

    // --- 3. Security Check: รหัสผ่านเดิม ---
    if (!currentPassword) return { success: false, error: "กรุณาระบุรหัสผ่านเดิม" };
    const isPasswordValid = await bcrypt.compare(currentPassword, targetUser.passwordHash);
    if (!isPasswordValid) return { success: false, error: "รหัสผ่านเดิมไม่ถูกต้อง" };

    // --- 4. Logic การจัดการรูปภาพ (ยกมาจาก saveStaffAction) ---
    // เช็คว่า avatarUrl ที่ส่งมาเป็น Base64 หรือไม่ (ถ้าเลือกรูปใหม่จาก Client มักจะเป็นแบบนี้)
    if (avatarUrlInput && avatarUrlInput.startsWith("data:image")) {
      try {
        // ลบรูปเก่า (ถ้ามี)
        if (targetUser.oldAvatarId) {
          await deleteFromDrive(targetUser.oldAvatarId).catch(() => null);
        }

        // กระบวนการอัปโหลดเหมือน saveStaffAction
        const base64Data = avatarUrlInput.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const fileName = `admin_profile_${adminId}_${Date.now()}.jpg`;

        const uploadResult = await uploadToDrive(buffer, fileName, "", "image/jpeg");

        finalAvatarUrl = uploadResult.ufsUrl || uploadResult.url;
        finalAvatarId = uploadResult.fileId;

        console.log("✅ Admin Upload Success:", finalAvatarUrl);
      } catch (uploadError) {
        console.error("❌ Admin Upload Error:", uploadError);
      }
    }

    // --- 5. เตรียม Payload สำหรับการ Update ---
    const nameParts = name.trim().split(/\s+/);
    const userUpdateData: any = {
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(" "),
      updateBy: adminId,
      updatedAt: sql`timezone('Asia/Bangkok', now())`,
      // บันทึก URL และ ID ที่อัปโหลดใหม่ลงไป
      avatarUrl: finalAvatarUrl,
      avatarId: finalAvatarId,
    };

    if (newPassword && newPassword.trim() !== "") {
      userUpdateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    // --- 6. ดำเนินการอัปเดต Database ---
    await db.update(usersTable).set(userUpdateData).where(eq(usersTable.id, adminId));
    await db.update(adminsTable).set({ email: email || null }).where(eq(adminsTable.user_id, adminId));
    if (targetUser.companyId) {
      await db.update(companyTable).set({ phone: phone || null }).where(eq(companyTable.id, targetUser.companyId));
    }

    revalidatePath("/administrator");
    return { success: true, message: "อัปเดตโปรไฟล์และรูปภาพสำเร็จ" };

  } catch (error: any) {
    console.error("Update Admin Profile Error:", error);
    return { success: false, error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" };
  }
}

/* ==========================================================================
   COMPANY UPDATE ACTION (ฉบับแก้ไขตาม Log Deprecation)
   ========================================================================== */

export async function updateCompanyAction(data: any) {
  try {
    const admin = await getAdminContext();

    if (!admin || !admin.id || !admin.companyId) {
      return { success: false, error: "Unauthorized: ไม่พบข้อมูลผู้ใช้งาน" };
    }

    // --- 1. ดึงข้อมูล Security และข้อมูลบริษัทเดิม ---
    const adminSecurityCheck = await db
      .select({
        passwordHash: usersTable.passwordHash,
        dbCompanyId: adminsTable.company,
        oldLogoUrl: companyTable.logoUrl,
      })
      .from(usersTable)
      .innerJoin(adminsTable, eq(usersTable.id, adminsTable.user_id))
      .innerJoin(companyTable, eq(adminsTable.company, companyTable.id))
      .where(and(
        eq(usersTable.id, admin.id),
        isNull(usersTable.deletedAt)
      ))
      .limit(1);

    const targetAdmin = adminSecurityCheck[0];
    if (!targetAdmin) {
      return { success: false, error: "ไม่พบข้อมูลผู้ดูแลที่มีสิทธิ์" };
    }

    // --- 2. Security Check ---
    if (!data.confirmPassword) {
      return { success: false, error: "กรุณาระบุรหัสผ่านยืนยัน" };
    }

    const isPasswordValid = await bcrypt.compare(data.confirmPassword, targetAdmin.passwordHash);

    if (!isPasswordValid) {
      return { success: false, error: "รหัสผ่านไม่ถูกต้อง" };
    }

    // --- 3. จัดการอัปโหลดรูปภาพใหม่ (ปรับตาม Log คำแนะนำ ufsUrl) ---
    let finalLogoUrl = data.logoUrl || null;

    if (data.logoUrl && data.logoUrl.startsWith("data:image")) {
      try {
        // ลบรูปเก่าโดยใช้ File Key จาก URL
        if (targetAdmin.oldLogoUrl && targetAdmin.oldLogoUrl.includes("/f/")) {
          const oldFileKey = targetAdmin.oldLogoUrl.split("/f/")[1];
          if (oldFileKey) {
            await deleteFromDrive(oldFileKey).catch(() => null);
          }
        }

        // แปลง Base64 และอัปโหลดผ่าน Helper
        const base64Data = data.logoUrl.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const fileName = `company_logo_${Date.now()}.jpg`;
        const uploadResult = await uploadToDrive(buffer, fileName, "image/jpeg");

        // รับค่า URL ที่ Helper ส่งกลับมา (ซึ่งควรจะเป็น ufsUrl แล้ว)
        finalLogoUrl = uploadResult.url;

      } catch (uploadError) {
        console.error("Company Logo Upload Error:", uploadError);
      }
    }

    // --- 4. เตรียม Payload (ห้ามลบ ห้ามลดฟิลด์เดิม) ---
    const payload = {
      name: data.companyName,
      description: data.description || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      logoUrl: finalLogoUrl,
      updateByName: `${admin.firstName} ${admin.lastName}`,
      updatedAt: new Date(),
    };

    // --- 5. อัปเดตข้อมูลบริษัท ---
    await db.update(companyTable)
      .set(payload)
      .where(eq(companyTable.id, targetAdmin.dbCompanyId));

    revalidatePath("/administrator");
    return { success: true };

  } catch (error) {
    console.error("Update Company Error:", error);
    return { success: false, error: "Database Connection Error" };
  }
}