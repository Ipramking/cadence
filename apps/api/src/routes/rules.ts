import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const ruleSchema = z.object({
  kind: z.enum(["salary", "goal", "family", "hedge"]),
  label: z.string().min(1),
  percentage: z.number().min(0).max(100),
  targetCurrency: z.enum(["USD", "NGN", "USDC"]).optional().nullable(),
  goalId: z.string().uuid().optional().nullable(),
  priority: z.number().int().min(1),
  enabled: z.boolean().optional(),
});

const ruleUpdateSchema = ruleSchema.partial();

export async function ruleRoutes(app: FastifyInstance) {
  // GET /rules - List all rules
  app.get("/", async (request, reply) => {
    const rules = await prisma.allocationRule.findMany({
      orderBy: { priority: "asc" },
    });
    return rules;
  });

  // GET /rules/:id - Get a rule by ID
  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const rule = await prisma.allocationRule.findUnique({
      where: { id },
    });
    if (!rule) {
      return reply.status(404).send({ error: "Rule not found" });
    }
    return rule;
  });

  // POST /rules - Create a new rule
  app.post("/", async (request, reply) => {
    try {
      const data = ruleSchema.parse(request.body);
      const rule = await prisma.allocationRule.create({
        data: {
          kind: data.kind,
          label: data.label,
          percentage: data.percentage,
          targetCurrency: data.targetCurrency,
          goalId: data.goalId,
          priority: data.priority,
          enabled: data.enabled ?? true,
        },
      });
      return reply.status(201).send(rule);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: "Validation Error", details: err.errors });
      }
      throw err;
    }
  });

  // PUT /rules/:id - Update an existing rule
  app.put("/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const rule = await prisma.allocationRule.findUnique({
        where: { id },
      });
      if (!rule) {
        return reply.status(404).send({ error: "Rule not found" });
      }

      const data = ruleUpdateSchema.parse(request.body);
      const updated = await prisma.allocationRule.update({
        where: { id },
        data,
      });
      return updated;
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: "Validation Error", details: err.errors });
      }
      throw err;
    }
  });

  // DELETE /rules/:id - Delete a rule
  app.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const rule = await prisma.allocationRule.findUnique({
      where: { id },
    });
    if (!rule) {
      return reply.status(404).send({ error: "Rule not found" });
    }

    await prisma.allocationRule.delete({
      where: { id },
    });
    return { success: true };
  });
}
