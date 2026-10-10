<script lang="ts">
 import {SavedAppointment,type Props} from './saved-timetable';import styles from './mask-plans.module.css';
 import {maskPlanWindow,maskPlanStaffNames,maskPlanClock} from '../model';import {maskPlanTracks} from '../layout';
 export let plan:Props['plan'];export let members:Props['members'];export let actors:Props['actors'];export let performanceTime:Props['performanceTime'];export let productionColor:Props['productionColor'];export let onEditLane:Props['onEditLane'];export let onEditBlock:Props['onEditBlock'];
 $: start=maskPlanWindow(plan).start;
 $: interval=Math.max(plan.stepMinutes,Math.ceil(-start/(12*plan.stepMinutes))*plan.stepMinutes);
 $: boundaries=(()=>{const points=[start,0];for(let minute=start+interval;minute<0;minute+=interval)points.push(minute);for(const block of plan.blocks)points.push(block.startMinutes,block.startMinutes+block.durationMinutes);return [...new Set(points)].sort((a,b)=>a-b);})();
 $: lanes=plan.lanes.map((lane,index)=>{const blocks=plan.blocks.filter(b=>b.laneId===lane.id),positions=maskPlanTracks(blocks),count=Math.max(1,...[...positions.values()].map(p=>p.count)),names=maskPlanStaffNames(lane,members);return {lane,blocks,positions,count,names,title:names.join(' / ')||lane.label||`Spalte ${index+1}`};});
 $: railWidth=performanceTime?56:44;
 $: minimumWidth=lanes.reduce((total,lane)=>total+Math.max(124,lane.count*100),railWidth);
 $: preferredWidth=Math.max(320,lanes.length*250+railWidth,minimumWidth);
 function cells(lane:typeof lanes[number],minute:number,rowIndex:number){const result=[];for(let track=0;track<lane.count;track++){const block=lane.blocks.find(b=>b.startMinutes<=minute&&b.startMinutes+b.durationMinutes>minute&&(lane.positions.get(b.id)!.count===1||lane.positions.get(b.id)!.track===track));if(block&&block.startMinutes!==minute)continue;const span=block&&lane.positions.get(block.id)!.count===1?lane.count:1;result.push({track,block,span,rowSpan:block?boundaries.indexOf(minute+block.durationMinutes)-rowIndex:1});track+=span-1;}return result;}
</script>
<div class={styles.savedTimetable} style={`--time-rail:${railWidth}px;--saved-min-width:${minimumWidth}px;--saved-preferred-width:${preferredWidth}px`} data-compact="true" tabindex="0" role="region" aria-label="Maskenplan-Zeittabelle, horizontal und vertikal scrollbar">
 <table class={styles.savedSheet} aria-label={`Maskenplan: ${plan.title}`}>
  <colgroup><col class={styles.savedRailColumn}/></colgroup>
  {#each lanes as {lane,count}}<colgroup>{#each Array(count) as _,index}<col style={`width:calc((100% - var(--time-rail)) / ${lanes.length*count})`}/>{/each}</colgroup>{/each}
  <thead><tr><th class={styles.savedCorner} scope="col">MIN.</th>{#each lanes as {lane,count,names,title} (lane.id)}<th colspan={count} scope="colgroup" data-mask-header><button type="button" class={styles.savedStaff} on:click={()=>onEditLane(lane)} aria-label={`Personalspalte bearbeiten: ${title}`}>{#if lane.label&&names.length}<span>{lane.label}</span>{/if}<strong>{title}</strong></button></th>{/each}</tr></thead>
  <tbody>{#each boundaries.slice(0,-1) as minute,rowIndex (minute)}<tr><th class={`${styles.timeRail} ${styles.savedTime}`} scope="row" data-mask-rail><strong>{minute}</strong>{#if performanceTime}<span>{maskPlanClock(minute,performanceTime)}</span>{/if}</th>{#each lanes as lane}{#each cells(lane,minute,rowIndex) as cell (cell.track)}{#if cell.block}<td data-mask-block={cell.block.id} rowspan={cell.rowSpan} colspan={cell.span} class={styles.savedCell} style={`--block-color:${/^#[0-9a-f]{6}$/i.test(cell.block.color||productionColor)?cell.block.color||productionColor:'#83c6a5'}`}><SavedAppointment block={cell.block} {actors} {performanceTime} onEdit={()=>onEditBlock(cell.block!)} /></td>{:else}<td aria-hidden="true"/>{/if}{/each}{/each}</tr>{/each}</tbody>
  <tfoot><tr><th class={`${styles.timeRail} ${styles.savedZero}`} scope="row" data-mask-zero><strong>0</strong>{#if performanceTime}<span>{performanceTime}</span>{/if}</th>{#each lanes as {lane,count} (lane.id)}<td colspan={count} class={styles.savedBegin}>Beginn</td>{/each}</tr></tfoot>
 </table>
</div>
