import { accountState, activeThroughToInstant, escapeHtml as h, formatDate, type DealerAccount, type FounderWorkspace, type Prediction } from './domain';
import type { founderRepository } from './repository';
import { options, workspaceHtml, type Tab } from './templates';
import { provisioningForm } from './provisioning-form';
type Repository = typeof founderRepository;
const text = (form: FormData,key: string)=>String(form.get(key)??'').trim();

export async function mountFounderControl(root: HTMLElement,repo: Repository,logout: ()=>Promise<void>): Promise<void> {
  let dealers: DealerAccount[]=[]; let selected=''; let workspace: FounderWorkspace|null=null;
  let tab: Tab='Account'; let generation=0; let busy=false; let filter=''; let stateFilter='';
  root.innerHTML=`<main class="fc"><header><div><h1>DealSetu Founder Control</h1><p>Dealer accounts, access and evidence in one place.</p></div><div class="fc-row"><button class="secondary" data-refresh>Refresh</button><button class="secondary" data-logout>Sign out</button></div></header><div role="status" hidden></div><div role="alert" hidden></div><div class="fc-layout"><aside><h2>Dealers</h2><label>Search<input type="search" data-search placeholder="Name, email or area"></label><label>Account status<select data-filter><option value="">All accounts</option>${options(['Trial','Paid','Expired','Suspended'])}</select></label><div data-roster></div></aside><div data-workspace><section><p>Loading dealer accounts…</p></section></div></div></main>`;
  const pane=root.querySelector<HTMLElement>('[data-workspace]')!;
  const createButton=document.createElement('button');createButton.textContent='Create dealer';createButton.dataset.createDealer='';root.querySelector('header .fc-row')!.prepend(createButton);
  const onboarding=document.createElement('div');onboarding.hidden=true;root.querySelector('.fc-layout')!.before(onboarding);
  const overview=document.createElement('section');overview.style.cssText='max-width:1360px;margin:0 auto 18px';overview.hidden=true;root.querySelector('.fc-layout')!.before(overview);
  function notice(message: string,error=false) {
    const status=root.querySelector<HTMLElement>('[role=status]')!; const alert=root.querySelector<HTMLElement>('[role=alert]')!;
    status.hidden=true; alert.hidden=true; const target=error?alert:status; target.textContent=message; target.hidden=false;
  }
  function lock(value: boolean) { busy=value; root.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{b.disabled=value;}); }
  function roster() {
    const visible=dealers.filter(d=>(!stateFilter || accountState(d)===stateFilter) && [d.brand_name,d.owner_name,d.login_email,d.primary_area,d.dealer_id].join(' ').toLowerCase().includes(filter));
    root.querySelector('[data-roster]')!.innerHTML=`<p>${visible.length} of ${dealers.length} accounts</p>${visible.map(d=>`<button class="fc-dealer" data-dealer="${h(d.dealer_id)}" aria-pressed="${d.dealer_id===selected}" ${busy?'disabled':''}>${h(d.brand_name)}<small>${h(accountState(d))} · ${h(d.primary_area || 'Area not recorded')}</small></button>`).join('') || '<p>No matching dealers.</p>'}`;
  }
  function render() { const d=dealers.find(row=>row.dealer_id===selected); if(!d || !workspace)return; pane.innerHTML=workspaceHtml(d,workspace,tab); if(busy)lock(true); }
  async function open(dealerId: string) {
    const request=++generation; selected=dealerId; workspace=null; roster(); pane.innerHTML='<section><p>Loading dealer workspace…</p></section>';
    try { const loaded=await repo.workspace(dealerId); if(request!==generation)return; workspace=loaded; render(); }
    catch(error) { if(request!==generation)return; pane.innerHTML='<section><p>Dealer details could not be loaded.</p><button data-retry>Retry</button></section>'; throw error; }
  }
  async function refresh() {
    dealers=await repo.dealers(); roster();
    overview.hidden=false;overview.innerHTML=`<div class="fc-grid">${(['Trial','Paid','Expired','Suspended'] as const).map(status=>`<div class="fc-stat">${status==='Expired'?'Access ended':status==='Trial'?'Current trials':status==='Paid'?'Current paid accounts':'Suspended'}<strong>${dealers.filter(d=>accountState(d)===status).length}</strong></div>`).join('')}</div>`;
    const id=dealers.some(d=>d.dealer_id===selected)?selected:dealers[0]?.dealer_id;
    if(id)await open(id); else pane.innerHTML='<section><h2>No dealer accounts yet</h2><p>The connected backend has no customer accounts.</p></section>';
  }
  const showError=(error: unknown)=>notice(error instanceof Error?error.message:'Request failed. Try again.',true);
  async function mutate(operation: ()=>Promise<unknown>,message: string) {
    if(busy)return; lock(true); let saved=false;
    try { await operation(); saved=true; await refresh(); notice(message); }
    catch(error) { notice(`${saved?'Saved, but the latest data could not be reloaded. Refresh before making another change. ':''}${error instanceof Error?error.message:'Request failed.'}`,true); }
    finally { lock(false); }
  }
  root.addEventListener('input',event=>{if((event.target as HTMLElement).matches('[data-search]')){filter=(event.target as HTMLInputElement).value.toLowerCase();roster();}});
  root.querySelector('[data-filter]')!.addEventListener('change',event=>{stateFilter=(event.target as HTMLSelectElement).value;roster();});
  root.addEventListener('click',event=>{
    const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button'); if(!button || busy)return;
    if(button.hasAttribute('data-create-dealer')){++generation;selected='';workspace=null;roster();pane.innerHTML=provisioningForm(crypto.randomUUID());return;}
    if(button.hasAttribute('data-cancel-provision')){void refresh().catch(showError);return;}
    if(button.hasAttribute('data-hide-onboarding')){onboarding.replaceChildren();onboarding.hidden=true;return;}
    if(button.dataset.dealer){void open(button.dataset.dealer).catch(showError);return;}
    if(button.dataset.tab){tab=button.dataset.tab as Tab;render();return;}
    if(button.hasAttribute('data-retry')){void open(selected).catch(showError);return;}
    if(button.hasAttribute('data-refresh')){lock(true);void refresh().then(()=>notice('Latest backend data loaded.')).catch(showError).finally(()=>lock(false));return;}
    if(button.hasAttribute('data-logout')){void logout().catch(showError);return;}
    if(button.dataset.accountAction){const action=button.dataset.accountAction as 'suspend'|'resume';void mutate(()=>repo.setAccount({dealerId:selected,action}),'Account access saved.');}
    if(button.dataset.revoke)void mutate(()=>repo.setDeviceStatus(button.dataset.revoke!,'revoked'),'Device approval revoked.');
    if(button.hasAttribute('data-code')){
      lock(true);void repo.createActivationCode(selected).then(result=>{const box=pane.querySelector('[data-code-result]');if(box)box.innerHTML=`<div class="fc-code"><strong>One-time activation code</strong><p><code>${h(result.code)}</code></p><p>Expires ${h(formatDate(result.expires_at))}. Give this code to the dealer for one new device.</p><button class="secondary" data-dismiss-code>Hide code</button></div>`;}).catch(showError).finally(()=>lock(false));
    }
    if(button.hasAttribute('data-dismiss-code'))pane.querySelector('[data-code-result]')!.innerHTML='';
  });
  root.addEventListener('submit',event=>{
    const form=event.target as HTMLFormElement;if(!form.matches('form[data-form]'))return;
    event.preventDefault();if(busy || !form.reportValidity())return;
    const data=new FormData(form);const dealerId=selected;
    if(form.dataset.form==='provision') {
      lock(true);let created=false;
      void (async()=>{
        try {
          const result=await repo.provisionDealer({dealerId:text(data,'dealerId'),businessName:text(data,'businessName'),ownerName:text(data,'ownerName'),ownerPhone:text(data,'ownerPhone'),primaryArea:text(data,'primaryArea'),loginEmail:text(data,'loginEmail'),passcode:String(data.get('password')??''),idempotencyKey:form.dataset.key!,founderContext:{acquisitionSource:text(data,'source'),pitchVersion:text(data,'pitch'),protocolVersion:text(data,'protocol'),buildVersion:import.meta.env.VITE_BUILD_VERSION || 'dev'}});
          created=true;selected=result.dealerId;form.reset();pane.innerHTML='<section><p>Account created. Loading its workspace…</p></section>';
          onboarding.hidden=false;onboarding.innerHTML=`<section style="max-width:1360px;margin:0 auto 18px"><h2>Dealer account created</h2><p>${h(result.dealerId)}</p>${result.credentialsAvailable?`<p>One-time device activation code</p><code>${h(result.activationCode)}</code><p>Expires ${h(formatDate(result.codeExpiresAt))}. Share this code and the password you entered privately with the dealer.</p>`:'<p>This account was already created. Its one-time credentials cannot be shown again. Generate a new code from Devices when needed.</p>'}<button class="secondary" data-hide-onboarding>Hide onboarding details</button></section>`;
          await refresh();notice('Dealer and trial saved to MAPCO.');
        }catch(error){notice(`${created?'Account created, but its workspace could not reload. ':''}${error instanceof Error?error.message:'Setup failed. Retry with the same details.'}`,true);}
        finally{lock(false);}
      })();return;
    }
    void mutate(async()=>{
      switch(form.dataset.form){
        case 'paid': {const amount=text(data,'amount');const amountPaise=amount?Math.round(Number(amount)*100):undefined;
          if(amountPaise!==undefined && (!Number.isSafeInteger(amountPaise)||amountPaise<0))throw new Error('Enter a valid payment amount.');
          await repo.setAccount({dealerId,action:'paid',expiresAt:activeThroughToInstant(text(data,'through')),plan:text(data,'plan'),paymentNote:text(data,'note'),amountPaise});break;}
        case 'extend_trial': await repo.setAccount({dealerId,action:'extend_trial',expiresAt:activeThroughToInstant(text(data,'through'))});break;
        case 'device_limit': await repo.setDeviceLimit(dealerId,Number(text(data,'limit')));break;
        case 'evidence': await repo.addEvidence({dealerId,trialId:text(data,'trial')||undefined,kind:text(data,'kind'),provenance:text(data,'provenance'),body:text(data,'body'),occurredAt:new Date(text(data,'occurred')).toISOString()});break;
        case 'prediction': await repo.addPrediction({dealerId,trialId:text(data,'trial')||undefined,statement:text(data,'statement'),domain:text(data,'domain'),confidence:Number(text(data,'confidence')),horizonAt:new Date(text(data,'horizon')).toISOString()});break;
        case 'resolve': await repo.resolvePrediction(form.dataset.id!,text(data,'resolution') as Exclude<Prediction['resolution'],'pending'>,text(data,'note'));break;
        default: throw new Error('Unknown form action.');
      }
    },'Saved to MAPCO.');
  });
  try{await refresh();}catch(error){pane.innerHTML='<section><p>Dealer directory unavailable. Use Refresh to try again.</p></section>';showError(error);}
}
