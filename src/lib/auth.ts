// src/lib/auth.ts
import { cookies } from "next/headers";
import { db } from "@/db/db";
import { usersTable } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("session_user_id")?.value;
  if (!userId) return null;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user || null;
}