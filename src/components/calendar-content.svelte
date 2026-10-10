<script lang="ts">import type {Snippet} from 'svelte';export let render:Snippet<[any]>;export let info:any;</script>
{@render render(info)}
