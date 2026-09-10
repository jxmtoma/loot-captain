'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), crypto = require('node:crypto').webcrypto;
const read = f => fs.readFileSync(f, 'utf8'), clone = v => JSON.parse(JSON.stringify(v));
(async () => {
  let storage = { consentVersion: 1, profiles: { p: { id:'p',name:'Synthetic',cls:'Beastlord',level:'100',server:'Test server',
    items:[{id:'1',name:'Old Helm',slot:'head',stats:{HDex:40,HP:100},effects:[]}],wishlist:[] } } };
  let handler;
  const worker = vm.createContext({console,crypto,TextEncoder,URL,URLSearchParams,
    chrome:{runtime:{id:'test',getURL:x=>'chrome-extension://test/'+x,onMessage:{addListener:fn=>handler=fn}},
      storage:{local:{get:async()=>clone(storage),set:async values=>Object.assign(storage,clone(values))}}},
    importScripts:(...files)=>files.forEach(file=>vm.runInContext(read(path.join('background',file)),worker)),
  });
  vm.runInContext(read('background/service-worker.js'),worker);
  const send=(msg,url='chrome-extension://test/options/options.html')=>new Promise(resolve=>handler(msg,{url},resolve));
  const model=worker.LootCaptain.characterData, projection=worker.LootCaptain.projection;
  const save=async(action,value)=>send({type:'SAVE_CHARACTER_DATA',profileId:'p',action,value,
    expectedRevision:storage.profiles.p.characterData?.revision||0,expectedBinding:await model.fingerprint(storage.profiles.p)});
  const when=new Date(Date.now()-1000).toISOString();
  const snapshot={observedAt:when,observer:'Tester',expansion:'Test era',patch:'Test build',conditions:'Synthetic fixed conditions',
    unbuffed:true,gearConfirmed:true,includesHeroics:'unknown',readings:{HDEX:'600',Accuracy:'159'}};
  assert.equal(projection.accuracy(2000),217);
  assert.equal(projection.accuracy(400),151);assert.equal(projection.accuracy(4000),300);
  assert.equal(projection.accuracy(399),null);assert.equal(projection.accuracy(4001),null);
  assert.equal(projection.accuracy(424),151);assert.equal(projection.accuracy(425),152);
  assert.equal((await save('snapshot',snapshot)).ok,true);
  const observation={observedAt:when,observer:'Tester',sourceReferences:'Synthetic fixture only',slot:'head',oldItem:'Old',newItem:'New',
    itemChanges:'Synthetic +40 HDEX, other conditions fixed',conditionsUnchanged:true,
    before:{HDEX:'600',Accuracy:'159'},after:{HDEX:'640',Accuracy:'160'},restored:{HDEX:'600',Accuracy:'159'}};
  assert.equal((await save('observation',observation)).ok,true);
  const row=storage.profiles.p.characterData.observations[0];
  assert.equal(projection.assess(row).ok,true);
  const assumed=clone(row); assumed.baselineSnapshot.aaRanks=[{ name:'Default', rank:{ raw:'10', num:10 }, assumed:true }];
  assert.equal(projection.assess(assumed).ok,false);
  assert.match(projection.assess(assumed).reason,/assumptions/);
  assert.equal(projection.assess({...row,reviewStatus:'inconsistent'}).ok,false);
  const altered=clone(row);altered.after.Accuracy.num=170;assert.equal(projection.assess(altered).ok,false);
  const input={mode:'calibrated',type:'GET_CHARACTER_PROJECTION',profileId:'p',targetIndex:0,expected:{id:'1',name:'Old Helm',slot:'head'},
    item:{id:'2',name:'New Helm',slot:'head',stats:{HDex:80}},classes:['BST'],requiredLevel:100,confirmed:true};
  let result=await send(input,'https://www.raidloot.com/items/2');
  assert.equal(result.ok,true);assert.equal(result.projection.outputs[0].available,false);
  const approval={ruleKey:projection.RULE.key,version:1,observationId:row.id,confirmed:false};
  assert.equal((await save('approveRule',approval)).ok,false);
  approval.confirmed=true;assert.equal((await save('approveRule',approval)).ok,true);
  result=await send({...input,confirmed:false},'https://www.raidloot.com/items/2');
  assert.equal(result.projection.needsConfirmation,true);assert.equal(result.projection.outputs[0].available,false);
  result=await send(input,'https://guild.opendkp.com/#/items/2');
  assert.equal(result.projection.outputs[0].available,true);assert.equal(result.projection.outputs[0].delta,1);
  assert.equal(result.projection.outputs[0].projected,160);
  assert.ok(result.projection.outputs.slice(1).every(output=>output.available===false));
  assert.equal((await send(input,'https://evil.example')).ok,false);
  assert.equal((await send({...input,classes:['WIZ']})).ok,false);
  assert.equal((await send({...input,targetIndex:99})).ok,false);
  assert.equal((await send({...input,expected:{...input.expected,name:'Stale target'}})).ok,false);
  const outside={...input,item:{...input.item,stats:{HDex:81}}};
  assert.equal((await send(outside)).projection.outputs[0].available,false);
  const unknown={...input,item:{...input.item,stats:{HP:200}}};
  assert.equal((await send(unknown)).projection.outputs[0].available,false);
  // A fresh snapshot within the measured interval supports negative replacements too.
  await save('snapshot',{...snapshot,readings:{HDEX:'620',Accuracy:'160'}});
  const loss={...input,item:{...input.item,stats:{HDex:20}}};
  assert.equal((await send(loss)).projection.outputs[0].delta,-1);
  await save('snapshot',{...snapshot,patch:'Different patch',readings:{HDEX:'620',Accuracy:'160'}});
  assert.equal((await send(loss)).projection.outputs[0].available,false);
  await save('snapshot',{...snapshot,readings:{HDEX:'620',Accuracy:'160'}});
  await save('removeObservation',row.id);
  assert.equal(storage.profiles.p.characterData.ruleApprovals.length,0);
  assert.equal((await send(loss)).projection.outputs[0].available,false);

  // Parse only eligible passive stat definitions, never activation IDs or other-class rows.
  const cell=text=>({textContent:text});
  const aaRow=(name,level,recast,description)=>({querySelectorAll:()=>[cell('999'),cell(name),cell(level),cell('5 / 100'),cell(recast),cell(description)]});
  const rows=[aaRow('Planar Power (55)','100 RoF','-','Increase Base Stats Cap by 275'),
    aaRow('Wrong Class (10)','90 CLR (RoF)','-','Increase Max Mana by 100'),
    aaRow('Too Late (1)','100 CotF','-','Increase Max HP by 100'),
    aaRow('Active Ability (1)','100 RoF','60s','Increase Max HP by 100'),
    aaRow('Too High (1)','105 RoF','-','Increase Max HP by 100')];
  worker.DOMParser=class{parseFromString(){return {querySelector:s=>s==='#Class'?{value:'Beastlord'}:s==='#aas'?{}:s==='p.more'?{textContent:'AA list updated December 2025'}:null,
    querySelectorAll:()=>rows};}};
  const catalog=worker.parseAACatalog('', 'Beastlord',100,'Rain of Fear');
  assert.equal(catalog.entries.length,1);assert.equal(catalog.entries[0].name,'Planar Power');
  assert.equal(catalog.entries[0].rank,55);assert.equal(catalog.entries[0].id,undefined);
  assert.equal(catalog.catalogVersion,'AA list updated December 2025');
  assert.throws(()=>worker.parseAACatalog('','Wizard',100,'Rain of Fear'));
  console.log('projection and AA catalog checks passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
