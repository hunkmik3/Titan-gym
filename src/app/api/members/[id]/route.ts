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

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await req.json();

  const member = await prisma.member.update({
    where: { id },
    data: {
      name: body.name,
      phone: body.phone,
      email: body.email || null,
      plan: body.plan,
      nextPayment: getNextPaymentDate(body.plan),
      status: body.status,
      checkinsThisMonth: body.checkinsThisMonth,
      avatarUrl: body.avatarUrl || null,
      notes: body.notes,
    },
  });

  return NextResponse.json(member);
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    await prisma.member.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete member error:", error);
    return NextResponse.json({ error: "Không thể xóa hội viên" }, { status: 500 });
  }
}

