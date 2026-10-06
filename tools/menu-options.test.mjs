import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
const read = async path => stripTypeScriptTypes(await readFile(new URL(path, import.meta.url), 'utf8'));
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const options = await import(url(await read('../apps/azglobe/src/supplier/services/menuOptions.ts')));
const depsUrl = url(`
const menus = new Map(); export const writes = []; let ready = false;
export const setReady = value => ready = value; export const isFirebaseReady = () => ready;
export const getApp = () => ({}); export const getFirestore = () => ({});
export const collection = (_, path) => path; export const doc = (path, id) => path + '/' + id;
export const setDoc = async (path, value) => writes.push({path,value}); export const updateDoc = setDoc; export const deleteDoc = () => {};
export const readCollection = async () => ({rows:[]});
export const readDemoMenu = id => menus.get(id) ?? []; export const writeDemoMenu = (id, items) => menus.set(id, items);
`);
let source = await read('../apps/azglobe/src/supplier/services/menu.ts');
for (const name of ['@core/firebase/firestore', '@core/firebase', '@core/firebase/db', '@modules/food/services/demoCatalogue']) source = source.replaceAll(`'${name}'`, JSON.stringify(depsUrl));
const menu = await import(url(source)); const deps = await import(depsUrl);
const input = { name:'Kottu', description:'Chicken',price:450,category:'Food',image:'kottu' };
test('option groups round-trip IDs, defaults and prices without mutation', () => {
  const group = options.optionTemplate('Size'); group.choices[1].price = '400';
  const saved = options.parseOptions([group]);
  assert.equal(saved[0].choices[1].priceDelta,400);
  assert.equal(saved[0].defaultChoiceId, group.choices[1].id);
  assert.deepEqual(options.parseOptions(options.draftOptions(saved)), saved);
  assert.equal(group.choices[1].price, '400');
});
test('invalid choices, duplicate labels and prices are rejected', () => {
  const group = options.optionTemplate('Add-ons');
  for (const price of ['', '-1', 'NaN', '1.234']) { group.choices[0].price = price; assert.throws(() => options.parseOptions([group])); }
  group.choices[0].price = '0'; group.choices[1].label = group.choices[0].label;
  assert.throws(() => options.parseOptions([group]), /unique/);
  group.choices = []; assert.throws(() => options.parseOptions([group]), /at least one/);
});
test('provider creation and editing update the shared customer catalogue', async () => {
  const groups = options.parseOptions([options.optionTemplate('Size'), options.optionTemplate('Add-ons')]);
  const id = await menu.createMenuItem('shop','Shop',{...input,optionGroups:groups});
  assert.deepEqual(deps.readDemoMenu('shop')[0].optionGroups,groups);
  await menu.updateMenuItem('shop',id,{...input,name:'Renamed'});
  assert.deepEqual(deps.readDemoMenu('shop')[0].optionGroups,groups);
  await menu.updateMenuItem('shop',id,{...input,optionGroups:[]});
  assert.deepEqual(deps.readDemoMenu('shop')[0].optionGroups,[]);
});
test('Firebase writes include customization data for new and edited dishes', async () => {
  deps.setReady(true);
  const groups = options.parseOptions([options.optionTemplate('Spice Level')]);
  const id = await menu.createMenuItem('shop','Shop',{...input,optionGroups:groups});
  await menu.updateMenuItem('shop',id,{...input,optionGroups:groups});
  assert.deepEqual(deps.writes.at(-1).value.optionGroups,groups);
  assert.deepEqual(deps.writes.at(-2).value.optionGroups,groups);
});
test('presets use required sizes, optional spice and multi-select extras with free prices', () => {
  const size = options.optionTemplate('Size');
  assert.deepEqual(size.choices.map(c => c.label), ['Small','Medium','Large']);
  assert.equal(size.defaultChoiceId, size.choices[1].id);
  assert.equal(options.optionTemplate('Spice Level').required, false);
  for (const label of ['Add-ons', 'Extras']) {
    const group = options.optionTemplate(label);
    assert.equal(group.type, 'multi'); assert.equal(group.required, false);
    assert.ok(group.choices.every(c => c.price === '0'));
  }
});
test('bulk entry parses free and paid choices and rejects malformed prices', () => {
  assert.deepEqual(options.quickChoices('Small\nMedium +100, Large +Rs. 200.50').map(({label, price}) => ({label,price})), [
    {label:'Small',price:'0'}, {label:'Medium',price:'100'}, {label:'Large',price:'200.50'},
  ]);
  for (const bad of ['', 'Egg +oops', 'Egg +-100', 'Egg +1.001', 'Egg, egg']) assert.throws(() => options.quickChoices(bad));
});
test('duplicating remaps default IDs and cannot mutate original options', () => {
  const original = options.optionTemplate('Size'); const copy = options.copyOptions(original, 'Drink size');
  assert.notEqual(copy.key, original.key); assert.equal(copy.label,'Drink size');
  assert.equal(copy.defaultChoiceId,copy.choices[1].id); assert.notEqual(copy.defaultChoiceId,original.defaultChoiceId);
  copy.choices[0].price = '200'; assert.equal(original.choices[0].price,'0');
});
test('optional single defaults persist; removed defaults safely fall back for required groups', () => {
  const group = options.optionTemplate('Spice Level'); group.defaultChoiceId = group.choices[1].id;
  assert.equal(options.parseOptions([group])[0].defaultChoiceId,group.choices[1].id);
  group.choices.splice(1,1); assert.equal(options.parseOptions([group])[0].defaultChoiceId,undefined);
  group.required = true; assert.equal(options.parseOptions([group])[0].defaultChoiceId,group.choices[0].id);
});
test('saved templates stay scoped to their restaurant and updates preserve other templates', async () => {
  const templateDeps = url(`
    const data = new Map(); let ready = false; export const writes = [];
    export const setReady = value => ready = value; export const isFirebaseReady = () => ready;
    export const createStorage = () => ({ getString: key => data.get(key), set: (key,value) => data.set(key,value) });
    export const getApp = () => ({}); export const getFirestore = () => ({});
    export const collection = (_,path) => path; export const doc = (path,id) => path + '/' + id;
    export const updateDoc = async (path,value) => writes.push({path,value});
    export const readDoc = async () => ({customizationTemplates:{saved:{label:'Shared size'}}});
  `);
  let service = await read('../apps/azglobe/src/supplier/services/customizationTemplates.ts');
  for (const name of ['@core/firebase/firestore','@core/firebase','@core/firebase/db','@core/storage']) service = service.replaceAll(`'${name}'`,JSON.stringify(templateDeps));
  const templates = await import(url(service)); const mock = await import(templateDeps);
  const size = options.parseOptions([options.optionTemplate('Size')])[0];
  await templates.saveCustomizationTemplate('shop-a',{id:'one',group:size});
  await templates.saveCustomizationTemplate('shop-a',{id:'two',group:{...size,label:'Rice size'}});
  await templates.saveCustomizationTemplate('shop-a',{id:'one',group:{...size,label:'Drink size'}});
  assert.equal((await templates.listCustomizationTemplates('shop-a')).length,2);
  assert.deepEqual(await templates.listCustomizationTemplates('shop-b'),[]);
  const copy = await templates.listCustomizationTemplates('shop-a'); copy[0].group.label='Changed locally';
  assert.notEqual((await templates.listCustomizationTemplates('shop-a'))[0].group.label,'Changed locally');
  mock.setReady(true);
  await templates.saveCustomizationTemplate('shop-a',{id:'one',group:size});
  assert.deepEqual(mock.writes[0],{path:'merchants/shop-a',value:{'customizationTemplates.one':size}});
  assert.equal((await templates.listCustomizationTemplates('shop-a'))[0].id,'saved');
});
