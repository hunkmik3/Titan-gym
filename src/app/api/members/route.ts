import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const getNextPaymentDate = (plan: string) => {
  const now = new Date();
  const lower = plan.toLowerCase();
  let months = 1;
  if (lower.includes("12 tháng")) months = 12;
  else if (lower.includes("6 tháng")) months = 6;
  else if (lower.includes("3 tháng")) months = 3;
  else if (lower.includes("1 tháng")) months = 1;

  const next = new Date(now);
  next.setMonth(next.getMonth() + months);
  return next;
};

export async function GET() {
  const members = await prisma.member.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(members);
}

export async function POST(req: Request) {
  const body = await req.json();

  try {
    const nextPayment = getNextPaymentDate(body.plan);
    const member = await prisma.member.create({
      data: {
        name: body.name,
        phone: body.phone,
        email: body.email || null,
        plan: body.plan,
        nextPayment,
        status: body.status,
        checkinsThisMonth: body.checkinsThisMonth ?? 0,
        avatarUrl: body.avatarUrl || null,
        notes: body.notes || null,
      },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error: any) {
    // Prisma unique constraint (email/phone) => return 409 conflict
    if (error?.code === "P2002") {
      const fields = Array.isArray(error.meta?.target)
        ? error.meta.target.join(", ")
        : "email/phone";
      return NextResponse.json(
        { error: `Thông tin đã tồn tại (${fields})` },
        { status: 409 }
      );
    }
    console.error("Create member error:", error);
    return NextResponse.json(
      { error: "Lỗi tạo hội viên" },
      { status: 500 }
    );
  }
}

