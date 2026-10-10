import { appDatabase, appSql } from "./connections";
import { requestScope } from "../request";
/** Every business query uses the transaction whose tenant was verified for this request. */
export const db: typeof appDatabase = new Proxy(appDatabase, {
  get(_target, key) {
    const tx = requestScope.getStore()?.transaction;
    if (!tx) throw new Error("Tenant transaction required");
    const value = Reflect.get(tx, key);
    return typeof value === "function" ? value.bind(tx) : value;
  },
});
export const sqlClient = appSql;
export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
