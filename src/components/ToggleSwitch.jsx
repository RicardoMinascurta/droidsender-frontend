import React from 'react';

const ToggleSwitch = ({ label, enabled, setEnabled }) => {
  return (
    <label className="flex items-center cursor-pointer">
      <div className="relative">
        {/* Input oculto */}
        <input 
          type="checkbox" 
          className="sr-only" // Esconde o checkbox padrão
          checked={enabled}
          onChange={() => setEnabled(!enabled)}
        />
        {/* Linha de fundo */}
        <div className={`block w-10 h-6 rounded-full transition ${enabled ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
        {/* Ponto/Círculo */}
        <div 
          className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform ${enabled ? 'translate-x-4' : ''}`}
        ></div>
      </div>
      {/* Label Opcional */}
      {label && <span className="ml-3 text-sm font-medium text-gray-700">{label}</span>}
    </label>
  );
};

export default ToggleSwitch; 