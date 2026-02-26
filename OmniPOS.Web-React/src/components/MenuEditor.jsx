import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Edit3, Trash2, Plus, Tag, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import Modal from './Modal';

const MenuEditor = () => {
    const { menuItems, categories, addCategory, addMenuItem, updateMenuItem, deleteMenuItem, updateMenuStock, user } = useStore();
    const isKitchen = user.role === 'Kitchen';
    const [activeTab, setActiveTab] = useState('All');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [newCategoryName, setNewCategoryName] = useState('');

    const [showManagerOverride, setShowManagerOverride] = useState(false);
    const [managerPin, setManagerPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [pendingSubmit, setPendingSubmit] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        cat: ['Mains'],
        price: '',
        image: '',
        stock: 'High',
        stockQuantity: '',
        allergens: ''
    });

    const handleAddCategory = (e) => {
        e.preventDefault();
        console.log('[MenuEditor] handleAddCategory click!', newCategoryName);
        if (!newCategoryName.trim()) {
            window.alert('Please type a category name first');
            return;
        }

        try {
            window.alert('Attempting to add: ' + newCategoryName);
            addCategory(newCategoryName.trim());
            setNewCategoryName('');
        } catch (err) {
            window.alert('Crash in addCategory: ' + err.message);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, image: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleOpenModal = (item = null) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                ...item,
                cat: item.cat ? item.cat.split(',').map(c => c.trim()) : [],
                allergens: item.allergens || '',
                stockQuantity: item.stockQuantity || ''
            });
        } else {
            setEditingItem(null);
            const fallbackCat = categories.length > 0 ? categories[0] : 'Uncategorized';
            setFormData({ name: '', cat: [fallbackCat], price: '', image: '', stock: 'High', stockQuantity: '', allergens: '' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (user.role === 'Waiter') {
            setPendingSubmit(formData);
            setShowManagerOverride(true);
            setManagerPin('');
            setPinError('');
            return;
        }

        executeSubmit(formData);
    };

    const executeSubmit = (dataToSubmit) => {
        const data = { ...dataToSubmit, price: parseFloat(dataToSubmit.price), cat: dataToSubmit.cat.join(', ') };
        if (data.stockQuantity !== '' && data.stockQuantity !== null) {
            data.stockQuantity = parseInt(data.stockQuantity, 10);
        } else {
            data.stockQuantity = null;
        }

        // Safety Parachute: Check Price Variance
        if (editingItem && editingItem.price > 0) {
            const oldPrice = parseFloat(editingItem.price);
            const newPrice = data.price;
            const variance = Math.abs(newPrice - oldPrice) / oldPrice;

            if (variance > 0.20 && !window.confirm(`WARNING: You are changing the price by more than 20% (from Â£${oldPrice.toFixed(2)} to Â£${newPrice.toFixed(2)}). Is this correct?`)) {
                return;
            }
            updateMenuItem(editingItem.id, data);
        } else if (editingItem) {
            updateMenuItem(editingItem.id, data);
        } else {
            addMenuItem(data);
        }
        setIsModalOpen(false);
    };

    const handleManagerOverrideSubmit = async () => {
        const result = await verifyManagerPin(managerPin);
        if (result.success) {
            setShowManagerOverride(false);
            if (pendingSubmit) {
                executeSubmit(pendingSubmit);
                setPendingSubmit(null);
            }
        } else {
            setPinError(result.message || 'Invalid PIN');
        }
    };

    const filteredItems = activeTab === 'All' ? menuItems : menuItems.filter(i => {
        const itemCats = typeof i.cat === 'string' ? i.cat.split(',').map(c => c.trim()) : (Array.isArray(i.cat) ? i.cat : []);
        return itemCats.includes(activeTab);
    });

    return (
        <div className="glass-card rounded-3xl overflow-hidden" style={{ background: 'rgb(8 14 30 / 0.85)' }}>
            {/* â”€â”€ Header â”€â”€ */}
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-black text-white">{isKitchen ? 'Stock Control Center' : 'Menu Management'}</h2>
                    <p className="text-[10px] text-[rgb(100_120_150)] font-bold uppercase tracking-widest mt-0.5">
                        {isKitchen ? 'Toggle availability for active service' : 'Full menu lifecycle & pricing control'}
                    </p>
                </div>
                {!isKitchen && (
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wide transition-all badge-inprogress hover:opacity-80"
                    >
                        <Plus size={15} /> Add Item
                    </button>
                )}
            </div>

            {/* â”€â”€ Two-column layout â”€â”€ */}
            <div className="flex min-h-[500px]">
                {/* Left: Category Sidebar */}
                <div className="w-48 flex-shrink-0 border-r border-white/5 flex flex-col py-4 gap-0.5 overflow-y-auto scrollbar-hide" style={{ background: 'rgb(6 10 24 / 0.6)' }}>
                    {['All', ...categories].map(cat => {
                        const active = activeTab === cat;
                        return (
                            <div key={cat} className="relative group px-3">
                                <button
                                    onClick={() => setActiveTab(cat)}
                                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${active
                                        ? 'text-[rgb(0,210,180)] bg-[rgb(0_210_180_/_0.1)] border-l-2 border-[rgb(0,210,180)] pl-[10px]'
                                        : 'text-[rgb(100_120_150)] hover:text-white hover:bg-white/5 border-l-2 border-transparent'
                                        }`}
                                >
                                    {cat}
                                </button>
                                {cat !== 'All' && !isKitchen && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm(`Delete the ${cat} category?`)) {
                                                useStore.getState().deleteCategory(cat);
                                                if (activeTab === cat) setActiveTab('All');
                                            }
                                        }}
                                        className="absolute top-1.5 right-4 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
                                        title="Delete Category"
                                    >
                                        <span className="text-[10px] font-bold leading-none">Ã—</span>
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    {/* Add Category */}
                    {!isKitchen && (
                        <form onSubmit={handleAddCategory} className="px-3 mt-3 pt-3 border-t border-white/5 flex flex-col gap-2">
                            <input
                                type="text"
                                required
                                placeholder="New category..."
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                className="w-full bg-white/5 border border-white/8 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[rgb(0_210_180_/_0.5)] placeholder-[rgb(80_100_130)]"
                                style={{ borderColor: 'rgb(255 255 255 / 0.08)' }}
                            />
                            <button type="submit" className="w-full py-1.5 rounded-lg badge-inprogress text-[10px] font-black uppercase hover:opacity-80 transition-all flex items-center justify-center gap-1">
                                <Plus size={11} /> Add
                            </button>
                        </form>
                    )}
                </div>

                {/* Right: Item Tile Grid */}
                <div className="flex-1 p-5 overflow-y-auto custom-scrollbar">
                    {filteredItems.length === 0 ? (
                        <div className="py-20 text-center text-[rgb(80_100_130)] text-sm italic">No items in this category</div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredItems.map(item => (
                                <div
                                    key={item.id}
                                    className="rounded-2xl border border-white/6 overflow-hidden flex flex-col group hover:border-[rgb(0_210_180_/_0.3)] transition-all"
                                    style={{ background: 'rgb(14 26 52 / 0.7)' }}
                                >
                                    {/* Image */}
                                    <div className="h-28 bg-white/5 overflow-hidden relative">
                                        {item.image ? (
                                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-[rgb(60_80_110)]">
                                                <ImageIcon size={28} />
                                            </div>
                                        )}
                                        {/* Stock indicator */}
                                        <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${item.stock === 'High' ? 'bg-[rgb(52_211_153_/_0.2)] text-[rgb(52,211,153)]' :
                                            item.stock === 'Medium' ? 'bg-[rgb(251_191_36_/_0.2)] text-[rgb(251,191,36)]' :
                                                item.stock === 'Low' ? 'bg-[rgb(239_68_68_/_0.2)] text-red-400' :
                                                    'bg-white/10 text-white/40'
                                            }`}>{item.stock}</div>
                                    </div>
                                    {/* Info */}
                                    <div className="p-3 flex flex-col flex-1">
                                        <div className="font-bold text-white text-sm truncate group-hover:text-[rgb(0,210,180)] transition-colors">{item.name}</div>
                                        <div className="text-[10px] text-[rgb(100_120_150)] mt-0.5">Â£{item.price.toFixed(2)}</div>
                                        {item.allergens && (
                                            <div className="text-[8px] text-red-400 font-bold mt-1 truncate">âš  {item.allergens}</div>
                                        )}
                                        {/* Stock level buttons */}
                                        <div className="mt-2 flex gap-1 flex-wrap">
                                            {[{ id: 'High', cls: 'text-[rgb(52,211,153)]' }, { id: 'Medium', cls: 'text-[rgb(251,191,36)]' }, { id: 'Low', cls: 'text-red-400' }, { id: 'Not Available', cls: 'text-white/30' }].map(s => (
                                                <button
                                                    key={s.id}
                                                    onClick={() => updateMenuStock(item.id, s.id)}
                                                    className={`text-[7px] px-1.5 py-0.5 rounded font-black uppercase transition-all ${item.stock === s.id ? `${s.cls} bg-white/10` : 'text-white/20 hover:text-white/50'}`}
                                                >
                                                    {s.id === 'Not Available' ? '86' : s.id.slice(0, 3)}
                                                </button>
                                            ))}
                                        </div>
                                        {!isKitchen && (
                                            <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-end gap-1">
                                                <button onClick={() => handleOpenModal(item)} className="p-1.5 rounded-lg bg-white/5 hover:bg-[rgb(0_210_180_/_0.12)] text-[rgb(100_120_150)] hover:text-[rgb(0,210,180)] transition-all" title="Edit"><Edit3 size={12} /></button>
                                                <button onClick={() => deleteMenuItem(item.id)} className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/15 text-[rgb(100_120_150)] hover:text-red-400 transition-all" title="Delete"><Trash2 size={12} /></button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* â”€â”€ Add/Edit Item Modal â”€â”€ */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
            >
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">Item Name</label>
                        <input
                            required
                            className="bg-glass/20 border border-text/10 rounded-xl p-3 text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. Steak Frites"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">Categories</label>
                        <div className="flex flex-wrap gap-2">
                            {categories.map(c => (
                                <label key={c} className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all flex items-center gap-2 ${formData.cat.includes(c) ? 'bg-primary text-slate-950 border-primary shadow-lg shadow-primary/20' : 'bg-glass/20 text-muted border-text/10 hover:border-text/20'}`}>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={formData.cat.includes(c)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setFormData({ ...formData, cat: [...formData.cat, c] });
                                            } else {
                                                setFormData({ ...formData, cat: formData.cat.filter(catName => catName !== c) });
                                            }
                                        }}
                                    />
                                    {c}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">Price (Â£)</label>
                            <input
                                required
                                type="number"
                                step="0.01"
                                className="bg-glass/20 border border-text/10 rounded-xl p-3 text-text focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-bold"
                                value={formData.price}
                                onChange={e => setFormData({ ...formData, price: e.target.value })}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">Stock Level</label>
                            <select
                                className="bg-glass border border-text/10 rounded-xl p-3 text-text focus:outline-none text-sm font-bold"
                                value={formData.stock}
                                onChange={e => setFormData({ ...formData, stock: e.target.value })}
                            >
                                <option value="High">High Stock</option>
                                <option value="Medium">Medium Stock</option>
                                <option value="Low">Low Stock</option>
                                <option value="Not Available">Not Available (86-ed)</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">Stock Quantity (Optional)</label>
                        <input
                            type="number"
                            className="bg-glass/20 border border-text/10 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-bold"
                            value={formData.stockQuantity}
                            onChange={e => setFormData({ ...formData, stockQuantity: e.target.value })}
                            placeholder="Leave blank for unlimited"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">Allergens</label>
                        <input
                            className="bg-glass/20 border border-text/10 text-red-400 font-bold rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                            value={formData.allergens}
                            onChange={e => setFormData({ ...formData, allergens: e.target.value })}
                            placeholder="e.g. Nuts, Dairy, Gluten (Leave blank if none)"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">Image (URL or Upload)</label>
                        <div className="flex gap-2">
                            <input
                                className="flex-1 bg-glass/20 border border-text/10 rounded-xl p-3 text-text focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                value={formData.image}
                                onChange={e => setFormData({ ...formData, image: e.target.value })}
                                placeholder="Paste image URL..."
                            />
                            <div className="relative">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    id="file-upload"
                                />
                                <label
                                    htmlFor="file-upload"
                                    className="flex items-center justify-center p-3 bg-glass/40 hover:bg-glass/60 border border-text/10 rounded-xl text-muted cursor-pointer transition-colors"
                                    title="Upload File"
                                >
                                    <ImageIcon size={20} />
                                </label>
                            </div>
                        </div>
                        {formData.image && (
                            <div className="mt-2 text-[10px] text-primary font-bold overflow-hidden text-ellipsis whitespace-nowrap px-1">
                                Image Source: {formData.image.startsWith('data:') ? 'Local File Uploaded' : 'Web URL'}
                            </div>
                        )}
                    </div>
                    <button type="submit" className="bg-primary text-slate-950 font-bold py-3 rounded-xl mt-4 hover:shadow-lg transition-all">
                        {editingItem ? 'Update Item' : 'Create Item'}
                    </button>
                </form>
            </Modal>

            <Modal isOpen={showManagerOverride} onClose={() => { setShowManagerOverride(false); setPendingSubmit(null); setPinError(''); }} title="Manager Override Required">
                <div className="space-y-6 text-center p-4">
                    <div className="w-20 h-20 bg-warning/20 text-warning rounded-full flex items-center justify-center mx-auto mb-2">
                        <AlertTriangle size={40} />
                    </div>
                    <h3 className="text-xl font-black text-warning uppercase">Authorization Needed</h3>
                    <p className="text-sm font-bold text-text">Please enter Manager PIN to approve menu changes.</p>
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
                        <button type="button" onClick={() => { setShowManagerOverride(false); setPendingSubmit(null); setPinError(''); }} className="py-4 bg-glass/20 border border-text/10 text-text font-bold rounded-xl hover:bg-glass/40 transition-all">Cancel</button>
                        <button type="button" onClick={handleManagerOverrideSubmit} className="py-4 bg-warning text-slate-900 font-black rounded-xl hover:shadow-lg shadow-warning/20 transition-all">Approve</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default MenuEditor;
