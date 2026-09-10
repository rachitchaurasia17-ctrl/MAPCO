import { getSupabase, readEnv } from '../../packages/data/supabase/client';
export interface ProvisionDealerInput {
  dealerId: string; businessName: string; ownerName: string; ownerPhone: string;
  primaryArea: string; loginEmail: string; passcode: string; idempotencyKey: string;
  founderContext: { acquisitionSource: string; pitchVersion: string; protocolVersion: string; buildVersion: string };
}
export interface ProvisionDealerResult { dealerId: string; completed: true; credentialsAvailable: boolean; activationCode?: string; codeExpiresAt?: string; }
export function parseProvisioningResponse(body: string,dealerId: string): ProvisionDealerResult {
  for(const line of body.split('\n').filter(line=>line.trim())) {
    let event;try{event=JSON.parse(line);}catch{throw new Error('Setup response was interrupted. Retry with the same dealer details.');}
    if(event.type==='error') {
      if(event.code==='COMPLETED_CREDENTIALS_UNAVAILABLE')return {dealerId,completed:true,credentialsAvailable:false};
      throw new Error(typeof event.message==='string'?event.message:'Dealer setup failed. Retry with the same details.');
    }
    if(event.type==='result') {
      const result=event.result;
      if(result?.completed!==true || result.dealerId!==dealerId)throw new Error('Dealer setup returned an unexpected result. Refresh the directory before retrying.');
      if(result.credentialsAvailable===true && !/^\d{8}$/.test(result.activationCode??''))throw new Error('Dealer setup completed but its activation code is unavailable. Refresh the directory.');
      // Deliberately discard the legacy response's password field.
      return {dealerId,completed:true,credentialsAvailable:result.credentialsAvailable===true,activationCode:result.activationCode,codeExpiresAt:result.codeExpiresAt};
    }
  }
  throw new Error('No completion was received. Retry with the same dealer details.');
}
export async function provisionDealer(input: ProvisionDealerInput): Promise<ProvisionDealerResult> {
  const client=await getSupabase();const env=readEnv();if(!client || !env)throw new Error('Backend not configured.');
  const {data,error}=await client.auth.getSession();if(error || !data.session)throw new Error('Sign in to Founder Control again.');
  const response=await fetch(`${env.url}/functions/v1/provision-dealer`,{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`,apikey:env.anonKey,'X-Idempotency-Key':input.idempotencyKey},
    body:JSON.stringify(input),signal:AbortSignal.timeout(90000),
  });
  const body=await response.text();
  if(!response.ok) {let message='Dealer setup failed. Check your access and retry.';try{const result=JSON.parse(body);if(typeof result.message==='string')message=result.message;}catch{/* Never surface raw server responses or credentials. */}throw new Error(message);}
  return parseProvisioningResponse(body,input.dealerId);
}
