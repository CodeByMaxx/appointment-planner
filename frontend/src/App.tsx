import { useState } from "react";
import BookingPage from "./pages/BookingPage";
import DashboardPage from "./pages/DashboardPage";

type Page = "booking" | "dashboard";

function App() {
  const [page, setPage] = useState<Page>("booking");

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1 className="logo">Appointment Planner</h1>
        </div>

        <nav className="nav">
          <button
            className={
              page === "booking"
                ? "nav-button active"
                : "nav-button"
            }
            onClick={() => setPage("booking")}
          >
            Termin buchen
          </button>

          <button
            className={
              page === "dashboard"
                ? "nav-button active"
                : "nav-button"
            }
            onClick={() => setPage("dashboard")}
          >
            Dashboard
          </button>
        </nav>
      </header>

      <main className="container">
        {page === "booking" ? (
          <BookingPage />
        ) : (
          <DashboardPage />
        )}
      </main>
    </div>
  );
}

export default App;
