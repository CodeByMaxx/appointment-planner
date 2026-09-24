import { useEffect, useState } from "react";
import API_URL from "../lib/api";

const COMPANY_ID = import.meta.env.VITE_COMPANY_ID;

type Mode = "booking" | "cancellation";

type Service = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
};

type Slot = {
  startTime: string;
  endTime: string;
  available: boolean;
};

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Vienna",
  });
}

export default function BookingPage() {
  const [mode, setMode] = useState<Mode>("booking");

  // -----------------------------
  // Booking
  // -----------------------------

  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] =
    useState("");

  const [selectedDate, setSelectedDate] =
    useState("");

  const [selectedTime, setSelectedTime] =
    useState("");

  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] =
    useState(false);

  const [customerName, setCustomerName] =
    useState("");

  const [customerEmail, setCustomerEmail] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [booking, setBooking] =
    useState(false);

  const [bookingSuccess, setBookingSuccess] =
    useState(false);

  const [bookingError, setBookingError] =
    useState("");

  // -----------------------------
  // Cancellation
  // -----------------------------

  const [cancellationEmail, setCancellationEmail] =
    useState("");

  const [cancellationCode, setCancellationCode] =
    useState("");

  const [cancelling, setCancelling] =
    useState(false);

  const [cancellationSuccess, setCancellationSuccess] =
    useState(false);

  const [cancellationError, setCancellationError] =
    useState("");

  // -----------------------------
  // Load services
  // -----------------------------

  useEffect(() => {
    fetch(`${API_URL}/services?companyId=${COMPANY_ID}`)
      .then((response) => response.json())
      .then((data) => {
        setServices(data);
      })
      .catch((error) => {
        console.error(error);

        setBookingError(
          "Dienstleistungen konnten nicht geladen werden."
        );
      });
  }, []);

  // -----------------------------
  // Load available slots
  // -----------------------------

  useEffect(() => {
    if (!selectedService || !selectedDate) {
      setSlots([]);
      setSelectedTime("");
      return;
    }

    setLoadingSlots(true);
    setSelectedTime("");
    setBookingSuccess(false);
    setBookingError("");

    fetch(
      `${API_URL}/slots?companyId=${COMPANY_ID}&serviceId=${selectedService}&date=${selectedDate}`
    )
      .then((response) => response.json())
      .then((data) => {
        setSlots(data);
      })
      .catch((error) => {
        console.error(error);

        setSlots([]);

        setBookingError(
          "Verfügbare Zeiten konnten nicht geladen werden."
        );
      })
      .finally(() => {
        setLoadingSlots(false);
      });
  }, [selectedService, selectedDate]);

  const availableSlots = slots.filter((slot) => slot.available);

  // -----------------------------
  // Switch between modes
  // -----------------------------

  function switchMode(nextMode: Mode) {
    setMode(nextMode);

    setBookingError("");
    setCancellationError("");

    setBookingSuccess(false);
    setCancellationSuccess(false);
  }

  // -----------------------------
  // Booking
  // -----------------------------

  async function handleBooking() {
    setBookingError("");
    setBookingSuccess(false);

    if (
      !selectedService ||
      !selectedDate ||
      !selectedTime ||
      !customerName.trim() ||
      !customerEmail.trim()
    ) {
      setBookingError(
        "Bitte füllen Sie alle Pflichtfelder aus."
      );

      return;
    }

    const selectedSlot = slots.find(
      (slot) =>
        slot.startTime === selectedTime
    );

    if (!selectedSlot) {
      setBookingError(
        "Die ausgewählte Uhrzeit ist nicht mehr verfügbar."
      );

      return;
    }

    setBooking(true);

    try {
      const response = await fetch(
        `${API_URL}/appointments`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            companyId: COMPANY_ID,
            serviceId: selectedService,

            customerName:
              customerName.trim(),

            customerEmail:
              customerEmail.trim(),

            message:
              message.trim(),

            startTime:
              selectedSlot.startTime,

            endTime:
              selectedSlot.endTime,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setBookingError(
          data.error ||
            "Die Buchung ist fehlgeschlagen."
        );

        return;
      }

      setBookingSuccess(true);

      setSelectedTime("");
      setCustomerName("");
      setCustomerEmail("");
      setMessage("");

      // Refresh available slots after booking.
      const slotsResponse =
        await fetch(
          `${API_URL}/slots?companyId=${COMPANY_ID}&serviceId=${selectedService}&date=${selectedDate}`
        );

      const updatedSlots =
        await slotsResponse.json();

      setSlots(updatedSlots);
    } catch (error) {
      console.error(error);

      setBookingError(
        "Der Server konnte nicht erreicht werden."
      );
    } finally {
      setBooking(false);
    }
  }

  // -----------------------------
  // Cancellation
  // -----------------------------

  async function handleCancellation() {
    setCancellationError("");
    setCancellationSuccess(false);

    const email =
      cancellationEmail.trim();

    const code =
      cancellationCode.trim();

    if (!email) {
      setCancellationError(
        "Bitte geben Sie Ihre E-Mail-Adresse ein."
      );

      return;
    }

    if (!/^\d{12}$/.test(code)) {
      setCancellationError(
        "Bitte geben Sie einen gültigen 12-stelligen Stornocode ein."
      );

      return;
    }

    setCancelling(true);

    try {
      const response =
        await fetch(
          `${API_URL}/appointments/cancel`,
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({
              customerEmail: email,
              cancellationCode: code,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setCancellationError(
          data.error ||
            "Der Termin konnte nicht storniert werden."
        );

        return;
      }

      setCancellationSuccess(true);

      setCancellationEmail("");
      setCancellationCode("");
    } catch (error) {
      console.error(error);

      setCancellationError(
        "Der Server konnte nicht erreicht werden."
      );
    } finally {
      setCancelling(false);
    }
  }

  // -----------------------------
  // Render
  // -----------------------------

  return (
    <section>
      <div className="page-header">
        <div>
          <h2>Terminverwaltung</h2>

          <p>
            Buchen Sie einen neuen Termin oder
            stornieren Sie eine bestehende Buchung.
          </p>
        </div>
      </div>

      <div className="card">
        {/* Tabs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "1fr 1fr",
            gap: "8px",
            marginBottom: "24px",
          }}
        >
          <button
            type="button"
            className={
              mode === "booking"
                ? "primary-button"
                : "secondary-button"
            }
            onClick={() =>
              switchMode("booking")
            }
          >
            Termin buchen
          </button>

          <button
            type="button"
            className={
              mode === "cancellation"
                ? "primary-button"
                : "secondary-button"
            }
            onClick={() =>
              switchMode("cancellation")
            }
          >
            Termin stornieren
          </button>
        </div>

        {/* =========================
            BOOKING
        ========================= */}

        {mode === "booking" && (
          <>
            <div className="page-header">
              <div>
                <h2>Termin buchen</h2>

                <p>
                  Wählen Sie eine
                  Dienstleistung, einen Tag
                  und eine verfügbare Uhrzeit.
                </p>
              </div>
            </div>

            {/* Service */}
            <div className="form-group">
              <label htmlFor="service">
                Dienstleistung
              </label>

              <select
                id="service"
                value={selectedService}
                onChange={(event) => {
                  setSelectedService(
                    event.target.value
                  );

                  setSelectedDate("");
                  setSelectedTime("");

                  setBookingSuccess(false);
                  setBookingError("");
                }}
              >
                <option value="">
                  Bitte auswählen
                </option>

                {services.map(
                  (service) => (
                    <option
                      key={service.id}
                      value={service.id}
                    >
                      {service.name} –{" "}
                      {service.durationMinutes} Minuten
                    </option>
                  )
                )}
              </select>
            </div>

            {selectedService && (
              <>
                {/* Date */}
                <div className="form-group">
                  <label htmlFor="date">
                    Tag
                  </label>

                  <input
                    id="date"
                    type="date"
                    value={selectedDate}
                    onChange={(event) =>
                      setSelectedDate(
                        event.target.value
                      )
                    }
                  />
                </div>

                {/* Time */}
                {selectedDate && (
                  <div className="form-group">
                    <label htmlFor="time">
                      Uhrzeit
                    </label>

                    {loadingSlots ? (
                      <p className="muted">
                        Verfügbare Zeiten
                        werden geladen...
                      </p>
                    ) : availableSlots.length ===
                      0 ? (
                      <p className="muted">
                        Für diesen Tag sind
                        keine Termine verfügbar.
                      </p>
                    ) : (
                      <select
                        id="time"
                        value={selectedTime}
                        onChange={(event) => {
                          setSelectedTime(
                            event.target.value
                          );

                          setBookingSuccess(
                            false
                          );

                          setBookingError("");
                        }}
                      >
                        <option value="">
                          Bitte auswählen
                        </option>

                        {availableSlots.map(
                          (slot) => (
                            <option
                              key={
                                slot.startTime
                              }
                              value={
                                slot.startTime
                              }
                            >
                              {formatTime(
                                slot.startTime
                              )}{" "}
                              –{" "}
                              {formatTime(
                                slot.endTime
                              )}
                            </option>
                          )
                        )}
                      </select>
                    )}
                  </div>
                )}

                {/* Customer data */}
                {selectedTime && (
                  <div>
                    <div className="form-group">
                      <label htmlFor="name">
                        Name
                      </label>

                      <input
                        id="name"
                        type="text"
                        value={customerName}
                        onChange={(event) =>
                          setCustomerName(
                            event.target.value
                          )
                        }
                        placeholder="Max Mustermann"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="email">
                        E-Mail
                      </label>

                      <input
                        id="email"
                        type="email"
                        value={customerEmail}
                        onChange={(event) =>
                          setCustomerEmail(
                            event.target.value
                          )
                        }
                        placeholder="max@example.com"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="message">
                        Nachricht / Anliegen
                      </label>

                      <textarea
                        id="message"
                        value={message}
                        onChange={(event) =>
                          setMessage(
                            event.target.value
                          )
                        }
                        placeholder="Optional: Worum geht es bei Ihrem Termin?"
                        rows={4}
                      />
                    </div>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={
                        handleBooking
                      }
                      disabled={booking}
                    >
                      {booking
                        ? "Termin wird gebucht..."
                        : "Termin buchen"}
                    </button>
                  </div>
                )}
              </>
            )}

            {bookingError && (
              <div className="message error">
                {bookingError}
              </div>
            )}

            {bookingSuccess && (
              <div className="message success">
                <strong>
                  Termin erfolgreich gebucht!
                </strong>

                <p>
                  Die Buchung wurde im
                  System gespeichert.
                  Sie erhalten eine
                  Bestätigung per E-Mail
                  mit Ihrem persönlichen
                  Stornocode.
                </p>
              </div>
            )}
          </>
        )}

        {/* =========================
            CANCELLATION
        ========================= */}

        {mode === "cancellation" && (
          <>
            <div className="page-header">
              <div>
                <h2>
                  Termin stornieren
                </h2>

                <p>
                  Geben Sie Ihre
                  E-Mail-Adresse und den
                  12-stelligen Stornocode
                  aus Ihrer
                  Bestätigungs-E-Mail ein.
                </p>
              </div>
            </div>

            {/* Cancellation email */}
            <div className="form-group">
              <label htmlFor="cancellationEmail">
                E-Mail-Adresse
              </label>

              <input
                id="cancellationEmail"
                type="email"
                value={cancellationEmail}
                onChange={(event) => {
                  setCancellationEmail(
                    event.target.value
                  );

                  setCancellationError("");
                  setCancellationSuccess(
                    false
                  );
                }}
                placeholder="max@example.com"
              />
            </div>

            {/* Cancellation code */}
            <div className="form-group">
              <label htmlFor="cancellationCode">
                Stornocode
              </label>

              <input
                id="cancellationCode"
                type="text"
                inputMode="numeric"
                maxLength={12}
                value={cancellationCode}
                onChange={(event) => {
                  const value =
                    event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 12);

                  setCancellationCode(
                    value
                  );

                  setCancellationError("");
                  setCancellationSuccess(
                    false
                  );
                }}
                placeholder="123456789012"
              />
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={
                handleCancellation
              }
              disabled={cancelling}
            >
              {cancelling
                ? "Termin wird storniert..."
                : "Termin stornieren"}
            </button>

            {cancellationError && (
              <div className="message error">
                {cancellationError}
              </div>
            )}

            {cancellationSuccess && (
              <div className="message success">
                <strong>
                  Termin erfolgreich
                  storniert.
                </strong>

                <p>
                  Sie erhalten eine
                  Stornierungsbestätigung
                  per E-Mail.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

