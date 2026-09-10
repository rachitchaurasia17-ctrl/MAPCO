/** Persistent browser-installation proof; the server stores only its hash.
 * Retain the legacy key so an already approved browser need not activate again.
 * This identifies an installation, not physical hardware. Never clear at logout.
 */
export const DEVICE_TOKEN_KEY = 'plotmap_device_token_v1';
export function readDeviceToken(): string | null {
  try { const value=localStorage.getItem(DEVICE_TOKEN_KEY); return value && /^[a-zA-Z0-9_-]{32,512}$/.test(value)?value:null; }
  catch { return null; }
}
export function requireDeviceToken(): string {
  const existing=readDeviceToken(); if(existing)return existing;
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const token=Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
  try { localStorage.setItem(DEVICE_TOKEN_KEY,token); if(readDeviceToken()!==token)throw new Error(); }
  catch { throw new Error('Allow browser storage to activate this device and keep its approval after signing out.'); }
  return token;
}

/** Only the configured data/storage origin receives device proof. It must not
 * leak into third-party requests, Auth requests, URLs, logs or telemetry. */
export function deviceAwareFetch(origin: string,request: typeof fetch = (...args)=>fetch(...args)): typeof fetch {
  return (input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    if(url.origin!==origin || (!url.pathname.startsWith('/rest/v1/') && !url.pathname.startsWith('/storage/v1/')))return request(input,init);
    const token=readDeviceToken(); if(!token)return request(input,init);
    const headers=new Headers(input instanceof Request?input.headers:undefined);
    new Headers(init?.headers).forEach((value,key)=>headers.set(key,value));
    headers.set('x-mapco-device-token',token);
    return request(input,{...init,headers});
  };
}
