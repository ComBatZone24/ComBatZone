
"use client";

import React, { useEffect, useState } from 'react';
import { database } from '@/lib/firebase/config';
import { ref, onValue, off, update, push, runTransaction, remove, serverTimestamp } from 'firebase/database';
import type { ShopOrder, WalletTransaction } from '@/types';
import { Loader2, Package, ShoppingBag, UserCircle as UserIconLucide, Phone as PhoneIconLucide, MapPin as MapPinIconLucide, Home as HomeIconLucide, Edit3, AlertCircle, Truck, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import PageTitle from '@/components/core/page-title';
import GlassCard from '@/components/core/glass-card';
import RupeeIcon from '@/components/core/rupee-icon';
import { format, parseISO, isValid } from 'date-fns';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent as AlertDialogContentDelete, AlertDialogFooter as AlertDialogFooterDelete, AlertDialogHeader as AlertDialogHeaderDelete, AlertDialogTitle as AlertDialogTitleDelete
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const adminSelectableOrderStatuses: Pick<ShopOrder, 'status'>['status'][] = ['pending_fulfillment', 'shipped', 'cancelled'];
const allPossibleOrderStatuses: ShopOrder['status'][] = ['pending_fulfillment', 'shipped', 'delivered', 'cancelled', 'payment_failed'];

const formatOrderStatus = (status: ShopOrder['status']): string => {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const getStatusBadgeClasses = (status: ShopOrder['status']) => {
    switch (status) {
      case 'pending_fulfillment': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'shipped': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'delivered': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'cancelled':
      case 'payment_failed':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default: return '';
    }
  };

export default function AdminShopOrdersPage() {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<ShopOrder | null>(null);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [manageOrderLoading, setManageOrderLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<ShopOrder['status'] | ''>('');
  const [trackingNumber, setTrackingNumber] = useState('');

  useEffect(() => {
    if (!database) {
      setError("Firebase Database not initialized.");
      setIsLoading(false);
      return;
    }

    const ordersRef = ref(database, 'purchaseRequests');
    const listener = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      const allOrders: ShopOrder[] = [];

      if (data) {
        Object.keys(data).forEach(orderId => {
          allOrders.push({ id: orderId, ...data[orderId] });
        });
      }
      allOrders.sort((a, b) => {
        const dateA = a.orderTimestamp && typeof a.orderTimestamp === 'string' ? parseISO(a.orderTimestamp).getTime() : (typeof a.orderTimestamp === 'number' ? a.orderTimestamp : 0);
        const dateB = b.orderTimestamp && typeof b.orderTimestamp === 'string' ? parseISO(b.orderTimestamp).getTime() : (typeof b.orderTimestamp === 'number' ? b.orderTimestamp : 0);
        return dateB - dateA; 
      });
      setOrders(allOrders);
      setIsLoading(false);
      setError(null);
    }, (dbError) => {
      console.error("Error fetching shop orders:", dbError);
      setError("Failed to load shop orders. Please check console for details.");
      setIsLoading(false);
    });

    return () => {
      if (database && ordersRef && typeof listener === 'function') {
        off(ordersRef, 'value', listener);
      }
    };
  }, []);

  const getStatusBadgeVariant = (status: ShopOrder['status']) => {
    switch (status) {
      case 'pending_fulfillment': return 'secondary';
      case 'shipped': return 'default';
      case 'delivered': return 'default'; 
      case 'cancelled': return 'destructive';
      case 'payment_failed': return 'destructive';
      default: return 'outline';
    }
  };

  const handleManageClick = (order: ShopOrder) => {
    setSelectedOrder(order);
    setCurrentStatus(order.status);
    setTrackingNumber(order.trackingNumber || '');
    setIsManageDialogOpen(true);
  };

  const handleSaveChanges = async () => {
    if (!selectedOrder || !database) {
        toast({ title: "Error", description: "No order selected or database not available.", variant: "destructive" });
        return;
    }
    if (!currentStatus) {
        toast({ title: "Validation Error", description: "Please select a status for the order.", variant: "destructive" });
        return;
    }

    setManageOrderLoading(true);
    const updates: Record<string, any> = {};
    const newStatus = currentStatus as ShopOrder['status'];
    const originalStatus = selectedOrder.status;

    try {
      updates[`purchaseRequests/${selectedOrder.id}/status`] = newStatus;
      updates[`purchaseRequests/${selectedOrder.id}/trackingNumber`] = trackingNumber || null;

      if (newStatus === 'cancelled' && originalStatus !== 'cancelled') {
        if (!selectedOrder.walletHoldTransactionId) {
          throw new Error("Cannot process refund: Original hold transaction ID is missing.");
        }
        const userWalletRef = ref(database, `users/${selectedOrder.userId}/wallet`);
        const refundResult = await runTransaction(userWalletRef, (currentBalance) => {
          return (Number(currentBalance) || 0) + selectedOrder.productPrice;
        });

        if (!refundResult.committed) {
          throw new Error("Failed to refund amount to user's wallet. Please check user's balance manually.");
        }

        updates[`walletTransactions/${selectedOrder.userId}/${selectedOrder.walletHoldTransactionId}/status`] = 'refunded';

        const refundTransactionData: Omit<WalletTransaction, 'id'> = {
          type: 'refund',
          amount: selectedOrder.productPrice, 
          status: 'completed',
          date: new Date().toISOString(),
          description: `Refund for cancelled order: ${selectedOrder.productName}`,
          relatedOrderId: selectedOrder.id,
        };
        await push(ref(database, `walletTransactions/${selectedOrder.userId}`), refundTransactionData);
        
        const cancelledNotificationText = `Your order for "${selectedOrder.productName}" has been cancelled. The amount has been refunded to your wallet. Please contact support for more information.`;
        await push(ref(database, `notifications/${selectedOrder.userId}`), {
            text: cancelledNotificationText,
            timestamp: serverTimestamp(),
            read: false,
            type: 'order_cancelled'
        });

        const adminLogTextCancelled = `[To: ${selectedOrder.username}] ${cancelledNotificationText}`;
        await push(ref(database, 'adminMessages'), {
            text: adminLogTextCancelled,
            timestamp: serverTimestamp(),
        });

        toast({ title: "Order Cancelled & Refunded", description: `Order ${selectedOrder.id.substring(0,8)}... cancelled. Rs ${selectedOrder.productPrice.toFixed(2)} refunded and user notified.`, variant: "default", className:"bg-blue-500/20 text-blue-300 border-blue-500/30" });

      } else if (newStatus === 'shipped') {
        if (selectedOrder.walletHoldTransactionId) {
          updates[`walletTransactions/${selectedOrder.userId}/${selectedOrder.walletHoldTransactionId}/status`] = 'completed';
        } else {
           console.warn(`Order ${selectedOrder.id} marked as shipped but missing walletHoldTransactionId. Cannot update hold transaction status.`);
        }
        
        const shippedNotificationText = `Your order for "${selectedOrder.productName}" has been shipped! ${trackingNumber ? `Tracking number: ${trackingNumber}` : 'It will be delivered soon.'}`;
        await push(ref(database, `notifications/${selectedOrder.userId}`), {
            text: shippedNotificationText,
            timestamp: serverTimestamp(),
            read: false,
            type: 'order_shipped'
        });

        const adminLogTextShipped = `[To: ${selectedOrder.username}] ${shippedNotificationText}`;
        await push(ref(database, 'adminMessages'), {
            text: adminLogTextShipped,
            timestamp: serverTimestamp(),
        });

        if (selectedOrder.walletHoldTransactionId) {
            toast({ title: "Order Shipped", description: `Order ${selectedOrder.id.substring(0,8)}... shipped. Tracking: ${trackingNumber || 'N/A'}. User has been notified.`, variant: "default", className:"bg-green-500/20 text-green-300 border-green-500/30" });
        } else {
            toast({ title: "Order Shipped (Warning)", description: `Order ${selectedOrder.id.substring(0,8)}... shipped and user notified. Note: Original payment hold record was not found.`, variant: "default" });
        }
      } else if (newStatus !== originalStatus || trackingNumber !== (selectedOrder.trackingNumber || '')) {
        toast({ title: "Order Updated", description: `Order ${selectedOrder.id.substring(0,8)}... status changed to ${formatOrderStatus(newStatus)}. Tracking: ${trackingNumber || 'N/A'}.`, variant: "default" });
      }
      
      await update(ref(database), updates);
      setIsManageDialogOpen(false);

    } catch (err: any) {
      console.error("Error updating order:", err);
      toast({ title: "Update Failed", description: `Could not save order changes: ${err.message}`, variant: "destructive" });
    } finally {
      setManageOrderLoading(false);
    }
  };

  const handleDeleteClick = (orderId: string) => {
    setDeletingOrderId(orderId);
  };

  const handleConfirmDelete = async () => {
    if (!deletingOrderId || !database) {
        toast({ title: "Error", description: "No order selected for deletion or database not available.", variant: "destructive" });
        setDeletingOrderId(null);
        return;
    }
    setIsProcessingDelete(true);
    try {
      await remove(ref(database, `purchaseRequests/${deletingOrderId}`));
      toast({ title: "Order Deleted", description: `Order ${deletingOrderId.substring(0,8)}... has been removed.`, variant: "default" });
    } catch (err: any) {
      console.error("Error deleting order:", err);
      toast({ title: "Deletion Failed", description: `Could not delete order: ${err.message}`, variant: "destructive" });
    } finally {
      setDeletingOrderId(null);
      setIsProcessingDelete(false);
    }
  };

  const hasChangesInDialog = selectedOrder && (currentStatus !== selectedOrder.status || trackingNumber !== (selectedOrder.trackingNumber || ''));

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-10 w-10 animate-spin text-accent" />
        <p className="ml-3 text-muted-foreground">Loading shop orders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <GlassCard className="p-6 text-center">
        <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Orders</h2>
        <p className="text-muted-foreground">{error}</p>
      </GlassCard>
    );
  }

  return (
    <div className="flex h-full flex-col space-y-6">
      <PageTitle title="Customer Shop Orders" subtitle="View and manage product purchase requests." />
      <GlassCard className="p-0 flex flex-1 flex-col overflow-hidden">
        <div className="p-4 border-b border-border/30"> 
          <h3 className="text-lg font-semibold text-foreground">All Orders ({orders.length})</h3>
        </div>
        {orders.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center items-center p-10 text-center text-muted-foreground">
            <Package className="h-16 w-16 text-muted-foreground/50 mb-4" />
            No shop orders found yet.
          </div>
        ) : (
          <div className="flex-1">
             {/* Desktop Table View */}
             <div className="hidden md:block relative h-full">
                <ScrollArea className="absolute inset-0">
                  <Table className="min-w-[900px]">
                    <TableHeader>
                      <TableRow className="border-b-border/50 sticky top-0 bg-card/80 backdrop-blur-sm z-10">
                        <TableHead>Order ID</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center w-[130px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map(order => (
                        <TableRow key={order.id} className="border-b-border/20 hover:bg-muted/20">
                          <TableCell className="font-mono text-xs" title={order.id}>{order.id.substring(0, 8)}...</TableCell>
                          <TableCell>
                            <Link href={`/admin/users/${order.userId}`} className="hover:text-accent hover:underline">
                              {order.username}
                            </Link>
                            <p className="text-xs text-muted-foreground" title={order.userId}>UID: {order.userId.substring(0,8)}...</p>
                          </TableCell>
                          <TableCell>
                            {order.productName}
                            <p className="text-xs text-muted-foreground" title={order.productId}>PID: {order.productId.substring(0,8)}...</p>
                          </TableCell>
                          <TableCell className="text-right">
                            <RupeeIcon className="inline h-3.5 -mt-0.5"/> {order.productPrice.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {order.orderTimestamp && typeof order.orderTimestamp === 'string' && isValid(parseISO(order.orderTimestamp)) 
                              ? format(parseISO(order.orderTimestamp), "dd MMM, hh:mm a") 
                              : (typeof order.orderTimestamp === 'number' 
                                  ? format(new Date(order.orderTimestamp), "dd MMM, hh:mm a")
                                  : 'N/A')}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={getStatusBadgeVariant(order.status)} className={getStatusBadgeClasses(order.status)}>
                              <span>{formatOrderStatus(order.status)}</span>
                            </Badge>
                          </TableCell>                      
                          <TableCell className="text-center">
                            <Button variant="outline" size="sm" onClick={() => handleManageClick(order)}>
                              <Edit3 className="h-3.5 w-3.5" /> <span className="sr-only sm:not-sr-only sm:ml-1.5">Manage</span>
                            </Button> 
                            <Button
                              variant="destructive"
                              size="sm"
                              className="ml-2"
                              onClick={() => handleDeleteClick(order.id)}
                              disabled={isProcessingDelete && deletingOrderId === order.id}
                            >
                               {isProcessingDelete && deletingOrderId === order.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" /> 
                                )} 
                                <span className="sr-only sm:not-sr-only sm:ml-1.5">Delete</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
             </div>
             {/* Mobile Card View */}
             <div className="md:hidden">
                <ScrollArea className="h-full">
                    <div className="p-4 space-y-4">
                        {orders.map(order => (
                            <GlassCard key={order.id} className="p-4 bg-card/80">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="font-semibold text-foreground">{order.productName}</p>
                                        <p className="text-xs text-muted-foreground font-mono" title={order.id}>#{order.id.substring(0, 8)}...</p>
                                    </div>
                                    <Badge variant={getStatusBadgeVariant(order.status)} className={getStatusBadgeClasses(order.status)}>
                                      <span>{formatOrderStatus(order.status)}</span>
                                    </Badge>
                                </div>
                                <Separator className="mb-2 bg-border/50" />
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">User:</span>
                                        <span className="font-medium text-foreground">{order.username}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Price:</span>
                                        <span className="font-medium text-foreground"><RupeeIcon className="inline h-3.5"/> {order.productPrice.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Date:</span>
                                        <span className="font-medium text-foreground text-xs">
                                          {order.orderTimestamp && typeof order.orderTimestamp === 'string' && isValid(parseISO(order.orderTimestamp)) 
                                            ? format(parseISO(order.orderTimestamp), "dd MMM, hh:mm a") 
                                            : 'N/A'}
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-border/50 flex gap-2">
                                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleManageClick(order)}>Manage</Button>
                                    <Button variant="destructive" size="sm" className="flex-1" onClick={() => handleDeleteClick(order.id)}>Delete</Button>
                                </div>
                            </GlassCard>
                        ))}
                    </div>
                </ScrollArea>
             </div>
          </div>
        )}
      </GlassCard>
      <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
        {selectedOrder && (
          <DialogContent className="glass-card sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl text-accent flex items-center">
                <Package className="mr-2" /> Manage Order: #{selectedOrder.id.substring(0, 8)}...
              </DialogTitle>
              <DialogDescription>
                  Update status and shipping details. Original Status: <Badge variant={getStatusBadgeVariant(selectedOrder.status)} className={getStatusBadgeClasses(selectedOrder.status)}>{formatOrderStatus(selectedOrder.status)}</Badge>
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] p-1 -m-1">
              <div className="space-y-4 py-4 pr-2">
                <GlassCard className="p-4 bg-background/30 border-border/50">
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1">Customer & Product</h4>
                  <Separator className="mb-2 bg-border/20" />
                  <p className="text-sm"><strong>User:</strong> {selectedOrder.username} ({selectedOrder.userId.substring(0,8)}...)</p>
                  <p className="text-sm"><strong>Product:</strong> {selectedOrder.productName}</p>
                  <p className="text-sm"><strong>Price:</strong> <RupeeIcon className="inline h-3.5"/> {selectedOrder.productPrice.toFixed(2)}</p>
                  <p className="text-sm"><strong>Order Date:</strong> {selectedOrder.orderTimestamp && typeof selectedOrder.orderTimestamp === 'string' && isValid(parseISO(selectedOrder.orderTimestamp)) ? format(parseISO(selectedOrder.orderTimestamp), "PPpp") : (typeof selectedOrder.orderTimestamp === 'number' ? format(new Date(selectedOrder.orderTimestamp), "PPpp") : 'N/A')}</p>
                </GlassCard>

                <GlassCard className="p-4 bg-background/30 border-border/50">
                    <h4 className="font-semibold text-sm text-muted-foreground mb-1">Shipping Address</h4>
                    <Separator className="mb-2 bg-border/20" />
                    <p className="text-sm"><strong>Name:</strong> {selectedOrder.shippingDetails.fullName}</p>
                    <p className="text-sm"><strong>Address:</strong> {selectedOrder.shippingDetails.address}</p>
                    <p className="text-sm"><strong>City:</strong> {selectedOrder.shippingDetails.city}, {selectedOrder.shippingDetails.postalCode}</p>
                    <p className="text-sm"><strong>Phone:</strong> {selectedOrder.shippingDetails.phone}</p>
                </GlassCard>

                <div className="space-y-2">
                  <Label htmlFor="orderStatus" className="text-muted-foreground">Set New Order Status</Label>
                  <Select value={currentStatus} onValueChange={(value) => setCurrentStatus(value as ShopOrder['status'])}>
                    <SelectTrigger id="orderStatus" className="bg-input/50 border-border/70 focus:border-accent">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent className="glass-card">
                      {adminSelectableOrderStatuses.map(status => (
                        <SelectItem key={status} value={status}>
                          {formatOrderStatus(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trackingNumber" className="text-muted-foreground">
                    <Truck className="inline mr-1.5 h-4 w-4" /> Shipping Tracking Number
                  </Label>
                  <Input
                    id="trackingNumber"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Enter tracking number (optional)"
                    className="bg-input/50 border-border/70 focus:border-accent"
                    disabled={currentStatus === 'cancelled'}
                  />
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button variant="outline" className="border-muted-foreground text-muted-foreground hover:bg-muted/20" disabled={manageOrderLoading}>Close</Button>
              </DialogClose>
              <Button 
                onClick={handleSaveChanges} 
                className="neon-accent-bg" 
                disabled={manageOrderLoading || !currentStatus || !hasChangesInDialog}
              >
                {manageOrderLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    
     <AlertDialog open={deletingOrderId !== null} onOpenChange={(open) => !open && setDeletingOrderId(null)}>
      <AlertDialogContentDelete className="glass-card">
        {orders.find(o => o.id === deletingOrderId) && (
          <>
          <AlertDialogHeaderDelete>
              <AlertDialogTitleDelete className="text-red-400 flex items-center"><AlertCircle className="mr-2"/> Confirm Deletion</AlertDialogTitleDelete>
              <AlertDialogDescriptionDelete>
              Are you sure you want to delete order for "{orders.find(o => o.id === deletingOrderId)?.productName}" (ID: {deletingOrderId?.substring(0,8)}...)?
              {orders.find(o => o.id === deletingOrderId)?.status === 'pending_fulfillment' && (
                  <span className="block mt-2 font-semibold text-yellow-400">
                  Warning: This order is pending fulfillment. Deleting this record will NOT automatically refund the user.
                  To refund, please 'Manage' the order and set its status to 'Cancelled'.
                  </span>
              )}
              This action cannot be undone.
              </AlertDialogDescriptionDelete>
          </AlertDialogHeaderDelete>
          <AlertDialogFooterDelete>
              <AlertDialogCancel className="border-muted-foreground text-muted-foreground hover:bg-muted/20" disabled={isProcessingDelete}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700" disabled={isProcessingDelete}>
               {isProcessingDelete ? <Loader2 className="animate-spin mr-2"/> : null}
              Delete
              </AlertDialogAction>
          </AlertDialogFooterDelete>
          </>
        )}
      </AlertDialogContentDelete>
    </AlertDialog>
    </div>
  );
}
