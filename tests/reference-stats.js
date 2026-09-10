'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const read = file => fs.readFileSync(file, 'utf8'), clone = value => JSON.parse(JSON.stringify(value));
(async () => {
  let storage = { consentVersion:1, profiles: { p: { id:'p',name:'Synthetic',cls:'Beastlord',level:'100',server:'Synthetic',
    items: [{id:'1',name:'Old',slot:'head',stats:{AC:300,HP:1000,MANA:1000,END:1000,ATK:200,STA:50,WIS:50,STR:50,DEX:50,AGI:50,
      HSta:100,HWis:100,HStr:100,HDex:100,HAgi:100},effects:[]}],wishlist:[] } } };
  let handler;
  const worker=vm.createContext({console,crypto,TextEncoder,URL,URLSearchParams,
    chrome:{runtime:{id:'test',getURL:x=>'chrome-extension://test/'+x,onMessage:{addListener:fn=>handler=fn}},
      storage:{local:{get:async()=>clone(storage),set:async value=>Object.assign(storage,clone(value))}}},
    importScripts:(...files)=>files.forEach(file=>vm.runInContext(read(path.join('background',file)),worker))});
  vm.runInContext(read('background/service-worker.js'),worker);
  const ref=worker.LootCaptain.referenceStats, data=worker.LootCaptain.characterData;
  const profile=storage.profiles.p, worn=profile.items[0];
  const candidate={...clone(worn),id:'2',name:'New',stats:{...worn.stats,HP:1100,MANA:1100,END:1100,ATK:210,HSta:110,HWis:110,HStr:110}};
  const byMetric=result=>Object.fromEntries(result.outputs.map(output=>[output.metric,output]));
  const initial=clone(storage);
  let result=await ref.project(profile,candidate,worn), values=byMetric(result);
  assert.deepEqual(Array.from(result.outputs, output=>output.metric),['AC','HP','MANA','END','ATK']);
  assert.equal(result.mode,'reference'); assert.equal(result.needsConfirmation,false); assert.equal(result.snapshotId,null);
  assert.equal(values.HP.delta,286); // (100 + 42.5 STA + 100 HSTA) × 1.18, rounded.
  assert.equal(values.MANA.delta,318); // 100 + 13×9.09 WIS + 100 HWIS.
  assert.equal(values.ATK.delta,22.4); // 10×1.342 + 10×0.9.
  assert.equal(values.END.delta,214); // 100 + 7×9.09 + 20×2.5.
  assert.equal(values.HP.current,null); assert.equal(values.HP.projectedLow,null);
  assert.ok(result.assumptions.some(note=>note.includes('rank 10 assumed')));
  assert.deepEqual(storage,initial); // Estimation must not mutate gear or save invented snapshots/AAs.

  const only=(key,delta)=>({...clone(worn),id:'2',name:'New',stats:{...worn.stats,[key]:worn.stats[key]+delta}});
  assert.equal(byMetric(await ref.project(profile,only('AC',30),worn)).AC.delta,40);
  assert.equal(byMetric(await ref.project(profile,only('AC',-30),worn)).AC.delta,-40);
  assert.equal(byMetric(await ref.project(profile,only('HAgi',20),worn)).AC.delta,1);
  assert.equal(byMetric(await ref.project(profile,only('AGI',20),worn)).AC.delta,0);
  const acLoss=byMetric(await ref.project(profile,only('AGI',-20),worn)).AC;
  assert.equal(acLoss.deltaLow,-1); assert.equal(acLoss.deltaHigh,0);
  assert.equal(byMetric(await ref.project(profile,{...candidate,stats:{...candidate.stats,AC:{num:null}}},worn)).AC.available,false);
  values=byMetric(await ref.project(profile,only('STA',20),worn));
  assert.equal(values.HP.delta,0); // Ordinary stats above the cap get no credit.
  values=byMetric(await ref.project(profile,only('STA',-20),worn));
  assert.equal(values.HP.deltaLow,-101); assert.equal(values.HP.deltaHigh,0); assert.equal(values.HP.trend,'cap-dependent');
  values=byMetric(await ref.project(profile,only('HSta',-10),worn));
  assert.equal(values.HP.delta,-168); // Heroic loss changes both cap/effective STA and the separate heroic bonus.
  const intOnly={...clone(worn),stats:{...worn.stats,INT:30,HInt:30}};
  values=byMetric(await ref.project(profile,intOnly,worn)); assert.equal(values.MANA.delta,0);

  const noDurability={...profile,characterData:{version:1,aaRanks:[{name:'Natural Durability',rank:{raw:'0',num:0}}]}};
  assert.equal(byMetric(await ref.project(noDurability,only('HP',100),worn)).HP.delta,100);
  const assumedDurability={...profile,characterData:{version:1,aaRanks:[{name:'Natural Durability',rank:{raw:'10',num:10},assumed:true}]}};
  assert.equal(byMetric(await ref.project(assumedDurability,only('HP',100),worn)).HP.delta,118);
  const badRank={...profile,characterData:{version:1,aaRanks:[{name:'Natural Durability',rank:{raw:'99',num:99}}]}};
  assert.equal(byMetric(await ref.project(badRank,only('HP',100),worn)).HP.available,false);
  const capped={...profile,items:[{...worn,stats:{...worn.stats,ATK:610}}]};
  assert.equal(byMetric(await ref.project(capped,{...capped.items[0],stats:{...capped.items[0].stats,ATK:700}},capped.items[0])).ATK.delta,0);
  const noAttackAA={...profile,characterData:{version:1,aaRanks:[{name:'Enhanced Aggression',rank:{raw:'0',num:0}}]},items:[{...worn,stats:{...worn.stats,ATK:300}}]};
  assert.equal(byMetric(await ref.project(noAttackAA,{...noAttackAA.items[0],stats:{...noAttackAA.items[0].stats,ATK:400}},noAttackAA.items[0])).ATK.delta,0);

  const observed={...clone(profile),characterData:{version:1,revision:1,aaRanks:[],observations:[]}};
  observed.characterData.snapshot=data.snapshot({observedAt:new Date().toISOString(),observer:'Synthetic test',
    unbuffed:true,gearConfirmed:true,includesHeroics:'yes',readings:{HP:'10000',STA:'200',STACap:'300',HSTA:'100'}},
    observed,await data.fingerprint(observed),[]);
  values=byMetric(await ref.project(observed,only('STA',10),worn));
  assert.equal(values.HP.delta,100); assert.equal(values.HP.current,10000); assert.equal(values.HP.projectedLow,10100);
  observed.characterData.snapshot.invalidatedAt=Date.now();
  values=byMetric(await ref.project(observed,only('STA',10),worn));
  assert.equal(values.HP.current,null); assert.equal(values.HP.delta,0); // Stale totals ignored; reference still works.
  const partialOpenDKP={...clone(worn),stats:{HP:{num:1100,source:'opendkp'}}};
  assert.equal(byMetric(await ref.project(profile,partialOpenDKP,worn)).MANA.available,false);
  // Omitted fields are an estimate assumption only; explicit unreadable values are not zero.
  assert.equal(byMetric(await ref.project(profile,{...candidate,stats:{...candidate.stats,HP:{num:null,raw:'unknown'}}},worn)).HP.available,false);
  assert.equal((await ref.project(profile,candidate,{...worn,stats:{}})).outputs.length,0);
  assert.match((await ref.project({...profile,level:'99'},candidate,worn)).reason,/level-100/);
  assert.equal(ref.stamina(255),2167.5); assert.equal(ref.stamina(256),2167.5); assert.equal(ref.stamina(257),2176);
  assert.equal(ref.wisdom(202),ref.wisdom(201));
  const send=(msg,url='https://www.raidloot.com/items/2')=>new Promise(resolve=>handler(msg,{url},resolve));
  const message={type:'GET_CHARACTER_PROJECTION',profileId:'p',targetIndex:0,expected:{id:'1',name:'Old',slot:'head'},item:candidate,classes:['BST']};
  const response=await send(message); assert.equal(response.ok,true); assert.equal(response.projection.mode,'reference');
  assert.equal(byMetric(response.projection).HP.delta,286);
  assert.equal((await send({...message,mode:'invalid'})).ok,false);
  assert.equal((await send(message,'https://evil.example')).ok,false);
  console.log('reference-stat estimates passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
