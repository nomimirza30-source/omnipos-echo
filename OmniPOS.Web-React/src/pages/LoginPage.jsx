import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, User, ShieldCheck, ChevronRight, Loader2, Sparkles, LayoutDashboard, MapPin } from 'lucide-react';

const LoginPage = () => {
    const currentStoreTenantId = useStore.getState().currentTenantId;
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [tenantId, setTenantId] = useState(currentStoreTenantId || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const login = useStore(state => state.login);
    const branding = useStore(state => state.branding);
    const tenants = useStore(state => state.tenants);
    const fetchAnonymousTenants = useStore(state => state.fetchAnonymousTenants);

    React.useEffect(() => {
        fetchAnonymousTenants();
    }, [fetchAnonymousTenants]);

    React.useEffect(() => {
        if (tenants?.length > 0) {
            const tenantExists = tenants.some(t => (t.tenantId || t.id || t.Id) === tenantId);
            if (!tenantId || !tenantExists || tenantId === '00000000-0000-0000-0000-000000001111') {
                setTenantId(tenants[0].tenantId || tenants[0].id || tenants[0].Id); // Auto-select first real location
            }
        }
    }, [tenants, tenantId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const result = await login(username, password, tenantId);
        if (!result.success) {
            setError(result.message);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg text-text flex items-center justify-center p-4 relative overflow-hidden font-sans">
            {/* Animated Background Blobs */}
            <div className="absolute top-0 -left-20 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-0 -right-20 w-96 h-96 bg-secondary/20 rounded-full blur-[120px] animate-pulse delay-700" />

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md z-10"
            >
                {/* Logo & Header */}
                <div className="text-center mb-10">
                    <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        className="inline-flex items-center justify-center w-20 h-20 bg-glass/10 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl mb-6 relative group"
                    >
                        {branding.logoUrl ? (
                            <img src={branding.logoUrl} alt="Logo" className="w-12 h-12 object-contain" />
                        ) : (
                            <LayoutDashboard size={40} className="text-primary group-hover:rotate-12 transition-transform" />
                        )}
                        <div className="absolute -top-1 -right-1">
                            <Sparkles size={16} className="text-secondary animate-bounce" />
                        </div>
                    </motion.div>

                    <h1 className="text-4xl font-black tracking-tighter mb-2 bg-gradient-to-r from-white via-white/90 to-white/50 bg-clip-text text-transparent">
                        {branding.appName || 'OmniPOS'}
                    </h1>
                    <p className="text-muted font-medium text-sm tracking-widest uppercase">
                        Enterprise Point of Sale
                    </p>
                </div>

                {/* Login Form */}
                <div className="bg-glass/10 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative overflow-hidden group">
                    {/* Glassmorphic Shine */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

                    <form onSubmit={handleSubmit} className="space-y-6 relative">
                        <div className="space-y-4">
                            <div className="relative group/input">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted mb-2 block ml-1">Restaurant Location</label>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within/input:text-primary transition-colors" size={18} />
                                    <select
                                        value={tenantId}
                                        onChange={(e) => setTenantId(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all text-text appearance-none"
                                        required
                                    >
                                        <option value="" disabled className="bg-slate-900 text-muted">Select your branch location</option>
                                        {tenants?.map(t => (
                                            <option key={t.tenantId || t.id || t.Id} value={t.tenantId || t.id || t.Id} className="bg-slate-900 text-text">
                                                {t.name || t.Name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <ChevronRight size={16} className="text-muted rotate-90" />
                                    </div>
                                </div>
                            </div>

                            <div className="relative group/input">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted mb-2 block ml-1">Username</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within/input:text-primary transition-colors" size={18} />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Enter your username"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all placeholder:text-muted/50"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="relative group/input">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted mb-2 block ml-1">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within/input:text-secondary transition-colors" size={18} />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-secondary/50 focus:bg-white/10 transition-all placeholder:text-muted/50"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-3 px-4 rounded-xl flex items-center gap-2"
                                >
                                    <ShieldCheck size={14} />
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <button
                            disabled={loading}
                            className="w-full group/btn bg-gradient-to-r from-primary to-secondary p-[1px] rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                        >
                            <div className="bg-bg/10 group-hover/btn:bg-transparent transition-colors rounded-2xl py-4 flex items-center justify-center gap-2">
                                {loading ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <>
                                        <span className="font-black text-sm uppercase tracking-widest">Authorize Access</span>
                                        <ChevronRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </div>
                        </button>
                    </form>
                </div>

                {/* Footer Info */}
                <div className="mt-8 text-center">
                    <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-4">Secure Biometric-Ready Node</p>
                    <div className="flex items-center justify-center gap-6 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" alt="Stripe" className="h-4" />
                        <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal" className="h-4" />
                        <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-4" />
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default LoginPage;
