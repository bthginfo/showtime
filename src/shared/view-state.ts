import {functionalStore,type FunctionalStore} from './client-storage';
import {scopedBrowserKey} from './browser-scope';
export const viewStateKey=(userId:string,scope:string,field:string)=>scopedBrowserKey(`view:${userId}:${scope}:${field}`);
export function readViewState<T>(userId:string,scope:string,field:string,fallback:T):T{try{const stored=sessionStorage.getItem(viewStateKey(userId,scope,field));if(stored===null)return fallback;const parsed=JSON.parse(stored);if(parsed===null)return fallback===null?parsed:fallback;if(Array.isArray(fallback))return Array.isArray(parsed)?parsed as T:fallback;return typeof parsed===typeof fallback?parsed:fallback;}catch{return fallback;}}
export function writeViewState<T>(userId:string,scope:string,field:string,value:T){try{sessionStorage.setItem(viewStateKey(userId,scope,field),JSON.stringify(value));}catch{}}
export function useViewState<T>(userId:string,scope:string,field:string,initial:T|(()=>T)):FunctionalStore<T>{const fallback=typeof initial==='function'?(initial as()=>T)():initial;return functionalStore(readViewState(userId,scope,field,fallback),value=>writeViewState(userId,scope,field,value));}
