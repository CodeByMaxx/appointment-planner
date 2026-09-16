import { FastifyInstance } from "fastify";
import prisma from "../lib/prisma";

export default async function servicesRoutes(app: FastifyInstance) {
  // GET /services?companyId=1
  app.get<{
    Querystring: {
      companyId: string;
    };
  }>("/services", async (request, reply) => {
    const { companyId } = request.query;

    if (!companyId) {
      return reply.status(400).send({
        error: "companyId is required",
      });
    }

    const services = await prisma.service.findMany({
      where: {
        companyId,
        active: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return services;
  });

  // GET /services/:id
  app.get<{
    Params: {
      id: string;
    };
  }>("/services/:id", async (request, reply) => {
    const { id } = request.params;

    const service = await prisma.service.findUnique({
      where: {
        id,
      },
    });

    if (!service) {
      return reply.status(404).send({
        error: "Service not found",
      });
    }

    return service;
  });

  // POST /services
  app.post<{
    Body: {
      companyId: string;
      name: string;
      description?: string;
      durationMinutes: number;
    };
  }>("/services", async (request, reply) => {
    const {
      companyId,
      name,
      description,
      durationMinutes,
    } = request.body;

    if (!companyId || !name || durationMinutes === undefined) {
      return reply.status(400).send({
        error:
          "companyId, name and durationMinutes are required",
      });
    }

    if (durationMinutes <= 0) {
      return reply.status(400).send({
        error: "durationMinutes must be greater than 0",
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

    const service = await prisma.service.create({
      data: {
        companyId,
        name,
        description,
        durationMinutes,
      },
    });

    return reply.status(201).send(service);
  });

  // PUT /services/:id
  app.put<{
    Params: {
      id: string;
    };
    Body: {
      name?: string;
      description?: string;
      durationMinutes?: number;
      active?: boolean;
    };
  }>("/services/:id", async (request, reply) => {
    const { id } = request.params;
    const {
      name,
      description,
      durationMinutes,
      active,
    } = request.body;

    const existingService = await prisma.service.findUnique({
      where: {
        id,
      },
    });

    if (!existingService) {
      return reply.status(404).send({
        error: "Service not found",
      });
    }

    if (
      durationMinutes !== undefined &&
      durationMinutes <= 0
    ) {
      return reply.status(400).send({
        error: "durationMinutes must be greater than 0",
      });
    }

    const service = await prisma.service.update({
      where: {
        id,
      },
      data: {
        name,
        description,
        durationMinutes,
        active,
      },
    });

    return service;
  });

  // DELETE /services/:id
  app.delete<{
    Params: {
      id: string;
    };
  }>("/services/:id", async (request, reply) => {
    const { id } = request.params;

    const existingService = await prisma.service.findUnique({
      where: {
        id,
      },
    });

    if (!existingService) {
      return reply.status(404).send({
        error: "Service not found",
      });
    }

    const service = await prisma.service.update({
      where: {
        id,
      },
      data: {
        active: false,
      },
    });

    return {
      message: "Service deactivated",
      service,
    };
  });
}
