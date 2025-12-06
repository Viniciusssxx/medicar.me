
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SeniorProfile, Medication, MedicationStatus, LogEntry } from '../types';

interface AppContextType {
  senior: SeniorProfile | null;
  updateSenior: (data: Partial<SeniorProfile>) => void;
  addMedication: (med: Omit<Medication, 'id' | 'status'>) => void;
  removeMedication: (id: string) => void;
  updateMedicationAudio: (id: string, audioData: string | undefined) => void;
  markAsTaken: (medId: string) => void;
  resetDailyStatus: () => void;
  triggerEmergency: () => Promise<void>;
  emergencyActive: boolean;
  clearEmergency: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const INITIAL_SENIOR: SeniorProfile = {
  id: 'senior-1',
  name: 'Vovô João',
  medications: [
    { id: '1', name: 'Losartana', dosage: '50mg', time: '08:00', status: MedicationStatus.PENDING },
    { id: '2', name: 'Aspirina', dosage: '100mg', time: '13:00', status: MedicationStatus.PENDING },
    { id: '3', name: 'Sinvastatina', dosage: '20mg', time: '20:00', status: MedicationStatus.PENDING },
  ],
  emergencyContact: '(11) 99999-9999',
  logs: [],
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [senior, setSenior] = useState<SeniorProfile | null>(null);
  const [emergencyActive, setEmergencyActive] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    const savedSenior = localStorage.getItem('senior_data');
    
    if (savedSenior) {
      setSenior(JSON.parse(savedSenior));
    } else {
      setSenior(INITIAL_SENIOR);
    }
  }, []);

  // Save to local storage whenever senior data changes
  useEffect(() => {
    if (senior) {
      localStorage.setItem('senior_data', JSON.stringify(senior));
    }
  }, [senior]);

  const updateSenior = (data: Partial<SeniorProfile>) => {
    setSenior(prev => prev ? { ...prev, ...data } : null);
  };

  const addMedication = (medData: Omit<Medication, 'id' | 'status'>) => {
    if (!senior) return;
    const newMed: Medication = {
      ...medData,
      id: Math.random().toString(36).substr(2, 9),
      status: MedicationStatus.PENDING,
    };
    const updatedMeds = [...senior.medications, newMed].sort((a, b) => a.time.localeCompare(b.time));
    updateSenior({ medications: updatedMeds });
  };

  const removeMedication = (id: string) => {
    if (!senior) return;
    updateSenior({ medications: senior.medications.filter(m => m.id !== id) });
  };

  const updateMedicationAudio = (id: string, audioData: string | undefined) => {
    if (!senior) return;
    const updatedMeds = senior.medications.map(med => 
      med.id === id ? { ...med, customAudio: audioData } : med
    );
    updateSenior({ medications: updatedMeds });
  };

  const markAsTaken = (medId: string) => {
    if (!senior) return;

    const medIndex = senior.medications.findIndex(m => m.id === medId);
    if (medIndex === -1) return;

    const med = senior.medications[medIndex];
    if (med.status === MedicationStatus.TAKEN) return;

    const now = new Date();
    const newMeds = [...senior.medications];
    newMeds[medIndex] = { ...med, status: MedicationStatus.TAKEN, lastTaken: now.toISOString() };

    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      medicationName: med.name,
      scheduledTime: med.time,
      actionTime: now.toISOString(),
      status: MedicationStatus.TAKEN,
      date: now.toISOString().split('T')[0],
    };

    updateSenior({ 
      medications: newMeds,
      logs: [newLog, ...senior.logs]
    });
  };

  const resetDailyStatus = useCallback(() => {
    if (!senior) return;
    // Simple check: if lastTaken is not today, reset to PENDING
    const today = new Date().toISOString().split('T')[0];
    
    const needsReset = senior.medications.some(m => {
        if (!m.lastTaken) return false;
        return m.lastTaken.split('T')[0] !== today;
    });

    if (needsReset) {
       const resetMeds = senior.medications.map(m => {
           if (m.lastTaken && m.lastTaken.split('T')[0] === today) {
               return m; // Already taken today
           }
           return { ...m, status: MedicationStatus.PENDING };
       });
       updateSenior({ medications: resetMeds });
    }
  }, [senior]);

  // Check for day change every minute
  useEffect(() => {
    const interval = setInterval(resetDailyStatus, 60000);
    return () => clearInterval(interval);
  }, [resetDailyStatus]);

  const triggerEmergency = async () => {
    setEmergencyActive(true);
    // Simulate getting location and sending alert
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log("Emergency Location:", position.coords.latitude, position.coords.longitude);
            }, 
            (error) => console.error("Geo error", error)
        );
    }
  };

  const clearEmergency = () => setEmergencyActive(false);

  return (
    <AppContext.Provider value={{
      senior,
      updateSenior,
      addMedication,
      removeMedication,
      updateMedicationAudio,
      markAsTaken,
      resetDailyStatus,
      triggerEmergency,
      emergencyActive,
      clearEmergency
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
