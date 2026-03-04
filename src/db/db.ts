import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema'; // ดึงไฟล์ schema.ts ที่เราเขียนกันไว้มาใช้

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing from .env file');
}

const sql = neon(process.env.DATABASE_URL);

// ประกาศตัวแปร db เพื่อให้ไฟล์อื่น (เช่น auth.ts) import ไปใช้งานได้
export const db = drizzle(sql, { schema });