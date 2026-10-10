import {createHash} from 'node:crypto';
import {and,eq,inArray,sql} from 'drizzle-orm';
import webpush from 'web-push';
import {db} from '@/platform/db';
import {pushSubscriptions,records} from '@/platform/db/schema';
import type {Context} from '@/platform/context';
import {HttpError} from '@/platform/http';
import {activeSubjects} from '@/platform/worker-subjects';
import {noticeReadable} from './access';
import {subscriptionSchema} from './schema';
import {pushPayload} from './payload';
export const pushConfigured=()=>Boolean(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT);
export const subscriptionId=(endpoint:string,organizationId:string,userId:string)=>createHash('sha256').update(JSON.stringify([organizationId,userId,endpoint])).digest('hex');
export function departmentDevices(departmentId:string){return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.departmentId,departmentId));}
export async function subscribeDevice(context:Context,input:unknown){
 if(!pushConfigured())throw new HttpError(503,'Mitteilungen werden gerade eingerichtet.');
 const subscription=subscriptionSchema.parse(input),id=subscriptionId(subscription.endpoint,context.organizationId,context.user.id);
 await db.transaction(async tx=>{
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${context.organizationId+':push:'+context.user.id}))`);
  const own=await tx.select({id:pushSubscriptions.id}).from(pushSubscriptions).where(and(eq(pushSubscriptions.organizationId,context.organizationId),eq(pushSubscriptions.userId,context.user.id)));
  if(own.length>=10&&!own.some(d=>d.id===id))throw new HttpError(409,'Du hast bereits zehn Geräte aktiviert. Deaktiviere zuerst ein anderes Gerät.');
  await tx.insert(pushSubscriptions).values({id,organizationId:context.organizationId,userId:context.user.id,departmentId:context.departmentId,endpoint:subscription.endpoint,keys:subscription.keys}).onConflictDoUpdate({target:pushSubscriptions.id,set:{departmentId:context.departmentId,keys:subscription.keys,updatedAt:new Date()}});
 });
}
export async function unsubscribeDevice(context:Context,endpoint:string){await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.organizationId,context.organizationId),eq(pushSubscriptions.id,subscriptionId(endpoint,context.organizationId,context.user.id)),eq(pushSubscriptions.userId,context.user.id)));}
async function send(device:typeof pushSubscriptions.$inferSelect,payload:ReturnType<typeof pushPayload>){
 try{await webpush.sendNotification({endpoint:device.endpoint,keys:device.keys},JSON.stringify(payload),{vapidDetails:{subject:process.env.VAPID_SUBJECT!,publicKey:process.env.VAPID_PUBLIC_KEY!,privateKey:process.env.VAPID_PRIVATE_KEY!},TTL:3600,timeout:8000,urgency:'normal',topic:createHash('sha256').update(payload.tag).digest('base64url').slice(0,32)});}
 catch(e){const status=(e as {statusCode?:number}).statusCode;if(status===404||status===410){await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.id,device.id),eq(pushSubscriptions.organizationId,device.organizationId),eq(pushSubscriptions.userId,device.userId),eq(pushSubscriptions.updatedAt,device.updatedAt)));return false;}throw new Error('Mitteilungsdienst vorübergehend nicht erreichbar.');}return true;
}
export async function testDevice(context:Context,endpoint:string){
 const [device]=await db.select().from(pushSubscriptions).where(and(eq(pushSubscriptions.organizationId,context.organizationId),eq(pushSubscriptions.id,subscriptionId(endpoint,context.organizationId,context.user.id)),eq(pushSubscriptions.userId,context.user.id))).limit(1);
 if(!device||!pushConfigured())throw new HttpError(409,'Aktiviere zuerst Mitteilungen auf diesem Gerät.');
 const payload={...pushPayload('test','showtime-test',context.user.id,0,{link:'/?module=settings'},context.organizationId),title:'Showtime · Mitteilungen sind aktiv',body:'Dieses Gerät empfängt jetzt Mitteilungen.'};
 if(!await send(device,payload))throw new HttpError(409,'Die Geräteverbindung ist abgelaufen. Aktiviere Mitteilungen erneut.');
}
/** Every delivery resolves current tenant membership and parent permissions again. */
export async function deliverNotifications(organizationId:string,departmentId:string,type:string,noticeIds:string[]){
 if(!pushConfigured()||!noticeIds.length)return;
 const [devices,subjects]=await Promise.all([db.select().from(pushSubscriptions).where(eq(pushSubscriptions.organizationId,organizationId)),activeSubjects(organizationId,departmentId)]);
 if(!devices.length)return;
 const notices=await db.select().from(records).where(and(eq(records.organizationId,organizationId),eq(records.kind,'notifications'),inArray(records.id,noticeIds),sql`coalesce(${records.data}->>'read','false')<>'true'`));
 const counts=new Map<string,number>();
 for(const subject of subjects.filter(s=>notices.some(n=>n.ownerId===s.user.id))){
  const unread=await db.select().from(records).where(and(eq(records.organizationId,organizationId),eq(records.kind,'notifications'),eq(records.ownerId,subject.user.id),sql`coalesce(${records.data}->>'read','false')<>'true'`));
  let count=0;for(const notice of unread)if(await noticeReadable(subject,notice))count++;
  counts.set(subject.user.id,count);
 }
 for(const notice of notices){const subject=subjects.find(s=>s.user.id===notice.ownerId);if(!subject||!await noticeReadable(subject,notice))continue;
  const payload=pushPayload(type,notice.id,subject.user.id,counts.get(subject.user.id)||0,notice.data,organizationId);
  const results=await Promise.allSettled(devices.filter(d=>d.userId===subject.user.id).map(d=>send(d,payload)));
  if(results.some(r=>r.status==='rejected'))throw new Error('Push delivery will be retried by the event outbox.');
 }
}
