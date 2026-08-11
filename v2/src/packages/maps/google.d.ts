/* Ambient shim for the Google Maps JS API.
   We load the API dynamically at runtime (see google-loader.ts) and use a
   loose `any` surface rather than pulling in @types/google.maps — this keeps
   the standalone MAPCO Earth feature dependency-free while it stabilises.
   Swap for @types/google.maps when Earth graduates to deep integration. */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const google: any;
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google: any;
  }
}

export {};
