import type { PageServerLoad } from "./$types";
export const load: PageServerLoad = ({ url }) => ({
  invalid: url.searchParams.get("error") === "invalid",
  backup: url.searchParams.get("method") === "backup",
});
