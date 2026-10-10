/** Structural UI contracts, without a React runtime. */
export type ReactNode=unknown;
export type CSSProperties=Record<string,string|number|undefined>;
export type SetStateAction<T>=T|((current:T)=>T);
export type Dispatch<T>=(value:T)=>void;
export type FormEvent<T=any>=Event&{currentTarget:T;target:EventTarget|null};
export type ChangeEvent<T=any>=Event&{currentTarget:T;target:EventTarget|null};
export type KeyboardEvent<T=any>=globalThis.KeyboardEvent&{currentTarget:T;target:EventTarget|null};
export type MouseEvent<T=any>=globalThis.MouseEvent&{currentTarget:T;target:EventTarget|null};
export type DragEvent<T=any>=globalThis.DragEvent&{currentTarget:T;target:EventTarget|null};
export type PointerEvent<T=any>=globalThis.PointerEvent&{currentTarget:T;target:EventTarget|null};
export type FocusEvent<T=any>=globalThis.FocusEvent&{currentTarget:T;target:EventTarget|null};
export type ComponentProps<T>=T extends (...args:any[])=>unknown?Parameters<T>[0]:Record<string,unknown>;
export type RefObject<T>={current:T};
