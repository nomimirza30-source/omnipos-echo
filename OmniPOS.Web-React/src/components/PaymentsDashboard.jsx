import React, { useState, useEffect } from 'react';
import { Banknote, CreditCard, TrendingUp, Calendar, ArrowRight, ArrowUpRight, Search, Filter, Download, Trash2, Printer, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { generateReceipt } from '../utils/receiptGenerator';
import { useStore } from '../store/useStore';

const PaymentsDashboard = () => {
    const { orders, currentTenantId, deleteOrder, cashRegister, openRegister, closeRegister, cashLogs, fetchCashLogs, addCashLog, user, isAdmin, branding } = useStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [methodFilter, setMethodFilter] = useState('All'); // All, Cash, Card
    const [isOpeningRegister, setIsOpeningRegister] = useState(false);
    const [openingAmount, setOpeningAmount] = useState('');

    // Petty Cash state
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawReason, setWithdrawReason] = useState('');

    useEffect(() => {
        if (isAdmin || ['Admin', 'Owner', 'Manager', 'Till'].includes(user?.role)) {
            fetchCashLogs();
        }
    }, [fetchCashLogs, user, isAdmin]);

    const paidOrders = orders.filter(o =>
        o.tenantId === currentTenantId &&
        o.status === 'Paid'
    );

    const filteredOrders = paidOrders.filter(o => {
        const matchesSearch = (o.customerName || 'Walk-in').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (o.id || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesMethod = methodFilter === 'All' || (o.paymentMethod || '').includes(methodFilter);
        return matchesSearch && matchesMethod;
    });

    const cashTotal = paidOrders
        .filter(o => o.paymentMethod === 'Cash')
        .reduce((sum, o) => sum + parseFloat((o.finalTotal !== undefined && o.finalTotal !== null) ? o.finalTotal : o.amount), 0);

    const cardTotal = paidOrders
        .filter(o => o.paymentMethod === 'Card')
        .reduce((sum, o) => sum + parseFloat((o.finalTotal !== undefined && o.finalTotal !== null) ? o.finalTotal : o.amount), 0);

    const totalRevenue = cashTotal + cardTotal;

    const handleOpenRegister = () => {
        if (!openingAmount) return;
        openRegister(openingAmount);
        setIsOpeningRegister(false);
        setOpeningAmount('');
    };

    const handleWithdrawCash = async () => {
        if (!withdrawAmount || !withdrawReason) return;

        const res = await addCashLog(parseFloat(withdrawAmount), withdrawReason);
        if (res.success) {
            setIsWithdrawing(false);
            setWithdrawAmount('');
            setWithdrawReason('');
        }
    };

    const handleExportExcel = () => {
        const reportData = filteredOrders.map(o => ({
            'Transaction ID': o.id,
            'Customer': o.customerName || 'Walk-in',
            'Method': o.paymentMethod,
            'Amount': `£${parseFloat((o.finalTotal !== undefined && o.finalTotal !== null) ? o.finalTotal : o.amount).toFixed(2)}`,
            'Settled At': new Date(o.paidAt).toLocaleString(),
            'Status': o.status
        }));

        const ws = XLSX.utils.json_to_sheet(reportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Financial Report");

        // Auto-size columns
        const mw = reportData.reduce((w, r) => Math.max(w, Object.values(r).join('').length), 10);
        ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 25 }, { wch: 10 }];

        XLSX.writeFile(wb, `Financial_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleDeletePayment = (id) => {
        if (window.confirm('Are you sure you want to delete this payment record? This will also remove the associated order and free any linked tables.')) {
            deleteOrder(id);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-text tracking-tighter">Payments & Revenue</h1>
                    <p className="text-muted font-bold uppercase text-xs tracking-widest mt-2 flex items-center gap-2">
                        <Calendar size={14} className="text-primary" /> Financial Overview • Real-time
                    </p>
                </div>
                <div className="bg-primary/10 px-6 py-3 rounded-2xl border border-primary/20">
                    <span className="text-[10px] font-black uppercase text-primary tracking-widest block mb-1">Total Revenue</span>
                    <span className="text-3xl font-black text-text">£{totalRevenue.toFixed(2)}</span>
                </div>
            </div>

            {/* Cash Drawer Status */}
            <div className={`p-6 rounded-[2.5rem] border ${cashRegister.isOpen ? 'bg-success/5 border-success/20' : 'bg-warning/5 border-warning/20'} transition-all`}>
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${cashRegister.isOpen ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning shadow-lg'}`}>
                            <Banknote size={28} className={cashRegister.isOpen ? '' : 'animate-pulse'} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-text uppercase tracking-wide">Cash Drawer: {cashRegister.isOpen ? 'OPEN' : 'CLOSED'}</h3>
                            <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-0.5">
                                {cashRegister.isOpen
                                    ? `Session started at ${new Date(cashRegister.lastOpenedAt).toLocaleTimeString()}`
                                    : 'Please open the register to track physical cash'
                                }
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        {cashRegister.isOpen && (
                            <>
                                <div className="text-right">
                                    <span className="text-[8px] font-black uppercase text-muted tracking-widest block mb-0.5">Opening Float</span>
                                    <span className="text-xl font-black text-text">£{cashRegister.openingBalance.toFixed(2)}</span>
                                </div>
                                <div className="text-right border-x border-text/10 px-6 mx-2">
                                    <span className="text-[8px] font-black uppercase text-success tracking-widest block mb-0.5">Expected in Drawer</span>
                                    <span className="text-3xl font-black text-success">£{(cashRegister.currentBalance).toFixed(2)}</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => setIsWithdrawing(true)}
                                        className="px-6 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20 rounded-xl text-[10px] font-black uppercase transition-all"
                                    >
                                        Withdraw Cash
                                    </button>
                                    <button
                                        onClick={() => { if (window.confirm('Close register and log final balance?')) closeRegister(); }}
                                        className="px-6 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-text border border-red-500/20 rounded-xl text-[10px] font-black uppercase transition-all"
                                    >
                                        Close Shift
                                    </button>
                                </div>
                            </>
                        )}

                        {!cashRegister.isOpen && !isOpeningRegister && (
                            <button
                                onClick={() => setIsOpeningRegister(true)}
                                className="px-8 py-3 bg-primary text-slate-900 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
                            >
                                Open Cash Register
                            </button>
                        )}

                        {!cashRegister.isOpen && isOpeningRegister && (
                            <div className="flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-bold">£</span>
                                    <input
                                        type="number"
                                        placeholder="Enter Float..."
                                        className="bg-white border border-primary/30 rounded-xl py-2 pl-7 pr-3 text-xs font-bold text-slate-900 w-32 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        value={openingAmount}
                                        onChange={(e) => setOpeningAmount(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <button
                                    onClick={handleOpenRegister}
                                    className="px-4 py-2 bg-primary text-slate-900 rounded-xl text-[10px] font-black uppercase"
                                >
                                    Confirm
                                </button>
                                <button
                                    onClick={() => setIsOpeningRegister(false)}
                                    className="p-2 text-muted hover:text-text"
                                >
                                    <ArrowRight size={16} className="rotate-180" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Summary Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Revenue', value: `£${totalRevenue.toFixed(2)}`, sub: `${paidOrders.length} transactions`, icon: TrendingUp, color: 'text-[rgb(0,210,180)]', bg: 'bg-[rgb(0_210_180_/_0.1)]', border: 'border-[rgb(0_210_180_/_0.2)]' },
                    { label: 'Cash Payments', value: `£${cashTotal.toFixed(2)}`, sub: `${paidOrders.filter(o => o.paymentMethod === 'Cash').length} orders`, icon: Banknote, color: 'text-[rgb(52,211,153)]', bg: 'bg-[rgb(52_211_153_/_0.1)]', border: 'border-[rgb(52_211_153_/_0.2)]' },
                    { label: 'Card Payments', value: `£${cardTotal.toFixed(2)}`, sub: `${paidOrders.filter(o => o.paymentMethod === 'Card').length} orders`, icon: CreditCard, color: 'text-[rgb(100,160,255)]', bg: 'bg-[rgb(100_160_255_/_0.1)]', border: 'border-[rgb(100_160_255_/_0.2)]' },
                    { label: 'Avg. Ticket', value: paidOrders.length ? `£${(totalRevenue / paidOrders.length).toFixed(2)}` : '£0.00', sub: 'Per settled order', icon: ArrowUpRight, color: 'text-[rgb(251,191,36)]', bg: 'bg-[rgb(251_191_36_/_0.1)]', border: 'border-[rgb(251_191_36_/_0.2)]' },
                ].map(({ label, value, sub, icon: Icon, color, bg, border }) => (
                    <div key={label} className={`glass-card rounded-2xl p-4 border ${border}`} style={{ background: 'rgb(8 14 30 / 0.8)' }}>
                        <div className={`w-9 h-9 rounded-xl ${bg} ${color} flex items-center justify-center mb-3`}>
                            <Icon size={18} />
                        </div>
                        <div className={`text-2xl font-black ${color}`}>{value}</div>
                        <div className="text-[10px] text-[rgb(80_100_130)] font-bold uppercase tracking-widest mt-0.5">{label}</div>
                        <div className="text-[9px] text-[rgb(60_80_110)] font-bold mt-1">{sub}</div>
                    </div>
                ))}
            </div>

            {/* Withdraw Cash Modal Overlay */}
            {isWithdrawing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
                    <div className="glass-card rounded-[2.5rem] p-8 max-w-sm w-full border border-orange-500/20 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="w-12 h-12 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center mb-6 border border-orange-500/20">
                            <Banknote size={24} />
                        </div>
                        <h3 className="text-2xl font-black text-text mb-2">Withdraw Petty Cash</h3>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-6">Record a cash withdrawal from the register</p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 block">Amount (£)</label>
                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    className="w-full bg-glass/20 border border-text/10 rounded-xl p-3 text-text font-bold focus:outline-none focus:border-orange-500/50"
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    placeholder="0.00"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 block">Reason / Details</label>
                                <input
                                    type="text"
                                    className="w-full bg-glass/20 border border-text/10 rounded-xl p-3 text-text font-bold focus:outline-none focus:border-orange-500/50"
                                    value={withdrawReason}
                                    onChange={(e) => setWithdrawReason(e.target.value)}
                                    placeholder="e.g., Supplies, Milk run..."
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setIsWithdrawing(false)}
                                    className="flex-1 px-4 py-3 bg-glass/20 text-muted hover:text-text rounded-xl text-xs font-black uppercase transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleWithdrawCash}
                                    disabled={!withdrawAmount || !withdrawReason}
                                    className="flex-1 px-4 py-3 bg-orange-500 text-slate-950 rounded-xl text-xs font-black uppercase shadow-lg shadow-orange-500/20 disabled:opacity-50 transition-all font-bold"
                                >
                                    Submit
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Petty Cash Log Table */}
            {cashLogs && cashLogs.length > 0 && (
                <div className="glass-card rounded-[2.5rem] overflow-hidden">
                    <div className="p-8 border-b border-text/10">
                        <h2 className="text-xl font-black text-text mt-1">Petty Cash History</h2>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mt-1">Recent Withdrawals</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-glass/20 text-muted text-[10px] uppercase font-black tracking-widest border-b border-text/10">
                                    <th className="px-8 py-4">Date & Time</th>
                                    <th className="px-8 py-4">Staff Member</th>
                                    <th className="px-8 py-4">Reason</th>
                                    <th className="px-8 py-4 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cashLogs.map(log => (
                                    <tr key={log.cashLogId || log.id} className="border-b border-text/10 hover:bg-glass/20 transition-all group">
                                        <td className="px-8 py-6 font-mono text-xs text-muted">
                                            <div className="font-bold text-text">{new Date(log.createdAt).toLocaleDateString()}</div>
                                            <div className="opacity-60">{new Date(log.createdAt).toLocaleTimeString()}</div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="text-text font-bold">{log.staffName}</span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="text-muted text-sm italic">"{log.reason}"</span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <span className="text-orange-400 font-black text-lg">-£{parseFloat(log.amount).toFixed(2)}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Transaction Log */}
            <div className="glass-card rounded-[2.5rem] overflow-hidden">
                <div className="p-8 border-b border-text/10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <h2 className="text-xl font-black text-text mt-1">Settled Transactions</h2>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mt-1">
                            {filteredOrders.length} Records Found
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                            <input
                                className="bg-glass/20 border border-text/10 rounded-xl py-2 pl-9 pr-4 text-[10px] font-bold text-text focus:outline-none focus:ring-1 focus:ring-primary w-48"
                                placeholder="Search namesake or ID..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex bg-glass/20 p-1 rounded-xl border border-text/10 gap-1">
                            {['All', 'Cash', 'Card'].map(m => (
                                <button
                                    key={m}
                                    onClick={() => setMethodFilter(m)}
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${methodFilter === m ? 'bg-primary text-slate-950 shadow-lg' : 'text-muted hover:text-text'}`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={handleExportExcel}
                            className="flex items-center gap-2 px-4 py-2 bg-glass/20 hover:bg-primary/20 text-[10px] font-black uppercase text-muted hover:text-primary transition-all border border-text/10 rounded-xl"
                        >
                            <Download size={14} /> Export Excel
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-glass/20 text-muted text-[10px] uppercase font-black tracking-widest border-b border-text/10">
                                <th className="px-8 py-4">Transaction ID</th>
                                <th className="px-8 py-4">Method</th>
                                <th className="px-8 py-4">Srv. Chg</th>
                                <th className="px-8 py-4">Discount</th>
                                <th className="px-8 py-4">Total</th>
                                <th className="px-8 py-4">Notes</th>
                                <th className="px-8 py-4">Settled At</th>
                                <th className="px-8 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-8 py-20 text-center text-muted font-bold italic">No transactions match your filters.</td>
                                </tr>
                            ) : (
                                filteredOrders.map(order => (
                                    <tr key={order.id} className="border-b border-text/10 hover:bg-glass/20 transition-all group">
                                        <td className="px-8 py-6">
                                            <span className="text-text font-bold group-hover:text-primary transition-colors">{order.id}</span>
                                            <div className="text-[10px] text-muted mt-1 uppercase font-black tracking-tighter">{order.customerName || 'Walk-in'}</div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className={`flex items-center gap-2 w-fit px-3 py-1 rounded-lg border text-[10px] font-black uppercase ${order.paymentMethod === 'Cash' ? 'text-success border-success/20 bg-success/10' : 'text-primary border-primary/20 bg-primary/10'}`}>
                                                {order.paymentMethod === 'Cash' ? <Banknote size={12} /> : <CreditCard size={12} />}
                                                {order.paymentMethod}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="text-muted text-[10px] font-bold">£{parseFloat(order.serviceCharge || 0).toFixed(2)}</span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="text-red-400 text-[10px] font-bold">{order.discount > 0 ? `-£${parseFloat(order.discount).toFixed(2)}` : '£0.00'}</span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="text-text font-black text-lg">£{parseFloat(order.finalTotal !== undefined && order.finalTotal !== null ? order.finalTotal : order.amount).toFixed(2)}</span>
                                        </td>
                                        <td className="px-8 py-6 max-w-xs">
                                            {order.discountReason ? (
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black uppercase text-warning mb-1 flex items-center gap-1">
                                                        <FileText size={10} /> Discount Reason
                                                    </span>
                                                    <span className="text-[10px] text-text font-medium italic line-clamp-2">"{order.discountReason}"</span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-muted italic">No notes</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-6 font-mono text-xs text-muted">
                                            {order.paidAt ? (
                                                <>
                                                    <div className="font-bold">{new Date(order.paidAt).toLocaleDateString()}</div>
                                                    <div className="opacity-60">{new Date(order.paidAt).toLocaleTimeString()}</div>
                                                </>
                                            ) : 'Unknown'}
                                        </td>
                                        <td className="px-8 py-6 text-right space-x-2">
                                            <button
                                                onClick={() => generateReceipt(order, branding)}
                                                className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-all border border-primary/20"
                                                title="Reprint Receipt"
                                            >
                                                <Printer size={14} />
                                            </button>
                                            {(isAdmin || ['Admin', 'Owner', 'Manager'].includes(user?.role)) && (
                                                <button
                                                    onClick={() => handleDeletePayment(order.id)}
                                                    className="p-2 text-muted hover:text-red-400 bg-glass/20 hover:bg-red-400/10 rounded-lg transition-all border border-text/10"
                                                    title="Delete Record"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PaymentsDashboard;
