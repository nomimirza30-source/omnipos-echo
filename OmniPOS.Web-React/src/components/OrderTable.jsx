import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { QrCode, Cloud, CloudOff, User, Users, MapPin, Eye, CheckCircle2, XCircle, Timer, Edit3, Plus, Minus, Trash2, Save, Send, PackageCheck, Banknote, CreditCard, ArrowLeft, Clock, Printer, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from './Modal';
import { generateReceipt } from '../utils/receiptGenerator';
import QRCode from 'qrcode';

const OrderTable = () => {
    const { orders, currentTenantId, tables, user, updateOrderStatus, updateOrder, deleteOrder, menuItems, completePayment, fetchOrders, syncOrders, branding, proposeAmendment, respondToAmendment, activeOrderId, updateOrderFinancials, verifyManagerPin, unreadOrders, markOrderRead } = useStore();
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [qrError, setQrError] = useState(null);

    React.useEffect(() => {
        if (activeOrderId) {
            const targetOrder = orders.find(o => o.id === activeOrderId);
            if (targetOrder) {
                setSelectedOrder(targetOrder);
                // Clear the active ID so it doesn't re-trigger
                useStore.setState({ activeOrderId: null });
            }
        }
    }, [activeOrderId, orders]);

    React.useEffect(() => {
        // Initial fetch when component mounts
        fetchOrders();
        syncOrders();
        // Global polling is now handled in App.jsx
    }, []);
    const [isAmendMode, setIsAmendMode] = useState(false);
    const [isPaymentMode, setIsPaymentMode] = useState(false);
    const [managerOverrideAction, setManagerOverrideAction] = useState({ type: 'payment' });
    const [paymentSubMethod, setPaymentSubMethod] = useState(null);
    const [cashReceived, setCashReceived] = useState('');
    const [wiseQRCode, setWiseQRCode] = useState(null);
    const qrCanvasRef = useRef(null);
    const [amendedItems, setAmendedItems] = useState([]);

    // Payment Adjustments State
    const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false);
    const [serviceChargePercent, setServiceChargePercent] = useState(10);
    const [discountEnabled, setDiscountEnabled] = useState(false);
    const [discountType, setDiscountType] = useState('percentage'); // 'percentage' or 'amount'
    const [discountValue, setDiscountValue] = useState(0);
    const [discountReason, setDiscountReason] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [showMenuSearch, setShowMenuSearch] = useState(false);
    const [spiceModalItem, setSpiceModalItem] = useState(null);

    // Safety Parachute State
    const [showManagerOverride, setShowManagerOverride] = useState(false);
    const [managerPin, setManagerPin] = useState('');
    const [pendingPaymentMethod, setPendingPaymentMethod] = useState(null);
    const [pinError, setPinError] = useState('');
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);

    const getBlinkStyles = (order) => {
        const status = order.status;
        if (status.includes('Ready')) return { border: 'border-orange-500', animate: 'animate-blink-orange', badge: 'bg-orange-600' };

        const hasPending = Array.isArray(order.pendingAmendments) && order.pendingAmendments.length > 0;
        if (hasPending || order.isAmended) {
            return { border: 'border-amber-500', animate: 'animate-blink-amber', badge: 'bg-amber-600' };
        }
        if (status.includes('Served')) return { border: 'border-purple-500', animate: 'animate-blink-purple', badge: 'bg-purple-600' };
        if (status.includes('Preparing') || status.includes('InProgress')) return { border: 'border-green-500', animate: 'animate-blink-green', badge: 'bg-green-600' };
        return { border: 'border-red-500', animate: 'animate-blink-red', badge: 'bg-red-600' };
    };

    const currentOrders = orders
        .filter(o => o.tenantId === currentTenantId && o.status !== 'Paid')
        .sort((a, b) => {
            const aUnread = unreadOrders?.includes(a.id) ? 1 : 0;
            const bUnread = unreadOrders?.includes(b.id) ? 1 : 0;
            if (aUnread !== bUnread) return bUnread - aUnread; // Unread first
            return new Date(b.createdAt) - new Date(a.createdAt); // Then newest
        });

    useEffect(() => {
        if (unreadOrders && unreadOrders.length > 0) {
            console.log('[OrderTable] Unread IDs:', unreadOrders);
        }
    }, [unreadOrders]);

    const orderInStore = orders.find(o => o.id === selectedOrder?.id);
    const displayOrder = isAmendMode ? { ...selectedOrder, items: amendedItems } : (orderInStore || selectedOrder);

    const handleQR = (id) => {
        alert(`Scan-to-Pay Link Generated for ${id}\n\nhttps://pay.omnipos.com/checkout?order=${id}&sig=HMAC_SHA256_SIGNED_PAYLOAD`);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Amended-Preparing':
            case 'Preparing': return 'bg-primary/10 text-primary border-primary/20';
            case 'Amended-Ready':
            case 'Ready': return 'bg-success/10 text-success border-success/20 shadow-[0_0_15px_rgba(52,211,153,0.1)]';
            case 'Amended-Served':
            case 'Served': return 'bg-success/5 text-success/60 border-success/10';
            case 'Paid': return 'bg-success text-text border-success';
            case 'Declined':
            case 'Cancelled': return 'text-red-400 bg-red-400/10 border-red-400/20';
            default: return 'text-muted bg-glass/20 border-text/10';
        }
    };



    // ... (keep state)

    const startAmend = (order) => {
        console.log('[OrderTable] Amending Order:', order);
        setSelectedOrder(order);
        // Add unique ID (_uid) to each item to distinguish same-product items in different versions
        const itemsWithUid = (order.items || []).map((item, idx) => ({
            ...item,
            _uid: `${item.id}_${item.amendmentVersion || 0}_${idx}`
        }));
        setAmendedItems(itemsWithUid);
        setIsAmendMode(true);
        setIsPaymentMode(false);
    };

    const startPayment = (order) => {
        console.log('[OrderTable] Starting Payment for:', order);
        if (order.amount <= 0) {
            useStore.getState().addNotification('ZERO BALANCE ORDER', 'warning');
        }
        setSelectedOrder(order);
        setIsPaymentMode(true);
        setIsAmendMode(false);
        setPaymentSubMethod(null);
        setCashReceived('');
        setServiceChargeEnabled(false);
        setDiscountEnabled(false);
        setDiscountValue(0);
        setDiscountReason('');
    };

    const updateAmendedQty = (uid, delta) => {
        setAmendedItems(prev => prev.map(item => {
            if (item._uid === uid) {
                const newQty = Math.max(1, item.qty + delta);
                // If this is a historical item (has amendmentVersion), we shouldn't modify it?
                // Requirement says "History", usually implies immutable.
                // But user might want to "Delete" (Cancel) it.
                // However, "Adding double" suggests they accept modifying, but it behaves weirdly.
                // We'll allow modifying for now, but strictly by UID.
                return { ...item, qty: newQty };
            }
            return item;
        }));
    };

    const removeItemFromAmended = (uid) => {
        setAmendedItems(prev => prev.filter(i => i._uid !== uid));
    };

    const addItemToAmended = (product, spiceLevel = null) => {
        // Handle spice selection first
        const itemCategories = typeof product.cat === 'string' ? product.cat.split(',').map(c => c.trim()) : (Array.isArray(product.cat) ? product.cat : []);
        if (!spiceLevel && ['BBQ', 'IYI Specials', 'Starters'].some(c => itemCategories.includes(c))) {
            setSpiceModalItem(product);
            return;
        }

        // Only look for NEW explicitly added items in this amendment session to increment
        const existingNewItem = amendedItems.find(i => i.id === product.id && i.isNew && i.spice === spiceLevel);

        if (existingNewItem) {
            setAmendedItems(prev => prev.map(i => i._uid === existingNewItem._uid ? { ...i, qty: i.qty + 1 } : i));
        } else {
            const newItem = {
                ...product,
                qty: 1,
                spice: spiceLevel,
                isNew: true, // Tag as new
                _uid: `${product.id}_new_${Date.now()}` // Unique ID for this new instance
            };
            setAmendedItems(prev => [...prev, newItem]);
        }

        setSpiceModalItem(null);
        setSearchTerm('');
        setShowMenuSearch(false);
    };

    // Payment Calculations (must be before useEffect that uses finalTotal)
    const subtotal = selectedOrder ? parseFloat(selectedOrder.amount || 0) : 0;
    const serviceChargeAmount = serviceChargeEnabled ? subtotal * (serviceChargePercent / 100) : 0;

    const maxDiscountPercent = 100; // Allow input, but intercept on save if > 20%
    let discountAmount = 0;
    if (discountEnabled) {
        if (discountType === 'percentage') {
            const limitedPercent = Math.min(discountValue, maxDiscountPercent);
            discountAmount = subtotal * (limitedPercent / 100);
        } else {
            discountAmount = Math.min(parseFloat(discountValue) || 0, subtotal);
        }
    }

    // Safety Parachute: Check if discount > 20%
    const isHighDiscount = subtotal > 0 && (discountAmount / subtotal) > 0.20;
    const needsManagerOverride = isHighDiscount && !(['Admin', 'Owner', 'Manager'].includes(user?.role));

    const finalTotal = Math.max(0, subtotal + serviceChargeAmount - discountAmount);
    const changeDue = (cashReceived && selectedOrder) ? (parseFloat(cashReceived) - finalTotal) : 0;

    const [isSyncingFinancials, setIsSyncingFinancials] = useState(false);

    // Auto-Sync Financials to Server (Debounced)
    useEffect(() => {
        if (!isPaymentMode || !selectedOrder) return;

        const timer = setTimeout(async () => {
            setIsSyncingFinancials(true);
            await updateOrderFinancials(selectedOrder.id, {
                serviceCharge: serviceChargeAmount,
                discount: discountAmount,
                discountType: discountEnabled ? discountType : 'none',
                discountReason: discountEnabled ? discountReason : '',
                finalTotal: finalTotal
            });
            setIsSyncingFinancials(false);
        }, 800);

        return () => clearTimeout(timer);
    }, [isPaymentMode, selectedOrder?.id, serviceChargeAmount, discountAmount, discountType, discountReason, finalTotal]);

    // Generate QR Code when Bank or Card payment is selected
    useEffect(() => {
        if ((paymentSubMethod === 'Bank' || paymentSubMethod === 'Card') && selectedOrder && qrCanvasRef.current) {
            setQrError(null);

            let baseUrl = branding?.cardPaymentUrl || window.location.origin;

            // FIX: If running on localhost, swap with actual LAN IP so phone can connect
            // For this specific debugging session, hardcoding the LAN IP
            // baseUrl = 'http://192.168.1.100:5173'; // Commented out as per instruction, this was a temporary debug line

            const qrUrl = `${baseUrl}/pay/${selectedOrder.id}`;

            console.log('[OrderTable] Generating Web QR:', qrUrl);

            QRCode.toCanvas(
                qrCanvasRef.current,
                qrUrl,
                {
                    width: 280,
                    margin: 2,
                    color: {
                        dark: '#334155',
                        light: '#ffffff'
                    },
                    errorCorrectionLevel: 'M'
                },
                (error) => {
                    if (error) {
                        console.error('QR Gen Error:', error);
                        setQrError('Failed to generate QR code');
                    }
                }
            );
        }
    }, [paymentSubMethod, selectedOrder, branding]);


    const handleProcessPayment = async (method) => {
        if (finalTotal <= 0) {
            useStore.getState().addNotification('Zero Price Checkout Prevented', 'warning');
            return;
        }

        if (isProcessingPayment) return;

        if (needsManagerOverride && !showManagerOverride) {
            setPendingPaymentMethod(method);
            setShowManagerOverride(true);
            setManagerPin('');
            setPinError('');
            return;
        }

        setIsProcessingPayment(true);
        try {
            const adjustments = {
                serviceCharge: serviceChargeAmount,
                discount: discountAmount,
                discountType: discountEnabled ? discountType : 'none',
                discountReason: discountEnabled ? discountReason : '',
                finalTotal: finalTotal
            };
            await completePayment(selectedOrder.id, method, adjustments);
            setSelectedOrder(null);
            setIsPaymentMode(false);
            setShowManagerOverride(false);
            setPendingPaymentMethod(null);
        } finally {
            setIsProcessingPayment(false);
        }
    };

    const handleManagerOverrideSubmit = async () => {
        const result = await verifyManagerPin(managerPin);
        if (result.success) {
            if (managerOverrideAction?.type === 'delete') {
                deleteOrder(managerOverrideAction.orderId);
                setShowManagerOverride(false);
                setSelectedOrder(null);
                setIsPaymentMode(false);
                setManagerOverrideAction({ type: 'payment' });
            } else {
                setIsProcessingPayment(true);
                try {
                    const adjustments = {
                        serviceCharge: serviceChargeAmount,
                        discount: discountAmount,
                        discountType: discountEnabled ? discountType : 'none',
                        discountReason: discountEnabled ? discountReason : '',
                        finalTotal: finalTotal
                    };
                    completePayment(selectedOrder.id, pendingPaymentMethod, adjustments);
                    setPaymentSubMethod(null);
                    setCashReceived('');
                    setIsPaymentMode(false);
                    setShowManagerOverride(false);
                    setSelectedOrder(null); // Close modal on success
                } finally {
                    setIsProcessingPayment(false);
                }
            }
        } else {
            setPinError(result.message || 'Invalid PIN');
        }
    };



    const saveAmendment = () => {
        const amendments = [];

        // 1. Handle NEW items
        amendedItems.filter(i => i.isNew).forEach(newItem => {
            amendments.push({ type: 'add', item: newItem });
        });

        // 2. Handle Modified Existing Items (Quantity Changes)
        // If we allow modifying history, we check for delta.
        // But for "Add double" bug, we prefer strict separation.
        // If user incremented a historical item, we should probably treat the delta as a NEW item?
        // Current logic in updateAmendedQty changes the qty of the item in place.
        // If we send this item as 'add', usage of ID might cause merge.

        amendedItems.filter(i => !i.isNew).forEach(amended => {
            const original = selectedOrder.items.find(i =>
                i.id === amended.id && (i.amendmentVersion || 0) === (amended.amendmentVersion || 0)
            );

            if (original && original.qty !== amended.qty) {
                if (amended.qty > original.qty) {
                    // They increased a historical item! We must split the difference into a NEW item
                    const delta = amended.qty - original.qty;
                    const newItem = {
                        ...amended,
                        qty: delta,
                        isNew: true,
                        amendmentVersion: undefined,
                        _uid: `${amended.id}_delta_${Date.now()}`
                    };
                    amendments.push({ type: 'add', item: newItem });
                } else {
                    // Quantity decreased (cancellation). We keep it as an update to the historical item.
                    amendments.push({ type: 'add', item: amended });
                }
            }
        });

        // 3. Handle Deleted Items
        selectedOrder.items.forEach(original => {
            // Reconstruct _uid to check existence?
            // Or check if any item in amendedItems matches ID+Version
            const stillExists = amendedItems.some(i =>
                i.id === original.id && (i.amendmentVersion || 0) === (original.amendmentVersion || 0)
            );

            if (!stillExists) {
                amendments.push({ type: 'delete', itemId: original.id });
            }
        });

        if (amendments.length > 0) {
            proposeAmendment(selectedOrder.id, amendments);
        }

        setIsAmendMode(false);
        setSelectedOrder(null);
    };

    return (
        <div className="glass-card rounded-3xl overflow-hidden" style={{ background: 'rgb(8 14 30 / 0.85)' }}>
            {/* ── Header ── */}
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-black text-white">
                        {['Kitchen', 'Chef', 'Assistant Chef'].includes(user.role) ? 'Kitchen Display (KDS)' : 'Live Orders View'}
                    </h2>
                    <p className="text-[10px] text-[rgb(100_120_150)] font-bold uppercase tracking-widest mt-0.5">
                        Real-time order tracking
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border tracking-widest badge-pending">
                        {currentOrders.filter(o => ['Pending', 'Placed'].includes(o.status)).length} Pending
                    </div>
                    <div className="text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border tracking-widest badge-inprogress">
                        {currentOrders.filter(o => o.status.includes('Preparing')).length} In Progress
                    </div>
                    <div className="text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border tracking-widest badge-ready">
                        {currentOrders.filter(o => o.status.includes('Ready')).length} Ready
                    </div>
                </div>
            </div>

            {/* ── Card Grid ── */}
            <div className="p-5">
                <AnimatePresence mode="popLayout">
                    {currentOrders.length === 0 ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-24 text-center">
                            <div className="text-[rgb(80_100_130)] font-bold mb-2 italic text-lg">All orders settled!</div>
                            <div className="text-[10px] text-[rgb(60_80_110)] uppercase tracking-widest">Awaiting new transactions</div>
                        </motion.div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {currentOrders.map((order) => {
                                const tableLabel = order.tableId?.split(',').filter(Boolean).map(tid => tables.find(t => t.id === tid)?.num).filter(Boolean).join(', ') || 'Walk-in';
                                const elapsedMs = order.createdAt ? Date.now() - new Date(order.createdAt).getTime() : 0;
                                const elapsedMins = Math.floor(elapsedMs / 60000);
                                const elapsedSecs = Math.floor((elapsedMs % 60000) / 1000);
                                const elapsedStr = `${String(elapsedMins).padStart(2, '0')}:${String(elapsedSecs).padStart(2, '0')} elapsed`;
                                const isReady = order.status.includes('Ready');
                                const isPreparing = order.status.includes('Preparing');
                                const isPending = order.status === 'Pending' || order.status === 'Placed';
                                const isServed = order.status.includes('Served');
                                const isCancelled = ['Cancelled', 'Declined'].includes(order.status);
                                const badgeCls = isReady ? 'badge-ready' : isPreparing ? 'badge-inprogress' : isPending ? 'badge-pending' : isServed ? 'badge-served' : isCancelled ? 'badge-cancelled' : 'bg-white/5 text-white/40 border border-white/10';
                                const statusLabel = isReady ? 'Ready ✓' : isPreparing ? 'In Progress 🔥' : isPending ? 'Pending ⏱' : order.status;
                                const hasUrgentAmend = Array.isArray(order.pendingAmendments) && order.pendingAmendments.length > 0;

                                return (
                                    <motion.div
                                        key={order.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.88 }}
                                        transition={{ duration: 0.2 }}
                                        className={`rounded-2xl p-4 flex flex-col gap-3 border-2 transition-all duration-300 ${unreadOrders?.includes(order.id) ? `${getBlinkStyles(order).border} ${getBlinkStyles(order).animate}` :
                                            isReady ? 'border-[rgb(52_211_153_/_0.35)] card-ready' :
                                                hasUrgentAmend ? 'animate-urgent-blink' :
                                                    'border-white/6'
                                            }`}
                                        style={{ background: 'rgb(14 26 52 / 0.75)' }}
                                    >
                                        {/* Card header */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {unreadOrders?.includes(order.id) && (
                                                        <span className={`text-[10px] ${getBlinkStyles(order).badge} text-white font-black px-2 py-0.5 rounded-full animate-bounce shadow-lg`}>URGENT!</span>
                                                    )}
                                                    <span className="text-white font-black text-sm truncate">
                                                        {tableLabel !== 'Walk-in' ? `Table ${tableLabel}` : (order.customerName || 'Walk-in')}
                                                    </span>
                                                    {order.syncStatus === 'Offline' && <CloudOff size={11} className="text-warning animate-pulse flex-shrink-0" />}
                                                    {order.isAmended && (
                                                        <span className="text-[8px] bg-warning/20 text-warning px-1.5 py-0.5 rounded border border-warning/30 font-black uppercase flex-shrink-0">Amended</span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-[rgb(100_120_150)] mt-0.5 animate-timer-blink">{elapsedStr}</div>
                                            </div>
                                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full flex-shrink-0 ${badgeCls}`}>{statusLabel}</span>
                                        </div>

                                        {/* Items */}
                                        <div className="flex-1 space-y-0.5 min-h-[52px]">
                                            {(order.items || []).slice(0, 4).map((item, idx) => (
                                                <div key={idx} className="text-[11px] text-[rgb(150_170_200)] leading-snug">{item.qty}x {item.name}</div>
                                            ))}
                                            {(order.items || []).length > 4 && (
                                                <div className="text-[10px] text-[rgb(90_110_140)] italic">+{(order.items || []).length - 4} more…</div>
                                            )}
                                            {(!order.items || order.items.length === 0) && (
                                                <div className="text-[10px] text-[rgb(70_90_120)] italic">No items</div>
                                            )}
                                        </div>

                                        {/* Footer */}
                                        <div className="border-t border-white/5 pt-3 flex items-center justify-between gap-2">
                                            <span className="font-black text-white text-sm">£{order.amount}</span>
                                            <div className="flex items-center gap-2 flex-wrap justify-end mt-1">
                                                <button onClick={() => { markOrderRead(order.id); setSelectedOrder(order); setIsAmendMode(false); setIsPaymentMode(false); }} className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[11px] font-black uppercase text-[rgb(150_170_200)] hover:text-white transition-all shadow-sm tracking-wider" title="View">View</button>

                                                {['Admin', 'Manager', 'Kitchen', 'Chef', 'Assistant Chef', 'Owner'].includes(user.role) && isPending && (
                                                    <>
                                                        <button onClick={() => updateOrderStatus(order.id, 'Declined')} className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all shadow-sm" title="Decline"><XCircle size={18} /></button>
                                                        <button onClick={() => updateOrderStatus(order.id, 'Preparing')} className="px-4 py-2.5 rounded-xl badge-inprogress text-[11px] font-black uppercase hover:opacity-80 transition-all shadow-sm">Accept</button>
                                                    </>
                                                )}
                                                {['Admin', 'Manager', 'Kitchen', 'Chef', 'Assistant Chef', 'Owner'].includes(user.role) && isPreparing && (
                                                    <button onClick={() => updateOrderStatus(order.id, 'Ready')} className="px-4 py-2.5 rounded-xl badge-ready text-[11px] font-black uppercase hover:opacity-80 transition-all flex items-center gap-1.5 shadow-sm"><CheckCircle2 size={16} /> Ready</button>
                                                )}
                                                {isReady && ['Admin', 'Manager', 'Waiter', 'Server', 'Wait Staff', 'Owner', 'Till'].includes(user.role) && (
                                                    <button onClick={() => updateOrderStatus(order.id, 'Served')} className="px-4 py-2.5 rounded-xl bg-[rgb(52_211_153)] text-[#020d1a] text-[11px] font-black uppercase hover:opacity-90 transition-all shadow-sm">Mark Served</button>
                                                )}
                                                {(isPending || isPreparing || isServed) && (
                                                    <button onClick={() => { markOrderRead(order.id); startAmend(order); }} className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-[rgb(0_210_180_/_0.12)] text-[11px] font-black uppercase tracking-wider text-[rgb(150_170_200)] hover:text-[rgb(0,210,180)] transition-all shadow-sm" title="Amend">Amend</button>
                                                )}
                                                {isCancelled && (
                                                    <button onClick={() => { if (user.role === 'Waiter') { setManagerOverrideAction({ type: 'delete', orderId: order.id }); setShowManagerOverride(true); setManagerPin(''); setPinError(''); setSelectedOrder(order); setIsPaymentMode(true); } else if (['Admin', 'Owner', 'Manager'].includes(user.role)) { if (window.confirm('Permanently remove?')) deleteOrder(order.id); } }} className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/15 transition-all shadow-sm" title="Delete"><Trash2 size={18} /></button>
                                                )}
                                                {isServed && ['Admin', 'Till', 'Manager'].includes(user.role) && (
                                                    <button onClick={() => { markOrderRead(order.id); startPayment(order); }} className="px-4 py-2.5 rounded-xl bg-[rgb(100_160_255_/_0.18)] border border-[rgb(100_160_255_/_0.3)] text-[rgb(100,160,255)] text-[11px] font-black uppercase animate-pulse flex items-center gap-1.5 shadow-sm"><Banknote size={16} /> Pay</button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </AnimatePresence>
            </div>
            {/* ── Footer Stats ── */}
            <div className="px-6 py-2.5 border-t border-white/5 bg-black/20 flex items-center gap-6 text-[10px] font-bold text-[rgb(70_90_120)] uppercase tracking-widest flex-wrap">
                <span>Total Active: <span className="text-white">{currentOrders.length}</span></span>
                <span>Pending: <span className="text-[rgb(251_191_36)]">{currentOrders.filter(o => ['Pending', 'Placed'].includes(o.status)).length}</span></span>
                <span>In Progress: <span className="text-[rgb(0,210,180)]">{currentOrders.filter(o => o.status.includes('Preparing')).length}</span></span>
                <span>Ready: <span className="text-[rgb(52,211,153)]">{currentOrders.filter(o => o.status.includes('Ready')).length}</span></span>
            </div>

            {/* View/Amend/Payment Modal */}
            <Modal
                isOpen={!!selectedOrder}
                onClose={() => {
                    setSelectedOrder(null);
                    setIsAmendMode(false);
                    setIsPaymentMode(false);
                    setPaymentSubMethod(null);
                    setCashReceived('');
                    setShowManagerOverride(false);
                }}
                title={isAmendMode ? "Amend Digital Order" : isPaymentMode ? "SETTLE TRANSACTION (DEBUG MODE)" : "Digital Order Details"}
            >
                {displayOrder && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-start border-b border-text/10 pb-4">
                            <div>
                                <h3 className="font-black text-xl text-text">{displayOrder.customerName || 'Walk-in'}</h3>
                                <p className="text-xs text-muted">{displayOrder.customerEmail || 'No email'}</p>
                            </div>
                            <div className="text-right">
                                <span className="block text-primary font-black text-sm uppercase">
                                    {displayOrder.tableId?.split(',').filter(Boolean).map(tid => tables.find(t => t.id === tid)?.num).join(', ') || 'Walk-in'}
                                </span>
                                <span className="block text-[9px] text-muted font-black mt-0.5">{displayOrder.guestCount || 1} Guests</span>
                                <span className="block text-[8px] text-muted/60 font-mono mt-0.5">{displayOrder.createdAt ? new Date(displayOrder.createdAt).toLocaleTimeString() : 'Recent'}</span>
                                <button
                                    onClick={() => generateReceipt(displayOrder, branding, tables)}
                                    className="mt-2 flex items-center gap-1.5 px-2 py-1 bg-glass/20 hover:bg-primary/20 text-[9px] font-black uppercase text-muted hover:text-primary rounded-lg transition-all border border-text/10"
                                >
                                    <PackageCheck size={12} /> Print Receipt
                                </button>
                            </div>
                        </div>

                        {displayOrder.notes && (
                            <div className="bg-warning/10 border border-warning/20 p-4 rounded-2xl">
                                <h4 className="text-[10px] font-black text-warning uppercase tracking-widest mb-1">Special Instructions</h4>
                                <p className="text-sm text-text italic">"{displayOrder.notes}"</p>
                            </div>
                        )}


                        {!isPaymentMode && (
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">
                                    {isAmendMode ? "Edit Items & Quantities" : "Items Ordered"}
                                </h4>

                                {isAmendMode && (
                                    <div className="relative mb-4">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Search menu to add new items..."
                                                className="flex-1 bg-glass/20 border border-text/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                value={searchTerm}
                                                onChange={(e) => {
                                                    setSearchTerm(e.target.value);
                                                    setShowMenuSearch(e.target.value.length > 0);
                                                }}
                                                onFocus={() => searchTerm.length > 0 && setShowMenuSearch(true)}
                                            />
                                            {searchTerm && (
                                                <button
                                                    onClick={() => { setSearchTerm(''); setShowMenuSearch(false); }}
                                                    className="px-3 bg-glass/20 hover:bg-glass/40 rounded-xl text-xs font-bold transition-all"
                                                >
                                                    Clear
                                                </button>
                                            )}
                                        </div>

                                        <AnimatePresence>
                                            {showMenuSearch && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -10 }}
                                                    className="absolute z-[100] left-0 right-0 mt-2 bg-slate-900/95 backdrop-blur-xl border border-text/10 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto"
                                                >
                                                    {menuItems.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                                                        <div className="p-4 text-center text-xs text-muted">No items found</div>
                                                    ) : (
                                                        menuItems
                                                            .filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                                            .map(item => (
                                                                <button
                                                                    key={item.id}
                                                                    onClick={() => addItemToAmended(item)}
                                                                    className="w-full flex items-center gap-3 p-3 hover:bg-primary/10 transition-all border-b border-text/5 text-left"
                                                                >
                                                                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-glass/20">
                                                                        <img src={item.image} className="w-full h-full object-cover" />
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <div className="text-sm font-bold text-text">{item.name}</div>
                                                                        <div className="text-[10px] text-primary font-black">£{item.price.toFixed(2)}</div>
                                                                    </div>
                                                                    <Plus size={16} className="text-primary" />
                                                                </button>
                                                            ))
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                <div className="bg-glass/20 rounded-2xl p-4 space-y-3">
                                    {isAmendMode ? (
                                        amendedItems.map((item, idx) => (
                                            <div key={item._uid || idx} className="flex justify-between items-center text-sm border-b border-text/10 last:border-0 pb-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-glass/40 overflow-hidden">
                                                        <img src={menuItems.find(m => m.id === item.id)?.image} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-text font-bold">{item.name}</span>
                                                            {item.isNew && (
                                                                <span className="text-[9px] font-black text-primary bg-primary/10 px-1 rounded uppercase">NEW</span>
                                                            )}
                                                            {item.spice && (
                                                                <span className={`text-[7px] font-black px-1 rounded uppercase border ${item.spice === 'Extra Spicy' ? 'bg-red-500/10 text-red-500 border-red-500/50' :
                                                                    item.spice === 'Spicy' ? 'bg-orange-500/10 text-orange-500 border-orange-500/50' :
                                                                        item.spice === 'Medium' ? 'bg-warning/10 text-warning border-warning/50' :
                                                                            'bg-success/10 text-success border-success/50'
                                                                    }`}>
                                                                    {item.spice}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-muted">Unit Price: £{item.price.toFixed(2)}</div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => updateAmendedQty(item._uid, -1)} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[rgb(150_170_200)] hover:text-white transition-all shadow-sm border border-white/5"><Minus size={18} /></button>
                                                        <span className="font-black text-white px-1 mb-0.5 min-w-[28px] text-center text-lg">{item.qty}</span>
                                                        <button onClick={() => updateAmendedQty(item._uid, 1)} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[rgb(150_170_200)] hover:text-white transition-all shadow-sm border border-white/5"><Plus size={18} /></button>
                                                        {(item.isNew || selectedOrder.status !== 'Served') && (
                                                            <button onClick={() => removeItemFromAmended(item._uid)} className="ml-3 p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all shadow-sm border border-red-500/10"><Trash2 size={18} /></button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        (() => {
                                            // 1. Group Active Items by Version
                                            const activeGroups = displayOrder.items.reduce((groups, item) => {
                                                const version = item.amendmentVersion || 0;
                                                if (!groups[version]) groups[version] = [];
                                                groups[version].push(item);
                                                return groups;
                                            }, {});

                                            // 2. Parse Status History
                                            let historyLog = [];
                                            try {
                                                if (displayOrder.statusHistory && displayOrder.statusHistory !== "[]") {
                                                    historyLog = JSON.parse(displayOrder.statusHistory);
                                                }
                                            } catch (e) {
                                                console.error("Failed to parse status history", e);
                                            }

                                            // 3. Map History by Version
                                            const historyMap = historyLog.reduce((acc, entry) => {
                                                // Backend serializes as PascalCase (AmendmentVersion, Status)
                                                acc[entry.AmendmentVersion] = entry;
                                                return acc;
                                            }, {});

                                            // 4. Get Unique Sorted Versions
                                            const allVersions = new Set([
                                                ...Object.keys(activeGroups).map(Number),
                                                ...Object.keys(historyMap).map(Number)
                                            ]);
                                            const sortedVersions = Array.from(allVersions).sort((a, b) => a - b);

                                            // 5. Render
                                            return sortedVersions.map(version => {
                                                const items = activeGroups[version] || [];
                                                const historyEntry = historyMap[version];
                                                const isDeclined = historyEntry?.Status === 'DECLINED';
                                                const isAccepted = historyEntry?.Status === 'ACCEPTED';

                                                // Calculate Timestamp
                                                let timeString = '';
                                                if (historyEntry?.Timestamp) {
                                                    timeString = new Date(historyEntry.Timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                } else if (items.length > 0) {
                                                    const timestamp = items.reduce((min, item) => {
                                                        const itemTime = item.created ? new Date(item.created) : null;
                                                        return (!min || (itemTime && itemTime < min)) ? itemTime : min;
                                                    }, null);
                                                    timeString = timestamp ? timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                                                }

                                                // RENDER DECLINED BLOCK
                                                if (isDeclined) {
                                                    return (
                                                        <div key={version} className="space-y-1 mb-3 last:mb-0 opacity-70">
                                                            <div className="flex justify-between items-center text-[9px] font-black uppercase text-red-400 tracking-widest pl-1 border-b border-white/5 pb-1 mb-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span>Amendment {version}</span>
                                                                    <span className="bg-red-500/10 border border-red-500/20 px-1.5 rounded text-[8px]">DECLINED</span>
                                                                </div>
                                                                <span>{timeString}</span>
                                                            </div>
                                                            {items.length === 0 && (
                                                                <div className="text-center py-2 text-xs text-red-400/50 italic">
                                                                    Amendment declined by kitchen.
                                                                </div>
                                                            )}
                                                            {/* Render items if any still exist (rare for declined) */}
                                                            {items.map((item, idx) => (
                                                                <div key={idx} className="flex justify-between items-center text-sm border-b border-text/10 last:border-0 pb-2 opacity-50 grayscale">
                                                                    <span className="text-text font-bold line-through">{item.name}</span>
                                                                    <span className="font-black text-red-500">Declined</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                }

                                                // RENDER ACCEPTED/NORMAL BLOCK
                                                return (
                                                    <div key={version} className="space-y-1 mb-3 last:mb-0">
                                                        <div className="flex justify-between items-center text-[9px] font-black uppercase text-muted/60 tracking-widest pl-1 border-b border-white/5 pb-1 mb-1">
                                                            <div className="flex items-center gap-2">
                                                                <span>{version === 0 ? "Original Order" : `Amendment ${version}`}</span>
                                                                {isAccepted && (
                                                                    <span className="bg-success/10 border border-success/20 text-success px-1.5 rounded text-[8px]">ACCEPTED</span>
                                                                )}
                                                            </div>
                                                            <span>{timeString}</span>
                                                        </div>
                                                        {items.map((item, idx) => (
                                                            <div key={idx} className="flex justify-between items-center text-sm border-b border-text/10 last:border-0 pb-2">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-lg bg-glass/40 overflow-hidden">
                                                                        <img src={menuItems.find(m => m.id === item.id)?.image} className="w-full h-full object-cover" />
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`text-text font-bold ${item.itemStatus === 'Cancelled' ? 'line-through text-red-500/70' : ''}`}>
                                                                                {item.name} {item.itemStatus === 'Cancelled' ? '(CANCELLED)' : ''}
                                                                            </span>
                                                                            {item.spice && (
                                                                                <span className={`text-[7px] font-black px-1 rounded uppercase border ${item.spice === 'Extra Spicy' ? 'bg-red-500/10 text-red-500 border-red-500/50' :
                                                                                    item.spice === 'Spicy' ? 'bg-orange-500/10 text-orange-500 border-orange-500/50' :
                                                                                        item.spice === 'Medium' ? 'bg-warning/10 text-warning border-warning/50' :
                                                                                            'bg-success/10 text-success border-success/50'
                                                                                    }`}>
                                                                                    {item.spice}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-[10px] text-muted">Unit Price: £{item.price.toFixed(2)}</div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-4">
                                                                    <div className="text-right">
                                                                        <span className="font-black text-primary">x{item.qty}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            });
                                        })()


                                    )}{isAmendMode && amendedItems.length === 0 && (
                                        <div className="text-center py-4 text-muted italic">No items in amended order.</div>
                                    )}
                                </div>
                            </div>
                        )}



                        {/* Pending Amendments Section (Approval UI) */}
                        {
                            displayOrder.pendingAmendments?.length > 0 && !isAmendMode && !isPaymentMode && (
                                <div className="space-y-3 animate-in fade-in zoom-in duration-300">
                                    <div className="flex items-center justify-between pl-1">
                                        <h4 className="text-[10px] font-black text-warning uppercase tracking-widest flex items-center gap-2">
                                            <Timer size={12} className="animate-pulse" /> Pending Approval
                                        </h4>
                                        <span className="text-[8px] bg-warning/20 text-warning px-2 py-0.5 rounded-full font-black uppercase">
                                            Proposed Changes
                                        </span>
                                    </div>

                                    <div className="bg-warning/5 border border-warning/20 rounded-2xl p-4 space-y-2">
                                        {displayOrder.pendingAmendments.map((amend, idx) => (
                                            <div key={idx} className={`flex justify-between items-center p-2 rounded-lg border ${amend.type === 'add' ? 'bg-success/10 border-success/30' : 'bg-red-500/10 border-red-500/30 line-through opacity-60'}`}>
                                                <div className="flex items-center gap-2">
                                                    {amend.type === 'add' ? <Plus size={12} className="text-success" /> : <Minus size={12} className="text-red-400" />}
                                                    <span className="text-xs font-bold text-text">
                                                        {amend.type === 'add' ? `${amend.item.name} (x${amend.item.qty})` :
                                                            displayOrder.items.find(i => i.id === amend.itemId)?.name || 'Removed Item'}
                                                    </span>
                                                </div>
                                                <span className="text-[9px] font-black opacity-60">
                                                    {amend.type === 'add' ? `+£${(amend.item.price * amend.item.qty).toFixed(2)}` : 'REMOVAL'}
                                                </span>
                                            </div>
                                        ))}

                                        {/* Action Buttons for Kitchen/Admin/Manager/Owner */}
                                        {(['Kitchen', 'Chef', 'Assistant Chef', 'Admin', 'Manager', 'Owner'].includes(user.role)) && (
                                            <div className="grid grid-cols-2 gap-3 pt-2">
                                                <button
                                                    onClick={() => respondToAmendment(displayOrder.id, false)}
                                                    className="py-2.5 bg-red-400/20 text-red-400 font-black text-[10px] uppercase rounded-xl border border-red-400/30 hover:bg-red-400/30 transition-all"
                                                >
                                                    Decline
                                                </button>
                                                <button
                                                    onClick={() => respondToAmendment(displayOrder.id, true)}
                                                    className="py-2.5 bg-success text-text font-black text-[10px] uppercase rounded-xl shadow-lg shadow-success/20 hover:scale-[1.02] transition-all"
                                                >
                                                    Approve
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        }

                        {
                            !isPaymentMode && (
                                <div className="flex justify-between items-center bg-primary/10 p-5 rounded-2xl border border-primary/20">
                                    <span className="font-black text-muted text-xs uppercase">
                                        {isAmendMode ? "Amended Total" : "Grand Total Due"}
                                    </span>
                                    <span className="text-2xl font-black text-primary">
                                        £{isAmendMode
                                            ? amendedItems.reduce((sum, i) => sum + (i.price * i.qty), 0).toFixed(2)
                                            : displayOrder.amount}
                                    </span>
                                </div>
                            )
                        }

                        {/* Main Settlement Action */}
                        {
                            (displayOrder.status === 'Served' || displayOrder.status === 'Amended-Served') && !isPaymentMode && (
                                <button
                                    onClick={() => startPayment(displayOrder)}
                                    className="w-full bg-primary text-slate-900 font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:shadow-2xl hover:shadow-primary/20 transition-all group overflow-hidden relative"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                    <CreditCard size={20} />
                                    <span>PROCEED TO PAYMENT</span>
                                </button>
                            )
                        }

                        {/* Payment Modal */}
                        {
                            isPaymentMode && showManagerOverride ? (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 p-8 text-center border-2 border-warning/50 rounded-2xl bg-warning/5">
                                    <div className="w-20 h-20 bg-warning/20 text-warning rounded-full flex items-center justify-center mx-auto mb-2">
                                        <AlertTriangle size={40} />
                                    </div>
                                    <h3 className="text-2xl font-black text-warning uppercase">Manager Override Required</h3>
                                    <p className="text-sm font-bold text-text">
                                        {managerOverrideAction?.type === 'delete' ? 'Authorization needed to delete order.' : 'Discount exceeds 20%. Please enter Manager PIN.'}
                                    </p>

                                    <input
                                        type="password"
                                        maxLength="4"
                                        value={managerPin}
                                        onChange={(e) => { setManagerPin(e.target.value); setPinError(''); }}
                                        className="border-2 border-warning/50 rounded-xl py-4 px-6 text-2xl font-black text-center tracking-widest bg-white text-slate-900 focus:outline-none focus:border-warning w-48 mx-auto block"
                                        placeholder="****"
                                        autoFocus
                                    />
                                    {pinError && <p className="text-red-500 font-bold text-sm">{pinError}</p>}

                                    <div className="grid grid-cols-2 gap-4 mt-6">
                                        <button onClick={() => setShowManagerOverride(false)} className="py-4 bg-glass/20 border border-text/10 text-text font-bold rounded-xl hover:bg-glass/40 transition-all">Cancel</button>
                                        <button onClick={handleManagerOverrideSubmit} className="py-4 bg-warning text-slate-900 font-black rounded-xl hover:shadow-lg shadow-warning/20 transition-all">Approve</button>
                                    </div>
                                </div>
                            ) : isPaymentMode && (
                                <div className="space-y-4">
                                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-5 space-y-4">
                                        <h3 className="text-lg font-black text-primary uppercase tracking-wide flex items-center gap-2">
                                            <Banknote size={20} />
                                            Payment Breakdown
                                        </h3>

                                        {/* Subtotal */}
                                        <div className="flex justify-between items-center pb-3 border-b border-primary/10">
                                            <span className="text-sm font-bold text-muted">Subtotal</span>
                                            <span className="text-lg font-black text-text">£{subtotal.toFixed(2)}</span>
                                        </div>

                                        {/* Service Charge */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    id="serviceCharge"
                                                    checked={serviceChargeEnabled}
                                                    onChange={(e) => setServiceChargeEnabled(e.target.checked)}
                                                    className="w-5 h-5 accent-primary cursor-pointer"
                                                />
                                                <label htmlFor="serviceCharge" className="text-sm font-bold text-text cursor-pointer flex-1">
                                                    Service Charge
                                                </label>
                                                {serviceChargeEnabled && (
                                                    <span className="text-sm font-black text-success">+£{serviceChargeAmount.toFixed(2)}</span>
                                                )}
                                            </div>
                                            {serviceChargeEnabled && (
                                                <div className="flex items-center gap-2 pl-8">
                                                    <input
                                                        type="number"
                                                        value={serviceChargePercent}
                                                        onChange={(e) => setServiceChargePercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                                                        className="w-20 px-3 py-2 bg-white border border-primary/20 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                        min="0"
                                                        max="100"
                                                        step="1"
                                                    />
                                                    <span className="text-sm font-bold text-muted">%</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Discount */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    id="discount"
                                                    checked={discountEnabled}
                                                    onChange={(e) => setDiscountEnabled(e.target.checked)}
                                                    className="w-5 h-5 accent-warning cursor-pointer"
                                                />
                                                <label htmlFor="discount" className="text-sm font-bold text-text cursor-pointer flex-1">
                                                    Discount
                                                </label>
                                                {discountEnabled && (
                                                    <span className="text-sm font-black text-warning">-£{discountAmount.toFixed(2)}</span>
                                                )}
                                            </div>
                                            {discountEnabled && (
                                                <div className="pl-8 space-y-3">
                                                    {/* Discount Type Selector */}
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => setDiscountType('percentage')}
                                                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all ${discountType === 'percentage'
                                                                ? 'bg-warning text-text shadow-lg'
                                                                : 'bg-warning/20 text-warning border border-warning/30'
                                                                }`}
                                                        >
                                                            Percentage
                                                        </button>
                                                        <button
                                                            onClick={() => setDiscountType('amount')}
                                                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all ${discountType === 'amount'
                                                                ? 'bg-warning text-text shadow-lg'
                                                                : 'bg-warning/20 text-warning border border-warning/30'
                                                                }`}
                                                        >
                                                            Amount
                                                        </button>
                                                    </div>

                                                    {/* Discount Input */}
                                                    <div className="flex items-center gap-2">
                                                        {discountType === 'amount' && <span className="text-sm font-bold text-muted">£</span>}
                                                        <input
                                                            type="number"
                                                            value={discountValue}
                                                            onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                                                            className="flex-1 px-3 py-2 bg-white border border-warning/20 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-warning/50"
                                                            min="0"
                                                            max={discountType === 'percentage' ? maxDiscountPercent : subtotal}
                                                            step={discountType === 'percentage' ? '1' : '0.01'}
                                                        />
                                                        {discountType === 'percentage' && <span className="text-sm font-bold text-muted">%</span>}
                                                    </div>

                                                    {/* Role-based Limit Warning */}
                                                    {/* Role-based Limit Warning - Hide for Admin/Owner/Manager/Till */}
                                                    {/* Discount Reason Input */}
                                                    <div className="mt-4">
                                                        <label className="text-[10px] font-black uppercase text-muted mb-2 block">Reason for Discount</label>
                                                        <textarea
                                                            className="w-full bg-white border border-warning/20 rounded-xl py-2 px-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-warning/50"
                                                            placeholder="Enter reason for applying discount..."
                                                            value={discountReason}
                                                            onChange={(e) => setDiscountReason(e.target.value)}
                                                            rows={2}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Final Total */}
                                        <div className="flex justify-between items-center pt-3 border-t-2 border-primary/30">
                                            <div className="flex flex-col">
                                                <span className="text-base font-black text-primary uppercase">Final Total</span>
                                                {isSyncingFinancials && (
                                                    <span className="text-[10px] text-muted animate-pulse font-bold tracking-widest uppercase">
                                                        Syncing...
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-3xl font-black text-primary">£{finalTotal.toFixed(2)}</span>
                                        </div>

                                        {/* Print Bill Button */}
                                        <div className="mt-4">
                                            <button
                                                onClick={() => {
                                                    // Create a temporary order object with current payment details
                                                    const billPreview = {
                                                        ...displayOrder,
                                                        serviceCharge: serviceChargeAmount,
                                                        discount: discountAmount,
                                                        discountType: discountType,
                                                        discountReason: discountReason,
                                                        finalTotal: finalTotal,
                                                        amount: subtotal,
                                                        status: 'Pending Payment'
                                                    };
                                                    generateReceipt(billPreview, branding, tables);
                                                }}
                                                className="w-full bg-secondary/20 hover:bg-secondary/30 text-secondary border border-secondary/30 font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                                                title="Print bill for customer review before payment"
                                            >
                                                <Printer size={20} />
                                                <span>PRINT BILL</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Payment Method Selection or Cash Calculator */}
                                    {!paymentSubMethod ? (
                                        <div className="grid grid-cols-3 gap-3">
                                            <button
                                                onClick={() => {
                                                    if (finalTotal <= 0) {
                                                        useStore.getState().addNotification('ZERO PRICE CHECKOUT BLOCKED', 'warning');
                                                        return;
                                                    }
                                                    setPaymentSubMethod('Cash');
                                                }}
                                                disabled={finalTotal <= 0}
                                                className="bg-success text-text font-black py-4 rounded-xl flex flex-col items-center justify-center gap-2 shadow-lg shadow-success/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                                            >
                                                <Banknote size={24} />
                                                <span>CASH</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (finalTotal <= 0) {
                                                        useStore.getState().addNotification('ZERO PRICE CHECKOUT BLOCKED', 'warning');
                                                        return;
                                                    }
                                                    setPaymentSubMethod('Card');
                                                }}
                                                disabled={finalTotal <= 0}
                                                className="bg-primary text-text font-black py-4 rounded-xl flex flex-col items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                                            >
                                                <CreditCard size={24} />
                                                <span>CARD QR</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (finalTotal <= 0) {
                                                        useStore.getState().addNotification('ZERO PRICE CHECKOUT BLOCKED', 'warning');
                                                        return;
                                                    }
                                                    setPaymentSubMethod('Bank');
                                                }}
                                                disabled={finalTotal <= 0}
                                                className="bg-indigo-500 text-white font-black py-4 rounded-xl flex flex-col items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                                            >
                                                <QrCode size={24} />
                                                <span>BANK QR</span>
                                            </button>
                                        </div>
                                    ) : paymentSubMethod === 'Cash' ? (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-[10px] font-black text-success uppercase tracking-widest pl-1">Cash Calculator</h4>
                                                <button onClick={() => { setPaymentSubMethod(null); setCashReceived(''); }} className="text-[10px] font-black text-muted hover:text-text uppercase tracking-widest">Change Method</button>
                                            </div>

                                            <div className="bg-glass/20 p-4 rounded-2xl border border-success/20 space-y-4">
                                                <div>
                                                    <label className="text-[10px] font-black text-muted uppercase block mb-2">Amount Received</label>
                                                    <div className="relative">
                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-success">£</span>
                                                        <input
                                                            type="number"
                                                            value={cashReceived}
                                                            onChange={(e) => setCashReceived(e.target.value)}
                                                            className="w-full bg-white border-2 border-success/30 rounded-xl py-4 pl-10 pr-4 text-2xl font-black text-slate-900 focus:outline-none focus:border-success shadow-inner"
                                                            placeholder="0.00"
                                                            autoFocus
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-5 gap-2">
                                                    {[5, 10, 20, 50].map(val => (
                                                        <button
                                                            key={val}
                                                            onClick={() => setCashReceived(val.toString())}
                                                            className="py-2 bg-success/10 hover:bg-success text-success hover:text-text border border-success/30 rounded-lg text-xs font-black transition-all"
                                                        >
                                                            £{val}
                                                        </button>
                                                    ))}
                                                    <button
                                                        onClick={() => setCashReceived(finalTotal.toFixed(2))}
                                                        className="py-2 bg-primary/10 hover:bg-primary text-primary hover:text-text border border-primary/30 rounded-lg text-[10px] font-black transition-all uppercase"
                                                    >
                                                        Exact
                                                    </button>
                                                </div>

                                                {parseFloat(cashReceived) > 0 && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className={`p-4 rounded-xl flex justify-between items-center ${changeDue < 0 ? 'bg-red-500/10 border border-red-500/20' : 'bg-success/20 border border-success/30 shadow-lg shadow-success/5'}`}
                                                    >
                                                        <span className="text-xs font-black uppercase text-muted">{changeDue < 0 ? 'Remaining' : 'Change Due'}</span>
                                                        <span className={`text-2xl font-black ${changeDue < 0 ? 'text-red-400' : 'text-success'}`}>
                                                            £{Math.abs(changeDue).toFixed(2)}
                                                        </span>
                                                    </motion.div>
                                                )}
                                            </div>

                                            <button
                                                onClick={() => handleProcessPayment('Cash')}
                                                disabled={parseFloat(cashReceived) < finalTotal || isProcessingPayment || finalTotal <= 0}
                                                className="w-full bg-success text-text font-black py-4 rounded-xl flex items-center justify-center gap-3 shadow-xl shadow-success/20 hover:scale-[1.01] transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed disabled:hover:scale-100"
                                            >
                                                {isProcessingPayment ? <Timer className="animate-spin" size={20} /> : <Banknote size={20} />}
                                                <span>{isProcessingPayment ? 'PROCESSING...' : 'COMPLETE CASH PAYMENT'}</span>
                                            </button>
                                        </div>
                                    ) : (paymentSubMethod === 'Bank' || paymentSubMethod === 'Card') ? (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="flex items-center justify-between">
                                                <h4 className={`text-[10px] font-black uppercase tracking-widest pl-1 ${paymentSubMethod === 'Card' ? 'text-primary' : 'text-indigo-400'}`}>
                                                    {paymentSubMethod === 'Card' ? 'Card Payment (Camera Scan)' : 'Bank Transfer (App Scan)'}
                                                </h4>
                                                <button onClick={() => setPaymentSubMethod(null)} className="text-[10px] font-black text-muted hover:text-text uppercase tracking-widest">Change Method</button>
                                            </div>

                                            <div className={`bg-gradient-to-br rounded-2xl p-6 space-y-4 border ${paymentSubMethod === 'Card' ? 'from-primary/10 to-primary/5 border-primary/20' : 'from-indigo-500/10 to-indigo-500/5 border-indigo-500/20'}`}>
                                                <div className="text-center space-y-3">
                                                    <div className="flex justify-center">
                                                        <div className="bg-white p-4 rounded-2xl shadow-xl min-h-[200px] flex items-center justify-center">
                                                            <canvas ref={qrCanvasRef} className="mx-auto" />
                                                            {qrError && (
                                                                <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center p-4">
                                                                    <p className="text-red-500 text-xs font-bold text-center">{qrError}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className={`text-xs font-black uppercase tracking-wide ${paymentSubMethod === 'Card' ? 'text-primary' : 'text-indigo-400'}`}>
                                                            {paymentSubMethod === 'Card' ? 'Scan with Phone Camera' : 'Scan From Banking App'}
                                                        </p>
                                                        <p className="text-[10px] text-muted font-medium">
                                                            {paymentSubMethod === 'Card' ? 'Customer scans this with their regular camera app' : 'Customer scans this inside their Revolut/Wise/Bank app'}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 space-y-2">
                                                    <div className="flex justify-between items-center text-slate-900">
                                                        <span className="text-xs font-bold opacity-60">Total Amount</span>
                                                        <span className="text-lg font-black">£{finalTotal.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-slate-800">
                                                        <span className="text-xs font-bold opacity-60">Reference</span>
                                                        <span className="text-xs font-black">Order-{selectedOrder?.id.slice(0, 8)}</span>
                                                    </div>
                                                </div>

                                                <div className="bg-warning/10 border border-warning/30 rounded-xl p-3">
                                                    <p className="text-[10px] text-warning font-bold text-center">
                                                        âš ï¸ Confirm payment on your business device before completing
                                                    </p>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleProcessPayment(paymentSubMethod)}
                                                disabled={isProcessingPayment || finalTotal <= 0}
                                                className={`w-full text-text font-black py-4 rounded-xl flex items-center justify-center gap-3 shadow-xl transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed ${paymentSubMethod === 'Card' ? 'bg-primary shadow-primary/20' : 'bg-indigo-500 shadow-indigo-500/20'}`}
                                            >
                                                {isProcessingPayment ? <Timer className="animate-spin" size={20} /> : paymentSubMethod === 'Card' ? <CreditCard size={20} /> : <QrCode size={20} />}
                                                <span>{isProcessingPayment ? 'PROCESSING...' : `CONFIRM ${paymentSubMethod.toUpperCase()} PAYMENT RECEIVED`}</span>
                                            </button>
                                        </div>
                                    ) : null}

                                    {/* Cancel Payment Button */}
                                    <button
                                        onClick={() => setIsPaymentMode(false)}
                                        className="w-full bg-background border border-muted/20 text-muted font-bold py-3 rounded-xl hover:bg-muted/10 transition-all flex items-center justify-center gap-2"
                                    >
                                        <ArrowLeft size={16} />
                                        Cancel Payment
                                    </button>
                                </div>
                            )
                        }

                        {/* Amendment Save Button - Moved OUTSIDE Payment Mode */}
                        {
                            isAmendMode && (
                                <button
                                    onClick={saveAmendment}
                                    disabled={amendedItems.length === 0}
                                    className="w-full bg-primary text-text font-black py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.01] transition-all disabled:opacity-50"
                                >
                                    <Save size={18} /> Save & Update Order
                                </button>
                            )
                        }

                        {/* Spice Selection Modal */}
                        <AnimatePresence>
                            {spiceModalItem && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md"
                                >
                                    <motion.div
                                        initial={{ scale: 0.9, y: 20 }}
                                        animate={{ scale: 1, y: 0 }}
                                        className="glass-card rounded-[2.5rem] p-8 max-w-sm w-full border border-primary/20 shadow-2xl"
                                    >
                                        <h3 className="text-2xl font-bold text-text mb-2">Select Spice Level</h3>
                                        <p className="text-muted text-sm mb-6">How spicy would you like your <span className="text-primary font-bold">{spiceModalItem.name}</span>?</p>

                                        <div className="grid gap-3">
                                            {[
                                                { label: 'Mild', color: 'text-success border-success/20 bg-success/10' },
                                                { label: 'Medium', color: 'text-warning border-warning/20 bg-warning/10' },
                                                { label: 'Spicy', color: 'text-orange-500 border-orange-500/20 bg-orange-500/10' },
                                                { label: 'Extra Spicy', color: 'text-red-500 border-red-500/20 bg-red-500/10' }
                                            ].map(spice => (
                                                <button
                                                    key={spice.label}
                                                    onClick={() => addItemToAmended(spiceModalItem, spice.label)}
                                                    className={`w-full p-4 rounded-2xl border font-bold text-lg transition-all hover:scale-[1.02] ${spice.color}`}
                                                >
                                                    {spice.label}
                                                </button>
                                            ))}
                                            <button
                                                onClick={() => setSpiceModalItem(null)}
                                                className="mt-2 w-full p-4 text-muted font-bold hover:text-text transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default OrderTable;
