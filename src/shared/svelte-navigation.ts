import { goto, invalidateAll } from '$app/navigation';
export const useRouter=()=>({push:(url:string)=>goto(url),replace:(url:string)=>goto(url,{replaceState:true}),refresh:()=>invalidateAll(),back:()=>history.back()});
