import { Dashboard } from "./components/Dashboard";
import { LoginScreen } from "./components/LoginScreen";
import { useAuth } from "./hooks/useAuth";

export default function App() {
  const auth = useAuth();

  if (!auth.isAuthenticated) {
    return (
      <LoginScreen
        error={auth.error}
        isLoading={auth.isLoading}
        onLogin={auth.login}
      />
    );
  }

  return (
    <Dashboard
      token={auth.token}
      username={auth.user?.username || ""}
      onLogout={auth.logout}
    />
  );
}
