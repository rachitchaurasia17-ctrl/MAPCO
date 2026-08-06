export type ResourceInvalidation =
  | { readonly entity: 'property'; readonly id: string }
  | { readonly entity: 'map'; readonly id: string }
  | { readonly entity: 'client-link'; readonly id: string }
  | { readonly entity: 'client'; readonly id: string }
  | { readonly entity: 'inventory'; readonly id: string }
  | { readonly entity: 'dealer-session'; readonly id: string };

type Listener = (event: ResourceInvalidation) => void;
const listeners = new Set<Listener>();

export function publishResourceInvalidation(event: ResourceInvalidation): void {
  for (const listener of listeners) listener(event);
}

export function subscribeResourceInvalidation(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
