import {allowedPermissions,type Grant,type TheaterRole} from '@/platform/access';
import type {Member} from '@/shared/contracts';
import type {Context} from '@/platform/context';
export function memberFixture(id:string,roles:TheaterRole[]=['employee'],departmentId='makeup'):Member{
 const grants:Grant[]=roles.map(role=>({role,scope:'department',scopeId:departmentId}));
 return {id,name:id,username:id,status:'active',role:roles.includes('team_lead')?'admin':'user',departmentId,grants,permissions:allowedPermissions({id,grants},{departmentId})};
}
export function contextFixture(id='owner',roles:TheaterRole[]=['employee'],departmentId='makeup',organizationId='theatre'):Context{
 const user=memberFixture(id,roles,departmentId);
 return {user,grants:user.grants!,departmentId,organizationId,organizationName:'Testtheater',departmentName:'Testgewerk'};
}
