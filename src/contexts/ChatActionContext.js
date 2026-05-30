'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ChatActionContext = createContext({
  dispatchAction: () => {},
  listenAction: () => () => {},
});

export function ChatActionProvider({ children }) {
  const [listeners, setListeners] = useState({});

  const dispatchAction = useCallback((type, payload) => {
    console.log(`[ChatAction] Dispatching ${type}`, payload);
    if (listeners[type]) {
      listeners[type].forEach(callback => callback(payload));
    } else {
      console.warn(`[ChatAction] No listeners found for action type: ${type}`);
    }
  }, [listeners]);

  const listenAction = useCallback((type, callback) => {
    setListeners(prev => {
      const existing = prev[type] || [];
      return { ...prev, [type]: [...existing, callback] };
    });

    // Return cleanup function
    return () => {
      setListeners(prev => {
        const existing = prev[type] || [];
        return {
          ...prev,
          [type]: existing.filter(cb => cb !== callback)
        };
      });
    };
  }, []);

  return (
    <ChatActionContext.Provider value={{ dispatchAction, listenAction }}>
      {children}
    </ChatActionContext.Provider>
  );
}

// Custom Hook
export function useChatAction(type, callback) {
  const { listenAction } = useContext(ChatActionContext);

  useEffect(() => {
    if (type && callback) {
      const cleanup = listenAction(type, callback);
      return cleanup;
    }
  }, [type, callback, listenAction]);

  const { dispatchAction } = useContext(ChatActionContext);
  return { dispatchAction };
}
