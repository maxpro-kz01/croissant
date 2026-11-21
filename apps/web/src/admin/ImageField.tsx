import { useRef, useState, type ReactNode } from 'react';
import { auth } from '../api';

/** Сжимает фото с телефона (часто 5–10 МБ) до ~1000 px и JPEG: быстро грузится и мало места в базе. */
async function shrink(file: File, maxSide = 1000, quality = 0.85): Promise<Blob> {
  let source: CanvasImageSource & { width: number; height: number };
  let release = () => {};
  try {
    // imageOrientation: фото с телефона не должно «ложиться на бок».
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    source = bmp;
    release = () => bmp.close();
  } catch {
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise<void>((ok, fail) => {
      img.onload = () => ok();
      img.onerror = () => fail(new Error('decode'));
      img.src = url;
    });
    URL.revokeObjectURL(url);
    source = img;
  }
  const k = Math.min(1, maxSide / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * k));
  const h = Math.max(1, Math.round(source.height * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = '#fff'; // у PNG с прозрачностью фон станет белым, а не чёрным
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  release();
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('encode'))), 'image/jpeg', quality));
}

/** Загружает выбранный файл на сервер и возвращает адрес фото. */
export async function uploadImage(file: File): Promise<string> {
  let blob: Blob;
  try {
    blob = await shrink(file);
  } catch {
    throw new Error('Не удалось открыть это фото. Выберите JPEG или PNG.');
  }
  let res: Response;
  try {
    res = await fetch('/api/admin/images', {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg', Authorization: `Bearer ${auth.token ?? ''}` },
      body: blob,
    });
  } catch {
    throw new Error('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.');
  }
  if (res.status === 401) {
    auth.set(null);
    window.dispatchEvent(new Event('croissant:logout'));
    throw new Error('Войдите в админку заново.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Не удалось загрузить фото');
  return (data as { url: string }).url;
}

/** Кнопка (или любой другой вид) выбора фото: открывает камеру/галерею телефона. */
export function PhotoPicker({
  onUploaded,
  onError,
  className,
  children,
  disabled,
}: {
  onUploaded: (url: string) => void;
  onError: (message: string) => void;
  className?: string;
  children: (busy: boolean) => ReactNode;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onUploaded(await uploadImage(file));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Не удалось загрузить фото');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={className} disabled={busy || disabled} onClick={() => input.current?.click()}>
        {children(busy)}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ''; // чтобы можно было выбрать тот же файл ещё раз
          void pick(f);
        }}
      />
    </>
  );
}

/** Поле «Фото» для формы: превью + выбрать/заменить/убрать. Ссылку вручную тоже можно вставить. */
export function ImageField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [err, setErr] = useState('');
  return (
    <div className="field imgfield">
      <span>Фото</span>
      <div className="imgfield__row">
        <div className="imgfield__preview">{value ? <img src={value} alt="" /> : <span className="hint">Нет фото</span>}</div>
        <div className="imgfield__btns">
          <PhotoPicker
            className="btn btn--sm"
            onUploaded={(u) => {
              setErr('');
              onChange(u);
            }}
            onError={setErr}
          >
            {(busy) => (busy ? 'Загружаю…' : value ? 'Заменить фото' : 'Выбрать фото')}
          </PhotoPicker>
          {value && (
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => onChange('')}>
              Убрать
            </button>
          )}
        </div>
      </div>
      {err && <p className="err">{err}</p>}
      <details className="imgfield__link">
        <summary>Вставить ссылку на фото</summary>
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" />
      </details>
    </div>
  );
}
