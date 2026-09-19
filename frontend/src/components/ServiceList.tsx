import API_URL from "../lib/api";
import { useEffect, useState } from "react";

const COMPANY_ID = import.meta.env.VITE_COMPANY_ID;

type Service = {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  active: boolean;
};

export default function ServiceList() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDuration, setNewDuration] = useState("30");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadServices() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/services?companyId=${COMPANY_ID}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Services konnten nicht geladen werden."
        );
      }

      setServices(data);
    } catch (error) {
      console.error(error);

      setError("Services konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadServices();
  }, []);

  async function updateService(
    id: string,
    name: string,
    description: string,
    durationMinutes: number,
    active: boolean
  ) {
    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Der Name ist erforderlich.");
      return;
    }

    if (durationMinutes <= 0) {
      setError("Die Dauer muss größer als 0 sein.");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/services/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            durationMinutes,
            active,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error || "Service konnte nicht geändert werden."
        );
        return;
      }

      setServices((current) =>
        current.map((service) =>
          service.id === id ? data : service
        )
      );

      setSuccess("Service wurde aktualisiert.");
    } catch (error) {
      console.error(error);

      setError("Der Server konnte nicht erreicht werden.");
    }
  }

  async function createService() {
    setError("");
    setSuccess("");

    const duration = Number(newDuration);

    if (!newName.trim()) {
      setError("Bitte geben Sie einen Namen ein.");
      return;
    }

    if (duration <= 0) {
      setError("Die Dauer muss größer als 0 sein.");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/services`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            companyId: COMPANY_ID,
            name: newName.trim(),
            description: newDescription.trim() || undefined,
            durationMinutes: duration,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error || "Service konnte nicht erstellt werden."
        );
        return;
      }

      setServices((current) =>
        [...current, data].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );

      setNewName("");
      setNewDescription("");
      setNewDuration("30");

      setSuccess("Service wurde erstellt.");
    } catch (error) {
      console.error(error);

      setError("Der Server konnte nicht erreicht werden.");
    }
  }

  async function deactivateService(id: string) {
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/services/${id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error || "Service konnte nicht deaktiviert werden."
        );
        return;
      }

      setServices((current) =>
        current.map((service) =>
          service.id === id
            ? {
                ...service,
                active: false,
              }
            : service
        )
      );

      setSuccess("Service wurde deaktiviert.");
    } catch (error) {
      console.error(error);

      setError("Der Server konnte nicht erreicht werden.");
    }
  }

  if (loading) {
    return (
      <section>
        <h2>Services</h2>
        <p>Services werden geladen...</p>
      </section>
    );
  }

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>Services</h2>

          <p className="muted">
            Dienstleistungen verwalten
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={loadServices}
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

      <div className="service-list">
        {services.map((service) => (
          <ServiceRow
            key={service.id}
            service={service}
            onUpdate={updateService}
            onDeactivate={deactivateService}
          />
        ))}
      </div>

      <div className="card add-service">
        <h3>Service hinzufügen</h3>

        <div className="form-group">
          <label>Name</label>

          <input
            type="text"
            value={newName}
            onChange={(event) =>
              setNewName(event.target.value)
            }
            placeholder="z. B. Bart schneiden"
          />
        </div>

        <div className="form-group">
          <label>Beschreibung</label>

          <input
            type="text"
            value={newDescription}
            onChange={(event) =>
              setNewDescription(event.target.value)
            }
            placeholder="Beschreibung"
          />
        </div>

        <div className="form-group">
          <label>Dauer in Minuten</label>

          <input
            type="number"
            min="1"
            value={newDuration}
            onChange={(event) =>
              setNewDuration(event.target.value)
            }
          />
        </div>

        <button
          className="primary-button"
          onClick={createService}
        >
          Service hinzufügen
        </button>
      </div>
    </section>
  );
}

type ServiceRowProps = {
  service: Service;
  onUpdate: (
    id: string,
    name: string,
    description: string,
    durationMinutes: number,
    active: boolean
  ) => void;
  onDeactivate: (id: string) => void;
};

function ServiceRow({
  service,
  onUpdate,
  onDeactivate,
}: ServiceRowProps) {
  const [name, setName] = useState(service.name);

  const [description, setDescription] = useState(
    service.description || ""
  );

  const [duration, setDuration] = useState(
    String(service.durationMinutes)
  );

  return (
    <div
      className={
        service.active
          ? "service-row"
          : "service-row inactive"
      }
    >
      <div className="service-main">
        <input
          type="text"
          value={name}
          onChange={(event) =>
            setName(event.target.value)
          }
        />

        <input
          type="text"
          value={description}
          onChange={(event) =>
            setDescription(event.target.value)
          }
        />
      </div>

      <input
        className="duration-input"
        type="number"
        min="1"
        value={duration}
        onChange={(event) =>
          setDuration(event.target.value)
        }
      />

      <span className="service-status">
        {service.active ? "Aktiv" : "Inaktiv"}
      </span>

      <button
        className="secondary-button"
        onClick={() =>
          onUpdate(
            service.id,
            name,
            description,
            Number(duration),
            service.active
          )
        }
      >
        Speichern
      </button>

      {service.active && (
        <button
          className="danger-button"
          onClick={() =>
            onDeactivate(service.id)
          }
        >
          Deaktivieren
        </button>
      )}
    </div>
  );
}
