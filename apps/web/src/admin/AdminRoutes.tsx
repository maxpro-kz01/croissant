import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { api, auth } from '../api';
import './admin.css';
import { BoardPage } from './BoardPage';
import { HallPage } from './HallPage';
import { LoginPage, type AdminUser } from './LoginPage';
import { MenuEditorPage } from './MenuEditorPage';
import { ReportsPage } from './ReportsPage';
import { SettingsPage } from './SettingsPage';
import { ShiftsPage } from './ShiftsPage';
import { TablesPage } from './TablesPage';

export default function AdminRoutes() {
  // undefined — ещё проверяем токен, null — не вошли
  const [user, setUser] = useState<AdminUser | null | undefined>(auth.token ? undefined : null);

  useEffect(() => {
    if (!auth.token) return;
    api
      .get<{ user: AdminUser }>('/api/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    const out = () => setUser(null);
    window.addEventListener('croissant:logout', out);
    return () => window.removeEventListener('croissant:logout', out);
  }, []);

  if (user === undefined) return null;
  if (user === null) return <LoginPage onLogin={setUser} />;

  const isAdmin = user.role === 'admin';
  return (
    <div className="adm">
      <nav className="adm-nav" aria-label="Разделы">
        <span className="brand">Croissant</span>
        <NavLink to="/admin" end>Заказы</NavLink>
        <NavLink to="/admin/hall">Зал</NavLink>
        <NavLink to="/admin/shifts">Смена</NavLink>
        {isAdmin && <NavLink to="/admin/menu">Меню</NavLink>}
        {isAdmin && <NavLink to="/admin/tables">Столы и QR</NavLink>}
        {isAdmin && <NavLink to="/admin/reports">Отчёты</NavLink>}
        {isAdmin && <NavLink to="/admin/settings">Настройки</NavLink>}
        <span className="spacer" />
        <button
          onClick={() => {
            auth.set(null);
            setUser(null);
          }}
        >
          Выйти ({user.username})
        </button>
      </nav>
      <div className="adm-main">
        <Routes>
          <Route index element={<BoardPage />} />
          <Route path="hall" element={<HallPage />} />
          <Route path="shifts" element={<ShiftsPage />} />
          {isAdmin && <Route path="menu" element={<MenuEditorPage />} />}
          {isAdmin && <Route path="tables" element={<TablesPage />} />}
          {isAdmin && <Route path="reports" element={<ReportsPage />} />}
          {isAdmin && <Route path="settings" element={<SettingsPage />} />}
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </div>
    </div>
  );
}
