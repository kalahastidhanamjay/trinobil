import clsx from 'clsx';
import {
  BarChart3,
  Boxes,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  UserCog,
  Users,
  Wallet,
  Warehouse,
  X,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { call, identity } from '@/lib/api';
import { Logo } from '../components/Logo';
import { useAuth } from '@/lib/auth';

type Item = { to: string; label: string; icon: ReactNode; show: boolean; key?: string };

/** Function keys that jump between screens from anywhere. */
const hotkeys: Record<string, string> = { F2: '/billing', F3: '/sales', F4: '/items', F6: '/customers', F8: '/reports' };

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="num whitespace-nowrap text-xs text-slate-400">
      <span className="hidden sm:inline">{now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })} </span>
      <span className="text-slate-200">{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
    </span>
  );
}

export function AppLayout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const business = useQuery({ queryKey: ['business'], queryFn: () => call(identity.GET('/api/v1/users/business')) });
  const canBill = auth.hasRole('OWNER', 'MANAGER', 'CASHIER');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const to = hotkeys[e.key];
      if (!to || e.altKey || e.ctrlKey || e.metaKey) return;
      if (to === '/billing' && !canBill) return;
      e.preventDefault();
      navigate(to);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, canBill]);

  const groups: { title: string; items: Item[] }[] = [
    {
      title: 'Sell',
      items: [
        { to: '/', label: 'Dashboard', icon: <LayoutDashboard />, show: true },
        { to: '/billing', label: 'New bill', icon: <ShoppingCart />, show: canBill, key: 'F2' },
        { to: '/sales', label: 'Sales', icon: <Receipt />, show: true, key: 'F3' },
        { to: '/customers', label: 'Customers', icon: <Users />, show: true, key: 'F6' },
      ],
    },
    {
      title: 'Stock',
      items: [
        { to: '/items', label: 'Items', icon: <Boxes />, show: true, key: 'F4' },
        { to: '/purchases', label: 'Purchases', icon: <ClipboardList />, show: auth.isBackOffice },
        { to: '/suppliers', label: 'Suppliers', icon: <Truck />, show: auth.isBackOffice },
        { to: '/stock', label: 'Stock', icon: <Warehouse />, show: auth.canManage },
      ],
    },
    {
      title: 'Business',
      items: [
        { to: '/expenses', label: 'Expenses', icon: <Wallet />, show: auth.isBackOffice },
        { to: '/reports', label: 'Reports', icon: <BarChart3 />, show: auth.isBackOffice, key: 'F8' },
        { to: '/staff', label: 'Staff', icon: <UserCog />, show: auth.canManage },
        { to: '/settings', label: 'Settings', icon: <Settings />, show: auth.canManage },
        { to: '/activity', label: 'Activity log', icon: <History />, show: auth.canManage },
      ],
    },
  ];

  const nav = (
    <nav className="flex h-full flex-col bg-chrome text-slate-300">
      <div className="flex h-12 items-center gap-2.5 border-b border-white/5 px-4">
        <Logo size={24} />
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {groups.map((g) => {
          const items = g.items.filter((i) => i.show);
          if (items.length === 0) return null;
          return (
            <div key={g.title}>
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{g.title}</p>
              {items.map((i) => (
                <NavLink
                  key={i.to}
                  to={i.to}
                  end={i.to === '/'}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition [&>svg]:size-4',
                      isActive ? 'bg-chrome-3 text-white' : 'hover:bg-chrome-2 hover:text-white',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded bg-brand-500" />}
                      {i.icon}
                      <span className="flex-1">{i.label}</span>
                      {i.key && <span className="font-mono text-[10px] text-slate-500 group-hover:text-slate-400">{i.key}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          );
        })}
      </div>
      <div className="border-t border-white/5 p-2">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
          <div className="flex size-7 items-center justify-center rounded bg-brand-600 text-xs font-bold text-white">
            {(auth.user?.fullName ?? auth.user?.username ?? '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{auth.user?.fullName ?? auth.user?.username}</p>
            <p className="truncate text-[10px] uppercase tracking-wide text-slate-500">{auth.roles.join(', ')}</p>
          </div>
          <button onClick={auth.signOut} title="Sign out" className="rounded p-1.5 text-slate-500 hover:bg-white/10 hover:text-rose-400">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </nav>
  );

  const title = groups.flatMap((g) => g.items).find((i) => (i.to === '/' ? location.pathname === '/' : location.pathname.startsWith(i.to)))?.label;

  return (
    <div className="flex h-full">
      <aside className="hidden w-52 shrink-0 lg:block">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="relative h-full w-60 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button className="absolute right-2 top-2.5 z-10 rounded p-1.5 text-slate-400" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="size-5" />
            </button>
            {nav}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 bg-chrome-2 px-3 text-white sm:px-4">
          <button onClick={() => setOpen(true)} className="rounded p-1.5 hover:bg-white/10 lg:hidden" aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{business.data?.name ?? 'Trinobil'}</p>
          </div>
          {title && <span className="hidden text-xs text-slate-500 sm:inline">/ {title}</span>}
          <div className="ml-auto flex items-center gap-4">
            {canBill && location.pathname !== '/billing' && (
              <button
                onClick={() => navigate('/billing')}
                className="hidden h-7 items-center gap-2 rounded-md bg-brand-600 px-3 text-xs font-semibold hover:bg-brand-500 sm:inline-flex"
              >
                <ShoppingCart className="size-3.5" /> New bill <span className="font-mono text-[10px] opacity-70">F2</span>
              </button>
            )}
            <Clock />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className={clsx('mx-auto px-3 py-3 sm:px-5 sm:py-4', location.pathname === '/billing' ? 'h-full max-w-none' : 'max-w-[1600px]')}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
