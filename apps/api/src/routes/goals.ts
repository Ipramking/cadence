import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const goalSchema = z.object({
  name: z.string().min(1),
  targetMinor: z.number().int().min(0),
  targetCurrency: z.enum(["USD", "NGN", "USDC"]),
  savedMinor: z.number().int().min(0).optional().default(0),
  savedCurrency: z.enum(["USD", "NGN", "USDC"]),
  deadline: z.string().datetime().optional().nullable(),
});

const goalUpdateSchema = goalSchema.partial();

export async function goalRoutes(app: FastifyInstance) {
  // GET /goals - List all goals
  app.get("/", async (request, reply) => {
    const goals = await prisma.goal.findMany({});
    return goals;
  });

  // GET /goals/:id - Get a goal by ID
  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const goal = await prisma.goal.findUnique({
      where: { id },
    });
    if (!goal) {
      return reply.status(404).send({ error: "Goal not found" });
    }
    return goal;
  });

  // POST /goals - Create a new goal
  app.post("/", async (request, reply) => {
    try {
      const data = goalSchema.parse(request.body);
      const goal = await prisma.goal.create({
        data: {
          name: data.name,
          targetMinor: data.targetMinor,
          targetCurrency: data.targetCurrency,
          savedMinor: data.savedMinor,
          savedCurrency: data.savedCurrency,
          deadline: data.deadline ? new Date(data.deadline) : null,
        },
      });
      return reply.status(201).send(goal);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: "Validation Error", details: err.errors });
      }
      throw err;
    }
  });

  // PUT /goals/:id - Update an existing goal
  app.put("/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const goal = await prisma.goal.findUnique({
        where: { id },
      });
      if (!goal) {
        return reply.status(404).send({ error: "Goal not found" });
      }

      const data = goalUpdateSchema.parse(request.body);
      
      const updateData: any = { ...data };
      if (data.deadline !== undefined) {
        updateData.deadline = data.deadline ? new Date(data.deadline) : null;
      }

      const updated = await prisma.goal.update({
        where: { id },
        data: updateData,
      });
      return updated;
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: "Validation Error", details: err.errors });
      }
      throw err;
    }
  });

  // DELETE /goals/:id - Delete a goal
  app.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const goal = await prisma.goal.findUnique({
      where: { id },
    });
    if (!goal) {
      return reply.status(404).send({ error: "Goal not found" });
    }

    await prisma.goal.delete({
      where: { id },
    });
    return { success: true };
  });
}
