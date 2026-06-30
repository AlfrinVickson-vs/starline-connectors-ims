import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import toast from 'react-hot-toast';
import { Zap, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const { login } = useAuth();
  const { company_name, company_logo } = useCompany();
  const navigate  = useNavigate();
  const [form, setForm]     = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-slate-900 via-slate-900 to-brand-900/30 relative overflow-hidden flex-col items-center justify-center p-12">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-brand-600/40 overflow-hidden">
            {company_logo ? (
              <img src={company_logo} alt="Company Logo" className="w-full h-full object-cover" />
            ) : (
              <Zap className="w-10 h-10 text-slate-100" />
            )}
          </div>
          <h1 className="text-4xl font-black text-slate-100 mb-3 tracking-tight">
            {company_name}<br />
            <span className="text-gradient">Connectors</span>
          </h1>
          <p className="text-slate-400 text-lg font-light">Inventory Management System</p>

          <div className="mt-16 grid grid-cols-2 gap-4 text-left max-w-xs mx-auto">
            {[
              { label: '5-Stage Workflow',    desc: 'Inventory → QC → Production → QC → Invoice' },
              { label: 'Role-Based Access',   desc: '4 distinct roles with scoped permissions' },
              { label: 'Auto Notifications',  desc: 'Email + in-app alerts at every transition' },
              { label: 'GST Invoicing',       desc: 'Auto CGST/SGST/IGST PDF generation' },
            ].map((feat) => (
              <div key={feat.label} className="glass p-3 rounded-xl">
                <p className="text-xs font-semibold text-brand-400 mb-1">{feat.label}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center overflow-hidden">
              {company_logo ? (
                <img src={company_logo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Zap className="w-5 h-5 text-slate-100" />
              )}
            </div>
            <div>
              <p className="font-bold text-slate-100">{company_name}</p>
              <p className="text-xs text-slate-500">IMS</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-100 mb-1">Welcome back</h2>
          <p className="text-sm text-slate-500 mb-8">Sign in to your IMS account</p>

          <form onSubmit={handleSubmit} className="space-y-5" id="login-form">
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                className="input"
                placeholder="you@starlineconnectors.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="input pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p className="text-xs text-slate-600 text-center mt-8">
            Starline Connectors IMS &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
