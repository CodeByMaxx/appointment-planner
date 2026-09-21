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
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Appointment Planner</title>
</head>

<body style="
  margin: 0;
  padding: 0;
  background-color: #f4f6f8;
  font-family: Arial, Helvetica, sans-serif;
  color: #1f2937;
">

  <div style="
    max-width: 600px;
    margin: 40px auto;
    background: #ffffff;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #e5e7eb;
  ">

    <div style="
      padding: 24px 32px;
      background: #111827;
      color: #ffffff;
    ">
      <div style="
        font-size: 14px;
        opacity: 0.75;
        margin-bottom: 6px;
      ">
        Appointment Planner
      </div>

      <div style="
        font-size: 22px;
        font-weight: bold;
      ">
        ${escapeHtml(companyName)}
      </div>
    </div>

    <div style="
      padding: 32px;
    ">
      ${content}
    </div>

    <div style="
      padding: 20px 32px;
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 12px;
    ">
      Diese E-Mail wurde automatisch vom Appointment Planner versendet.
    </div>

  </div>

</body>
</html>
`;

export async function sendAppointmentEmails(
  data: AppointmentEmailData
) {
  const fromEmail = process.env.SES_FROM_EMAIL;

  if (!fromEmail) {
    throw new Error("SES_FROM_EMAIL is not configured");
  }

  const customerName = escapeHtml(data.customerName);
  const customerEmail = escapeHtml(data.customerEmail);
  const companyName = escapeHtml(data.companyName);
  const serviceName = escapeHtml(data.serviceName);

  const appointmentDate = formatDate(
    data.startTime,
    data.companyTimezone
  );

  // --------------------------------------------------
  // E-Mail an den Kunden
  // --------------------------------------------------

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
        margin: 0 0 20px 0;
        font-size: 16px;
        line-height: 1.6;
      ">
        Hallo ${customerName},
      </p>

      <p style="
        margin: 0 0 28px 0;
        font-size: 16px;
        line-height: 1.6;
      ">
        Ihr Termin bei <strong>${companyName}</strong>
        wurde erfolgreich bestätigt.
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
          ${serviceName}
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
        Vielen Dank für Ihre Buchung.
      </p>
    `
  );

  await ses.send(
    new SendEmailCommand({
      Source: fromEmail,
      Destination: {
        ToAddresses: [data.customerEmail],
      },
      Message: {
        Subject: {
          Data: `Terminbestätigung – ${data.companyName}`,
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
  );

  // --------------------------------------------------
  // E-Mail an die Firma
  // --------------------------------------------------

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
          ${customerName}
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
          ${customerEmail}
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
          ${serviceName}
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
    `
  );

  await ses.send(
    new SendEmailCommand({
      Source: fromEmail,
      Destination: {
        ToAddresses: [data.companyEmail],
      },
      Message: {
        Subject: {
          Data: `Neue Terminbuchung – ${data.customerName}`,
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
  );
}


export async function sendCancellationEmails(
  data: AppointmentEmailData
) {
  const fromEmail = process.env.SES_FROM_EMAIL;

  if (!fromEmail) {
    throw new Error("SES_FROM_EMAIL is not configured");
  }

  const customerName = escapeHtml(data.customerName);
  const companyName = escapeHtml(data.companyName);
  const serviceName = escapeHtml(data.serviceName);

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
        margin: 0 0 20px 0;
        font-size: 16px;
        line-height: 1.6;
      ">
        Hallo ${customerName},
      </p>

      <p style="
        margin: 0 0 28px 0;
        font-size: 16px;
        line-height: 1.6;
      ">
        Ihr Termin bei <strong>${companyName}</strong>
        wurde storniert.
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
          ${serviceName}
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
    `
  );

  await ses.send(
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
        Ein Termin wurde storniert.
      </p>

      <div style="
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 20px;
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
          ${customerName}
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
          ${serviceName}
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
    `
  );

  await ses.send(
    new SendEmailCommand({
      Source: fromEmail,
      Destination: {
        ToAddresses: [data.companyEmail],
      },
      Message: {
        Subject: {
          Data: `Termin storniert – ${data.customerName}`,
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
  );
}
