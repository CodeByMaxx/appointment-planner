import API_URL from "./src/lib/api";
import { useEffect, useState } from "react";

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
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const [booking, setBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState("");

  useEffect(() => {
   fetch(`${API_URL}/services?companyId=1`) 
      .then((response) => response.json())
      .then((data) => setServices(data))
      .catch((error) => {
        console.error(error);
        setBookingError(
          "Services konnten nicht geladen werden."
        );
      });
  }, []);

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
      `${API_URL}/slots?companyId=1&serviceId=${selectedService}&date=${selectedDate}`
    )
      .then((response) => response.json())
      .then((data) => setSlots(data))
      .catch((error) => {
        console.error(error);
        setSlots([]);
        setBookingError(
          "Verfügbare Zeiten konnten nicht geladen werden."
        );
      })
      .finally(() => setLoadingSlots(false));
  }, [selectedService, selectedDate]);

  const availableSlots = slots.filter(
    (slot) => slot.available
  );

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
        "Bitte füllen Sie alle Felder aus."
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
            companyId: "1",
            serviceId: selectedService,
            customerName: customerName.trim(),
            customerEmail: customerEmail.trim(),
            startTime: selectedTime,
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

      const slotsResponse = await fetch(
        `${API_URL}/slots?companyId=1&serviceId=${selectedService}&date=${selectedDate}`
      );

      const updatedSlots = await slotsResponse.json();

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

  return (
    <section>
      <div className="page-header">
        <div>
          <h2>Termin buchen</h2>
          <p>
            Wählen Sie eine Dienstleistung,
            einen Tag und eine verfügbare Uhrzeit.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="form-group">
          <label htmlFor="service">
            Dienstleistung
          </label>

          <select
            id="service"
            value={selectedService}
            onChange={(event) => {
              setSelectedService(event.target.value);
              setSelectedDate("");
              setSelectedTime("");
              setBookingSuccess(false);
              setBookingError("");
            }}
          >
            <option value="">
              Bitte auswählen
            </option>

            {services.map((service) => (
              <option
                key={service.id}
                value={service.id}
              >
                {service.name} –{" "}
                {service.durationMinutes} Minuten
              </option>
            ))}
          </select>
        </div>

        {selectedService && (
          <>
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

            {selectedDate && (
              <div className="form-group">
                <label htmlFor="time">
                  Uhrzeit
                </label>

                {loadingSlots ? (
                  <p className="muted">
                    Verfügbare Zeiten werden
                    geladen...
                  </p>
                ) : availableSlots.length === 0 ? (
                  <p className="muted">
                    Für diesen Tag sind keine
                    Termine verfügbar.
                  </p>
                ) : (
                  <select
                    id="time"
                    value={selectedTime}
                    onChange={(event) => {
                      setSelectedTime(
                        event.target.value
                      );
                      setBookingSuccess(false);
                      setBookingError("");
                    }}
                  >
                    <option value="">
                      Bitte auswählen
                    </option>

                    {availableSlots.map(
                      (slot) => (
                        <option
                          key={slot.startTime}
                          value={slot.startTime}
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

            {selectedTime && (
              <div className="booking-details">
                <h3>Ihre Daten</h3>

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

                <button
                  className="primary-button"
                  onClick={handleBooking}
                  disabled={booking}
                >
                  {booking
                    ? "Termin wird gebucht..."
                    : "Termin buchen"}
                </button>
              </div>
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
                  Die Buchung wurde im System
                  gespeichert.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
