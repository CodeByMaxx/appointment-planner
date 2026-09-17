import { useState } from "react";
import BookingPage from "./pages/BookingPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";

type View = "booking" | "dashboard";

function App() {
  const [authenticated, setAuthenticated] = useState(
    sessionStorage.getItem("admin_authenticated") === "true"
  );

  const [view, setView] = useState<View>("booking");

  const handleLogin = () => {
    sessionStorage.setItem("admin_authenticated", "true");
    setAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_authenticated");
    setAuthenticated(false);
  };

  if (!authenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div>
      <header className="app-header">
        <h1>Appointment Planner</h1>

        <nav>
          <button onClick={() => setView("booking")}>
            Termin buchen
          </button>

          <button onClick={() => setView("dashboard")}>
            Dashboard
          </button>

          <button onClick={handleLogout}>
            Abmelden
          </button>
        </nav>
      </header>

      <main>
        {view === "booking" && <BookingPage />}
        {view === "dashboard" && <DashboardPage />}
      </main>
    </div>
  );
}

export default App;
