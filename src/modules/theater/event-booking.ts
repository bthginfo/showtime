import { eq, and } from "drizzle-orm";
import { resourceBookings, records, venueResources } from "@/platform/db/schema";
import type { Context } from "@/platform/context";
import { can } from "@/platform/context";
import type { Transaction } from "@/platform/db";
import { HttpError } from "@/platform/http";
import { reserveResource } from "./service";
/** Only called from the canonical calendar write while the tenant planning lock is held. */
export async function syncEventBooking(
  context: Context,
  event: typeof records.$inferSelect,
  tx: Transaction,
) {
  const linked = await tx
    .select()
    .from(resourceBookings)
    .where(
      and(
        eq(resourceBookings.organizationId, context.organizationId),
        eq(resourceBookings.activityId, event.id),
      ),
    );
  for (const booking of linked) {
    const [resource] = await tx
      .select()
      .from(venueResources)
      .where(eq(venueResources.id, booking.resourceId))
      .limit(1);
    if (
      !resource ||
      !can(
        context,
        "inventory.reserve",
        event.productionId || "",
        resource.departmentId || context.departmentId,
      )
    )
      throw new HttpError(403, "Keine Berechtigung für die verknüpfte Raumplanung.");
  }
  if (linked.length)
    await tx.delete(resourceBookings).where(eq(resourceBookings.activityId, event.id));
  if (event.data.cancelled === true || !event.data.resourceId) return "";
  const booking = await reserveResource(
    context,
    {
      resourceId: String(event.data.resourceId),
      productionId: event.productionId || undefined,
      startAt: String(event.data.start),
      endAt: String(event.data.end),
      quantity: 1,
    },
    { activityId: event.id },
  );
  return booking.id;
}
