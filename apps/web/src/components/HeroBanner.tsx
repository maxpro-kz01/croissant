import { useEffect, useRef, useState } from 'react';

const SLIDES = ['/banners/b1.jpg', '/banners/b2.jpg', '/banners/b3.jpg'];
const DELAY_MS = 3000;

/** Баннер с фото: листается сам каждые 3 секунды, можно свайпнуть или нажать на точку. */
export function HeroBanner() {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    if (hold) return;
    const id = setTimeout(() => setI((v) => (v + 1) % SLIDES.length), DELAY_MS);
    return () => clearTimeout(id);
  }, [i, hold]);

  const go = (n: number) => setI((n + SLIDES.length) % SLIDES.length);

  return (
    <div
      className="slider"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onTouchStart={(e) => {
        startX.current = e.touches[0].clientX;
        setHold(true);
      }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (startX.current ?? 0);
        if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
        startX.current = null;
        setHold(false);
      }}
    >
      <div className="slider__track" style={{ transform: `translateX(-${i * 100}%)` }}>
        {SLIDES.map((src, n) => (
          <img key={src} src={src} alt="" loading={n === 0 ? 'eager' : 'lazy'} draggable={false} />
        ))}
      </div>
      <div className="slider__dots">
        {SLIDES.map((_, n) => (
          <button key={n} type="button" aria-label={`Слайд ${n + 1}`} aria-current={n === i} onClick={() => go(n)} />
        ))}
      </div>
    </div>
  );
}
