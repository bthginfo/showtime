import { onMount, onDestroy, tick } from 'svelte';
import { readable } from 'svelte/store';
import { browser } from '$app/environment';
let nextId=0;
export const initialState=<T>(value:T):T=>value;
export const createId=()=>'showtime-control-'+ ++nextId;
type Cleanup=void|(()=>void);
type Effect={fn:()=>Cleanup;deps?:unknown[];cleanup?:Cleanup;revision:number};
export function createEffects(){
 const effects=new Map<number,Effect>();let mounted=false;
 const execute=(e:Effect)=>{if(typeof e.cleanup==='function')e.cleanup();e.cleanup=e.fn();};
 onMount(()=>{mounted=true;for(const e of effects.values())execute(e);});
 onDestroy(()=>{mounted=false;for(const e of effects.values())if(typeof e.cleanup==='function')e.cleanup();effects.clear();});
 return {run(id:number,fn:()=>Cleanup,deps?:unknown[]){
  const previous=effects.get(id);
  if(previous&&deps&&previous.deps&&deps.length===previous.deps.length&&deps.every((x,i)=>Object.is(x,previous.deps![i])))return;
  const effect:Effect={fn,deps,cleanup:previous?.cleanup,revision:(previous?.revision||0)+1};
  effects.set(id,effect);
  if(mounted)void tick().then(()=>{if(mounted&&effects.get(id)===effect)execute(effect);});
 }};
}
export function externalStore<T>(subscribe:(callback:()=>void)=>()=>void,snapshot:()=>T,serverSnapshot?:()=>T){
 return readable(browser?snapshot():serverSnapshot?.() as T,set=>{
  if(!browser)return;const update=()=>set(snapshot());const unsubscribe=subscribe(update);update();return unsubscribe;
 });
}
export function styleString(style:Record<string,string|number|undefined|null>|string|undefined){
 if(!style)return '';if(typeof style==='string')return style;
 const unitless=new Set(['opacity','zIndex','fontWeight','order','flex','flexGrow','flexShrink','lineHeight','scale','gridColumn','gridRow']);
 return Object.entries(style).filter(([,v])=>v!==null&&v!==undefined).map(([k,v])=>{
  const key=k.startsWith('--')?k:k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
  const value=typeof v==='number'&&v!==0&&!unitless.has(k)&&!k.startsWith('--')?v+'px':v;
  return key+':'+value;
 }).join(';');
}
export function applyRef<T extends HTMLElement>(node:T,ref:((node:T|null)=>void)|{current:T|null}){
 if(typeof ref==='function')ref(node);else ref.current=node;
 return {destroy(){if(typeof ref==='function')ref(null);else ref.current=null;}};
}
