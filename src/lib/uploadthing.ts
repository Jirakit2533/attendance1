import {
  generateUploadButton,
  generateUploadDropzone,
} from "@uploadthing/react";
import { generateReactHelpers } from "@uploadthing/react";

import type { OurFileRouter } from "@/app/api/uploadthing/core";

export const UploadButton = generateUploadButton<OurFileRouter>();
export const UploadDropzone = generateUploadDropzone<OurFileRouter>();

// บรรทัดนี้สำคัญมาก เพราะ leaderClientPage.tsx เรียกใช้ตัวนี้
export const { useUploadThing, uploadFiles } = generateReactHelpers<OurFileRouter>();