import {writable,type Writable} from 'svelte/store';
import {scopedBrowserKey} from './browser-scope';
export type FunctionalStore<T>=Omit<Writable<T>,'set'> & {set:(value:T|((current:T)=>T))=>void};
export function functionalStore<T>(initial:T,persist?:(value:T)=>void):FunctionalStore<T>{const store=writable(initial);return {...store,set(next){store.update(value=>{const result=typeof next==='function'?(next as (current:T)=>T)(value):next;persist?.(result);return result;});}};}
export const preferenceKey=(key:string)=>key==='digitalmask-theme'?'showtime-theme':scopedBrowserKey(key);
export function useStoredValue<T=string>(key:string,fallback:T):FunctionalStore<T>{
 const physical=preferenceKey(key);const read=()=>{try{const value=localStorage.getItem(physical);return value===null?fallback:value as T;}catch{return fallback;}};
 const store=writable(read(),set=>{if(typeof window==='undefined')return;const changed=()=>set(read());window.addEventListener('storage',changed);window.addEventListener('digitalmask-storage',changed);return()=>{window.removeEventListener('storage',changed);window.removeEventListener('digitalmask-storage',changed);};});
 return {...store,set(next){store.update(current=>{const value=typeof next==='function'?(next as (current:T)=>T)(current):next;try{localStorage.setItem(physical,String(value));queueMicrotask(()=>window.dispatchEvent(new Event('digitalmask-storage')));}catch{}return value;});}};
}
export function subscribeConnectivity(callback:()=>void){window.addEventListener('online',callback);window.addEventListener('offline',callback);return()=>{window.removeEventListener('online',callback);window.removeEventListener('offline',callback);};}
export function subscribeLocation(callback:()=>void){window.addEventListener('popstate',callback);return()=>window.removeEventListener('popstate',callback);}
export function subscribeMobile(callback:()=>void){const media=window.matchMedia('(max-width: 760px)');media.addEventListener('change',callback);return()=>media.removeEventListener('change',callback);}
