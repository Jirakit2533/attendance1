import {
  generateUploadButton,
  generateUploadDropzone,
  generateReactHelpers,
} from "@uploadthing/react";

import type { OurFileRouter } from "@/app/api/uploadthing/core"; 

// ✅ แก้ไขตรงนี้ให้เป็น T ตัวใหญ่ เพื่อให้เป็นมาตรฐาน
export const { useUploadThing, uploadFiles } = generateReactHelpers<OurFileRouter>();

export const UploadButton = generateUploadButton<OurFileRouter>();
export const UploadDropzone = generateUploadDropzone<OurFileRouter>();