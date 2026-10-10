import {functionalStore,type FunctionalStore} from './client-storage';
import {scopedBrowserKey} from './browser-scope';
export function useCollapsedPreference<T=boolean>(key:string,defaultCollapsed=false):FunctionalStore<boolean>{const scoped=scopedBrowserKey(key);let initial=defaultCollapsed;try{const stored=localStorage.getItem(scoped);if(stored!==null)initial=stored==='collapsed';}catch{}return functionalStore(initial,value=>{try{localStorage.setItem(scoped,value?'collapsed':'expanded');}catch{}});}
