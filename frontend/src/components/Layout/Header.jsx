import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import NotificationBell from '../Notifications/NotificationBell';
import { useAuth } from '../../context/AuthContext';

const PAGE_TITLES = {
  '/':           'Dashboard',
  '/inventory':  'Inventory Management',
  '/qc':         'Quality Control',
  '/production': 'Production',
  '/finished':   'Finished Goods',
  '/invoices':   'Invoices',
  '/reports':    'Reports & Analytics',
};

const Header = ({ onMenuClick }) => {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const title = PAGE_TITLES[pathname] || 'Starline IMS';
  const now   = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800/60 px-6 flex items-center justify-between flex-shrink-0 z-10">
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden text-slate-400 hover:text-slate-200 transition-colors"
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 className="text-base font-semibold text-slate-100">{title}</h1>
          <p className="text-xs text-slate-500 hidden sm:block">{now}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
        <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-700/60">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <span className="text-xs font-medium text-slate-300">{user?.name}</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
