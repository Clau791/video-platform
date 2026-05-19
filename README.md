# Video TTS Studio

Frontend React + Vite pentru upload video, selectie voce TTS, recomandare lungime text si randare video async. Aplicatia porneste pe mock API si are client pregatit pentru VPS-ul `http://152.67.155.30`.

## Rulare locala

```bash
npm install
npm run dev
```

Login-ul mock accepta orice email si parola necompletate corect. Token-ul este salvat in `localStorage` fara expirare impusa de frontend.

## Build

```bash
npm run build
npm run preview
```

## Deploy pe GitHub Pages

Workflow-ul din `.github/workflows/deploy.yml` construieste proiectul la fiecare push pe branch-ul `main` si publica folderul `dist` pe GitHub Pages.

In repository-ul GitHub:

1. Deschide `Settings > Pages`.
2. La `Build and deployment`, selecteaza `GitHub Actions`.
3. Fa push pe `main`.

Vite foloseste automat `base: /video-platform/` in GitHub Actions, potrivit pentru repository-ul `video-platform`.

## Schimbare de la mock la API real

In `src/config.ts`, schimba:

```ts
export const API_MODE = "mock" as const;
```

in:

```ts
export const API_MODE = "real" as const;
```

Clientul real trimite cererile catre:

```ts
export const API_BASE_URL = "http://152.67.155.30:8080";
```

## Contract API asteptat

- `POST /auth/login`
- `GET /voices`
- `POST /voices/:voiceId/preview`
- `POST /renders`
- `GET /renders/:jobId`

Randarea trimite `multipart/form-data` cu `video`, `text`, `voiceId` si `speedScale`.

## Server VPS intr-un singur fisier

Serverul este in `server.mjs` si expune acelasi contract folosit de frontend. Ruleaza cu Node.js si apeleaza Gemini TTS prin `@google/genai`, apoi lipeste audio-ul in video cu `ffmpeg`.

Implicit, serverul este configurat pentru cheia din Google Cloud Console / Agent Platform:

- backend SDK: Gemini Enterprise Agent Platform / Vertex AI
- endpoint SDK: `https://aiplatform.googleapis.com`
- API version: `v1beta1`
- model default: `gemini-2.5-flash-tts`

Instalare pe VPS:

```bash
npm install
sudo apt-get update
sudo apt-get install -y ffmpeg
```

Variabile recomandate:

```bash
PORT=8080
PUBLIC_BASE_URL=http://152.67.155.30:8080
CORS_ORIGIN=https://clau791.github.io
ADMIN_EMAIL=admin@video.local
ADMIN_PASSWORD=schimba-parola
TOKEN_SECRET=un-secret-lung
GENAI_BACKEND=enterprise
GOOGLE_API_KEY=cheia-ta-agent-platform
GOOGLE_CLOUD_LOCATION=global
GEMINI_TTS_MODEL=gemini-2.5-flash-tts
```

Pornire:

```bash
npm run server
```

Endpoint-uri server:

- `GET /health`
- `POST /auth/login`
- `GET /voices`
- `POST /voices/:voiceId/preview`
- `POST /renders`
- `GET /renders/:jobId`

Pentru GitHub Pages, VPS-ul trebuie expus prin HTTPS in productie; altfel browserul poate bloca request-urile din cauza mixed content.

Pentru o cheie veche din Google AI Studio, seteaza `GENAI_BACKEND=gemini` si foloseste `GEMINI_API_KEY` sau `GOOGLE_API_KEY`; acel mod foloseste endpoint-ul `https://generativelanguage.googleapis.com`.
