"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { Pin, PinOff, X, NotepadText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import GlassCard from '@/components/core/glass-card';
import { database } from '@/lib/firebase/config'; // Import Firebase
import { ref, onValue, set } from 'firebase/database'; // Import DB functions

const LOCAL_STORAGE_KEY_POSITION = 'admin-sticky-note-position';
const NOTE_DB_PATH = 'adminData/stickyNote';

interface NotePosition {
  isPinned: boolean;
  x: number;
  y: number;
}

interface AdminStickyNoteProps {
    isVisible: boolean;
    setIsVisible: (visible: boolean) => void;
}

export default function AdminStickyNote({ isVisible, setIsVisible }: AdminStickyNoteProps) {
  const [content, setContent] = useState('');
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [position, setPosition] = useState<NotePosition>(() => {
    // Initialize default position safely inside the component
    const defaultPosition: NotePosition = {
        isPinned: false,
        x: typeof window !== 'undefined' ? window.innerWidth - 340 : 800,
        y: typeof window !== 'undefined' ? window.innerHeight - 300 : 400,
    };
    if (typeof window === 'undefined') {
        return defaultPosition;
    }
    try {
      const savedPosition = localStorage.getItem(LOCAL_STORAGE_KEY_POSITION);
      if (savedPosition) {
        const parsed = JSON.parse(savedPosition);
        if (parsed.isPinned !== undefined && parsed.x !== undefined && parsed.y !== undefined) {
          return parsed;
        }
      }
    } catch (error) {
      console.error("Failed to load note position from localStorage", error);
    }
    return defaultPosition;
  });

  const dragControls = useDragControls();
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Save position to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_POSITION, JSON.stringify(position));
    } catch (error) {
      console.error("Failed to save note position to localStorage", error);
    }
  }, [position]);

  // Firebase content listener
  useEffect(() => {
    if (!database) {
        setIsLoadingContent(false);
        return;
    }
    const noteContentRef = ref(database, `${NOTE_DB_PATH}/content`);
    
    const unsubscribe = onValue(noteContentRef, (snapshot) => {
        const dbContent = snapshot.val();
        setContent(typeof dbContent === 'string' ? dbContent : '');
        setIsLoadingContent(false);
    }, (error) => {
        console.error("Failed to fetch sticky note content:", error);
        setIsLoadingContent(false);
    });

    return () => unsubscribe();
  }, []);

  const saveContentToDb = (newContent: string) => {
      if (!database) return;
      const noteContentRef = ref(database, `${NOTE_DB_PATH}/content`);
      set(noteContentRef, newContent).catch(error => {
          console.error("Failed to save note content to Firebase", error);
      });
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent); // Update UI immediately

    // Debounce the database write
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    debounceTimeout.current = setTimeout(() => {
      saveContentToDb(newContent);
    }, 500); // Save after 500ms of inactivity
  };
  
  const togglePinned = () => {
    setPosition(prev => ({ ...prev, isPinned: !prev.isPinned }));
  };

  if (!isVisible) {
    return null;
  }

  return (
    <motion.div
      drag={!position.isPinned}
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      className="fixed z-[9998] w-80 h-auto cursor-grab"
      initial={{ x: position.x, y: position.y }}
      animate={{ x: position.x, y: position.y }}
      onDragEnd={(event, info) => {
        setPosition(prev => ({ ...prev, x: info.offset.x, y: info.offset.y }));
      }}
      whileTap={{ cursor: "grabbing" }}
    >
      <GlassCard className="p-0 flex flex-col h-64 shadow-2xl shadow-accent/20">
        <div 
            className="flex items-center justify-between p-2 bg-card/80 border-b border-border/50"
            onPointerDown={(e) => {
                if (!position.isPinned) {
                    e.preventDefault(); 
                    dragControls.start(e, { snapToCursor: false });
                }
            }}
            style={{ cursor: position.isPinned ? 'default' : 'grab' }}
        >
          <div className="flex items-center gap-2">
            <NotepadText className="h-5 w-5 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Admin Scratchpad</h3>
          </div>
          <div className="flex items-center">
             <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={togglePinned}
              title={position.isPinned ? "Unpin Note" : "Pin Note"}
            >
              {position.isPinned ? <PinOff className="h-4 w-4 text-accent" /> : <Pin className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => setIsVisible(false)}
              title="Hide Note"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {isLoadingContent ? (
            <div className="flex-grow flex items-center justify-center text-muted-foreground text-sm">
                <Loader2 className="mr-2 h-4 w-4 animate-spin"/> Loading notes...
            </div>
        ) : (
            <Textarea
              placeholder="Admin-only notes..."
              value={content}
              onChange={handleNoteChange}
              className="flex-grow resize-none bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
            />
        )}
      </GlassCard>
    </motion.div>
  );
}