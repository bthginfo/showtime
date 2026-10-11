import { authFormFeedback } from "@/shared/auth-form-feedback";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ url }) => ({
  error: authFormFeedback(url.searchParams),
  invitation: url.searchParams.get("invitation") || "",
});
