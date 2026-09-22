import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/db";
import {
  attendanceTable,
  notificationDevicesTable,
  shiftsTable,
  usersTable,
} from "@/db/schema";
import { firebaseAdminMessaging } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

function getBangkokTime() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

function timeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export async function GET(request: NextRequest) {
  const startAt = new Date();

  try {
    const cronSecret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");

    if (
      cronSecret &&
      authorization !== `Bearer ${cronSecret}`
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const bangkokTime = getBangkokTime();

    const currentMinutes =
      bangkokTime.hour * 60 + bangkokTime.minute;

    const todayDate = bangkokTime.date;

    console.log(
      "[Attendance Notification] Started",
      {
        date: todayDate,
        time: `${String(bangkokTime.hour).padStart(2, "0")}:${String(
          bangkokTime.minute
        ).padStart(2, "0")}`,
      }
    );

    /*
     * ดึงพนักงาน + shift
     *
     * ยังไม่ใช้ attendance เป็นตัวตั้งต้น
     * เพราะคนที่ยังไม่ check-in อาจไม่มี attendance record
     */
    const employees = await db
      .select({
        userId: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        shiftId: shiftsTable.id,
        startTime: shiftsTable.startTime,
        endTime: shiftsTable.endTime,
      })
      .from(usersTable)
      .innerJoin(
        shiftsTable,
        eq(shiftsTable.userId, usersTable.id)
      )
      .where(
        and(
          eq(usersTable.role, "employee"),
          eq(shiftsTable.companyId, usersTable.companyId)
        )
      );

    let readCount = 0;
    let sentCount = 0;
    let skippedCount = 0;

    for (const employee of employees) {
      readCount++;

      const startMinutes = timeToMinutes(
        employee.startTime
      );

      const endMinutes = timeToMinutes(
        employee.endTime
      );

      /*
       * ตรวจว่ารอบนี้เกี่ยวข้องกับ
       * เวลาเข้างานหรือเวลาเลิกงานหรือไม่
       *
       * ใช้ช่วง 10 นาทีหลังเวลาที่กำหนด
       * เพื่อรองรับ Cron ที่เริ่มช้ากว่าเวลาจริงเล็กน้อย
       */
      const isCheckInTime =
        currentMinutes >= startMinutes &&
        currentMinutes <= startMinutes + 10;

      const isCheckOutTime =
        currentMinutes >= endMinutes &&
        currentMinutes <= endMinutes + 10;

      if (!isCheckInTime && !isCheckOutTime) {
        continue;
      }

      const attendance = await db
        .select({
          checkIn: attendanceTable.checkIn,
          checkOut: attendanceTable.checkOut,
        })
        .from(attendanceTable)
        .where(
          and(
            eq(attendanceTable.user_id, employee.userId),
            eq(attendanceTable.date, todayDate)
          )
        )
        .limit(1);

      const currentAttendance = attendance[0];

      /*
       * เวลาเข้างาน
       */
      if (isCheckInTime) {
        if (currentAttendance?.checkIn) {
          skippedCount++;
          continue;
        }

        const devices = await db
          .select({
            fcmToken: notificationDevicesTable.fcmToken,
          })
          .from(notificationDevicesTable)
          .where(
            eq(
              notificationDevicesTable.userId,
              employee.userId
            )
          );

        for (const device of devices) {
          try {
            await firebaseAdminMessaging.send({
              token: device.fcmToken,
              notification: {
                title: "แจ้งเตือนเวลาเข้างาน",
                body: `ถึงเวลาเข้างาน ${employee.firstName} ${employee.lastName} แล้ว`,
              },
            });

            sentCount++;
          } catch (error) {
            console.error(
              "[Attendance Notification] Check-in FCM error:",
              {
                userId: employee.userId,
                error,
              }
            );
          }
        }
      }

      /*
       * เวลาเลิกงาน
       */
      if (isCheckOutTime) {
        if (currentAttendance?.checkOut) {
          skippedCount++;
          continue;
        }

        const devices = await db
          .select({
            fcmToken: notificationDevicesTable.fcmToken,
          })
          .from(notificationDevicesTable)
          .where(
            eq(
              notificationDevicesTable.userId,
              employee.userId
            )
          );

        for (const device of devices) {
          try {
            await firebaseAdminMessaging.send({
              token: device.fcmToken,
              notification: {
                title: "แจ้งเตือนเวลาเลิกงาน",
                body: `ถึงเวลาเลิกงาน ${employee.firstName} ${employee.lastName} แล้ว`,
              },
            });

            sentCount++;
          } catch (error) {
            console.error(
              "[Attendance Notification] Check-out FCM error:",
              {
                userId: employee.userId,
                error,
              }
            );
          }
        }
      }
    }

    const endAt = new Date();

    console.log(
      "[Attendance Notification] Completed",
      {
        readCount,
        sentCount,
        skippedCount,
        durationMs:
          endAt.getTime() - startAt.getTime(),
      }
    );

    return NextResponse.json({
      success: true,
      message:
        "ระบบแจ้งเตือน Attendance ทำงานเรียบร้อย",
      date: todayDate,
      time: `${String(bangkokTime.hour).padStart(2, "0")}:${String(
        bangkokTime.minute
      ).padStart(2, "0")}`,
      details: {
        readCount,
        sentCount,
        skippedCount,
        durationMs:
          endAt.getTime() - startAt.getTime(),
      },
    });
  } catch (error) {
    console.error(
      "[Attendance Notification] Cron error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "เกิดข้อผิดพลาดในการทำงาน",
      },
      { status: 500 }
    );
  }
}