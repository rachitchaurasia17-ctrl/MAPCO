export interface FounderContext { acquisitionSource: string; pitchVersion: string; protocolVersion: string; buildVersion: string; }
/** Explicit observations only; no invented acquisition or price defaults. */
export function parseFounderContext(input: unknown): FounderContext | null {
  if(input===undefined)return null;
  if(!input || typeof input!=='object' || Array.isArray(input))throw new Error('INVALID_FOUNDER_CONTEXT');
  const row=input as Record<string,unknown>;
  const result={acquisitionSource:String(row.acquisitionSource??'').trim(),pitchVersion:String(row.pitchVersion??'').trim(),protocolVersion:String(row.protocolVersion??'').trim(),buildVersion:String(row.buildVersion??'').trim()};
  if(!['family','referral','cold','walk_in','inbound'].includes(result.acquisitionSource))throw new Error('INVALID_FOUNDER_CONTEXT');
  for(const value of [result.pitchVersion,result.protocolVersion,result.buildVersion])if(!value || value.length>60 || /[<>\u0000-\u001f]/.test(value))throw new Error('INVALID_FOUNDER_CONTEXT');
  return result;
}
