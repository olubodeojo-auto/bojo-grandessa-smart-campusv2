import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import PasswordInput from "../../components/auth/PasswordInput";
import { useAuth } from "../../hooks/useAuth";
import { getFriendlyAuthError, updatePassword } from "../../services/authService";

const MIN_PASSWORD_LENGTH = 8;

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: checkingAuth } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!checkingAuth && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (loading) return;

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
      setError(getFriendlyAuthError(err, "Unable to change your password. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 20 }}>
      <form onSubmit={handleSubmit} style={{ width: "min(100%, 380px)", display: "flex", flexDirection: "column", gap: 15 }}>
        <h2>Change Password</h2>
        {checkingAuth ? <p>Checking your account session...</p> : null}
        <p>Choose a new password with at least {MIN_PASSWORD_LENGTH} characters.</p>

        <PasswordInput
          id="change-password"
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          disabled={checkingAuth || !isAuthenticated || loading || Boolean(message)}
        />
        <PasswordInput
          id="change-password-confirm"
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          disabled={checkingAuth || !isAuthenticated || loading || Boolean(message)}
        />

        {error ? <p role="alert" style={{ color: "#b91c1c" }}>{error}</p> : null}
        {message ? <p role="status" style={{ color: "#15803d" }}>{message}</p> : null}

        <button type="submit" disabled={checkingAuth || !isAuthenticated || loading || Boolean(message)}>
          {loading ? "Changing..." : "Change Password"}
        </button>

        {message ? (
          <button type="button" onClick={() => navigate("/admin")}>Return to Dashboard</button>
        ) : (
          <Link to="/admin">Back to Dashboard</Link>
        )}
      </form>
    </div>
  );
}