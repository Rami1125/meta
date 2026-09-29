import { useState, useEffect, useCallback } from 'react';
import { ref, get, onChildAdded, onValue } from 'firebase/database';
import { db } from '../firebase';

export interface InboxConversation {
  phone: string;
  name: string;
  lastMessage: string;
  lastTimestamp: number;
  unreadCount: number;
  messages?: any[];
  [key: string]: any;
}

export function useRealtimeInbox() {
  const [conversations, setConversations] = useState<Record<string, InboxConversation>>({});
  const [loading, setLoading] = useState(true);

  // Manual sync function (STEP 4)
  const syncNow = useCallback(async () => {
    try {
      console.log("🔄 MANUAL SYNC TRIGGERED");
      const incomingRef = ref(db, 'joni/incoming');
      const convRef = ref(db, 'conversations');

      const [snap1, snap2] = await Promise.all([
        get(incomingRef).catch(err => {
          console.error("❌ SYNC READ ERROR joni/incoming:", err);
          return null;
        }),
        get(convRef).catch(err => {
          console.error("❌ SYNC READ ERROR conversations:", err);
          return null;
        })
      ]);

      const data1 = snap1 ? snap1.val() : null;
      const data2 = snap2 ? snap2.val() : null;

      console.log("SYNC joni/incoming data:", data1);
      console.log("SYNC conversations data:", data2);

      const updated: Record<string, InboxConversation> = {};

      // 1. Process conversations path
      if (data2 && typeof data2 === 'object') {
        Object.entries(data2).forEach(([key, val]: [string, any]) => {
          const phone = (val.phone || val.from || key).replace(/\D/g, '');
          if (phone) {
            updated[phone] = {
              phone,
              name: val.name || val.customerName || phone,
              lastMessage: val.lastMessage || val.text || '',
              lastTimestamp: val.lastTimestamp || val.timestamp || Date.now(),
              unreadCount: val.unreadCount || 0,
              messages: val.messages || []
            };
          }
        });
      }

      // 2. Process joni/incoming path
      if (data1 && typeof data1 === 'object') {
        Object.values(data1).forEach((msg: any) => {
          const phone = (msg.from || msg.senderBusiness || '').toString().replace(/[^0-9]/g, '');
          const text = msg.text || msg.incoming_text || msg.lastMessage || '';
          if (phone && text) {
            updated[phone] = {
              phone,
              name: msg.name || updated[phone]?.name || phone,
              lastMessage: text,
              lastTimestamp: msg.timestamp || Date.now(),
              unreadCount: (updated[phone]?.unreadCount || 0) + 1,
              messages: updated[phone]?.messages || []
            };
          }
        });
      }

      setConversations(prev => ({ ...prev, ...updated }));
      console.log("✅ SYNC COMPLETED, TOTAL CONVERSATIONS:", Object.keys(updated).length);
    } catch (err) {
      console.error("❌ SYNC FAILED:", err);
    }
  }, []);

  useEffect(() => {
    console.log("🔍 START LISTENING TO: joni/incoming");

    const incomingRef = ref(db, 'joni/incoming');
    const convRef = ref(db, 'conversations');

    // DEBUG 1: Check if we can read
    get(incomingRef).then(snap => {
      console.log("📦 CURRENT DATA IN joni/incoming:", snap.val());
      const val = snap.val() || {};
      const count = Object.keys(val).length;
      console.log("📦 COUNT:", count);

      // Prepopulate state with existing messages
      if (val && typeof val === 'object') {
        const initial: Record<string, InboxConversation> = {};
        Object.values(val).forEach((data: any) => {
          const phone = (data.from || data.senderBusiness || '').toString().replace(/[^0-9]/g, '');
          const text = data.text || data.incoming_text || data.lastMessage || '';
          if (phone && text) {
            initial[phone] = {
              phone,
              name: data.name || phone,
              lastMessage: text,
              lastTimestamp: data.timestamp || Date.now(),
              unreadCount: 1
            };
          }
        });
        setConversations(prev => ({ ...initial, ...prev }));
      }
      setLoading(false);
    }).catch(err => {
      console.error("❌ FIREBASE READ ERROR:", err.code, err.message);
      console.error("👉 FIX: Check Firebase Rules!");
      setLoading(false);
    });

    // LISTENER 1: onChildAdded on joni/incoming (STEP 1)
    const unsub1 = onChildAdded(incomingRef, (snap) => {
      console.log("🔥 NEW MESSAGE DETECTED:", snap.key, snap.val());
      const data = snap.val();

      // CRITICAL FIX: Handle both structures
      // Structure 1: {from, text, name}
      // Structure 2: {from, incoming_text, sent_response}
      const phone = (data.from || data.senderBusiness || '').toString().replace(/[^0-9]/g, '');
      const text = data.text || data.incoming_text || data.lastMessage || '';

      if (!phone || !text) {
        console.warn("⚠️ SKIPPED - missing phone or text:", data);
        return;
      }

      console.log("✅ PROCESSING:", phone, text);

      // Force update UI state immediately (not only Firebase)
      setConversations(prev => ({
        ...prev,
        [phone]: {
          phone,
          name: data.name || prev[phone]?.name || phone,
          lastMessage: text,
          lastTimestamp: data.timestamp || Date.now(),
          unreadCount: (prev[phone]?.unreadCount || 0) + 1
        }
      }));
    });

    // LISTENER 2: onChildAdded on conversations (STEP 3: BOTH PATHS)
    const unsub2 = onChildAdded(convRef, (snap) => {
      const data = snap.val();
      if (!data) return;
      const phone = (data.phone || data.from || snap.key || '').toString().replace(/[^0-9]/g, '');
      const text = data.lastMessage || data.text || '';
      if (!phone) return;

      console.log("🔥 CONVERSATION UPDATE DETECTED:", phone, text);

      setConversations(prev => ({
        ...prev,
        [phone]: {
          phone,
          name: data.name || data.customerName || prev[phone]?.name || phone,
          lastMessage: text || prev[phone]?.lastMessage || '',
          lastTimestamp: data.lastTimestamp || data.timestamp || Date.now(),
          unreadCount: prev[phone]?.unreadCount || data.unreadCount || 0,
          messages: data.messages || prev[phone]?.messages || []
        }
      }));
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  return {
    conversations,
    conversationsList: Object.values(conversations).sort((a, b) => b.lastTimestamp - a.lastTimestamp),
    loading,
    syncNow
  };
}
