import { sql } from "drizzle-orm";
import { authDb } from "@/platform/db/connections";
import type { PageServerLoad } from "./$types";
export const load: PageServerLoad = async ({ params, setHeaders }) => {
  setHeaders({ "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" });
  const rows = await authDb.execute(sql`select showtime_public_privacy(${params.slug}) as notice`);
  return {
    notice: (rows[0]?.notice || null) as null | {
      theater: string;
      published: string;
      controller: Record<string, string>;
      rightsContact: string;
      purposes: {
        group: string;
        purpose: string;
        basis: string;
        retention: string;
        recipients: string;
        notice: string;
      }[];
      notice: string;
    },
  };
};
