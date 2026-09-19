import API_URL from "../lib/api";
import { useEffect, useState } from "react";

const COMPANY_ID = import.meta.env.VITE_COMPANY_ID;

type Availability = {
  id: string;
  companyId: string;
  weekday: number;
  startTime: string;
  endTime: string;
};

const weekdayNames: Record<number, string> = {
  1: "Montag",
  2: "Dienstag",
  3: "Mittwoch",
  4: "Donnerstag",
  5: "Freitag",
  6: "Samstag",
  7: "Sonntag",
};

export default function AvailabilityList() {
  const [availability, setAvailability] =
    useState<Availability[]>([]);

  const [loading, setLoading] = useState(true);

  const [newWeekday, setNewWeekday] = useState(1);
  const [newStartTime, setNewStartTime] =
    useState("09:00");
  const [newEndTime, setNewEndTime] =
    useState("17:00");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadAvailability() {
    try {
      const response = await  fetch(
        `${API_URL}/availability?companyId=${COMPANY_ID}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Fehler beim Laden der Verfügbarkeit"
        );
      }

      setAvailability(data);
    } catch (error) {
      console.error(error);

      setError(
        "Die Öffnungszeiten konnten nicht geladen werden."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAvailability();
  }, []);

  async function updateAvailability(
    id: string,
    weekday: number,
    startTime: string,
    endTime: string
  ) {
    setError("");
    setSuccess("");

    if (startTime >= endTime) {
      setError(
        "Die Startzeit muss vor der Endzeit liegen."
      );
      return;
    }

    try {
      const response = await fetch(`${API_URL}/availability/${id}`, {    
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            weekday,
            startTime,
            endTime,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Die Öffnungszeit konnte nicht geändert werden."
        );
        return;
      }

      setAvailability((current) =>
        current.map((item) =>
          item.id === id ? data : item
        )
      );

      setSuccess(
        "Öffnungszeit wurde aktualisiert."
      );
    } catch (error) {
      console.error(error);

      setError(
        "Der Server konnte nicht erreicht werden."
      );
    }
  }

  async function deleteAvailability(
    id: string
  ) {
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_URL}/availability/${id}`, {  
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Die Öffnungszeit konnte nicht gelöscht werden."
        );
        return;
      }

      setAvailability((current) =>
        current.filter(
          (item) => item.id !== id
        )
      );

      setSuccess(
        "Öffnungszeit wurde gelöscht."
      );
    } catch (error) {
      console.error(error);

      setError(
        "Der Server konnte nicht erreicht werden."
      );
    }
  }

  async function createAvailability() {
    setError("");
    setSuccess("");

    if (newStartTime >= newEndTime) {
      setError(
        "Die Startzeit muss vor der Endzeit liegen."
      );
      return;
    }

    try {
      const response = await fetch(`${API_URL}/availability`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            companyId: COMPANY_ID,
            weekday: newWeekday,
            startTime: newStartTime,
            endTime: newEndTime,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Die Öffnungszeit konnte nicht erstellt werden."
        );
        return;
      }

      setAvailability((current) =>
        [...current, data].sort(
          (a, b) =>
            a.weekday - b.weekday ||
            a.startTime.localeCompare(
              b.startTime
            )
        )
      );

      setSuccess(
        "Öffnungszeit wurde hinzugefügt."
      );
    } catch (error) {
      console.error(error);

      setError(
        "Der Server konnte nicht erreicht werden."
      );
    }
  }

  if (loading) {
    return (
      <section>
        <h2>Öffnungszeiten</h2>
        <p>Öffnungszeiten werden geladen...</p>
      </section>
    );
  }

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>Öffnungszeiten</h2>

          <p className="muted">
            Verfügbarkeit des Unternehmens
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={loadAvailability}
        >
          Aktualisieren
        </button>
      </div>

      {error && (
        <div className="message error">
          {error}
        </div>
      )}

      {success && (
        <div className="message success">
          {success}
        </div>
      )}

      <div className="availability-list">
        {availability.map((item) => (
          <AvailabilityRow
            key={item.id}
            availability={item}
            onUpdate={updateAvailability}
            onDelete={deleteAvailability}
          />
        ))}
      </div>

      <div className="card add-availability">
        <h3>
          Öffnungszeit hinzufügen
        </h3>

        <div className="form-row">
          <div className="form-group">
            <label>Tag</label>

            <select
              value={newWeekday}
              onChange={(event) =>
                setNewWeekday(
                  Number(event.target.value)
                )
              }
            >
              {Object.entries(
                weekdayNames
              ).map(([value, name]) => (
                <option
                  key={value}
                  value={value}
                >
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Von</label>

            <input
              type="time"
              value={newStartTime}
              onChange={(event) =>
                setNewStartTime(
                  event.target.value
                )
              }
            />
          </div>

          <div className="form-group">
            <label>Bis</label>

            <input
              type="time"
              value={newEndTime}
              onChange={(event) =>
                setNewEndTime(
                  event.target.value
                )
              }
            />
          </div>
        </div>

        <button
          className="primary-button"
          onClick={createAvailability}
        >
          Öffnungszeit hinzufügen
        </button>
      </div>
    </section>
  );
}

type AvailabilityRowProps = {
  availability: Availability;
  onUpdate: (
    id: string,
    weekday: number,
    startTime: string,
    endTime: string
  ) => void;
  onDelete: (id: string) => void;
};

function AvailabilityRow({
  availability,
  onUpdate,
  onDelete,
}: AvailabilityRowProps) {
  const [weekday, setWeekday] =
    useState(availability.weekday);

  const [startTime, setStartTime] =
    useState(availability.startTime);

  const [endTime, setEndTime] =
    useState(availability.endTime);

  return (
    <div className="availability-row">
      <select
        value={weekday}
        onChange={(event) =>
          setWeekday(
            Number(event.target.value)
          )
        }
      >
        {Object.entries(
          weekdayNames
        ).map(([value, name]) => (
          <option
            key={value}
            value={value}
          >
            {name}
          </option>
        ))}
      </select>

      <input
        type="time"
        value={startTime}
        onChange={(event) =>
          setStartTime(event.target.value)
        }
      />

      <span>–</span>

      <input
        type="time"
        value={endTime}
        onChange={(event) =>
          setEndTime(event.target.value)
        }
      />

      <button
        className="secondary-button"
        onClick={() =>
          onUpdate(
            availability.id,
            weekday,
            startTime,
            endTime
          )
        }
      >
        Speichern
      </button>

      <button
        className="danger-button"
        onClick={() =>
          onDelete(availability.id)
        }
      >
        Löschen
      </button>
    </div>
  );
}
