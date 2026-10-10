import {verifyDocumentTicket} from './ticket';
import {documentAccess} from './service';
import {requireContext} from '@/platform/context';
import {HttpError} from '@/platform/http';
export async function authorizedDocumentTicket(ticket:string,cookie:string,fileId?:string){
 const claims=verifyDocumentTicket(ticket,cookie,fileId);const context=await requireContext();
 if(claims.userId!==context.user.id||claims.organizationId!==context.organizationId||claims.departmentId!==context.departmentId)throw new HttpError(403,'Keine Berechtigung für dieses Dokument.');
 const access=await documentAccess(context,claims.fileId);return {...claims,canEdit:claims.canEdit&&access.canEdit};
}
