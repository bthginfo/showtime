import { authFormFeedback, authFormNotice } from "@/shared/auth-form-feedback";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ url }) => ({
  error: authFormFeedback(url.searchParams),
  notice: authFormNotice(url.searchParams),
});
