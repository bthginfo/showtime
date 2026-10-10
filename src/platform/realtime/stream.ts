import { requestScope } from "../request";
import { requireContext } from "../context";
import { tenantTransaction } from "../db/tenant";
import type { Context } from "../context";
export function revisionStream(
  request: Request,
  initial: Context,
  channel: string,
  event: string,
  read: () => Promise<number>,
) {
  const encoder = new TextEncoder();
  let stopped = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => {
        if (!stopped) controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      send({ type: "connected" });
      let previous = -1;
      const end = Date.now() + 50_000;
      try {
        while (!stopped && !request.signal.aborted && Date.now() < end) {
          const revision = await requestScope.run({ request, after: [] }, async () => {
            const fresh = await requireContext();
            if (
              fresh.organizationId !== initial.organizationId ||
              fresh.departmentId !== initial.departmentId
            )
              throw new Error("Scope changed");
            return tenantTransaction(fresh, read);
          });
          if (revision !== previous) {
            send({ event, channel, id: `${revision}-0`, data: { revision } });
            previous = revision;
          } else send({ type: "heartbeat" });
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, 5000);
            request.signal.addEventListener(
              "abort",
              () => {
                clearTimeout(timer);
                resolve();
              },
              { once: true },
            );
          });
        }
        send({ type: "reconnect" });
      } catch {
        send({ type: "error" });
      } finally {
        if (!stopped) {
          stopped = true;
          controller.close();
        }
      }
    },
    cancel() {
      stopped = true;
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "private, no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
