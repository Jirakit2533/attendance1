import { db } from "@/db/db";
import {
  usersTable,
  attendanceTable,
  leaveTable,
  sitesTable,
  adminsTable,
  companyTable,
  positionsTable,
  departmentsTable,
  shiftsTable,
} from "@/db/schema";
import { desc, eq, and, or, isNull, is } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminClientPage from "./adminClientPage";

export const dynamic = "force-dynamic"; // บังคับให้เป็น Dynamic ตลอดเวลา

export default async function AdminDashboardPage() {
  try {
    // 1. ตรวจสอบ Session Admin
    const cookieStore = await cookies();
    const adminId = cookieStore.get("session_user_id")?.value;

    if (!adminId) {
      redirect("/api/auth/logout-cleanup");
    }

    // 2. ดึงข้อมูลแอดมิน (ดึงฟิลด์ที่จำเป็นสำหรับ Modal Profile ตามที่บอก)
    const adminData = await db
      .select({
        id: usersTable.id,
        userName: usersTable.userName,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        email: adminsTable.email, // ดึงจาก adminsTable ตาม Schema
        phone: companyTable.phone,
        avatarUrl: usersTable.avatarUrl,
        companyId: adminsTable.company,
        companyName: companyTable.name,
      })
      .from(usersTable)
      .innerJoin(adminsTable, eq(usersTable.id, adminsTable.user_id))
      .innerJoin(companyTable, eq(adminsTable.company, companyTable.id))
      .where(and(eq(usersTable.id, adminId), isNull(usersTable.deletedAt)))
      .limit(1);

    const currentAdmin = adminData?.[0]; // 🛡️ แก้ไข: เพิ่ม ? ป้องกัน null
    if (!currentAdmin) {
      redirect("/api/auth/logout-cleanup");
    }

    const companyId = currentAdmin.companyId;

    // 3. Fetch ข้อมูลแบบ Parallel พร้อมทำการ Join (ห้ามลบ ห้ามเปลี่ยน)
    const [
      rawEmployees,
      rawAttendance,
      rawLeaves,
      sitesData,
      positionsData,
      departmentsData,
      defaultShiftData,
      companyInfoData, // ✅ เพิ่มการ Query ข้อมูลบริษัทเพื่อใช้ในฟอร์มแก้ไข
    ] = await Promise.all([
      // --- พนักงาน ---
      db
        .select({
          id: usersTable.id,
          userName: usersTable.userName,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          role: usersTable.role,
          departmentId: usersTable.departmentId,
          positionName: positionsTable.name, // ✅ ดึงชื่อตำแหน่งจาก positionsTable
          siteName: sitesTable.name,
          siteId: usersTable.site_id,
          positionId: usersTable.positionId,
          avatarUrl: usersTable.avatarUrl,
          // ✅ ดึงเวลาเข้า-ออกงานรายบุคคลมาด้วย
          startTime: shiftsTable.startTime,
          endTime: shiftsTable.endTime,
        })
        .from(usersTable)
        .leftJoin(sitesTable, eq(usersTable.site_id, sitesTable.id))
        .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id)) // ✅ Join Position เพื่อเอาชื่อมาแสดง
        .leftJoin(shiftsTable, eq(usersTable.id, shiftsTable.userId)) // Join เพื่อเอาเวลาพนักงาน
        .where(
          and(
            or(eq(usersTable.role, "employee"), eq(usersTable.role, "leader")),
            eq(usersTable.createdBy, adminId),
            isNull(usersTable.deletedAt)
          )
        )
        .orderBy(desc(usersTable.created_at)),

      // --- การลงเวลา (Report) ---
      db
        .select({
          id: attendanceTable.id,
          date: attendanceTable.date,
          checkIn: attendanceTable.checkIn,
          checkOut: attendanceTable.checkOut,
          user_id: attendanceTable.user_id,
          locationIn: attendanceTable.locationIn,
          locationOut: attendanceTable.locationOut,
          imageIn: attendanceTable.imageIn,
          imageOut: attendanceTable.imageOut,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          siteInNameSnapshot: attendanceTable.siteInNameSnapshot,
          departmentNameSnapshot: attendanceTable.departmentNameSnapshot,
          siteName: sitesTable.name,
          siteIdInAttendance: attendanceTable.site_id,
          siteNameFromTable: sitesTable.name,
          // ✅ เพิ่ม Snapshot Time เพื่อความแม่นยำในการคำนวณสาย
          shiftStartTimeSnapshot: attendanceTable.shiftStartTimeSnapshot,
          startTime: shiftsTable.startTime,
          endTime: shiftsTable.endTime,
          isEarlyExit: attendanceTable.isEarlyExit,
          isLateFromDb: attendanceTable.isLate, // ✅ ดึงค่าจาก DB มาด้วย
        })
        .from(attendanceTable)
        .innerJoin(usersTable, eq(attendanceTable.user_id, usersTable.id))
        .leftJoin(sitesTable, eq(attendanceTable.site_id, sitesTable.id))
        .leftJoin(shiftsTable, eq(attendanceTable.shift_id, shiftsTable.id))
        .where(eq(usersTable.createdBy, adminId))
        .orderBy(desc(attendanceTable.date), desc(attendanceTable.createdAt)),

      // --- การลางาน ---
      db
        .select({
          id: leaveTable.id,
          type: leaveTable.type,
          startDate: leaveTable.startDate,
          endDate: leaveTable.endDate,
          status: leaveTable.status,
          reason: leaveTable.reason,
          remark: leaveTable.remark, // ✅ เพิ่มการดึงค่า Remark จาก Database
          fileUrl: leaveTable.fileUrl,
          fileName: leaveTable.fileName,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          userName: usersTable.userName,
          avatarUrl: usersTable.avatarUrl,
        })
        .from(leaveTable)
        .leftJoin(usersTable, eq(leaveTable.user_id, usersTable.id))
        .where(eq(usersTable.createdBy, adminId)) // ✅ ดึงเฉพาะการลาของพนักงานที่ Admin คนนี้ดูแล
        .orderBy(desc(leaveTable.startDate)),

      // --- ข้อมูลพื้นฐาน ---
      db
        .select()
        .from(sitesTable)
        .where(eq(sitesTable.companyId, companyId || "")),
      db
        .select()
        .from(positionsTable)
        .where(eq(positionsTable.company_id, companyId || "")),
      db
        .select()
        .from(departmentsTable)
        .where(eq(departmentsTable.companyId, companyId || "")),

      // ✅ ดึงเวลาเริ่มต้นกลางของบริษัท (Query 1 รอบ)
      db
        .select({
          startTime: shiftsTable.startTime,
          endTime: shiftsTable.endTime,
        })
        .from(shiftsTable)
        .where(
          and(
            eq(shiftsTable.companyId, companyId || ""),
            isNull(shiftsTable.userId) // ดึงกะที่เป็นค่ากลางของบริษัท (ถ้ามี)
          )
        )
        .limit(1),

      // ✅ ดึงข้อมูลบริษัทแบบละเอียด
      db
        .select({
          id: companyTable.id,
          name: companyTable.name,
          description: companyTable.description, // ✅ ดึง Description มาจากฐานข้อมูล
          address: companyTable.address,
          phone: companyTable.phone,
          email: companyTable.email,
          logoUrl: companyTable.logoUrl,
          companyCode: companyTable.companyCode,
        })
        .from(companyTable)
        .where(eq(companyTable.id, companyId || ""))
        .limit(1),
    ]);

    // 4. Mapping ข้อมูลให้ตรงกับ Client Page
    const employees = (rawEmployees || []).map((emp) => {
      const isUuid = emp?.userName && emp.userName.length > 30;
      const finalUserName = isUuid
        ? emp.firstName?.toLowerCase()
        : emp?.userName || "user";

      return {
        id: String(emp?.id || ""),
        userName: finalUserName,
        username: finalUserName,
        firstName: String(emp?.firstName || ""),
        lastName: String(emp?.lastName || ""),
        employeeName:
          `${emp?.firstName || ""} ${emp?.lastName || ""}`.trim() ||
          "ไม่ระบุชื่อ",
        role: String(emp?.role || "employee"),
        departmentId: emp?.departmentId ? String(emp.departmentId) : null,
        positionId: emp?.positionId ? String(emp.positionId) : null,
        siteId: emp?.siteId ? String(emp.siteId) : null,
        site: String(emp?.siteName || "ไม่ระบุ"),
        siteName: emp?.siteName || "ไม่ระบุ",
        position: String(emp?.positionName || "พนักงาน"),
        avatarUrl: emp?.avatarUrl || null,
        startTime: emp?.startTime || null,
        endTime: emp?.endTime || null,
      };
    });

    const standardTime = {
      startTime: defaultShiftData?.[0]?.startTime || "08:00",
      endTime: defaultShiftData?.[0]?.endTime || "17:00",
    };

    const attendance = (rawAttendance || []).map((at) => {
      // 🕒 Logic ตรวจสอบการมาสายรายวัน (ใช้ค่าจาก DB หรือคำนวณสด)
      let isLate = at.isLateFromDb ?? 0;
      if (!isLate && at?.checkIn) {
        // ใช้เวลาจาก Snapshot ก่อน ถ้าไม่มีให้ใช้จาก Shift หลัก
        const compareTime = at.shiftStartTimeSnapshot || at.startTime;
        if (compareTime) {
          const checkInTime = parseInt(at.checkIn.replace(":", ""), 10);
          const startTime = parseInt(compareTime.replace(":", ""), 10);
          if (checkInTime > startTime) {
            isLate = 1;
          }
        }
      }

      return {
        id: String(at?.id || ""),
        date: at?.date ? String(at.date) : "",
        checkIn: at?.checkIn || null,
        checkOut: at?.checkOut || null,
        userId: String(at?.user_id || ""),
        employeeName:
          `${at?.firstName || ""} ${at?.lastName || ""}`.trim() ||
          "ไม่ระบุชื่อ",
        siteSnapName:
          at?.siteInNameSnapshot || at?.siteName || "ทั่วไป (ไม่มีไซต์)",
        departmentSnapName: at?.departmentNameSnapshot || "ไม่ระบุแผนก",
        siteName: at?.siteName || "ทั่วไป (ไม่มีไซต์)",
        locationIn: String(at?.locationIn || "-"),
        locationOut: String(at?.locationOut || "-"),
        imageIn: at?.imageIn || null,
        imageOut: at?.imageOut || null,
        startTime: at?.shiftStartTimeSnapshot || at?.startTime || null,
        endTime: at?.endTime || null,
        isLate: isLate,
        isEarlyExit: at.isEarlyExit ? String(at.isEarlyExit) : "-",
      };
    });

    const leaves = (rawLeaves || []).map((l) => ({
      id: String(l?.id || ""),
      type: String(l?.type || "ลากิจ"),
      startDate: l?.startDate ? String(l.startDate) : "",
      endDate: l?.endDate ? String(l.endDate) : "",
      status: String(l?.status || "pending"),
      reason: String(l?.reason || ""),
      remark: String(l?.remark || ""),
      fileUrl: l?.fileUrl || null,
      fileName: l?.fileName || null,
      employeeName:
        `${l?.firstName || ""} ${l?.lastName || ""}`.trim() || "ไม่ระบุพนักงาน",
      userName: String(l?.userName || ""),
      avatarUrl: l?.avatarUrl || null,
    }));

    const sites = (sitesData || []).map((s) => ({
      id: String(s?.id || ""),
      name: String(s?.name || ""),
      address: s?.address || "",
      lat: s?.lat || "",
      lng: s?.lng || "",
    }));

    const hasMultiSiteActive = sites.some((s) => s.name === "ทุกไซต์");

    const positions = (positionsData || []).map((p) => ({
      id: String(p?.id || ""),
      name: String(p?.name || ""),
    }));
    const departments = (departmentsData || []).map((d) => ({
      id: String(d?.id || ""),
      name: String(d?.name || ""),
    }));

    const initialCompanyData = companyInfoData?.[0] || null;

    const adminProfile = {
      id: currentAdmin?.id || "",
      name: `${currentAdmin?.firstName || ""} ${
        currentAdmin?.lastName || ""
      }`.trim(),
      firstName: currentAdmin?.firstName || "",
      lastName: currentAdmin?.lastName || "",
      userName: currentAdmin?.userName || "",
      username: currentAdmin?.userName || "",
      email: currentAdmin?.email || "",
      phone: currentAdmin?.phone || "",
      avatarUrl: currentAdmin?.avatarUrl || null,
      company: String(currentAdmin?.companyName || "บริษัท"),
      role: "admin",
    };

    const rawProps = {
      initialEmployees: employees,
      initialAttendance: attendance,
      initialLeaves: leaves,
      admin: adminProfile,
      sites: sites,
      hasMultiSiteActive: hasMultiSiteActive,
      positions: positions,
      departments: departments,
      standardTime: standardTime,
      initialCompanyData: initialCompanyData,
    };

    const safeProps = JSON.parse(
      JSON.stringify(rawProps, (key, value) =>
        value === undefined ? null : value
      )
    );

    return <AdminClientPage {...safeProps} />;
  } catch (error: any) {
    if (
      error.message === "NEXT_REDIRECT" ||
      error.digest?.includes("NEXT_REDIRECT")
    ) {
      throw error;
    }

    console.error("Critical Dashboard Error:", error);
    redirect("/api/auth/logout-cleanup");
  }
}