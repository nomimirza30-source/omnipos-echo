import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, Calendar, Phone, Mail, AlertCircle } from 'lucide-react';
import { useStore } from '../store/useStore';

/**
 * Customers Page
 * Displays customer directory with basic loyalty tracking
 */
const Customers = () => {
    const { token, currentTenantId } = useStore();
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/customer', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-ID': currentTenantId,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`${response.status}: ${errorText}`);
            }

            const data = await response.json();
            setCustomers(data);
        } catch (err) {
            console.error('[Customers] Error fetching customers:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400 mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading customers...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 max-w-2xl mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertCircle className="w-6 h-6 text-red-400" />
                        <h2 className="text-xl font-bold text-red-400">Error Loading Customers</h2>
                    </div>
                    <p className="text-red-300 mb-4">Failed to fetch customers from the API:</p>
                    <pre className="bg-black/30 p-4 rounded text-sm text-red-200 overflow-auto">
                        {error}
                    </pre>
                    <button
                        onClick={fetchCustomers}
                        className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Users className="w-8 h-8 text-sky-400" />
                    <div>
                        <h1 className="text-2xl font-bold text-slate-100">Customers</h1>
                        <p className="text-slate-400">
                            {customers.length} customer{customers.length !== 1 ? 's' : ''} total
                        </p>
                    </div>
                </div>
                <button
                    onClick={fetchCustomers}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            </div>

            {/* Customer List */}
            {customers.length === 0 ? (
                <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
                    <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-300 mb-2">No Customers Yet</h3>
                    <p className="text-slate-400">Customer records will appear here after orders are placed</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {customers.map((customer) => (
                        <div
                            key={customer.customerId}
                            className="bg-slate-800/70 backdrop-blur-sm border border-slate-700 rounded-lg p-5 hover:border-sky-500/50 transition"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-slate-100 mb-1">{customer.name}</h3>
                                </div>
                            </div>

                            <div className="space-y-2 mb-4">
                                {customer.email && (
                                    <div className="flex items-center gap-2 text-sm text-slate-300">
                                        <Mail className="w-4 h-4 text-slate-500" />
                                        <span className="truncate">{customer.email}</span>
                                    </div>
                                )}
                                {customer.phone && (
                                    <div className="flex items-center gap-2 text-sm text-slate-300">
                                        <Phone className="w-4 h-4 text-slate-500" />
                                        <span>{customer.phone}</span>
                                    </div>
                                )}
                            </div>

                            {/* Loyalty Stats */}
                            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700">
                                <div>
                                    <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                                        <TrendingUp className="w-3 h-3" />
                                        Total Spend
                                    </div>
                                    <div className="text-lg font-bold text-sky-400">
                                        £{customer.totalSpend?.toFixed(2) || '0.00'}
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                                        <Calendar className="w-3 h-3" />
                                        Total Orders
                                    </div>
                                    <div className="text-lg font-bold text-sky-400">
                                        {customer.totalOrders || 0}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Customers;
