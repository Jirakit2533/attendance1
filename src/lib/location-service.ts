import { db } from "@/db/db"; 
import { sitesTable,  usersTable } from "@/db/schema"; 
import { and, eq, ne} from "drizzle-orm"; 

// ปรับเป็นประมาณ 20 เมตร (0.00018) ตามความต้องการล่าสุด
const OFFSET_30M = 0.00027; 

/**
 * 1. ฟังก์ชันสำหรับเช็คว่าพิกัดอยู่ในกรอบหรือไม่
 */
export const isInsideBound = (
  userLat: number | string, 
  userLon: number | string, 
  siteLat: number | string, 
  siteLon: number | string
) => {
  // ทำความสะอาดพิกัดฝั่ง User และ Site ให้เป็น 6 หลักก่อนคำนวณ
  const uLat = typeof userLat === "string" ? parseFloat(parseFloat(userLat.trim()).toFixed(6)) : parseFloat(userLat.toFixed(6));
  const uLon = typeof userLon === "string" ? parseFloat(parseFloat(userLon.trim()).toFixed(6)) : parseFloat(userLon.toFixed(6));
  const sLat = typeof siteLat === "string" ? parseFloat(parseFloat(siteLat.trim()).toFixed(6)) : parseFloat(siteLat.toFixed(6));
  const sLon = typeof siteLon === "string" ? parseFloat(parseFloat(siteLon.trim()).toFixed(6)) : parseFloat(siteLon.toFixed(6));

  if (isNaN(uLat) || isNaN(uLon) || isNaN(sLat) || isNaN(sLon)) return false;

  return (
    uLat >= sLat - OFFSET_30M &&
    uLat <= sLat + OFFSET_30M &&
    uLon >= sLon - OFFSET_30M &&
    uLon <= sLon + OFFSET_30M
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
      winnerSite = { 
        id: fixedSiteId, 
        name: "ไม่ตรงไซต์" 
      }; 
      isOffsiteIn = "1";
      OffsiteCheckInConfirm = true; 
    }
  } else {
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

  // ล้างค่าพิกัดที่จะบันทึกลงฐานข้อมูลให้เป็น 6 หลัก
  const cleanUserLat = typeof userLat === "string" ? parseFloat(userLat).toFixed(6) : userLat.toFixed(6);
  const cleanUserLon = typeof userLon === "string" ? parseFloat(userLon).toFixed(6) : userLon.toFixed(6);

  return {
    ...winnerSite,
    isOffsiteIn,
    OffsiteCheckInConfirm,
    userCoordinates: `${cleanUserLat}, ${cleanUserLon}`
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

  // ล้างค่าพิกัดผู้ใช้ให้เป็น 6 หลัก
  const cleanUserLat = typeof userLat === "string" ? parseFloat(userLat).toFixed(6) : userLat.toFixed(6);
  const cleanUserLon = typeof userLon === "string" ? parseFloat(userLon).toFixed(6) : userLon.toFixed(6);

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
      isOffsiteOutCoordinates: `${cleanUserLat}, ${cleanUserLon}`, 
      OffsiteCheckOutConfirm: isOffsiteOut === "1", 
      siteOutName: isOffsiteOut === "1" ? "ไม่ตรงไซต์" : (currentRecord?.siteInNameSnapshot || "ทุกไซต์")
    };
  }

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
      isOffsiteOutCoordinates: `${cleanUserLat}, ${cleanUserLon}`, 
      OffsiteCheckOutConfirm: false,
      siteOutName: currentRecord?.siteInNameSnapshot || siteInDb.name
    };
  }

  throw new Error("ข้อมูลพิกัดไซต์งานไม่สมบูรณ์ ไม่สามารถตรวจสอบตำแหน่งได้");
};