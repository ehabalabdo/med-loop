import { useState, useEffect, useRef } from 'react';

/**
 * Custom Hook for managing completed patient IDs across views
 * Handles localStorage persistence with daily auto-clear
 */
export const useCompletedPatients = () => {
  const [completedPatientIds, setCompletedPatientIds] = useState<Set<string>>(() => {
    try {
      // Auto-clear daily
      const today = new Date().toDateString();
      const lastClearDate = localStorage.getItem('completedPatientIds_lastClear');
      
      if (lastClearDate !== today) {
        localStorage.removeItem('completedPatientIds');
        localStorage.setItem('completedPatientIds_lastClear', today);
        return new Set<string>();
      }
      
      const stored = localStorage.getItem('completedPatientIds');
      if (stored) {
        const arr = JSON.parse(stored);
        return new Set<string>(arr);
      }
    } catch (e) {
      console.error('[useCompletedPatients] Failed to load from localStorage:', e);
    }
    return new Set<string>();
  });

  // Keep ref in sync with state for callbacks
  const completedPatientIdsRef = useRef<Set<string>>(completedPatientIds);
  
  useEffect(() => {
    completedPatientIdsRef.current = completedPatientIds;
  }, [completedPatientIds]);

  // Persist to localStorage on change
  useEffect(() => {
    try {
      const idsArray = Array.from(completedPatientIds);
      localStorage.setItem('completedPatientIds', JSON.stringify(idsArray));
    } catch (e) {
      console.error('[useCompletedPatients] Failed to save to localStorage:', e);
    }
  }, [completedPatientIds]);

  // Poll localStorage for changes from other views
  useEffect(() => {
    const pollCompletedIds = () => {
      const stored = localStorage.getItem('completedPatientIds');
      if (stored) {
        try {
          const storedIds = JSON.parse(stored);
          const currentIds = Array.from(completedPatientIds);
          
          // Check if they're different
          if (JSON.stringify(storedIds.sort()) !== JSON.stringify(currentIds.sort())) {
            const newSet = new Set<string>(storedIds);
            setCompletedPatientIds(newSet);
          }
        } catch (e) {
          console.error('[useCompletedPatients] Failed to parse localStorage:', e);
        }
      }
    };

    const interval = setInterval(pollCompletedIds, 2000);
    return () => clearInterval(interval);
  }, [completedPatientIds]);

  return {
    completedPatientIds,
    completedPatientIdsRef,
    setCompletedPatientIds,
    addCompleted: (id: string) => setCompletedPatientIds(prev => new Set(prev).add(id)),
    removeCompleted: (id: string) => {
      const newSet = new Set(completedPatientIds);
      newSet.delete(id);
      setCompletedPatientIds(newSet);
    },
    clearAll: () => setCompletedPatientIds(new Set())
  };
};
