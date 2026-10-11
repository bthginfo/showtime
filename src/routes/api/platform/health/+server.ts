import type { RequestHandler } from "@sveltejs/kit";
import { route } from "@/platform/http";
import { platformHealth } from "@/modules/theater/health";
export const GET: RequestHandler = () => route(async () => Response.json(await platformHealth()));
