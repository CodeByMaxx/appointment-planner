import { FastifyInstance } from "fastify";
import prisma from "../lib/prisma";

export default async function availabilityRoutes(app: FastifyInstance) {
  // GET /availability?companyId=1
  app.get<{
    Querystring: {
      companyId: string;
    };
  }>("/availability", async (request, reply) => {
    const { companyId } = request.query;

    if (!companyId) {
      return reply.status(400).send({
        error: "companyId is required",
      });
    }

    const availability = await prisma.availability.findMany({
      where: {
        companyId,
      },
      orderBy: [
        {
          weekday: "asc",
        },
        {
          startTime: "asc",
        },
      ],
    });

    return availability;
  });

  // GET /availability/:id
  app.get<{
    Params: {
      id: string;
    };
  }>("/availability/:id", async (request, reply) => {
    const { id } = request.params;

    const availability = await prisma.availability.findUnique({
      where: {
        id,
      },
    });

    if (!availability) {
      return reply.status(404).send({
        error: "Availability not found",
      });
    }

    return availability;
  });

  // POST /availability
  app.post<{
    Body: {
      companyId: string;
      weekday: number;
      startTime: string;
      endTime: string;
    };
  }>("/availability", async (request, reply) => {
    const {
      companyId,
      weekday,
      startTime,
      endTime,
    } = request.body;

    if (
      !companyId ||
      weekday === undefined ||
      !startTime ||
      !endTime
    ) {
      return reply.status(400).send({
        error:
          "companyId, weekday, startTime and endTime are required",
      });
    }

    if (weekday < 1 || weekday > 7) {
      return reply.status(400).send({
        error: "weekday must be between 1 and 7",
      });
    }

    if (startTime >= endTime) {
      return reply.status(400).send({
        error: "startTime must be before endTime",
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

    const availability = await prisma.availability.create({
      data: {
        companyId,
        weekday,
        startTime,
        endTime,
      },
    });

    return reply.status(201).send(availability);
  });

  // PUT /availability/:id
  app.put<{
    Params: {
      id: string;
    };
    Body: {
      weekday?: number;
      startTime?: string;
      endTime?: string;
    };
  }>("/availability/:id", async (request, reply) => {
    const { id } = request.params;
    const {
      weekday,
      startTime,
      endTime,
    } = request.body;

    const existingAvailability =
      await prisma.availability.findUnique({
        where: {
          id,
        },
      });

    if (!existingAvailability) {
      return reply.status(404).send({
        error: "Availability not found",
      });
    }

    const newWeekday =
      weekday ?? existingAvailability.weekday;

    const newStartTime =
      startTime ?? existingAvailability.startTime;

    const newEndTime =
      endTime ?? existingAvailability.endTime;

    if (newWeekday < 1 || newWeekday > 7) {
      return reply.status(400).send({
        error: "weekday must be between 1 and 7",
      });
    }

    if (newStartTime >= newEndTime) {
      return reply.status(400).send({
        error: "startTime must be before endTime",
      });
    }

    const updatedAvailability =
      await prisma.availability.update({
        where: {
          id,
        },
        data: {
          weekday: newWeekday,
          startTime: newStartTime,
          endTime: newEndTime,
        },
      });

    return updatedAvailability;
  });

  // DELETE /availability/:id
  app.delete<{
    Params: {
      id: string;
    };
  }>("/availability/:id", async (request, reply) => {
    const { id } = request.params;

    const existingAvailability =
      await prisma.availability.findUnique({
        where: {
          id,
        },
      });

    if (!existingAvailability) {
      return reply.status(404).send({
        error: "Availability not found",
      });
    }

    await prisma.availability.delete({
      where: {
        id,
      },
    });

    return {
      message: "Availability deleted",
    };
  });
}
