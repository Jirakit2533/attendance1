"use server";

import { db } from "@/db/db";
import { leaveTable, attendanceTable, usersTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

/**
 * ฟังก์ชันช่วยแปลง Date เป็นสตริงเวลา HH:mm:ss (เวลาไทย)
 */
const getTimeString = (date: Date) => {
  return new Intl.DateTimeFormat('en-GB', { 
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
};

/**
 * ฟังก์ชันช่วยแปลง Date เป็น ISO String แบบไทย (YYYY-MM-DD HH:mm:ss)
 */
const getFullDateTimeString = (date: Date) => {
  const datePart = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
  const timePart = getTimeString(date);
  return `${datePart} ${timePart}`;
};

/**
 * 1. บันทึกเวลาเข้า-ออก (Check-in / Check-out)
 */
export async function saveAttendanceAction(data: {
  userId: string;
  type: "IN" | "OUT";
  image: string; 
  fileId?: string; 
  location: string;
  departmentId: string;
  siteId: string | null;
}) {
  try {
    const now = new Date();
    
    // สร้างวันที่ YYYY-MM-DD (ไทย)
    const todayDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now); 

    const timeStr = getTimeString(now);

    if (data.type === "IN") {
      await db.insert(attendanceTable).values({
        user_id: data.userId,
        department_id: data.departmentId,
        site_id: data.siteId,
        date: todayDate,
        checkIn: timeStr, // บันทึกเป็น String "HH:mm:ss"
        imageIn: data.image,
        imageInId: data.fileId || null,
        locationIn: data.location,
      });
    } else {
      // ✅ แก้ไข: เปลี่ยนจาก new Date() เป็น timeStr (String) 
      // เพื่อให้เข้าคู่กับ checkIn และป้องกัน Error .toISOString()
      const result = await db.update(attendanceTable)
        .set({
          checkOut: timeStr, 
          imageOut: data.image,
          imageOutId: data.fileId || null,  
          locationOut: data.location,
        })
        .where(
          and(
            eq(attendanceTable.user_id, data.userId),
            eq(attendanceTable.date, todayDate)
          )
        );
      
      // ตรวจสอบ rowCount (สำหรับบาง Adapter อาจใช้ result.changes)
      // @ts-ignore
      if (result.rowCount === 0 && result.changes === 0) {
        return { success: false, error: "ไม่พบข้อมูลการเช็คอินของวันนี้" };
      }
    }

    revalidatePath("/", "layout");
    revalidatePath("/leader");
    revalidatePath("/employee");
    return { success: true };
  } catch (error: any) {
    console.error("Attendance error:", error);
    return { success: false, error: "บันทึกเวลาไม่สำเร็จ: " + (error.message || "Unknown Error") };
  }
}

/**
 * 2. ส่งคำขอลางาน
 */
export async function createLeaveRequestAction(data: {
  userId: string;
  type: string;
  startDate: string; 
  endDate: string;   
  reason: string;
  fileUrl?: string;
  fileId?: string;
  fileName?: string;
}) {
  try {
    // 1. ดึงข้อมูลพนักงานจาก DB โดยใช้ userId เพื่อเอา ID แผนกและไซต์ที่ถูกต้อง
    const user = await db.query.usersTable.findFirst({
      where: (users, { eq }) => eq(users.id, data.userId),
      columns: {
        departmentId: true,
        site_id: true,
      },
    });

    if (!user) {
      return { success: false, error: "ไม่พบข้อมูลพนักงานในระบบ" };
    }

    // 2. บันทึกลงตารางการลา โดยใช้ค่าที่ดึงมาจาก DB (user.xxx)
    await db.insert(leaveTable).values({
      user_id: data.userId,
      department_id: user.departmentId, // ✅ ดึงจาก DB โดยตรง
      site_id: user.site_id,           // ✅ ดึงจาก DB โดยตรง
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason,
      status: "pending", 
      // 3. ปรับเรื่องไฟล์ให้บันทึก null แทน string "no-id" ถ้าไม่มีข้อมูล
      fileUrl: data.fileUrl || null,
      fileId: data.fileId || null,
      fileName: data.fileName || null,
    });

    revalidatePath("/leader");
    revalidatePath("/employee");
    return { success: true };
  } catch (error: any) {
    console.error("Create leave error:", error);
    return { success: false, error: "ส่งคำขอลาไม่สำเร็จ: " + error.message };
  }
}


export async function updateLeaveStatusAction(
  leaveId: string, 
  newStatus: "approved" | "rejected" | "pending",
  adminOrLeaderId: string
) {
  try {
    const now = new Date();
    const timeStampStr = getFullDateTimeString(now);

    const updatePayload: any = { 
      status: newStatus,
      approvedBy: newStatus === "approved" ? adminOrLeaderId : null,
      approvedAt: newStatus === "approved" ? timeStampStr : null,
      rejectedBy: newStatus === "rejected" ? adminOrLeaderId : null,
      rejectedAt: newStatus === "rejected" ? timeStampStr : null,
    };

    await db.update(leaveTable)
      .set(updatePayload)
      .where(eq(leaveTable.id, leaveId));

    revalidatePath("/leader");
    revalidatePath("/employee");
    return { success: true };
  } catch (error: any) {
    console.error("Update leave error:", error);
    return { success: false, error: "อัปเดตสถานะไม่สำเร็จ" };
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