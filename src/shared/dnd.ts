import {getContext,setContext,onDestroy} from 'svelte';
import {writable,derived,type Writable} from 'svelte/store';
export {default as DndContext} from './dnd-context.svelte';
export {default as DragOverlay} from './drag-overlay.svelte';
export type DragEndEvent=any;export type DragStartEvent=any;export type DragMoveEvent=any;
export const PointerSensor='pointer',MouseSensor='mouse',TouchSensor='touch',KeyboardSensor='keyboard';
export const closestCenter=()=>{};export const pointerWithin=()=>{};
export const useSensor=(sensor:unknown,options?:unknown)=>({sensor,options});export const useSensors=(...sensors:unknown[])=>sensors;
const key=Symbol('showtime.dnd');
type Item={id:string;data:any;node:HTMLElement};
export type DndState={id:string|null;over:string|null;x:number;y:number;point:{x:number;y:number};rectangle:DOMRect|null};
export type DndController={state:Writable<DndState>;drags:Map<string,Item>;drops:Map<string,Item>;start:(event:PointerEvent|KeyboardEvent,item:Item)=>void;instructionsId?:string};
export const createDnd=(controller:DndController)=>setContext(key,controller);
export const dndController=()=>getContext<DndController>(key);
export function useDraggable(options:()=>{id:string;data?:unknown;disabled?:boolean}){
 const context=getContext<DndController>(key);let node:HTMLElement|null=null;const setNodeRef=(next:HTMLElement|null)=>{node=next;const o=options();if(!next){context.drags.delete(String(o.id));return;}context.drags.set(String(o.id),{id:String(o.id),node:next,data:o.data});};
 onDestroy(()=>{context.drags.delete(String(options().id));});
 return derived(context.state,state=>{const o=options();const start=(event:PointerEvent|KeyboardEvent)=>{const current=options();if(!current.disabled&&node)context.start(event,{id:String(current.id),node,data:current.data});};return {setNodeRef,attributes:{tabindex:0,'aria-grabbed':state.id===String(o.id),'aria-describedby':context.instructionsId},listeners:{onpointerdown:start,onkeydown:start},isDragging:state.id===String(o.id),transform:state.id===String(o.id)?{x:state.x,y:state.y}:null};});
}
export function useDroppable(options:()=>{id:string;data?:unknown}){
 const context=getContext<DndController>(key);const setNodeRef=(node:HTMLElement|null)=>{const o=options();if(!node){context.drops.delete(String(o.id));return;}context.drops.set(String(o.id),{id:String(o.id),node,data:o.data});};onDestroy(()=>context.drops.delete(String(options().id)));
 return derived(context.state,state=>({setNodeRef,isOver:state.over===String(options().id)}));
}
