import type {Member} from './contracts';
import type {Permission} from '@/platform/access';
import {anyPermission} from './access-policy';
const needs:Record<string,Permission[]>={
 theater:['production.read','tenant.configure'],productions:['production.read'],calendar:['schedule.read'],tasks:['production.read'],
 time:['time.own','time.team.read'],chat:['chat.read'],people:['production.read'],actors:['production.read'],documentation:['document.read'],
 inventory:['inventory.read'],handovers:['document.read'],exports:['production.read','schedule.read','time.own','document.read'],
};
export function visibleNavigation<T extends {id:string}>(items:T[],member:Member):T[]{
 return items.filter(item=>!needs[item.id]||needs[item.id].some(permission=>anyPermission(member,permission)));
}
