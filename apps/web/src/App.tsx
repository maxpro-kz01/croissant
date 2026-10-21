import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api';
import { useApp } from './store';
import { CheckoutPage } from './pages/CheckoutPage';
import { MenuPage } from './pages/MenuPage';
import { MockPayPage } from './pages/MockPayPage';
import { OrderPage } from './pages/OrderPage';

// Админка грузится отдельным куском: гостям она не нужна.
const AdminRoutes = lazy(() => import('./admin/AdminRoutes'));

/** QR на столе открывает /?t=<код>: проверяем код на сервере и запоминаем номер стола. */
function useTableFromQr() {
  const { search, pathname } = useLocation();
  const navigate = useNavigate();
  const setTable = useApp((s) => s.setTable);
  useEffect(() => {
    const code = new URLSearchParams(search).get('t');
    if (!code) return;
    api
      .get<{ number: number }>(`/api/tables/${encodeURIComponent(code)}`)
      .then((t) => setTable(code, t.number))
      .catch(() => setTable(null, null))
      .finally(() => navigate(pathname, { replace: true }));
  }, [search, pathname, navigate, setTable]);
}

export function App() {
  const lang = useApp((s) => s.lang);
  useEffect(() => {
    document.documentElement.lang = lang === 'kk' ? 'kk' : 'ru';
  }, [lang]);
  useTableFromQr();

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<MenuPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order/:id" element={<OrderPage />} />
        <Route path="/pay/mock/:externalId" element={<MockPayPage />} />
        <Route path="/admin/*" element={<AdminRoutes />} />
        <Route path="*" element={<MenuPage />} />
      </Routes>
    </Suspense>
  );
}
