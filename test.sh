cd ~/devel/appointment-planner && cat >frontend/src/components/AppointmentWeekView.tsx <<'EOF'
import { useMemo, useState } from "react";
import type { Appointment } from "./appointmentTypes";

type AppointmentWeekViewProps = {
  appointments: Appointment[];
  onCancel: (id: string) => void;
  onSelect?: (appointment: Appointment) => void;
};

const START_HOUR = 7;
const END_HOUR = 20;
const HOUR_HEIGHT = 72;

const WEEKDAYS = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
];

function getMonday(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const difference = day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + difference);
  result.setHours(0, 0, 0, 0);

  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vienna",
  }).format(date);
}

function formatDayNumber(date: Date) {
  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    timeZone: "Europe/Vienna",
  }).format(date);
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("de-AT", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Vienna",
  }).format(date);
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Vienna",
  });
}

function getMinutes(dateString: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Vienna",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(dateString));

  const hour = Number(
    parts.find((part) => part.type === "hour")?.value ?? 0
  );

  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0
  );

  return hour * 60 + minute;
}

function getAppointmentStyle(appointment: Appointment) {
  const start = getMinutes(appointment.startTime);
  const end = getMinutes(appointment.endTime);

  const calendarStart = START_HOUR * 60;

  const top =
    ((start - calendarStart) / 60) * HOUR_HEIGHT;

  const duration = Math.max(end - start, 30);

  const height =
    (duration / 60) * HOUR_HEIGHT;

  return {
    top: `${Math.max(top, 4)}px`,
    height: `${Math.max(height - 8, 42)}px`,
  };
}

function isToday(date: Date) {
  return getDateKey(date) === getDateKey(new Date());
}

export default function AppointmentWeekView({
  appointments,
  onCancel,
  onSelect,
}: AppointmentWeekViewProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const monday = useMemo(() => {
    const currentMonday = getMonday(new Date());

    return addDays(
      currentMonday,
      weekOffset * 7
    );
  }, [weekOffset]);

  const days = useMemo(
    () =>
      WEEKDAYS.map((name, index) => {
        const date = addDays(monday, index);

        return {
          name,
          date,
          key: getDateKey(date),
        };
      }),
    [monday]
  );

  const hours = Array.from(
    { length: END_HOUR - START_HOUR },
    (_, index) => START_HOUR + index
  );

  function goToPreviousWeek() {
    setWeekOffset((current) => current - 1);
  }

  function goToNextWeek() {
    setWeekOffset((current) => current + 1);
  }

  function goToToday() {
    setWeekOffset(0);
  }

  return (
    <div className="week-calendar-container">
      <div className="week-calendar-toolbar">
        <div>
          <h3>{formatMonth(monday)}</h3>

          <p className="muted">
            {formatDayNumber(monday)} –{" "}
            {formatDayNumber(
              addDays(monday, 6)
            )}
          </p>
        </div>

        <div className="week-calendar-navigation">
          <button
            type="button"
            className="secondary-button"
            onClick={goToPreviousWeek}
            aria-label="Vorherige Woche"
          >
            ←
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={goToToday}
          >
            Heute
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={goToNextWeek}
            aria-label="Nächste Woche"
          >
            →
          </button>
        </div>
      </div>

      <div className="week-calendar-scroll">
        <div className="week-calendar">
          <div className="week-calendar-header">
            <div className="week-time-column week-corner" />

            {days.map((day) => (
              <div
                key={day.key}
                className={
                  isToday(day.date)
                    ? "week-day-header today"
                    : "week-day-header"
                }
              >
                <span className="week-day-name">
                  {day.name}
                </span>

                <strong className="week-day-number">
                  {formatDayNumber(day.date)}
                </strong>
              </div>
            ))}
          </div>

          <div className="week-calendar-body">
            <div className="week-time-column">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="week-hour-label"
                >
                  {String(hour).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {days.map((day) => {
              const dayAppointments =
                appointments.filter(
                  (appointment) =>
                    getDateKey(
                      new Date(
                        appointment.startTime
                      )
                    ) === day.key
                );

              return (
                <div
                  key={day.key}
                  className={
                    isToday(day.date)
                      ? "week-day-column today"
                      : "week-day-column"
                  }
                >
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="week-hour-cell"
                    />
                  ))}

                  {dayAppointments.map(
                    (appointment) => {
                      const cancelled =
                        appointment.status ===
                        "CANCELLED";

                      return (
                        <div
                          key={appointment.id}
                          className="week-appointment-wrapper"
                          style={getAppointmentStyle(
                            appointment
                          )}
                        >
                          <button
                            type="button"
                            className={
                              cancelled
                                ? "week-appointment cancelled"
                                : "week-appointment"
                            }
                            onClick={() =>
                              onSelect?.(
                                appointment
                              )
                            }
                          >
                            <span className="week-appointment-time">
                              {formatTime(
                                appointment.startTime
                              )}{" "}
                              –{" "}
                              {formatTime(
                                appointment.endTime
                              )}
                            </span>

                            <strong>
                              {
                                appointment.customerName
                              }
                            </strong>

                            <span className="week-appointment-service">
                              {
                                appointment.service
                                  .name
                              }
                            </span>

                            {appointment.message && (
                              <span className="week-appointment-message">
                                {appointment.message}
                              </span>
                            )}

                            {cancelled && (
                              <span className="week-appointment-status">
                                Storniert
                              </span>
                            )}
                          </button>

                          {!cancelled && (
                            <button
                              type="button"
                              className="week-appointment-cancel"
                              onClick={() =>
                                onCancel(
                                  appointment.id
                                )
                              }
                            >
                              Stornieren
                            </button>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
EOF
