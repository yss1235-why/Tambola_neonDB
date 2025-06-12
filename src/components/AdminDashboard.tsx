// src/components/AdminDashboard.tsx - Complete file with Option 1 implementation
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Key, 
  Calendar,
  UserCheck,
  UserX,
  Mail,
  User,
  Phone
} from 'lucide-react';
import { 
  firebaseService, 
  HostUser, 
  AdminUser 
} from '@/services/firebase';

interface AdminDashboardProps {
  user: AdminUser;
}

interface CreateHostForm {
  name: string;
  email: string;
  phone: string;
  password: string;
  subscriptionMonths: number;
}

interface EditHostForm {
  name: string;
  email: string;
  phone: string;
  subscriptionMonths: number;
  isActive: boolean;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const [hosts, setHosts] = useState<HostUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedHost, setSelectedHost] = useState<HostUser | null>(null);

  const [createForm, setCreateForm] = useState<CreateHostForm>({
    name: '',
    email: '',
    phone: '',
    password: '',
    subscriptionMonths: 12
  });

  const [editForm, setEditForm] = useState<EditHostForm>({
    name: '',
    email: '',
    phone: '',
    subscriptionMonths: 12,
    isActive: true
  });

  const [newPassword, setNewPassword] = useState('');

  // Load hosts
  const loadHosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const hostsList = await firebaseService.getAllHosts();
      setHosts(hostsList);
    } catch (error: any) {
      console.error('Failed to load hosts:', error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load hosts on component mount
  useEffect(() => {
    loadHosts();
    
    // Subscribe to real-time hosts updates
    const unsubscribe = firebaseService.subscribeToHosts((updatedHosts) => {
      if (updatedHosts) {
        setHosts(updatedHosts);
      }
    });

    return () => unsubscribe();
  }, [loadHosts]);

  // OPTION 1 IMPLEMENTATION: Handle create host with credential switch
  const handleCreateHost = async () => {
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.phone.trim() || !createForm.password.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      await firebaseService.createHost(
        createForm.email,
        createForm.password,
        createForm.name,
        createForm.phone,
        user.uid,
        createForm.subscriptionMonths
      );

    } catch (error: any) {
      if (error.message.startsWith('SUCCESS:')) {
        // Host created successfully
        setShowCreateDialog(false);
        setCreateForm({ name: '', email: '', phone: '', password: '', subscriptionMonths: 12 });
        alert(error.message);
        // User will be automatically logged out and redirected to login
      } else {
        // Real error
        console.error('Create host error:', error);
        alert(error.message || 'Failed to create host');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditHost = async () => {
    if (!selectedHost) return;

    setIsLoading(true);
    try {
      const subscriptionEndDate = new Date();
      subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + editForm.subscriptionMonths);

      await firebaseService.updateHost(selectedHost.uid, {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        isActive: editForm.isActive,
        subscriptionEndDate: subscriptionEndDate.toISOString(),
        updatedAt: new Date().toISOString()
      });

      setShowEditDialog(false);
      setSelectedHost(null);
      
    } catch (error: any) {
      console.error('Update host error:', error);
      alert(error.message || 'Failed to update host');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteHost = async (host: HostUser) => {
    const confirmed = window.confirm(`Are you sure you want to delete ${host.name}? This action cannot be undone.`);
    if (!confirmed) return;

    setIsLoading(true);
    try {
      await firebaseService.deleteHost(host.uid);
    } catch (error: any) {
      console.error('Delete host error:', error);
      alert(error.message || 'Failed to delete host');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!selectedHost || !newPassword.trim()) {
      alert('Please enter a valid password');
      return;
    }

    setIsLoading(true);
    try {
      await firebaseService.changeHostPassword(selectedHost.uid, newPassword);
      
      setShowPasswordDialog(false);
      setSelectedHost(null);
      setNewPassword('');
      
    } catch (error: any) {
      console.error('Change password error:', error);
      alert(error.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtendSubscription = async (host: HostUser, additionalMonths: number) => {
    setIsLoading(true);
    try {
      await firebaseService.extendHostSubscription(host.uid, additionalMonths);
    } catch (error: any) {
      console.error('Extend subscription error:', error);
      alert(error.message || 'Failed to extend subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (host: HostUser) => {
    setIsLoading(true);
    try {
      await firebaseService.toggleHostStatus(host.uid, !host.isActive);
    } catch (error: any) {
      console.error('Toggle status error:', error);
      alert(error.message || 'Failed to update status');
    } finally {
      setIsLoading(false);
    }
  };

  const openEditDialog = (host: HostUser) => {
    const subscriptionEnd = new Date(host.subscriptionEndDate);
    const now = new Date();
    const monthsLeft = Math.max(0, Math.ceil((subscriptionEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));

    setSelectedHost(host);
    setEditForm({
      name: host.name,
      email: host.email,
      phone: host.phone || '',
      subscriptionMonths: monthsLeft,
      isActive: host.isActive
    });
    setShowEditDialog(true);
  };

  const openPasswordDialog = (host: HostUser) => {
    setSelectedHost(host);
    setNewPassword('');
    setShowPasswordDialog(true);
  };

  const getSubscriptionStatus = useCallback((host: HostUser) => {
    const subscriptionEnd = new Date(host.subscriptionEndDate);
    const now = new Date();
    const daysLeft = Math.ceil((subscriptionEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) return { status: 'expired', text: 'Expired', variant: 'destructive' as const };
    if (daysLeft <= 7) return { status: 'expiring', text: `${daysLeft} days left`, variant: 'secondary' as const };
    return { status: 'active', text: `${daysLeft} days left`, variant: 'default' as const };
  }, []);

  const activeHosts = hosts.filter(h => h.isActive).length;
  const expiredHosts = hosts.filter(h => new Date(h.subscriptionEndDate) < new Date()).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Admin Dashboard</h1>
            <p className="text-slate-600">Manage host accounts and user access</p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Host
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Hosts</p>
                  <p className="text-2xl font-bold">{hosts.length}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Hosts</p>
                  <p className="text-2xl font-bold text-green-600">{activeHosts}</p>
                </div>
                <UserCheck className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Inactive Hosts</p>
                  <p className="text-2xl font-bold text-gray-600">{hosts.length - activeHosts}</p>
                </div>
                <UserX className="w-8 h-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Expired</p>
                  <p className="text-2xl font-bold text-red-600">{expiredHosts}</p>
                </div>
                <Calendar className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Hosts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Host Management</CardTitle>
          </CardHeader>
          <CardContent>
            {hosts.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No hosts created yet</p>
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  className="mt-4"
                  variant="outline"
                >
                  Create First Host
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Host Details</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Subscription</th>
                      <th className="text-left p-3">Created</th>
                      <th className="text-left p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hosts.map((host) => {
                      const subscription = getSubscriptionStatus(host);
                      return (
                        <tr key={host.uid} className="border-b hover:bg-gray-50">
                          <td className="p-3">
                            <div className="flex items-center space-x-3">
                              <div className="bg-blue-100 p-2 rounded-full">
                                <User className="w-4 h-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium">{host.name}</p>
                                <p className="text-sm text-gray-600">{host.email}</p>
                                {host.phone && (
                                  <p className="text-xs text-gray-500 flex items-center">
                                    <Phone className="w-3 h-3 mr-1" />
                                    {host.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge 
                              variant={host.isActive ? "default" : "secondary"}
                              className="cursor-pointer"
                              onClick={() => handleToggleStatus(host)}
                            >
                              {host.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="space-y-1">
                              <Badge variant={subscription.variant}>
                                {subscription.text}
                              </Badge>
                              <div className="flex space-x-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleExtendSubscription(host, 1)}
                                  className="text-xs"
                                >
                                  +1M
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleExtendSubscription(host, 6)}
                                  className="text-xs"
                                >
                                  +6M
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleExtendSubscription(host, 12)}
                                  className="text-xs"
                                >
                                  +1Y
                                </Button>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <p className="text-sm text-gray-600">
                              {new Date(host.createdAt).toLocaleDateString()}
                            </p>
                          </td>
                          <td className="p-3">
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditDialog(host)}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openPasswordDialog(host)}
                              >
                                <Key className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteHost(host)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Host Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Host</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  After creating the host, you will be logged out automatically. Please log back in as admin to continue.
                </AlertDescription>
              </Alert>
              <div>
                <Label htmlFor="host-name">Name</Label>
                <Input
                  id="host-name"
                  placeholder="Enter host name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="host-email">Email</Label>
                <Input
                  id="host-email"
                  type="email"
                  placeholder="Enter email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="host-phone">Phone Number</Label>
                <Input
                  id="host-phone"
                  type="tel"
                  placeholder="Enter phone number (e.g., 919876543210)"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="host-password">Password</Label>
                <Input
                  id="host-password"
                  type="password"
                  placeholder="Enter password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="subscription-months">Subscription (Months)</Label>
                <Input
                  id="subscription-months"
                  type="number"
                  min="1"
                  max="60"
                  value={createForm.subscriptionMonths}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, subscriptionMonths: parseInt(e.target.value) || 12 }))}
                />
              </div>
              <Button
                onClick={handleCreateHost}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Creating Host...' : 'Create Host Account'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Host Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Host</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">Phone Number</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-subscription">Subscription (Months from now)</Label>
                <Input
                  id="edit-subscription"
                  type="number"
                  min="1"
                  max="60"
                  value={editForm.subscriptionMonths}
                  onChange={(e) => setEditForm(prev => ({ ...prev, subscriptionMonths: parseInt(e.target.value) || 12 }))}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-active"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm(prev => ({ ...prev, isActive: e.target.checked }))}
                />
                <Label htmlFor="edit-active">Active Account</Label>
              </div>
              <Button
                onClick={handleEditHost}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Updating...' : 'Update Host'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Change Password Dialog */}
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Change Password</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Changing password for: <strong>{selectedHost?.name}</strong>
                </AlertDescription>
              </Alert>
              <div>
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <Button
                onClick={handleChangePassword}
                disabled={isLoading || !newPassword.trim()}
                className="w-full"
              >
                {isLoading ? 'Changing...' : 'Change Password'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
