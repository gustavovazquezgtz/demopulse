// Speech-to-text for 1:1 recordings. Separate from the AIProvider
// interface (narrateSummary/analyzeDeveloper) because there's no
// rule-based equivalent for transcription — without OPENAI_API_KEY this
// simply returns null and the summary step falls back to whatever text
// fields were typed manually (recommendations/feedback/notes).
export async function transcribeAudio(audio: Buffer, mimeType: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const form = new FormData();
    const extension = mimeType.includes("mp4") ? "mp4" : mimeType.includes("wav") ? "wav" : "webm";
    form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), `recording.${extension}`);
    form.append("model", "whisper-1");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.text === "string" ? data.text : null;
  } catch {
    return null;
  }
}
