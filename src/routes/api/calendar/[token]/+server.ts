import { calendarContext } from "@/platform/calendar-context";
import { tenantTransaction } from "@/platform/db/tenant";
import { getWorkspace } from "@/modules/records/workspace";
import { buildExport } from "@/modules/exports";
import { route } from "@/platform/http";
import { listValue } from "@/shared/contracts";
import type { RequestHandler } from "@sveltejs/kit";
export const GET: RequestHandler = ({ params }) =>
  route(async () => {
    const context = await calendarContext(params.token!);
    return tenantTransaction(context, async () => {
      const workspace = await getWorkspace(context);
      const result = await buildExport({
        kind: "events",
        format: "ics",
        records: workspace.records.events.filter((e) =>
          listValue(e.data.participantIds).includes(context.user.id),
        ),
        members: workspace.members,
        references: workspace.records,
        calendarProductions: workspace.calendarProductions,
        organization: context.organizationName,
        department: context.departmentName,
      });
      return new Response(Buffer.from(result.bytes), {
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Cache-Control": "private, no-store",
        },
      });
    });
  });
