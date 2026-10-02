export const FORMAT_OPTIONS = ["IN_PERSON", "VIDEO_CALL", "PHONE_CALL", "CHAT", "OTHER"] as const;

const FORMAT_LABELS: Record<string, string> = {
  IN_PERSON: "In Person",
  VIDEO_CALL: "Video Call (Teams/Zoom/etc.)",
  PHONE_CALL: "Phone Call",
  CHAT: "Chat / Message",
  OTHER: "Other",
};

export function formatLabel(format: string): string {
  return FORMAT_LABELS[format] ?? format;
}
