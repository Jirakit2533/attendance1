
// path: src/app/api/overtime/generate-report/route.ts

import { db } from "@/db/db";
import {
  overtimeRequestsTable,
  overtimeTable,
  usersTable,
  departmentsTable,
  positionsTable,
  sitesTable,
} from "@/db/schema";
import {
  and,
  eq,
  gte,
  lte,
  inArray,
  asc,
  aliasedTable,
  isNull,
  gt,
} from "drizzle-orm";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      employeeIds,
      startDate,
      endDate,
      format,
      reportType,
    } = body;

    // 1. Validation
    if (
      !employeeIds ||
      !Array.isArray(employeeIds) ||
      employeeIds.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "กรุณาเลือกพนักงาน",
        },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        {
          success: false,
          message: "กรุณาเลือกช่วงวันที่",
        },
        { status: 400 }
      );
    }

    // ตรวจสอบรูปแบบวันที่
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    if (
      !datePattern.test(startDate) ||
      !datePattern.test(endDate) ||
      startDate > endDate
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "รูปแบบวันที่ไม่ถูกต้อง",
        },
        { status: 400 }
      );
    }

    // 2. เผื่อ DB date ย้อนหลัง 1 วัน
    // เพราะ OT ข้ามเที่ยงคืนเก็บวันที่ก่อนวันทำ OT จริง
    const queryStartDate = new Date(`${startDate}T00:00:00.000Z`);
    queryStartDate.setUTCDate(queryStartDate.getUTCDate() - 1);

    const dbStartDate = queryStartDate.toISOString().slice(0, 10);

    // สร้าง Alias สำหรับ Users เพื่อดึงชื่อผู้อนุมัติ
    const approverTable = aliasedTable(usersTable, "approver");

    // 3. Query ข้อมูล OT
    const otData = await db
      .select({
        id: overtimeRequestsTable.id,
        date: overtimeRequestsTable.date,

        // ประเภท OT ข้ามเที่ยงคืน
        isAfterMidnight: overtimeRequestsTable.isAfterMidnight,

        timeStart: overtimeRequestsTable.timeStart,
        timeEnd: overtimeRequestsTable.timeEnd,
        userId: overtimeRequestsTable.userId,

        empCode: usersTable.empCode,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,

        departmentName: departmentsTable.name,
        positionName: positionsTable.name,
        siteName: sitesTable.name,

        // ข้อมูล OT จาก Request
        overtimeByRequest: overtimeRequestsTable.overtimeByRequest,
        status: overtimeRequestsTable.status,
        reason: overtimeRequestsTable.reason,
        remarks: overtimeRequestsTable.remarks,

        // ข้อมูล OT จากตารางหลัก
        overtimeBefore: overtimeTable.overtimeBefore,
        overtimeAfter: overtimeTable.overtimeAfter,
        overtimeApproved: overtimeTable.overtimeApproved,

        otHours: overtimeTable.overtimeApproved,
        otStatus: overtimeTable.status,

        // ข้อมูลผู้อนุมัติ
        approvedBy: overtimeRequestsTable.approvedBy,
        approvedByName: sql<string>`
          ${approverTable.firstName} || ' ' || ${approverTable.lastName}
        `,
      })
      .from(overtimeRequestsTable)
      .innerJoin(
        usersTable,
        eq(overtimeRequestsTable.userId, usersTable.id)
      )
      .innerJoin(
        overtimeTable,
        and(
          eq(overtimeRequestsTable.userId, overtimeTable.userId),
          eq(overtimeRequestsTable.date, overtimeTable.date)
        )
      )
      .leftJoin(
        sitesTable,
        eq(overtimeRequestsTable.siteId, sitesTable.id)
      )
      .leftJoin(
        departmentsTable,
        eq(overtimeRequestsTable.departmentId, departmentsTable.id)
      )
      .leftJoin(
        positionsTable,
        eq(usersTable.positionId, positionsTable.id)
      )
      .leftJoin(
        approverTable,
        eq(overtimeRequestsTable.approvedBy, approverTable.id)
      )
      .where(
        and(
          inArray(overtimeRequestsTable.userId, employeeIds),

          // ดึง DB date ย้อนหลัง 1 วันเพื่อรองรับ OT ข้ามเที่ยงคืน
          gte(overtimeRequestsTable.date, dbStartDate),
          lte(overtimeRequestsTable.date, endDate),

          // Request ต้อง Execute แล้ว
          eq(overtimeRequestsTable.status, "executed"),

          // ตาราง OT หลักต้อง Approved
          eq(overtimeTable.status, "approved"),

          // ต้องมีชั่วโมงที่อนุมัติมากกว่า 0
          gt(overtimeTable.overtimeApproved, 0),

          // ไม่เอารายการที่ถูกลบ
          isNull(overtimeRequestsTable.deletedAt)
        )
      )
      .orderBy(asc(overtimeRequestsTable.date));

    // 4. ตรวจสอบข้อมูล
    if (!otData || otData.length === 0) {
      return NextResponse.json({
        success: false,
        message: "ไม่พบข้อมูลการทำ OT ที่อนุมัติแล้วในช่วงวันที่เลือก",
        data: [],
      });
    }

    // 5. Transform ข้อมูล
    const finalData = otData.map((item) => ({
      ...item,

      // ส่ง Boolean จาก DB กลับไปให้ Client
      isAfterMidnight: item.isAfterMidnight === true,

      userName: `${item.firstName ?? ""} ${item.lastName ?? ""}`.trim(),

      approvedByName:
        item.approvedByName?.trim() || "System Admin",

      exportFormat: format,
      generatedType: reportType || "overtime",
    }));

    return NextResponse.json({
      success: true,
      data: finalData,
    });
  } catch (error: any) {
    console.error("API OT Report Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Server Error: " + (error.message || "Unknown error"),
      },
      { status: 500 }
    );
  }
}
