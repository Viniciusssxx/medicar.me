
import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Check, AlertTriangle, Settings, Plus, Trash2, Wand2, X, History, Volume2, Mic, Music, Play, Square, Upload, Pill, AlarmClock } from 'lucide-react';
import { MedicationStatus } from '../types';
import { speak } from '../utils/speech';
import { GoogleGenAI } from "@google/genai";

const UnifiedView: React.FC = () => {
  const { senior, markAsTaken, addMedication, removeMedication, updateMedicationAudio, triggerEmergency, emergencyActive, clearEmergency } = useApp();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // State for "Edit Mode" (Caregiver features)
  const [isEditMode, setIsEditMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  // State for Audio Configuration Modal (Existing Meds)
  const [audioConfigMedId, setAudioConfigMedId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // State for Add Form
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedTime, setNewMedTime] = useState('');
  const [newMedAudio, setNewMedAudio] = useState<string | null>(null);
  const [isRecordingNew, setIsRecordingNew] = useState(false);
  
  // State for AI
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // --- ALARM CLOCK STATE ---
  const [ringingMedId, setRingingMedId] = useState<string | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const playCountRef = useRef(0);
  const triggeredMinutesRef = useRef<Set<string>>(new Set()); // Prevents re-triggering in same minute

  useEffect(() => {
    const timer = setInterval(() => {
        const now = new Date();
        setCurrentTime(now);
        checkAlarms(now);
    }, 1000);
    return () => clearInterval(timer);
  }, [senior]); // Re-run if senior data changes to ensure we have latest meds

  const checkAlarms = (now: Date) => {
    if (!senior || isEditMode) return;

    const currentHourMin = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    // Check if we already triggered for this minute to avoid infinite loops or conflicts
    if (triggeredMinutesRef.current.has(currentHourMin)) return;

    // Find a med that matches time, is PENDING, and isn't currently ringing
    const medToRing = senior.medications.find(m => 
        m.time === currentHourMin && 
        m.status === MedicationStatus.PENDING &&
        ringingMedId === null
    );

    if (medToRing) {
        triggeredMinutesRef.current.add(currentHourMin); // Mark minute as handled
        triggerAlarm(medToRing.id, medToRing.customAudio);
        
        // Clean up old minutes from set to save memory
        if (triggeredMinutesRef.current.size > 10) {
            triggeredMinutesRef.current.clear();
            triggeredMinutesRef.current.add(currentHourMin);
        }
    }
  };

  const triggerAlarm = (medId: string, audioSrc?: string) => {
    // If something is already ringing, ignore (priority to first one)
    if (activeAudioRef.current) return;

    setRingingMedId(medId);
    playCountRef.current = 0;

    // Use custom audio or fallback (could act as a default beep in real app, here we rely on speech if no audio)
    if (audioSrc) {
        const audio = new Audio(audioSrc);
        activeAudioRef.current = audio;
        
        audio.onended = () => {
            playCountRef.current += 1;
            if (playCountRef.current < 5) {
                // Loop 5 times
                audio.currentTime = 0;
                audio.play().catch(e => console.error("Playback error", e));
            } else {
                stopAlarm();
            }
        };

        audio.play().catch(e => console.error("Autoplay blocked", e));
    } else {
        // Fallback if no audio recorded: Speak the alert 5 times
        let count = 0;
        const speakLoop = () => {
            if (count < 5 && ringingMedId === medId) { // Check if still ringing
                speak("Hora do remédio! Por favor, tome seu medicamento.");
                count++;
                setTimeout(speakLoop, 4000); // Wait approx time of speech
            } else {
                stopAlarm();
            }
        };
        speakLoop();
    }
  };

  const stopAlarm = () => {
    if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
    }
    setRingingMedId(null);
  };

  if (!senior) return <div className="p-10 text-2xl">Carregando dados...</div>;

  const sortedMeds = [...senior.medications].sort((a, b) => a.time.localeCompare(b.time));

  // Determine critical alerts (passed time but not taken)
  const isLate = (time: string, status: MedicationStatus) => {
    if (status === MedicationStatus.TAKEN) return false;
    const [hours, minutes] = time.split(':').map(Number);
    const medTime = new Date();
    medTime.setHours(hours, minutes, 0, 0);
    const diff = (currentTime.getTime() - medTime.getTime()) / 60000;
    return diff > 15 && diff < 24 * 60; 
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) return "Bom dia ☀️";
    if (hour >= 12 && hour < 18) return "Boa tarde 🌤️";
    return "Boa noite 🌙";
  };

  const handleTaken = (medId: string, medName: string) => {
    // If this med was ringing, stop the alarm
    if (ringingMedId === medId) {
        stopAlarm();
    }
    
    speak(`Muito bem! Você confirmou que tomou ${medName}`);
    markAsTaken(medId);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMedName && newMedDosage && newMedTime) {
      addMedication({ 
        name: newMedName, 
        dosage: newMedDosage, 
        time: newMedTime,
        customAudio: newMedAudio || undefined 
      });
      setNewMedName('');
      setNewMedDosage('');
      setNewMedTime('');
      setNewMedAudio(null);
      speak("Novo medicamento adicionado.");
    }
  };

  const handleEmergency = () => {
    if (!emergencyActive) {
        speak("Enviando pedido de ajuda.");
        triggerEmergency();
    }
  };

  const checkMedicationInfo = async (medName: string) => {
    if (!process.env.API_KEY) {
        setAiAdvice("Erro: Chave de API não configurada.");
        return;
    }
    setLoadingAi(true);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Explique para um idoso, em 1 frase simples, para que serve o remédio ${medName}.`,
        });
        setAiAdvice(response.text);
        speak(response.text || "");
    } catch (error) {
        setAiAdvice("Não foi possível consultar agora.");
    } finally {
        setLoadingAi(false);
    }
  };

  // --- AUDIO LOGIC (Existing Meds) ---

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          if (audioConfigMedId && typeof reader.result === 'string') {
            updateMedicationAudio(audioConfigMedId, reader.result);
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Erro ao acessar microfone. Verifique as permissões.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && audioConfigMedId) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (typeof evt.target?.result === 'string') {
          updateMedicationAudio(audioConfigMedId, evt.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // --- AUDIO LOGIC (New Med Form) ---

  const startRecordingNew = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setNewMedAudio(reader.result);
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecordingNew(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Erro ao acessar microfone.");
    }
  };

  const stopRecordingNew = () => {
    if (mediaRecorderRef.current && isRecordingNew) {
      mediaRecorderRef.current.stop();
      setIsRecordingNew(false);
    }
  };

  const handleFileUploadNew = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (typeof evt.target?.result === 'string') {
          setNewMedAudio(evt.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const playCustomAudio = (audioData: string) => {
    const audio = new Audio(audioData);
    audio.play().catch(e => console.error("Error playing audio", e));
  };

  return (
    <div className={`h-screen w-full flex flex-col relative overflow-hidden ${isEditMode ? 'bg-gray-100' : 'bg-yellow-50'}`}>
      
      {/* 1. Header Fixo (Flex None) */}
      <header className="flex-none bg-white h-24 shadow-sm flex items-center justify-between px-4 border-b border-gray-200 z-20 relative">
        {/* Left: Time and Greeting */}
        <div className="z-10">
           <div className="flex items-baseline gap-2">
             <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-none">
               {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
             </h1>
             <span className="text-gray-500 font-bold text-sm md:text-lg capitalize whitespace-nowrap">
               {getGreeting()}
             </span>
           </div>
           <p className="text-xs text-gray-400 font-medium mt-1">
             {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
           </p>
        </div>
        
        {/* Center: Logo medicar.me */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center opacity-90 pointer-events-none">
            <div className="flex items-center gap-2">
                <div className="text-blue-600">
                    <Pill size={32} strokeWidth={2.5} className="rotate-45 fill-blue-100" />
                </div>
                <span className="text-2xl font-bold tracking-tight text-blue-900">
                    medicar<span className="text-blue-500">.me</span>
                </span>
            </div>
        </div>

        {/* Right: Settings */}
        <button 
          onClick={() => setIsEditMode(!isEditMode)} 
          className={`z-10 p-3 rounded-full transition-colors ${isEditMode ? 'bg-teal-100 text-teal-700' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
          title="Modo Ajustes (Familiar)"
        >
            <Settings size={24} />
        </button>
      </header>

      {/* Alerta de Emergência (Banner Fixo Abaixo do Header) */}
      {emergencyActive && (
        <div 
            onClick={clearEmergency}
            className="flex-none bg-red-600 text-white p-3 text-center animate-pulse cursor-pointer shadow-md z-10"
        >
            <h2 className="text-lg font-bold uppercase">Ajuda Solicitada!</h2>
            <p className="text-xs">Toque aqui para cancelar.</p>
        </div>
      )}

      {/* Modais (Camada Superior - Absolute) */}
      {aiAdvice && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl relative animate-in fade-in zoom-in">
                  <button onClick={() => setAiAdvice(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                      <X size={24} />
                  </button>
                  <div className="flex items-center gap-2 mb-4 text-indigo-600">
                      <Wand2 />
                      <h3 className="font-bold text-lg">Sobre o Remédio</h3>
                  </div>
                  <p className="text-xl text-gray-800 leading-relaxed">{aiAdvice}</p>
              </div>
          </div>
      )}

      {audioConfigMedId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
               <h3 className="text-xl font-bold text-gray-800">Som do Lembrete</h3>
               <button onClick={() => { setAudioConfigMedId(null); setIsRecording(false); }} className="p-2 bg-gray-100 rounded-full">
                 <X size={20} />
               </button>
            </div>
            
            <p className="text-sm text-gray-500">
               Grave uma mensagem ou escolha um arquivo. O som tocará 5 vezes no horário.
            </p>

            {/* Recorder Section */}
            <div className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
               {!isRecording ? (
                 <button 
                   onClick={startRecording}
                   className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                 >
                   <Mic size={32} />
                 </button>
               ) : (
                 <button 
                   onClick={stopRecording}
                   className="w-16 h-16 rounded-full bg-gray-800 text-white flex items-center justify-center shadow-lg animate-pulse"
                 >
                   <Square size={24} fill="white" />
                 </button>
               )}
               <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                 {isRecording ? 'Gravando...' : 'Gravar Voz'}
               </span>
            </div>

            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">OU ARQUIVO MP3</span>
                <div className="flex-grow border-t border-gray-200"></div>
            </div>

            {/* File Upload Section */}
            <div>
               <label className="flex items-center justify-center w-full p-3 bg-white border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-teal-500 hover:text-teal-600 transition-colors gap-2 text-gray-500 font-medium">
                  <Upload size={20} />
                  <span>Escolher Arquivo</span>
                  <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
               </label>
            </div>

            {/* Current Audio Preview */}
            {senior?.medications.find(m => m.id === audioConfigMedId)?.customAudio && (
               <div className="bg-teal-50 p-4 rounded-xl flex items-center justify-between border border-teal-100">
                  <div className="flex items-center gap-2 text-teal-700 font-bold">
                    <Music size={20} /> Áudio Salvo
                  </div>
                  <div className="flex gap-2">
                    <button 
                       onClick={() => playCustomAudio(senior.medications.find(m => m.id === audioConfigMedId)?.customAudio!)}
                       className="p-2 bg-white rounded-full text-teal-600 shadow-sm hover:bg-teal-100"
                    >
                       <Play size={16} fill="currentColor" />
                    </button>
                    <button 
                       onClick={() => updateMedicationAudio(audioConfigMedId, undefined)}
                       className="p-2 bg-white rounded-full text-red-500 shadow-sm hover:bg-red-50"
                    >
                       <Trash2 size={16} />
                    </button>
                  </div>
               </div>
            )}
          </div>
        </div>
      )}


      {/* 2. Área de Conteúdo Rolável (Flex-1) */}
      <main className="flex-1 overflow-y-auto scroll-smooth w-full relative">
        <div className="p-4 space-y-4 pb-6">
        
        {/* MODO IDOSO: Lista Simples */}
        {!isEditMode && (
           <>
             <div className="flex items-center gap-2 mb-2 sticky top-0 bg-inherit z-10 py-2" onClick={() => speak("Toque no botão verde se já tomou o remédio.")}>
                <Volume2 className="text-blue-600" />
                <h2 className="text-xl font-bold text-gray-700">Seus Remédios de Hoje</h2>
             </div>

             {sortedMeds.length === 0 && (
                 <div className="text-center py-20 opacity-50">
                    <p className="text-2xl text-gray-500">Nenhum remédio hoje.</p>
                 </div>
             )}

             {sortedMeds.map((med) => {
                const late = isLate(med.time, med.status);
                const taken = med.status === MedicationStatus.TAKEN;
                const isRinging = ringingMedId === med.id;

                return (
                    <div 
                        key={med.id} 
                        className={`
                            relative p-5 rounded-3xl border-2 shadow-sm transition-all duration-500
                            ${taken 
                                ? 'bg-gray-50 border-gray-200 opacity-70' 
                                : isRinging
                                    ? 'bg-yellow-50 border-yellow-500 scale-105 shadow-xl ring-4 ring-yellow-200 ring-opacity-50'
                                    : late 
                                        ? 'bg-red-50 border-red-400' 
                                        : 'bg-white border-blue-400'
                            }
                        `}
                    >
                        {isRinging && (
                            <div className="absolute -top-3 -right-3 bg-yellow-500 text-white p-2 rounded-full animate-bounce z-10 shadow-lg">
                                <AlarmClock size={28} />
                            </div>
                        )}

                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                                <span className={`text-3xl font-black ${taken ? 'text-gray-400 line-through' : 'text-blue-900'}`}>
                                    {med.time}
                                </span>
                                {late && !isRinging && (
                                    <span className="bg-red-600 text-white px-2 py-0.5 rounded-full text-xs font-bold uppercase animate-bounce">
                                        Atrasado
                                    </span>
                                )}
                                {isRinging && (
                                    <span className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-bold uppercase animate-pulse">
                                        HORA DO REMÉDIO!
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {/* Custom Audio Play Button */}
                                {med.customAudio && !taken && !isRinging && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); playCustomAudio(med.customAudio!); }}
                                        className="p-2 bg-yellow-100 text-yellow-700 rounded-full hover:bg-yellow-200 animate-pulse"
                                        title="Ouvir lembrete"
                                    >
                                        <Volume2 size={24} />
                                    </button>
                                )}
                                <button 
                                    onClick={(e) => { e.stopPropagation(); checkMedicationInfo(med.name); }}
                                    className="p-2 bg-indigo-50 text-indigo-500 rounded-full hover:bg-indigo-100"
                                    title="O que é isso?"
                                >
                                    {loadingAi ? <span className="animate-spin block">↻</span> : <Wand2 size={20} />}
                                </button>
                            </div>
                        </div>
                        
                        <div className="mb-4">
                            <h3 className={`text-2xl font-bold leading-tight ${taken ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                {med.name}
                            </h3>
                            <p className="text-lg text-gray-500">{med.dosage}</p>
                        </div>

                        {!taken ? (
                            <button 
                                onClick={() => handleTaken(med.id, med.name)}
                                className={`
                                    w-full py-4 rounded-xl text-xl font-bold text-white shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2
                                    ${isRinging 
                                        ? 'bg-yellow-500 hover:bg-yellow-600 animate-pulse' 
                                        : late 
                                            ? 'bg-red-600 hover:bg-red-700' 
                                            : 'bg-green-600 hover:bg-green-700'
                                    }
                                `}
                            >
                                <Check size={28} strokeWidth={4} />
                                {isRinging ? 'JÁ VOU TOMAR!' : 'TOMEI'}
                            </button>
                        ) : (
                            <div className="w-full py-3 text-center text-green-700 font-bold text-lg bg-green-100 rounded-xl flex items-center justify-center gap-2">
                                <Check size={20} /> Confirmado
                            </div>
                        )}
                    </div>
                );
            })}
           </>
        )}

        {/* MODO AJUSTES: Ferramentas de Gestão */}
        {isEditMode && (
            <div className="animate-in slide-in-from-top-4 space-y-6">
                
                {/* Form to Add */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-teal-100">
                    <h3 className="font-bold text-teal-800 text-lg mb-4 flex items-center gap-2">
                        <Plus size={20} /> Adicionar Novo
                    </h3>
                    <form onSubmit={handleAddSubmit} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-gray-600">Nome do Remédio</label>
                            <input 
                                type="text" 
                                value={newMedName}
                                onChange={e => setNewMedName(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                                placeholder="Ex: Losartana"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-gray-600">Dose</label>
                                <input 
                                    type="text" 
                                    value={newMedDosage}
                                    onChange={e => setNewMedDosage(e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                                    placeholder="50mg"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-600">Hora</label>
                                <input 
                                    type="time" 
                                    value={newMedTime}
                                    onChange={e => setNewMedTime(e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                                    required
                                />
                            </div>
                        </div>

                        {/* Audio Section for New Med */}
                        <div className="pt-2">
                             <label className="text-sm font-medium text-gray-600 mb-2 block">Som do Lembrete (Opcional)</label>
                             <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                {newMedAudio ? (
                                    <div className="flex items-center justify-between">
                                         <div className="flex items-center gap-2 text-teal-600 font-bold">
                                            <Music size={20} />
                                            <span className="text-sm">Áudio Definido</span>
                                         </div>
                                         <div className="flex gap-2">
                                            <button 
                                                type="button"
                                                onClick={() => playCustomAudio(newMedAudio)}
                                                className="p-2 bg-white rounded-lg text-teal-600 shadow-sm"
                                            >
                                                <Play size={16} />
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => setNewMedAudio(null)}
                                                className="p-2 bg-white rounded-lg text-red-500 shadow-sm"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                         </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        {!isRecordingNew ? (
                                            <button 
                                                type="button"
                                                onClick={startRecordingNew}
                                                className="flex-1 py-2 bg-red-100 text-red-600 rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-red-200"
                                            >
                                                <Mic size={18} /> Gravar Voz
                                            </button>
                                        ) : (
                                            <button 
                                                type="button"
                                                onClick={stopRecordingNew}
                                                className="flex-1 py-2 bg-gray-800 text-white rounded-lg flex items-center justify-center gap-2 font-medium animate-pulse"
                                            >
                                                <Square size={16} fill="white" /> Parar
                                            </button>
                                        )}
                                        <label className="flex-1 py-2 bg-white border border-gray-300 rounded-lg flex items-center justify-center gap-2 font-medium cursor-pointer hover:bg-gray-50 text-gray-600">
                                            <Upload size={18} /> MP3
                                            <input type="file" accept="audio/*" onChange={handleFileUploadNew} className="hidden" />
                                        </label>
                                    </div>
                                )}
                             </div>
                        </div>

                        <button type="submit" className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700">
                            Salvar Medicamento
                        </button>
                    </form>
                </div>

                {/* List with Delete and Audio Option */}
                <div className="space-y-2">
                    <h3 className="font-bold text-gray-700 ml-1">Gerenciar Existentes</h3>
                    {senior.medications.map(med => (
                        <div key={med.id} className="bg-white p-4 rounded-xl border border-gray-200 flex justify-between items-center">
                            <div>
                                <p className="font-bold text-gray-800">{med.name} <span className="text-teal-600 text-sm ml-2">{med.time}</span></p>
                                <p className="text-xs text-gray-500">{med.dosage}</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setAudioConfigMedId(med.id)}
                                    className={`p-2 rounded-lg hover:bg-yellow-50 transition-colors ${med.customAudio ? 'text-yellow-600 bg-yellow-50' : 'text-gray-400 bg-gray-50'}`}
                                    title="Configurar Áudio"
                                >
                                    <Music size={20} />
                                </button>
                                <button 
                                    onClick={() => removeMedication(med.id)}
                                    className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* History Toggle */}
                <button 
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full py-3 bg-indigo-50 text-indigo-700 rounded-xl font-semibold flex items-center justify-center gap-2"
                >
                    <History size={20} />
                    {showHistory ? 'Ocultar Histórico' : 'Ver Histórico de Uso'}
                </button>

                {showHistory && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 max-h-60 overflow-y-auto">
                        {senior.logs.length === 0 ? (
                            <p className="text-center text-gray-400 py-4">Sem registros.</p>
                        ) : (
                            senior.logs.map(log => (
                                <div key={log.id} className="py-2 border-b border-gray-50 last:border-0 flex justify-between text-sm">
                                    <span className="text-gray-600">{log.medicationName}</span>
                                    <span className="text-green-600 font-medium">
                                        {new Date(log.actionTime).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})} - {new Date(log.actionTime).toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        )}
        
        </div>
      </main>

      {/* 3. Rodapé Fixo (Flex None) - Botão de Emergência */}
      {!isEditMode && (
        <div className="flex-none p-4 bg-yellow-50 border-t border-yellow-100 z-20 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)]">
            <button 
                onClick={handleEmergency}
                disabled={emergencyActive}
                className={`
                    w-full py-5 rounded-3xl text-xl font-bold text-white shadow-xl flex items-center justify-center gap-3 transition-all
                    ${emergencyActive ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 animate-pulse-red'}
                `}
            >
                <AlertTriangle size={32} fill="white" className="text-red-500" />
                {emergencyActive ? 'AJUDA SOLICITADA' : 'PRECISO DE AJUDA'}
            </button>
        </div>
      )}
    </div>
  );
};

export default UnifiedView;
