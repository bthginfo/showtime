/** Remove local copies; a blocked IndexedDB deletion is reported, never called success. */
export async function deletePrivateDatabase(name: string) {
  return new Promise<boolean>((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(true);
    request.onerror = request.onblocked = () => resolve(false);
  });
}
export async function clearPrivateBrowserData(userId: string) {
  let removed = 0;
  const blocked: string[] = [];
  for (const storage of [localStorage, sessionStorage]) {
    for (const key of Object.keys(storage))
      if (key.startsWith("showtime:") && key.includes(":" + userId + ":")) {
        storage.removeItem(key);
        removed++;
      }
  }
  if (indexedDB.databases)
    for (const database of await indexedDB.databases()) {
      if (database.name?.startsWith("showtime:") && database.name.includes(":" + userId + ":")) {
        const name = database.name;
        if (await deletePrivateDatabase(name)) removed++;
        else blocked.push(name);
      }
    }
  return { removed, blocked };
}
