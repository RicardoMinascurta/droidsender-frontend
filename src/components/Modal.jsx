import React from 'react';
import { X } from 'lucide-react'; // Importar ícone X

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    // Overlay
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center transition-opacity duration-300 ease-in-out p-4" // Adicionado padding p-4 ao overlay
      onClick={onClose} // Fechar ao clicar fora
    >
      {/* Container Principal do Modal */}
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-6xl flex flex-col transform transition-all duration-300 ease-in-out scale-100 max-h-[100vh]" // Aumentado de max-h-[90vh] para max-h-[95vh]
        onClick={(e) => e.stopPropagation()} // Impedir que clique dentro feche o modal
      >
        {/* Cabeçalho Fixo */}
        <div className="flex justify-between items-center border-b p-4 flex-shrink-0"> {/* Ajustado padding e adicionado flex-shrink-0 */}
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>
        
        {/* Corpo Rolável do Modal */}
        <div className="p-6 overflow-y-auto"> {/* Adicionado overflow-y-auto e padding aqui */}
          {children}
        </div>
      </div>
    </div>
  );
};

// Adicionar animação simples no index.css ou aqui se for específico
// Exemplo de Keyframes para adicionar ao index.css:
/*
@keyframes modal-fade-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
.animate-modal-fade-in {
  animation: modal-fade-in 0.3s ease-out forwards;
}
*/

export default Modal; 