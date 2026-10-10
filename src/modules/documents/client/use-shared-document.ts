import {readable} from 'svelte/store';
import {SharedDocument,type DocumentSnapshot} from './shared-document';
const loading:DocumentSnapshot={session:null,status:'loading',connected:false,pending:false,localReady:false,error:''};
export function useSharedDocument(input:()=>{fileId:string;userId:string}){
 return readable<{client:SharedDocument|null}&DocumentSnapshot>({client:null,...loading},set=>{
  const {fileId,userId}=input();const client=new SharedDocument(fileId,userId);let stopped=false;
  const refresh=()=>{if(!stopped)set({client,...client.getSnapshot()});};const unsubscribe=client.subscribe(refresh);void client.start().then(refresh).catch(refresh);
  return()=>{stopped=true;unsubscribe();client.destroy();};
 });
}
