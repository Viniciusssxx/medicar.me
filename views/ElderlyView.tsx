import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Check, AlertTriangle, Phone, LogOut, Volume2 } from 'lucide-react';
import { MedicationStatus } from '../types';
import { speak } from '../utils/speech';

const ElderlyView: React.FC = () => {
  const { senior, markAsTaken, triggerEmergency, emergencyActive, switchRole } = useApp();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!senior) return <div className="p-10 text-2xl">Carregando dados...</div>;

  const sortedMeds = [...senior.medications].sort((a, b) => a.time.localeCompare(b.time));

  // Determine critical alerts (passed time but not taken)
  const isLate = (time: string, status: MedicationStatus) => {
    if (status === MedicationStatus.TAKEN) return false;
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    const medTime = new Date();
    medTime.setHours(hours, minutes, 0, 0);
    // If it's more than 15 minutes past scheduled time
    const diff = (now.getTime() - medTime.getTime()) / 60000;
    return diff > 15 && diff < 24 * 60; // Just ensuring it's today's late
  };

  const handleTaken = (medId: string, medName: string) => {
    speak(`Muito bem! Você confirmou que tomou ${medName}`);
    markAsTaken(medId);
  };

  const handleEmergency = () => {
    if (!emergencyActive) {
        speak("Enviando pedido de ajuda para seu familiar.");
        triggerEmergency();
    }
  };

  return (
    <div className="min-h-screen bg-yellow-50 flex flex-col relative">
      {/* Top Bar with Time */}
      <div className="bg-white p-6 shadow-sm flex justify-between items-center border-b-2 border-gray-200">
        <div>
           <h2 className="text-xl text-gray-500">Olá, {senior.name}</h2>
           <h1 className="text-4xl font-black text-gray-900 tracking-tight">
             {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
           </h1>
        </div>
        <button onClick={() => switchRole(null)} className="p-4 bg-gray-100 rounded-full text-gray-400 hover:bg-gray-200">
            <LogOut size={28} />
        </button>
      </div>

      {/* Emergency Alert Overlay */}
      {emergencyActive && (
        <div className="bg-red-600 text-white p-6 text-center animate-pulse">
            <h2 className="text-2xl font-bold uppercase mb-2">Ajuda Solicitada!</h2>
            <p className="text-lg">Seu familiar recebeu sua localização.</p>
        </div>
      )}

      {/* Main List */}
      <main className="flex-1 p-4 pb-32 overflow-y-auto space-y-6">
        <p className="text-2xl font-bold text-gray-700 ml-2" onClick={() => speak("Aqui estão seus remédios de hoje.")}>
            <Volume2 className="inline mr-2 mb-1" size={24}/> 
            Remédios de Hoje:
        </p>
        
        {sortedMeds.map((med) => {
            const late = isLate(med.time, med.status);
            const taken = med.status === MedicationStatus.TAKEN;

            return (
                <div 
                    key={med.id} 
                    className={`
                        relative p-6 rounded-3xl border-4 shadow-sm transition-all
                        ${taken 
                            ? 'bg-gray-100 border-gray-200 opacity-60' 
                            : late 
                                ? 'bg-red-50 border-red-500' 
                                : 'bg-white border-blue-500'
                        }
                    `}
                >
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-4">
                            <span className={`text-3xl font-black ${taken ? 'text-gray-400 line-through' : 'text-blue-900'}`}>
                                {med.time}
                            </span>
                            {late && (
                                <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold uppercase animate-bounce">
                                    Atrasado
                                </span>
                            )}
                        </div>
                        <div className="text-right">
                             <h3 className={`text-2xl font-bold ${taken ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                {med.name}
                            </h3>
                            <p className="text-xl text-gray-500">{med.dosage}</p>
                        </div>
                    </div>

                    {!taken ? (
                        <button 
                            onClick={() => handleTaken(med.id, med.name)}
                            className={`
                                w-full py-5 rounded-2xl text-2xl font-bold text-white shadow-md active:scale-95 transition-transform flex items-center justify-center gap-3
                                ${late ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                            `}
                        >
                            <Check size={32} strokeWidth={4} />
                            JÁ TOMEI!
                        </button>
                    ) : (
                        <div className="w-full py-4 text-center text-green-700 font-bold text-xl bg-green-100 rounded-xl flex items-center justify-center gap-2">
                            <Check size={24} /> Confirmado
                        </div>
                    )}
                </div>
            );
        })}

        {sortedMeds.length === 0 && (
             <div className="text-center py-20 opacity-50">
                <p className="text-2xl text-gray-500">Nenhum remédio hoje.</p>
             </div>
        )}
      </main>

      {/* Emergency Button - Fixed Bottom */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-yellow-50 to-transparent">
        <button 
            onClick={handleEmergency}
            disabled={emergencyActive}
            className={`
                w-full py-6 rounded-3xl text-2xl font-bold text-white shadow-xl flex items-center justify-center gap-4 transition-all
                ${emergencyActive ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 animate-pulse-red'}
            `}
        >
            <AlertTriangle size={36} fill="white" className="text-red-500" />
            {emergencyActive ? 'AJUDA A CAMINHO' : 'PRECISO DE AJUDA'}
        </button>
      </div>
    </div>
  );
};

export default ElderlyView;