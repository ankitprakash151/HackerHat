'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface DemoModeContextType {
  isDemoMode: boolean;
  setIsDemoMode: (val: boolean) => void;
  toggleDemoMode: () => void;
  isLoaded: boolean;
}

const DemoModeContext = createContext<DemoModeContextType>({
  isDemoMode: true,
  setIsDemoMode: () => {},
  toggleDemoMode: () => {},
  isLoaded: false
});

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  // Demo Mode is ON by default
  const [isDemoMode, setIsDemoModeState] = useState<boolean>(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('vibeshield_demo_mode');
      if (stored !== null) {
        setIsDemoModeState(stored === 'true');
      } else {
        setIsDemoModeState(true);
        localStorage.setItem('vibeshield_demo_mode', 'true');
      }
    } catch {
      setIsDemoModeState(true);
    }
    setIsLoaded(true);
  }, []);

  const setIsDemoMode = (val: boolean) => {
    setIsDemoModeState(val);
    try {
      localStorage.setItem('vibeshield_demo_mode', String(val));
    } catch {}
  };

  const toggleDemoMode = () => {
    setIsDemoMode(!isDemoMode);
  };

  return (
    <DemoModeContext.Provider value={{ isDemoMode, setIsDemoMode, toggleDemoMode, isLoaded }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoModeContext);
}
