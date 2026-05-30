'use client';

import { createContext, useContext, useState, useCallback } from 'react';

const AIContext = createContext({
  pageData: null,
  setPageData: () => {},
});

export function AIProvider({ children }) {
  const [pageData, setPageData] = useState(null);

  const updatePageData = useCallback((data) => {
    setPageData(data);
  }, []);

  return (
    <AIContext.Provider value={{ pageData, setPageData: updatePageData }}>
      {children}
    </AIContext.Provider>
  );
}

export function useAIContext() {
  return useContext(AIContext);
}
