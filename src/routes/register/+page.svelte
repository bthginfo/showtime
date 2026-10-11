<script lang="ts">
  import { AuthForm } from "@/components/auth-form";
  import type { PageData } from "./$types";
  export let data: PageData;
</script>

<AuthForm register initialError={data.error} invitation={data.invitation} />
