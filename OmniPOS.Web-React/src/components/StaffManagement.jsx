import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { UserPlus, Edit, Key, Trash, Shield, Users } from 'lucide-react';

const StaffManagement = () => {
    const {
        user, token, currentTenantId, fetchEmployees, employees, roles,
        addStaffAsync, updateStaffRoleAsync, changeStaffPasswordAsync
    } = useStore();
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [newStaff, setNewStaff] = useState({
        fullName: '',
        username: '',
        role: roles[0]?.name || 'Waiter',
        password: '',
        email: '',
        payRate: 0,
        workingDays: []
    });
    const [newPassword, setNewPassword] = useState('');

    useEffect(() => {
        const load = async () => {
            await fetchEmployees();
            setLoading(false);
        };
        load();
    }, [fetchEmployees]);


    const handleCreateStaff = async (e) => {
        e.preventDefault();
        const success = await addStaffAsync({
            ...newStaff,
            workingDays: JSON.stringify(newStaff.workingDays)
        });

        if (success) {
            setShowAddModal(false);
            setNewStaff({ fullName: '', username: '', role: roles[0]?.name || 'Waiter', password: '', email: '', payRate: 0, workingDays: [] });
        } else {
            alert('Error creating staff member');
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        const success = await changeStaffPasswordAsync(selectedStaff.staffId, newPassword);
        if (success) {
            setShowPasswordModal(false);
            setNewPassword('');
            alert('Password updated successfully');
        } else {
            alert('Error updating password');
        }
    };

    const handleRoleUpdate = async (staffId, newRole) => {
        const staffMember = employees.find(e => e.id === staffId);
        await updateStaffRoleAsync(staffId, newRole, staffMember?.payRate || 0, JSON.stringify(staffMember?.workingDays || []));
    };

    if (!['Admin', 'Owner', 'Manager'].includes(user?.role)) {
        return <div className="p-8 text-center text-red-500">Access Denied. Admin/Manager/Owner privileges required.</div>;
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <Users className="w-8 h-8 text-indigo-500" />
                    Staff Management
                </h1>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                    <UserPlus size={20} />
                    Add New Staff
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        <tr>
                            <th className="p-4">Name</th>
                            <th className="p-4">Username</th>
                            <th className="p-4">Role</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {employees.map((employee) => (
                            <tr key={employee.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="p-4 font-medium text-gray-900 dark:text-white">
                                    <div className="flex flex-col">
                                        <span>{employee.name}</span>
                                        <span className="text-xs text-gray-400">{employee.email}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-gray-600 dark:text-gray-300">{employee.username || employee.name.toLowerCase().replace(' ', '.')}</td>
                                <td className="p-4">
                                    <div className="relative inline-block w-40">
                                        <select
                                            value={employee.role}
                                            onChange={(e) => handleRoleUpdate(employee.id, e.target.value)}
                                            className="w-full pl-3 pr-10 py-1.5 bg-gray-100 dark:bg-gray-600 border-none rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
                                        >
                                            {roles.map(r => (
                                                <option key={r.name} value={r.name}>{r.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </td>
                                <td className="p-4 text-right flex justify-end gap-2">
                                    <button
                                        onClick={() => {
                                            setSelectedStaff({ ...employee, staffId: employee.id });
                                            setShowPasswordModal(true);
                                        }}
                                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                                        title="Change Password"
                                    >
                                        <Key size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {employees.length === 0 && !loading && (
                    <div className="p-8 text-center text-gray-500">No staff members found.</div>
                )}
            </div>

            {/* Add Staff Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 dark:text-white">Add New Staff Member</h2>
                        <form onSubmit={handleCreateStaff} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={newStaff.fullName}
                                    onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={newStaff.username}
                                    onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email (Optional)</label>
                                <input
                                    type="email"
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={newStaff.email}
                                    onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                                <select
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={newStaff.role}
                                    onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                                >
                                    {roles.map(r => (
                                        <option key={r.name} value={r.name}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pay Rate (£/hr)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={newStaff.payRate}
                                    onChange={(e) => setNewStaff({ ...newStaff, payRate: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Working Days</label>
                                <div className="flex flex-wrap gap-2">
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                        <button
                                            type="button"
                                            key={day}
                                            onClick={() => {
                                                const days = newStaff.workingDays.includes(day)
                                                    ? newStaff.workingDays.filter(d => d !== day)
                                                    : [...newStaff.workingDays, day];
                                                setNewStaff({ ...newStaff, workingDays: days });
                                            }}
                                            className={`px-3 py-1 text-xs rounded-full border transition-colors ${newStaff.workingDays.includes(day)
                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                                                }`}
                                        >
                                            {day}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={newStaff.password}
                                    onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:opacity-90"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                >
                                    Create Account
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Change Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 dark:text-white">Change Password for {selectedStaff?.username}</h2>
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowPasswordModal(false)}
                                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:opacity-90"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                >
                                    Update Password
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffManagement;
