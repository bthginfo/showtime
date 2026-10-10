<script lang="ts">
 import {Calendar,type CalendarOptions} from '@fullcalendar/core';import {onMount,mount,unmount,getAllContexts,flushSync,type Snippet} from 'svelte';import CalendarContent from './calendar-content.svelte';
 export let eventContent:Snippet<[any]>|undefined=undefined;
 export let dayHeaderContent:Snippet<[any]>|undefined=undefined;
 export let dayCellContent:Snippet<[any]>|undefined=undefined;
 export let eventContentWhen:(info:any)=>boolean=()=>true;
 let element:HTMLDivElement;let calendar:Calendar;const context=getAllContexts();
 // This registry tracks imperative FullCalendar mounts; it is not rendered state.
 // eslint-disable-next-line svelte/prefer-svelte-reactivity
 const renderers=new Map<HTMLElement,ReturnType<typeof mount>>();
 export function getApi(){return calendar;}
 function render(content:Snippet<[any]>,info:any){const node=document.createElement('div');const instance=mount(CalendarContent,{target:node,context,props:{render:content,info}});flushSync();renderers.set(node,instance);return {domNodes:[node]};}
 function dispose(container?:HTMLElement){for(const [node,instance] of renderers){if(container?container.contains(node):!element.contains(node)){renderers.delete(node);void unmount(instance);}}}
 function options():CalendarOptions{const rest=$$restProps as CalendarOptions;return {...rest,
  eventContent:eventContent?(info:any)=>eventContentWhen(info)?render(eventContent!,info):true:undefined,
  dayHeaderContent:dayHeaderContent?(info:any)=>render(dayHeaderContent!,info):undefined,
  dayCellContent:dayCellContent?(info:any)=>render(dayCellContent!,info):undefined,
  eventWillUnmount:(info)=>{dispose(info.el);rest.eventWillUnmount?.(info);},
  dayHeaderWillUnmount:(info)=>{dispose(info.el);rest.dayHeaderWillUnmount?.(info);},
  dayCellWillUnmount:(info)=>{dispose(info.el);rest.dayCellWillUnmount?.(info);}
 };}
 onMount(()=>{calendar=new Calendar(element,options());calendar.render();const observer=new MutationObserver(()=>dispose());observer.observe(element,{subtree:true,childList:true});return()=>{observer.disconnect();calendar.destroy();for(const instance of renderers.values())void unmount(instance);renderers.clear();};});
 $: if(calendar){void $$restProps;calendar.resetOptions(options());}
</script>
<div bind:this={element}></div>
