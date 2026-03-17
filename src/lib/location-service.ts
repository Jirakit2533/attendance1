import { db } from "@/db/db"; 
import { sitesTable } from "@/db/schema"; 
import { and, eq, sql } from "drizzle-orm";

// รัศมีประมาณ 10 เมตร (รวมกรอบเป็น 20x20 เมตร)
const OFFSET_10M = 0.00009; 

/**
 * 1. ฟังก์ชันสำหรับเช็คว่าพิกัดอยู่ในกรอบหรือไม่ (ฉบับปรับปรุงให้ยืดหยุ่น)
 */
export const isInsideBound = (
  userLat: number | string, 
  userLon: number | string, 
  siteLat: number | string, 
  siteLon: number | string
) => {
  // --- การจัดการข้อมูล (Data Normalization) ---
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
 * แก้ไข: เพิ่มระบบ Bypass การเช็คพิกัดหากพนักงานสังกัดไซต์ชื่อ "ทุกไซต์"
 */
export const validateAndGetSite = async (
  userLat: number | string,
  userLon: number | string,
  companyId: string, // รับค่า ID ของบริษัทมาตรวจสอบ
  fixedSiteId: string | null
) => {
  // --- กรณีพนักงานแบบที่ 1: มีไซต์ประจำ (Fixed Site) ---
  if (fixedSiteId && fixedSiteId !== "") {
    const site = await db.query.sitesTable.findFirst({
      where: eq(sitesTable.id, fixedSiteId),
    });

    if (!site) throw new Error("ไม่พบข้อมูลไซต์งานประจำของคุณในระบบ (กรุณาแจ้งแอดมิน)");

    // ✅ เพิ่ม Logic: ถ้าชื่อไซต์คือ "ทุกไซต์" ให้ผ่านทันทีโดยไม่ต้องเช็คพิกัด
    if (site.name === "ทุกไซต์") {
      return site;
    }

    if (!site.coordinates) throw new Error("พิกัดไซต์งานไม่สมบูรณ์");

    const [sLat, sLon] = site.coordinates.split(',').map(s => s.trim());

    const ok = isInsideBound(userLat, userLon, sLat, sLon);
    if (!ok) throw new Error("คุณไม่ได้อยู่ในรัศมีไซต์งานประจำของคุณ (20 เมตร)");

    return site;
  }

  // --- กรณีพนักงานแบบที่ 2: ไม่มีไซต์ประจำ (Roaming) ---
  // ขั้นแรก: ค้นหาไซต์ในบริษัทก่อน
  const companySites = await db.query.sitesTable.findMany({
    where: eq(sitesTable.companyId, companyId), 
  });

  console.log("All Sites in this company:", companySites.map(s => ({ name: s.name, coord: s.coodinates })));

  // วนลูปเปรียบเทียบพิกัดพนักงานกับไซต์ในบริษัท
  let winnerSite = companySites.find(site => {
    if (!site.coordinates) return false;
    const [sLat, sLon] = site.coordinates.split(',').map(s => s.trim());
    return isInsideBound(userLat, userLon, sLat, sLon);
  });

  // --- ชั้นที่ 3: Fallback (ถ้าหาในบริษัทไม่เจอ ให้กวาดหาจากไซต์ทั้งหมดในระบบ) ---
  if (!winnerSite) {
    console.log("Not found in company. Fallback: Searching all sites in system...");
    const allGlobalSites = await db.query.sitesTable.findMany(); 
    
    winnerSite = allGlobalSites.find(site => {
      if (!site.coordinates) return false;
      const [sLat, sLon] = site.coordinates.split(',').map(s => s.trim());
      return isInsideBound(userLat, userLon, sLat, sLon);
    });
  }

  // หากพิกัดไม่ตรงกับไซต์ใดเลยในระบบ
  if (!winnerSite) throw new Error("ไม่พบไซต์งานในแผนกของคุณที่อยู่ในรัศมี 20 เมตร");

  // ส่งข้อมูลไซต์ที่พิกัดตรงกันกลับไปเพื่อให้ Action นำไปทำ Snapshot
  return winnerSite;
};