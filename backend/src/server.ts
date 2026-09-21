import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";

import servicesRoutes from "./routes/services";
import availabilityRoutes from "./routes/availability";
import slotsRoutes from "./routes/slots";
import appointmentsRoutes from "./routes/appointments";

const app = Fastify({
  logger: true,
});

const start = async () => {
  try {
    await app.register(cors, {
      origin: true,
      methods: ["GET", "HEAD", "POST", "PATCH", "OPTIONS"],
    });

    app.get("/health", async () => {
      return {
        status: "ok",
        service: "appointment-planner-api",
      };
    });

    // API routes
    await app.register(servicesRoutes);
    await app.register(availabilityRoutes);
    await app.register(slotsRoutes);
    await app.register(appointmentsRoutes);

    await app.listen({
      port: 3001,
      host: "0.0.0.0",
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
