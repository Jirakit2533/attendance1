import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const leaves = await prisma.leave.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(leaves);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch leaves" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const newLeave = await prisma.leave.create({
      data: {
        type: data.type,
        start: data.start,
        end: data.end,
        reason: data.reason,
        days: data.days,
        status: "รออนุมัติ",
      },
    });
    return NextResponse.json(newLeave);
  } catch (error) {
    return NextResponse.json({ error: "Submit leave failed" }, { status: 500 });
  }
}