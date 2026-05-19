import { API_BASE_URL } from "../config";
import type {
  ApiClient,
  LoginResponse,
  RenderJob,
  RenderJobStatus,
  RenderPayload,
  Voice,
} from "./types";

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    const fallback = `Cererea a esuat cu status ${response.status}.`;
    let message = fallback;

    try {
      const body = (await response.json()) as { error?: string; message?: string };
      message = body.error || body.message || fallback;
    } catch {
      message = fallback;
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
};

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

export const realApiClient: ApiClient = {
  login(username: string, password: string): Promise<LoginResponse> {
    return request<LoginResponse>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  },

  async getVoices(token: string): Promise<Voice[]> {
    const response = await request<{ voices: Voice[] }>("/voices", {
      headers: authHeaders(token),
    });
    return response.voices;
  },

  async previewVoice(token: string, voiceId: string, text: string): Promise<string> {
    const response = await request<{ audioUrl: string }>(
      `/voices/${encodeURIComponent(voiceId)}/preview`,
      {
        method: "POST",
        headers: {
          ...authHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      },
    );
    return response.audioUrl;
  },

  createRender(token: string, payload: RenderPayload): Promise<RenderJob> {
    const formData = new FormData();
    formData.append("video", payload.video);
    formData.append("text", payload.text);
    formData.append("voiceId", payload.voiceId);
    formData.append("speedScale", String(payload.speedScale));

    return request<RenderJob>("/renders", {
      method: "POST",
      headers: authHeaders(token),
      body: formData,
    });
  },

  getRenderStatus(token: string, jobId: string): Promise<RenderJobStatus> {
    return request<RenderJobStatus>(`/renders/${encodeURIComponent(jobId)}`, {
      headers: authHeaders(token),
    });
  },
};
