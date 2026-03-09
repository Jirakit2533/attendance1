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
  departmentsTable 
} from "@/db/schema";
import { eq, and, desc, isNull, or } from "drizzle-orm";
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
   SITE, POSITION & DEPARTMENT ACTIONS
   ========================================================================== */

export async function saveSiteAction(data: { name: string; address: string; coordinates: string }) {
  try {
    const admin = await getAdminContext();
    if (!admin || !admin.companyId) return { success: false, error: "เซสชันหมดอายุ" };

    await db.insert(sitesTable).values({
      name: data.name,
      address: data.address,
      coodinates: data.coordinates, // สะกดตาม schema: coodinates
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
      company_id: admin.companyId, // ตาม schema: company_id
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

/* ==========================================================================
   STAFF (USER) ACTIONS
   ========================================================================== */

  /* ==========================================================================
   STAFF (USER) ACTIONS (ฉบับปรับปรุงการดักจับ Error ชื่อซ้ำ)
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

    // 2. จัดการ Password
    let passwordHash = undefined;
    if (data.password && data.password.trim() !== "") {
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
        payload.passwordHash = passwordHash || await bcrypt.hash("123456", 10);
    } else {
        if (passwordHash) payload.passwordHash = passwordHash;
        if (inputUsername && inputUsername.length < 30) {
          payload.userName = inputUsername;
        }
    }

    // 5. บันทึกลง Database
    if (data.id) {
      await db.update(usersTable)
        .set(payload)
        .where(eq(usersTable.id, data.id));
    } else {
      await db.insert(usersTable).values(payload);
    }

    // ... (โค้ดส่วนบนเหมือนเดิม 100% ไม่แก้ ไม่ลด) ...

    revalidatePath("/administrator");
    return { success: true, message: "บันทึกข้อมูลพนักงานสำเร็จ" };
  } catch (error: any) {
    // 1. พิมพ์ Error ออกทาง Terminal เพื่อให้คุณเห็นค่าจริง (สำหรับการตรวจสอบ)
    console.error("DEBUG - FULL ERROR:", error);

    // 2. แปลง Error เป็นข้อความทั้งหมดเพื่อหา Keyword
    const fullErrorString = JSON.stringify(error) || String(error);
    
    // 3. เช็ค Keyword ที่บ่งบอกว่า "ข้อมูลซ้ำ"
    const isDuplicate = 
      error.code === "23505" || 
      fullErrorString.includes("23505") || 
      fullErrorString.toLowerCase().includes("unique") || 
      fullErrorString.toLowerCase().includes("already exists") ||
      fullErrorString.toLowerCase().includes("duplicate");

    if (isDuplicate) {
      return { success: false, error: "ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว" };
    }

    // ถ้าไม่ใช่เรื่องชื่อซ้ำ ให้ส่ง Error กลาง (บรรทัดเดิมที่คุณมี)
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

export async function updateLeaveStatusAction(leaveId: string, status: string) {
  try {
    const admin = await getAdminContext();
    if (!admin) return { success: false, error: "Unauthorized: เซสชันหมดอายุ" };

    const updateData: any = { status };

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
      updateData.approvedBy = null;
      updateData.approvedAt = null;
      updateData.rejectedBy = null;
      updateData.rejectedAt = null;
    }

    await db.update(leaveTable)
      .set(updateData)
      .where(eq(leaveTable.id, leaveId));

    revalidatePath("/administrator"); 
    
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