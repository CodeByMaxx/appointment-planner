import prisma from "../lib/prisma";
import { randomInt } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  sendAppointmentEmails,
  sendCancellationEmails,
} from "../lib/email";

function generateCancellationCode(): string {
  return Array.from({ length: 12 }, () =>
    randomInt(0, 10).toString()
  ).join("");
}

export default async function appointmentRoutes(
  app: FastifyInstance
) {
  // GET /appointments?companyId=...
  app.get<{
    Querystring: {
      companyId?: string;
    };
  }>("/appointments", async (request, reply) => {
    const { companyId } = request.query;

    if (!companyId) {
      return reply.status(400).send({
        error: "companyId is required",
      });
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        companyId,
      },
      include: {
        service: true,
      },
      orderBy: {
        startTime: "asc",
      },
    });

    return reply.send(appointments);
  });

  // POST /appointments
  app.post<{
    Body: {
      companyId: string;
      serviceId: string;
      customerName: string;
      customerEmail: string;
      message?: string;
      startTime: string;
      endTime: string;
    };
  }>("/appointments", async (request, reply) => {
    const {
      companyId,
      serviceId,
      customerName,
      customerEmail,
      message,
      startTime,
      endTime,
    } = request.body;

    if (
      !companyId ||
      !serviceId ||
      !customerName ||
      !customerEmail ||
      !startTime ||
      !endTime
    ) {
      return reply.status(400).send({
        error: "Missing required fields",
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      return reply.status(400).send({
        error: "Invalid appointment time",
      });
    }

    const company = await prisma.company.findUnique({
      where: {
        id: companyId,
      },
    });

    if (!company) {
      return reply.status(404).send({
        error: "Company not found",
      });
    }

    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        companyId,
        active: true,
      },
    });

    if (!service) {
      return reply.status(404).send({
        error: "Service not found",
      });
    }

    // Check availability for the requested weekday/time.
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: company.timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(start);

    const weekdayString = parts.find(
      (part) => part.type === "weekday"
    )?.value;

    const hourString = parts.find(
      (part) => part.type === "hour"
    )?.value;

    const minuteString = parts.find(
      (part) => part.type === "minute"
    )?.value;

    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

    const weekday =
      weekdayString !== undefined
        ? weekdayMap[weekdayString]
        : undefined;

    if (
      weekday === undefined ||
      hourString === undefined ||
      minuteString === undefined
    ) {
      return reply.status(400).send({
        error: "Could not determine appointment weekday/time",
      });
    }

    const startMinutes =
      Number(hourString) * 60 + Number(minuteString);

    const endFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: company.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const endParts = endFormatter.formatToParts(end);

    const endHourString = endParts.find(
      (part) => part.type === "hour"
    )?.value;

    const endMinuteString = endParts.find(
      (part) => part.type === "minute"
    )?.value;

    if (
      endHourString === undefined ||
      endMinuteString === undefined
    ) {
      return reply.status(400).send({
        error: "Could not determine appointment end time",
      });
    }

    const endMinutes =
      Number(endHourString) * 60 +
      Number(endMinuteString);

    const availability =
      await prisma.availability.findFirst({
        where: {
          companyId,
          weekday,
        },
      });

    if (!availability) {
      return reply.status(409).send({
        error: "Appointment time is outside availability",
      });
    }

    const [availabilityStartHour, availabilityStartMinute] =
      availability.startTime.split(":").map(Number);

    const [availabilityEndHour, availabilityEndMinute] =
      availability.endTime.split(":").map(Number);

    const availabilityStartMinutes =
      availabilityStartHour * 60 +
      availabilityStartMinute;

    const availabilityEndMinutes =
      availabilityEndHour * 60 +
      availabilityEndMinute;

    if (
      startMinutes < availabilityStartMinutes ||
      endMinutes > availabilityEndMinutes
    ) {
      return reply.status(409).send({
        error: "Appointment time is outside availability",
      });
    }

    // Check for overlapping confirmed appointments.
    const overlappingAppointment =
      await prisma.appointment.findFirst({
        where: {
          companyId,
          status: {
            not: "CANCELLED",
          },
          startTime: {
            lt: end,
          },
          endTime: {
            gt: start,
          },
        },
      });

    if (overlappingAppointment) {
      return reply.status(409).send({
        error: "Appointment time is already booked",
      });
    }

    const appointment =
      await prisma.appointment.create({
        data: {
          companyId,
          serviceId,
          customerName,
          customerEmail,
          message,
          startTime: start,
          endTime: end,
          status: "CONFIRMED",
          cancellationCode:
            generateCancellationCode(),
        },
        include: {
          company: true,
          service: true,
        },
      });

    try {
      await sendAppointmentEmails({
        customerName:
          appointment.customerName,
        customerEmail:
          appointment.customerEmail,
        companyName:
          appointment.company.name,
        companyEmail:
          appointment.company.email,
        companyTimezone:
          appointment.company.timezone,
        serviceName:
          appointment.service.name,
        startTime:
          appointment.startTime,
        endTime:
          appointment.endTime,
        cancellationCode:
          appointment.cancellationCode,
      });
    } catch (error) {
      request.log.error(
        error,
        "Failed to send appointment emails"
      );
    }

    return reply.status(201).send(
      appointment
    );
  });

  // POST /appointments/cancel
  //
  // Public customer cancellation using
  // email address + 12-digit cancellation code.
  app.post<{
    Body: {
      customerEmail: string;
      cancellationCode: string;
    };
  }>("/appointments/cancel", async (request, reply) => {
    const {
      customerEmail,
      cancellationCode,
    } = request.body;

    if (
      typeof customerEmail !== "string" ||
      !customerEmail.trim() ||
      !/^\d{12}$/.test(cancellationCode)
    ) {
      return reply.status(400).send({
        error: "Invalid email or cancellation code",
      });
    }

    const appointment =
      await prisma.appointment.findFirst({
        where: {
          cancellationCode,
          customerEmail:
            customerEmail.trim(),
        },
        include: {
          company: true,
          service: true,
        },
      });

    if (!appointment) {
      return reply.status(404).send({
        error:
          "Email address or cancellation code is incorrect",
      });
    }

    if (appointment.status === "CANCELLED") {
      return reply.status(409).send({
        error: "Appointment is already cancelled",
      });
    }

    const cancelledAppointment =
      await prisma.appointment.update({
        where: {
          id: appointment.id,
        },
        data: {
          status: "CANCELLED",
        },
      });

    try {
      await sendCancellationEmails({
        customerName:
          cancelledAppointment.customerName,
        customerEmail:
          cancelledAppointment.customerEmail,
        companyName:
          appointment.company.name,
        companyEmail:
          appointment.company.email,
        companyTimezone:
          appointment.company.timezone,
        serviceName:
          appointment.service.name,
        startTime:
          cancelledAppointment.startTime,
        endTime:
          cancelledAppointment.endTime,
      });
    } catch (error) {
      request.log.error(
        error,
        "Failed to send cancellation emails"
      );
    }

    return reply.send({
      message:
        "Appointment cancelled successfully",
      appointment:
        cancelledAppointment,
    });
  });

  // PATCH /appointments/:id/cancel
  //
  // Admin cancellation.
  app.patch<{
    Params: {
      id: string;
    };
  }>("/appointments/:id/cancel", async (
    request,
    reply
  ) => {
    const { id } = request.params;

    const appointment =
      await prisma.appointment.findUnique({
        where: {
          id,
        },
        include: {
          company: true,
          service: true,
        },
      });

    if (!appointment) {
      return reply.status(404).send({
        error: "Appointment not found",
      });
    }

    if (appointment.status === "CANCELLED") {
      return reply.status(409).send({
        error: "Appointment is already cancelled",
      });
    }

    const cancelledAppointment =
      await prisma.appointment.update({
        where: {
          id,
        },
        data: {
          status: "CANCELLED",
        },
      });

    try {
      await sendCancellationEmails({
        customerName:
          cancelledAppointment.customerName,
        customerEmail:
          cancelledAppointment.customerEmail,
        companyName:
          appointment.company.name,
        companyEmail:
          appointment.company.email,
        companyTimezone:
          appointment.company.timezone,
        serviceName:
          appointment.service.name,
        startTime:
          cancelledAppointment.startTime,
        endTime:
          cancelledAppointment.endTime,
      });
    } catch (error) {
      request.log.error(
        error,
        "Failed to send cancellation emails"
      );
    }

    return reply.send({
      message:
        "Appointment cancelled successfully",
      appointment:
        cancelledAppointment,
    });
  });
}

