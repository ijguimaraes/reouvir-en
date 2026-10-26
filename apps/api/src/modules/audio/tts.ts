import { AppError } from "../../errors";
import type { TtsIdentity } from "./audio-key";

export interface TtsProvider {
  synthesize(text: string): Promise<Buffer>;
}

export class ElevenLabsTts implements TtsProvider {
  constructor(private apiKey: string | undefined, private identity: TtsIdentity) {}

  async synthesize(text: string): Promise<Buffer> {
    if (!this.apiKey) throw new AppError(503, "ELEVENLABS_API_KEY não configurada", "tts_unconfigured");
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(this.identity.voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": this.apiKey, "content-type": "application/json", accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: this.identity.modelId, voice_settings: this.identity.settings }),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      throw new Error(`ElevenLabs respondeu ${res.status}: ${detail}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
}
