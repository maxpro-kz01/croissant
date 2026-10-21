import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Нижняя шторка: закрывается по Esc, по тапу на фон и свайпом вниз. */
export function Sheet({ open, onClose, title, children, footer }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="sheet-back"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => info.offset.y > 120 && onClose()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet__grab" />
            <div className="sheet__head">
              <h2>{title}</h2>
              <button className="sheet__close" onClick={onClose} aria-label="×">
                ×
              </button>
            </div>
            <div className="sheet__body">{children}</div>
            {footer && <div className="sheet__foot">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
