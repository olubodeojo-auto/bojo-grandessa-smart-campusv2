import { useState } from "react";
import { Link } from "react-router-dom";
import { resetPassword } from "../../services/authService";

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
			setError(err instanceof Error ? err.message : "Unable to send the recovery email.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
			<form onSubmit={handleSubmit} style={{ width: 350, display: "flex", flexDirection: "column", gap: 15 }}>
				<h2>Reset your password</h2>
				<p>Enter your email address and we will send you a recovery link.</p>

				<input
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
