import "dotenv/config";
import cors from "cors";
import crypto from "node:crypto";
import express from "express";
import fs from "node:fs/promises";
import multer from "multer";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const ADMIN_USERNAME =
  process.env.ADMIN_USERNAME || process.env.ADMIN_EMAIL || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me";
const TOKEN_SECRET = process.env.TOKEN_SECRET || "change-this-token-secret";
const GENAI_BACKEND = (
  process.env.GENAI_BACKEND ||
  process.env.GOOGLE_GENAI_USE_ENTERPRISE ||
  "gemini"
).toLowerCase();
const USE_ENTERPRISE = ["1", "true", "enterprise", "vertex", "vertexai"].includes(
  GENAI_BACKEND,
);
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "";
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "global";
const GEMINI_TTS_MODEL =
  process.env.GEMINI_TTS_MODEL ||
  (USE_ENTERPRISE ? "gemini-2.5-flash-tts" : "gemini-3.1-flash-tts-preview");
const TTS_PCM_FORMAT = process.env.TTS_PCM_FORMAT || "s16le";
const TTS_SAMPLE_RATE = process.env.TTS_SAMPLE_RATE
  ? Number(process.env.TTS_SAMPLE_RATE)
  : null;
const MAX_VIDEO_SIZE_BYTES =
  Number(process.env.MAX_VIDEO_SIZE_MB || 500) * 1024 * 1024;
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "server-data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const OUTPUT_DIR = path.join(DATA_DIR, "outputs");
const PREVIEW_DIR = path.join(DATA_DIR, "previews");
const TMP_DIR = path.join(DATA_DIR, "tmp");
const DIST_DIR = path.join(__dirname, "dist");
const INDEX_HTML_PATH = path.join(DIST_DIR, "index.html");

const app = express();
const jobs = new Map();
const ai = createGoogleGenAIClient();

const voices = [
  {
    id: "Kore",
    name: "Kore",
    language: "Multilingual",
    gender: "Feminin",
    style: "clar, profesional",
    sampleText:
      "Buna, sunt vocea Kore si voi citi natural textul tau in limba romana.",
  },
  {
    id: "Puck",
    name: "Puck",
    language: "Multilingual",
    gender: "Masculin",
    style: "energic, conversațional",
    sampleText:
      "Buna, sunt vocea Puck si pot livra un mesaj romanesc energic si clar.",
  },
  {
    id: "Charon",
    name: "Charon",
    language: "Multilingual",
    gender: "Masculin",
    style: "profund, narativ",
    sampleText:
      "Buna, sunt vocea Charon si pot narra calm povestea videoclipului tau.",
  },
  {
    id: "Aoede",
    name: "Aoede",
    language: "Multilingual",
    gender: "Feminin",
    style: "cald, expresiv",
    sampleText:
      "Buna, sunt vocea Aoede si pot spune textul tau cu ton cald si expresiv.",
  },
  {
    id: "Fenrir",
    name: "Fenrir",
    language: "Multilingual",
    gender: "Masculin",
    style: "ferm, studio",
    sampleText:
      "Buna, sunt vocea Fenrir si pot prezenta mesajul intr-un stil ferm de studio.",
  },
  {
    id: "Leda",
    name: "Leda",
    language: "Multilingual",
    gender: "Feminin",
    style: "natural, curat",
    sampleText:
      "Buna, sunt vocea Leda si pot rosti propozitii romanesti natural si curat.",
  },
];

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: MAX_VIDEO_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith("video/")) {
      callback(new Error("Fisierul incarcat trebuie sa fie video."));
      return;
    }
    callback(null, true);
  },
});

function createGoogleGenAIClient() {
  if (USE_ENTERPRISE) {
    if (GOOGLE_API_KEY) {
      return new GoogleGenAI({
        enterprise: true,
        apiKey: GOOGLE_API_KEY,
        apiVersion: "v1beta1",
      });
    }

    if (GOOGLE_CLOUD_PROJECT && GOOGLE_CLOUD_LOCATION) {
      return new GoogleGenAI({
        enterprise: true,
        project: GOOGLE_CLOUD_PROJECT,
        location: GOOGLE_CLOUD_LOCATION,
        apiVersion: "v1beta1",
      });
    }

    return null;
  }

  if (!GOOGLE_API_KEY) {
    return null;
  }

  return new GoogleGenAI({
    apiKey: GOOGLE_API_KEY,
    apiVersion: "v1beta",
  });
}

app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(","),
    credentials: true,
  }),
);
app.use("/files", express.static(DATA_DIR));

function safeBase64Url(input) {
  return Buffer.from(input)
    .toString("base64url")
    .replaceAll("=", "");
}

function sign(value) {
  return crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(value)
    .digest("base64url");
}

function createToken(username) {
  const header = safeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = safeBase64Url(JSON.stringify({ username, iat: Date.now() }));
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${sign(unsigned)}`;
}

function verifyToken(token) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const unsigned = `${parts[0]}.${parts[1]}`;
  const expected = sign(unsigned);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(parts[2]);

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = token ? verifyToken(token) : null;

  if (!payload?.username) {
    res.status(401).json({ error: "Token invalid sau lipsa." });
    return;
  }

  req.user = payload;
  next();
}

function getVoice(voiceId) {
  return voices.find((voice) => voice.id === voiceId) || voices[0];
}

function jobUrl(folder, filename) {
  return `${PUBLIC_BASE_URL}/files/${folder}/${encodeURIComponent(filename)}`;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `${command} exited with code ${code}`));
    });
  });
}

function parseSampleRate(mimeType = "") {
  const match = mimeType.match(/rate=(\d+)/i);
  return match ? Number(match[1]) : 24000;
}

function buildTtsPrompt(text) {
  return `Rosteste in limba romana, clar si natural, exact textul dintre ghilimele. Nu adauga alte cuvinte. Text: "${text}"`;
}

async function writePcmAsWav(pcm, outputPath, sampleRate) {
  const rawPath = path.join(TMP_DIR, `${crypto.randomUUID()}.pcm`);

  await fs.writeFile(rawPath, pcm);

  try {
    await runCommand("ffmpeg", [
      "-y",
      "-f",
      TTS_PCM_FORMAT,
      "-ar",
      String(sampleRate),
      "-ac",
      "1",
      "-i",
      rawPath,
      outputPath,
    ]);
  } finally {
    await fs.rm(rawPath, { force: true });
  }
}

function detectAudioContainer(buffer) {
  const signature = buffer.subarray(0, 12).toString("ascii");

  if (signature.startsWith("RIFF") && signature.includes("WAVE")) {
    return "wav";
  }

  if (signature.startsWith("ID3") || buffer[0] === 0xff) {
    return "mp3";
  }

  if (signature.startsWith("OggS")) {
    return "ogg";
  }

  return "";
}

async function writeGeminiTtsWav({ text, voiceId, outputPath }) {
  if (!ai) {
    throw new Error(
      USE_ENTERPRISE
        ? "Lipseste GOOGLE_API_KEY sau configuratia ADC GOOGLE_CLOUD_PROJECT/GOOGLE_CLOUD_LOCATION."
        : "Lipseste GOOGLE_API_KEY sau GEMINI_API_KEY pe server.",
    );
  }

  const voice = getVoice(voiceId);
  const response = await ai.models.generateContent({
    model: GEMINI_TTS_MODEL,
    contents: [{ parts: [{ text: buildTtsPrompt(text) }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice.id,
          },
        },
      },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.find(
    (item) => item.inlineData || item.inline_data,
  );
  const inlineData = part?.inlineData || part?.inline_data;

  if (!inlineData?.data) {
    throw new Error("Gemini nu a returnat audio pentru textul trimis.");
  }

  const pcm =
    typeof inlineData.data === "string"
      ? Buffer.from(inlineData.data, "base64")
      : Buffer.from(inlineData.data);
  const mimeType = inlineData.mimeType || inlineData.mime_type || "";
  const detectedContainer = detectAudioContainer(pcm);
  const sampleRate = TTS_SAMPLE_RATE || parseSampleRate(mimeType);

  console.log(
    `Gemini TTS audio: voice=${voice.id} mime="${mimeType || "unknown"}" ` +
      `bytes=${pcm.length} container=${detectedContainer || "pcm"} ` +
      `pcmFormat=${TTS_PCM_FORMAT} sampleRate=${sampleRate}`,
  );

  if (
    mimeType.includes("wav") ||
    mimeType.includes("wave") ||
    detectedContainer === "wav"
  ) {
    await fs.writeFile(outputPath, pcm);
    return;
  }

  if (detectedContainer === "mp3" || detectedContainer === "ogg") {
    const inputPath = path.join(TMP_DIR, `${crypto.randomUUID()}.${detectedContainer}`);
    await fs.writeFile(inputPath, pcm);

    try {
      await runCommand("ffmpeg", ["-y", "-i", inputPath, outputPath]);
    } finally {
      await fs.rm(inputPath, { force: true });
    }

    return;
  }

  await writePcmAsWav(pcm, outputPath, sampleRate);
}

async function adjustAudioSpeed(inputPath, outputPath, speedScale) {
  const scale = Number(speedScale);

  if (!Number.isFinite(scale) || scale <= 1.01) {
    await fs.copyFile(inputPath, outputPath);
    return;
  }

  const safeScale = Math.min(1.6, Math.max(0.5, scale));
  await runCommand("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-filter:a",
    `atempo=${safeScale}`,
    outputPath,
  ]);
}

async function muxAudioIntoVideo(videoPath, audioPath, outputPath) {
  const args = [
    "-y",
    "-i",
    videoPath,
    "-i",
    audioPath,
    "-filter_complex",
    "[1:a]apad[a]",
    "-map",
    "0:v:0",
    "-map",
    "[a]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-shortest",
    outputPath,
  ];

  try {
    await runCommand("ffmpeg", args);
  } catch {
    await runCommand("ffmpeg", [
      "-y",
      "-i",
      videoPath,
      "-i",
      audioPath,
      "-filter_complex",
      "[1:a]apad[a]",
      "-map",
      "0:v:0",
      "-map",
      "[a]",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-c:a",
      "aac",
      "-shortest",
      outputPath,
    ]);
  }
}

async function processRender(jobId) {
  const job = jobs.get(jobId);
  if (!job) {
    return;
  }

  try {
    job.status = "processing";
    job.progress = 20;

    const rawAudioPath = path.join(TMP_DIR, `${jobId}-raw.wav`);
    const finalAudioPath = path.join(TMP_DIR, `${jobId}-speed.wav`);
    const outputPath = path.join(OUTPUT_DIR, `${jobId}.mp4`);

    await writeGeminiTtsWav({
      text: job.text,
      voiceId: job.voiceId,
      outputPath: rawAudioPath,
    });
    job.progress = 60;

    await adjustAudioSpeed(rawAudioPath, finalAudioPath, job.speedScale);
    job.progress = 75;

    await muxAudioIntoVideo(job.videoPath, finalAudioPath, outputPath);
    job.progress = 100;
    job.status = "done";
    job.resultUrl = jobUrl("outputs", `${jobId}.mp4`);

    await Promise.allSettled([
      fs.rm(rawAudioPath, { force: true }),
      fs.rm(finalAudioPath, { force: true }),
      fs.rm(job.videoPath, { force: true }),
    ]);
  } catch (error) {
    job.status = "failed";
    job.progress = 100;
    job.error = error instanceof Error ? error.message : "Randarea a esuat.";
  }
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    genaiBackend: USE_ENTERPRISE ? "enterprise" : "gemini",
    genaiReady: Boolean(ai),
    model: GEMINI_TTS_MODEL,
    location: USE_ENTERPRISE ? GOOGLE_CLOUD_LOCATION : undefined,
    ffmpeg: "required",
  });
});

app.post("/auth/login", (req, res) => {
  const { username, email, password } = req.body || {};
  const loginName = typeof username === "string" ? username : email;

  if (loginName !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Nume sau parola incorecta." });
    return;
  }

  res.json({
    token: createToken(loginName),
    user: { username: loginName },
  });
});

app.get("/voices", requireAuth, (_req, res) => {
  res.json({
    voices: voices.map((voice) => ({
      ...voice,
      previewUrl: undefined,
    })),
  });
});

app.post("/voices/:voiceId/preview", requireAuth, async (req, res) => {
  try {
    const text =
      typeof req.body?.text === "string" && req.body.text.trim()
        ? req.body.text.trim()
        : getVoice(req.params.voiceId).sampleText;
    const voice = getVoice(req.params.voiceId);
    const filename = `${crypto.randomUUID()}-${voice.id}.wav`;
    const outputPath = path.join(PREVIEW_DIR, filename);

    await writeGeminiTtsWav({ text, voiceId: voice.id, outputPath });

    res.json({ audioUrl: jobUrl("previews", filename) });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Preview-ul a esuat.",
    });
  }
});

app.post("/renders", requireAuth, upload.single("video"), async (req, res) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const voiceId = typeof req.body?.voiceId === "string" ? req.body.voiceId : "";
    const speedScale = Number(req.body?.speedScale || 1);

    if (!req.file) {
      res.status(400).json({ error: "Lipseste fisierul video." });
      return;
    }

    if (!text) {
      await fs.rm(req.file.path, { force: true });
      res.status(400).json({ error: "Textul audio este obligatoriu." });
      return;
    }

    if (!voices.some((voice) => voice.id === voiceId)) {
      await fs.rm(req.file.path, { force: true });
      res.status(400).json({ error: "Vocea selectata nu exista." });
      return;
    }

    const jobId = crypto.randomUUID();
    jobs.set(jobId, {
      jobId,
      status: "queued",
      progress: 0,
      createdAt: Date.now(),
      videoPath: req.file.path,
      text,
      voiceId,
      speedScale,
    });

    res.status(202).json({ jobId });
    void processRender(jobId);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Randarea nu a pornit.",
    });
  }
});

app.get("/renders/:jobId", requireAuth, (req, res) => {
  const job = jobs.get(req.params.jobId);

  if (!job) {
    res.status(404).json({ error: "Jobul nu exista." });
    return;
  }

  res.json({
    status: job.status,
    progress: job.progress,
    error: job.error,
    resultUrl: job.resultUrl,
  });
});

app.use(express.static(DIST_DIR));

app.get("/{*splat}", async (_req, res, next) => {
  try {
    await fs.access(INDEX_HTML_PATH);
    res.sendFile(INDEX_HTML_PATH);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(500).json({
    error: error instanceof Error ? error.message : "Eroare server.",
  });
});

await Promise.all([
  fs.mkdir(UPLOAD_DIR, { recursive: true }),
  fs.mkdir(OUTPUT_DIR, { recursive: true }),
  fs.mkdir(PREVIEW_DIR, { recursive: true }),
  fs.mkdir(TMP_DIR, { recursive: true }),
]);

app.listen(PORT, () => {
  console.log(`Video TTS server listening on ${PUBLIC_BASE_URL}`);
});
