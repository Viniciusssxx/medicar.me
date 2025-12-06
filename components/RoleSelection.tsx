import React from 'react';
import { useApp } from '../context/AppContext';
import { User, Heart } from 'lucide-react';

const RoleSelection: React.FC = () => {
  const { switchRole } = useApp();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-blue-900 mb-2">Lembre dos Remédios</h1>
          <p className="text-gray-600 text-lg">Quem está usando este dispositivo?</p>
        </div>

        <div className="grid gap-6">
          <button
            onClick={() => switchRole('SENIOR')}
            className="group relative bg-white border-2 border-blue-200 p-8 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-400 transition-all flex flex-col items-center gap-4"
          >
            <div className="bg-blue-100 p-4 rounded-full group-hover:bg-blue-200 transition-colors">
              <User size={48} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Sou o Idoso(a)</h2>
              <p className="text-gray-500">Quero ver meus remédios do dia</p>
            </div>
          </button>

          <button
            onClick={() => switchRole('CAREGIVER')}
            className="group relative bg-white border-2 border-teal-200 p-8 rounded-2xl shadow-sm hover:shadow-md hover:border-teal-400 transition-all flex flex-col items-center gap-4"
          >
            <div className="bg-teal-100 p-4 rounded-full group-hover:bg-teal-200 transition-colors">
              <Heart size={48} className="text-teal-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Sou Familiar/Cuidador</h2>
              <p className="text-gray-500">Quero configurar remédios e horários</p>
            </div>
          </button>
        </div>
        
        <p className="text-xs text-gray-400 mt-8">Versão MVP 1.0 - Simulação de Dados Locais</p>
      </div>
    </div>
  );
};

export default RoleSelection;