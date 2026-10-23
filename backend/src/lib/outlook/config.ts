const tenantId = process.env.MS_TENANT_ID?.trim() ?? "";
const clientId = process.env.MS_CLIENT_ID?.trim() ?? "";
const clientSecret = process.env.MS_CLIENT_SECRET?.trim() ?? "";
const calendarEmail = process.env.MS_CALENDAR_EMAIL?.trim() ?? "";

export const outlookConfig = {
  tenantId,
  clientId,
  clientSecret,
  calendarEmail,
};

export function isOutlookConfigured(): boolean {
  return Boolean(
    outlookConfig.tenantId &&
      outlookConfig.clientId &&
      outlookConfig.clientSecret &&
      outlookConfig.calendarEmail
  );
}
