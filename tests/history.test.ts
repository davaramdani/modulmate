import test from 'node:test';
import assert from 'node:assert/strict';
import { historyPagination } from '../src/lib/history';

test('history ranges do not overlap and use inclusive Supabase bounds',()=>{
  const first=historyPagination(1,21),second=historyPagination(2,21),third=historyPagination(3,21);
  assert.deepEqual([first.from,first.to,first.start,first.end],[0,9,1,10]);
  assert.deepEqual([second.from,second.to,second.start,second.end],[10,19,11,20]);
  assert.deepEqual([third.from,third.to,third.start,third.end],[20,29,21,21]);
});
test('deleting the only item on the final page returns to the previous page',()=>{
  const before=historyPagination(3,21),after=historyPagination(before.page,20);
  assert.equal(after.page,2);assert.equal(after.pageCount,2);assert.equal(after.from,10);
  assert.deepEqual(historyPagination(1,0).buttons,[1]);
  assert.equal(historyPagination(1,0).start,0);
});
test('large histories keep first, last and nearby pages without an oversized pager',()=>{
  const state=historyPagination(51,1500);
  assert.equal(state.pageCount,150);
  assert.deepEqual(state.buttons,[1,'gap',50,51,52,'gap',150]);
  assert.equal(state.from,500);assert.equal(state.to,509);
  assert.deepEqual(historyPagination(1,21).buttons,[1,2,3]);
});
