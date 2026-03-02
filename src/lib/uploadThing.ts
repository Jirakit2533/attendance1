import {
  generateUploadButton,
  generateUploadDropzone,
  generateReactHelpers,
} from "@uploadthing/react";

// ✅ ตรวจสอบ Path นี้ให้ตรงกับไฟล์ core.ts ของคุณ
import type { OurFileRouter } from "@/app/api/uploadthing/core"; 

// ✅ สร้างและ Export เฉพาะ Helpers สำหรับหน้าบ้าน
export const { useUploadThing, uploadFiles } = generateReactHelpers<OurFileRouter>();

export const UploadButton = generateUploadButton<OurFileRouter>();
export const UploadDropzone = generateUploadDropzone<OurFileRouter>();