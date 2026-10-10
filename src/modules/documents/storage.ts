import * as Y from 'yjs';
import {and,eq,gt,lte,sql} from 'drizzle-orm';
import {db} from '@/platform/db';
import {documentBuffers,documentUpdates,tenantSettings} from '@/platform/db/schema';
import {currentRequest} from '@/platform/request';
import {HttpError} from '@/platform/http';
import {decodeState,encodeDocument,mergedDocument} from './state';
import type {DocumentClaims} from './ticket';
export const dirtyDocumentsKey='showtime:documents:dirty';
export const documentKeys=(id:string)=>({base:`showtime:${currentRequest().context!.organizationId}:document:${id}`,log:id,counter:id});
const expired=()=>new HttpError(409,'Der Dokumentzugang muss erneuert werden.',{code:'document_session_expired'});
export async function initializeDocumentCache(fileId:string,state:string,revision:number){
 await db.insert(documentBuffers).values({fileId,state,baseRevision:revision,revision,pendingBytes:0,dirty:false}).onConflictDoNothing();
}
export async function readDocumentLog(fileId:string,_departmentId:string,epoch?:string,sinceRevision?:number){
 if(epoch!==undefined){const [settings]=await db.select().from(tenantSettings).limit(1);if(String(settings?.permissionVersion||1)!==epoch)throw expired();}
 const [row]=await db.select().from(documentBuffers).where(eq(documentBuffers.fileId,fileId)).limit(1);if(!row)throw expired();
 const floor=Math.max(row.baseRevision,sinceRevision??row.baseRevision);
 const entries=await db.select().from(documentUpdates).where(and(eq(documentUpdates.fileId,fileId),gt(documentUpdates.revision,floor))).orderBy(documentUpdates.revision).limit(2001);
 return {state:sinceRevision!==undefined&&sinceRevision>=row.baseRevision?'':row.state,revision:row.revision,baseRevision:row.baseRevision,entries:entries.map(u=>[u.revision,u.updateBase64,u.clientId] as [number,string,string])};
}
export async function readDocumentState(claims:DocumentClaims,sinceRevision?:number){
 const log=await readDocumentLog(claims.fileId,claims.departmentId,claims.epoch,sinceRevision);
 if(sinceRevision!==undefined){const updates=log.entries.map(e=>decodeState(e[1]));if(log.state)updates.unshift(decodeState(log.state));return {state:Buffer.from(Y.mergeUpdates(updates)).toString('base64'),revision:log.revision};}
 const doc=mergedDocument([log.state,...log.entries.map(e=>e[1])]);try{return {state:encodeDocument(doc),revision:log.revision};}finally{doc.destroy();}
}
export async function appendDocumentUpdate(claims:DocumentClaims,update:string,sinceRevision=0){
 if(!claims.canEdit)throw new HttpError(403,'Dieses Dokument kannst du nur ansehen.');decodeState(update,256_000);
 await db.transaction(async tx=>{
  const [row]=await tx.select().from(documentBuffers).where(eq(documentBuffers.fileId,claims.fileId)).limit(1).for('update');if(!row)throw expired();
  if(row.pendingBytes+update.length+row.state.length>3_978_000)throw new HttpError(row.pendingBytes?409:413,'Bitte sichere den Dokumentstand.',row.pendingBytes?{code:'document_checkpoint_required'}:{});
  const revision=row.revision+1;
  await tx.insert(documentUpdates).values({fileId:claims.fileId,revision,updateBase64:update,clientId:claims.userId});
  await tx.update(documentBuffers).set({revision,pendingBytes:row.pendingBytes+update.length,dirty:true,updatedAt:new Date()}).where(eq(documentBuffers.fileId,claims.fileId));
 });
 return readDocumentState(claims,sinceRevision);
}
/** Delete only revisions included in the committed checkpoint; later edits remain durable. */
export async function acknowledgeCheckpoint(fileId:string,state:string,revision:number){
 await db.transaction(async tx=>{
  const [row]=await tx.select().from(documentBuffers).where(eq(documentBuffers.fileId,fileId)).limit(1).for('update');if(!row||row.baseRevision>revision)return;
  await tx.delete(documentUpdates).where(and(eq(documentUpdates.fileId,fileId),lte(documentUpdates.revision,revision)));
  const [remaining]=await tx.select({bytes:sql<number>`coalesce(sum(length(${documentUpdates.updateBase64})),0)`,count:sql<number>`count(*)`}).from(documentUpdates).where(eq(documentUpdates.fileId,fileId));
  await tx.update(documentBuffers).set({state,baseRevision:revision,revision:Math.max(row.revision,revision),pendingBytes:Number(remaining.bytes),dirty:Number(remaining.count)>0}).where(eq(documentBuffers.fileId,fileId));
 });
}
export async function clearDocumentCache(fileId:string){await db.delete(documentUpdates).where(eq(documentUpdates.fileId,fileId));await db.delete(documentBuffers).where(eq(documentBuffers.fileId,fileId));}
