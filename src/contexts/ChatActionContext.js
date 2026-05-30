'use client';

import { createContext, useContext, useRef, useCallback, useEffect } from 'react';

const ChatActionContext = createContext({
  dispatchAction: () => {},
  listenAction: () => () => {},
});

export function ChatActionProvider({ children }) {
  const listenersRef = useRef({});

  const dispatchAction = useCallback((type, payload) => {
    console.log(`[ChatAction] Dispatching ${type}`, payload);
    const handlers = listenersRef.current[type];
    if (handlers && handlers.length > 0) {
      handlers.forEach(callback => callback(payload));
    } else {
      console.warn(`[ChatAction] No listeners found for action type: ${type}`);
    }
  }, []);

  const listenAction = useCallback((type, callback) => {
    if (!listenersRef.current[type]) {
      listenersRef.current[type] = [];
    }
    listenersRef.current[type].push(callback);

    // Return cleanup function
    return () => {
      if (listenersRef.current[type]) {
        listenersRef.current[type] = listenersRef.current[type].filter(cb => cb !== callback);
      }
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
