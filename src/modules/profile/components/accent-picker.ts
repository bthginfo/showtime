import type {AccentPalette} from '@/shared/contracts';
export const paletteNames:Record<AccentPalette,string>={green:'Salbei',lavender:'Lavendel',peach:'Pfirsich',sky:'Himmel',rose:'Rosé',sand:'Sand'};
export {default as AccentPicker} from './accent-picker.AccentPicker.svelte';
export {default as ProfileAccent} from './profile-accent.svelte';
export function useAccentPreview(palette:AccentPalette){const previous=document.documentElement.dataset.accent,owner=document.documentElement.dataset.accentOwner;document.documentElement.dataset.accent=palette;return()=>{if(document.documentElement.dataset.accentOwner===owner)document.documentElement.dataset.accent=previous||'green';};}
