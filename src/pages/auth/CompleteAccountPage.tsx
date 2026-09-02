import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

const MIN_PASSWORD_LENGTH = 8;

export default function CompleteAccountPage() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadSession(): Promise<void> {
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (!isActive) {
        return;
      }

      if (sessionError) {
        setError(sessionError.message);
        setCheckingSession(false);
        return;
      }

      const sessionUser = data.session?.user;
      if (sessionUser) {
        setUserEmail(sessionUser.email ?? null);
      } else {
        setUserEmail(null);
      }

      setCheckingSession(false);
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isActive) return;

      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        setUserEmail(session?.user?.email ?? null);
      }

      if (event === "SIGNED_OUT") {
        setUserEmail(null);
      }

      if (!checkingSession) {
        return;
      }

      setCheckingSession(false);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [checkingSession]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMessage("");
    setError("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        throw updateError;
      }

      setPassword("");
      setConfirmPassword("");
      setMessage("Your account is set up successfully.");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete the account setup.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <form onSubmit={handleSubmit} style={{ width: 380, display: "flex", flexDirection: "column", gap: 15 }}>
        <h2>Complete Your Account</h2>

        {checkingSession ? (
          <p>Checking your invitation session...</p>
        ) : null}

        {!checkingSession && !userEmail ? (
          <p style={{ color: "red" }}>This invitation session is invalid or has expired. Please request a new invitation.</p>
        ) : null}

        {userEmail ? (
          <p style={{ margin: 0, color: "#475569" }}>
            Account email: <strong>{userEmail}</strong>
          </p>
        ) : null}

        <input
          type="password"
          placeholder="New Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          disabled={checkingSession || !userEmail || loading || Boolean(message)}
        />

        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          disabled={checkingSession || !userEmail || loading || Boolean(message)}
        />

        {error ? <p style={{ color: "red" }}>{error}</p> : null}
        {message ? <p style={{ color: "green" }}>{message}</p> : null}

        <button type="submit" disabled={checkingSession || !userEmail || loading || Boolean(message)}>
          {loading ? "Completing..." : "Complete Account Setup"}
        </button>

        <Link to="/login">Back to Login</Link>
      </form>
    </div>
  );
}
