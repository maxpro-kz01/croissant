interface Props {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  label?: string;
}

export function Stepper({ value, onChange, min = 0, max = 50, label = '' }: Props) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label="−">
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label="+">
        +
      </button>
    </div>
  );
}
