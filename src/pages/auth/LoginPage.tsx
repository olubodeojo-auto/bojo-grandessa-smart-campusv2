import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { getFriendlyAuthError } from "../../services/authService";
import PasswordInput from "../../components/auth/PasswordInput";

export default function LoginPage() {
  const { user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (user) {
    return <Navigate to="/admin" replace />;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      setError(getFriendlyAuthError(err, "We could not sign you in. Check your details and try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100vh",
      }}
    >
      <form
        onSubmit={handleLogin}
        style={{
          width: 350,
          display: "flex",
          flexDirection: "column",
          gap: 15,
        }}
      >
        <h2>Grandessa Login</h2>

        <label htmlFor="login-email">Email address</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <PasswordInput
          id="login-password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          disabled={loading}
        />

        <Link to="/forgot-password">Forgot Password?</Link>

        {error && (
          <p style={{ color: "red" }}>
            {error}
          </p>
        )}

        <button disabled={loading}>
          {loading ? "Signing In..." : "Login"}
        </button>
      </form>
    </div>
  );
}