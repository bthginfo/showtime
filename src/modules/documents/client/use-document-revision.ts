import {readable} from 'svelte/store';
import type * as Y from 'yjs';
export function useDocumentRevision(doc:Y.Doc){return readable(0,set=>{let revision=0;const changed=()=>set(++revision);doc.on('afterTransaction',changed);return()=>doc.off('afterTransaction',changed);});}
