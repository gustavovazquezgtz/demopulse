"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Mic, Square, Upload } from "lucide-react";
import { uploadOneOnOneRecording } from "@/lib/actions/one-on-ones";
import { Button } from "@/components/ui/button";

const MAX_SECONDS = 8 * 60; // keep clips well under the 4.5mb action body cap
const MAX_FILE_BYTES = 4 * 1024 * 1024;

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return "audio/webm";
}

export function AudioRecorder({ sessionId }: { sessionId: string }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [pending, startTransition] = useTransition();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        upload(blob, mimeType);
      };
      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) {
            recorder.stop();
            stopTimer();
            setRecording(false);
            toast.info("Reached the ~8 min cap for one clip — recording saved. Start a new one to keep going.");
            return s + 1;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      toast.error("Couldn't access the microphone — check your browser permissions.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    stopTimer();
    setRecording(false);
  }

  function upload(blob: Blob, mimeType: string) {
    if (blob.size === 0) {
      toast.error("The recording was empty.");
      return;
    }
    const extension = mimeType.includes("mp4") ? "mp4" : "webm";
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("audio", blob, `recording.${extension}`);
        await uploadOneOnOneRecording(sessionId, formData);
        toast.success("Recording saved");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save recording");
      }
    });
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error("That file is too large for one clip (~4 MB max). Try a shorter recording.");
      e.target.value = "";
      return;
    }
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("audio", file);
        await uploadOneOnOneRecording(sessionId, formData);
        toast.success("Recording uploaded");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not upload recording");
      } finally {
        e.target.value = "";
      }
    });
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="flex items-center gap-2">
      {recording ? (
        <Button size="sm" variant="destructive" onClick={stopRecording}>
          <Square className="h-3.5 w-3.5" /> Stop ({mm}:{ss})
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={startRecording} disabled={pending}>
          <Mic className="h-3.5 w-3.5" /> Record
        </Button>
      )}
      <Button size="sm" variant="ghost" disabled={pending || recording} onClick={() => fileInputRef.current?.click()}>
        <Upload className="h-3.5 w-3.5" /> Upload file
      </Button>
      <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={onFileChosen} />
      {pending && <span className="text-xs text-muted-foreground">Saving…</span>}
    </div>
  );
}
