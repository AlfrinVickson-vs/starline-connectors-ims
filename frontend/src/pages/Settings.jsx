import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { authAPI, settingsAPI } from '../api/apiService';
import Table from '../components/UI/Table';
import Badge from '../components/UI/Badge';
import Modal from '../components/UI/Modal';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  Settings, Building, Users, UserPlus, Power, Save, Image as ImageIcon,
  ShieldAlert, RefreshCw, Key, Mail, Phone, MapPin, CheckCircle, Edit2, X
} from 'lucide-react';

const SettingsPage = () => {
  const { user } = useAuth();
  const { refreshCompanySettings } = useCompany();
  
  // Tab: 'company' | 'users'
  const [activeTab, setActiveTab] = useState('company');
  
  // Company settings states
  const [companySettings, setCompanySettings] = useState({
    company_name: '',
    company_address: '',
    company_email: '',
    company_contact: '',
    company_gstin: '',
    company_logo: null
  });
  const [saveLoading, setSaveLoading] = useState(false);

  // User management states
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'inventory_manager'
  });
  const [addLoading, setAddLoading] = useState(false);

  // Edit User states
  const [showEditUser, setShowEditUser] = useState(false);
  const [editingUser, setEditingUser] = useState({
    id: '',
    name: '',
    email: '',
    role: 'inventory_manager',
    password: '' // empty string means keep existing password
  });
  const [editLoading, setEditLoading] = useState(false);

  // Fetch Company Settings
  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await settingsAPI.get();
      if (data.success && data.settings) {
        setCompanySettings(data.settings);
      }
    } catch {
      toast.error('Failed to load company settings');
    }
  }, []);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const { data } = await authAPI.users();
      if (data.success) {
        setUsersList(data.users);
      }
    } catch {
      toast.error('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'super_admin') {
      fetchSettings();
      fetchUsers();
    }
  }, [user, fetchSettings, fetchUsers]);

  const handleRefresh = () => {
    if (activeTab === 'company') fetchSettings();
    else fetchUsers();
  };

  // Handle logo upload
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 1024 * 1024) { // 1MB limit
      toast.error("Logo must be smaller than 1MB");
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setCompanySettings(prev => ({ ...prev, company_logo: event.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setCompanySettings(prev => ({ ...prev, company_logo: null }));
  };

  // Handle company settings save
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    try {
      const { data } = await settingsAPI.update(companySettings);
      if (data.success) {
        toast.success('Company settings updated');
        setCompanySettings(data.settings);
        refreshCompanySettings();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaveLoading(false);
    }
  };

  // Handle user toggle status
  const handleToggleUser = async (u) => {
    const nextStatus = !u.is_active;
    try {
      const { data } = await authAPI.toggleUser(u.id, nextStatus);
      if (data.success) {
        toast.success(`User "${u.name}" ${nextStatus ? 'activated' : 'deactivated'}`);
        fetchUsers();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user status');
    }
  };

  // Handle user add
  const handleAddUserSubmit = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    try {
      const { data } = await authAPI.register(newUser);
      if (data.success) {
        toast.success('User registered successfully');
        setShowAddUser(false);
        setNewUser({ name: '', email: '', password: '', role: 'inventory_manager' });
        fetchUsers();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setAddLoading(false);
    }
  };

  // Handle user edit submit
  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const { data } = await authAPI.updateUser(editingUser.id, {
        name: editingUser.name,
        email: editingUser.email,
        role: editingUser.role,
        password: editingUser.password || undefined // omit if empty
      });
      if (data.success) {
        toast.success('User details updated successfully');
        setShowEditUser(false);
        fetchUsers();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user');
    } finally {
      setEditLoading(false);
    }
  };

  // Trigger Edit Modal setup
  const openEditModal = (u) => {
    setEditingUser({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      password: '' // default empty
    });
    setShowEditUser(true);
  };

  // Restrict access
  if (user?.role !== 'super_admin') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20">
          <ShieldAlert size={32} />
        </div>
        <div className="max-w-xs space-y-1">
          <h2 className="text-lg font-bold text-slate-200">Access Denied</h2>
          <p className="text-slate-500 text-xs leading-normal">
            Only Super Administrators can access the system settings panel.
          </p>
        </div>
      </div>
    );
  }

  const userColumns = [
    { key: 'name', label: 'Name', render: (v, r) => (
      <div>
        <p className="font-semibold text-slate-205">{v} (#{r.id})</p>
        <p className="text-[10px] text-slate-500">Registered: {format(new Date(r.created_at), 'dd MMM yyyy')}</p>
      </div>
    )},
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (v) => (
      <span className="text-xs font-mono capitalize bg-slate-800 text-slate-350 border border-slate-700/40 px-2 py-0.5 rounded-md">
        {v.replace(/_/g, ' ')}
      </span>
    )},
    { key: 'is_active', label: 'Status', render: (v) => (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
        v ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'
      }`}>
        {v ? 'Active' : 'Suspended'}
      </span>
    )},
    { key: 'actions', label: '', render: (_, r) => (
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => openEditModal(r)}
          className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1 hover:bg-brand-500/5 px-2 py-1 rounded"
          id={`edit-user-btn-${r.id}`}
        >
          <Edit2 size={12} /> Edit
        </button>
        <button
          onClick={() => handleToggleUser(r)}
          className={`text-xs font-semibold flex items-center gap-1 px-2 py-1 rounded ${r.is_active ? 'text-red-400 hover:text-red-300 hover:bg-red-500/5' : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/5'}`}
          id={`toggle-user-status-${r.id}`}
        >
          <Power size={12} />
          {r.is_active ? 'Suspend' : 'Activate'}
        </button>
      </div>
    )}
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-title">System Settings</h2>
          <p className="page-subtitle">Manage company details, users, and privileges</p>
        </div>
        <button onClick={handleRefresh} className="btn-ghost" title="Refresh">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl w-fit border border-slate-800/60">
        {[
          { key: 'company', label: 'Company Profile', icon: Building },
          { key: 'users', label: 'User Privileges', icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: COMPANY PROFILE ── */}
      {activeTab === 'company' && (
        <div className="card p-6 max-w-2xl animate-in">
          <h3 className="section-title mb-5 flex items-center gap-2">
            <Building size={16} className="text-brand-400" />
            Company Settings
          </h3>
          <form onSubmit={handleSaveSettings} className="space-y-6">
            
            {/* Logo Upload */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Company Logo</label>
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-2xl border border-slate-700/60 bg-slate-800/40 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {companySettings.company_logo ? (
                    <img src={companySettings.company_logo} alt="Company Logo" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={24} className="text-slate-500" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <label className="btn-secondary cursor-pointer">
                      <input type="file" accept="image/png, image/jpeg, image/svg+xml" className="hidden" onChange={handleLogoChange} />
                      Upload Image
                    </label>
                    {companySettings.company_logo && (
                      <button type="button" onClick={removeLogo} className="btn-ghost text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3">
                        <X size={16} /> Remove
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Recommended size: 256x256px. Max 1MB (PNG, JPG, SVG).</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Company Name *</label>
                <div className="relative">
                  <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text" className="input pl-9" placeholder="Starline Connectors" required
                    value={companySettings.company_name}
                    onChange={(e) => setCompanySettings({ ...companySettings, company_name: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">GSTIN Number / Reg No. *</label>
                <div className="relative">
                  <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text" className="input pl-9" placeholder="27AAASC1234A1Z5" required
                    value={companySettings.company_gstin}
                    onChange={(e) => setCompanySettings({ ...companySettings, company_gstin: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Email Address *</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email" className="input pl-9" placeholder="accounts@starline.com" required
                    value={companySettings.company_email}
                    onChange={(e) => setCompanySettings({ ...companySettings, company_email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Contact Number *</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text" className="input pl-9" placeholder="+91 22 1234 5678" required
                    value={companySettings.company_contact}
                    onChange={(e) => setCompanySettings({ ...companySettings, company_contact: e.target.value })}
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Office Address *</label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-3 text-slate-500" />
                  <textarea
                    className="input pl-9 resize-none h-24" placeholder="Corporate HQ Address…" required
                    value={companySettings.company_address}
                    onChange={(e) => setCompanySettings({ ...companySettings, company_address: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit" disabled={saveLoading}
                className="btn-primary gap-2"
                id="save-settings-btn"
              >
                {saveLoading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><Save size={14} /> Save Profile Changes</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── TAB 2: USER PRIVILEGES ── */}
      {activeTab === 'users' && (
        <div className="space-y-4 animate-in">
          {/* Controls */}
          <div className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-brand-400" />
              <span className="text-sm font-semibold text-slate-200">Registered Managers & Inspectors</span>
            </div>
            <button
              onClick={() => setShowAddUser(true)}
              className="btn-primary text-xs gap-2 py-2"
              id="add-new-user-btn"
            >
              <UserPlus size={14} />
              Add System User
            </button>
          </div>

          {/* Table */}
          <Table
            columns={userColumns}
            data={usersList}
            loading={usersLoading}
            emptyText="No system users found."
          />

          {/* Add User Modal */}
          {showAddUser && (
            <Modal isOpen={showAddUser} onClose={() => setShowAddUser(false)} title="Register System User" size="sm">
              <form onSubmit={handleAddUserSubmit} className="space-y-4" id="add-user-form">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Account Name *</label>
                  <input
                    type="text" className="input" placeholder="e.g. Alfrin Vickson" required
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Email Address *</label>
                  <input
                    type="email" className="input" placeholder="e.g. alfrin@starline.com" required
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Password *</label>
                  <input
                    type="password" className="input" placeholder="Min 6 characters" required minLength="6"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">System Privilege / Role *</label>
                  <select
                    className="select"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  >
                    <option value="inventory_manager">Inventory Manager</option>
                    <option value="qc_inspector">Quality Check Inspector</option>
                    <option value="production_manager">Production Manager</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                    {newUser.role === 'inventory_manager' && '📦 Inventory entry and CSV imports.'}
                    {newUser.role === 'qc_inspector' && '🔬 Inspect and approve items at QC stages.'}
                    {newUser.role === 'production_manager' && '⚙️ Process production batch operations.'}
                    {newUser.role === 'admin' && '🔑 Full workflow access, invoicing, and reports.'}
                    {newUser.role === 'super_admin' && '👑 Override control, company details, user provisioning.'}
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowAddUser(false)} className="btn-secondary">Cancel</button>
                  <button type="submit" disabled={addLoading} className="btn-primary" id="add-user-submit-btn">
                    {addLoading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <><UserPlus size={14} /> Add User</>
                    )}
                  </button>
                </div>
              </form>
            </Modal>
          )}

          {/* Edit User Modal */}
          {showEditUser && (
            <Modal isOpen={showEditUser} onClose={() => setShowEditUser(false)} title={`Edit Details: ${editingUser.name}`} size="sm">
              <form onSubmit={handleEditUserSubmit} className="space-y-4" id="edit-user-form">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Account Name *</label>
                  <input
                    type="text" className="input" required
                    value={editingUser.name}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Email Address *</label>
                  <input
                    type="email" className="input" required
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">System Privilege / Role *</label>
                  <select
                    className="select"
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  >
                    <option value="inventory_manager">Inventory Manager</option>
                    <option value="qc_inspector">Quality Check Inspector</option>
                    <option value="production_manager">Production Manager</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Change Password (Optional)
                  </label>
                  <input
                    type="password" className="input" placeholder="Leave blank to keep current" minLength="6"
                    value={editingUser.password}
                    onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowEditUser(false)} className="btn-secondary">Cancel</button>
                  <button type="submit" disabled={editLoading} className="btn-primary" id="edit-user-submit-btn">
                    {editLoading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <><Save size={14} /> Save Details</>
                    )}
                  </button>
                </div>
              </form>
            </Modal>
          )}
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
