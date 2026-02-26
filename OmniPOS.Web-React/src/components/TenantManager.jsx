import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Building2, Plus, Edit2, Trash2, MapPin, Phone, Calendar, Search, ShieldCheck, XCircle, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from './Modal';

const TenantManager = () => {
    const { tenants, addTenantAsync, updateTenant, deleteTenant, currentTenantId, setTenant, logout } = useStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTenant, setEditingTenant] = useState(null);
    const [search, setSearch] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        owner: '',
        address: '',
        contact: '',
        status: 'Active'
    });

    const filteredTenants = tenants.filter(t =>
        t.name?.toLowerCase().includes(search.toLowerCase()) ||
        (t.tenantId || t.id || t.Id)?.toLowerCase().includes(search.toLowerCase())
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (editingTenant) {
            updateTenant(editingTenant.id, formData);
        } else {
            const success = await addTenantAsync(formData);
            if (!success) {
                alert("Failed to create new location on the server.");
                return;
            }
        }
        setIsModalOpen(false);
        setEditingTenant(null);
        setFormData({ name: '', owner: '', address: '', contact: '', status: 'Active' });
    };

    const handleEdit = (tenant) => {
        setEditingTenant(tenant);
        setFormData({
            name: tenant.name,
            owner: tenant.owner || '',
            address: tenant.address,
            contact: tenant.contact,
            status: tenant.status
        });
        setIsModalOpen(true);
    };

    const handleDelete = (id, name) => {
        if (tenants.length <= 1) {
            alert("Cannot delete the last remaining tenant. System requires at least one active location.");
            return;
        }
        if (window.confirm(`Are you sure you want to permanently delete "${name}"? This will remove all associated location data.`)) {
            deleteTenant(id);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="glass-card p-10 rounded-[3rem] bg-glass/20 border border-text/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none text-text">
                    <Building2 size={240} />
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
                    <div className="flex items-center gap-8 text-center md:text-left">
                        <div className="w-20 h-20 bg-primary/20 text-primary rounded-[2rem] flex items-center justify-center border border-primary/20 shadow-2xl shadow-primary/20">
                            <Building2 size={40} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-text tracking-tight">Tenant Ecosystem</h1>
                            <p className="text-[10px] text-muted font-bold uppercase tracking-[0.2em] mt-2">Manage multiple restaurant locations & profiles</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                            <input
                                className="bg-glass/20 border border-text/10 rounded-2xl p-4 pl-12 text-text w-[250px] focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                                placeholder="Search locations..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => { setEditingTenant(null); setFormData({ name: '', owner: '', address: '', contact: '', status: 'Active' }); setIsModalOpen(true); }}
                            className="bg-primary text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                        >
                            <Plus size={18} /> Add Tenant
                        </button>
                    </div>
                </div>
            </div>

            {/* Tenant Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredTenants.map((t, i) => (
                    <motion.div
                        key={t.tenantId || t.id || t.Id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={`glass-card p-8 rounded-[2.5rem] border transition-all flex flex-col gap-6 group hover:shadow-2xl hover:shadow-primary/5 ${currentTenantId === (t.tenantId || t.id || t.Id) ? 'border-primary/40 bg-primary/10' : 'border-text/10 bg-glass/20 hover:border-text/20'}`}
                    >
                        <div className="flex justify-between items-start">
                            <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${t.status === 'Active' ? 'bg-success/10 text-success' : 'bg-red-500/10 text-red-400'}`}>
                                {t.status}
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(t)} className="p-2 bg-glass/20 text-muted hover:text-text rounded-xl transition-colors"><Edit2 size={16} /></button>
                                <button onClick={() => handleDelete(t.tenantId || t.id || t.Id, t.name)} className="p-2 bg-red-400/10 text-red-400 hover:bg-red-400/20 rounded-xl transition-colors"><Trash2 size={16} /></button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <h3 className="text-2xl font-black text-text leading-tight">{t.name}</h3>
                            <div className="flex justify-between items-center">
                                <div className="text-[10px] font-black text-primary uppercase tracking-widest">ID: {t.tenantId || t.id || t.Id}</div>
                                <div className="text-[10px] font-bold text-muted italic">Owner: {t.owner || 'N/A'}</div>
                            </div>
                        </div>

                        <div className="space-y-4 py-4 border-y border-text/10">
                            <div className="flex items-start gap-4 text-muted text-xs font-bold italic">
                                <MapPin size={16} className="text-primary flex-shrink-0 mt-0.5" />
                                <span>{t.address}</span>
                            </div>
                            <div className="flex items-center gap-4 text-muted text-xs font-bold italic">
                                <Phone size={16} className="text-success flex-shrink-0" />
                                <span>{t.contact}</span>
                            </div>
                            <div className="flex items-center gap-4 text-muted text-xs font-bold italic">
                                <Calendar size={16} className="text-secondary flex-shrink-0" />
                                <span>Onboarded {new Date(t.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                const resolvedId = t.tenantId || t.id || t.Id;
                                if (currentTenantId !== resolvedId) {
                                    setTenant(resolvedId);
                                    logout();
                                }
                            }}
                            className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${currentTenantId === (t.tenantId || t.id || t.Id) ? 'bg-primary text-slate-950 shadow-xl shadow-primary/20' : 'bg-glass/40 text-muted hover:text-text border border-text/10 hover:border-text/20'}`}
                        >
                            {currentTenantId === (t.tenantId || t.id || t.Id) ? 'Current Location' : 'Switch to Location'}
                        </button>
                    </motion.div>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTenant ? "Edit Tenant Profile" : "Register New Tenant"}>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest px-1">Location Name</label>
                            <input
                                required
                                className="w-full bg-glass/20 border border-text/10 rounded-2xl p-4 text-text focus:ring-2 focus:ring-primary/50 outline-none"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Manchester Central"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest px-1">Owner Name</label>
                            <input
                                required
                                className="w-full bg-glass/20 border border-text/10 rounded-2xl p-4 text-text focus:ring-2 focus:ring-primary/50 outline-none"
                                value={formData.owner}
                                onChange={e => setFormData({ ...formData, owner: e.target.value })}
                                placeholder="e.g. Nauman Baig"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest px-1">Full Address</label>
                        <textarea
                            required
                            className="w-full bg-glass/20 border border-text/10 rounded-2xl p-4 text-text min-h-[100px] focus:ring-2 focus:ring-primary/50 outline-none"
                            value={formData.address}
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                            placeholder="Street, City, Postal Code"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest px-1">Contact Details</label>
                            <input
                                className="w-full bg-glass/20 border border-text/10 rounded-2xl p-4 text-text"
                                value={formData.contact}
                                onChange={e => setFormData({ ...formData, contact: e.target.value })}
                                placeholder="+44..."
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest px-1">System Status</label>
                            <select
                                className="w-full bg-glass border border-text/10 rounded-2xl p-4 text-text"
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                            >
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive / Suspended</option>
                            </select>
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-primary text-white font-black py-5 rounded-3xl shadow-2xl shadow-primary/30 hover:scale-[1.01] transition-all">
                        {editingTenant ? 'Update Configuration' : 'Onboard Location'}
                    </button>
                </form>
            </Modal>
        </div>
    );
};

export default TenantManager;
