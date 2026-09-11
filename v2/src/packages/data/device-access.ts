import { getSupabase } from './supabase/client';
import { readDeviceToken, requireDeviceToken } from './device-identity';

export interface DeviceAccess { status: 'approved'|'device_not_activated'|'account_blocked'|'account_suspended'|'trial_expired'|'sign_in_required'; expiresAt?: string; maxDevices?: number; subscriptionStatus?: 'trial'|'paid'|'active'; founder?: boolean; }
export type DeviceActivationStatus = 'approved'|'invalid_code'|'expired'|'already_used'|'device_limit_reached'|'dealer_inactive'|'activation_failed';
export async function readDealerAccess(): Promise<DeviceAccess> {
  const client=await getSupabase(); if(!client)throw new Error('Backend not configured.');
  const {data,error}=await client.rpc('plotmap_dealer_access_status',{p_device_token:readDeviceToken()});
  if(error)throw new Error(error.message);
  if(!data || !['approved','device_not_activated','account_blocked','account_suspended','trial_expired','sign_in_required'].includes(data.status))throw new Error('Account access could not be verified.');
  return data;
}
export async function requestDeviceActivation(code: string,label: string): Promise<DeviceActivationStatus> {
  if(!/^\d{8}$/.test(code))throw new Error('Enter the 8-digit code from Founder Control.');
  const client=await getSupabase();if(!client)throw new Error('Backend not configured.');
  const {data,error}=await client.rpc('plotmap_activate_device',{
    p_access_code:code,p_device_token:requireDeviceToken(),p_device_label:label.trim().slice(0,160),
    p_browser_info:navigator.userAgent.slice(0,240),
  });
  if(error)throw new Error(error.message);
  const status=String(Array.isArray(data)?data[0]?.status:data?.status);
  if(['approved','invalid_code','expired','already_used','device_limit_reached','dealer_inactive','activation_failed'].includes(status))return status as DeviceActivationStatus;
  return 'activation_failed';
}
export async function activateCurrentDevice(code: string,label: string): Promise<void> {
  const status=await requestDeviceActivation(code,label);
  if(status==='approved')return;
  const messages: Record<string,string>={invalid_code:'This code is not valid. Ask the founder for a new code.',expired:'This code has expired. Ask the founder for a new code.',already_used:'This code has already been used.',device_limit_reached:'All approved device slots are in use. Ask the founder to replace an old device.',dealer_inactive:'Account access has ended. Contact 8968017508.'};
  throw new Error(messages[status]??'Device activation could not be completed. Try again.');
}

/** Covers the page when access expires or is revoked. Database enforcement is
 * independent of this overlay; it never relies on this timer for authorization. */
export async function enforceDealerAccess(onReady: ()=>void|Promise<void>,onSignOut: ()=>Promise<void>): Promise<()=>void> {
  let stopped=false;let loaded=false;let checking=false;let displayedStatus='';let timer: ReturnType<typeof setTimeout>|undefined;
  const gate=document.createElement('div');gate.dataset.dealerAccessGate='';
  gate.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:var(--pm-base,#e7ddfb);background-image:var(--pm-bloom);font-family:var(--pm-font-ui,system-ui)';
  const stop=()=>{stopped=true;clearTimeout(timer);gate.remove();window.removeEventListener('focus',onFocus);};
  function show(status: DeviceAccess['status']|'error',message?: string) {
    displayedStatus=status;
    const activation=status==='device_not_activated';
    const title=activation?'Activate this device':status==='trial_expired'?'Free trial ended':status==='account_suspended'?'Account suspended':status==='sign_in_required'?'Please sign in again':status==='error'?'Could not verify access':'Account access ended';
    gate.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="access-title" style="width:100%;max-width:460px;padding:30px;border-radius:24px;background:var(--pm-surface,#fffaf0);color:var(--pm-ink,#241f1c)"><h1 id="access-title" style="font:500 28px var(--pm-font-display,serif)"></h1><p data-message style="margin:16px 0;line-height:1.5"></p>${activation?'<form data-activate><label>Device name<input name="label" required maxlength="160" placeholder="Office laptop" style="display:block;width:100%;padding:12px;margin:8px 0 16px;border:1px solid #ddd2f5;border-radius:12px"></label><label>8-digit activation code<input name="code" required inputmode="numeric" autocomplete="off" pattern="[0-9]{8}" maxlength="8" style="display:block;width:100%;padding:12px;margin:8px 0 16px;border:1px solid #ddd2f5;border-radius:12px"></label><button type="submit">Activate device</button></form>':''}<p role="alert" hidden></p><div style="display:flex;gap:12px;margin-top:18px"><button data-retry>Check access again</button><button data-signout>Sign out</button></div></section>`;
    gate.querySelector('#access-title')!.textContent=title;
    gate.querySelector('[data-message]')!.textContent=message??(activation?'Enter the code provided by the founder once. After approval, use your email and password as usual.':'Contact 8968017508.');
    gate.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{b.style.cssText='padding:12px 16px;border:0;border-radius:12px;background:var(--pm-violet,#5b32c4);color:white;cursor:pointer;font:inherit;font-weight:700';});
    gate.querySelector('[data-retry]')!.addEventListener('click',()=>void check());
    gate.querySelector('[data-signout]')!.addEventListener('click',()=>void onSignOut().catch(error=>displayError(error)));
    gate.querySelector('form')?.addEventListener('submit',event=>{
      event.preventDefault(); const form=event.target as HTMLFormElement; if(!form.reportValidity())return;
      const button=form.querySelector<HTMLButtonElement>('button')!;if(button.disabled)return;button.disabled=true;
      const data=new FormData(form);
      void activateCurrentDevice(String(data.get('code')??''),String(data.get('label')??''))
        .then(()=>check()).catch(displayError).finally(()=>{button.disabled=false;});
    });
    if(!gate.isConnected)document.body.append(gate);
  }
  function displayError(error: unknown){const alert=gate.querySelector<HTMLElement>('[role=alert]');if(alert){alert.textContent=error instanceof Error?error.message:'Request failed.';alert.hidden=false;}}
  async function check() {
    if(stopped || checking)return;checking=true;clearTimeout(timer);
    let delay=30000;
    try {
      const access=await readDealerAccess();if(stopped)return;
      if(access.status==='approved') {
        gate.remove();
        if(!loaded){await onReady();loaded=true;}
        if(access.expiresAt){const remaining=Date.parse(access.expiresAt)-Date.now();if(Number.isFinite(remaining))delay=Math.max(250,Math.min(delay,remaining));}
      } else if(!gate.isConnected || displayedStatus!==access.status)show(access.status);
    } catch(error) {if(!stopped)show('error',error instanceof Error?error.message:'Check your connection and try again.');}
    finally{checking=false;if(!stopped)timer=setTimeout(()=>void check(),delay);}
  }
  function onFocus(){void check();}
  window.addEventListener('focus',onFocus);window.addEventListener('pagehide',stop,{once:true});
  await check();return stop;
}
