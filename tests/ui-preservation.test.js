const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const baseline=require('./ui-baseline-hashes.json');
const root=path.resolve(__dirname,'..');
const normalize=text=>text.replace(/\r\n/g,'\n').replace(/\/v\d+\//g,'/VERSION/');
test('all existing styles and page markup retain the original design',()=>{
 for(const [name,hash] of Object.entries(baseline)){
  let source=fs.readFileSync(path.join(root,name==='index-before-runtime'?'index.html':name),'utf8');
  if(name==='index-before-runtime')source=source.slice(0,source.indexOf('  <!-- Runtime Scripts -->'));
  assert.equal(crypto.createHash('sha256').update(normalize(source)).digest('hex'),hash,name+' changed the original design');
 }
 assert(!fs.readFileSync(path.join(root,'index.html'),'utf8').includes('id="journalStatus"'));
});
