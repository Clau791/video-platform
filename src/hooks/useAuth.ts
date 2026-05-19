import { useCallback, useEffect, useState } from "react";
import { apiClient, type User } from "../api/client";

const TOKEN_STORAGE_KEY = "video-tts-token";
const USER_STORAGE_KEY = "video-tts-user";

type AuthState = {
  token: string;
  user: User | null;
};

const readInitialState = (): AuthState => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY) || "";
  const userJson = localStorage.getItem(USER_STORAGE_KEY);

  if (!token || !userJson) {
    return { token: "", user: null };
  }

  try {
    return { token, user: JSON.parse(userJson) as User };
  } catch {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    return { token: "", user: null };
  }
};

export const useAuth = () => {
  const [state, setState] = useState<AuthState>(readInitialState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (state.token && state.user) {
      localStorage.setItem(TOKEN_STORAGE_KEY, state.token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(state.user));
    }
  }, [state]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await apiClient.login(email, password);
      setState({ token: response.token, user: response.user });
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Autentificarea a esuat.";
      setError(message);
      throw caughtError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setState({ token: "", user: null });
  }, []);

  return {
    token: state.token,
    user: state.user,
    isAuthenticated: Boolean(state.token && state.user),
    isLoading,
    error,
    login,
    logout,
  };
};
