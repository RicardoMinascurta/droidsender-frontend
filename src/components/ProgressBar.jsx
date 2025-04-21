import React from 'react';
import styled from 'styled-components';

const ProgressBarContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const ProgressBarStats = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 2px;
  font-size: 0.75rem;
`;

const ProgressBarOuter = styled.div`
  width: 100%;
  height: 8px;
  background-color: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
`;

const ProgressBarInner = styled.div`
  height: 100%;
  background-color: #3b82f6;
  border-radius: 4px;
  transition: width 0.3s ease;
`;

// Componente de Barra de Progresso com melhor exibição de status
const ProgressBar = ({ current, total, failures = 0 }) => {
  // Garantir que os valores não sejam NaN ou negativos
  const safeTotal = Math.max(0, total || 0);
  const safeCurrent = Math.max(0, current || 0);
  const safeFailures = Math.max(0, failures || 0);
  
  // Limitar current ao valor máximo de total (evitar barras >100%)
  const limitedCurrent = Math.min(safeCurrent, safeTotal);
  
  // Calcular percentual
  const percentage = safeTotal > 0 ? Math.round((limitedCurrent / safeTotal) * 100) : 0;
  
  // Texto a exibir: "Sucessos/Total (Falhas)"
  const statsText = `${limitedCurrent}/${safeTotal}${safeFailures > 0 ? ` (${safeFailures} falhas)` : ''}`;
  
  return (
    <ProgressBarContainer>
      <ProgressBarStats>
        <span>{statsText}</span>
        <span>{`${percentage}%`}</span>
      </ProgressBarStats>
      <ProgressBarOuter>
        <ProgressBarInner style={{ width: `${percentage}%` }} />
      </ProgressBarOuter>
    </ProgressBarContainer>
  );
};

export default ProgressBar; 