<script lang="ts">
 import {onMount} from 'svelte';import {api,post} from '@/shared/client-api';import {BrandMark} from './brand-mark';
 import PlatformConsole from './platform-console.svelte';
 export let onSelect:(organizationId:string,departmentId:string)=>Promise<void>;
 export let compact=false;
 let scopes:{organizationId:string;organizationName:string;departmentId:string;departmentName:string;status:string}[]=[];
 let selected='';let error='';let busy=false;let platformAdmin=false;let name='';let slug='';let invitationUrl='';
 onMount(()=>{void api<{scopes:typeof scopes;platformAdmin:boolean}>('/api/platform/scopes').then(data=>{scopes=data.scopes.filter(s=>s.status==='active');platformAdmin=data.platformAdmin;}).catch(e=>error=e.message);});
 async function choose(){const row=scopes.find(s=>s.organizationId+':'+s.departmentId===selected);if(!row)return;busy=true;try{await onSelect(row.organizationId,row.departmentId);}catch(e){error=e instanceof Error?e.message:'Auswahl fehlgeschlagen.';}finally{busy=false;}}
 async function create(){busy=true;error='';try{const result=await post<{invitationUrl:string}>('/api/platform/tenants',{name,slug});invitationUrl=result.invitationUrl;name='';slug='';}catch(e){error=e instanceof Error?e.message:'Einrichtung fehlgeschlagen.';}finally{busy=false;}}
</script>
<div class={compact?'scope-control':'gate'}>
 {#if !compact}<BrandMark/><h1>Theater und Gewerk auswählen</h1><p>Wähle den Bereich, in dem du arbeiten möchtest.</p>{/if}
 <label>Theater · Gewerk<select bind:value={selected} aria-label="Theater und Gewerk"><option value="">Bitte wählen …</option>{#each scopes as row (row.organizationId+row.departmentId)}<option value={row.organizationId+':'+row.departmentId}>{row.organizationName} · {row.departmentName}</option>{/each}</select></label>
 <button class="button primary" disabled={busy||!selected} on:click={choose}>Bereich öffnen</button>
 {#if error}<p role="alert" class="error-message">{error}</p>{/if}
 {#if platformAdmin&&!compact}<section class="surface"><h2>Neues Theater einrichten</h2><form on:submit|preventDefault={create}><label>Theatername<input bind:value={name} required minlength="2"/></label><label>Kennung<input bind:value={slug} required pattern={'[a-z0-9][a-z0-9-]{1,62}'}/></label><button class="button secondary" disabled={busy}>Theater anlegen</button></form>{#if invitationUrl}<p>Einladung für die Theateradministration. Dieser Link ist einmal verwendbar und sieben Tage gültig.</p><input readonly value={invitationUrl} aria-label="Einladungslink für die Theateradministration"/>{/if}</section>{/if}
</div>
{#if platformAdmin&&!compact}<PlatformConsole/>{/if}
