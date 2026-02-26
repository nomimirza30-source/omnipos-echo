import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Square, Circle, User, Plus, Trash2, Edit2 } from 'lucide-react';
import { motion } from 'framer-motion';
import Modal from './Modal';

const FloorPlan = () => {
    const { tables, addTableAsync, updateTableAsync, deleteTableAsync, user, fetchTables } = useStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedTable, setSelectedTable] = useState(null);
    const [formData, setFormData] = useState({ num: '', cap: 2, shape: 'Square' });
    const [editData, setEditData] = useState({ num: '', cap: 2, shape: 'Square' });

    // Fetch tables when component mounts
    useEffect(() => {
        fetchTables();
    }, [fetchTables]);

    // Only Admin, Owner, and Manager can manage tables (case-insensitive)
    const canManageTables = ['admin', 'owner', 'manager'].includes(user?.role?.toLowerCase());

    const getStatusColor = (status) => {
        switch (status) {
            case 'Available': return 'text-success bg-success/10 border-success/30';
            case 'Occupied': return 'text-primary bg-primary/10 border-primary/30';
            case 'Reserved': return 'text-warning bg-warning/10 border-warning/30';
            default: return 'text-muted bg-glass/20 border-text/10';
        }
    };

    const handleAddTable = (e) => {
        e.preventDefault();

        // Prevent duplicate table numbers
        if (tables.some(t => t.num === formData.num)) {
            alert(`Table ${formData.num} already exists! Please use a unique number.`);
            return;
        }

        // Place tables in rows of 5 with 120px spacing
        const maxPerRow = 5;
        const spacing = 120;
        const index = tables.length;
        const col = index % maxPerRow;
        const row = Math.floor(index / maxPerRow);

        addTableAsync({
            ...formData,
            pos: { x: 50 + (col * spacing), y: 50 + (row * spacing) },
            status: 'Available'
        });
        setIsModalOpen(false);
        setFormData({ num: '', cap: 2, shape: 'Square' });
    };

    const handleUpdateTable = (e) => {
        e.preventDefault();
        if (!selectedTable) return;

        // Prevent duplicate table numbers (excluding the current table)
        if (tables.some(t => t.num === editData.num && t.id !== selectedTable.id)) {
            alert(`Table ${editData.num} already exists!`);
            return;
        }

        updateTableAsync(selectedTable.id, editData);
        setIsEditModalOpen(false);
        setSelectedTable(null);
    };

    const handleDragEnd = (id, info) => {
        const table = tables.find(t => t.id === id);
        if (table) {
            // Ensure coordinates stay within reasonable bounds of the 500px container
            const newX = Math.max(0, Math.min(800, table.pos.x + info.offset.x));
            const newY = Math.max(0, Math.min(410, table.pos.y + info.offset.y));
            updateTableAsync(id, { pos: { x: newX, y: newY } });
        }
    };

    return (
        <div className="glass-card rounded-3xl p-6 min-h-[500px]">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-xl font-bold text-text">Main Dining Floor</h2>
                    <p className="text-xs text-muted font-medium">Rearrange your floor plan by dragging tables</p>
                </div>
                {canManageTables && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-primary/20 text-primary border border-primary/30 px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/30 transition-all font-outfit"
                    >
                        <Plus size={16} /> Add Table
                    </button>
                )}
            </div>

            <div className="relative w-full h-[500px] border border-text/10 rounded-2xl bg-glass/20 p-8 overflow-hidden">
                {tables.map(table => (
                    <motion.div
                        key={table.id}
                        drag
                        onDragEnd={(e, info) => handleDragEnd(table.id, info)}
                        className={`absolute flex flex-col items-center justify-center p-4 rounded-2xl border cursor-pointer transition-all hover:scale-105 shadow-lg group ${getStatusColor(table.status)}`}
                        style={{ left: table.pos.x, top: table.pos.y, width: 90, height: 90 }}
                    >
                        <div className="text-xs font-black mb-1">T{table.num}</div>
                        {table.shape === 'Square' ? <Square size={24} /> : <Circle size={24} />}
                        <div className="flex items-center gap-1 mt-1 opacity-60">
                            <User size={10} />
                            <span className="text-[10px] font-bold">{table.cap}</span>
                        </div>

                        {canManageTables && (
                            <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTable(table);
                                        setEditData({ num: table.num, cap: table.cap, shape: table.shape });
                                        setIsEditModalOpen(true);
                                    }}
                                    className="p-1 bg-primary text-slate-950 rounded-full"
                                >
                                    <Edit2 size={10} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); deleteTableAsync(table.id); }}
                                    className="p-1 bg-red-500 text-slate-950 rounded-full"
                                >
                                    <Trash2 size={10} />
                                </button>
                            </div>
                        )}
                    </motion.div>
                ))}

                <div className="absolute bottom-4 right-4 text-[8px] text-muted font-mono">
                    Interactive Layout V2.0 - Persistence Enabled
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Restaurant Table">
                <form onSubmit={handleAddTable} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">Table Number</label>
                        <input
                            required
                            className="bg-glass/20 border border-text/10 rounded-xl p-3 text-text focus:outline-none"
                            value={formData.num}
                            onChange={e => setFormData({ ...formData, num: e.target.value })}
                            placeholder="e.g. 15"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">Capacity</label>
                            <input
                                type="number"
                                className="bg-glass/20 border border-text/10 rounded-xl p-3 text-text focus:outline-none"
                                value={formData.cap}
                                onChange={e => setFormData({ ...formData, cap: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">Shape</label>
                            <select
                                className="bg-glass border border-text/10 rounded-xl p-3 text-text focus:outline-none"
                                value={formData.shape}
                                onChange={e => setFormData({ ...formData, shape: e.target.value })}
                            >
                                <option value="Square">Square</option>
                                <option value="Circle">Circle</option>
                            </select>
                        </div>
                    </div>
                    <button type="submit" className="bg-primary text-slate-950 font-bold py-3 rounded-xl mt-4 hover:shadow-lg transition-all">
                        Create Table
                    </button>
                </form>
            </Modal>

            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Table Properties">
                <form onSubmit={handleUpdateTable} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">Table Number</label>
                        <input
                            required
                            className="bg-glass/20 border border-text/10 rounded-xl p-3 text-text focus:outline-none"
                            value={editData.num}
                            onChange={e => setEditData({ ...editData, num: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">Capacity</label>
                            <input
                                type="number"
                                className="bg-glass/20 border border-text/10 rounded-xl p-3 text-text focus:outline-none"
                                value={editData.cap}
                                onChange={e => setEditData({ ...editData, cap: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">Shape</label>
                            <select
                                className="bg-glass border border-text/10 rounded-xl p-3 text-text focus:outline-none"
                                value={editData.shape}
                                onChange={e => setEditData({ ...editData, shape: e.target.value })}
                            >
                                <option value="Square">Square</option>
                                <option value="Circle">Circle</option>
                            </select>
                        </div>
                    </div>
                    <button type="submit" className="bg-primary text-slate-950 font-bold py-3 rounded-xl mt-4 hover:shadow-lg transition-all">
                        Update Properties
                    </button>
                </form>
            </Modal>
        </div >
    );
};

export default FloorPlan;
