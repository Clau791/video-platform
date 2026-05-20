# Video TTS Studio

Frontend React + Vite pentru upload video, selectie voce TTS, recomandare lungime text si randare video async. Pentru lansarea simpla, acelasi server Node serveste si API-ul, si frontend-ul build-uit din `dist`.

## Rulare locala

```bash
npm install
npm run dev
```

Login-ul mock accepta orice nume si parola necompletate corect. Token-ul este salvat in `localStorage` fara expirare impusa de frontend.

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

Clientul real trimite cererile catre acelasi origin ca pagina servita de Node:

```ts
export const API_BASE_URL = "";
```

## Contract API asteptat

- `POST /auth/login`
- `GET /voices`
- `POST /voices/:voiceId/preview`
- `POST /renders`
- `GET /renders/:jobId`

Randarea trimite `multipart/form-data` cu `video`, `text`, `voiceId` si `speedScale`.

## Server VPS intr-un singur fisier

Serverul este in `server.mjs` si expune acelasi contract folosit de frontend. Ruleaza cu Node.js si apeleaza Gemini TTS prin `@google/genai`, converteste PCM-ul TTS in WAV cu `ffmpeg`, apoi lipeste audio-ul in video tot cu `ffmpeg`.

Implicit, serverul este configurat pentru cheia din Google AI Studio:

- backend SDK: Gemini Developer API
- endpoint SDK: `https://generativelanguage.googleapis.com`
- API version: `v1beta`
- model default: `gemini-3.1-flash-tts-preview`

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
CORS_ORIGIN=*
ADMIN_USERNAME=admin
ADMIN_PASSWORD=schimba-parola
TOKEN_SECRET=un-secret-lung
GENAI_BACKEND=gemini
GEMINI_API_KEY=cheia-ta-google-ai-studio
GEMINI_TTS_MODEL=gemini-3.1-flash-tts-preview
```

Pornire:

```bash
npm run build
npm run server
```

Aplicatia completa va fi disponibila la `http://152.67.155.30:8080`.

Endpoint-uri server:

- `GET /health`
- `POST /auth/login`
- `GET /voices`
- `POST /voices/:voiceId/preview`
- `POST /renders`
- `GET /renders/:jobId`

Pentru GitHub Pages, VPS-ul trebuie expus prin HTTPS in productie; altfel browserul poate bloca request-urile din cauza mixed content.

Pentru Agent Platform / Vertex AI, seteaza `GENAI_BACKEND=enterprise` si foloseste ADC / service account. Pentru lansarea simpla cu API key din AI Studio, pastreaza `GENAI_BACKEND=gemini`.
