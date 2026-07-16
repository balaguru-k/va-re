import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const TimerContext = createContext();

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within TimerProvider');
  }
  return context;
};

const STORAGE_KEY = 'checklistTimers';

const loadTimers = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
};

const persistTimers = (timers) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
};

// Compute current elapsed for a timer entry using persisted startTime
const computeElapsed = (timer) => {
  if (!timer) return 0;
  if (timer.isRunning && timer.startTime) {
    return (timer.baseElapsed || 0) + Math.floor((Date.now() - timer.startTime) / 1000);
  }
  return timer.elapsed || 0;
};

export const TimerProvider = ({ children }) => {
  const [timers, setTimers] = useState(loadTimers);
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimers(prev => {
        const updated = { ...prev };
        let hasChanges = false;
        Object.keys(updated).forEach(id => {
          if (updated[id].isRunning && updated[id].startTime) {
            const newElapsed = (updated[id].baseElapsed || 0) + Math.floor((Date.now() - updated[id].startTime) / 1000);
            if (newElapsed !== updated[id].elapsed) {
              updated[id] = { ...updated[id], elapsed: newElapsed };
              hasChanges = true;
            }
          }
        });
        if (hasChanges) {
          persistTimers(updated);
          return updated;
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Recalculate on tab visibility change
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        setTimers(prev => {
          const updated = { ...prev };
          let hasChanges = false;
          Object.keys(updated).forEach(id => {
            if (updated[id].isRunning && updated[id].startTime) {
              const newElapsed = (updated[id].baseElapsed || 0) + Math.floor((Date.now() - updated[id].startTime) / 1000);
              if (newElapsed !== updated[id].elapsed) {
                updated[id] = { ...updated[id], elapsed: newElapsed };
                hasChanges = true;
              }
            }
          });
          if (hasChanges) {
            persistTimers(updated);
            return updated;
          }
          return prev;
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const startTimer = (checklistId, initialTime = 0) => {
    setTimers(prev => {
      const base = prev[checklistId]?.elapsed || initialTime;
      const updated = {
        ...prev,
        [checklistId]: {
          elapsed: base,
          baseElapsed: base,
          startTime: Date.now(),
          isRunning: true
        }
      };
      persistTimers(updated);
      return updated;
    });
  };

  const stopTimer = (checklistId) => {
    setTimers(prev => {
      const current = prev[checklistId];
      if (!current) return prev;
      const finalElapsed = computeElapsed(current);
      const updated = {
        ...prev,
        [checklistId]: {
          elapsed: finalElapsed,
          baseElapsed: finalElapsed,
          startTime: null,
          isRunning: false
        }
      };
      persistTimers(updated);
      return updated;
    });
  };

  const resetTimer = (checklistId) => {
    setTimers(prev => {
      const updated = { ...prev };
      delete updated[checklistId];
      persistTimers(updated);
      return updated;
    });
  };

  const resetAllTimers = () => {
    setTimers({});
    localStorage.removeItem(STORAGE_KEY);
  };

  const getTimer = (checklistId) => {
    const timer = timers[checklistId];
    if (!timer) return { elapsed: 0, isRunning: false };
    return { elapsed: computeElapsed(timer), isRunning: timer.isRunning };
  };

  return (
    <TimerContext.Provider value={{ startTimer, stopTimer, resetTimer, resetAllTimers, getTimer }}>
      {children}
    </TimerContext.Provider>
  );
};
