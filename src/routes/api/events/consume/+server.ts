import { handleCallback } from "@vercel/queue";
import { consumeEvent, type EventPointer } from "@/platform/events/transport";
import type { RequestHandler } from "@sveltejs/kit";
export const config = { split: true };
export const POST: RequestHandler = ({ request }) =>
  handleCallback<EventPointer>(async (pointer) => {
    await consumeEvent(pointer, request);
  })(request);
