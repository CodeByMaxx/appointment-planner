import { useState } from "react";
import BookingPage from "./pages/BookingPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";

function App() {
  const isAdminApp = window.location.port === "8080";

  const [authenticated, setAuthenticated] = useState(
    sessionStorage.getItem("admin_authenticated") === "true"
  );

  const handleLogin = () => {
    sessionStorage.setItem("admin_authenticated", "true");
    setAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_authenticated");
    setAuthenticated(false);
  };

  // Public customer area on port 80
  if (!isAdminApp) {
    return <BookingPage />;
  }

  // Admin area on port 8080
  if (!authenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div>
      <header className="app-header">
        <h1>Appointment Planner</h1>

        <nav>
          <button onClick={handleLogout}>Abmelden</button>
        </nav>
      </header>

      <main>
        <DashboardPage />
      </main>
    </div>
  );
}

export default App;
