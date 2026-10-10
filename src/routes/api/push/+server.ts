const NextResponse = Response;
import { requireContext } from "@/platform/context";
import { readJson, route } from "@/platform/http";
import {
  departmentDevices,
  pushConfigured,
  subscribeDevice,
  subscriptionId,
  testDevice,
  unsubscribeDevice,
} from "@/modules/notifications/service";
import { pushRequestSchema } from "@/modules/notifications/schema";
async function legacyGET() {
  return route(async () => {
    await requireContext();
    return NextResponse.json(
      { configured: pushConfigured(), publicKey: process.env.VAPID_PUBLIC_KEY || "" },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  });
}
async function legacyPOST(request: Request) {
  return route(async () => {
    const data = pushRequestSchema.parse(await readJson(request));
    const context = await requireContext(data.action !== "status");
    if (data.action === "status") {
      const active = (await departmentDevices(context.departmentId)).some(
        (device) =>
          device.id === subscriptionId(data.endpoint, context.organizationId, context.user.id) &&
          device.userId === context.user.id,
      );
      return NextResponse.json({ active }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (data.action === "subscribe") await subscribeDevice(context, data.subscription);
    else if (data.action === "unsubscribe") await unsubscribeDevice(context, data.endpoint);
    else await testDevice(context, data.endpoint);
    return NextResponse.json({ ok: true });
  });
}

import type { RequestHandler } from "@sveltejs/kit";
export const GET: RequestHandler = ({ request, params }) => legacyGET();
export const POST: RequestHandler = ({ request, params }) => legacyPOST(request);
