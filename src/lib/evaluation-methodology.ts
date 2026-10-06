import { prisma } from "@/lib/prisma";

const CUTOFF_SETTING_KEY = "evaluationMethodologyCutoff";

/**
 * Everything on or before this date was (and stays) scored with the
 * legacy yes/no criteria. Everything after it is scored with the new
 * 1-5 scale + dynamic per-criterion weights. Stored in AppSetting so it's
 * a one-time, explicit decision rather than always meaning "yesterday
 * relative to whenever this code runs" — the switch happens once, on a
 * specific calendar date, and stays put after that.
 */
export async function getMethodologyCutoffDate(): Promise<Date> {
  const row = await prisma.appSetting.findUnique({ where: { key: CUTOFF_SETTING_KEY } });
  if (row) return new Date((row.value as { date: string }).date);
  // Default: yesterday relative to the first time this is ever read,
  // i.e. "everything up to today is legacy, today onward is new."
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(23, 59, 59, 999);
  return yesterday;
}

export async function setMethodologyCutoffDate(date: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: CUTOFF_SETTING_KEY },
    update: { value: { date } },
    create: { key: CUTOFF_SETTING_KEY, value: { date } },
  });
}

/** Is "now" past the cutoff? Used only to decide the scoring version of a
 * BRAND NEW evaluation — an existing evaluation's scoringVersion, once
 * set, is never re-derived from this. */
export async function isPastMethodologyCutoff(): Promise<boolean> {
  const cutoff = await getMethodologyCutoffDate();
  return new Date() > cutoff;
}
