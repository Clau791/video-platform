import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Download,
  FileVideo,
  Loader2,
  LogOut,
  Play,
  Radio,
  RefreshCw,
  Send,
  SlidersHorizontal,
  Volume2,
  Wand2,
} from "lucide-react";
import { apiClient, type RenderJobStatus, type Voice } from "../api/client";
import {
  MAX_SPEED_SCALE,
  MAX_VIDEO_SIZE_BYTES,
  TEXT_CHARS_PER_SECOND,
} from "../config";

type DashboardProps = {
  token: string;
  userEmail: string;
  onLogout: () => void;
};

const defaultPreviewText = "Salut! Acesta este un preview audio pentru vocea selectata.";

const formatSeconds = (seconds: number | null) => {
  if (!seconds || Number.isNaN(seconds)) {
    return "N/A";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${remainingSeconds}`;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function Dashboard({ token, userEmail, onLogout }: DashboardProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voicesError, setVoicesError] = useState("");
  const [isLoadingVoices, setIsLoadingVoices] = useState(true);
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [previewingVoiceId, setPreviewingVoiceId] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [formError, setFormError] = useState("");
  const [jobId, setJobId] = useState("");
  const [jobStatus, setJobStatus] = useState<RenderJobStatus | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlsRef = useRef<string[]>([]);

  const loadVoices = useCallback(async () => {
    setIsLoadingVoices(true);
    setVoicesError("");

    try {
      const nextVoices = await apiClient.getVoices(token);
      setVoices(nextVoices);
      setSelectedVoiceId((current) => current || nextVoices[0]?.id || "");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Nu am putut incarca vocile.";
      setVoicesError(message);
    } finally {
      setIsLoadingVoices(false);
    }
  }, [token]);

  useEffect(() => {
    void loadVoices();
  }, [loadVoices]);

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  useEffect(() => {
    const previewUrls = previewUrlsRef.current;

    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (!jobId || jobStatus?.status === "done" || jobStatus?.status === "failed") {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const status = await apiClient.getRenderStatus(token, jobId);
        setJobStatus(status);
      } catch (caughtError) {
        setJobStatus({
          status: "failed",
          progress: 100,
          error:
            caughtError instanceof Error
              ? caughtError.message
              : "Statusul randarii nu a putut fi citit.",
        });
      }
    }, 900);

    return () => window.clearInterval(intervalId);
  }, [jobId, jobStatus?.status, token]);

  const selectedVoice = voices.find((voice) => voice.id === selectedVoiceId);

  const recommendation = useMemo(() => {
    const trimmedTextLength = text.trim().length;
    const recommendedChars = durationSeconds
      ? Math.max(1, Math.round(durationSeconds * TEXT_CHARS_PER_SECOND))
      : 0;
    const ratio = recommendedChars ? trimmedTextLength / recommendedChars : 0;
    const speedScale =
      recommendedChars && ratio > 1
        ? Math.min(MAX_SPEED_SCALE, Number(ratio.toFixed(2)))
        : 1;

    return {
      trimmedTextLength,
      recommendedChars,
      ratio,
      speedScale,
      isOverLimit: Boolean(recommendedChars && trimmedTextLength > recommendedChars),
      isCapped: Boolean(recommendedChars && ratio > MAX_SPEED_SCALE),
    };
  }, [durationSeconds, text]);

  const handleVideoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setFormError("");
    setDurationSeconds(null);
    setJobId("");
    setJobStatus(null);

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl("");
    }

    if (!file) {
      setVideoFile(null);
      return;
    }

    if (!file.type.startsWith("video/")) {
      setVideoFile(null);
      setFormError("Incarca un fisier video valid.");
      return;
    }

    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      setVideoFile(null);
      setFormError("Fisierul depaseste limita de 500 MB.");
      return;
    }

    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
  };

  const handlePreviewVoice = async (voiceId: string) => {
    setPreviewingVoiceId(voiceId);
    setFormError("");

    try {
      audioRef.current?.pause();
      const audioUrl = await apiClient.previewVoice(
        token,
        voiceId,
        text.trim() || defaultPreviewText,
      );
      previewUrlsRef.current.push(audioUrl);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.addEventListener("ended", () => setPreviewingVoiceId(""));
      audio.addEventListener("error", () => setPreviewingVoiceId(""));
      await audio.play();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Preview-ul audio nu a putut fi redat.";
      setFormError(message);
      setPreviewingVoiceId("");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    if (!videoFile) {
      setFormError("Incarca un video inainte de randare.");
      return;
    }

    if (!text.trim()) {
      setFormError("Adauga textul pentru audio.");
      return;
    }

    if (!selectedVoiceId) {
      setFormError("Alege o voce.");
      return;
    }

    setIsSubmitting(true);
    setJobId("");
    setJobStatus(null);

    try {
      const response = await apiClient.createRender(token, {
        video: videoFile,
        text: text.trim(),
        voiceId: selectedVoiceId,
        speedScale: recommendation.speedScale,
      });
      setJobId(response.jobId);
      setJobStatus({ status: "queued", progress: 0 });
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Randarea nu a putut fi pornita.";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = jobStatus?.progress || 0;
  const canSubmit = Boolean(videoFile && text.trim() && selectedVoiceId && !isSubmitting);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Video TTS Studio</p>
          <h1>Workspace</h1>
        </div>
        <div className="topbar-actions">
          <span className="session-email">{userEmail}</span>
          <button className="icon-button" type="button" onClick={onLogout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <form className="workspace-grid" onSubmit={handleSubmit}>
        <section className="panel compose-panel" aria-labelledby="compose-title">
          <div className="panel-title">
            <Wand2 size={20} />
            <h2 id="compose-title">Randare video</h2>
          </div>

          <label className="drop-zone">
            <input accept="video/*" type="file" onChange={handleVideoChange} />
            <FileVideo size={28} />
            <span>{videoFile ? videoFile.name : "Alege video"}</span>
            <small>
              {videoFile
                ? `${formatFileSize(videoFile.size)} · ${formatSeconds(durationSeconds)}`
                : "MP4, MOV sau WebM · maxim 500 MB"}
            </small>
          </label>

          {videoUrl && (
            <video
              className="video-preview"
              controls
              src={videoUrl}
              onLoadedMetadata={(event) =>
                setDurationSeconds(event.currentTarget.duration)
              }
            />
          )}

          <label className="text-field">
            Text audio
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Scrie replica sau naratiunea care trebuie generata prin TTS."
              rows={8}
            />
          </label>

          <div className="recommendation-band">
            <div>
              <p className="metric-label">Text</p>
              <strong>{recommendation.trimmedTextLength}</strong>
            </div>
            <div>
              <p className="metric-label">Recomandat</p>
              <strong>
                {recommendation.recommendedChars
                  ? recommendation.recommendedChars
                  : "Astept video"}
              </strong>
            </div>
            <div>
              <p className="metric-label">Speed scale</p>
              <strong>{recommendation.speedScale.toFixed(2)}x</strong>
            </div>
          </div>

          {recommendation.isOverLimit && (
            <p className="warning-text">
              Textul depaseste recomandarea pentru durata video. Se va trimite
              speedScale {recommendation.speedScale.toFixed(2)}x
              {recommendation.isCapped ? ", limitat la maximul configurat." : "."}
            </p>
          )}

          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}

          <button className="primary-button" type="submit" disabled={!canSubmit}>
            {isSubmitting ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
            {isSubmitting ? "Porneste..." : "Genereaza video"}
          </button>
        </section>

        <aside className="side-stack">
          <section className="panel" aria-labelledby="voices-title">
            <div className="panel-title panel-title-row">
              <div>
                <Radio size={20} />
                <h2 id="voices-title">Voci</h2>
              </div>
              <button
                className="ghost-button compact"
                type="button"
                onClick={() => void loadVoices()}
                disabled={isLoadingVoices}
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>

            {voicesError && (
              <p className="form-error" role="alert">
                {voicesError}
              </p>
            )}

            <div className="voice-list">
              {isLoadingVoices ? (
                <p className="muted">Se incarca vocile...</p>
              ) : (
                voices.map((voice) => (
                  <label
                    className={`voice-card ${
                      selectedVoiceId === voice.id ? "selected" : ""
                    }`}
                    key={voice.id}
                  >
                    <input
                      checked={selectedVoiceId === voice.id}
                      name="voice"
                      type="radio"
                      value={voice.id}
                      onChange={() => setSelectedVoiceId(voice.id)}
                    />
                    <span className="voice-card-main">
                      <strong>{voice.name}</strong>
                      <small>
                        {voice.language}
                        {voice.gender ? ` · ${voice.gender}` : ""}
                        {voice.style ? ` · ${voice.style}` : ""}
                      </small>
                    </span>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => void handlePreviewVoice(voice.id)}
                      title={`Preview ${voice.name}`}
                    >
                      {previewingVoiceId === voice.id ? (
                        <Loader2 className="spin" size={17} />
                      ) : (
                        <Volume2 size={17} />
                      )}
                    </button>
                  </label>
                ))
              )}
            </div>
          </section>

          <section className="panel" aria-labelledby="status-title">
            <div className="panel-title">
              <SlidersHorizontal size={20} />
              <h2 id="status-title">Status</h2>
            </div>

            <div className="status-box">
              <div className="status-row">
                <span>{jobStatus ? jobStatus.status : "inactiv"}</span>
                <strong>{progress}%</strong>
              </div>
              <div className="progress-track" aria-hidden="true">
                <span style={{ width: `${progress}%` }} />
              </div>
              {selectedVoice && (
                <p className="muted">Voce selectata: {selectedVoice.name}</p>
              )}
              {jobStatus?.error && <p className="form-error">{jobStatus.error}</p>}
            </div>

            {jobStatus?.resultUrl && (
              <div className="result-actions">
                <video className="video-preview result-video" controls src={jobStatus.resultUrl} />
                <a className="ghost-button" href={jobStatus.resultUrl} download>
                  <Download size={17} />
                  Descarca
                </a>
                <a className="ghost-button" href={jobStatus.resultUrl} target="_blank">
                  <Play size={17} />
                  Deschide
                </a>
              </div>
            )}
          </section>
        </aside>
      </form>
    </main>
  );
}
