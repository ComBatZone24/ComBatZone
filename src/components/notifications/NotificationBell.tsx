
"use client";

import { Bell, Users, Truck, XCircle, MessagesSquare, UserCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger
} from "@/components/ui/dialog";
import { database } from '@/lib/firebase/config';
import { ref, onValue, off, update } from 'firebase/database';
import React, { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { UserNotification } from '@/types';
import { useAuth } from '@/context/AuthContext';

// props for styling
interface NotificationBellProps {
  className?: string;
  isFloating?: boolean;
}

export default function NotificationBell({ className, isFloating = false }: NotificationBellProps) {
  const { user: appUser } = useAuth();
  
  const [adminMessages, setAdminMessages] = useState<any[]>([]);
  const [userNotifications, setUserNotifications] = useState<UserNotification[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  useEffect(() => {
    if (!database || !appUser || !appUser.id) { 
      setIsLoadingMessages(false);
      setAdminMessages([]);
      setUserNotifications([]);
      return;
    }

    setIsLoadingMessages(true);
    const globalMessagesRef = ref(database, 'adminMessages');
    const directMessagesRef = ref(database, `notifications/${appUser.id}`);

    const unsubscribeGlobal = onValue(globalMessagesRef, (snapshot) => {
      const messagesList = snapshot.exists() ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...(data as object) })) : [];
      setAdminMessages(messagesList.reverse());
    }, (error) => console.error("Error fetching global messages:", error));

    const unsubscribeDirect = onValue(directMessagesRef, (snapshot) => {
      const messagesList = snapshot.exists() ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...(data as object) })) : [];
      setUserNotifications(messagesList as UserNotification[]);
    }, (error) => console.error("Error fetching direct messages:", error));

    setIsLoadingMessages(false);

    return () => {
      off(globalMessagesRef, 'value', unsubscribeGlobal);
      off(directMessagesRef, 'value', unsubscribeDirect);
    };
  }, [appUser]);

  useEffect(() => {
    if (!appUser) return;
    const hasUnreadGlobal = adminMessages.some(m => !m.readBy?.[appUser.id]);
    const hasUnreadDirect = userNotifications.some(n => !n.read);
    setHasUnreadMessages(hasUnreadGlobal || hasUnreadDirect);
  }, [adminMessages, userNotifications, appUser]);

  useEffect(() => {
    if (isNotificationsOpen && appUser && database && hasUnreadMessages) {
      const updates: any = {};
      const unreadGlobal = adminMessages.filter(m => !m.readBy?.[appUser.id]);
      const unreadDirect = userNotifications.filter(n => !n.read);

      unreadGlobal.forEach(m => { updates[`adminMessages/${m.id}/readBy/${appUser.id}`] = true; });
      unreadDirect.forEach(n => { updates[`notifications/${appUser.id}/${n.id}/read`] = true; });

      if (Object.keys(updates).length > 0) {
        update(ref(database), updates).catch(err => console.error("Error marking messages as read:", err));
      }
    }
  }, [isNotificationsOpen, appUser, database, adminMessages, userNotifications, hasUnreadMessages]);
  
  const combinedMessages = useMemo(() => {
    const global = adminMessages.map(m => ({ ...m, source: 'global' }));
    const direct = userNotifications.map(n => ({ ...n, source: 'direct' }));
    return [...global, ...direct].sort((a,b) => {
      const timeA = typeof a.timestamp === 'number' ? a.timestamp : 0;
      const timeB = typeof b.timestamp === 'number' ? b.timestamp : 0;
      return timeB - timeA;
    });
  }, [adminMessages, userNotifications]);

  const getNotificationHeader = (message: any) => {
    if (message.source === 'global') {
      return { icon: Users, text: 'Broadcast' };
    }
    
    switch (message.type) {
      case 'order_shipped':
        return { icon: Truck, text: 'Order Shipped' };
      case 'order_cancelled':
        return { icon: XCircle, text: 'Order Cancelled' };
      case 'admin_message':
        return { icon: MessagesSquare, text: 'Admin Message' };
      default:
        return { icon: UserCircle, text: 'Notification' };
    }
  };

  return (
    <Dialog open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
      <DialogTrigger asChild>
        <Button variant={isFloating ? "default" : "ghost"} size="icon" className={cn(
          "relative",
          isFloating ? "h-12 w-12 rounded-full shadow-lg neon-accent-bg" : "h-9 w-9",
          className
        )}>
          {hasUnreadMessages && <span className="absolute top-1 right-1 h-3 w-3 rounded-full bg-red-500 animate-pulse border-2 border-background"></span>}
          <Bell className={cn("text-accent", isFloating && "h-6 w-6 text-white")} />
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-accent">Notifications</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">Messages from administrators.</DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-3 max-h-96 overflow-y-auto pr-2">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>
          ) : combinedMessages.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">No new notifications.</p>
          ) : (
            combinedMessages.map(message => {
              const isUnread = message.source === 'global' ? !message.readBy?.[appUser?.id || ""] : !message.read;
              const { icon: Icon, text: title } = getNotificationHeader(message);
              return (
                <div
                  key={message.id}
                  className={cn("p-3 rounded-md border text-sm", isUnread ? "bg-blue-500/10 border-blue-500/30 text-foreground" : "bg-muted/10 border-border/30 text-muted-foreground")}
                >
                  <div className="flex items-center text-xs mb-1">
                    <Icon className="h-4 w-4 mr-1.5" />
                    <span>{title}</span>
                  </div>
                  <p className="font-medium text-foreground">{message.text}</p>
                  <p className="text-xs mt-1">{new Date(message.timestamp).toLocaleString()}</p>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
