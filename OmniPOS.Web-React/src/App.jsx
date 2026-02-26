import React from 'react';
import { useStore } from './store/useStore';
import Sidebar from './components/Sidebar';
import OrderTable from './components/OrderTable';
import FloorPlan from './components/FloorPlan';
import MenuEditor from './components/MenuEditor';
import InventoryDashboard from './components/InventoryDashboard';
import StaffRota from './components/StaffRota';
import OrderEntry from './components/OrderEntry';
import PaymentsDashboard from './components/PaymentsDashboard';
import Reservations from './components/Reservations';
import CustomerDirectory from './components/CustomerDirectory';
import Customers from './pages/Customers';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import TenantManager from './components/TenantManager';
import StaffManagement from './components/StaffManagement';
import BrandingSettings from './components/BrandingSettings';
import BottomNav from './components/BottomNav';
import NotificationTray from './components/NotificationTray';
import NotificationBell from './components/NotificationBell';
import LoginPage from './pages/LoginPage';
import { Plus, LayoutDashboard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
    const tenants = useStore(state => state.tenants);
    const currentTenantId = useStore(state => state.currentTenantId);
    const createOrder = useStore(state => state.createOrder);
    const currentView = useStore(state => state.currentView);
    const branding = useStore(state => state.branding);
    const setView = useStore(state => state.setView);
    const fetchBranding = useStore(state => state.fetchBranding);
    const isAuthenticated = useStore(state => state.isAuthenticated);
    const user = useStore(state => state.user);

    const currentTenant = tenants.find(t => (t.tenantId || t.id || t.Id) === currentTenantId);

    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

    const hexToRgb = (hex) => {
        if (!hex || typeof hex !== 'string') return '56 189 248';
        const cleanHex = hex.replace('#', '');
        if (cleanHex.length === 3) {
            const r = parseInt(cleanHex[0] + cleanHex[0], 16);
            const g = parseInt(cleanHex[1] + cleanHex[1], 16);
            const b = parseInt(cleanHex[2] + cleanHex[2], 16);
            return `${r} ${g} ${b}`;
        }
        if (cleanHex.length === 6) {
            const r = parseInt(cleanHex.substring(0, 2), 16);
            const g = parseInt(cleanHex.substring(2, 4), 16);
            const b = parseInt(cleanHex.substring(4, 6), 16);
            return `${r} ${g} ${b}`;
        }
        return '56 189 248';
    };

    React.useEffect(() => {
        console.log('Fetching branding for tenant:', currentTenantId);
        fetchBranding();
    }, [currentTenantId]);

    React.useEffect(() => {
        if (isAuthenticated) {
            useStore.getState().initSignalR();

            // Pull Tenant-isolated Menus
            useStore.getState().fetchCategories();
            useStore.getState().fetchMenuItems();

            // Global order polling for all authenticated users
            const fetchOrders = useStore.getState().fetchOrders;
            fetchOrders(); // Initial fetch
            const interval = setInterval(() => {
                fetchOrders();
            }, 5000);

            let syncTimeout = null;
            const handleOnline = () => {
                console.log('[App] Network is back online. Debouncing syncOrders...');
                if (syncTimeout) clearTimeout(syncTimeout);
                syncTimeout = setTimeout(() => {
                    console.log('[App] Executing debounced syncOrders...');
                    useStore.getState().syncOrders();
                }, 3000); // 3 second debounce
            };
            window.addEventListener('online', handleOnline);

            return () => {
                clearInterval(interval);
                window.removeEventListener('online', handleOnline);
                if (syncTimeout) clearTimeout(syncTimeout);
            };
        }
    }, [isAuthenticated]);

    React.useEffect(() => {
        const root = document.documentElement;
        const pRgb = hexToRgb(branding.primaryColor);
        const sRgb = hexToRgb(branding.secondaryColor);

        // Apply shared CSS variables as raw RGB triplets (for Tailwind)
        root.style.setProperty('--primary', pRgb);
        root.style.setProperty('--secondary', sRgb);

        // Also apply as hex for Direct Styles
        root.style.setProperty('--primary-hex', branding.primaryColor);
        root.style.setProperty('--secondary-hex', branding.secondaryColor);

        // Apply glow effects
        root.style.setProperty('--primary-glow', `rgb(${pRgb} / 0.15)`);
        root.style.setProperty('--secondary-glow', `rgb(${sRgb} / 0.15)`);

        console.log('[App] Applied Branding Colors:', {
            primary: branding.primaryColor,
            secondary: branding.secondaryColor,
            theme: branding.themeMode
        });

        if (branding.themeMode === 'light') {
            root.classList.add('light');
            root.classList.remove('dark');
        } else {
            root.classList.add('dark');
            root.classList.remove('light');
        }

        // DYNAMC STYLE INJECTION (Fallback for components that might not pick up variables)
        let styleTag = document.getElementById('branding-overrides');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'branding-overrides';
            document.head.appendChild(styleTag);
        }
        styleTag.innerHTML = `
            :root {
                --primary: ${pRgb} !important;
                --secondary: ${sRgb} !important;
            }
            .text-primary { color: rgb(${pRgb}) !important; }
            .bg-primary { background-color: rgb(${pRgb}) !important; }
            .border-primary { border-color: rgb(${pRgb}) !important; }
            .text-secondary { color: rgb(${sRgb}) !important; }
            .bg-secondary { background-color: rgb(${sRgb}) !important; }
            .border-secondary { border-color: rgb(${sRgb}) !important; }
        `;
    }, [branding.primaryColor, branding.secondaryColor, branding.themeMode, branding.appName]);

    const renderView = () => {
        switch (currentView) {
            case 'FloorPlan': return <FloorPlan />;
            case 'Menu': return <MenuEditor />;
            case 'Inventory': return <InventoryDashboard />;
            case 'Staff': return <StaffRota />;
            case 'OrderEntry': return <OrderEntry />;
            case 'Payments': return <PaymentsDashboard />;
            case 'Reservations': return <Reservations />;
            case 'Customers': return <Customers />;
            case 'Analytics': return <AnalyticsDashboard />;
            case 'StaffUsers': return <StaffManagement />;
            case 'Tenants': return <TenantManager />;
            case 'Branding': return <BrandingSettings />;
            case 'Dashboard':
            default: return <OrderTable />;
        }
    };

    const handleCreateOrder = () => {
        const amount = (Math.random() * 50 + 10).toFixed(2);
        createOrder({
            amount,
            tableId: '',
            items: [],
            customerName: 'Quick Order'
        });
    };

    if (!isAuthenticated) {
        return <LoginPage />;
    }

    return (
        <div className="min-h-screen bg-bg text-text font-sans selection:bg-primary/30 flex flex-col items-center">
            {/* Mobile Header Toggle */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-bg/80 backdrop-blur-xl border-b border-white/5 p-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    {branding.logoUrl ? (
                        <img src={branding.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
                    ) : (
                        <LayoutDashboard className="text-primary w-6 h-6" />
                    )}
                    <span className="font-bold text-lg">{branding.appName}</span>
                </div>
                <div className="flex items-center gap-3">
                    <NotificationBell />
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 bg-glass/20 rounded-xl text-primary"
                    >
                        <Plus className={`transition-transform duration-300 ${isSidebarOpen ? 'rotate-45' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Client App Content */}
            <div className="container max-w-6xl grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 p-4 md:p-8 mt-16 md:mt-0 relative">
                <NotificationTray />

                {/* Sidebar - Desktop and Mobile Drawer */}
                <div className={`
                    fixed md:relative inset-0 z-40 md:z-auto transition-transform duration-300 transform
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                    bg-bg/95 md:bg-transparent backdrop-blur-2xl md:backdrop-blur-none
                `}>
                    <div className="h-full overflow-y-auto p-8 md:p-0">
                        <Sidebar onClose={() => setIsSidebarOpen(false)} />
                    </div>
                </div>

                {/* Main Content */}
                <motion.div
                    className="flex flex-col gap-8 min-w-0"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    <header className="hidden md:flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    {branding.logoUrl ? (
                                        <img src={branding.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
                                    ) : (
                                        <LayoutDashboard className="text-primary w-6 h-6" />
                                    )}
                                    <h1 className="text-3xl font-bold">{currentView === 'Dashboard' ? branding.appName : currentView}</h1>
                                </div>
                                <p className="text-xs text-muted font-medium">Location: <span className="text-secondary">{currentTenant?.name || currentTenantId}</span></p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <NotificationBell />
                            {currentView === 'Dashboard' && (
                                <button
                                    onClick={() => setView('OrderEntry')}
                                    className="flex items-center gap-2 bg-gradient-to-br from-primary to-secondary text-white px-6 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
                                >
                                    <Plus size={18} />
                                    New Order
                                </button>
                            )}
                        </div>
                    </header>

                    {/* Mobile Title */}
                    <div className="md:hidden">
                        <h1 className="text-2xl font-bold mb-1">{currentView}</h1>
                        <p className="text-[10px] text-muted uppercase tracking-widest font-black">{currentTenant?.name}</p>
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentView}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.2 }}
                        >
                            <div className="pb-24 md:pb-0">
                                {renderView()}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </motion.div>
            </div>
            <BottomNav />
        </div>
    );
}

export default App;
