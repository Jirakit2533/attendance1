"use server";

import { db } from "@/db/db";
import { leaveTable, attendanceTable, usersTable, shiftsTable, overtimeTable } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

/**
 * 1. บันทึกเวลาเข้า-ออก (Check-in / Check-out) พร้อมตรวจสอบสาย/ออกก่อน
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
    const dateStr = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Bangkok' 
    }).format(new Date());

    // ดึงข้อมูลกะงานเพื่อใช้คำนวณ
    const shiftData = await db
      .select()
      .from(shiftsTable)
      .where(eq(shiftsTable.userId, data.userId))
      .limit(1);

    const shift = shiftData[0];

    if (data.type === "IN") {
      // Logic คำนวณการเข้าสาย (ถ้ามีกะงาน)
      let isLate = 0;
      let lateMinutes = 0;

      if (shift) {
        // ดึงเวลาปัจจุบันในรูปแบบ HH:mm:ss
        const now = new Date();
        const currentTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok' }); // 14:30:00
        
        if (currentTimeStr > shift.startTime) {
          const [nowH, nowM] = currentTimeStr.split(':').map(Number);
          const [shH, shM] = shift.startTime.split(':').map(Number);
          const diff = (nowH * 60 + nowM) - (shH * 60 + shM);
          if (diff > 0) {
            isLate = 1;
            lateMinutes = diff;
          }
        }
      }

      await db.insert(attendanceTable).values({
        user_id: data.userId,
        department_id: data.departmentId,
        site_id: data.siteId,
        shift_id: shift?.id || null,
        date: dateStr,
        checkIn: sql`timezone('Asia/Bangkok', now())::time`,
        imageIn: data.image,
        imageInId: data.fileId || null,
        locationIn: data.location,
        isLate: isLate,
        lateMinutes: lateMinutes,
      });
    } else {
      // Logic คำนวณการออกก่อน (ถ้ามีกะงาน)
      let isEarlyExit = 0;
      let earlyExitMinutes = 0;

      if (shift) {
        const now = new Date();
        const currentTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok' });
        
        if (currentTimeStr < shift.endTime) {
          const [nowH, nowM] = currentTimeStr.split(':').map(Number);
          const [shH, shM] = shift.endTime.split(':').map(Number);
          const diff = (shH * 60 + shM) - (nowH * 60 + nowM);
          if (diff > 0) {
            isEarlyExit = 1;
            earlyExitMinutes = diff;
          }
        }
      }

      const result = await db.update(attendanceTable)
        .set({
          checkOut: sql`timezone('Asia/Bangkok', now())::time`,
          imageOut: data.image,
          imageOutId: data.fileId || null,  
          locationOut: data.location,
          isEarlyExit: isEarlyExit,
          earlyExitMinutes: earlyExitMinutes,
        })
        .where(
          and(
            eq(attendanceTable.user_id, data.userId),
            eq(attendanceTable.date, dateStr)
          )
        );
      
      // @ts-ignore
      if (result.rowCount === 0) {
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

    await db.insert(leaveTable).values({
      user_id: data.userId,
      department_id: user.departmentId, 
      site_id: user.site_id,           
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason,
      status: "pending", 
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
    const updatePayload: any = { 
      status: newStatus,
      approvedBy: newStatus === "approved" ? adminOrLeaderId : null,
      approvedAt: newStatus === "approved" ? sql`timezone('Asia/Bangkok', now())::text` : null,
      rejectedBy: newStatus === "rejected" ? adminOrLeaderId : null,
      rejectedAt: newStatus === "rejected" ? sql`timezone('Asia/Bangkok', now())::text` : null,
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
    if (!data.userId || !data.oldPassword || !data.newPassword) {
      return { success: false, error: "ข้อมูลไม่ครบถ้วน" };
    }

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, data.userId),
    });

    if (!user || !user.passwordHash) {
      return { success: false, error: "ไม่พบข้อมูลรหัสผ่านในระบบ" };
    }

    if (!user.passwordHash.startsWith('$')) {
      return { success: false, error: "รหัสผ่านในระบบอยู่ในรูปแบบที่ไม่รองรับ" };
    }

    const isMatch = await bcrypt.compare(data.oldPassword, user.passwordHash);
    
    if (!isMatch) {
      return { success: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
    }

    if (data.oldPassword === data.newPassword) {
      return { success: false, error: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม" };
    }

    const hashedNewPassword = await bcrypt.hash(data.newPassword, 10);

    await db.update(usersTable)
      .set({ passwordHash: hashedNewPassword })
      .where(eq(usersTable.id, data.userId));

    revalidatePath("/employee");
    revalidatePath("/leader");

    return { success: true };

  } catch (error: any) {
    console.error("Change password critical error:", error);
    return { success: false, error: `เกิดข้อผิดพลาด: ${error.message || "ทางระบบ"}` };
  }
}