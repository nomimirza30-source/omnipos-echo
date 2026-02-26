import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import {
    Calendar as CalendarIcon, Clock, User, Phone, MapPin,
    Plus, Trash2, ChevronLeft, ChevronRight, CheckCircle2,
    XCircle, LayoutGrid, List, CalendarDays, Calendar as CalendarIcon2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from './Modal';

const Reservations = () => {
    const { tables, reservations, addReservation, deleteReservation, updateReservation, currentTenantId } = useStore();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [view, setView] = useState('Day'); // Day, Week, Month
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        customerName: '',
        customerPhone: '',
        tableId: '',
        time: '12:00',
    });

    // Helper: Get start of week
    const getStartOfWeek = (d) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday start
        return new Date(date.setDate(diff));
    };

    // Helper: Get days in month
    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

    const tenantReservations = reservations.filter(r => r.tenantId === currentTenantId);
    const dayReservations = tenantReservations.filter(r => r.date === selectedDate);

    // Generate hours for the day view
    const hours = Array.from({ length: 14 }, (_, i) => `${String(i + 9).padStart(2, '0')}:00`);

    const handleAddReservation = (e) => {
        e.preventDefault();
        addReservation({
            ...formData,
            date: selectedDate,
            endTime: `${String(parseInt(formData.time.split(':')[0]) + 1).padStart(2, '0')}:00`
        });
        setIsModalOpen(false);
        setFormData({ customerName: '', customerPhone: '', tableId: '', time: '12:00' });
    };

    const changeDate = (amount) => {
        const d = new Date(selectedDate);
        if (view === 'Day') d.setDate(d.getDate() + amount);
        else if (view === 'Week') d.setDate(d.getDate() + (amount * 7));
        else if (view === 'Month') d.setMonth(d.getMonth() + amount);
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    const renderDayView = () => (
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
            <div className="space-y-2 hidden lg:block pr-4">
                {hours.map(hour => (
                    <div key={hour} className="h-[80px] flex flex-col justify-start pt-2">
                        <span className="text-xs font-black text-muted border-r-2 border-primary/20 pr-4 text-right block uppercase">{hour}</span>
                    </div>
                ))}
            </div>
            <div className="space-y-4 relative">
                <div className="absolute inset-0 z-0 pointer-events-none opacity-5">
                    {hours.map((_, i) => <div key={i} className="h-[80px] border-b border-white" />)}
                </div>
                <div className="relative z-10 grid grid-cols-1 gap-4">
                    {dayReservations.length === 0 ? (
                        <div className="glass-card rounded-[2rem] p-20 text-center border-dashed border-2 border-text/10">
                            <CalendarIcon size={48} className="mx-auto text-muted mb-4 opacity-20" />
                            <div className="text-muted font-bold italic">No reservations for this date.</div>
                        </div>
                    ) : (
                        dayReservations.sort((a, b) => a.time.localeCompare(b.time)).map(res => (
                            <motion.div key={res.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 rounded-3xl border border-text/10 flex items-center justify-between group">
                                <div className="flex items-center gap-6">
                                    <div className="text-center bg-glass/20 p-4 rounded-2xl min-w-[100px] border border-text/10">
                                        <div className="text-xl font-black text-primary">{res.time}</div>
                                        <div className="text-[9px] text-muted font-black uppercase">to {res.endTime}</div>
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-black text-text">{res.customerName}</h4>
                                        <div className="flex gap-4 text-[10px] font-bold text-muted uppercase">
                                            <span className="flex items-center gap-1"><MapPin size={12} /> Table {tables.find(t => t.id === res.tableId)?.num}</span>
                                            <span className="flex items-center gap-1"><Phone size={12} /> {res.customerPhone}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => updateReservation(res.id, { status: 'Checked-in' })} className="p-2 bg-success/10 text-success rounded-lg hover:bg-success/20"><CheckCircle2 size={18} /></button>
                                    <button onClick={() => deleteReservation(res.id)} className="p-2 bg-red-400/10 text-red-400 rounded-lg hover:bg-red-400/20"><Trash2 size={18} /></button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );

    const renderWeekView = () => {
        const start = getStartOfWeek(selectedDate);
        const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });

        return (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                {days.map(d => {
                    const dateStr = d.toISOString().split('T')[0];
                    const resCount = tenantReservations.filter(r => r.date === dateStr).length;
                    const isToday = new Date().toISOString().split('T')[0] === dateStr;
                    return (
                        <div key={dateStr} onClick={() => { setSelectedDate(dateStr); setView('Day'); }} className={`glass-card p-4 rounded-3xl border min-h-[300px] cursor-pointer hover:border-primary/50 transition-all ${isToday ? 'border-primary/40 bg-primary/10' : 'border-text/10'}`}>
                            <div className="text-center mb-4 border-b border-text/10 pb-2">
                                <div className="text-[10px] font-black text-muted uppercase tracking-widest">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</div>
                                <div className={`text-xl font-black ${isToday ? 'text-primary' : 'text-text'}`}>{d.getDate()}</div>
                            </div>
                            <div className="space-y-2">
                                {tenantReservations.filter(r => r.date === dateStr).slice(0, 4).map(r => (
                                    <div key={r.id} className="text-[9px] bg-glass/20 p-2 rounded-lg border border-text/10 text-muted font-bold">
                                        {r.time} • {r.customerName.split(' ')[0]}
                                    </div>
                                ))}
                                {resCount > 4 && <div className="text-[8px] text-center text-primary font-black">+{resCount - 4} More</div>}
                                {resCount === 0 && <div className="text-center py-10 opacity-10"><CalendarIcon size={24} className="mx-auto" /></div>}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderMonthView = () => {
        const d = new Date(selectedDate);
        const year = d.getFullYear();
        const month = d.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        const padding = Array.from({ length: (firstDayOfMonth + 6) % 7 }, (_, i) => null); // Align to Monday

        return (
            <div className="bg-glass/20 rounded-[2.5rem] p-8 border border-text/10 grid grid-cols-7 gap-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <div key={day} className="text-center text-[10px] font-black text-muted uppercase py-4">{day}</div>
                ))}
                {padding.map((_, i) => <div key={`p-${i}`} className="aspect-square opacity-0" />)}
                {days.map(day => {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const resCount = tenantReservations.filter(r => r.date === dateStr).length;
                    const isToday = new Date().toISOString().split('T')[0] === dateStr;
                    return (
                        <div key={day} onClick={() => { setSelectedDate(dateStr); setView('Day'); }} className={`aspect-square rounded-2xl border flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 ${isToday ? 'bg-primary/20 border-primary text-text' : 'bg-glass/20 border-text/10 text-muted hover:border-text/20'}`}>
                            <span className="text-sm font-black">{day}</span>
                            {resCount > 0 && <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_5px_rgba(56,189,248,1)]" />}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Extended Header with View Switcher */}
            <div className="glass-card p-6 rounded-[2.5rem] bg-glass/20 border border-text/10 space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
                            <CalendarIcon size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-text tracking-tight">Reservation Manager</h2>
                            <p className="text-[10px] text-muted font-bold uppercase tracking-[0.2em] mt-1">Unified Multi-View Scheduling</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-glass/20 p-1.5 rounded-2xl border border-text/10 shadow-inner">
                        <button onClick={() => setView('Day')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest ${view === 'Day' ? 'bg-primary text-slate-950 shadow-lg shadow-primary/20' : 'text-muted hover:text-text hover:bg-glass/20'}`}>
                            <List size={14} /> Day
                        </button>
                        <button onClick={() => setView('Week')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest ${view === 'Week' ? 'bg-primary text-slate-950 shadow-lg shadow-primary/20' : 'text-muted hover:text-text hover:bg-glass/20'}`}>
                            <LayoutGrid size={14} /> Week
                        </button>
                        <button onClick={() => setView('Month')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest ${view === 'Month' ? 'bg-primary text-slate-950 shadow-lg shadow-primary/20' : 'text-muted hover:text-text hover:bg-glass/20'}`}>
                            <CalendarDays size={14} /> Month
                        </button>
                    </div>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-primary text-slate-950 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <Plus size={18} className="inline mr-2" /> Book Table
                    </button>
                </div>

                <div className="flex justify-center items-center gap-4 bg-glass/20 p-2 rounded-2xl w-fit mx-auto border border-text/10">
                    <button onClick={() => changeDate(-1)} className="p-3 hover:bg-glass/20 rounded-xl text-muted group"><ChevronLeft size={20} className="group-hover:scale-125 transition-transform" /></button>
                    <div className="px-10 py-2.5 bg-primary/10 text-primary border border-primary/20 rounded-xl font-black text-xs uppercase tracking-widest min-w-[240px] text-center shadow-lg shadow-primary/5">
                        {view === 'Month'
                            ? new Date(selectedDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
                            : new Date(selectedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                    <button onClick={() => changeDate(1)} className="p-3 hover:bg-glass/20 rounded-xl text-muted group"><ChevronRight size={20} className="group-hover:scale-125 transition-transform" /></button>
                </div>
            </div>

            {/* Dynamic View Container */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={view + selectedDate}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                >
                    {view === 'Day' && renderDayView()}
                    {view === 'Week' && renderWeekView()}
                    {view === 'Month' && renderMonthView()}
                </motion.div>
            </AnimatePresence>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Reservation">
                <form onSubmit={handleAddReservation} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest px-1">Customer Name</label>
                            <input required className="w-full bg-glass/20 border border-text/10 rounded-2xl p-4 text-text" value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value })} placeholder="e.g. David Smith" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest px-1">Phone Number</label>
                            <input className="w-full bg-glass/20 border border-text/10 rounded-2xl p-4 text-text" value={formData.customerPhone} onChange={e => setFormData({ ...formData, customerPhone: e.target.value })} placeholder="+44..." />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest px-1">Start Time (1 Hr)</label>
                            <select className="w-full bg-glass border border-text/10 rounded-2xl p-4 text-text" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })}>
                                {hours.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest px-1">Select Table</label>
                            <select required className="w-full bg-glass border border-text/10 rounded-2xl p-4 text-text" value={formData.tableId} onChange={e => setFormData({ ...formData, tableId: e.target.value })}>
                                <option value="">Pick a Table</option>
                                {tables.map(t => <option key={t.id} value={t.id}>Table {t.num} ({t.cap} PAX)</option>)}
                            </select>
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-primary text-slate-950 font-black py-5 rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.01] transition-all">Confirm Booking</button>
                </form>
            </Modal>
        </div>
    );
};

export default Reservations;
