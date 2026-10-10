/** Remove local private drafts and collaborative document copies for this login. */
export async function clearPrivateBrowserData(userId:string){
 for(const storage of [localStorage,sessionStorage]){
  for(const key of Object.keys(storage))if(key.startsWith('showtime:')&&key.includes(':'+userId+':'))storage.removeItem(key);
 }
 if(indexedDB.databases){for(const database of await indexedDB.databases()){
  if(database.name?.startsWith('showtime:')&&database.name.includes(':'+userId+':')){
   const name=database.name;
   await new Promise<void>((resolve)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=request.onerror=request.onblocked=()=>resolve();});
  }
 }}
}
