import { prisma } from "@/lib/prisma";
import { DEFAULT_GROUP_THRESHOLDS, type GroupThresholds } from "@/lib/employee-bank/scoring";

const GROUP_THRESHOLDS_KEY = "employeeBankGroupThresholds";

export async function getGroupThresholds(): Promise<GroupThresholds> {
  const row = await prisma.appSetting.findUnique({ where: { key: GROUP_THRESHOLDS_KEY } });
  if (!row) return DEFAULT_GROUP_THRESHOLDS;
  return row.value as unknown as GroupThresholds;
}

export { GROUP_THRESHOLDS_KEY };
