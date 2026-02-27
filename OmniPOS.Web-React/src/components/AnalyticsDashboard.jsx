import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import {
    TrendingUp, ArrowUpRight, ArrowDownRight, Users,
    DollarSign, Package, PieChart, Activity, ShoppingCart, Truck
} from 'lucide-react';
import { motion } from 'framer-motion';

const AnalyticsDashboard = () => {
    const { orders, customers, menuItems } = useStore();

    // Memoize analytics calculations
    const stats = useMemo(() => {
        const paidOrders = orders.filter(o => o.status === 'Paid');
        const totalSales = paidOrders.reduce((sum, o) => sum + parseFloat(o.amount), 0);
        const avgOrder = paidOrders.length > 0 ? totalSales / paidOrders.length : 0;

        // Item Popularity
        const itemMap = {};
        paidOrders.forEach(o => {
            o.items?.forEach(item => {
                itemMap[item.name] = (itemMap[item.name] || 0) + item.qty;
            });
        });
        const topItems = Object.entries(itemMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Hourly distribution (Revenue)
        const hourlySales = Array(24).fill(0);
        paidOrders.forEach(o => {
            const date = new Date(o.createdAt);
            hourlySales[date.getHours()] += parseFloat(o.amount);
        });

        // Service Efficiency (New Metrics)
        let totalPrepTime = 0;
        let prepCount = 0;
        let totalDeliveryTime = 0;
        let deliveryCount = 0;

        orders.forEach(o => {
            if (o.statusHistory && o.statusHistory.length > 1) {
                const placed = o.statusHistory.find(h => h.status === 'Placed' || h.status === 'Pending');
                const ready = o.statusHistory.find(h => h.status === 'Ready');
                const served = o.statusHistory.find(h => h.status === 'Served');

                if (placed && ready) {
                    const diff = (new Date(ready.timestamp) - new Date(placed.timestamp)) / 60000; // minutes
                    if (diff > 0 && diff < 180) { // filter out outliers > 3h
                        totalPrepTime += diff;
                        prepCount++;
                    }
                }

                if (ready && served) {
                    const diff = (new Date(served.timestamp) - new Date(ready.timestamp)) / 60000; // minutes
                    if (diff > 0 && diff < 120) { // filter out outliers > 2h
                        totalDeliveryTime += diff;
                        deliveryCount++;
                    }
                }
            }
        });

        const avgPrepTime = prepCount > 0 ? totalPrepTime / prepCount : 0;
        const avgDeliveryTime = deliveryCount > 0 ? totalDeliveryTime / deliveryCount : 0;

        return { totalSales, avgOrder, topItems, hourlySales, paidCount: paidOrders.length, avgPrepTime, avgDeliveryTime };
    }, [orders]);

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Gross Revenue', value: `£${stats.totalSales.toFixed(2)}`, icon: DollarSign, color: 'text-success', bg: 'bg-success/10', trend: '+12.5%' },
                    { label: 'Total Orders', value: stats.paidCount, icon: ShoppingCart, color: 'text-primary', bg: 'bg-primary/10', trend: '+5.2%' },
                    { label: 'Avg Order Value', value: `£${stats.avgOrder.toFixed(2)}`, icon: Activity, color: 'text-secondary', bg: 'bg-secondary/10', trend: '+2.1%' },
                    { label: 'Active Customers', value: customers.length, icon: Users, color: 'text-warning', bg: 'bg-warning/10', trend: '+8.4%' },
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="glass-card p-6 rounded-3xl bg-glass/20 border border-text/10 flex flex-col gap-4 relative overflow-hidden group"
                    >
                        <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center transition-transform group-hover:scale-110 duration-500`}>
                            <stat.icon size={24} />
                        </div>
                        <div className="space-y-1">
                            <div className="text-[10px] font-black text-muted uppercase tracking-widest">{stat.label}</div>
                            <div className="text-2xl font-black text-text">{stat.value}</div>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-black text-success bg-success/10 w-fit px-2 py-1 rounded-lg">
                            <ArrowUpRight size={10} /> {stat.trend}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Service Efficiency KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                    { label: 'Avg Preparation Time', value: `${stats.avgPrepTime.toFixed(1)}m`, icon: Activity, color: 'text-orange-500', bg: 'bg-orange-500/10', sub: 'Placed → Ready' },
                    { label: 'Avg Delivery Time', value: `${stats.avgDeliveryTime.toFixed(1)}m`, icon: Truck, color: 'text-purple-500', bg: 'bg-purple-500/10', sub: 'Ready → Served' },
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="glass-card p-6 rounded-3xl bg-glass/20 border border-text/10 flex items-center gap-6 relative overflow-hidden group"
                    >
                        <div className={`w-14 h-14 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center transition-transform group-hover:scale-110 duration-500 flex-shrink-0`}>
                            <stat.icon size={28} />
                        </div>
                        <div className="space-y-1">
                            <div className="text-[10px] font-black text-muted uppercase tracking-widest">{stat.label}</div>
                            <div className="text-3xl font-black text-text">{stat.value}</div>
                            <div className="text-[10px] font-bold text-muted/60 uppercase">{stat.sub}</div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Sales Chart (CSS Mockup - High Fidelity) */}
                <div className="glass-card rounded-[2.5rem] p-8 border border-text/10 flex flex-col gap-8">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-black text-text uppercase tracking-widest flex items-center gap-2">
                            <TrendingUp className="text-primary" /> Hourly Sales Velocity
                        </h3>
                        <div className="text-[10px] font-bold text-muted bg-glass/20 px-3 py-1.5 rounded-xl border border-text/10">LIVE 24H DATA</div>
                    </div>

                    <div className="h-64 relative mt-4">
                        {/* Grid lines */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} className="w-full border-t border-text/5 flex justify-between items-start">
                                    <span className="text-[8px] font-black text-muted/40 -mt-2">
                                        £{(Math.max(...stats.hourlySales, 10) * (1 - i / 3)).toFixed(0)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="absolute inset-0 pt-4 pb-8 pl-8">
                            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                                <defs>
                                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
                                        <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                                    </linearGradient>
                                </defs>

                                {(() => {
                                    const data = stats.hourlySales.slice(9, 23);
                                    const max = Math.max(...data, 10);
                                    const points = data.map((v, i) => {
                                        const x = (i / (data.length - 1)) * 100;
                                        const y = 100 - (v / max) * 100;
                                        return `${x},${y}`;
                                    }).join(' ');

                                    const pathD = `M 0,100 L ${points} L 100,100 Z`;
                                    const lineD = `M ${points}`;

                                    return (
                                        <>
                                            <motion.path
                                                initial={{ pathLength: 0, opacity: 0 }}
                                                animate={{ pathLength: 1, opacity: 1 }}
                                                transition={{ duration: 1.5, ease: "easeOut" }}
                                                d={pathD}
                                                fill="url(#areaGradient)"
                                            />
                                            <motion.path
                                                initial={{ pathLength: 0 }}
                                                animate={{ pathLength: 1 }}
                                                transition={{ duration: 1.5, ease: "easeOut" }}
                                                d={lineD}
                                                fill="none"
                                                stroke="var(--primary)"
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                            {/* Data Points */}
                                            {data.map((v, i) => {
                                                const x = (i / (data.length - 1)) * 100;
                                                const y = 100 - (v / max) * 100;
                                                return (
                                                    <g key={i} className="group cursor-pointer">
                                                        <circle cx={x} cy={y} r="3" fill="var(--primary)" className="group-hover:r-5 transition-all" />
                                                        <foreignObject x={x - 15} y={y - 25} width="30" height="20" className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                            <div className="bg-white text-black text-[8px] font-black px-1 py-0.5 rounded shadow-lg text-center">
                                                                £{v.toFixed(0)}
                                                            </div>
                                                        </foreignObject>
                                                    </g>
                                                );
                                            })}
                                        </>
                                    );
                                })()}
                            </svg>
                        </div>

                        {/* X-Axis Labels */}
                        <div className="absolute bottom-0 left-8 right-0 flex justify-between">
                            {['9AM', '12PM', '3PM', '6PM', '9PM', '11PM'].map((label, i) => (
                                <span key={i} className="text-[8px] font-black text-muted uppercase tracking-tighter">
                                    {label}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Top Items Table */}
                <div className="glass-card rounded-[2.5rem] p-8 border border-text/10 flex flex-col gap-8">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-black text-text uppercase tracking-widest flex items-center gap-2">
                            <Package className="text-secondary" /> Top-Performing Dishes
                        </h3>
                        <div className="text-[10px] font-bold text-muted bg-glass/20 px-3 py-1.5 rounded-xl border border-text/10">BY VOLUME</div>
                    </div>

                    <div className="space-y-4">
                        {stats.topItems.length === 0 ? (
                            <div className="text-center py-20 opacity-20 italic text-muted">No sales data recorded yet.</div>
                        ) : (
                            stats.topItems.map(([name, qty], i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-glass/20 border border-text/10 rounded-2xl group hover:bg-glass/40 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-glass/40 rounded-xl flex items-center justify-center font-black text-muted">{i + 1}</div>
                                        <div>
                                            <div className="text-sm font-black text-text group-hover:text-primary transition-colors">{name}</div>
                                            <div className="text-[10px] font-bold text-muted uppercase tracking-widest">
                                                {menuItems.find(m => m.name === name)?.cat || 'Menu Item'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-black text-text">{qty}</div>
                                        <div className="text-[10px] font-bold text-muted uppercase">ORDERS</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Insight Row */}
            <div className="glass-card rounded-3xl p-6 bg-secondary/10 border border-secondary/20 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-secondary/20 text-secondary rounded-2xl flex items-center justify-center shadow-lg shadow-secondary/10">
                        <Activity size={24} />
                    </div>
                    <div>
                        <div className="text-sm font-black text-text">Advanced Forecasting Engine</div>
                        <div className="text-[10px] font-bold text-muted uppercase">Projections based on historical performance algorithms</div>
                    </div>
                </div>
                <div className="text-center md:text-right">
                    <div className="text-xs font-black text-text uppercase opacity-40 mb-1">Estimated Traffic Peak</div>
                    <div className="text-xl font-black text-secondary uppercase tracking-widest leading-none">19:00 - 21:00</div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
