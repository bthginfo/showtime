<script lang="ts">
 import {useWorkspace} from './workspace-context';import {labels} from './resource-fields';import {Button} from './ui';import type {RecordKind} from '@/shared/contracts';
 export let module:string;
 const store=useWorkspace();let loading='';
 const kinds:Record<string,RecordKind[]>={productions:['productions','characters','casting'],tasks:['tasks','sprints'],time:['time','attendance'],people:['people'],actors:['actors'],documentation:['looks','templates'],inventory:['materials','reservations'],handovers:['handovers'],exports:['productions'],chat:['conversations','productions'],settings:['categories','calendarCategories']};
 $: remaining=(kinds[module]||[]).filter(k=>$store.workspace.pages?.[k]);
 async function more(kind:RecordKind){loading=kind;try{await $store.loadMore(kind);}finally{loading='';}}
</script>
{#if remaining.length}<div class="detail-actions margin-top" aria-label="Weitere Einträge laden">{#each remaining as kind (kind)}<Button disabled={!!loading} onClick={()=>void more(kind)}>Weitere {labels[kind]?.[0]||'Einträge'} laden</Button>{/each}</div>{/if}
