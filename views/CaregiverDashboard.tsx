import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Trash2, ArrowLeft, History, Pill, Clock, Activity, Wand2 } from 'lucide-react';
import { MedicationStatus } from '../types';
import { GoogleGenAI } from "@google/genai";

const CaregiverDashboard: React.FC = () => {
  const { senior, updateSenior, addMedication, removeMedication, switchRole, emergencyActive, clearEmergency } = useApp();
  const [activeTab, setActiveTab] = useState<'MEDS' | 'HISTORY'>('MEDS');
  
  // Add Med Form State
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedTime, setNewMedTime] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // AI Advice State
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMedName && newMedDosage && newMedTime) {
      addMedication({
        name: newMedName,
        dosage: newMedDosage,
        time: newMedTime,
      });
      setNewMedName('');
      setNewMedDosage('');
      setNewMedTime('');
      setIsAdding(false);
    }
  };

  const checkMedicationInfo = async (medName: string) => {
    if (!process.env.API_KEY) {
        setAiAdvice("Chave de API não configurada. Não é possível consultar a IA.");
        return;
    }

    setLoadingAi(true);
    setAiAdvice(null);
    
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Forneça um resumo muito curto e simples (máximo 2 frases) sobre o medicamento ${medName}. Diga para que serve e um cuidado principal. Fale em português.`,
        });
        setAiAdvice(response.text);
    } catch (error) {
        console.error("AI Error", error);
        setAiAdvice("Não foi possível obter informações no momento.");
    } finally {
        setLoadingAi(false);
    }
  };

  if (!senior) return <div>Carregando...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => switchRole(null)} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Painel do Cuidador</h1>
            <p className="text-sm text-gray-500">Cuidando de: {senior.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
            {emergencyActive && (
                <div className="animate-pulse bg-red-100 text-red-600 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 cursor-pointer" onClick={clearEmergency}>
                    <Activity size={16} /> SOS ATIVO
                </div>
            )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-6 space-y-6">
        
        {/* Stats / Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="bg-green-100 p-2 rounded-lg text-green-600"><Pill size={20} /></div>
                    <span className="text-sm font-medium text-gray-500">Cadastrados</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{senior.medications.length}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><History size={20} /></div>
                    <span className="text-sm font-medium text-gray-500">Tomados Hoje</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">
                    {senior.medications.filter(m => m.status === MedicationStatus.TAKEN).length} / {senior.medications.length}
                </p>
            </div>
             <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="bg-amber-100 p-2 rounded-lg text-amber-600"><Clock size={20} /></div>
                    <span className="text-sm font-medium text-gray-500">Próximo</span>
                </div>
                <p className="text-lg font-semibold text-gray-800">
                    {senior.medications.find(m => m.status === MedicationStatus.PENDING)?.time || "Concluído"}
                </p>
            </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
            <button 
                onClick={() => setActiveTab('MEDS')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'MEDS' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500'}`}
            >
                Medicamentos e Horários
            </button>
            <button 
                onClick={() => setActiveTab('HISTORY')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'HISTORY' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500'}`}
            >
                Histórico de Uso
            </button>
        </div>

        {/* Content Area */}
        {activeTab === 'MEDS' && (
            <div className="space-y-4">
                {senior.medications.map(med => (
                    <div key={med.id} className="bg-white p-4 rounded-xl border border-gray-200 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 font-bold text-xs">
                                {med.time}
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                    {med.name}
                                    <button 
                                        onClick={() => checkMedicationInfo(med.name)}
                                        className="text-gray-400 hover:text-indigo-500 transition-colors"
                                        title="Perguntar IA"
                                    >
                                        <Wand2 size={14} />
                                    </button>
                                </h3>
                                <p className="text-sm text-gray-500">{med.dosage}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => removeMedication(med.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>
                ))}

                {/* AI Advice Display */}
                {loadingAi && <div className="bg-indigo-50 p-4 rounded-lg text-indigo-700 text-sm animate-pulse">Consultando assistente inteligente...</div>}
                {aiAdvice && !loadingAi && (
                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                        <div className="flex justify-between items-start mb-1">
                            <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wide">Info IA</h4>
                            <button onClick={() => setAiAdvice(null)} className="text-indigo-400 hover:text-indigo-800 text-xs">Fechar</button>
                        </div>
                        <p className="text-sm text-indigo-900 leading-relaxed">{aiAdvice}</p>
                    </div>
                )}

                {/* Add New Button or Form */}
                {!isAdding ? (
                    <button 
                        onClick={() => setIsAdding(true)}
                        className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 flex items-center justify-center gap-2 hover:border-teal-500 hover:text-teal-600 transition-colors"
                    >
                        <Plus size={20} /> Adicionar Novo Medicamento
                    </button>
                ) : (
                    <form onSubmit={handleAddSubmit} className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                        <h3 className="font-semibold text-gray-800">Novo Medicamento</h3>
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Nome do Remédio</label>
                            <input 
                                type="text" 
                                value={newMedName} 
                                onChange={e => setNewMedName(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                placeholder="Ex: Losartana"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Dosagem</label>
                                <input 
                                    type="text" 
                                    value={newMedDosage} 
                                    onChange={e => setNewMedDosage(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                    placeholder="Ex: 50mg"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Horário</label>
                                <input 
                                    type="time" 
                                    value={newMedTime} 
                                    onChange={e => setNewMedTime(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                    required
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button 
                                type="button" 
                                onClick={() => setIsAdding(false)}
                                className="flex-1 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                className="flex-1 py-2 text-white bg-teal-600 rounded-lg hover:bg-teal-700 font-medium"
                            >
                                Salvar
                            </button>
                        </div>
                    </form>
                )}
            </div>
        )}

        {activeTab === 'HISTORY' && (
            <div className="space-y-4">
                {senior.logs.length === 0 && (
                    <div className="text-center py-10 text-gray-400">Nenhum registro encontrado ainda.</div>
                )}
                {senior.logs.map(log => (
                    <div key={log.id} className="bg-white p-4 rounded-xl border-l-4 border-green-500 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="font-bold text-gray-800">{log.medicationName}</p>
                            <p className="text-xs text-gray-500">Agendado: {log.scheduledTime}</p>
                        </div>
                        <div className="text-right">
                            <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">TOMEI</span>
                            <p className="text-xs text-gray-400 mt-1">
                                {new Date(log.actionTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute:'2-digit' })}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        )}

      </main>
    </div>
  );
};

export default CaregiverDashboard;