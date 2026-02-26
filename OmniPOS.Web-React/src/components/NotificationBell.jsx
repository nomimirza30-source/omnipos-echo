import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Bell, Check, Trash2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NotificationBell = () => {
    const { notifications, fetchNotifications, markNotificationRead, user } = useStore();
    const [isOpen, setIsOpen] = useState(false);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div className="relative">
            <button
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen) fetchNotifications();
                }}
                className="relative p-2 bg-glass/20 hover:bg-primary/20 rounded-xl transition-all group border border-text/10"
            >
                <Bell size={20} className={unreadCount > 0 ? "text-primary animate-pulse" : "text-muted group-hover:text-primary"} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-slate-900 text-[10px] font-black rounded-full flex items-center justify-center border-2 border-bg shadow-lg">
                        {unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-3 w-80 bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl z-[200] overflow-hidden"
                    >
                        <div className="p-5 border-b border-white/5 flex justify-between items-center">
                            <h3 className="font-black text-xs uppercase tracking-widest text-text">Notifications</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-[10px] font-bold text-muted hover:text-text uppercase"
                            >
                                Close
                            </button>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
                            {notifications.length === 0 ? (
                                <div className="p-10 text-center">
                                    <div className="text-muted text-xs font-medium italic mb-2">No active notifications</div>
                                    <div className="text-[10px] text-muted/40 uppercase tracking-widest font-black">All systems nominal</div>
                                </div>
                            ) : (
                                notifications.map((n) => (
                                    <div
                                        key={n.notificationId || n.id}
                                        className={`p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors group ${n.isRead ? 'opacity-60' : ''}`}
                                    >
                                        <div className="flex gap-3">
                                            <div className="mt-1">
                                                <div className={`w-2 h-2 rounded-full ${n.type === 'StatusChange' ? 'bg-primary shadow-[0_0_8px_rgba(56,189,248,0.5)]' : 'bg-success shadow-[0_0_8px_rgba(52,211,153,0.5)]'}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] text-text font-medium leading-relaxed mb-1">{n.message}</p>
                                                <div className="flex items-center gap-2 text-[8px] text-muted font-black uppercase tracking-tight">
                                                    <Clock size={8} />
                                                    {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => markNotificationRead(n.notificationId || n.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 bg-glass/20 hover:bg-success/20 text-muted hover:text-success rounded-lg transition-all"
                                            >
                                                <Check size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {notifications.length > 0 && (
                            <div className="p-3 bg-white/5 text-center">
                                <p className="text-[8px] text-muted font-bold uppercase tracking-widest">Marked as read notifications auto-archive</p>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default NotificationBell;
