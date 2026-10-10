import type { Handle } from '@sveltejs/kit';
import { waitUntil } from '@vercel/functions';
import { requestScope } from './platform/request';
import { requireContext } from './platform/context';
import { tenantTransaction } from './platform/db/tenant';
import { HttpError } from './platform/http';
const publicAPI=/^\/api\/(?:login|logout|register|reset-password|auth(?:\/|$)|cron$|calendar\/|realtime$|documents\/live$|events\/consume$|platform\/(?:scopes|switch|tenants|support)$)/;
class FailedResponse {constructor(public response:Response){}}
export const handle:Handle=async({event,resolve})=>{
 const scope={request:event.request,after:[] as (()=>Promise<unknown>|void)[]};
 return requestScope.run(scope,async()=>{
  try{
   const protectedAPI=event.url.pathname.startsWith('/api/')&&!publicAPI.test(event.url.pathname);
   const context=protectedAPI?await requireContext():undefined;
   const response=context?await tenantTransaction(context,async()=>{const result=await resolve(event);if(result.status>=400)throw new FailedResponse(result);return result;}):await resolve(event);
   if(scope.after.length){
    const tasks=async()=>{for(const task of scope.after){try{if(context)await tenantTransaction(context,async()=>task(),true);else await task();}catch(error){console.error('Deferred work failed',{name:error instanceof Error?error.name:'unknown'});}}};
    if(process.env.VERCEL)waitUntil(tasks());else await tasks();
   }
   if(event.url.pathname.startsWith('/api/'))response.headers.set('Cache-Control','private, no-store');
   response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Referrer-Policy','same-origin');
   return response;
  }catch(error){if(error instanceof FailedResponse)return error.response;if(error instanceof HttpError)return Response.json({error:error.message,...error.extra},{status:error.status});console.error('Request scope failed',{name:error instanceof Error?error.name:'unknown'});return Response.json({error:'Die Anfrage konnte nicht verarbeitet werden.'},{status:500});}
 });
};
