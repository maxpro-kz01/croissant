/**
 * Знак Croissant: круассан и лучи. Перерисован как SVG по логотипу заведения;
 * официальный файл логотипа лучше положить в public/ и подключить вместо этого компонента.
 */
export function Mark({ size = 120, animate = false, className = '' }: { size?: number; animate?: boolean; className?: string }) {
  return (
    <svg
      className={`mark ${animate ? 'mark--draw' : ''} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      stroke="currentColor"
      strokeWidth={4.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g className="mark__rays">
        {['M10 100H60', 'M18 76L58 86', 'M18 124L58 114', 'M30 52L64 70', 'M30 148L64 130', 'M50 30L76 54', 'M50 170L76 146'].map((d, i) => (
          <path key={d} d={d} pathLength={1} style={{ ['--i' as string]: i }} />
        ))}
      </g>
      <g className="mark__body">
        <path pathLength={1} d="M80 80 L120 74 Q130 100 120 126 L80 120 Q72 100 80 80Z" />
        <path pathLength={1} d="M96 64 Q112 50 132 56 L142 76 Q124 78 108 74Z" />
        <path pathLength={1} d="M96 136 Q112 150 132 144 L142 124 Q124 122 108 126Z" />
        <path pathLength={1} d="M148 34 L176 30 L164 54Z" />
        <path pathLength={1} d="M148 166 L176 170 L164 146Z" />
      </g>
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <span className="wordmark__name">croissant</span>
      <span className="wordmark__tag">cakes and coffee</span>
    </span>
  );
}
