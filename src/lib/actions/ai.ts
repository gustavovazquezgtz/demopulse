"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/permissions";

export async function acknowledgeAlert(id: string) {
  await requireSession();
  await prisma.aiAlert.update({ where: { id }, data: { status: "ACKNOWLEDGED" } });
  revalidatePath("/alerts");
}

export async function resolveAlert(id: string) {
  await requireSession();
  await prisma.aiAlert.update({ where: { id }, data: { status: "RESOLVED", resolvedAt: new Date() } });
  revalidatePath("/alerts");
}

export async function acknowledgeRecognition(id: string) {
  await requireSession();
  await prisma.recognition.update({ where: { id }, data: { acknowledged: true } });
  revalidatePath("/recognition");
}
