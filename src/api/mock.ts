import type {
  ApiClient,
  LoginResponse,
  RenderJob,
  RenderJobStatus,
  RenderPayload,
  Voice,
} from "./types";

type MockJob = {
  createdAt: number;
  resultUrl: string;
};

const jobs = new Map<string, MockJob>();

const voices: Voice[] = [
  {
    id: "gemini-aurora-ro",
    name: "Aurora",
    language: "Romana",
    gender: "Feminin",
    style: "calm, clar",
  },
  {
    id: "gemini-darius-ro",
    name: "Darius",
    language: "Romana",
    gender: "Masculin",
    style: "narativ, cald",
  },
  {
    id: "gemini-mira-ro",
    name: "Mira",
    language: "Romana",
    gender: "Feminin",
    style: "energic, comercial",
  },
  {
    id: "gemini-ioan-ro",
    name: "Ioan",
    language: "Romana",
    gender: "Masculin",
    style: "documentar, profund",
  },
  {
    id: "gemini-sage-en",
    name: "Sage",
    language: "Engleza",
    gender: "Neutru",
    style: "premium, studio",
  },
];

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const assertToken = (token: string) => {
  if (!token) {
    throw new Error("Sesiunea a expirat. Autentifica-te din nou.");
  }
};

const createTonePreviewUrl = (voiceId: string) => {
  const sampleRate = 22050;
  const durationSeconds = 1.15;
  const totalSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);
  const voiceIndex = Math.max(0, voices.findIndex((voice) => voice.id === voiceId));
  const frequency = 360 + voiceIndex * 80;

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, totalSamples * 2, true);

  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / sampleRate;
    const envelope = Math.min(1, i / 1200, (totalSamples - i) / 1800);
    const sample = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.32;
    view.setInt16(44 + i * 2, sample * 32767, true);
  }

  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
};

export const mockApiClient: ApiClient = {
  async login(email: string, password: string): Promise<LoginResponse> {
    await wait(450);

    if (!email.trim() || !password.trim()) {
      throw new Error("Completeaza emailul si parola.");
    }

    return {
      token: `mock-token-${crypto.randomUUID()}`,
      user: { email: email.trim() },
    };
  },

  async getVoices(token: string): Promise<Voice[]> {
    assertToken(token);
    await wait(350);
    return voices;
  },

  async previewVoice(token: string, voiceId: string): Promise<string> {
    assertToken(token);
    await wait(250);
    return createTonePreviewUrl(voiceId);
  },

  async createRender(token: string, payload: RenderPayload): Promise<RenderJob> {
    assertToken(token);
    await wait(700);

    const jobId = crypto.randomUUID();
    jobs.set(jobId, {
      createdAt: Date.now(),
      resultUrl: URL.createObjectURL(payload.video),
    });

    return { jobId };
  },

  async getRenderStatus(token: string, jobId: string): Promise<RenderJobStatus> {
    assertToken(token);
    await wait(250);

    const job = jobs.get(jobId);
    if (!job) {
      return {
        status: "failed",
        progress: 100,
        error: "Jobul nu a fost gasit in mock API.",
      };
    }

    const elapsed = Date.now() - job.createdAt;
    const progress = Math.min(100, Math.round((elapsed / 6500) * 100));

    if (progress >= 100) {
      return {
        status: "done",
        progress: 100,
        resultUrl: job.resultUrl,
      };
    }

    return {
      status: elapsed < 900 ? "queued" : "processing",
      progress,
    };
  },
};
