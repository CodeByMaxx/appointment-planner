import API_URL from "../lib/api";
import { useEffect, useState } from "react";

const COMPANY_ID = import.meta.env.VITE_COMPANY_ID;

type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  active: boolean;
};

type Appointment = {
  id: string;
  customerName: string;
  customerEmail: string;
  startTime: string;
  endTime: string;
  status: string;
  service: Service;
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(
    "de-AT",
    {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Europe/Vienna",
    }
  );
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString(
    "de-AT",
    {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Vienna",
    }
  );
}

export default function AppointmentList() {
  const [appointments, setAppointments] =
    useState<Appointment[]>([]);

  const [loading, setLoading] = useState(true);

  async function loadAppointments() {
    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/appointments?companyId=${COMPANY_ID}`
      );

      const data = await response.json();

      setAppointments(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAppointments();
  }, []);

  async function cancelAppointment(
    id: string
  ) {
    if (
      !window.confirm(
        "Möchten Sie diesen Termin wirklich stornieren?"
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/appointments/${id}/cancel`, { 
          method: "PATCH",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(
          data.error ||
            "Stornierung fehlgeschlagen."
        );
        return;
      }

      setAppointments((current) =>
        current.map((appointment) =>
          appointment.id === id
            ? {
                ...appointment,
                status: "CANCELLED",
              }
            : appointment
        )
      );
    } catch (error) {
      console.error(error);
      alert(
        "Der Server konnte nicht erreicht werden."
      );
    }
  }

  const confirmedAppointments =
    appointments.filter(
      (appointment) =>
        appointment.status !== "CANCELLED"
    );

  const cancelledAppointments =
    appointments.filter(
      (appointment) =>
        appointment.status === "CANCELLED"
    );

  const sortedAppointments = [
    ...appointments,
  ].sort(
    (a, b) =>
      new Date(a.startTime).getTime() -
      new Date(b.startTime).getTime()
  );

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>Termine</h2>

          <p className="muted">
            {confirmedAppointments.length} aktiv ·{" "}
            {cancelledAppointments.length} storniert
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={loadAppointments}
        >
          Aktualisieren
        </button>
      </div>

      {loading ? (
        <p>Termine werden geladen...</p>
      ) : sortedAppointments.length === 0 ? (
        <div className="empty-state">
          Keine Termine vorhanden.
        </div>
      ) : (
        <div>
          {sortedAppointments.map(
            (appointment) => {
              const cancelled =
                appointment.status ===
                "CANCELLED";

              return (
                <article
                  key={appointment.id}
                  className={
                    cancelled
                      ? "appointment cancelled"
                      : "appointment"
                  }
                >
                  <div>
                    <p className="appointment-date">
                      {formatDate(
                        appointment.startTime
                      )}
                    </p>

                    <h3>
                      {formatTime(
                        appointment.startTime
                      )}{" "}
                      –{" "}
                      {formatTime(
                        appointment.endTime
                      )}
                    </h3>

                    <p>
                      <strong>
                        {appointment.customerName}
                      </strong>
                    </p>

                    <p>
                      {appointment.service.name}
                    </p>

                    <p className="muted">
                      {appointment.customerEmail}
                    </p>
                  </div>

                  <div className="appointment-actions">
                    <span
                      className={
                        cancelled
                          ? "status cancelled"
                          : "status confirmed"
                      }
                    >
                      {appointment.status}
                    </span>

                    {!cancelled && (
                      <button
                        className="danger-button"
                        onClick={() =>
                          cancelAppointment(
                            appointment.id
                          )
                        }
                      >
                        Stornieren
                      </button>
                    )}
                  </div>
                </article>
              );
            }
          )}
        </div>
      )}
    </section>
  );
}
