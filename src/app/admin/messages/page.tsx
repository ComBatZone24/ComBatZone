
"use client";

import React, { useEffect, useState } from 'react';
import { database } from '@/lib/firebase/config';
import { ref, onValue, off, push, serverTimestamp, remove, query, get, update, orderByChild, equalTo } from 'firebase/database';
import { Loader2, Trash2, Send, Users, User, AlertCircle, MessageSquare, BellRing } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import GlassCard from '@/components/core/glass-card';
import PageTitle from '@/components/core/page-title';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { sendGlobalNotification, sendDirectFirebaseNotification, sendGlobalFirebaseNotification } from './actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AdminMessage {
  text: string;
  timestamp: number; // Firebase timestamp is a number
  id: string; 
}

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State for In-App Broadcast
  const [inAppBroadcastText, setInAppBroadcastText] = useState('');
  const [isSendingInApp, setIsSendingInApp] = useState(false);
  
  // State for Global Push (OneSignal)
  const [oneSignalPushText, setOneSignalPushText] = useState('');
  const [isSendingOneSignal, setIsSendingOneSignal] = useState(false);
  
  // State for Global Push (Firebase)
  const [firebasePushText, setFirebasePushText] = useState('');
  const [isSendingFirebase, setIsSendingFirebase] = useState(false);
  
  // State for Direct Message
  const [targetUserIdentifier, setTargetUserIdentifier] = useState('');
  const [directMessageText, setDirectMessageText] = useState('');
  const [isSendingDirect, setIsSendingDirect] = useState(false);

  const [messageToDelete, setMessageToDelete] = useState<AdminMessage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


  const { toast } = useToast();

  useEffect(() => {
    if (!database) {
      console.warn("Firebase database is not initialized.");
      toast({ title: "Error", description: "Database not available.", variant: "destructive" });
      setLoading(false);
      return;
    }

    const messagesRef = ref(database, 'adminMessages');
    const listener = onValue(messagesRef, (snapshot) => {
      const messagesData: AdminMessage[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          messagesData.push({ id: childSnapshot.key!, ...childSnapshot.val() });
        });
      }
      
      const sortedMessages = messagesData.sort((a, b) => {
          const timeA = typeof a.timestamp === 'number' ? a.timestamp : 0;
          const timeB = typeof b.timestamp === 'number' ? b.timestamp : 0;
          return timeB - timeA;
      });

      setMessages(sortedMessages);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching admin messages:", error);
      toast({ title: "Error", description: "Could not load messages.", variant: "destructive" });
      setLoading(false);
    });

    return () => off(messagesRef, 'value', listener);
  }, [toast]);
  
  const handleSendInAppBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inAppBroadcastText.trim()) return;
    setIsSendingInApp(true);
    try {
      if (!database) throw new Error("Firebase not available.");
      await push(ref(database, 'adminMessages'), {
          text: inAppBroadcastText,
          timestamp: serverTimestamp(),
      });
      setInAppBroadcastText(''); 
      toast({ title: "In-App Broadcast Sent", description: "Your message is now visible to all users in their notifications.", className: "bg-green-500/20 text-green-300 border-green-500/30" });
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to send broadcast: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSendingInApp(false);
    }
  };

  const handleSendOneSignalPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oneSignalPushText.trim()) return;
    setIsSendingOneSignal(true);
    try {
        const result = await sendGlobalNotification("New Message from Admin", oneSignalPushText);
        
        if (result.success) {
            setOneSignalPushText('');
            if (result.fallback) {
                toast({ title: "Fallback Successful", description: result.message, variant: "default", className: "bg-blue-500/20 text-blue-300 border-blue-500/30", duration: 8000});
            } else {
                toast({ title: "Push Notification Sent", description: result.message, className: "bg-green-500/20 text-green-300 border-green-500/30" });
            }
        } else {
            throw new Error(result.message);
        }
    } catch (error: any) {
        toast({ title: "Error", description: `Failed to send push notification: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSendingOneSignal(false);
    }
  };
  
  const handleSendFirebasePush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebasePushText.trim()) return;
    setIsSendingFirebase(true);
    try {
      const result = await sendGlobalFirebaseNotification("New Message from Admin", firebasePushText);
      if (result.success) {
          setFirebasePushText('');
          toast({ title: "Firebase Push Sent", description: result.message, className: "bg-green-500/20 text-green-300 border-green-500/30", duration: 7000 });
      } else {
          throw new Error(result.message);
      }
    } catch (error: any) {
       toast({ title: "Firebase Push Error", description: `Failed to send push notification: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSendingFirebase(false);
    }
  };

  const handleSendDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserIdentifier.trim() || !directMessageText.trim() || !database) {
      toast({ title: "Missing Information", description: "Please provide a user identifier and a message.", variant: "destructive" });
      return;
    }
    setIsSendingDirect(true);

    try {
      const usersRef = ref(database, 'users');
      let targetUid: string | null = null;
      let targetUsername: string | null = null;
      
      const emailQuery = query(usersRef, orderByChild('email'), equalTo(targetUserIdentifier));
      const emailSnapshot = await get(emailQuery);

      if (emailSnapshot.exists()) {
        targetUid = Object.keys(emailSnapshot.val())[0];
        targetUsername = emailSnapshot.val()[targetUid].username;
      } else {
        const usernameQuery = query(usersRef, orderByChild('username'), equalTo(targetUserIdentifier));
        const usernameSnapshot = await get(usernameQuery);
        if (usernameSnapshot.exists()) {
          targetUid = Object.keys(usernameSnapshot.val())[0];
          targetUsername = usernameSnapshot.val()[targetUid].username;
        }
      }

      if (!targetUid) {
        toast({ title: "User Not Found", description: "No user found with that email or username.", variant: "destructive" });
        setIsSendingDirect(false);
        return;
      }
      
      const updates: Record<string, any> = {};

      // 1. Send In-App Notification
      const notificationRef = ref(database, `notifications/${targetUid}`);
      const newNotificationKey = push(notificationRef).key;
      updates[`notifications/${targetUid}/${newNotificationKey}`] = {
        text: directMessageText,
        timestamp: serverTimestamp(),
        read: false,
        type: 'admin_message',
      };
      
      // 2. Log message in admin panel (without prefix)
      const adminMessagesRef = ref(database, 'adminMessages');
      const newAdminMessageKey = push(adminMessagesRef).key;
      updates[`adminMessages/${newAdminMessageKey}`] = {
        text: directMessageText,
        timestamp: serverTimestamp(),
      };

      await update(ref(database), updates);
      
      // 3. Send FCM Push Notification
      const pushResult = await sendDirectFirebaseNotification(targetUid, "Message from Admin", directMessageText);
      if (pushResult.success) {
        toast({ title: "Direct Message Sent", description: `In-app message sent to ${targetUsername}. Push notification: ${pushResult.message}`, variant: "default", className: "bg-green-500/20 text-green-300 border-green-500/30" });
      } else {
        toast({ title: "In-App Message Sent, Push Failed", description: `Push notification failed: ${pushResult.message}`, variant: "destructive" });
      }

      setDirectMessageText('');
      setTargetUserIdentifier('');
    } catch (error: any) {
       console.error("Error sending direct message:", error);
       toast({ title: "Send Error", description: "Failed to send direct message.", variant: "destructive" });
    } finally {
      setIsSendingDirect(false);
    }
  };


  const handleDeleteConfirm = async () => {
    if (!messageToDelete || !database) return;

    setIsDeleting(true);
    try {
      await remove(ref(database, `adminMessages/${messageToDelete.id}`));
      toast({ title: "Message Deleted", description: "The global message has been removed.", variant: "default" });
      setMessageToDelete(null); 
    } catch (error: any) {
      console.error("Error deleting message:", error);
      toast({ title: "Deletion Failed", description: "Could not delete message. Check permissions.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="space-y-8">
        <PageTitle title="Communications Log" subtitle="Send messages and view all broadcast, direct, and system notifications." />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <GlassCard>
              <Tabs defaultValue="broadcast_in_app" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="broadcast_in_app"><MessageSquare className="mr-2 h-4 w-4"/>In-App</TabsTrigger>
                  <TabsTrigger value="push_onesignal"><BellRing className="mr-2 h-4 w-4"/>Push (OneSignal)</TabsTrigger>
                  <TabsTrigger value="push_firebase"><BellRing className="mr-2 h-4 w-4"/>Push (Firebase)</TabsTrigger>
                  <TabsTrigger value="direct"><User className="mr-2 h-4 w-4"/>Direct</TabsTrigger>
              </TabsList>

              <TabsContent value="broadcast_in_app" className="pt-4">
                  <form onSubmit={handleSendInAppBroadcast} className="flex flex-col space-y-4">
                      <Textarea placeholder="This message will appear in every user's notification bell inside the app." value={inAppBroadcastText} onChange={(e) => setInAppBroadcastText(e.target.value)} required />
                      <Button type="submit" className="w-full" disabled={!inAppBroadcastText.trim() || isSendingInApp}>
                          {isSendingInApp ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>} Send In-App Broadcast
                      </Button>
                  </form>
              </TabsContent>

              <TabsContent value="push_onesignal" className="pt-4">
                  <form onSubmit={handleSendOneSignalPush} className="flex flex-col space-y-4">
                      <Textarea placeholder="This will send a PUSH NOTIFICATION to all OneSignal subscribers." value={oneSignalPushText} onChange={(e) => setOneSignalPushText(e.target.value)} required />
                      <Button type="submit" className="w-full" disabled={!oneSignalPushText.trim() || isSendingOneSignal}>
                          {isSendingOneSignal ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>} Send Push (OneSignal)
                      </Button>
                  </form>
              </TabsContent>
              
              <TabsContent value="push_firebase" className="pt-4">
                  <form onSubmit={handleSendFirebasePush} className="flex flex-col space-y-4">
                      <Textarea placeholder="This will send a PUSH NOTIFICATION to all Firebase subscribers." value={firebasePushText} onChange={(e) => setFirebasePushText(e.target.value)} required />
                      <Button type="submit" className="w-full" disabled={!firebasePushText.trim() || isSendingFirebase}>
                          {isSendingFirebase ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>} Send Push (Firebase)
                      </Button>
                  </form>
              </TabsContent>

              <TabsContent value="direct" className="pt-4">
                  <form onSubmit={handleSendDirect} className="flex flex-col space-y-4">
                      <Input placeholder="Enter target user's exact username or email" value={targetUserIdentifier} onChange={(e) => setTargetUserIdentifier(e.target.value)} required />
                      <Textarea placeholder="Type your private message to this user here..." value={directMessageText} onChange={(e) => setDirectMessageText(e.target.value)} required />
                      <Button type="submit" className="w-full" disabled={!targetUserIdentifier.trim() || !directMessageText.trim() || isSendingDirect}>
                          {isSendingDirect ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>} Send Direct Message
                      </Button>
                  </form>
              </TabsContent>
              </Tabs>
          </GlassCard>
          
          <GlassCard className="p-0 flex flex-col">
              <div className="p-4 border-b border-border/30">
                  <h3 className="text-lg font-semibold">Communications Log</h3>
                  <p className="text-xs text-muted-foreground">This log shows all outgoing messages.</p>
              </div>
            {loading ? (
              <div className="flex-1 flex justify-center items-center">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
              </div>
            ) : messages.length === 0 ? (
              <p className="flex-1 text-center text-muted-foreground p-10">No messages or notifications sent yet.</p>
            ) : (
              <ScrollArea className="flex-1 max-h-[450px]">
                  <ul className="space-y-2 p-4">
                  {messages.map((message) => (
                      <li key={message.id} className="border-b border-border/40 pb-3">
                        <p className="text-foreground mb-1 whitespace-pre-wrap break-words">{message.text}</p>
                        <div className="flex justify-between items-center">
                            <p className="text-xs text-muted-foreground">
                                {message.timestamp ? format(new Date(message.timestamp), 'PPpp') : 'N/A'}
                            </p>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive" onClick={() => setMessageToDelete(message)} disabled={isDeleting}>
                                      {isDeleting && messageToDelete?.id === message.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
                                  </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="glass-card">
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>This will permanently delete the message "{message.text.substring(0, 30)}...". This action cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setMessageToDelete(null)}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                        </div>
                      </li>
                  ))}
                  </ul>
                  <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </GlassCard>
        </div>
        <Alert variant="default" className="bg-primary/10 border-primary/30">
          <AlertCircle className="h-5 w-5 !text-primary" />
          <AlertTitle className="!text-primary">Important</AlertTitle>
          <AlertDescription className="!text-primary/80 text-sm">
            - **In-App Broadcasts** appear in every user's notification bell.<br/>
            - **Push (OneSignal)** sends a notification via OneSignal to subscribed devices.<br/>
            - **Push (Firebase)** sends a notification via FCM to subscribed devices.<br/>
            - **Direct Messages** are sent privately as an in-app and Firebase push notification. All messages are logged here.
          </AlertDescription>
        </Alert>
      </div>
    </>
  );
}
