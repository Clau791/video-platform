export type ApiMode = "mock" | "real";

export type User = {
  username: string;
};

export type LoginResponse = {
  token: string;
  user: User;
};

export type Voice = {
  id: string;
  name: string;
  language: string;
  gender?: string;
  style?: string;
  sampleText?: string;
  previewUrl?: string;
};

export type RenderStatus = "queued" | "processing" | "done" | "failed";

export type RenderJob = {
  jobId: string;
};

export type RenderJobStatus = {
  status: RenderStatus;
  progress: number;
  error?: string;
  resultUrl?: string;
};

export type RenderPayload = {
  video: File;
  text: string;
  voiceId: string;
  speedScale: number;
};

export type ApiClient = {
  login(username: string, password: string): Promise<LoginResponse>;
  getVoices(token: string): Promise<Voice[]>;
  previewVoice(token: string, voiceId: string, text: string): Promise<string>;
  createRender(token: string, payload: RenderPayload): Promise<RenderJob>;
  getRenderStatus(token: string, jobId: string): Promise<RenderJobStatus>;
};
