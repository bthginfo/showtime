import { AsyncLocalStorage } from "node:async_hooks";
import type { Context } from "./context";
import type { Transaction } from "./db";
export type RequestScope = {
  request: Request;
  context?: Context;
  transaction?: Transaction;
  after: (() => Promise<unknown> | void)[];
};
export const requestScope = new AsyncLocalStorage<RequestScope>();
export function currentRequest() {
  const scope = requestScope.getStore();
  if (!scope) throw new Error("Request scope required");
  return scope;
}
export function after(task: () => Promise<unknown> | void) {
  currentRequest().after.push(task);
}
