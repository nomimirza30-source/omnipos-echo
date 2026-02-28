import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { ShoppingCart, User, Users, Mail, MapPin, Plus, Minus, CheckCircle, XCircle, ArrowRight, ArrowLeft, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const OrderEntry = () => {
    const { menuItems, tables, categories, createOrder, setView, user } = useStore();
    const [step, setStep] = useState(1); // 1: Info, 2: Menu, 3: Confirm
    const [cart, setCart] = useState([]);
    const [orderType, setOrderType] = useState('Dine-in'); // 'Dine-in' or 'Takeaway'
    const [customerInfo, setCustomerInfo] = useState({
        name: '',
        email: '',
        phone: '',
        tableId: '', // Comma separated IDs
        notes: '',
        guestCount: 2
    });
    const [spiceModalItem, setSpiceModalItem] = useState(null);
    const [activeCategory, setActiveCategory] = useState('All');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Memory Bank: Auto-load draft on mount
    useEffect(() => {
        const savedDraft = localStorage.getItem('omnipos_draft_cart');
        if (savedDraft) {
            try {
                const parsed = JSON.parse(savedDraft);
                if (parsed.cart?.length > 0) {
                    if (window.confirm("An unsaved order was found. Would you like to restore it?")) {
                        setCart(parsed.cart);
                        setCustomerInfo(parsed.customerInfo || customerInfo);
                        setOrderType(parsed.orderType || 'Dine-in');
                        setStep(2); // Jump to menu to see restored items
                    } else {
                        localStorage.removeItem('omnipos_draft_cart');
                    }
                }
            } catch (e) {
                console.error("Failed to parse draft cart", e);
                localStorage.removeItem('omnipos_draft_cart');
            }
        }
    }, []);

    // Memory Bank: Auto-save on change
    useEffect(() => {
        if (cart.length > 0 || customerInfo.name || customerInfo.phone || customerInfo.email) {
            localStorage.setItem('omnipos_draft_cart', JSON.stringify({
                cart,
                customerInfo,
                orderType
            }));
        }
    }, [cart, customerInfo, orderType]);

    const addToCart = (item, spiceLevel = null) => {
        if (item.stock === 'Not Available') return;

        // Show spice modal for ALL menu items (not just specific categories)
        if (!spiceLevel) {
            setSpiceModalItem(item);
            return;
        }

        const cartItemId = spiceLevel ? `${item.id}-${spiceLevel}` : item.id;
        const existing = cart.find(i => i.cartItemId === cartItemId);

        if (existing) {
            setCart(cart.map(i => i.cartItemId === cartItemId ? { ...i, qty: i.qty + 1 } : i));
        } else {
            setCart([...cart, { ...item, cartItemId, qty: 1, spice: spiceLevel }]);
        }
        setSpiceModalItem(null);
    };

    const updateQty = (cartItemId, delta) => {
        setCart(cart.map(i => {
            if (i.cartItemId === cartItemId) {
                const newQty = Math.max(0, i.qty + delta);
                return { ...i, qty: newQty };
            }
            return i;
        }).filter(i => i.qty > 0));
    };

    const removeFromCart = (itemId) => {
        const existing = cart.find(i => i.id === itemId);
        if (existing.qty > 1) {
            setCart(cart.map(i => i.id === itemId ? { ...i, qty: i.qty - 1 } : i));
        } else {
            setCart(cart.filter(i => i.id !== itemId));
        }
    };

    const cartTotal = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);

    const toggleTable = (id) => {
        const selected = customerInfo.tableId ? customerInfo.tableId.split(',') : [];
        const isAlreadySelected = selected.includes(id);

        if (isAlreadySelected) {
            const newSelected = selected.filter(tid => tid !== id);
            setCustomerInfo({ ...customerInfo, tableId: newSelected.join(',') });
        } else {
            // Efficiency Guard: Only allow if we don't have enough capacity yet
            if (totalSelectedCapacity >= customerInfo.guestCount) return;

            const newSelected = [...selected, id];
            setCustomerInfo({ ...customerInfo, tableId: newSelected.join(',') });
        }
    };

    const selectedTableIds = customerInfo.tableId ? customerInfo.tableId.split(',').filter(Boolean) : [];
    const totalSelectedCapacity = selectedTableIds.reduce((sum, tid) => {
        const t = tables.find(table => table.id === tid);
        return sum + Number(t?.cap || 0);
    }, 0);

    // Safety check: is any single table redundant?
    // If we can remove any ONE table and still meet the guest count, it's over-allocated.
    const isOverAllocated = selectedTableIds.length > 1 && selectedTableIds.some(tid => {
        const t = tables.find(table => table.id === tid);
        return (totalSelectedCapacity - Number(t?.cap || 0)) >= customerInfo.guestCount;
    });

    const isCapacityInsufficient = customerInfo.tableId && totalSelectedCapacity < customerInfo.guestCount;

    const handleCompleteOrder = async () => {
        if (isSubmitting) return;

        // "Empty Shelf" (Inventory Lock) Validation
        const currentState = useStore.getState();
        for (const cartItem of cart) {
            const storeItem = currentState.menuItems.find(mi => mi.id === cartItem.id);
            if (storeItem && typeof storeItem.stockQuantity === 'number') {
                if (cartItem.qty > storeItem.stockQuantity) {
                    currentState.addNotification({
                        title: 'Sold Out',
                        message: `${storeItem.name} only has ${storeItem.stockQuantity} remaining.`,
                        type: 'error'
                    });
                    return; // Abort submission
                }
            }
        }

        setIsSubmitting(true);
        try {
            const orderData = {
                customerName: customerInfo.name || (orderType === 'Takeaway' ? 'Takeaway' : 'Dine-in'),
                customerEmail: customerInfo.email,
                customerPhone: customerInfo.phone,
                tableId: orderType === 'Takeaway' ? '' : customerInfo.tableId,
                notes: customerInfo.notes,
                guestCount: orderType === 'Takeaway' ? 1 : customerInfo.guestCount,
                operatorName: user?.fullName || user?.name || user?.username || 'System',
                items: cart,
                amount: cartTotal.toFixed(2),
                type: orderType
            };

            // Allow synchronous state update in Zustand to complete
            await createOrder(orderData);

            // Memory Bank: Clear draft on successful order
            localStorage.removeItem('omnipos_draft_cart');

            setView('Dashboard');
        } finally {
            // Restore button state in case of error or lingering component
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Progress Header */}
            <div className="glass-card rounded-3xl p-4 flex justify-between items-center bg-glass/20 border border-text/10">
                {[1, 2, 3].map(s => (
                    <div key={s} className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${step >= s ? 'bg-primary text-slate-950 shadow-lg shadow-primary/20' : 'bg-glass/20 text-muted border border-text/10'}`}>
                            {step > s ? <CheckCircle size={14} /> : s}
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${step >= s ? 'text-text' : 'text-muted'}`}>
                            {s === 1 ? 'Info' : s === 2 ? 'Menu' : 'Confirm'}
                        </span>
                        {s < 3 && <div className={`w-12 h-0.5 rounded-full ${step > s ? 'bg-primary' : 'bg-glass/20'}`} />}
                    </div>
                ))}
            </div>

            <AnimatePresence mode="wait">
                {step === 1 && (
                    <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="glass-card rounded-3xl p-8"
                    >
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-text">
                            <User className="text-primary" /> Customer Details
                        </h2>

                        {/* Order Type Toggle */}
                        <div className="flex bg-glass/20 p-1 rounded-2xl mb-6 relative">
                            <button
                                onClick={() => setOrderType('Dine-in')}
                                className={`flex-1 py-3 text-sm font-black uppercase tracking-widest rounded-xl transition-all relative z-10 ${orderType === 'Dine-in' ? 'text-slate-900 shadow-sm' : 'text-muted hover:text-text'}`}
                            >
                                Dine-In
                            </button>
                            <button
                                onClick={() => setOrderType('Takeaway')}
                                className={`flex-1 py-3 text-sm font-black uppercase tracking-widest rounded-xl transition-all relative z-10 ${orderType === 'Takeaway' ? 'text-slate-900 shadow-sm' : 'text-muted hover:text-text'}`}
                            >
                                Takeaway
                            </button>
                            <div
                                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-primary rounded-xl transition-transform duration-300 ease-in-out`}
                                style={{ transform: `translateX(${orderType === 'Dine-in' ? '4px' : 'calc(100% + 4px)'})` }}
                            />
                        </div>

                        <div className="grid gap-6 max-w-md">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-muted uppercase flex items-center gap-2">
                                    <User size={14} /> Full Name {orderType === 'Takeaway' && <span className="text-[10px] text-muted/60 lowercase font-normal ml-1">(Optional)</span>}
                                </label>
                                <input
                                    className="bg-glass/20 border border-text/10 rounded-2xl p-4 text-text focus:outline-none focus:ring-2 focus:ring-primary/50 text-lg font-medium"
                                    value={customerInfo.name}
                                    onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                    placeholder={orderType === 'Takeaway' ? "Takeaway Customer" : "e.g. John Doe"}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-muted uppercase flex items-center gap-2">
                                    <Mail size={14} /> Email Address
                                </label>
                                <input
                                    className="bg-glass/20 border border-text/10 rounded-2xl p-4 text-text focus:outline-none focus:ring-2 focus:ring-primary/50 text-lg font-medium"
                                    value={customerInfo.email}
                                    onChange={e => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                                    placeholder="john@example.com"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-muted uppercase flex items-center gap-2">
                                    <Phone size={14} /> Phone Number
                                </label>
                                <input
                                    className="bg-glass/20 border border-text/10 rounded-2xl p-4 text-text focus:outline-none focus:ring-2 focus:ring-primary/50 text-lg font-medium"
                                    value={customerInfo.phone}
                                    onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                                    placeholder="+44 7... "
                                />
                            </div>
                            {orderType === 'Dine-in' && (
                                <>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-muted uppercase flex items-center gap-2">
                                            <Users size={14} /> Number of Guests
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <button
                                                onClick={() => setCustomerInfo({ ...customerInfo, guestCount: Math.max(1, customerInfo.guestCount - 1) })}
                                                className="p-4 bg-glass/20 border border-text/10 rounded-2xl text-text hover:bg-primary/20 transition-all"
                                            >
                                                <Minus size={20} />
                                            </button>
                                            <div className="flex-1 bg-glass/20 border border-text/10 rounded-2xl p-4 text-center text-2xl font-black text-primary">
                                                {customerInfo.guestCount}
                                            </div>
                                            <button
                                                onClick={() => setCustomerInfo({ ...customerInfo, guestCount: customerInfo.guestCount + 1 })}
                                                className="p-4 bg-glass/20 border border-text/10 rounded-2xl text-text hover:bg-primary/20 transition-all"
                                            >
                                                <Plus size={20} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-muted uppercase flex items-center gap-2">
                                            <MapPin size={14} /> Assign Table
                                        </label>
                                        <div className="grid grid-cols-4 gap-3">
                                            {tables.map(t => (
                                                <button
                                                    key={t.id}
                                                    disabled={(t.status === 'Occupied' || t.status === 'Reserved') || (!customerInfo.tableId.split(',').includes(t.id) && totalSelectedCapacity >= customerInfo.guestCount)}
                                                    onClick={() => toggleTable(t.id)}
                                                    className={`p-4 rounded-2xl border transition-all text-center relative overflow-hidden ${customerInfo.tableId.split(',').includes(t.id)
                                                        ? 'bg-primary border-primary shadow-lg shadow-primary/30 text-slate-950'
                                                        : t.status === 'Occupied' || t.status === 'Reserved'
                                                            ? 'bg-red-500/10 border-red-500/20 text-red-400 opacity-40 cursor-not-allowed'
                                                            : (!customerInfo.tableId.split(',').includes(t.id) && totalSelectedCapacity >= customerInfo.guestCount)
                                                                ? 'bg-glass/10 border-text/5 text-muted opacity-30 cursor-not-allowed'
                                                                : 'bg-glass/20 border-text/10 text-muted hover:border-text/20'
                                                        }`}
                                                >
                                                    <div className="font-black text-xl">{t.num}</div>
                                                    {(t.status === 'Occupied' || t.status === 'Reserved') && (
                                                        <div className="text-[7px] font-black uppercase tracking-tighter mt-1">{t.status}</div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {isCapacityInsufficient && (
                                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[10px] font-black uppercase flex items-center gap-2 animate-pulse">
                                            <XCircle size={14} /> Insufficient capacity: {totalSelectedCapacity}/{customerInfo.guestCount} Seats
                                        </div>
                                    )}
                                    {isOverAllocated && !isCapacityInsufficient && (
                                        <div className="p-3 bg-warning/10 border border-warning/20 rounded-xl text-warning text-[10px] font-black uppercase flex items-center gap-2">
                                            <XCircle size={14} /> Too many tables: Some selections are redundant
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <button
                            disabled={(orderType === 'Dine-in' && (!customerInfo.tableId || isCapacityInsufficient || isOverAllocated))}
                            onClick={() => setStep(2)}
                            className="mt-4 bg-primary text-slate-950 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-30 disabled:grayscale transition-all hover:shadow-xl"
                        >
                            Continue <ArrowRight size={18} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {step === 2 && (
                <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6"
                >
                    <div className="glass-card rounded-3xl p-6 overflow-hidden">
                        <h2 className="text-xl font-bold mb-6 text-text">Select Items</h2>
                        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide items-center">
                            {['All', ...categories].map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border shrink-0 ${activeCategory === cat
                                        ? 'bg-primary text-slate-950 border-primary shadow-lg shadow-primary/20'
                                        : 'bg-glass/20 text-muted border-text/10 hover:border-text/20'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto max-h-[600px] pr-2 scrollbar-hide">
                            {(activeCategory === 'All' ? menuItems : menuItems.filter(i => {
                                const catArray = typeof i.cat === 'string' ? i.cat.split(',').map(c => c.trim()) : (Array.isArray(i.cat) ? i.cat : []);
                                return catArray.includes(activeCategory);
                            })).map(item => {
                                // Calculate how many of THIS specific item are already in the cart
                                const currentCartQty = cart.filter(c => c.id === item.id).reduce((sum, c) => sum + c.qty, 0);
                                const isAtStockLimit = typeof item.stockQuantity === 'number' && currentCartQty >= item.stockQuantity;
                                const isItemDisabled = item.stock === 'Not Available' || item.stockQuantity === 0 || isAtStockLimit;

                                return (
                                    <button
                                        key={item.id}
                                        disabled={isItemDisabled}
                                        onClick={() => addToCart(item)}
                                        className={`bg-glass/20 border border-text/10 p-4 rounded-2xl text-left group transition-all flex flex-col h-full min-h-[200px] ${isItemDisabled ? 'opacity-40 grayscale cursor-not-allowed' : 'hover:border-primary/30'}`}
                                    >
                                        <div className="flex gap-4 mb-3">
                                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-glass/40 flex-shrink-0 relative">
                                                <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                {item.stock === 'Low' && (
                                                    <div className="absolute top-1 right-1 bg-red-500 text-[8px] font-black px-1 rounded text-white animate-pulse">LOW</div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-text group-hover:text-primary truncate">{item.name}</div>
                                                <div className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border inline-block mt-1 ${item.stock === 'Not Available' ? 'text-muted/50 border-text/10' :
                                                    item.stock === 'Low' ? 'text-red-400 border-red-900/50 bg-red-900/20' :
                                                        item.stock === 'Medium' ? 'text-warning border-warning/20 bg-warning/10' :
                                                            'text-success border-success/20 bg-success/10'
                                                    }`}>
                                                    {item.stock === 'Not Available' || item.stockQuantity === 0 ? '86-ed' : item.stock}
                                                </div>
                                                {typeof item.stockQuantity === 'number' && (
                                                    <div className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ml-1 inline-block ${item.stockQuantity - currentCartQty > 0 ? 'text-primary border-primary/20 bg-primary/10' : 'text-red-400 border-red-900/50 bg-red-900/20'}`}>
                                                        {item.stockQuantity - currentCartQty} Left
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex-1 flex flex-col">
                                            {item.allergens && (
                                                <div className="text-[9px] text-red-500/80 font-bold bg-red-500/5 border border-red-500/10 px-2 py-1 rounded-lg mb-2 line-clamp-2 leading-tight">
                                                    Allergy: {item.allergens}
                                                </div>
                                            )}

                                            <div className="mt-auto flex justify-between items-center">
                                                <div className="text-sm font-black text-text/90">£{item.price.toFixed(2)}</div>
                                                <div className={`p-1.5 rounded-xl transition-colors ${isItemDisabled ? 'bg-glass/40 text-muted' : 'bg-primary/20 text-primary group-hover:bg-primary group-hover:text-slate-950'}`}>
                                                    <Plus size={16} />
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="glass-card rounded-3xl p-6 flex flex-col border-l border-primary/10">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-text">
                            <ShoppingCart className="text-primary" /> Current Cart
                        </h2>
                        <div className="flex-1 overflow-y-auto space-y-4 mb-6 scrollbar-hide">
                            {cart.length === 0 ? (
                                <div className="text-muted text-sm italic text-center py-20">Cart is empty</div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.cartItemId} className="flex items-center justify-between border-b border-text/10 pb-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <div className="font-bold text-sm text-text">{item.name}</div>
                                                {item.spice && (
                                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase ${item.spice === 'Extra Spicy' ? 'bg-red-500/20 text-red-500 border-red-500/50' :
                                                        item.spice === 'Spicy' ? 'bg-orange-500/20 text-orange-500 border-orange-500/50' :
                                                            item.spice === 'Medium' ? 'bg-warning/20 text-warning border-warning/50' :
                                                                'bg-success/20 text-success border-success/50'
                                                        }`}>
                                                        {item.spice}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-muted">£{(item.price * item.qty).toFixed(2)}</div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => updateQty(item.cartItemId, -1)} className="p-3 bg-glass/20 rounded-xl hover:bg-red-500/20 text-text transition-all"><Minus size={18} /></button>
                                            <span className="font-black text-lg text-text min-w-[24px] text-center">{item.qty}</span>
                                            <button
                                                onClick={() => updateQty(item.cartItemId, 1)}
                                                disabled={
                                                    typeof menuItems.find(m => m.id === item.id)?.stockQuantity === 'number' &&
                                                    cart.filter(c => c.id === item.id).reduce((sum, c) => sum + c.qty, 0) >= menuItems.find(m => m.id === item.id)?.stockQuantity
                                                }
                                                className="p-3 bg-glass/20 rounded-xl hover:bg-success/20 text-text disabled:opacity-30 disabled:hover:bg-glass/20 cursor-pointer disabled:cursor-not-allowed transition-all"
                                            >
                                                <Plus size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="border-t border-text/10 pt-4 mb-6">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-muted text-xs font-bold uppercase">Subtotal</span>
                                <span className="text-text font-black">£{cartTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted text-xs font-bold uppercase">Service Charge</span>
                                <span className="text-success font-black">Inc.</span>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setStep(1)} className="p-4 bg-glass/20 rounded-2xl text-muted hover:text-text transition-colors"><ArrowLeft size={20} /></button>
                            <button
                                disabled={cart.length === 0}
                                onClick={() => setStep(3)}
                                className="flex-1 bg-primary text-slate-950 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-30 transition-all shadow-lg shadow-primary/10"
                            >
                                Confirm Order <ArrowRight size={20} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )
            }
            <AnimatePresence>
                {step === 3 && (
                    <motion.div
                        key="step3"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-card rounded-3xl p-6 md:p-10 max-w-2xl mx-auto text-center border border-primary/20"
                    >
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-success/20 text-success rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
                            <CheckCircle size={32} />
                        </div>
                        <h2 className="text-2xl md:text-3xl font-bold mb-2 text-text">Review Order</h2>
                        <p className="text-muted mb-6 md:mb-8 text-sm">Review your selection before sending to kitchen</p>

                        <div className="bg-glass/20 rounded-2xl md:rounded-3xl p-6 md:p-8 mb-6 md:mb-8 text-left grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8 border border-text/10">
                            <div>
                                <h4 className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Order For</h4>
                                <div className="text-lg md:text-xl font-bold text-text truncate">
                                    {customerInfo.name || (orderType === 'Takeaway' ? 'Takeaway' : 'Walk-in')}
                                    {orderType === 'Takeaway' && <span className="ml-2 bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-full font-black uppercase">Takeaway</span>}
                                </div>
                                {(customerInfo.email || customerInfo.phone) ? (
                                    <div className="text-xs text-muted truncate">{customerInfo.email || `Phone: ${customerInfo.phone}`}</div>
                                ) : (
                                    <div className="text-xs text-muted truncate">No contact provided</div>
                                )}
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">
                                    {orderType === 'Takeaway' ? 'Pickup' : 'Location'}
                                </h4>
                                <div className="text-lg md:text-xl font-bold text-primary">
                                    {orderType === 'Takeaway' ? 'Collection' : (customerInfo.tableId?.split(',').filter(Boolean).map(tid => tables.find(t => t.id === tid)?.num).join(', ') || 'Walk-in')}
                                </div>
                                <div className="text-xs text-muted">
                                    {orderType === 'Takeaway' ? '1 Item(s) at Reception' : `${customerInfo.guestCount} Guests • Dine-in`}
                                </div>
                            </div>
                        </div>

                        <div className="mb-6 md:mb-8 text-left">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 block">Special Instructions / Notes</label>
                            <textarea
                                className="w-full bg-glass/20 border border-text/10 rounded-2xl p-4 text-text focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium h-24 resize-none"
                                value={customerInfo.notes}
                                onChange={e => setCustomerInfo({ ...customerInfo, notes: e.target.value })}
                                placeholder="Any allergies or special requests? (e.g. No onions, extra napkins)"
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <button onClick={() => setStep(2)} className="flex-1 p-4 bg-glass/20 text-muted font-bold rounded-2xl hover:text-text transition-colors border border-text/10 order-2 sm:order-1">Back to Menu</button>
                            <button onClick={handleCompleteOrder} disabled={isSubmitting} className="flex-1 p-4 bg-primary text-slate-950 font-bold rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform order-1 sm:order-2 disabled:opacity-50 disabled:grayscale disabled:hover:scale-100">
                                {isSubmitting ? 'Sending...' : `Send Order • £${cartTotal.toFixed(2)}`}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Spice Selection Modal */}
            <AnimatePresence>
                {spiceModalItem && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md"
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
                                        onClick={() => addToCart(spiceModalItem, spice.label)}
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
            </AnimatePresence >
        </div >
    );
};

export default OrderEntry;
