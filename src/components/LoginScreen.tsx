import { FormEvent, useState } from "react";
import { LockKeyhole, Sparkles } from "lucide-react";

type LoginScreenProps = {
  error: string;
  isLoading: boolean;
  onLogin: (email: string, password: string) => Promise<void>;
};

export function LoginScreen({ error, isLoading, onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState("demo@video.local");
  const [password, setPassword] = useState("demo-password");
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError("");

    try {
      await onLogin(email, password);
    } catch {
      setLocalError("Nu am putut porni sesiunea.");
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="brand-mark" aria-hidden="true">
          <Sparkles size={26} />
        </div>
        <div className="auth-heading">
          <p className="eyebrow">Video TTS Studio</p>
          <h1 id="auth-title">Autentificare</h1>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              autoComplete="email"
              inputMode="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email@domeniu.ro"
            />
          </label>

          <label>
            Parola
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Parola"
            />
          </label>

          {(error || localError) && (
            <p className="form-error" role="alert">
              {error || localError}
            </p>
          )}

          <button className="primary-button" type="submit" disabled={isLoading}>
            <LockKeyhole size={18} />
            {isLoading ? "Se autentifica..." : "Intra in platforma"}
          </button>
        </form>
      </section>
    </main>
  );
}
