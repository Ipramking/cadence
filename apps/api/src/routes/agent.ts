import type { FastifyInstance } from "fastify";
import { parseCommand } from "../ai/index.js";

/**
 * Natural-language command bar. Parses a free-text instruction into a
 * structured intent (send_family, set_salary, create_goal, ...) with a
 * friendly reply, using the AI layer (with a deterministic fallback).
 */
export async function agentRoutes(app: FastifyInstance): Promise<void> {
  app.post("/agent/command", async (req) => {
    const body = (req.body ?? {}) as { text?: string };
    const text = (body.text ?? "").trim();
    if (!text) {
      return {
        action: "unknown",
        reply: 'Try something like "send home ₦60k this month".',
      };
    }
    return parseCommand(text);
  });
}
