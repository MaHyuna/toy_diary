import test from 'node:test';
import assert from 'node:assert/strict';
import {pricingMenu,sameMenu} from '../src/pricing-menu.ts';
const pricing={services:[{id:'a',name:'목욕',basePrice:15000,duration:60}],breedRules:[{id:'b',breed:'비숑',amount:10000}],weightRules:[{id:'w',minWeight:5,maxWeight:10,amount:5000},{id:'x',minWeight:10,maxWeight:150,amount:8000}]};
test('public table combines exactly the owner base, breed and weight prices including boundaries',()=>{
 const menu=pricingMenu(pricing);
 assert.deepEqual(menu.sections[0].rows.map(r=>r.prices),[['15000'],['20000'],['23000']]);
 assert.deepEqual(menu.sections[1].rows.map(r=>r.prices),[['25000'],['30000'],['33000']]);
 assert.equal(menu.sections[0].rows[2].weight,'10~150kg 이하');
 const reordered={sections:menu.sections.map(s=>({rows:s.rows,items:s.items,content:s.content,note:s.note,breeds:s.breeds,title:s.title})),columns:menu.columns};
 assert.ok(sameMenu(reordered,menu));
 assert.equal(sameMenu(menu,pricingMenu({...pricing,services:[{...pricing.services[0],basePrice:16000}]})),false);
});
