import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, PackageOpen, ShieldCheck, Factory,
  Archive, FileText, BarChart3, LogOut, Zap,
} from 'lucide-react';

const ROLE_LABELS = {
  admin:               'Administrator',
  inventory_manager:   'Inventory Manager',
  qc_inspector:        'QC Inspector',
  production_manager:  'Production Manager',
};

// Navigation items with role visibility rules
const NAV_ITEMS = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard',      roles: null },
  { to: '/inventory', icon: PackageOpen,     label: 'Inventory',      roles: ['inventory_manager','admin'] },
  { to: '/qc',        icon: ShieldCheck,     label: 'Quality Check',  roles: ['qc_inspector','admin'] },
  { to: '/production',icon: Factory,         label: 'Production',     roles: ['production_manager','admin'] },
  { to: '/finished',  icon: Archive,         label: 'Finished Goods', roles: ['admin','inventory_manager'] },
  { to: '/invoices',  icon: FileText,        label: 'Invoices',       roles: ['admin'] },
  { to: '/reports',   icon: BarChart3,       label: 'Reports',        roles: ['admin','inventory_manager'] },
];

const Sidebar = ({ onClose }) => {
  const { user, logout } = useAuth();

  const visible = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user?.role)
  );

  return (
    <aside className="flex flex-col h-full w-64 bg-slate-900 border-r border-slate-800/60">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-lg shadow-brand-600/30">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-100 leading-tight">Starline</p>
            <p className="text-xs text-slate-500">Connectors IMS</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visible.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
               ${isActive
                 ? 'bg-brand-600/20 text-brand-400 shadow-sm'
                 : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
               }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? 'text-brand-400' : ''}`} size={18} />
                {label}
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User card */}
      <div className="px-3 py-4 border-t border-slate-800/60">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/40">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{ROLE_LABELS[user?.role] || user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="flex-shrink-0 text-slate-500 hover:text-red-400 transition-colors"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
