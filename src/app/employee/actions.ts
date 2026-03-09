"use server";

import { db } from "@/db/db";
import { attendanceTable, leaveTable, usersTable } from "@/db/schema"; // ✅ เพิ่ม usersTable
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { uploadToDrive } from "@/lib/uploadthing-server"; 
import * as bcrypt from "bcryptjs";


/* -------------------------------------------------------------------------- */
/* ATTENDANCE ACTIONS (เข้า/ออกงาน)                                           */
/* -------------------------------------------------------------------------- */

export async function checkInAction(userId: string, base64Image: string, location: string) {
  try {
    // 1. ดึงข้อมูลแผนกและไซต์ของ User ก่อน
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
      columns: {
        departmentId: true,
        site_id: true,
      },
    });

    if (!user) throw new Error("ไม่พบข้อมูลผู้ใช้");

    // 2. จัดการรูปภาพ
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    
    const uploadRes = await uploadToDrive(
      buffer, 
      `checkin_${userId}_${Date.now()}.png`, 
      "image/png"
    );

    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());

    // 3. บันทึกลง Database พร้อม department_id และ site_id
    await db.insert(attendanceTable).values({
      user_id: userId,
      department_id: user.departmentId, // ✅ เพิ่มการบันทึกแผนก
      site_id: user.site_id,           // ✅ เพิ่มการบันทึกไซต์
      date: dateStr,
      checkIn: sql`timezone('Asia/Bangkok', now())::text`, 
      imageIn: uploadRes.url, 
      imageInId: uploadRes.fileId,
      locationIn: location,
    });

    revalidatePath("/employee");
    revalidatePath("/leader");
    return { success: true };
  } catch (error: any) {
    console.error("Check-in error:", error);
    return { success: false, error: "บันทึกเข้างานล้มเหลว: " + error.message };
  }
}

export async function checkOutAction(userId: string, base64Image: string, location: string) {
  try {
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const uploadRes = await uploadToDrive(buffer, `checkout_${userId}_${Date.now()}.png`, "image/png");

    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());

    await db
      .update(attendanceTable)
      .set({
        checkOut: sql`timezone('Asia/Bangkok', now())::text`, 
        imageOut: uploadRes.url, 
        imageOutId: uploadRes.fileId,
        locationOut: location,
      })
      .where(
        and(
          eq(attendanceTable.user_id, userId),
          eq(attendanceTable.date, dateStr)
        )
      );

    revalidatePath("/employee");
    revalidatePath("/leader");
    return { success: true };
  } catch (error: any) {
    console.error("Check-out error:", error);
    return { success: false, error: "บันทึกเลิกงานล้มเหลว" };
  }
}

/* -------------------------------------------------------------------------- */
/* LEAVE ACTIONS (การลางาน)                                                  */
/* -------------------------------------------------------------------------- */

export async function createLeaveRequest(data: {
  userId: string;
  type: string;
  start: string;
  end: string;
  reason: string;
  base64File?: string; 
  fileName?: string;   
}) {
  try {
    // 1. ดึงข้อมูลแผนกและไซต์ของ User
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, data.userId),
      columns: {
        departmentId: true,
        site_id: true,
      },
    });

    if (!user) throw new Error("ไม่พบข้อมูลผู้ใช้");

    let fileUrl = "no-file";
    let fileId = "no-id";

    if (data.base64File) {
      const base64Data = data.base64File.replace(/^data:.*?;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      
      const uploadRes = await uploadToDrive(
        buffer, 
        data.fileName || `leave_${data.userId}_${Date.now()}.png`, 
        "image/png"
      );
      
      fileUrl = uploadRes.url;
      fileId = uploadRes.fileId;
    }

    // 2. บันทึกลง Database พร้อม department_id และ site_id
    await db.insert(leaveTable).values({
      user_id: data.userId,
      department_id: user.departmentId, // ✅ เพิ่มการบันทึกแผนก
      site_id: user.site_id,           // ✅ เพิ่มการบันทึกไซต์
      type: data.type,
      startDate: data.start,
      endDate: data.end,
      reason: data.reason,
      status: "pending",
      fileUrl: fileUrl,  
      fileId: fileId,    
      fileName: data.fileName || "leave_document",
    });

    revalidatePath("/employee");
    revalidatePath("/leader");
    return { success: true };
  } catch (error: any) {
    console.error("Leave error:", error);
    return { success: false, error: "ส่งคำขอลางานล้มเหลว: " + error.message };
  }
}

export async function changePasswordAction(data: {
  userId: string;
  oldPassword: string;
  newPassword: string;
}) {
  try {
    // 1. ตรวจสอบข้อมูลนำเข้าเบื้องต้น
    if (!data.userId || !data.oldPassword || !data.newPassword) {
      return { success: false, error: "ข้อมูลไม่ครบถ้วน" };
    }

    // 2. ดึงข้อมูล User จาก Database
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, data.userId),
    });

    // ตรวจสอบจาก log ที่คุณส่งมา ต้องใช้ user.passwordHash
    if (!user || !user.passwordHash) {
      return { success: false, error: "ไม่พบข้อมูลรหัสผ่านในระบบ" };
    }

    // 3. ตรวจสอบรูปแบบรหัสผ่านใน DB (ต้องเป็น Bcrypt Hash ที่ขึ้นต้นด้วย $)
    if (!user.passwordHash.startsWith('$')) {
      return { success: false, error: "รหัสผ่านในระบบอยู่ในรูปแบบที่ไม่รองรับ" };
    }

    // 4. ตรวจสอบรหัสผ่านปัจจุบัน (เปรียบเทียบกับ passwordHash)
    const isMatch = await bcrypt.compare(data.oldPassword, user.passwordHash);
    
    if (!isMatch) {
      return { success: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
    }

    // 5. ตรวจสอบว่ารหัสใหม่ต้องไม่ซ้ำกับรหัสเดิม
    if (data.oldPassword === data.newPassword) {
      return { success: false, error: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม" };
    }

    // 6. เข้ารหัสรหัสผ่านใหม่ (Hashing)
    const hashedNewPassword = await bcrypt.hash(data.newPassword, 10);

    // 7. อัปเดตข้อมูลลง Database (ใช้ชื่อคอลัมน์ passwordHash ให้ตรงกับ DB)
    await db.update(usersTable)
      .set({ passwordHash: hashedNewPassword })
      .where(eq(usersTable.id, data.userId));

    // 8. ล้าง Cache หน้าเว็บเพื่อให้ข้อมูลเป็นปัจจุบัน
    revalidatePath("/employee");
    revalidatePath("/leader");

    return { success: true };

  } catch (error: any) {
    console.error("Change password critical error:", error);
    return { success: false, error: `เกิดข้อผิดพลาด: ${error.message || "ทางระบบ"}` };
  }
}