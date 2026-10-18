export const SIDEBAR_HISTORY_LIMIT = 3;
export const HISTORY_PAGE_SIZE = 10;

export function historyPagination(requestedPage: number, total: number, pageSize = HISTORY_PAGE_SIZE) {
  const size = Math.max(1, Math.floor(pageSize));
  const count = Math.max(0, Math.floor(total));
  const pageCount = Math.max(1, Math.ceil(count / size));
  const page = Math.min(Math.max(1, Math.floor(requestedPage)), pageCount);
  const from = (page - 1) * size;
  // Supabase range() uses an inclusive upper bound.
  const to = from + size - 1;
  const candidates = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter(number => number >= 1 && number <= pageCount).sort((a,b) => a-b);
  const buttons: (number | 'gap')[] = [];
  for (const number of candidates) {
    const previous = buttons.at(-1);
    if (typeof previous === 'number') {
      if (number - previous === 2) buttons.push(previous + 1);
      else if (number - previous > 2) buttons.push('gap');
    }
    buttons.push(number);
  }
  return { page, pageCount, from, to, start: count ? from + 1 : 0, end: Math.min(from + size, count), buttons };
}
