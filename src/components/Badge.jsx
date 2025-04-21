import React from 'react';

const Badge = ({ status, customText }) => {
  let bgColor = 'bg-gray-100';
  let textColor = 'text-gray-800';
  let text = 'Desconhecido';

  // Mapear status para cores e texto
  // Ajustar nomes/cores conforme os status do teu backend
  switch (String(status).toLowerCase()) {
    case 'draft':
    case 'pending':
      bgColor = 'bg-yellow-100';
      textColor = 'text-yellow-800';
      text = 'Pendente';
      break;
    case 'sending':
    case 'processing':
      bgColor = 'bg-blue-100';
      textColor = 'text-blue-800';
      text = 'Enviando';
      break;
    case 'completed':
      bgColor = 'bg-green-100';
      textColor = 'text-green-800';
      text = 'Concluído';
      break;
    case 'failed':
      bgColor = 'bg-red-100';
      textColor = 'text-red-800';
      text = 'Falha';
      break;
    // Adicionar outros status se necessário (ex: scheduled, paused)
    default:
      text = status ? String(status) : 'Pendente'; // Usar status recebido se não mapeado
      break;
  }

  // Sobrescrever texto se customText for fornecido
  const displayText = customText !== undefined ? customText : text;

  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor}`}
    >
      {displayText}
    </span>
  );
};

export default Badge; 