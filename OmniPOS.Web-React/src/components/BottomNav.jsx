import React from 'react';
import { useStore } from '../store/useStore';
import { LayoutDashboard, Map, ShoppingCart, ShieldCheck } from 'lucide-react';

const BottomNav = () => {
    const { currentView, setView, user } = useStore();

    const mobileItems = [
        { id: 'Dashboard', label: 'Orders', icon: LayoutDashboard, roles: ['Admin', 'Owner', 'Manager', 'Kitchen', 'Waiter', 'Till'] },
        { id: 'FloorPlan', label: 'Tables', icon: Map, roles: ['Admin', 'Owner', 'Manager', 'Waiter', 'Till'] },
        { id: 'OrderEntry', label: 'New', icon: ShoppingCart, roles: ['Admin', 'Owner', 'Manager', 'Waiter', 'Till'] },
        { id: 'Branding', label: 'Setup', icon: ShieldCheck, roles: ['Admin'] },
    ];

    const navItems = mobileItems.filter(item => item.roles.includes(user.role));

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg/80 backdrop-blur-xl border-t border-white/5 px-6 py-3 flex justify-around items-center">
            {navItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => setView(item.id)}
                    className={`flex flex-col items-center gap-1 transition-all ${currentView === item.id ? 'text-primary scale-110' : 'text-muted hover:text-text'
                        }`}
                >
                    <item.icon size={20} className={currentView === item.id ? 'drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]' : ''} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
                </button>
            ))}
        </nav>
    );
};

export default BottomNav;
