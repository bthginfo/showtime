import {applicationURL} from '@/platform/application-url';
import {and,eq,sql} from 'drizzle-orm';
import {randomBytes,createHash} from 'node:crypto';
import {db} from '@/platform/db';
import {memberships,tenantMembers,permissionGrants,records,calendarTokens,tenantSettings} from '@/platform/db/schema';
import {requirePermission,type Context} from '@/platform/context';
import {HttpError} from '@/platform/http';
import {auditChange} from '@/platform/events';
import {findRecord,serialize} from '@/modules/records/repository';
import {invalidateWorkspace} from '@/modules/records/workspace';
import {assertRead} from '@/modules/records/service';
import {roleKeys,canDelegate,type TheaterRole} from '@/platform/access';
import type {RecordData} from '@/shared/contracts';
export async function organizationAction(context:Context,action:string,id:string|undefined,data:RecordData){
 if(action==='calendar-token'){
  const token=randomBytes(32).toString('base64url');
  await db.delete(calendarTokens).where(and(eq(calendarTokens.userId,context.user.id),eq(calendarTokens.departmentId,context.departmentId)));
  if(!data.revoke)await db.insert(calendarTokens).values({id:crypto.randomUUID(),userId:context.user.id,departmentId:context.departmentId,tokenHash:createHash('sha256').update(token).digest('hex')});
  return {url:data.revoke?null:`${applicationURL()}/api/calendar/${token}`};
 }
 if(action==='notification-read'){
  if(!id)throw new HttpError(400,'Eintrag fehlt.');const row=await findRecord(context,id,'notifications');await assertRead(context,row);
  const [saved]=await db.update(records).set({data:{...row.data,read:true},version:row.version+1}).where(eq(records.id,id)).returning();return serialize(saved);
 }
 if(action==='password-reset')throw new HttpError(403,'Theaterrollen verwalten keine theaterübergreifenden Zugangsdaten.');
 requirePermission(context,'members.manage');if(!id)throw new HttpError(400,'Bitte wähle eine Person.');
 const [member]=await db.select().from(memberships).where(and(eq(memberships.userId,id),eq(memberships.departmentId,context.departmentId))).limit(1);if(!member)throw new HttpError(404,'Die Person wurde nicht gefunden.');
 if(action!=='member-update')throw new HttpError(400,'Unbekannte Aktion.');
 if(id===context.user.id&&data.status&&data.status!=='active')throw new HttpError(409,'Den eigenen Zugang kannst du hier nicht deaktivieren.');
 if(data.status&&!['active','pending','disabled'].includes(String(data.status)))throw new HttpError(400,'Ungültiger Status.');
 await db.update(memberships).set({status:(data.status||member.status) as typeof member.status}).where(eq(memberships.id,member.id));
 if(data.status==='disabled')await db.delete(permissionGrants).where(and(eq(permissionGrants.userId,id),eq(permissionGrants.scope,'department'),eq(permissionGrants.scopeId,context.departmentId)));
 if(id===context.user.id&&data.tenantStatus&&data.tenantStatus!=='active')throw new HttpError(409,'Den eigenen Theaterzugang kannst du hier nicht deaktivieren.');
 if(data.tenantStatus){if(!['active','pending','disabled'].includes(String(data.tenantStatus)))throw new HttpError(400,'Ungültiger Status.');await db.update(tenantMembers).set({status:data.tenantStatus as 'active',version:sql`${tenantMembers.version}+1`}).where(and(eq(tenantMembers.organizationId,context.organizationId),eq(tenantMembers.userId,id)));}
 if(data.role){
  requirePermission(context,'roles.assign');const role=String(data.role);
  if(!roleKeys.includes(role as TheaterRole))throw new HttpError(400,'Bitte wähle eine Theaterrolle.');
  if(!canDelegate({id:context.user.id,grants:context.grants},{role:role as TheaterRole,scope:'department',scopeId:context.departmentId}))throw new HttpError(403,'Keine Berechtigung für diese Rollenzuweisung.');
  await db.delete(permissionGrants).where(and(eq(permissionGrants.userId,id),eq(permissionGrants.organizationId,context.organizationId),eq(permissionGrants.scope,'department'),eq(permissionGrants.scopeId,context.departmentId)));
  if(role==='guest')throw new HttpError(400,'Gäste werden mit Ablaufdatum einer konkreten Produktion zugeordnet.');
  await db.insert(permissionGrants).values({organizationId:context.organizationId,userId:id,role:role as TheaterRole,scope:'department',scopeId:context.departmentId});
 }
 await db.update(tenantSettings).set({permissionVersion:sql`${tenantSettings.permissionVersion}+1`}).where(eq(tenantSettings.organizationId,context.organizationId));
 await auditChange(db as never,context,'member.updated',id);invalidateWorkspace(context.departmentId);return {ok:true};
}
