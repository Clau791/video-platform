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
export const API_BASE_URL = "http://152.67.155.30";
```

## Contract API asteptat

- `POST /auth/login`
- `GET /voices`
- `POST /voices/:voiceId/preview`
- `POST /renders`
- `GET /renders/:jobId`

Randarea trimite `multipart/form-data` cu `video`, `text`, `voiceId` si `speedScale`.
