import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { User, Mail, Phone, Search, History, Star, TrendingUp, Calendar, ChevronRight, Edit3, Trash2, X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CustomerDirectory = () => {
    const { customers, orders, updateCustomer, deleteCustomer, currentTenantId, isAdmin } = useStore();
    const [search, setSearch] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' });

    // Filter customers by tenant
    const tenantCustomers = customers.filter(c => c.tenantId === currentTenantId);

    // Ensure selected customer data stays in sync with store changes (spend, order count, etc)
    React.useEffect(() => {
        if (selectedCustomer) {
            const updated = tenantCustomers.find(c => c.id === selectedCustomer.id);
            if (updated) setSelectedCustomer(updated);
            else setSelectedCustomer(null); // Handle case where customer was deleted
        }
    }, [tenantCustomers]);

    const handleEditStart = () => {
        setEditForm({
            name: selectedCustomer.name,
            email: selectedCustomer.email || '',
            phone: selectedCustomer.phone || ''
        });
        setIsEditing(true);
    };

    const handleSave = () => {
        updateCustomer(selectedCustomer.id, editForm);
        setSelectedCustomer({ ...selectedCustomer, ...editForm });
        setIsEditing(false);
    };

    const handleDelete = () => {
        if (window.confirm(`Are you sure you want to delete ${selectedCustomer.name}?`)) {
            deleteCustomer(selectedCustomer.id);
            setSelectedCustomer(null);
            setIsEditing(false);
        }
    };

    const filteredCustomers = tenantCustomers.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search)
    );

    const getCustomerOrders = (name) => {
        if (!name) return [];
        return orders.filter(o =>
            o.customerName &&
            o.customerName.toLowerCase().trim() === name.toLowerCase().trim()
        );
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8 animate-in fade-in duration-700">
            {/* List Side */}
            <div className="glass-card rounded-[2.5rem] bg-glass/20 border border-text/10 p-6 space-y-6 flex flex-col h-[750px]">
                <div className="space-y-1">
                    <h2 className="text-2xl font-black text-text px-2">Customers</h2>
                    <p className="text-[10px] text-muted font-bold uppercase tracking-widest px-2">CRM DATABASE • {tenantCustomers.length} RECORDS</p>
                </div>

                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                    <input
                        className="w-full bg-glass/20 border border-text/10 rounded-2xl p-4 pl-12 text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                        placeholder="Search by name, email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                    {filteredCustomers.length === 0 ? (
                        <div className="text-center py-20 opacity-20 italic text-muted text-sm">No customers found</div>
                    ) : (
                        filteredCustomers.map(cust => (
                            <button
                                key={cust.id}
                                onClick={() => setSelectedCustomer(cust)}
                                className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4 group ${selectedCustomer?.id === cust.id ? 'bg-primary/20 border-primary text-text' : 'bg-glass/20 border-text/10 text-muted hover:border-text/20'}`}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black ${selectedCustomer?.id === cust.id ? 'bg-primary text-slate-950' : 'bg-glass/40 text-muted'}`}>
                                    {cust.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div className="text-left flex-1 min-w-0">
                                    <div className="font-bold truncate text-sm">{cust.name}</div>
                                    <div className="text-[10px] opacity-60 truncate">{cust.email || cust.phone || 'No contact info'}</div>
                                </div>
                                <ChevronRight size={14} className={`opacity-40 group-hover:translate-x-1 transition-all ${selectedCustomer?.id === cust.id ? 'opacity-100 text-primary' : ''}`} />
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Profile Side */}
            <div className="h-[750px] overflow-y-auto pr-4 scrollbar-hide">
                <AnimatePresence mode="wait">
                    {!selectedCustomer ? (
                        <motion.div
                            key="none"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="h-full glass-card rounded-[2.5rem] flex flex-col items-center justify-center border-dashed border-2 border-text/10 text-muted"
                        >
                            <User size={64} className="mb-4 opacity-10" />
                            <p className="font-bold italic">Select a customer to view history</p>
                            <p className="text-[10px] uppercase tracking-widest mt-2">Insights and profiles will appear here</p>
                        </motion.div>
                    ) : (
                        <motion.div
                            key={selectedCustomer.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-8"
                        >
                            {/* Profile Header */}
                            <div className="glass-card rounded-[2.5rem] p-10 bg-gradient-to-br from-glass/20 to-transparent border border-text/10 shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
                                    <User size={200} />
                                </div>

                                <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                                    <div className="w-24 h-24 bg-primary text-slate-950 rounded-3xl flex items-center justify-center text-4xl font-black shadow-2xl shadow-primary/30">
                                        {selectedCustomer.name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                    <div className="space-y-2 flex-1">
                                        <div className="flex justify-between items-start">
                                            <h1 className="text-4xl font-black text-text">{selectedCustomer.name}</h1>
                                            <div className="flex gap-2">
                                                {!isEditing ? (
                                                    <>
                                                        <button
                                                            onClick={handleEditStart}
                                                            className="p-3 bg-glass/20 hover:bg-primary/20 text-muted hover:text-primary rounded-2xl transition-all border border-text/10"
                                                            title="Edit Profile"
                                                        >
                                                            <Edit3 size={18} />
                                                        </button>
                                                        {isAdmin && (
                                                            <button
                                                                onClick={handleDelete}
                                                                className="p-3 bg-glass/20 hover:bg-red-400/10 text-muted hover:text-red-400 rounded-2xl transition-all border border-text/10"
                                                                title="Delete Customer"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        )}
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => setIsEditing(false)}
                                                        className="p-3 bg-glass/20 hover:bg-text/10 text-muted rounded-2xl transition-all border border-text/10"
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {isEditing ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-muted uppercase pl-1">Name</label>
                                                    <input
                                                        className="w-full bg-glass/40 border border-text/20 rounded-xl p-3 text-text focus:outline-none focus:ring-1 focus:ring-primary"
                                                        value={editForm.name}
                                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-muted uppercase pl-1">Email</label>
                                                    <input
                                                        className="w-full bg-glass/40 border border-text/20 rounded-xl p-3 text-text focus:outline-none focus:ring-1 focus:ring-primary"
                                                        value={editForm.email}
                                                        onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-muted uppercase pl-1">Phone</label>
                                                    <input
                                                        className="w-full bg-glass/40 border border-text/20 rounded-xl p-3 text-text focus:outline-none focus:ring-1 focus:ring-primary"
                                                        value={editForm.phone}
                                                        onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                                    />
                                                </div>
                                                <div className="flex items-end">
                                                    <button
                                                        onClick={handleSave}
                                                        className="w-full bg-primary text-slate-950 font-black py-3 rounded-xl flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-primary/20 transition-all text-xs uppercase"
                                                    >
                                                        <Save size={16} /> Save Changes
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-4">
                                                <div className="flex items-center gap-2 text-muted font-bold text-xs"><Mail size={14} className="text-primary" /> {selectedCustomer.email || 'N/A'}</div>
                                                <div className="flex items-center gap-2 text-muted font-bold text-xs"><Phone size={14} className="text-success" /> {selectedCustomer.phone || 'N/A'}</div>
                                                <div className="flex items-center gap-2 text-muted font-bold text-xs"><Calendar size={14} className="text-secondary" /> Member since {new Date(selectedCustomer.createdAt).toLocaleDateString()}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="glass-card p-6 rounded-3xl border border-text/10 bg-glass/20 flex flex-col justify-between min-h-[140px] overflow-hidden">
                                    <div>
                                        <div className="text-muted font-black text-[10px] uppercase tracking-widest mb-1">Total Visits</div>
                                        <div className="text-xl font-black text-text">{selectedCustomer.totalOrders}</div>
                                    </div>
                                    <div className="text-[10px] text-primary font-bold uppercase tracking-tighter">Lifetime Frequency</div>
                                </div>
                                <div className="glass-card p-6 rounded-3xl border border-text/10 bg-glass/20 flex flex-col justify-between min-h-[140px] overflow-hidden">
                                    <div>
                                        <div className="text-muted font-black text-[10px] uppercase tracking-widest mb-1">Total Spend</div>
                                        <div className="text-xl font-black text-success">£{selectedCustomer.totalSpend?.toFixed(2) || '0.00'}</div>
                                    </div>
                                    <div className="text-[10px] text-success/50 font-bold uppercase tracking-tighter">Revenue Generated</div>
                                </div>
                                <div className="glass-card p-6 rounded-3xl border border-text/10 bg-glass/20 flex flex-col justify-between min-h-[140px] overflow-hidden">
                                    <div>
                                        <div className="text-muted font-black text-[10px] uppercase tracking-widest mb-1">Last Visit</div>
                                        <div className="text-xl font-black text-secondary">{new Date(selectedCustomer.lastVisit).toLocaleDateString()}</div>
                                    </div>
                                    <div className="text-[10px] text-secondary/50 font-bold uppercase tracking-tighter">Most Recent Dining</div>
                                </div>
                            </div>

                            {/* Order History */}
                            <div className="glass-card rounded-[2.5rem] bg-glass/20 border border-text/10 p-8">
                                <h3 className="text-xl font-black text-text flex items-center gap-3 mb-8">
                                    <History className="text-primary" /> Order History
                                </h3>
                                <div className="space-y-4">
                                    {getCustomerOrders(selectedCustomer.name).length === 0 ? (
                                        <div className="text-muted italic py-10 text-center">No orders found for this customer</div>
                                    ) : (
                                        getCustomerOrders(selectedCustomer.name).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(order => (
                                            <div key={order.id} className="bg-glass/20 border border-text/10 p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-text/20 transition-all">
                                                <div className="space-y-1">
                                                    <div className="text-xs font-black text-muted flex items-center gap-2">
                                                        {order.id} • {new Date(order.createdAt).toLocaleString()}
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {order.items?.map((item, i) => (
                                                            <span key={i} className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-full border border-primary/20">
                                                                {item.qty}x {item.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-black text-text">£{order.amount}</div>
                                                    <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md inline-block mt-1 ${order.status === 'Paid' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                                                        {order.status}
                                                    </div>
                                                    {order.discountReason && (
                                                        <div className="text-[10px] text-warning font-bold mt-2 max-w-[200px] truncate" title={order.discountReason}>
                                                            Notes: {order.discountReason}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default CustomerDirectory;
