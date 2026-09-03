import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getFriendlyAuthError, updatePassword } from "../../services/authService";
import PasswordInput from "../../components/auth/PasswordInput";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function checkRecoverySession(): Promise<void> {
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (!isActive) {
        return;
      }

      if (sessionError) {
        setError(getFriendlyAuthError(sessionError, "This recovery link is invalid or has expired. Request a new link."));
      }

      setHasRecoverySession(Boolean(data.session));
      setCheckingSession(false);
    }

    void checkRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isActive) {
        return;
      }

      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasRecoverySession(Boolean(session));
        setCheckingSession(false);
      }
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

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
      await updatePassword(password);
      setPassword("");
      setConfirmPassword("");
      setMessage("Your password has been changed successfully.");
    } catch (err) {
      setError(getFriendlyAuthError(err, "Unable to update your password. Please request a new link and try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <form onSubmit={handleSubmit} style={{ width: 350, display: "flex", flexDirection: "column", gap: 15 }}>
        <h2>Choose a new password</h2>

        {checkingSession ? <p>Checking your invitation or recovery link...</p> : null}
        {!checkingSession && !hasRecoverySession ? (
          <p style={{ color: "red" }}>This recovery link is invalid or has expired. Request a new link.</p>
        ) : null}

        <p>Use at least {MIN_PASSWORD_LENGTH} characters.</p>
        <PasswordInput
          id="reset-password"
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          disabled={checkingSession || !hasRecoverySession || loading || Boolean(message)}
        />
        <PasswordInput
          id="reset-password-confirm"
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          disabled={checkingSession || !hasRecoverySession || loading || Boolean(message)}
        />

        {error ? <p style={{ color: "red" }}>{error}</p> : null}
        {message ? <p style={{ color: "green" }}>{message}</p> : null}

        <button type="submit" disabled={checkingSession || !hasRecoverySession || loading || Boolean(message)}>
          {loading ? "Updating..." : "Update Password"}
        </button>

        <Link to="/login">Back to Login</Link>
      </form>
    </div>
  );
}