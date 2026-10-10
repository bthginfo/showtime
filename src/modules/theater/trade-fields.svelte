<script lang="ts">
 import type {Field} from './registry';import type {Planning} from './types';import {useWorkspace} from '@/components/workspace-context';import {localDateTime} from '@/shared/client-api';
 export let fields:Field[]=[];export let data:Record<string,unknown>={};export let planning:Planning;export let productionId='';export let update:(key:string,value:unknown)=>void;
 const store=useWorkspace();$: workspace=$store.workspace;
 const text=(key:string)=>String(data[key]??'');
 const choices=(key:string)=>Array.isArray(data[key])?data[key] as string[]:[];
</script>
{#each fields as field (field.key)}
 {#if field.type==='members'}<fieldset class="form-multi full"><legend>{field.label}</legend>{#each workspace.members.filter(m=>m.status==='active') as member (member.id)}<label class="check-label"><input type="checkbox" checked={choices(field.key).includes(member.id)} on:change={e=>update(field.key,e.currentTarget.checked?[...choices(field.key),member.id]:choices(field.key).filter(id=>id!==member.id))}/>{member.name}</label>{/each}</fieldset>
 {:else}<label class:full={field.type==='textarea'}>{field.label}
  {#if field.type==='textarea'}<textarea value={text(field.key)} maxlength="10000" on:input={e=>update(field.key,e.currentTarget.value)} required={field.required}></textarea>
  {:else if field.type==='select'}<select value={text(field.key)} on:change={e=>update(field.key,e.currentTarget.value)} required={field.required}><option value="">Bitte wählen</option>{#each field.options||[] as option (option)}<option>{option}</option>{/each}</select>
  {:else if field.type==='checkbox'}<input type="checkbox" checked={Boolean(data[field.key])} on:change={e=>update(field.key,e.currentTarget.checked)}/>
  {:else if ['member','resource','record','department','budget'].includes(field.type)}<select value={text(field.key)} on:change={e=>update(field.key,e.currentTarget.value)} required={field.required}><option value="">{field.type==='department'?'Gesamtes Theater':'Bitte wählen'}</option>
   {#if field.type==='member'}{#each workspace.members as member (member.id)}<option value={member.id}>{member.name}</option>{/each}
   {:else if field.type==='resource'}{#each planning.resources as resource (resource.id)}<option value={resource.id}>{resource.name}</option>{/each}
   {:else if field.type==='department'}{#each planning.departments as department (department.id)}<option value={department.id}>{department.name}</option>{/each}
   {:else if field.type==='budget'}{#each planning.funding.filter(b=>b.productionId===(productionId||null)) as budget (budget.id)}<option value={budget.id}>{budget.title}{budget.costCentre?' · '+budget.costCentre:''}</option>{/each}
   {:else if field.type==='record'&&field.source}{#each workspace.records[field.source].filter(r=>!r.data.productionId||r.data.productionId===productionId) as record (record.id)}<option value={record.id}>{String(record.data.title||record.data.name||record.id)}</option>{/each}{/if}
  </select>
  {:else}<input type={field.type==='number'?'number':field.type==='datetime'?'datetime-local':field.type==='date'?'date':'text'} step={field.key==='amountCents'?'1':'any'} value={field.type==='datetime'&&text(field.key)?localDateTime(text(field.key)):text(field.key)} maxlength="500" on:input={e=>update(field.key,field.type==='number'?(e.currentTarget.value===''?undefined:Number(e.currentTarget.value)):field.type==='datetime'&&e.currentTarget.value?new Date(e.currentTarget.value).toISOString():e.currentTarget.value)} required={field.required}/>{/if}
 </label>{/if}
{/each}
