import {
  SESClient,
  SendEmailCommand,
} from "@aws-sdk/client-ses";

const ses = new SESClient({
  region: process.env.AWS_REGION || "eu-central-1",
});

type AppointmentEmailData = {
  customerName: string;
  customerEmail: string;
  companyName: string;
  companyEmail: string;
  companyTimezone: string;
  serviceName: string;
  startTime: Date;
  endTime: Date;
  cancellationCode?: string;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatDate = (date: Date, timezone: string) =>
  new Intl.DateTimeFormat("de-AT", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);

const emailLayout = (
  companyName: string,
  content: string
) => `
<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(companyName)}</title>
  </head>

  <body style="
    margin: 0;
    padding: 0;
    background: #f3f4f6;
    font-family: Arial, Helvetica, sans-serif;
    color: #111827;
  ">

    <div style="
      max-width: 640px;
      margin: 0 auto;
      padding: 40px 20px;
    ">

      <div style="
        background: #ffffff;
        border-radius: 12px;
        padding: 32px;
      ">

        <div style="
          margin-bottom: 28px;
          font-size: 18px;
          font-weight: bold;
          color: #111827;
        ">
          ${escapeHtml(companyName)}
        </div>

        ${content}

      </div>

      <p style="
        margin: 20px 0 0 0;
        text-align: center;
        font-size: 12px;
        color: #9ca3af;
      ">
        Diese E-Mail wurde automatisch vom Appointment Planner versendet.
      </p>

    </div>
  </body>
</html>
`;

export async function sendAppointmentEmails(
  data: AppointmentEmailData
) {
  const fromEmail =
    process.env.SES_FROM_EMAIL || data.companyEmail;

  const appointmentDate = formatDate(
    data.startTime,
    data.companyTimezone
  );

  const customerHtml = emailLayout(
    data.companyName,
    `
      <h1 style="
        margin: 0 0 20px 0;
        font-size: 26px;
        color: #111827;
      ">
        Termin bestätigt
      </h1>

      <p style="
        margin: 0 0 28px 0;
        font-size: 16px;
        line-height: 1.6;
      ">
        Hallo ${escapeHtml(data.customerName)},
      </p>

      <p style="
        margin: 0 0 28px 0;
        font-size: 16px;
        line-height: 1.6;
      ">
        Ihr Termin wurde erfolgreich gebucht.
      </p>

      <div style="
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 24px;
      ">

        <div style="
          margin-bottom: 14px;
          font-size: 14px;
          color: #6b7280;
        ">
          LEISTUNG
        </div>

        <div style="
          font-size: 17px;
          font-weight: bold;
          margin-bottom: 20px;
        ">
          ${escapeHtml(data.serviceName)}
        </div>

        <div style="
          margin-bottom: 14px;
          font-size: 14px;
          color: #6b7280;
        ">
          TERMIN
        </div>

        <div style="
          font-size: 17px;
          font-weight: bold;
        ">
          ${escapeHtml(appointmentDate)}
        </div>

      </div>

      <div style="
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 24px;
      ">

        <div style="
          margin-bottom: 14px;
          font-size: 14px;
          color: #6b7280;
        ">
          STORNIERCODE
        </div>

        <div style="
          font-size: 26px;
          font-weight: bold;
          letter-spacing: 3px;
          color: #111827;
        ">
          ${escapeHtml(data.cancellationCode || "")}
        </div>

      </div>

      <p style="
        margin: 0;
        font-size: 14px;
        line-height: 1.6;
        color: #6b7280;
      ">
        Mit diesem 12-stelligen Code können Sie Ihren Termin
        später online stornieren.
      </p>
    `
  );

  const companyHtml = emailLayout(
    data.companyName,
    `
      <h1 style="
        margin: 0 0 20px 0;
        font-size: 26px;
        color: #111827;
      ">
        Neue Terminbuchung
      </h1>

      <p style="
        margin: 0 0 28px 0;
        font-size: 16px;
        line-height: 1.6;
      ">
        Es wurde ein neuer Termin gebucht.
      </p>

      <div style="
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 24px;
      ">

        <div style="
          margin-bottom: 14px;
          font-size: 14px;
          color: #6b7280;
        ">
          KUNDE
        </div>

        <div style="
          font-size: 17px;
          font-weight: bold;
          margin-bottom: 20px;
        ">
          ${escapeHtml(data.customerName)}
        </div>

        <div style="
          margin-bottom: 14px;
          font-size: 14px;
          color: #6b7280;
        ">
          E-MAIL
        </div>

        <div style="
          font-size: 16px;
          margin-bottom: 20px;
        ">
          ${escapeHtml(data.customerEmail)}
        </div>

        <div style="
          margin-bottom: 14px;
          font-size: 14px;
          color: #6b7280;
        ">
          LEISTUNG
        </div>

        <div style="
          font-size: 17px;
          font-weight: bold;
          margin-bottom: 20px;
        ">
          ${escapeHtml(data.serviceName)}
        </div>

        <div style="
          margin-bottom: 14px;
          font-size: 14px;
          color: #6b7280;
        ">
          TERMIN
        </div>

        <div style="
          font-size: 17px;
          font-weight: bold;
          margin-bottom: 20px;
        ">
          ${escapeHtml(appointmentDate)}
        </div>

        <div style="
          margin-bottom: 14px;
          font-size: 14px;
          color: #6b7280;
        ">
          STORNIERCODE
        </div>

        <div style="
          font-size: 20px;
          font-weight: bold;
          letter-spacing: 2px;
        ">
          ${escapeHtml(data.cancellationCode || "")}
        </div>

      </div>

      <p style="
        margin: 0;
        font-size: 14px;
        line-height: 1.6;
        color: #6b7280;
      ">
        Der Termin wurde erfolgreich im Appointment Planner angelegt.
      </p>
    `
  );

  await Promise.all([
    ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: {
          ToAddresses: [data.customerEmail],
        },
        Message: {
          Subject: {
            Data: `Termin bestätigt – ${data.companyName}`,
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: customerHtml,
              Charset: "UTF-8",
            },
          },
        },
      })
    ),

    ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: {
          ToAddresses: [data.companyEmail],
        },
        Message: {
          Subject: {
            Data: `Neue Terminbuchung – ${data.companyName}`,
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: companyHtml,
              Charset: "UTF-8",
            },
          },
        },
      })
    ),
  ]);
}

export async function sendCancellationEmails(
  data: AppointmentEmailData
) {
  const fromEmail =
    process.env.SES_FROM_EMAIL || data.companyEmail;

  const appointmentDate = formatDate(
    data.startTime,
    data.companyTimezone
  );

  const customerHtml = emailLayout(
    data.companyName,
    `
      <h1 style="
        margin: 0 0 20px 0;
        font-size: 26px;
        color: #111827;
      ">
        Termin storniert
      </h1>

      <p style="
        margin: 0 0 28px 0;
        font-size: 16px;
        line-height: 1.6;
      ">
        Hallo ${escapeHtml(data.customerName)},
      </p>

      <p style="
        margin: 0 0 28px 0;
        font-size: 16px;
        line-height: 1.6;
      ">
        Ihr Termin wurde erfolgreich storniert.
      </p>

      <div style="
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 24px;
      ">

        <div style="
          margin-bottom: 14px;
          font-size: 14px;
          color: #6b7280;
        ">
          LEISTUNG
        </div>

        <div style="
          font-size: 17px;
          font-weight: bold;
          margin-bottom: 20px;
        ">
          ${escapeHtml(data.serviceName)}
        </div>

        <div style="
          margin-bottom: 14px;
          font-size: 14px;
          color: #6b7280;
        ">
          TERMIN
        </div>

        <div style="
          font-size: 17px;
          font-weight: bold;
        ">
          ${escapeHtml(appointmentDate)}
        </div>

      </div>

      <p style="
        margin: 0;
        font-size: 14px;
        line-height: 1.6;
        color: #6b7280;
      ">
        Bei Fragen können Sie sich gerne direkt an uns wenden.
      </p>
    `
  );

  const companyHtml = emailLayout(
    data.companyName,
    `
      <h1 style="
        margin: 0 0 20px 0;
        font-size: 26px;
        color: #111827;
      ">
        Termin storniert
      </h1>

      <p style="
        margin: 0 0 28px 0;
        font-size: 16px;
        line-height: 1.6;
      ">
        Ein Termin wurde vom Kunden storniert.
      </p>

      <div style="
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 24px;
      ">

        <div style="
          margin-bottom: 14px;
          font-size: 14px;
          color: #6b7280;
        ">
          KUNDE
        </div>

        <div style="
          font-size: 17px;
          font-weight: bold;
          margin-bottom: 20px;
        ">
          ${escapeHtml(data.customerName)}
        </div>

        <div style="
          margin-bottom: 14px;
          font-size: 14px;
          color: #6b7280;
        ">
          E-MAIL
        </div>

        <div style="
          font-size: 16px;
          margin-bottom: 20px;
        ">
          ${escapeHtml(data.customerEmail)}
        </div>

        <div style="
          margin-bottom: 14px;
          font-size: 14px;
          color: #6b7280;
        ">
          LEISTUNG
        </div>

        <div style="
          font-size: 17px;
          font-weight: bold;
          margin-bottom: 20px;
        ">
          ${escapeHtml(data.serviceName)}
        </div>

        <div style="
          margin-bottom: 14px;
          font-size: 14px;
          color: #6b7280;
        ">
          TERMIN
        </div>

        <div style="
          font-size: 17px;
          font-weight: bold;
        ">
          ${escapeHtml(appointmentDate)}
        </div>

      </div>

      <p style="
        margin: 0;
        font-size: 14px;
        line-height: 1.6;
        color: #6b7280;
      ">
        Der Termin wurde im Appointment Planner als storniert markiert.
      </p>
    `
  );

  await Promise.all([
    ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: {
          ToAddresses: [data.customerEmail],
        },
        Message: {
          Subject: {
            Data: `Termin storniert – ${data.companyName}`,
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: customerHtml,
              Charset: "UTF-8",
            },
          },
        },
      })
    ),

    ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: {
          ToAddresses: [data.companyEmail],
        },
        Message: {
          Subject: {
            Data: `Termin storniert – ${data.companyName}`,
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: companyHtml,
              Charset: "UTF-8",
            },
          },
        },
      })
    ),
  ]);
}

