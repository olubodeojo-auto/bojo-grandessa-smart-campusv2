import { useState } from "react";
import { Link } from "react-router-dom";
import { getFriendlyAuthError, resetPassword } from "../../services/authService";

export default function ForgotPasswordPage() {
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		const normalizedEmail = email.trim();

		setMessage("");
		setError("");

		if (!normalizedEmail) {
			setError("Enter your email address.");
			return;
		}

		setLoading(true);

		try {
			await resetPassword(normalizedEmail);
			setMessage("If an account exists for this email, a password recovery link has been sent.");
		} catch (err) {
			setError(getFriendlyAuthError(err, "We could not send the recovery email. Please try again."));
		} finally {
			setLoading(false);
		}
	}

	return (
		<div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
			<form onSubmit={handleSubmit} style={{ width: 350, display: "flex", flexDirection: "column", gap: 15 }}>
				<h2>Reset your password</h2>
				<p>Enter your email address and we will send you a recovery link.</p>

				<label htmlFor="forgot-password-email">Email address</label>
				<input
					id="forgot-password-email"
					type="email"
					placeholder="Email"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					autoComplete="email"
					required
				/>

				{error ? <p style={{ color: "red" }}>{error}</p> : null}
				{message ? <p style={{ color: "green" }}>{message}</p> : null}

				<button type="submit" disabled={loading}>
					{loading ? "Sending..." : "Send Recovery Link"}
				</button>

				<Link to="/login">Back to Login</Link>
			</form>
		</div>
	);
}
