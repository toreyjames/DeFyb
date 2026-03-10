"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { analyzeEncounter } from "@/lib/analysisPipeline";
import { saveAnalysis } from "@/lib/session";

export default function EncounterInput() {
  const router = useRouter();
  const [transcript, setTranscript] = useState("");
  const [note, setNote] = useState("");
  const [audioContext, setAudioContext] = useState("");

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const result = analyzeEncounter({
      transcript: transcript || audioContext,
      note,
      visitType: "established"
    });

    saveAnalysis(result);
    router.push("/billing-review");
  };

  return (
    <form className="panel" onSubmit={onSubmit}>
      <h1>Encounter Input</h1>
      <p className="subtitle">
        Capture encounter evidence first. DeFyb extracts coding-relevant facts before recommending billing.
      </p>

      <label htmlFor="transcript">Transcript / Conversation</label>
      <textarea
        id="transcript"
        rows={8}
        value={transcript}
        onChange={(event) => setTranscript(event.target.value)}
        placeholder="Paste transcript text here"
      />

      <label htmlFor="note">Existing Clinical Note</label>
      <textarea
        id="note"
        rows={8}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Paste current clinical note"
      />

      <label htmlFor="audioContext">Audio Summary (Optional)</label>
      <textarea
        id="audioContext"
        rows={4}
        value={audioContext}
        onChange={(event) => setAudioContext(event.target.value)}
        placeholder="For MVP: summarize audio highlights manually"
      />

      <button type="submit">Analyze Encounter</button>
    </form>
  );
}
