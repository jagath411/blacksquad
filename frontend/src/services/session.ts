type Listener = () => void;
const listeners = new Set<Listener>();

/** Called when the session can no longer be refreshed and the user must sign in again. */
export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitSessionExpired(): void {
  listeners.forEach((listener) => listener());
}
