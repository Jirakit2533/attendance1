//@/features/feature-service.ts

import { db } from "@/db/db";
import { companyFeatureSelectedTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export const FeatureService = {
  /**
   * ตรวจสอบว่าฟีเจอร์ที่ระบุถูกเปิดใช้งานหรือไม่
   * @param companyId ไอดีบริษัท
   * @param featureKey ชื่อฟีเจอร์ที่ต้องการเช็ค (เช่น 'remarkAttendance')
   */
  async isFeatureActive(companyId: string, featureKey: string): Promise<boolean> {
    try {
      if (!companyId) return false;

      const [selection] = await db
        .select({
          featureSelectedArray: companyFeatureSelectedTable.featureSelectedArray
        })
        .from(companyFeatureSelectedTable)
        .where(eq(companyFeatureSelectedTable.companyId, companyId))
        .limit(1);

      if (!selection || !selection.featureSelectedArray) return false;

      // ตรวจสอบว่ามี featureKey อยู่ใน Array หรือไม่ (รองรับ JSONB)
      const activeFeatures = selection.featureSelectedArray as string[];
      return activeFeatures.includes(featureKey);
    } catch (error) {
      console.error("FeatureService Error:", error);
      return false;
    }
  },

  /**
   * ดึงรายการฟีเจอร์ทั้งหมดที่เปิดใช้งานของบริษัทนั้นๆ
   * ใช้สำหรับดึงข้อมูลครั้งเดียวเพื่อเช็คหลายฟีเจอร์ใน Action
   */
  async getActiveFeatures(companyId: string): Promise<string[]> {
    try {
      if (!companyId) return [];

      const [selection] = await db
        .select({
          featureSelectedArray: companyFeatureSelectedTable.featureSelectedArray
        })
        .from(companyFeatureSelectedTable)
        .where(eq(companyFeatureSelectedTable.companyId, companyId))
        .limit(1);

      return (selection?.featureSelectedArray as string[]) || [];
    } catch (error) {
      console.error("FeatureService Error:", error);
      return [];
    }
  }
};