import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { AlertTriangle, ArrowUpRight, ArrowDownRight, Minus, Plus, Box, Trash2 } from 'lucide-react';
import Modal from './Modal';

const InventoryDashboard = () => {
    const { inventoryItems, updateStock, addInventoryItem, deleteInventoryItem } = useStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        level: '',
        unit: 'kg'
    });

    const criticalCount = inventoryItems.filter(i => i.status === 'Critical').length;
    const totalValue = 14290;

    const handleSubmit = (e) => {
        e.preventDefault();
        const data = {
            ...formData,
            level: parseFloat(formData.level),
            status: parseFloat(formData.level) <= 1 ? 'Critical' : parseFloat(formData.level) <= 5 ? 'Low' : 'Healthy'
        };
        addInventoryItem(data);
        setIsModalOpen(false);
        setFormData({ name: '', sku: '', level: '', unit: 'kg' });
    };

    return (
        <div className="glass-card rounded-3xl p-6">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-xl font-bold text-text">Inventory & Procurement</h2>
                    <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1">Real-time Stock Tracking</p>
                </div>
                <div className="flex items-center gap-3">
                    {criticalCount > 0 && (
                        <div className="bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-xl flex items-center gap-2 text-red-400 animate-pulse">
                            <AlertTriangle size={14} />
                            <span className="text-[10px] font-black uppercase tracking-wider">{criticalCount} Items Critical</span>
                        </div>
                    )}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-primary/20 text-primary border border-primary/30 px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/30 transition-all font-outfit"
                    >
                        <Box size={16} /> New SKU
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-glass/20 p-4 rounded-2xl border border-text/10">
                    <div className="text-[10px] font-bold text-muted uppercase mb-1">Total SKU Value</div>
                    <div className="text-2xl font-black text-text">£{totalValue.toLocaleString()}</div>
                    <div className="flex items-center gap-1 text-[10px] text-success mt-1">
                        <ArrowUpRight size={10} /> +2.4% this week
                    </div>
                </div>
                <div className="bg-glass/20 p-4 rounded-2xl border border-text/10">
                    <div className="text-[10px] font-bold text-muted uppercase mb-1">Wastage Factor</div>
                    <div className="text-2xl font-black text-text">4.2%</div>
                    <div className="flex items-center gap-1 text-[10px] text-red-400 mt-1">
                        <ArrowDownRight size={10} /> -0.8% Target
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-muted text-[10px] uppercase font-black tracking-widest border-b border-text/10">
                            <th className="pb-4 px-2">Item / SKU</th>
                            <th className="pb-4 px-2">Current Level</th>
                            <th className="pb-4 px-2">Status</th>
                            <th className="pb-4 px-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-text/10">
                        {inventoryItems.map((item) => (
                            <tr key={item.id} className="group hover:bg-glass/10 transition-colors">
                                <td className="py-4 px-2">
                                    <div className="font-bold text-text group-hover:text-primary transition-colors">{item.name}</div>
                                    <div className="text-[10px] text-muted font-mono uppercase">{item.sku}</div>
                                </td>
                                <td className="py-4 px-2">
                                    <div className="font-black text-text">{item.level} <span className="text-muted font-medium">{item.unit}</span></div>
                                </td>
                                <td className="py-4 px-2">
                                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md border ${item.status === 'Critical' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                        item.status === 'Low' ? 'bg-warning/10 text-warning border-warning/20' :
                                            'bg-success/10 text-success border-success/20'
                                        }`}>
                                        {item.status}
                                    </span>
                                </td>
                                <td className="py-4 px-2">
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            onClick={() => updateStock(item.id, Math.max(0, item.level - 1))}
                                            className="p-1.5 bg-glass/20 hover:bg-red-500/20 rounded-lg text-muted hover:text-red-400 transition-all"
                                        >
                                            <Minus size={14} />
                                        </button>
                                        <button
                                            onClick={() => updateStock(item.id, item.level + 1)}
                                            className="p-1.5 bg-glass/20 hover:bg-success/20 rounded-lg text-muted hover:text-success transition-all"
                                        >
                                            <Plus size={14} />
                                        </button>
                                        <button
                                            onClick={() => deleteInventoryItem(item.id)}
                                            className="p-1.5 bg-glass/20 hover:bg-red-500/20 rounded-lg text-muted hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Add New Stock SKU"
            >
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">Stock Item Name</label>
                        <input
                            required
                            className="bg-glass/20 border border-text/10 rounded-xl p-3 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. Wagyu Ribeye"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">SKU Code</label>
                        <input
                            required
                            className="bg-glass/20 border border-text/10 rounded-xl p-3 text-text focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                            value={formData.sku}
                            onChange={e => setFormData({ ...formData, sku: e.target.value })}
                            placeholder="SKU-XXX-..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">Initial Level</label>
                            <input
                                required
                                type="number"
                                step="0.1"
                                className="bg-glass/20 border border-text/10 rounded-xl p-3 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                                value={formData.level}
                                onChange={e => setFormData({ ...formData, level: e.target.value })}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">Unit</label>
                            <select
                                className="bg-glass border border-text/10 rounded-xl p-3 text-text focus:outline-none"
                                value={formData.unit}
                                onChange={e => setFormData({ ...formData, unit: e.target.value })}
                            >
                                <option value="kg" className="bg-bg">kg</option>
                                <option value="liters" className="bg-bg">liters</option>
                                <option value="units" className="bg-bg">units</option>
                                <option value="bottles" className="bg-bg">bottles</option>
                                <option value="boxes" className="bg-bg">boxes</option>
                            </select>
                        </div>
                    </div>
                    <button type="submit" className="bg-primary text-slate-950 font-black py-3 rounded-xl mt-4 hover:shadow-lg transition-all">
                        Register SKU
                    </button>
                </form>
            </Modal>
        </div>
    );
};

export default InventoryDashboard;
