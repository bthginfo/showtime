/**
 * Do not cache authorization-dependent SQL outside its transaction.
 * API pagination and tenant revision keys provide bounded reads. A future shared
 * cache must include tenant, principal and the current permission version.
 */
export function unstable_cache<T extends (...args: any[]) => any>(
  fn: T,
  _keys?: string[],
  _options?: unknown,
): T {
  return fn;
}
export function revalidateTag(_tag: string, _options?: unknown) {}
