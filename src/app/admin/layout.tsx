
"use client";

import type React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { adminNavItems } from '@/config/nav';
import {
  SidebarProvider,
  Sidebar,
 SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
 DropdownMenu, 
 DropdownMenuContent, 
 DropdownMenuItem, 
 DropdownMenuLabel, 
 DropdownMenuSeparator, 
 DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { SheetTitle } from '@/components/ui/sheet';
import { NotepadText, PanelLeft, LogOut, UserCircle, Home, Loader2, LoaderCircle } from 'lucide-react';
import { auth, database } from '@/lib/firebase/config';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { User as AppUserType } from '@/types';
import { get, ref, onValue } from 'firebase/database';
import Image from 'next/image';
import { getDisplayableBannerUrl } from '@/lib/image-helper';
import AdminStickyNote from '@/components/admin/AdminStickyNote';


const AdminUserNav = () => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toggleSidebar, state } = useSidebar();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
 }
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        if (!database) {
          console.warn("AdminUserNav: Firebase Database not available. Cannot fetch full user details.");
          setAppUser(null);
          setIsLoading(false);
          return;
        }
 try {
          const userRef = ref(database, `users/${user.uid}`);
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            setAppUser({ id: user.uid, ...snapshot.val() } as AppUserType);
          } else {
            console.warn(`AdminUserNav: User data not found in DB for UID ${user.uid}.`);
            setAppUser(null); 
          }
 } catch (error) {
          const errorMessage = String(error instanceof Error ? error.message : error).toUpperCase();
          if (errorMessage.includes('PERMISSION_DENIED')) {
            console.warn(
              `AdminUserNav: Permission denied while fetching user data for UID ${user.uid}. ` +
              `Ensure Firebase Realtime Database security rules allow reading '/users/${user.uid}'.`
            );
          } else {
            console.error("AdminUserNav: Error fetching user details from RTDB:", error);
          }
          setAppUser(null);
        }
      } else {
        setAppUser(null);
      }
      setIsLoading(false);
    });
 return () => unsubscribe();
  }, []);


  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      // Force a full page navigation to ensure a clean state
      window.location.assign('/auth/login');
    } catch (error) {
      console.error("Logout Error:", error);
      toast({
        title: "Logout Failed",
        description: "An error occurred during logout. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const displayName = appUser?.username || firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || "Admin";
  const avatarFallback = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2">
 <Button 
        variant="outline" 
        size="icon" 
        className="h-9 w-9" 
        onClick={toggleSidebar} 
        title={state === 'expanded' ? 'Collapse Sidebar' : 'Expand Sidebar'}
      >
         <PanelLeft className={cn("h-5 w-5 transition-transform", state === 'expanded' && 'rotate-180')} />
 <span className="sr-only">{state === 'expanded' ? 'Collapse Sidebar' : 'Expand Sidebar'}</span>
 </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full">
             {isLoading ? (
               <Loader2 className="h-5 w-5 animate-spin"/>
             ) : (
                <Avatar className="h-9 w-9 border-2 border-accent">
                  <AvatarImage src={appUser?.avatarUrl || firebaseUser?.photoURL || undefined} alt={displayName} />
                  <AvatarFallback>{avatarFallback}</AvatarFallback>
                </Avatar>
             )}
          </Button>
        </DropdownMenuTrigger>
        {!isLoading && firebaseUser && (
          <DropdownMenuContent className="w-56 glass-card" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{displayName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {appUser?.role === 'admin' ? 'Administrator' : appUser?.role === 'delegate' ? 'Delegate' : firebaseUser.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <UserCircle className="mr-2 h-4 w-4" />
                <span>View Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
                <Link href="/">
                    <Home className="mr-2 h-4 w-4" />
                    <span>User View</span>
                </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
 <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        )}
      </DropdownMenu>
    </div>
  );
};

function AdminSidebarNav({ appUser, isNoteVisible, onShowNote }: { appUser: AppUserType | null, isNoteVisible: boolean, onShowNote: () => void }) {
  const pathname = usePathname();
  const { state, isMobile } = useSidebar();
  const [appName, setAppName] = useState('Arena Ace');
  const [appLogoUrl, setAppLogoUrl] = useState('');

  useEffect(() => {
    if (!database) return;
    const settingsRef = ref(database, 'globalSettings');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
        if (snapshot.exists()) {
            const settings = snapshot.val();
            setAppName(settings.appName || 'Arena Ace');
            setAppLogoUrl(settings.appLogoUrl || '');
        } else {
            setAppName('Arena Ace'); // Fallback
            setAppLogoUrl(''); // Fallback
        }
    });
    return () => unsubscribe();
  }, []);
  
  const visibleNavItems = adminNavItems.filter(item => {
    if (!item.permissionKey) return false; // Should not happen if configured correctly
    if (appUser?.role === 'admin') {
      return true;
    }
    if (appUser?.role === 'delegate') {
      return appUser.delegatePermissions?.accessScreens?.[item.permissionKey];
    }
    return false; // Other roles see nothing
  });

  const displayLogoUrl = getDisplayableBannerUrl(appLogoUrl);
  const logoIsCustom = appLogoUrl && displayLogoUrl && !displayLogoUrl.includes('placehold.co');

  return (
    <>
      <SidebarHeader className={cn(
          "p-2 h-16 flex items-center transition-all duration-300 ease-in-out",
          state === 'expanded' ? "px-4" : "justify-center px-2"
        )}>
        {isMobile && <SheetTitle className="sr-only">Admin Navigation</SheetTitle>}
        <Link href="/admin/dashboard" className="flex items-center gap-2 shrink-0">
         {logoIsCustom ? (
           <Image src={displayLogoUrl} alt={appName || "App Logo"} width={28} height={28} className="h-7 w-7" />
         ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-accent">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
          </svg>
         )}
          {state === 'expanded' && (
            <span className="text-lg font-semibold text-sidebar-foreground whitespace-nowrap">
              {appName} <span className="text-xs text-muted-foreground/80">Admin</span>
            </span>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent className="mt-2 flex flex-col justify-between">
        <SidebarMenu className="flex-grow">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
            return (
              <SidebarMenuItem key={item.title}>
                <Link href={item.href} legacyBehavior passHref>
                 <SidebarMenuButton 
                    isActive={isActive} 
                    className="w-full justify-start" 
                    tooltip={state === 'collapsed' ? item.title : undefined}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {state === 'expanded' && (
                      <span className="ml-3 truncate">{item.title}</span>
                    )}
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>

        {!isNoteVisible && (
            <div className="mt-auto pt-2 border-t border-sidebar-border">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton 
                            onClick={onShowNote}
                            className="w-full justify-start" 
                            tooltip={state === 'collapsed' ? "Show Scratchpad" : undefined}
                        >
                            <NotepadText className="h-5 w-5 shrink-0" />
                            {state === 'expanded' && (
                            <span className="ml-3 truncate">Show Scratchpad</span>
                            )}
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </div>
        )}
      </SidebarContent>
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
   const [isAuthCheckComplete, setIsAuthCheckComplete] = useState(false);
   const router = useRouter();
   const pathname = usePathname();
   const { toast } = useToast();
   const [appUser, setAppUser] = useState<AppUserType | null>(null);
   const [isNoteVisible, setIsNoteVisible] = useState(true);

  // Load note visibility from local storage on mount
  useEffect(() => {
    try {
      const savedVisibility = localStorage.getItem('admin-note-visible');
      if (savedVisibility !== null) {
        setIsNoteVisible(JSON.parse(savedVisibility));
      }
    } catch (error) {
      console.error("Failed to load note visibility from localStorage", error);
    }
  }, []);

  // Save note visibility to local storage
  useEffect(() => {
    try {
      localStorage.setItem('admin-note-visible', JSON.stringify(isNoteVisible));
    } catch (error) {
      console.error("Failed to save note visibility to localStorage", error);
    }
  }, [isNoteVisible]);


   useEffect(() => {
    if (!auth) {
      console.error("AdminLayout: Firebase Auth not initialized.");
      toast({ title: "Auth Error", description: "Admin panel cannot verify authentication.", variant: "destructive"});
      router.push('/auth/login');
      setIsAuthCheckComplete(true); 
      return;
    }
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        console.log("AdminLayout: No user logged in. Redirecting to /auth/login");
        toast({ title: "Authentication Required", description: "Please login to access the admin panel.", variant: "destructive"});
        router.push('/auth/login');
        setIsAuthCheckComplete(true);
        return;
      }
      
      if (!database) {
           console.error("AdminLayout: Firebase Database not available for role check.");
           toast({ title: "Configuration Error", description: "Firebase Database not available for admin role check.", variant: "destructive"});
           router.push('/'); 
           setIsAuthCheckComplete(true);
           return;
      }
      
      try {
          const userRef = ref(database, `users/${user.uid}`);
          const snapshot = await get(userRef);

          if (!snapshot.exists()) {
             console.log(`AdminLayout: User data for UID ${user.uid} does not exist in DB. Redirecting.`);
             toast({ title: "Access Denied", description: "User profile not found.", variant: "destructive"});
             router.push('/');
             setIsAuthCheckComplete(true);
             return;
          }

          const userData = snapshot.val();
          const userRole = userData?.role || 'user';

          if (userRole === 'admin') {
              console.log(`AdminLayout: User is admin. Allowing access.`);
              setAppUser({ id: user.uid, ...userData } as AppUserType);
          } else if (userRole === 'delegate') {
              console.log(`AdminLayout: User is delegate. Verifying permissions...`);
              const permissions = userData.delegatePermissions?.accessScreens || {};
              const accessibleScreens = adminNavItems.filter(item => item.permissionKey && permissions[item.permissionKey]);

              if (accessibleScreens.length === 0) {
                  console.log(`AdminLayout: Delegate has no permissions. Denying access.`);
                  toast({ title: "Access Denied", description: "You have not been assigned any delegate permissions.", variant: "destructive" });
                  router.push('/');
              } else {
                  setAppUser({ id: user.uid, ...userData } as AppUserType);
                  const hasDashboardAccess = !!permissions.dashboard;
                  
                  if (pathname === '/admin/dashboard' && !hasDashboardAccess) {
                      const firstAllowedPage = accessibleScreens[0].href;
                      console.log(`AdminLayout: Delegate lacks dashboard access. Redirecting to their first available page: ${firstAllowedPage}`);
                      router.replace(firstAllowedPage);
                  }
              }
          } else {
              console.log(`AdminLayout: User role '${userRole}' denied admin access. Redirecting.`);
              toast({ title: "Access Denied", description: "You do not have permission to view this page.", variant: "destructive"});
              router.push('/'); 
          }
      } catch (error) {
          const errorMessage = String(error instanceof Error ? error.message : error).toUpperCase();
          if (errorMessage.includes('PERMISSION_DENIED')) {
               console.warn(
                  `AdminLayout: Permission denied while fetching user role for UID ${user.uid}. ` +
                  `Ensure Firebase Realtime Database security rules allow reading '/users/${user.uid}'.`
               );
               toast({ title: "Permission Denied", description: "Could not verify admin role due to database permissions.", variant: "destructive"});
          } else {
              console.error("AdminLayout: Error checking admin role:", error);
              toast({ title: "Error", description: "Could not verify admin status.", variant: "destructive"});
          }
          router.push('/');
      } finally {
        setIsAuthCheckComplete(true);
      }
    });
     return () => unsubscribe();
 }, [router, toast, pathname]);
  
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="group/sidebar-wrapper flex min-h-svh w-full has-[[data-variant=inset]]:bg-sidebar" style={{ "--sidebar-width": "16rem", "--sidebar-width-icon": "3rem" } as React.CSSProperties}>
        <Sidebar>
            <AdminSidebarNav appUser={appUser} isNoteVisible={isNoteVisible} onShowNote={() => setIsNoteVisible(true)} />
        </Sidebar>

        <div className="flex flex-1 flex-col overflow-auto">
            <header className="sticky top-0 z-10 flex h-16 items-center justify-end gap-4 border-b bg-background/80 px-6 backdrop-blur-lg">
                <AdminUserNav />
            </header>
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                {!isAuthCheckComplete ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                        <LoaderCircle className="h-16 w-16 animate-spin text-accent" />
                    </div>
                ) : children }
            </main>
        </div>
        {appUser?.role === 'admin' && <AdminStickyNote isVisible={isNoteVisible} setIsVisible={setIsNoteVisible} />}
      </div>
    </SidebarProvider>
  );
}

    