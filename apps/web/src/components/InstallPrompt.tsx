import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../store';

/** Событие Chrome/Android «можно установить». В типах TS его нет. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const KEY = 'croissant_install_dismissed';
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000; // «Позже» — снова покажем через 3 дня
const DELAY_MS = 4000; // даём гостю сначала увидеть меню

const T = {
  ru: {
    title: 'Приложение Croissant',
    text: 'Меню и заказ в один тап — прямо с экрана телефона.',
    install: 'Установить',
    later: 'Позже',
    iosTitle: 'Добавьте на экран «Домой»',
    ios1: 'Нажмите «Поделиться»',
    ios2: 'Выберите «На экран „Домой“»',
    ios3: 'Нажмите «Добавить»',
    inapp: 'Откройте сайт в Chrome или Safari (меню ⋮ или ··· → «Открыть в браузере»), чтобы установить приложение.',
    ok: 'Понятно',
  },
  kk: {
    title: 'Croissant қосымшасы',
    text: 'Мәзір мен тапсырыс — телефон экранынан бір басумен.',
    install: 'Орнату',
    later: 'Кейін',
    iosTitle: '«Басты экранға» қосыңыз',
    ios1: '«Бөлісу» батырмасын басыңыз',
    ios2: '«Басты экранға» таңдаңыз',
    ios3: '«Қосу» батырмасын басыңыз',
    inapp: 'Қосымшаны орнату үшін сайтты Chrome немесе Safari-де ашыңыз (⋮ немесе ··· мәзірі → «Браузерде ашу»).',
    ok: 'Түсінікті',
  },
} as const;

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function snoozed() {
  try {
    const t = Number(localStorage.getItem(KEY));
    return Number.isFinite(t) && Date.now() - t < SNOOZE_MS;
  } catch {
    return false;
  }
}

function snooze() {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* приватный режим */
  }
}

const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
const isIOS = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
const isInApp = /instagram|fban|fbav|whatsapp|telegram|tiktok|; wv\)/i.test(ua);
const isMobile = isIOS || /android/i.test(ua);

type Mode = 'native' | 'ios' | 'inapp';

/** Автоматическое окошко «Установить приложение» для гостей (не в админке). */
export function InstallPrompt() {
  const lang = useApp((s) => s.lang);
  const { pathname } = useLocation();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const t = T[lang] ?? T.ru;
  const guestPage = !pathname.startsWith('/admin') && !pathname.startsWith('/pay');

  // Android/Chrome: ловим событие установки, сами решаем когда показать окно.
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setMode(null);
      snooze();
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!guestPage || isStandalone() || snoozed() || mode) return;
    const id = setTimeout(() => {
      if (deferred) setMode('native');
      else if (isInApp && isMobile) setMode('inapp');
      else if (isIOS) setMode('ios');
    }, DELAY_MS);
    return () => clearTimeout(id);
  }, [guestPage, deferred, mode]);

  const close = () => {
    snooze();
    setMode(null);
  };

  const install = async () => {
    if (!deferred) return close();
    await deferred.prompt();
    const { outcome } = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
    setDeferred(null);
    setMode(null);
    if (outcome !== 'accepted') snooze();
  };

  return (
    <AnimatePresence>
      {mode && guestPage && (
        <motion.div
          className="install-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            className="install"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-title"
            initial={{ y: 60, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="install__x" onClick={close} aria-label={t.later}>
              ×
            </button>
            <div className="install__head">
              <img className="install__icon" src="/icon-192.png" alt="" width={64} height={64} />
              <div>
                <h2 id="install-title">{mode === 'ios' ? t.iosTitle : t.title}</h2>
                {mode !== 'ios' && <p>{mode === 'inapp' ? t.inapp : t.text}</p>}
              </div>
            </div>

            {mode === 'ios' && (
              <ol className="install__steps">
                <li>
                  <span className="install__num">1</span>
                  {t.ios1}
                  <svg className="install__share" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
                  </svg>
                </li>
                <li>
                  <span className="install__num">2</span>
                  {t.ios2}
                  <span className="install__plus">＋</span>
                </li>
                <li>
                  <span className="install__num">3</span>
                  {t.ios3}
                </li>
              </ol>
            )}

            <div className="install__actions">
              {mode === 'native' ? (
                <>
                  <button className="install__btn install__btn--ghost" onClick={close}>
                    {t.later}
                  </button>
                  <button className="install__btn" onClick={() => void install()}>
                    {t.install}
                  </button>
                </>
              ) : (
                <button className="install__btn" onClick={close}>
                  {t.ok}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
