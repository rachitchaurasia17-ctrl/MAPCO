// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('../src/packages/data/supabase/client',()=>({getSupabase:async()=>({rpc:mocks.rpc})}));
import { activateCurrentDevice, enforceDealerAccess, readDealerAccess } from '../src/packages/data/device-access';
let stop:(()=>void)|undefined;
beforeEach(()=>{document.body.innerHTML='';localStorage.clear();mocks.rpc.mockReset();});
afterEach(()=>{stop?.();stop=undefined;vi.useRealTimers();});
describe('dealer account and device gate',()=>{
  it('fails closed on a malformed backend response',async()=>{mocks.rpc.mockResolvedValue({data:false,error:null});await expect(readDealerAccess()).rejects.toThrow('could not be verified');});
  it('never renders private content for an expired trial',async()=>{mocks.rpc.mockResolvedValue({data:{status:'trial_expired'},error:null});const ready=vi.fn();stop=await enforceDealerAccess(ready,vi.fn());expect(ready).not.toHaveBeenCalled();expect(document.body.textContent).toContain('Free trial ended');expect(document.body.textContent).toContain('8968017508');});
  it('requires an approved result rather than accepting a successful HTTP response',async()=>{mocks.rpc.mockResolvedValue({data:[{status:'already_used'}],error:null});await expect(activateCurrentDevice('01234567','Office')).rejects.toThrow('already been used');expect(mocks.rpc).toHaveBeenCalledWith('plotmap_activate_device',expect.objectContaining({p_access_code:'01234567',p_device_token:expect.stringMatching(/^[a-f0-9]{64}$/)}));});
  it('rejects malformed activation codes without calling the backend',async()=>{await expect(activateCurrentDevice('123','Office')).rejects.toThrow('8-digit');expect(mocks.rpc).not.toHaveBeenCalled();});
  it('rechecks access at expiry and covers previously rendered private content',async()=>{vi.useFakeTimers();mocks.rpc.mockResolvedValueOnce({data:{status:'approved',expiresAt:new Date(Date.now()+1000).toISOString()},error:null}).mockResolvedValue({data:{status:'trial_expired'},error:null});const ready=vi.fn();stop=await enforceDealerAccess(ready,vi.fn());expect(ready).toHaveBeenCalledOnce();expect(document.querySelector('[data-dealer-access-gate]')).toBeNull();await vi.advanceTimersByTimeAsync(1000);expect(document.body.textContent).toContain('Free trial ended');expect(ready).toHaveBeenCalledOnce();});
  it('updates an activation form to a suspended state without leaving a usable form',async()=>{vi.useFakeTimers();mocks.rpc.mockResolvedValueOnce({data:{status:'device_not_activated'},error:null}).mockResolvedValue({data:{status:'account_suspended'},error:null});stop=await enforceDealerAccess(vi.fn(),vi.fn());expect(document.querySelector('form')).not.toBeNull();await vi.advanceTimersByTimeAsync(30000);expect(document.querySelector('form')).toBeNull();expect(document.body.textContent).toContain('Account suspended');});
});
