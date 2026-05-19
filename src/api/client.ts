import { API_MODE } from "../config";
import { mockApiClient } from "./mock";
import { realApiClient } from "./real";
import type { ApiClient } from "./types";

export const apiClient: ApiClient =
  API_MODE === "mock" ? mockApiClient : realApiClient;

export type {
  ApiClient,
  LoginResponse,
  RenderJob,
  RenderJobStatus,
  RenderPayload,
  RenderStatus,
  User,
  Voice,
} from "./types";
