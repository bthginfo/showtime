import {onMount} from 'svelte';
import {get} from 'svelte/store';
import {useWorkspace} from '@/components/workspace-context';
import {value} from '@/shared/client-api';
import {isChatNotice} from './unread';
export function useChatRead(input:()=>{conversationId:string;productionId:string;endRef?:{current:HTMLElement|null}}){
 const workspaceStore=useWorkspace();
 onMount(()=>{let attempted='';const timer=setInterval(()=>{
  if(document.hidden||!document.hasFocus())return;const {conversationId,productionId,endRef}=input();
  if(endRef?.current){const rect=endRef.current.getBoundingClientRect();if(rect.bottom<0||rect.top>innerHeight)return;}
  const {workspace,action}=get(workspaceStore);const ids=workspace.records.notifications.filter(n=>!n.data.read&&n.data.userId===workspace.user.id&&isChatNotice(n)&&value(n.data,'conversationId')===conversationId&&(conversationId||value(n.data,'productionId')===productionId)).map(n=>n.id).sort().join(',');
  if(!ids||ids===attempted)return;attempted=ids;void action('chat-notifications-read',undefined,{conversationId,productionId}).catch(()=>{attempted='';});
 },600);return()=>clearInterval(timer);});
}
