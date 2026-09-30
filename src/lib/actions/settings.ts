"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/permissions";
import { GROUP_THRESHOLDS_KEY } from "@/lib/queries/app-settings";
import type { GroupThresholds } from "@/lib/employee-bank/scoring";

export async function updateGroupThresholds(thresholds: GroupThresholds) {
  await requireSession();
  if (thresholds.aMin <= thresholds.bMin) throw new Error("The Group A threshold must be higher than the Group B threshold.");

  await prisma.appSetting.upsert({
    where: { key: GROUP_THRESHOLDS_KEY },
    update: { value: thresholds as unknown as Prisma.InputJsonValue },
    create: { key: GROUP_THRESHOLDS_KEY, value: thresholds as unknown as Prisma.InputJsonValue },
  });

  revalidatePath("/settings");
  revalidatePath("/employee-bank");
}
