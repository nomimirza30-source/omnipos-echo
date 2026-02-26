import React from 'react';
import { useStore } from '../store/useStore';
import {
    Building2, RefreshCw, LayoutDashboard, Coffee, Layers, Users, Map,
    ShoppingCart, ShieldCheck, ChefHat, UserCircle, CreditCard,
    Calendar as CalendarIcon, User, BarChart3, Briefcase, Coins, LogOut
} from 'lucide-react';

const Sidebar = ({ onClose }) => {
    const tenants = useStore(state => state.tenants);
    const currentTenantId = useStore(state => state.currentTenantId);
    const setTenant = useStore(state => state.setTenant);
    const orders = useStore(state => state.orders);
    const logs = useStore(state => state.logs);
    const syncOrders = useStore(state => state.syncOrders);
    const currentView = useStore(state => state.currentView);
    const setView = useStore(state => state.setView);
    const user = useStore(state => state.user);
    const logout = useStore(state => state.logout);
    const branding = useStore(state => state.branding);

    const handleViewChange = (viewId) => {
        setView(viewId);
        if (onClose) onClose();
    };

    const allNavItems = [
        { id: 'Dashboard', label: 'Orders', icon: LayoutDashboard, roles: ['Admin', 'Owner', 'Manager', 'Kitchen', 'Chef', 'Assistant Chef', 'Waiter', 'Till'] },
        { id: 'FloorPlan', label: 'Floor Plan', icon: Map, roles: ['Admin', 'Owner', 'Manager', 'Waiter', 'Till'] },
        { id: 'Menu', label: 'Menu', icon: Coffee, roles: ['Admin', 'Owner', 'Manager', 'Kitchen', 'Chef', 'Assistant Chef', 'Waiter'] },
        { id: 'Inventory', label: 'Inventory', icon: Layers, roles: ['Admin', 'Owner', 'Manager', 'Kitchen', 'Chef'] },
        { id: 'Staff', label: 'Staff', icon: Users, roles: ['Admin', 'Owner', 'Manager'] },
        { id: 'OrderEntry', label: 'New Order', icon: ShoppingCart, roles: ['Admin', 'Owner', 'Manager', 'Waiter', 'Till'] },
        { id: 'Payments', label: 'Payments', icon: CreditCard, roles: ['Admin', 'Owner', 'Manager', 'Till'] },
        { id: 'Reservations', label: 'Reservations', icon: CalendarIcon, roles: ['Admin', 'Owner', 'Manager', 'Waiter', 'Till'] },
        { id: 'Customers', label: 'Customers', icon: User, roles: ['Admin', 'Owner', 'Manager', 'Waiter', 'Till'] },
        { id: 'StaffUsers', label: 'User Mgmt', icon: ShieldCheck, roles: ['Admin', 'Owner', 'Manager'] },
        { id: 'Analytics', label: 'Analytics', icon: BarChart3, roles: ['Admin', 'Owner', 'Manager'] },
        { id: 'Tenants', label: 'Tenants', icon: Building2, roles: ['Admin', 'Owner', 'Manager'] },
        { id: 'Branding', label: 'Branding', icon: ShieldCheck, roles: ['Admin'] },
    ];

    const navItems = allNavItems.filter(item => item.roles.includes(user.role));

    const tenantOrders = orders.filter(o => o.tenantId === currentTenantId);
    const offlineCount = tenantOrders.filter(o => o.syncStatus === 'Offline').length;

    const currentTenant = tenants.find(t => (t.tenantId || t.id || t.Id) === currentTenantId);

    return (
        <aside className="flex flex-col h-full gap-0 overflow-hidden" style={{ minHeight: '100%' }}>
            {/* ── Logo / App Name ── */}
            <div className="px-6 pt-6 pb-4 border-b border-white/5">
                <div className="flex items-center gap-3 mb-1">
                    {branding.logoUrl ? (
                        <img src={branding.logoUrl} alt="Logo" className="w-9 h-9 rounded-xl object-contain" />
                    ) : (
                        <div className="w-9 h-9 rounded-xl bg-[rgb(0_210_180_/_0.15)] border border-[rgb(0_210_180_/_0.3)] flex items-center justify-center">
                            <LayoutDashboard size={18} className="text-[rgb(0,210,180)]" />
                        </div>
                    )}
                    <div>
                        <div className="font-black text-base text-white leading-tight">{branding.appName || 'OmniPOS'}</div>
                        <div className="text-[10px] text-[rgb(120_140_170)] font-medium tracking-wide truncate max-w-[130px]">
                            {currentTenant?.name || currentTenantId}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Tenant Switcher ── */}
            <div className="px-4 py-3 border-b border-white/5">
                <div className="flex items-center gap-2 mb-1.5 px-1">
                    <Building2 size={12} className="text-[rgb(0,210,180)]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[rgb(120_140_170)]">Tenant</span>
                </div>
                <select
                    value={currentTenantId}
                    onChange={(e) => {
                        if (currentTenantId !== e.target.value) { setTenant(e.target.value); logout(); }
                    }}
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[rgb(0_210_180_/_0.5)] cursor-pointer"
                    style={{ borderColor: 'rgb(255 255 255 / 0.08)' }}
                >
                    {tenants.map(t => (
                        <option key={t.tenantId || t.id || t.Id} value={t.tenantId || t.id || t.Id} className="bg-[#0a0f1e] text-white">
                            {t.name || t.Name}
                        </option>
                    ))}
                </select>
            </div>

            {/* ── Nav Items ── */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 scrollbar-hide">
                {navItems.map(item => {
                    const active = currentView === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => handleViewChange(item.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-semibold
                                ${active
                                    ? 'bg-[rgb(0_210_180_/_0.12)] text-[rgb(0,210,180)] border-l-2 border-[rgb(0,210,180)] pl-[10px]'
                                    : 'text-[rgb(120_140_170)] hover:text-white hover:bg-white/5 border-l-2 border-transparent'
                                }`}
                        >
                            <item.icon size={16} />
                            {item.label}
                        </button>
                    );
                })}
            </nav>

            {/* ── Offline Sync (admin/waiter/till only) ── */}
            {(['Admin', 'Waiter', 'Till'].includes(user.role)) && (
                <div className="px-4 py-3 border-t border-white/5">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2 text-[rgb(120_140_170)] text-xs">
                            <RefreshCw size={12} className="text-[rgb(100_160_255)]" />
                            <span className="font-semibold">Offline Sync</span>
                            {offlineCount > 0 && (
                                <span className="px-1.5 py-0.5 bg-[rgb(251_191_36_/_0.2)] text-[rgb(251_191_36)] text-[9px] font-black rounded">
                                    {offlineCount}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={syncOrders}
                            className="p-1 hover:bg-white/10 rounded-lg transition-colors text-[rgb(100_160_255)]"
                        >
                            <RefreshCw size={13} />
                        </button>
                    </div>
                    <div className="bg-black/20 rounded-xl p-2 h-20 font-mono text-[8px] text-[rgb(80_100_130)] overflow-y-auto scrollbar-hide border border-white/5">
                        {logs.map((log, i) => (
                            <div key={i} className="mb-0.5 border-l border-white/10 pl-1.5">{log}</div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── User / Logout ── */}
            <div className="px-4 py-4 border-t border-white/5">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-[rgb(0_210_180_/_0.15)] border border-[rgb(0_210_180_/_0.25)] flex items-center justify-center flex-shrink-0">
                        <User size={14} className="text-[rgb(0,210,180)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white truncate">{user.fullName}</div>
                        <div className="text-[10px] text-[rgb(120_140_170)] uppercase tracking-wide">{user.role}</div>
                    </div>
                </div>
                <button
                    onClick={logout}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-red-400 bg-red-400/8 border border-red-400/15 hover:bg-red-400/15 transition-all"
                    style={{ background: 'rgb(239 68 68 / 0.08)', borderColor: 'rgb(239 68 68 / 0.15)' }}
                >
                    <LogOut size={13} /> Sign Out
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
