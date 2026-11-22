import { normalizeSheet } from './sheet-model.js?v=20261122-font-rehash1';

// Date correction can reuse a record only when every other documented value,
// including creation/row/case IDs, explicit zeroes and the original photo, agrees.
export function sameSheetContent(left, right) {
  const content = value => {
    const { id, date, updatedAt, ...body } = normalizeSheet(value);
    return JSON.stringify(body);
  };
  return content(left) === content(right);
}
export const validBaseDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

export class DateMoveConflictError extends Error {
  constructor(message = '다른 곳에서 이 기록이 변경되어 날짜를 옮기지 않았어요. 작성 내용은 보존했어요. 최신 기록을 확인한 뒤 다시 시도해 주세요.') {
    super(message); this.name = 'DateMoveConflictError'; this.code = 'callback/date-move-conflict';
  }
}
