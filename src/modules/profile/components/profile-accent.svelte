<script lang="ts">
import {useWorkspace} from '@/components/workspace-context';import {onDestroy} from 'svelte';const workspaceStore=useWorkspace();
$: if(typeof document!=='undefined'){document.documentElement.dataset.accentOwner=$workspaceStore.workspace.user.id;document.documentElement.dataset.accent=$workspaceStore.workspace.user.preferences?.accentPalette||'green';}
onDestroy(()=>{delete document.documentElement.dataset.accentOwner;delete document.documentElement.dataset.accent;});
</script>
