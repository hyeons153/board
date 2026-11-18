import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { productionDatabase } from '../server/database';
import { upgradeEquipment, type CareerExtras } from '../src/game/economy';

config({path:'.env.local',quiet:true});config({quiet:true});
const url=process.env.DATABASE_URL;if(!url)throw new Error('DATABASE_URL is required for a read-only upgrade audit.');
const db=productionDatabase(url);
try{
  const report=await db.transaction(async tx=>{
    await tx.query('SET TRANSACTION READ ONLY');
    const rows=await tx.query<{extras:CareerExtras|null}>("SELECT snapshot#>'{career,rider,extras}' AS extras FROM rider_careers WHERE snapshot#>'{career,rider}' IS NOT NULL AND snapshot#>'{career,rider}' <> 'null'::jsonb");
    let upgrades=0,bearings=0,unmapped=0,overflow=0;
    for(const {extras} of rows){
      if(!extras)continue;
      const before=JSON.stringify(extras),converted=upgradeEquipment(extras);
      assert.equal(JSON.stringify(extras),before,'Inspection must not mutate even the in-memory source');
      for(const id of extras.inventory)assert.ok(converted.inventory.includes(id),'An owned item must survive');
      assert.deepEqual(upgradeEquipment(converted),converted,'Upgrade must be idempotent');
      assert.equal(new Set(converted.inventory).size,converted.inventory.length);
      if(extras.equipmentVersion!==2)upgrades++;
      if(extras.equipped.bearings)bearings++;
      unmapped+=converted.legacyEquipment?.unmapped.length??0;overflow+=converted.legacyEquipment?.overflow.length??0;
    }
    return {activeCareers:rows.length,upgrades,bearingLoadouts:bearings,unmapped,overflow,mode:'READ ONLY',writes:0};
  });
  console.log(JSON.stringify(report));console.log('PASS existing equipment upgrade audit: preserved IDs, no duplicates, repeat-safe, zero database writes');
}finally{await db.close();}
