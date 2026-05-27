import React, { useState, createContext, useContext, useCallback, useMemo } from 'react';

const ToastCtx = createContext(null);
const icons  = { success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️', ai: '✦' };
const colors = {
  success: { border: '#16A34A', bg: '#F0FDF4' },
  warning: { border: '#D97706', bg: '#FFFBEB' },
  error:   { border: '#DC2626', bg: '#FEF2F2' },
  info:    { border: '#3B82F6', bg: '#EFF6FF' },
  ai:      { border: '#7C3AED', bg: '#F5F3FF' },
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t.slice(-2), { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  /* Support both toast('msg','type') and toast.success('msg') */
  const toast = useMemo(() => {
    const fn = (message, type = 'success') => addToast(message, type);
    fn.success = (msg) => addToast(msg, 'success');
    fn.error   = (msg) => addToast(msg, 'error');
    fn.warning = (msg) => addToast(msg, 'warning');
    fn.info    = (msg) => addToast(msg, 'info');
    fn.ai      = (msg) => addToast(msg, 'ai');
    return fn;
  }, [addToast]);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => {
          const c = colors[t.type] || colors.info;
          return (
            <div key={t.id} style={{
              background: 'white', borderLeft: `4px solid ${c.border}`,
              borderRadius: 10, padding: '12px 16px', boxShadow: 'var(--shadow-md)',
              display: 'flex', alignItems: 'flex-start', gap: 10,
              maxWidth: 340, fontSize: 13, animation: 'fadeUp 0.3s ease',
            }}>
              <span>{icons[t.type]}</span>
              <span style={{ color: 'var(--text-1)', lineHeight: 1.4 }}>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
};

export const useToast = () => useContext(ToastCtx);
