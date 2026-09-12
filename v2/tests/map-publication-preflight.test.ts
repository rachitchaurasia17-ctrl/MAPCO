import {describe,expect,it} from 'vitest';
import {assessMapPublication} from '../scripts/map-publication-preflight.mjs';

describe('shared map publication compatibility gate',()=>{
  it('blocks the observed same-ID/different-image collision',()=>{
    const result=assessMapPublication([{id:'chandigarh-sector-15'}],[{
      databaseId:'chandigarh-sector-15',httpStatus:200,idCollision:true,
    }],[]);
    expect(result.safeToPublish).toBe(false);
    expect(result.collisions).toEqual(['chandigarh-sector-15']);
  });
  it('does not rebind orphaned placements to a similarly named master plan',()=>{
    const properties=[{id:'test-property',placement:{mapId:'map-nc-master',x:0.42,y:0.31},masterplan_id:'map-nc-master'}];
    const before=JSON.stringify(properties);
    const result=assessMapPublication([{id:'new-chandigarh-master'}],[],properties);
    expect(result.safeToPublish).toBe(false);
    expect(result.unresolvedPlacements).toEqual([{propertyId:'test-property',mapId:'map-nc-master'}]);
    expect(JSON.stringify(properties)).toBe(before);
  });
  it('accepts explicitly resolved historical IDs without rewriting coordinates',()=>{
    const properties=[{id:'test-property',placement:{mapId:'historical-map',x:0.42,y:0.31}}];
    expect(assessMapPublication([{id:'new-sheet'}],[{databaseId:'historical-map',httpStatus:200}],properties).safeToPublish).toBe(true);
  });
  it('blocks unavailable historical assets',()=>{
    expect(assessMapPublication([],[{databaseId:'old-map',httpStatus:404}],[]).safeToPublish).toBe(false);
  });
  it('blocks duplicate canonical IDs before any publication',()=>{
    expect(assessMapPublication([{id:'same'},{id:'same'}],[],[]).safeToPublish).toBe(false);
  });
});
