import { useState } from "react";

type LoginPageProps = {
  onLogin: () => void;
};

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const correctPassword = import.meta.env.VITE_ADMIN_PASSWORD;

    if (password === correctPassword) {
      sessionStorage.setItem("admin_authenticated", "true");
      onLogin();
      return;
    }

    setError("Falsches Passwort.");
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Appointment Planner</h1>
        <p>Admin Login</p>

        <input
          type="password"
          placeholder="Passwort"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError("");
          }}
        />

        <button type="submit">Anmelden</button>

        {error && <p className="login-error">{error}</p>}
      </form>
    </div>
  );
}
