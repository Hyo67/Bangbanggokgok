'use client';

// 카테고리 편집 — Trip.addCategory, TripCategory.deleteCategory
// 기본 카테고리 5개는 지울 수 없고, 지운 카테고리의 지출은 '기타'로 옮겨진다.

import { useState, type FormEvent } from 'react';
import { errorText } from '../common/api';
import { categoryLook, Icon } from '../common/Icon';
import { SheetHead, useSheet, useToast } from '../common/overlay';
import { useTrip } from './TripContext';

export function CategorySheet({ close }: { close(): void }) {
  const { trip, mutate } = useTrip();
  const sheet = useSheet();
  const toast = useToast();
  const [name, setName] = useState('');

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await mutate('POST', '/categories', { name });
      setName('');
      toast('카테고리를 추가했어요');
    } catch (err) {
      toast(errorText(err));
    }
  }

  async function remove(categoryId: string, label: string) {
    const used = trip.expenses.filter((e) => e.categoryId === categoryId).length;
    const ok = await sheet.confirm({
      title: `'${label}' 카테고리를 삭제할까요?`,
      body: used ? `이 카테고리의 지출 ${used}건은 '기타'로 옮겨져요.` : '아직 이 카테고리로 기록한 지출은 없어요.',
      ok: '삭제',
      danger: true,
    });
    if (!ok) return;
    try {
      await mutate('DELETE', `/categories/${categoryId}`);
      toast('카테고리를 삭제했어요');
    } catch (err) {
      toast(errorText(err));
    }
  }

  return (
    <>
      <SheetHead title="카테고리 편집" onClose={close} />
      <ul className="rows">
        {trip.categories.map((c) => {
          const look = categoryLook(c);
          return (
            <li key={c.categoryId}>
              <span className="row-label">
                <span className={`cat-ic sm tone-${look.tone}`}>
                  <Icon name={look.icon} size={20} />
                </span>
                {c.name}
              </span>
              {c.isDefault ? (
                <span className="badge">기본</span>
              ) : (
                <button type="button" className="round sm" aria-label={`${c.name} 삭제`} onClick={() => remove(c.categoryId, c.name)}>
                  <Icon name="trash" size={18} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <form className="inline-form" onSubmit={add}>
        <label className="field field-grow">
          <span className="field-ic">
            <Icon name="tag" />
          </span>
          <input name="name" placeholder="새 카테고리 (예: 투어)" maxLength={10} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="btn primary">추가</button>
      </form>
    </>
  );
}
