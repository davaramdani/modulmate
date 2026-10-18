import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkPages, selectCitedSources, tutorPrompt } from '../src/lib/rag';

test('chunking retains page provenance and every word of a long passage',()=>{
  const words=Array.from({length:800},(_,i)=>`concept${i}`);
  const chunks=chunkPages([{page:3,text:words.join(' ')},{page:8,text:'Foreign key adalah atribut yang mengacu ke primary key tabel lain.'}]);
  assert.ok(chunks.length>3);
  for(const word of words)assert.ok(chunks.some(c=>c.content.includes(word)),`Missing ${word}`);
  assert.equal(chunks.at(-1)?.page,8);
  chunks.forEach((c,i)=>{assert.equal(c.chunk_index,i);assert.ok(c.content.length<=1000);});
  assert.ok(chunks.slice(0,-1).every(c=>c.page===3));
});
test('scanned or blank pages do not produce invented chunks',()=>{
  assert.deepEqual(chunkPages([{page:1,text:'  \n  '},{page:2,text:'12'}]),[]);
});
test('only existing cited sources are displayed',()=>{
  const sources=[{id:1,page:4,chunkId:'a',content:'alpha'},{id:2,page:8,chunkId:'b',content:'beta'}];
  assert.deepEqual(selectCitedSources('Sumber [2] dan [99]. Ulangi [2].',sources),[sources[1]]);
  assert.deepEqual(selectCitedSources('Tidak ditemukan.',sources),[]);
});
test('every study mode retains grounding and document trust boundaries',()=>{
  for(const mode of ['ask','simple','tutor'] as const){
    assert.match(tutorPrompt(mode),/belum ditemukan/);
    assert.match(tutorPrompt(mode),/tidak tepercaya/);
    assert.match(tutorPrompt(mode),/sitasi/);
  }
});
