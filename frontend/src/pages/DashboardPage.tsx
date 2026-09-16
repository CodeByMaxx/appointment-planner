import { useState } from "react";
import AppointmentList from "../components/AppointmentList";
import AvailabilityList from "../components/AvailabilityList";
import ServiceList from "../components/ServiceList";

type DashboardSection =
  | "overview"
  | "appointments"
  | "services"
  | "availability";

export default function DashboardPage() {
  const [section, setSection] =
    useState<DashboardSection>(
      "overview"
    );

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div>
          <h2>Dashboard</h2>

          <p className="muted">
            Demo Company
          </p>
        </div>

        <nav className="sidebar-nav">
          <button
            className={
              section === "overview"
                ? "sidebar-button active"
                : "sidebar-button"
            }
            onClick={() =>
              setSection("overview")
            }
          >
            Übersicht
          </button>

          <button
            className={
              section === "appointments"
                ? "sidebar-button active"
                : "sidebar-button"
            }
            onClick={() =>
              setSection("appointments")
            }
          >
            Termine
          </button>

          <button
            className={
              section === "services"
                ? "sidebar-button active"
                : "sidebar-button"
            }
            onClick={() =>
              setSection("services")
            }
          >
            Services
          </button>

          <button
            className={
              section === "availability"
                ? "sidebar-button active"
                : "sidebar-button"
            }
            onClick={() =>
              setSection("availability")
            }
          >
            Öffnungszeiten
          </button>
        </nav>
      </aside>

      <div className="dashboard-content">
        {section === "overview" && (
          <Overview
            onNavigate={setSection}
          />
        )}

        {section === "appointments" && (
          <AppointmentList />
        )}

        {section === "services" && (
          <ServiceList />
        )}

        {section === "availability" && (
          <AvailabilityList />
        )}
      </div>
    </div>
  );
}

function Overview({
  onNavigate,
}: {
  onNavigate: (
    section: DashboardSection
  ) => void;
}) {
  return (
    <section>
      <div className="page-header">
        <div>
          <h2>Übersicht</h2>

          <p>
            Willkommen im Appointment Planner.
          </p>
        </div>
      </div>

      <div className="overview-grid">
        <button
          className="overview-card"
          onClick={() =>
            onNavigate("appointments")
          }
        >
          <span>Termine</span>
          <strong>Verwalten</strong>
        </button>

        <button
          className="overview-card"
          onClick={() =>
            onNavigate("services")
          }
        >
          <span>Services</span>
          <strong>Verwalten</strong>
        </button>

        <button
          className="overview-card"
          onClick={() =>
            onNavigate("availability")
          }
        >
          <span>Öffnungszeiten</span>
          <strong>Verwalten</strong>
        </button>
      </div>
    </section>
  );
}
