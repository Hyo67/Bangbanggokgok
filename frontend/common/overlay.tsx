'use client';

// 토스트와 바텀시트. 시트는 모바일에서 바텀시트, 넓은 화면에서 가운데 모달로 뜬다.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

/* ---------- 토스트 ---------- */

const ToastContext = createContext<(message: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useCallback((text: string) => {
    setMessage(text);
    setShown(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(false), 2400);
  }, []);
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div id="toast" className={shown ? 'show' : ''} role="status" aria-live="polite">
        {message}
      </div>
    </ToastContext.Provider>
  );
}

/* ---------- 시트 ---------- */

export function SheetFrame({ children, onClose, dismissible = true }: { children: ReactNode; onClose: () => void; dismissible?: boolean }) {
  useEffect(() => {
    if (!dismissible) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dismissible, onClose]);
  return (
    <div className="sheet-backdrop" onClick={(e) => dismissible && e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

export const SheetHead = ({ title, onClose }: { title: ReactNode; onClose: () => void }) => (
  <div className="sheet-head">
    <h2>{title}</h2>
    <button type="button" className="round sm" onClick={onClose} aria-label="닫기">
      <Icon name="x" size={18} />
    </button>
  </div>
);

type Render = (close: () => void) => ReactNode;
interface OpenSheet {
  id: number;
  render: Render;
  close: () => void;
}
interface ConfirmOptions {
  title: string;
  body?: string;
  ok: string;
  danger?: boolean;
}
interface SheetApi {
  open(render: Render, opts?: { onClose?: () => void }): () => void;
  confirm(opts: ConfirmOptions): Promise<boolean>;
}

const SheetContext = createContext<SheetApi | null>(null);
export const useSheet = () => useContext(SheetContext)!;

let nextId = 0;

// 시트 안의 화면이 여행방 상태를 쓸 수 있도록 TripProvider 안쪽에 둔다.
export function SheetProvider({ children }: { children: ReactNode }) {
  const [sheets, setSheets] = useState<OpenSheet[]>([]);

  const api = useMemo<SheetApi>(() => {
    const open: SheetApi['open'] = (render, { onClose } = {}) => {
      const id = ++nextId;
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        setSheets((list) => list.filter((s) => s.id !== id));
        onClose?.();
      };
      setSheets((list) => [...list, { id, render, close }]);
      return close;
    };
    const confirm: SheetApi['confirm'] = ({ title, body = '', ok, danger = false }) =>
      new Promise((resolve) => {
        let answer = false;
        open(
          (close) => (
            <>
              <h2>{title}</h2>
              <p className="sheet-desc">{body}</p>
              <div className="btn-row">
                <button type="button" className="btn ghost" onClick={close}>
                  닫기
                </button>
                <button
                  type="button"
                  className={`btn ${danger ? 'danger' : 'primary'}`}
                  onClick={() => {
                    answer = true;
                    close();
                  }}
                >
                  {ok}
                </button>
              </div>
            </>
          ),
          { onClose: () => resolve(answer) },
        );
      });
    return { open, confirm };
  }, []);

  return (
    <SheetContext.Provider value={api}>
      {children}
      {sheets.map((s) => (
        <SheetFrame key={s.id} onClose={s.close}>
          {s.render(s.close)}
        </SheetFrame>
      ))}
    </SheetContext.Provider>
  );
}
