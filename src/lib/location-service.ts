import { db } from "@/db/db"; 
import { sitesTable, attendanceTable } from "@/db/schema"; 
import { and, eq, sql, ne } from "drizzle-orm"; 
import { desc } from "drizzle-orm";

// รัศมีประมาณ 10 เมตร (รวมกรอบเป็น 20x20 เมตร)
const OFFSET_10M = 0.00009; 

/**
 * 1. ฟังก์ชันสำหรับเช็คว่าพิกัดอยู่ในกรอบหรือไม่
 */
export const isInsideBound = (
  userLat: number | string, 
  userLon: number | string, 
  siteLat: number | string, 
  siteLon: number | string
) => {
  const uLat = typeof userLat === "string" ? parseFloat(userLat.trim()) : userLat;
  const uLon = typeof userLon === "string" ? parseFloat(userLon.trim()) : userLon;
  const sLat = typeof siteLat === "string" ? parseFloat(siteLat.trim()) : siteLat;
  const sLon = typeof siteLon === "string" ? parseFloat(siteLon.trim()) : siteLon;

  if (isNaN(uLat) || isNaN(uLon) || isNaN(sLat) || isNaN(sLon)) return false;

  return (
    uLat >= sLat - OFFSET_10M &&
    uLat <= sLat + OFFSET_10M &&
    uLon >= sLon - OFFSET_10M &&
    uLon <= sLon + OFFSET_10M
  );
};

/**
 * 2. ฟังก์ชันหลักสำหรับหา "ไซต์งานผู้ชนะ"
 * ปรับปรุง: บังคับหาไซต์จริงจากพิกัด และห้ามใช้ "ทุกไซต์" มาเป็นตัวเปรียบเทียบพิกัด
 */
export const validateAndGetSite = async (
  userLat: number | string,
  userLon: number | string,
  companyId: string, 
  fixedSiteId: string | null
) => {
  let winnerSite: any = null;
  let isEverySiteUser = false;

  // --- ขั้นตอนที่ 1: ตรวจสอบสถานะ User จากฐานข้อมูลโดยตรง ---
  if (fixedSiteId && fixedSiteId !== "") {
    const site = await db.query.sitesTable.findFirst({
      where: eq(sitesTable.id, fixedSiteId),
    });

    if (site?.name === "ทุกไซต์") {
      isEverySiteUser = true;
    }
  }

  // --- ขั้นตอนที่ 2: กวาดหาไซต์จริงจากฐานข้อมูล (ห้ามดึง "ทุกไซต์" มาเปรียบเทียบพิกัดเด็ดขาด) ---
  // ใช้ ne(sitesTable.name, "ทุกไซต์") เพื่อกรองออกตั้งแต่ระดับ SQL Query
  const allActualSites = await db.query.sitesTable.findMany({
    where: ne(sitesTable.name, "ทุกไซต์")
  }); 

  const actualLocationSite = allActualSites.find(site => {
    if (!site.coordinates) return false;
    const [sLat, sLon] = site.coordinates.split(',').map(s => s.trim());
    return isInsideBound(userLat, userLon, sLat, sLon);
  });

  // --- ขั้นตอนที่ 3: ตัดสินผู้ชนะ (บังคับต้องตรงพิกัดไซต์จริงเท่านั้น) ---
  if (actualLocationSite) {
    // ถ้าพิกัดตรงกับไซต์จริง ให้ใช้ไซต์นั้น (จะได้ชื่อสถานที่จริงไปลง Snapshot)
    winnerSite = actualLocationSite;
  } else if (!isEverySiteUser && fixedSiteId) {
    // กรณีพนักงาน Fix ไซต์ปกติ (ไม่ใช่ "ทุกไซต์") แต่พิกัดไม่ตรงกับที่ไหนเลย ให้เช็คกับไซต์ตัวเองอีกครั้ง
    const site = await db.query.sitesTable.findFirst({ where: eq(sitesTable.id, fixedSiteId) });
    if (site && site.coordinates) {
      const [sLat, sLon] = site.coordinates.split(',').map(s => s.trim());
      if (!isInsideBound(userLat, userLon, sLat, sLon)) {
        throw new Error("คุณไม่ได้อยู่ในรัศมีไซต์งานประจำของคุณ (20 เมตร)");
      }
      winnerSite = site;
    }
  }

  // หากเป็นคนที่มีสิทธิ์ "ทุกไซต์" แต่พิกัดไม่ตรงกับไซต์จริงใดๆ ในระบบเลย winnerSite จะเป็น null และ Error ทันที
  if (!winnerSite) throw new Error("ไม่พบไซต์งานจริงในรัศมีที่กำหนด (กรุณายืนให้ตรงจุดเช็คอิน)");

  // ✅ ส่วนบันทึก Snapshot: บันทึกเฉพาะชื่อที่เป็นสถานที่จริง
  if (winnerSite.name !== "ทุกไซต์") {
    try {
      const lastRecord = await db.query.attendanceTable.findFirst({
        orderBy: [desc(attendanceTable.createdAt)],
      });

      if (lastRecord) {
        await db.update(attendanceTable)
          .set({
            siteNameSnapshot: winnerSite.name,
            siteCoordinatesSnapshot: winnerSite.coordinates,
          })
          .where(eq(attendanceTable.id, lastRecord.id));
      }
    } catch (e) {
      console.error("Failed to update snapshot:", e);
    }
  }

  return winnerSite;
};