// Trip 모듈 — TripCategory: 기본 카테고리 생성, TripCategory.deleteCategory

import { DEFAULT_CATEGORY_NAMES, DEFAULT_CATEGORY_TYPES } from '@/shared/domain';
import type { Sql } from '../common/db';
import { HttpError } from '../common/errors';
import { newId } from '../common/validate';
import { withLockedTrip } from './tripRepository';

export const MAX_CATEGORIES = 15;

// 여행방마다 DefaultCategoryType 5개를 만든다. 만든 순서대로 id를 돌려준다.
export async function createDefaultCategories(tx: Sql, tripId: string): Promise<string[]> {
  const ids: string[] = [];
  for (const [i, type] of DEFAULT_CATEGORY_TYPES.entries()) {
    const categoryId = newId();
    await tx.query(
      'insert into trip_categories (category_id, trip_id, name, sort_order, is_default) values ($1, $2, $3, $4, true)',
      [categoryId, tripId, DEFAULT_CATEGORY_NAMES[type], i],
    );
    ids.push(categoryId);
  }
  return ids;
}

// 기본 카테고리는 지울 수 없다. 지운 카테고리의 지출은 '기타'로 옮긴다.
export const deleteCategory = (tripId: string, categoryId: string) =>
  withLockedTrip(tripId, async (tx) => {
    const [row] = await tx.query<{ is_default: boolean }>(
      'select is_default from trip_categories where trip_id = $1 and category_id = $2',
      [tripId, categoryId],
    );
    if (!row) throw new HttpError(404, '이미 삭제된 카테고리예요.');
    if (row.is_default) throw new HttpError(409, '기본 카테고리는 삭제할 수 없어요.');
    await tx.query(
      `update expenses set category_id = (
         select category_id from trip_categories where trip_id = $1 and is_default and name = $3)
        where trip_id = $1 and category_id = $2`,
      [tripId, categoryId, DEFAULT_CATEGORY_NAMES.ETC],
    );
    await tx.query('delete from trip_categories where category_id = $1', [categoryId]);
  }).then(({ trip }) => ({ trip }));
