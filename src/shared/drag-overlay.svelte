<script lang="ts">
 import {styleString} from './svelte-runtime';import {dndController} from './dnd';
 export let style={};const controller=dndController(),state=controller.state;
</script>
{#if $state.id&&$state.rectangle}<div class="showtime-drag-overlay" style={styleString({position:'fixed',pointerEvents:'none',zIndex:1000,left:$state.rectangle.left+$state.x,top:$state.rectangle.top+$state.y,width:$state.rectangle.width,...style})}><slot /></div>{/if}
