<script lang="ts">
  import { AuthForm } from "@/components/auth-form";
  import type { PageData } from "./$types";
  export let data: PageData;
</script>

<AuthForm initialError={data.error} notice={data.notice} />
