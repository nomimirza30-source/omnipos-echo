import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import {
    Clock, UserCheck, ShieldCheck, Plus, Play, Square,
    Users, DollarSign, Calendar, ChevronRight, Briefcase,
    Trash2, Edit3, Save, X, Tag, Shield, AlertCircle, CheckCircle2,
    CalendarDays, LayoutGrid
} from 'lucide-react';
import Modal from './Modal';
import { motion, AnimatePresence } from 'framer-motion';

const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const hours = Math.floor(i / 2).toString().padStart(2, '0');
    const minutes = (i % 2 === 0 ? '00' : '30');
    return `${hours}:${minutes}`;
});

const TimeSelect = ({ value, onChange, label }) => (
    <div className="space-y-1">
        {label && <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">{label}</label>}
        <select
            required
            className="w-full bg-glass/40 border border-text/10 rounded-2xl p-4 text-text text-sm focus:border-primary/50 transition-all outline-none"
            value={value}
            onChange={e => onChange(e.target.value)}
        >
            {timeOptions.map(t => <option key={t} value={t} className="bg-bg">{t}</option>)}
        </select>
    </div>
);

const StaffRota = () => {
    const {
        shifts = [], addShift, updateShift,
        employees = [], addEmployee, updateEmployee, deleteEmployee,
        roles = [], addRole, updateRole, deleteRole,
        staffingRequirements = [], addStaffingRequirement, updateStaffingRequirement,
        user
    } = useStore();

    const canManageStaff = ['Admin', 'Owner', 'Manager'].includes(user?.role);

    const [activeTab, setActiveTab] = useState('Directory'); // 'Directory', 'Payroll', 'Roles', 'Scheduling'
    const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
    const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [isRequirementModalOpen, setIsRequirementModalOpen] = useState(false);

    // Date Selection for Weekly View
    const getStartOfWeek = (d) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(date.setDate(diff));
    };

    const [weekStart, setWeekStart] = useState(getStartOfWeek(new Date()).toISOString().split('T')[0]);

    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            return {
                fullDate: d.toISOString().split('T')[0],
                label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
                dateNum: d.getDate()
            };
        });
    }, [weekStart]);

    const [shiftFormData, setShiftFormData] = useState({
        employeeId: '',
        start: '09:00',
        end: '17:00',
        date: new Date().toISOString().split('T')[0]
    });

    const [empFormData, setEmpFormData] = useState({
        name: '',
        role: roles[0]?.name || 'Waiter',
        payRate: 15,
        workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        status: 'Active'
    });

    const [roleFormData, setRoleFormData] = useState({
        name: '',
        permissions: []
    });

    const [reqFormData, setReqFormData] = useState({
        role: roles[0]?.name || 'Waiter',
        day: 'Mon',
        minStaff: 1,
        startTime: '17:00',
        endTime: '22:00',
        applyToAll: false
    });

    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // --- Helper Functions ---
    const getShiftsForDayRole = (date, roleName) => {
        return shifts.filter(s => s.date === date && s.role === roleName);
    };

    const getRequirementsForDayRole = (dayName, roleName) => {
        return staffingRequirements.filter(r => r.day === dayName && r.role === roleName);
    };

    const isShiftInTimeSlot = (shiftStart, shiftEnd, reqStart, reqEnd) => {
        // Simple overlap check
        const s = shiftStart.split(':').join('');
        const e = shiftEnd.split(':').join('');
        const rs = reqStart.split(':').join('');
        const re = reqEnd.split(':').join('');
        return (s <= rs && e >= re) || (s >= rs && s < re) || (e > rs && e <= re);
    };

    // --- Payroll Calculation ---
    const calculateHours = (start, end) => {
        const [sH, sM] = start.split(':').map(Number);
        const [eH, eM] = end.split(':').map(Number);
        const diff = (eH + eM / 60) - (sH + sM / 60);
        return diff > 0 ? diff : diff + 24;
    };

    const payroll = useMemo(() => {
        return employees.map(emp => {
            const empShifts = shifts.filter(s => s.employeeId === emp.id || s.staff === emp.name);
            const totalHours = empShifts.reduce((sum, s) => sum + calculateHours(s.start, s.end), 0);
            const totalWages = totalHours * emp.payRate;
            return { ...emp, totalHours, totalWages, shiftCount: empShifts.length };
        });
    }, [employees, shifts]);

    const handleCreateShift = (e) => {
        e.preventDefault();
        const emp = employees.find(e => e.id === shiftFormData.employeeId);
        if (!emp) return;

        addShift({
            ...shiftFormData,
            staff: emp.name,
            role: emp.role,
            status: 'Scheduled'
        });
        setIsShiftModalOpen(false);
    };

    const handleAddRequirement = (e) => {
        e.preventDefault();
        addStaffingRequirement(reqFormData);
        setIsRequirementModalOpen(false);
        setReqFormData({
            ...reqFormData,
            applyToAll: false
        });
    };

    const handleAddEmployee = (e) => {
        e.preventDefault();
        addEmployee(empFormData);
        setIsEmployeeModalOpen(false);
        setEmpFormData({
            name: '',
            role: roles[0]?.name || 'Waiter',
            payRate: 15,
            workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            status: 'Active'
        });
    };

    const handleAddRole = (e) => {
        e.preventDefault();
        addRole(roleFormData);
        setIsRoleModalOpen(false);
        setRoleFormData({ name: '', permissions: [] });
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="glass-card rounded-3xl overflow-hidden" style={{ background: 'rgb(8 14 30 / 0.85)' }}>
                <div className="px-6 py-4 border-b border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-black text-white">Staff & Rota Management</h2>
                        <p className="text-[10px] text-[rgb(100_120_150)] font-bold uppercase tracking-widest mt-0.5">Scheduling, payroll & role management</p>
                    </div>
                    <div className="flex p-0.5 bg-black/20 rounded-xl border border-white/5 gap-0">
                        {['Directory', 'Payroll', 'Roles', 'Scheduling'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === tab
                                        ? 'bg-[rgb(0_210_180)] text-[#020d1a]'
                                        : 'text-[rgb(80_100_130)] hover:text-white'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {activeTab === 'Directory' && (
                <div className="grid grid-cols-1 gap-4">
                    {employees.map(emp => (
                        <motion.div layout key={emp.id} className="glass-card p-6 rounded-3xl border border-text/10 bg-glass/20 flex flex-col md:flex-row items-center justify-between gap-6 group hover:border-primary/30 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-glass/40 flex items-center justify-center font-black text-primary border border-text/10">
                                    {emp.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div>
                                    <div className="text-lg font-black text-text">{emp.name}</div>
                                    <div className="text-[10px] font-bold text-muted uppercase tracking-widest flex items-center gap-2">
                                        <Tag size={12} className="text-secondary" /> {emp.role}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {daysOfWeek.map(day => (
                                    <span key={day} className={`px-2 py-1 rounded-md text-[8px] font-black uppercase ${emp.workingDays.includes(day) ? 'bg-success/20 text-success' : 'bg-glass/20 text-muted'}`}>
                                        {day}
                                    </span>
                                ))}
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <div className="text-lg font-black text-text">£{emp.payRate}</div>
                                    <div className="text-[10px] font-bold text-muted uppercase">HOURLY</div>
                                </div>
                                {canManageStaff && (
                                    <button onClick={() => deleteEmployee(emp.id)} className="p-2 text-muted hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                                )}
                            </div>
                        </motion.div>
                    ))}
                    {canManageStaff && (
                        <button onClick={() => setIsEmployeeModalOpen(true)} className="glass-card p-4 rounded-2xl border border-dashed border-text/10 text-muted hover:text-primary hover:border-primary/50 transition-all font-black uppercase text-[10px] tracking-widest">
                            + Onboard New Personnel
                        </button>
                    )}
                </div>
            )}

            {activeTab === 'Scheduling' && (
                <div className="space-y-6">
                    {/* Weekly Grid Controls */}
                    <div className="flex flex-col md:flex-row justify-between items-center bg-glass/40 p-6 rounded-[2.5rem] border border-text/10 gap-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => {
                                    const d = new Date(weekStart);
                                    d.setDate(d.getDate() - 7);
                                    setWeekStart(d.toISOString().split('T')[0]);
                                }}
                                className="p-3 bg-glass/20 rounded-2xl hover:bg-glass/40 transition-all text-text"
                            >
                                <ChevronRight size={20} className="rotate-180" />
                            </button>
                            <div className="text-center">
                                <h3 className="text-lg font-black text-text uppercase tracking-widest">Weekly Roster</h3>
                                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Current Period Start: {weekStart}</p>
                            </div>
                            <button
                                onClick={() => {
                                    const d = new Date(weekStart);
                                    d.setDate(d.getDate() + 7);
                                    setWeekStart(d.toISOString().split('T')[0]);
                                }}
                                className="p-3 bg-glass/20 rounded-2xl hover:bg-glass/40 transition-all text-text"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        {/* Health Summary */}
                        <div className="hidden lg:flex gap-4 px-8 border-l border-text/10">
                            <div className="text-center">
                                <div className="text-xl font-black text-success">{staffingRequirements.length ? '100%' : '0%'}</div>
                                <div className="text-[8px] font-black text-muted uppercase">Readiness</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xl font-black text-text">{staffingRequirements.length}</div>
                                <div className="text-[8px] font-black text-muted uppercase">Active Slots</div>
                            </div>
                        </div>

                        {canManageStaff && (
                            <div className="flex gap-2">
                                <button onClick={() => setIsRequirementModalOpen(true)} className="bg-secondary/20 text-secondary border border-secondary/20 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-secondary hover:text-slate-950 transition-all">
                                    Set Mandatory Levels
                                </button>
                                <button onClick={() => setIsShiftModalOpen(true)} className="bg-primary text-slate-950 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all">
                                    Allocate Hours
                                </button>
                            </div>
                        )}
                    </div>

                    {/* The Weekly Grid */}
                    <div className="glass-card rounded-[2.5rem] border border-text/10 overflow-hidden bg-glass/40">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className="p-6 bg-glass/20 border-b border-r border-text/10 min-w-[200px]">
                                            <div className="text-[10px] font-black text-muted uppercase tracking-widest text-left">ROLE \ DAY</div>
                                        </th>
                                        {weekDays.map(day => (
                                            <th key={day.fullDate} className="p-6 bg-glass/20 border-b border-text/10 min-w-[150px]">
                                                <div className="text-[10px] font-black text-muted uppercase tracking-widest">{day.label}</div>
                                                <div className="text-xl font-black text-text">{day.dateNum}</div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(roles.length > 0 ? roles : [{ name: 'Waiter', id: 'R-Default' }]).concat({ name: 'Admin', id: 'Admin' }).map(roleItem => {
                                        const roleName = roleItem.name || roleItem.id;
                                        return (
                                            <tr key={roleName} className="group hover:bg-glass/10">
                                                <td className="p-6 border-r border-b border-text/10 bg-glass/40">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                                            <Briefcase size={16} />
                                                        </div>
                                                        <span className="font-black text-text text-xs uppercase">{roleName}</span>
                                                    </div>
                                                </td>
                                                {weekDays.map(day => {
                                                    const dayReqs = getRequirementsForDayRole(day.label, roleName);
                                                    const dayShifts = getShiftsForDayRole(day.fullDate, roleName);

                                                    // Determine health based on ALL requirements for this role/day
                                                    let status = 'Optimal';
                                                    if (dayReqs.length > 0) {
                                                        const unmet = dayReqs.find(req => {
                                                            const coveringShifts = dayShifts.filter(s => isShiftInTimeSlot(s.start, s.end, req.startTime, req.endTime));
                                                            return coveringShifts.length < req.minStaff;
                                                        });
                                                        if (unmet) {
                                                            status = dayShifts.length === 0 ? 'Critical' : 'Understaffed';
                                                        }
                                                    }

                                                    return (
                                                        <td key={day.fullDate} className="p-3 border-b border-text/10 group-hover:bg-glass/10 transition-all">
                                                            <div className={`h-full min-h-[140px] rounded-2xl p-4 border transition-all ${status === 'Optimal' ? 'bg-success/5 border-success/10 group-hover:border-success/30' :
                                                                status === 'Critical' ? 'bg-red-500/5 border-red-500/10 group-hover:border-red-500/30' :
                                                                    'bg-warning/5 border-warning/10 group-hover:border-warning/30'
                                                                }`}>
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <div className="space-y-1">
                                                                        {dayReqs.map(req => (
                                                                            <div key={req.id} className="text-[8px] font-black text-muted uppercase tracking-tighter">
                                                                                REQ: {req.startTime}-{req.endTime} ({req.minStaff})
                                                                            </div>
                                                                        ))}
                                                                        {dayReqs.length === 0 && <div className="text-[8px] font-black text-muted uppercase">No Requirements</div>}
                                                                    </div>
                                                                    {status === 'Optimal' ? <CheckCircle2 size={12} className="text-success" /> : <AlertCircle size={12} className={status === 'Critical' ? 'text-red-500' : 'text-warning'} />}
                                                                </div>
                                                                <div className="space-y-1 border-t border-text/10 pt-2">
                                                                    {dayShifts.map(s => (
                                                                        <div key={s.id} className="bg-glass/40 p-1.5 rounded-lg border border-text/10 text-[9px] font-bold text-text truncate flex justify-between gap-1">
                                                                            <span className="truncate">{s.staff}</span>
                                                                            <span className="text-[7px] text-muted shrink-0">{s.start}-{s.end}</span>
                                                                        </div>
                                                                    ))}
                                                                    {dayShifts.length === 0 && (
                                                                        <div className="text-[8px] font-black text-muted uppercase italic py-2">No Coverage</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'Payroll' && (
                <div className="glass-card rounded-[2.5rem] border border-text/10 overflow-hidden">
                    <div className="p-8 border-b border-text/10 flex justify-between items-center">
                        <h3 className="text-lg font-black text-text uppercase tracking-widest">Payroll Summary</h3>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Total Wages for Current Rota</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-glass/40 text-[10px] font-black text-muted uppercase">
                                <tr>
                                    <th className="px-8 py-4">Employee</th>
                                    <th className="px-8 py-4">Hours</th>
                                    <th className="px-8 py-4 text-right">Settlement</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-text/10">
                                {payroll.map(p => (
                                    <tr key={p.id} className="font-bold text-sm">
                                        <td className="px-8 py-6 text-text">{p.name}</td>
                                        <td className="px-8 py-6 text-muted">{p.totalHours.toFixed(1)}h</td>
                                        <td className="px-8 py-6 text-right text-success text-lg font-black">£{p.totalWages.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'Roles' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {roles.map(role => (
                        <div key={role.id} className="glass-card p-8 rounded-3xl border border-text/10 bg-glass/20 group hover:border-secondary/30 transition-all">
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-12 h-12 rounded-xl bg-secondary/20 text-secondary flex items-center justify-center shadow-lg shadow-secondary/10">
                                    <Shield size={24} />
                                </div>
                                {canManageStaff && (
                                    <button onClick={() => deleteRole(role.id)} className="text-muted hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                )}
                            </div>
                            <h4 className="text-xl font-black text-text uppercase mb-2">{role.name}</h4>
                            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{employees.filter(e => e.role === role.name).length} PERSONNEL ASSIGNED</p>
                        </div>
                    ))}
                    {canManageStaff && (
                        <button onClick={() => setIsRoleModalOpen(true)} className="glass-card p-8 rounded-3xl border border-dashed border-text/10 text-muted hover:text-secondary hover:border-secondary/50 transition-all font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2">
                            + Create New Role
                        </button>
                    )}
                </div>
            )}

            {/* Modals */}
            <Modal isOpen={isShiftModalOpen} onClose={() => setIsShiftModalOpen(false)} title="Allocate Hours">
                <form onSubmit={handleCreateShift} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Personnel</label>
                        <select required className="w-full bg-glass/40 border border-text/10 rounded-2xl p-4 text-text text-sm" value={shiftFormData.employeeId} onChange={e => setShiftFormData({ ...shiftFormData, employeeId: e.target.value })}>
                            <option value="" className="bg-bg">Select Employee...</option>
                            {employees.map(e => <option key={e.id} value={e.id} className="bg-bg">{e.name} ({e.role})</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Target Date</label>
                        <input type="date" required className="w-full bg-glass/40 border border-text/10 rounded-2xl p-4 text-text text-sm" value={shiftFormData.date} onChange={e => setShiftFormData({ ...shiftFormData, date: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <TimeSelect label="Shift Start" value={shiftFormData.start} onChange={v => setShiftFormData({ ...shiftFormData, start: v })} />
                        <TimeSelect label="Shift End" value={shiftFormData.end} onChange={v => setShiftFormData({ ...shiftFormData, end: v })} />
                    </div>
                    <button type="submit" className="w-full bg-primary text-slate-950 font-black py-4 rounded-2xl mt-4">Assign Hours</button>
                </form>
            </Modal>

            <Modal isOpen={isRequirementModalOpen} onClose={() => setIsRequirementModalOpen(false)} title="Set Mandatory Levels">
                <form onSubmit={handleAddRequirement} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Role</label>
                            <select className="w-full bg-glass/40 border border-text/10 rounded-2xl p-4 text-text text-sm" value={reqFormData.role} onChange={e => setReqFormData({ ...reqFormData, role: e.target.value })}>
                                {(roles.length > 0 ? roles : [{ name: 'Waiter', id: 'R-Default' }]).concat({ name: 'Admin', id: 'Admin' }).map(r => <option key={r.id} value={r.name || r.id} className="bg-bg">{r.name || r.id}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Day of Week</label>
                            <select disabled={reqFormData.applyToAll} className="w-full bg-glass/40 border border-text/10 rounded-2xl p-4 text-text text-sm disabled:opacity-30" value={reqFormData.day} onChange={e => setReqFormData({ ...reqFormData, day: e.target.value })}>
                                {daysOfWeek.map(d => <option key={d} value={d} className="bg-bg">{d}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <TimeSelect label="Slot Starts" value={reqFormData.startTime} onChange={v => setReqFormData({ ...reqFormData, startTime: v })} />
                        <TimeSelect label="Slot Ends" value={reqFormData.endTime} onChange={v => setReqFormData({ ...reqFormData, endTime: v })} />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Minimum Headcount</label>
                        <input type="number" min="0" required className="w-full bg-glass/40 border border-text/10 rounded-2xl p-4 text-text text-sm" value={reqFormData.minStaff} onChange={e => setReqFormData({ ...reqFormData, minStaff: parseInt(e.target.value) })} />
                    </div>

                    <label className="flex items-center gap-3 p-4 bg-glass/20 rounded-2xl border border-text/10 cursor-pointer hover:bg-glass/40 transition-all">
                        <input type="checkbox" className="w-5 h-5 rounded-md bg-glass/40 border-text/10 text-primary focus:ring-primary" checked={reqFormData.applyToAll} onChange={e => setReqFormData({ ...reqFormData, applyToAll: e.target.checked })} />
                        <div>
                            <div className="text-[10px] font-black text-text uppercase tracking-widest">Apply to All Days</div>
                            <div className="text-[8px] font-bold text-muted uppercase">Set this level for the entire week</div>
                        </div>
                    </label>

                    <button type="submit" className="w-full bg-secondary text-slate-950 font-black py-4 rounded-2xl mt-4">Save Mandatory Slot</button>
                </form>
            </Modal>

            {/* Employee Modal */}
            <Modal isOpen={isEmployeeModalOpen} onClose={() => setIsEmployeeModalOpen(false)} title="Onboard Personnel">
                <form onSubmit={handleAddEmployee} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Name</label>
                        <input required className="w-full bg-glass/40 border border-text/10 rounded-2xl p-4 text-text text-sm" value={empFormData.name} onChange={e => setEmpFormData({ ...empFormData, name: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Role</label>
                            <select className="w-full bg-glass/40 border border-text/10 rounded-2xl p-4 text-text text-sm" value={empFormData.role} onChange={e => setEmpFormData({ ...empFormData, role: e.target.value })}>
                                {roles.map(r => <option key={r.id} value={r.name} className="bg-bg">{r.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Rate (£)</label>
                            <input type="number" required className="w-full bg-glass/40 border border-text/10 rounded-2xl p-4 text-text text-sm" value={empFormData.payRate} onChange={e => setEmpFormData({ ...empFormData, payRate: parseFloat(e.target.value) })} />
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-primary text-slate-950 font-black py-4 rounded-2xl mt-4">Onboard Staff</button>
                </form>
            </Modal>

            <Modal isOpen={isRoleModalOpen} onClose={() => setIsRoleModalOpen(false)} title="Define New Role">
                <form onSubmit={handleAddRole} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">Role Title</label>
                        <input required className="w-full bg-glass/40 border border-text/10 rounded-2xl p-4 text-text text-sm" placeholder="e.g. Sommelier" value={roleFormData.name} onChange={e => setRoleFormData({ ...roleFormData, name: e.target.value })} />
                    </div>
                    <button type="submit" className="w-full bg-secondary text-slate-950 font-black py-4 rounded-2xl mt-4">Create Role</button>
                </form>
            </Modal>
        </div>
    );
};

export default StaffRota;
