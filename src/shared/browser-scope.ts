let tenantId='';let userId='';
export function setBrowserScope(tenant:string,user:string){tenantId=tenant;userId=user;}
export function browserScope(){return tenantId+':'+userId;}
export function scopedBrowserKey(key:string){return 'showtime:'+browserScope()+':'+key;}
