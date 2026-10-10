<script lang="ts">
 import {onDestroy} from 'svelte';
 import {writable,get} from 'svelte/store';
 import {createDnd,type DndState} from './dnd';
 export let sensors:any=undefined;
 export let onDragStart:(event:any)=>void=()=>{};
 export let onDragMove:(event:any)=>void=()=>{};
 export let onDragEnd:(event:any)=>void=()=>{};
 export let onDragCancel:(event:any)=>void=()=>{};
 export let collisionDetection:any=undefined;
 export let autoScroll=true;
 export let accessibility:any=undefined;
 const empty=():DndState=>({id:null,over:null,x:0,y:0,point:{x:0,y:0},rectangle:null});
 const state=writable(empty());const drags=new Map<string,any>(),drops=new Map<string,any>();let cleanup=()=>{};let announcement='';
 const eventShape=(active:any,event:Event)=>{const s=get(state),over=s.over?drops.get(s.over):null;return {active,over:over?{id:over.id,data:{current:over.data}}:null,delta:{x:s.x,y:s.y},activatorEvent:event};};
 function start(event:PointerEvent|KeyboardEvent,item:any){
  if(event instanceof KeyboardEvent){
   if(sensors&&!sensors.some((s:any)=>s.sensor==='keyboard')||![' ','Enter'].includes(event.key))return;
   event.preventDefault();cleanup();const targets=[...drops.values()].filter(d=>d.node);let index=Math.max(0,targets.findIndex(d=>d.node.contains(item.node)));const rectangle=item.node.getBoundingClientRect();
   const active={id:item.id,data:{current:item.data},rect:{current:{initial:rectangle,translated:rectangle}}};
   state.set({...empty(),id:item.id,over:targets[index]?.id||null,rectangle});onDragStart(eventShape(active,event));announcement='Verschieben begonnen.';
   const finish=()=>{window.removeEventListener('keydown',key);state.set(empty());};
   const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();onDragCancel(eventShape(active,event));finish();announcement='Verschieben abgebrochen.';}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&targets.length){e.preventDefault();index=(index+(e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:1)+targets.length)%targets.length;state.update(s=>({...s,over:targets[index]?.id||null}));announcement='Ziel '+(targets[index]?.node.textContent?.trim().slice(0,80)||'');}else if([' ','Enter'].includes(e.key)){e.preventDefault();onDragEnd(eventShape(active,event));finish();announcement='Verschieben abgeschlossen.';}};
   window.addEventListener('keydown',key);cleanup=finish;return;
  }
  if(event.button!==0)return;cleanup();const origin={x:event.clientX,y:event.clientY};let activated=false;let hold:ReturnType<typeof setTimeout>|undefined;const rectangle=item.node.getBoundingClientRect();
  const active={id:item.id,data:{current:item.data},rect:{current:{initial:rectangle,translated:rectangle}}};
  const activate=()=>{activated=true;state.set({...empty(),id:item.id,point:origin,rectangle});onDragStart(eventShape(active,event));announcement='Verschieben begonnen.';};
  const constraint=sensors?.find((s:any)=>s.sensor===(event.pointerType==='touch'?'touch':'mouse')||s.sensor==='pointer')?.options?.activationConstraint;
  if(event.pointerType==='touch')hold=setTimeout(activate,constraint?.delay||350);
  const move=(e:PointerEvent)=>{
   const delta={x:e.clientX-origin.x,y:e.clientY-origin.y};
   if(!activated){if(event.pointerType==='touch'&&Math.hypot(delta.x,delta.y)>(constraint?.tolerance||8)){finish();return;}if(event.pointerType!=='touch'&&Math.hypot(delta.x,delta.y)>=(constraint?.distance||6))activate();}
   if(!activated)return;e.preventDefault();let over:any=null;
   for(const drop of drops.values()){if(!drop.node)continue;const r=drop.node.getBoundingClientRect();if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom)over=drop;}
   active.rect.current.translated={...rectangle,x:rectangle.x+delta.x,y:rectangle.y+delta.y,left:rectangle.left+delta.x,top:rectangle.top+delta.y,right:rectangle.right+delta.x,bottom:rectangle.bottom+delta.y};
   state.set({id:item.id,over:over?.id||null,...delta,point:{x:e.clientX,y:e.clientY},rectangle});onDragMove(eventShape(active,event));
   if(autoScroll){const scroll=document.elementFromPoint(e.clientX,e.clientY)?.closest('.kanban');if(scroll){const r=scroll.getBoundingClientRect();if(e.clientX>r.right-35)scroll.scrollLeft+=12;else if(e.clientX<r.left+35)scroll.scrollLeft-=12;}}
  };
  const end=()=>{if(activated){onDragEnd(eventShape(active,event));announcement='Verschieben abgeschlossen.';}finish();};
  const cancel=()=>{if(activated){onDragCancel(eventShape(active,event));announcement='Verschieben abgebrochen.';}finish();};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();cancel();}};
  const finish=()=>{clearTimeout(hold);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',key);state.set(empty());};cleanup=finish;
  window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',end,{once:true});window.addEventListener('pointercancel',cancel,{once:true});window.addEventListener('keydown',key);
 }
 createDnd({state,drags,drops,start});onDestroy(()=>cleanup());
</script>
<slot />
<span class="visually-hidden" aria-live="polite">{announcement}</span>
