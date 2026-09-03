import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import './app-shell.css';

const NAV_ITEMS = [
  { to: '/', label: 'Início', icon: '🏠' },
  { to: '/sessao', label: 'Sessão', icon: '⏱' },
  { to: '/guilda', label: 'Guilda', icon: '🛡' },
  { to: '/perfil', label: 'Perfil', icon: '👤' },
];

function NavLinks(): ReactNode {
  return (
    <>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => (isActive ? 'active' : undefined)}
        >
          <span aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </>
  );
}

/**
 * Shell responsivo (ADR-008): sidebar fixa em desktop (>1024px, espelhando
 * a Documentação de Interface), navegação inferior em mobile/tablet.
 */
export function AppShell(): ReactNode {
  return (
    <div className="app-shell">
      <nav className="app-shell__sidebar" aria-label="Navegação principal">
        <NavLinks />
      </nav>
      <main className="app-shell__content">
        <Outlet />
      </main>
      <nav className="app-shell__bottom-nav" aria-label="Navegação principal">
        <NavLinks />
      </nav>
    </div>
  );
}
