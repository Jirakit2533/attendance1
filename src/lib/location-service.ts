import { db } from "@/db/db"; 
import { sitesTable, attendanceTable, usersTable } from "@/db/schema"; 
import { and, eq, sql, ne, isNull, desc } from "drizzle-orm"; 

// ปรับเป็น 20 เมตร (0.00018) ตามที่กำหนด เพื่อความเข้มงวดของระบบ
const OFFSET_20M = 0.00018; 

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
    uLat >= sLat - OFFSET_20M &&
    uLat <= sLat + OFFSET_20M &&
    uLon >= sLon - OFFSET_20M &&
    uLon <= sLon + OFFSET_20M
  );
};

/**
 * 2. ฟังก์ชันหลักสำหรับหา "ไซต์งานผู้ชนะ" (Check-in)
 */
export const validateAndGetSite = async (
  userLat: number | string,
  userLon: number | string,
  companyId: string, 
  fixedSiteId: string | null
) => {
  let winnerSite: any = null;
  let isEverySiteUser = false;
  let isOffsiteIn = "0";
  let OffsiteCheckInConfirm = false; 

  // --- ขั้นตอนที่ 1: ตรวจสอบสถานะ User (ทุกไซต์?) ---
  if (fixedSiteId && fixedSiteId !== "") {
    const site = await db.query.sitesTable.findFirst({
      where: and(eq(sitesTable.id, fixedSiteId), eq(sitesTable.companyId, companyId)),
    });

    if (site?.name === "ทุกไซต์") {
      isEverySiteUser = true;
    }
  }

  // --- ขั้นตอนที่ 2: กวาดหาไซต์จริงที่พิกัดตรงกัน ---
  const allActualSites = await db.query.sitesTable.findMany({
    where: and(
      ne(sitesTable.name, "ทุกไซต์"),
      eq(sitesTable.companyId, companyId)
    )
  }); 

  const actualLocationSite = allActualSites.find(site => {
    if (!site.coordinates || !site.coordinates.includes(',')) return false;
    const [sLat, sLon] = site.coordinates.split(',').map(s => s.trim());
    return isInsideBound(userLat, userLon, sLat, sLon);
  });

  // --- ขั้นตอนที่ 3: ตัดสินตามเงื่อนไขวินัย ---
  if (isEverySiteUser) {
    if (actualLocationSite) {
      winnerSite = { ...actualLocationSite };
      isOffsiteIn = "0";
      OffsiteCheckInConfirm = false;
    } else {
      // กลุ่มทุกไซต์ แต่อยู่นอกเขต: ใช้ ID ของแถว "ทุกไซต์" เป็นหลัก แต่บันทึกชื่อว่า "ไม่ตรงไซต์"
      winnerSite = { 
        id: fixedSiteId, 
        name: "ไม่ตรงไซต์" 
      }; 
      isOffsiteIn = "1";
      OffsiteCheckInConfirm = true; 
    }
  } else {
    // กรณีมีไซต์ประจำ (Fixed Site)
    if (fixedSiteId) {
      const site = await db.query.sitesTable.findFirst({ 
        where: eq(sitesTable.id, fixedSiteId) 
      });
      
      if (site && site.coordinates && site.coordinates.includes(',')) {
        const [sLat, sLon] = site.coordinates.split(',').map(s => s.trim());
        const isInside = isInsideBound(userLat, userLon, sLat, sLon);
        
        if (!isInside) {
          throw new Error(`คุณไม่อยู่ในรัศมีไซต์งานที่กำหนดกรุณาเข้างานในพื้นที่ที่กำหนด`);
        }

        isOffsiteIn = "0";
        winnerSite = { ...site };
        OffsiteCheckInConfirm = false;
      }
    }
  }

  if (!winnerSite) throw new Error("ไม่พบข้อมูลไซต์งานที่ถูกต้องในระบบ");

  return {
    ...winnerSite,
    isOffsiteIn,
    OffsiteCheckInConfirm,
    userCoordinates: `${userLat}, ${userLon}`
  };
};

/**
 * 3. ฟังก์ชันสำหรับ Validate พิกัดตอนเช็คเอาท์ (Check-out)
 */
export const validateCheckOutLocation = async (
  userId: string,
  userLat: number | string,
  userLon: number | string,
  currentRecord: any 
) => {
  const userProfile = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
  });

  const mainSite = await db.query.sitesTable.findFirst({
    where: and(
        eq(sitesTable.id, userProfile?.site_id || ""),
        eq(sitesTable.companyId, userProfile?.companyId || "")
    ),
  });
  
  const isEverySiteUser = mainSite?.name === "ทุกไซต์";

  if (isEverySiteUser) {
    const allActualSites = await db.query.sitesTable.findMany({
      where: and(
        ne(sitesTable.name, "ทุกไซต์"),
        eq(sitesTable.companyId, userProfile?.companyId || "")
      )
    });

    const isAtAnySite = allActualSites.some(site => {
      if (!site.coordinates || !site.coordinates.includes(',')) return false;
      const [sLat, sLon] = site.coordinates.split(',').map(s => s.trim());
      return isInsideBound(userLat, userLon, sLat, sLon);
    });

    const isOffsiteOut = isAtAnySite ? "0" : "1";
    return { 
      isOffsiteOut, 
      isOffsiteOutCoordinates: `${userLat}, ${userLon}`, 
      OffsiteCheckOutConfirm: isOffsiteOut === "1", 
      siteOutName: isOffsiteOut === "1" ? "ไม่ตรงไซต์" : (currentRecord?.siteInNameSnapshot || "ทุกไซต์")
    };
  }

  // กรณีพนักงานประจำไซต์
  const targetSiteId = currentRecord?.site_id || userProfile?.site_id;
  
  if (!targetSiteId) {
    throw new Error("ไม่พบข้อมูลไซต์งานสำหรับการตรวจสอบพิกัดออกงาน");
  }

  const siteInDb = await db.query.sitesTable.findFirst({
    where: eq(sitesTable.id, targetSiteId),
  });

  if (siteInDb && siteInDb.coordinates && siteInDb.coordinates.includes(',')) {
    const [sLat, sLon] = siteInDb.coordinates.split(',').map(s => s.trim());
    const isInside = isInsideBound(userLat, userLon, sLat, sLon);
    
    if (!isInside) {
       throw new Error(`คุณไม่อยู่ในรัศมีไซต์งาน (${siteInDb.name}) ไม่สามารถลงชื่อออกงานได้`);
    }

    return { 
      isOffsiteOut: "0", 
      isOffsiteOutCoordinates: `${userLat}, ${userLon}`, 
      OffsiteCheckOutConfirm: false,
      siteOutName: currentRecord?.siteInNameSnapshot || siteInDb.name
    };
  }

  throw new Error("ข้อมูลพิกัดไซต์งานไม่สมบูรณ์ ไม่สามารถตรวจสอบตำแหน่งได้");
};