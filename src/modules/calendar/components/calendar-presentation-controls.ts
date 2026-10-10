import {writable,get} from 'svelte/store';import {onDestroy} from 'svelte';
export {default as CalendarPresentationControls} from './calendar-presentation-controls.CalendarPresentationControls.svelte';
export function useCalendarPresentation(root:()=>{current:HTMLDivElement|null}){
 let restore=()=>{};let returnFocus:HTMLElement|null=null;const flags={collapsed:false,fullscreen:false};
 const state=writable({...flags,toggleFilters:()=>{flags.collapsed=!flags.collapsed;publish();},toggleFullscreen:()=>{flags.fullscreen=!flags.fullscreen;apply();publish();},exitFullscreen:()=>{flags.fullscreen=false;apply();publish();}});
 const publish=()=>state.update(value=>({...value,...flags}));
 function apply(){restore();if(!flags.fullscreen)return;const element=root().current;if(!element)return;returnFocus=document.activeElement as HTMLElement;const previous=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';const outside:{element:HTMLElement;inert:boolean}[]=[];let branch:HTMLElement=element;while(branch.parentElement&&branch.parentElement!==document.body){for(const sibling of branch.parentElement.children)if(sibling!==branch&&sibling instanceof HTMLElement){outside.push({element:sibling,inert:sibling.inert});sibling.inert=true;}branch=branch.parentElement;}const exit=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]')){flags.fullscreen=false;apply();publish();}};document.addEventListener('keydown',exit);restore=()=>{document.documentElement.style.overflow=previous;outside.forEach(s=>s.element.inert=s.inert);document.removeEventListener('keydown',exit);returnFocus?.focus({preventScroll:true});restore=()=>{};};}
 onDestroy(()=>restore());return state;
}
