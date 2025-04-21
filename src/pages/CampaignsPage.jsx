import React, { useState, useEffect, useCallback } from 'react';
// Importar o Modal
import Modal from '../components/Modal'; 
// Importar apiClient para chamadas à API
import apiClient from '../lib/apiClient';
// Importar ícone (opcional, para botões de ação)
import { Play, Loader2, Trash2, CheckSquare, Square, Eye } from 'lucide-react'; 
// Importar useAuth para aceder ao socket
import { useAuth } from '../contexts/AuthContext';
// Importar o Badge
import Badge from '../components/Badge';
// Importar xlsx
import * as XLSX from 'xlsx';
// Importar o ToggleSwitch
import ToggleSwitch from '../components/ToggleSwitch';
import { Tooltip } from 'react-tooltip';
import styled from 'styled-components';
// Importar o DeviceStatusPanel
import DeviceStatusPanel from '../components/DeviceStatusPanel';
// Importar o ProgressBar do ficheiro separado
import ProgressBar from '../components/ProgressBar';

// Componente com animação de destaque
const HighlightableCell = styled.td`
  transition: background-color 0.5s ease;
  &.highlight {
    background-color: rgba(59, 130, 246, 0.2); /* Azul claro */
  }
`;

// Atualizar o Badge.jsx diretamente aqui como um componente interno temporário até modificar o próprio arquivo
const BadgeWithDelivery = ({ status, customText }) => {
  // Se for fornecido um texto personalizado, usar ele
  const text = customText || {
    'pending': 'Pendente',           // Campanha acabada de criar, ainda não iniciada
    'draft': 'Rascunho',
    'scheduled': 'Agendada',
    'processing': 'Em Progresso',    // Campanha a ser processada
    'sending': 'Em Progresso',       // Campanha a enviar SMS
    'sent': 'Enviado',               // SMS individual enviado para a rede
    'delivered': 'Entregue',         // SMS individual confirmado entregue
    'delivery_failed': 'Entrega Falhou', // SMS individual com falha na entrega
    'failed': 'Falhou',              // SMS individual com falha no envio
    'completed': 'Concluído'         // Campanha concluída
  }[status] || status;

  // Mapeamento de cores
  const colors = {
    'pending': 'bg-gray-100 text-gray-800', // Pendente com cor cinza
    'draft': 'bg-gray-100 text-gray-800',
    'scheduled': 'bg-blue-100 text-blue-800',
    'processing': 'bg-blue-100 text-blue-800', // Em Progresso com cor azul
    'sending': 'bg-blue-100 text-blue-800',    // Em Progresso com cor azul
    'sent': 'bg-yellow-100 text-yellow-800',   // Nova cor para enviado (não confirmado)
    'delivered': 'bg-green-100 text-green-800', // Verde para entregue
    'delivery_failed': 'bg-red-100 text-red-800', // Vermelho para falha na entrega
    'failed': 'bg-red-100 text-red-800',
    'completed': 'bg-green-100 text-green-800'  // Concluído com cor verde
  };

  const colorClass = colors[status] || 'bg-gray-100 text-gray-800';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {text}
    </span>
  );
};

function CampaignsPage() {
  // Log de inicialização
  console.log(`%c[CampaignsPage] ==================== CampaignsPage INICIALIZADA ==================== (${new Date().toISOString()})`, 'color: white; background-color: #17a2b8; font-size: 16px; padding: 5px;');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Renomear isLoading para evitar conflito
  const [submitError, setSubmitError] = useState(''); // Renomear errorMessage
  
  // Estado para o formulário
  const [campaignName, setCampaignName] = useState('');
  const [campaignFile, setCampaignFile] = useState(null);
  const [campaignMessage, setCampaignMessage] = useState('');
  const [scheduleImmediately, setScheduleImmediately] = useState(true);
  // Novo estado para contagem de destinatários
  const [detectedRecipientsCount, setDetectedRecipientsCount] = useState(null);
  // Novo estado para modo de variáveis
  const [isVariableMode, setIsVariableMode] = useState(false);
  // Novos estados para agendamento
  const [isScheduled, setIsScheduled] = useState(false);
  // Novos estados para data e hora separadas
  const [scheduledDate, setScheduledDate] = useState(''); // YYYY-MM-DD
  const [scheduledTime, setScheduledTime] = useState(''); // HH:MM

  // Estados para a Lista de Campanhas
  const [campaigns, setCampaigns] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState('');

  // Novos Estados para Iniciar Campanha
  const [isStartingCampaignId, setIsStartingCampaignId] = useState(null); // ID da campanha a iniciar
  const [startError, setStartError] = useState(''); // Erro ao iniciar

  // Adicionar estado de loading para delete em massa
  const [isDeleting, setIsDeleting] = useState(false); 
  const [bulkDeleteError, setBulkDeleteError] = useState(''); // Estado dedicado para erros de delete

  // Novo Estado para Seleção
  const [selectedCampaignIds, setSelectedCampaignIds] = useState(new Set());

  // Novo estado para modal de detalhes
  const [viewingCampaign, setViewingCampaign] = useState(null);

  // Obter socket do contexto
  const { socket } = useAuth();

  // Log inicial do socket
  console.log(`[CampaignsPage] Estado inicial do socket obtido do useAuth: ${socket ? `Conectado? ${socket.connected}, ID: ${socket.id}` : 'NULO'}`);
  
  // Calcular contagem de caracteres e SMS
  const characterCount = campaignMessage.length;
  let smsCount = 0;
  if (characterCount > 0) {
    // Simplificação: Assume codificação GSM-7. Unicode (emojis, etc.) usa limites menores (70/67).
    if (characterCount <= 160) {
      smsCount = 1;
    } else {
      smsCount = Math.ceil(characterCount / 153); // Limite por parte para mensagens longas
    }
  }

  // Função para buscar campanhas
  const fetchCampaigns = useCallback(async () => {
    console.log('%c[CampaignsPage] Iniciando fetchCampaigns...', 'color: blue;');
    setIsLoadingList(true);
    setListError('');
    try {
      console.log(`[CampaignsPage] Chamando apiClient.get('/api/campaigns')`);
      const response = await apiClient.get('/api/campaigns');
      console.log('[CampaignsPage] Recebida resposta da API:', response.data);
      console.log('[CampaignsPage] DEFININDO ESTADO campaigns com os dados recebidos.');
      setCampaigns(response.data); 
    } catch (error) {
      console.error("[CampaignsPage] Erro em fetchCampaigns:", error);
      
      // Verificar se o erro é de autenticação (401)
      if (error.response && error.response.status === 401) {
        // Mostrar mensagem de erro de autenticação
        setListError("Sessão expirada ou inválida. Por favor, faça login novamente.");
        // Redirecionar para a página de login após 2 segundos
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        // Outro tipo de erro
        setListError(error.response?.data?.message || error.message || "Erro ao carregar campanhas.");
      }
      
      setCampaigns([]); // Limpar campanhas em caso de erro
    } finally {
      console.log('%c[CampaignsPage] fetchCampaigns finalizado.', 'color: blue;');
      setIsLoadingList(false);
    }
  }, []);

  // Buscar campanhas ao montar o componente
  useEffect(() => {
    console.log('[CampaignsPage] Executando useEffect para chamar fetchCampaigns na montagem.');
    fetchCampaigns();
    // Log de limpeza do efeito (mesmo que não haja limpeza real aqui)
    return () => console.log('%c[CampaignsPage] Limpando useEffect da montagem (fetchCampaigns).', 'color: gray;'); 
  }, [fetchCampaigns]);

  const openModal = () => {
    console.log('[CampaignsPage] Abrindo modal Nova Campanha...');
    setCampaignName('');
    setCampaignFile(null);
    setCampaignMessage('');
    setDetectedRecipientsCount(null);
    setIsVariableMode(false); 
    setIsScheduled(false);
    setScheduledDate(''); // Resetar data
    setScheduledTime(''); // Resetar hora
    setSubmitError('');
    setIsModalOpen(true);
  }
  const closeModal = () => {
     console.log('[CampaignsPage] Fechando modal Nova Campanha.');
     setIsModalOpen(false);
  }

  // Modificar handleFileChange para ler e processar
  const handleFileChange = (event) => {
    const file = event.target.files && event.target.files[0];
    console.log(`[CampaignsPage] Ficheiro selecionado: ${file ? file.name : 'Nenhum'}`);
    setCampaignFile(file);
    setDetectedRecipientsCount(null);
    setSubmitError('');

    if (file) {
      console.log('[CampaignsPage] Lendo ficheiro Excel...');
      const reader = new FileReader();
      reader.onload = (e) => {
        console.log('[CampaignsPage] Ficheiro Excel lido com sucesso. Processando dados...');
        try {
          const data = e.target.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (!jsonData || jsonData.length < 2) {
            setDetectedRecipientsCount(0);
            setSubmitError("Ficheiro Excel vazio ou sem dados após cabeçalho.");
            return;
          }

          const header = jsonData[0].map(h => String(h).trim().toLowerCase());
          const phoneIndex = header.indexOf('telefone');
          const nameIndex = header.indexOf('nome'); // Procurar também a coluna nome

          // Validação das colunas necessárias
          if (phoneIndex === -1) {
             console.error(`[CampaignsPage] Erro: Coluna 'telefone' não encontrada.`);
             setSubmitError('Coluna \'telefone\' não encontrada no ficheiro Excel.');
             setDetectedRecipientsCount(0);
             return;
          }
          // Se o modo variáveis estiver ativo, a coluna nome também é obrigatória
          if (isVariableMode && nameIndex === -1) {
             setSubmitError('Modo variáveis ativo: Coluna \'nome\' não encontrada no ficheiro Excel.');
             setDetectedRecipientsCount(0);
             return;
          }

          let count = 0;
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            const phoneNumber = row[phoneIndex] ? String(row[phoneIndex]).trim() : null;
            if (phoneNumber && phoneNumber.length > 5) {
              count++;
            }
          }
          setDetectedRecipientsCount(count);
          console.log(`[CampaignsPage] Processamento concluído. Detetados ${count} destinatários válidos.`);

        } catch (error) {
          console.error("Erro ao processar ficheiro Excel:", error);
          setSubmitError("Erro ao ler o ficheiro Excel. Verifique o formato.");
          setDetectedRecipientsCount(0);
        }
      };
      reader.onerror = (error) => {
         console.error("[CampaignsPage] Erro ao ler ficheiro:", error);
         setSubmitError("Não foi possível ler o ficheiro selecionado.");
         setDetectedRecipientsCount(0);
      };
      reader.readAsArrayBuffer(file);
    } else {
       setDetectedRecipientsCount(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault(); 
    console.log('%c[CampaignsPage] Iniciando handleSubmit (Criar Campanha)...', 'color: green; font-weight: bold;');
    setIsSubmitting(true);
    setSubmitError('');

    if (!campaignFile) {
        setSubmitError('Por favor, selecione um ficheiro Excel.');
        setIsSubmitting(false);
        return;
    }

    if (isScheduled && (!scheduledDate || !scheduledTime)) {
        setSubmitError('Por favor, selecione uma data e hora válidas para o agendamento.');
        setIsSubmitting(false);
        return;
    }

    const formData = new FormData();
    formData.append('name', campaignName);
    formData.append('messageTemplate', campaignMessage);
    formData.append('file', campaignFile);
    // Combinar data e hora e adicionar ao FormData se agendado
    let combinedDateTime = null;
    if (isScheduled && scheduledDate && scheduledTime) {
        try {
            // Assume que o backend espera uma string ISO 8601 UTC
            combinedDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
            formData.append('scheduledAt', combinedDateTime);
        } catch (e) {
            console.error("Erro ao combinar data e hora:", e);
            setSubmitError('Formato inválido de data ou hora selecionado.');
            setIsSubmitting(false);
            return;
        }
    }

    console.log('[CampaignsPage] Enviando FormData para /api/campaigns:', {
      name: campaignName,
      messageTemplate: campaignMessage,
      file: campaignFile ? campaignFile.name : null,
      isScheduled: isScheduled,
      scheduledAt: combinedDateTime,
    });

    try {
      const response = await apiClient.post('/api/campaigns', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      console.log('[CampaignsPage] Resposta da API (criar campanha) recebida:', response.data);
      console.log('[CampaignsPage] Campanha criada com sucesso! Fechando modal e atualizando lista.');
      closeModal();
      fetchCampaigns();
    } catch (error) {
      console.error('[CampaignsPage] Erro ao criar campanha:', error);
      const message = error.response?.data?.message || error.message || 'Erro desconhecido ao criar campanha.';
      setSubmitError(message);
    } finally {
      console.log('%c[CampaignsPage] handleSubmit finalizado.', 'color: green; font-weight: bold;');
      setIsSubmitting(false);
    }
  };

  // Implementar handleStartCampaign com API call
  const handleStartCampaign = async (campaignId) => {
    console.log(`%c[CampaignsPage] Iniciando handleStartCampaign para ID: ${campaignId}...`, 'color: orange; font-weight: bold;');
    setIsStartingCampaignId(campaignId); 
    setStartError(''); 

    // Remover atualização visual antecipada para evitar conflito com o backend
    // O estado só deve mudar após a resposta do servidor

    try {
      console.log(`[CampaignsPage] Chamando apiClient.post('/api/campaigns/${campaignId}/start')`);
      await apiClient.post(`/api/campaigns/${campaignId}/start`);
      console.log(`[CampaignsPage] API /start respondeu com sucesso para ${campaignId}. Atualizando lista...`);
      // Atualizar a lista para refletir mudança de status
      fetchCampaigns(); 
    } catch (error) {
      console.error(`[CampaignsPage] Erro ao iniciar campanha ${campaignId}:`, error);
      const message = error.response?.data?.message || error.message || "Erro ao iniciar campanha.";
      setStartError(`Erro ao iniciar campanha ${campaignId}: ${message}`);
      
      // Alert temporário
      alert(message);
    } finally {
      console.log(`%c[CampaignsPage] handleStartCampaign finalizado para ID: ${campaignId}.`, 'color: orange; font-weight: bold;');
      setIsStartingCampaignId(null); 
    }
  };

  // Modificar formatDate para incluir hora se necessário
  const formatDate = (dateString, includeTime = false) => {
    if (!dateString) return '-';
    try {
      const options = {
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        ...(includeTime && { hour: '2-digit', minute: '2-digit' }) // Adiciona hora/minuto se includeTime for true
      };
      return new Date(dateString).toLocaleString('pt-PT', options);
    } catch (e) {
      return dateString; 
    }
  };

  // useEffect para ouvir eventos do Socket.IO
  useEffect(() => {
    console.log(`%c[CampaignsPage] Executando useEffect para listeners de socket... (Socket: ${socket ? `Conectado? ${socket.connected}, ID: ${socket.id}` : 'NULO'})`, 'color: #6f42c1; font-weight: bold;');
    
    if (!socket) {
      console.warn('[CampaignsPage] Socket NULO neste render do useEffect. Não configurando listeners.');
      return;
    }

    console.log('[CampaignsPage] Socket VÁLIDO. Configurando listeners (campaignProgress, campaignStatusUpdate, connect, disconnect)...');
    
    // Listener para campaignProgress (Atualização Direta)
    const handleCampaignProgress = (data) => {
      console.log(`%c[CampaignsPage] RECEBIDO VIA SOCKET (campaignProgress)`, 'color: white; background-color: #ffc107; color: black;', data);
      
      if (typeof data !== 'object' || data === null || typeof data.campaignId === 'undefined') {
          console.warn('[CampaignsPage] Dados inválidos no evento campaignProgress:', data);
          return;
      }
      
      const { 
        campaignId, 
        successCount,
        failureCount,
        totalRecipients 
      } = data;
      
      // ATUALIZAR ESTADO DIRETAMENTE
      setCampaigns(prevCampaigns => {
        console.log(`%c[CampaignsPage] ATUALIZANDO estado diretamente para campanha ${campaignId} via campaignProgress`, 'color: purple;');
        return prevCampaigns.map(campaign => {
          if (campaign.id === campaignId) {
            // Define o status para 'sending' se ainda estava pendente e houve progresso
            const newStatus = (campaign.status === 'pending' && (successCount > 0 || failureCount > 0)) 
                              ? 'sending' 
                              : campaign.status;
            // Define como 'completed' se processou todos (e não era já completed/failed)
            const processedCount = (Number(successCount) || 0) + (Number(failureCount) || 0);
            const finalStatus = (processedCount >= Number(totalRecipients) && newStatus === 'sending')
                                ? 'completed'
                                : newStatus;
            return {
              ...campaign,
              status: finalStatus,
              success_count: Number(successCount) || 0,
              failure_count: Number(failureCount) || 0,
              recipients_total: Number(totalRecipients) || campaign.recipients_total || 0,
              recipients_processed: processedCount
            };
          }
          return campaign;
        });
      });
    };
    
    // Listener para campaignStatusUpdate (Atualização Direta)
    const handleCampaignStatusUpdate = (data) => {
      console.log(`%c[CampaignsPage] RECEBIDO VIA SOCKET (campaignStatusUpdate)`, 'color: white; background-color: #17a2b8;', data);
      
      const { campaignId, status } = data;
      if (!campaignId || !status) {
        console.warn('[CampaignsPage] Dados inválidos no evento campaignStatusUpdate:', data);
        return;
      }
      
      // ATUALIZAR ESTADO DIRETAMENTE
      setCampaigns(prevCampaigns => {
        console.log(`%c[CampaignsPage] ATUALIZANDO estado diretamente para campanha ${campaignId} via campaignStatusUpdate (status: ${status})`, 'color: purple;');
        return prevCampaigns.map(campaign => {
          if (campaign.id === campaignId) {
            return { ...campaign, status: status };
          }
          return campaign;
        });
      });
    };
    
    // Listener: connect (NOVO)
    const handleConnect = () => {
        console.log(`%c[CampaignsPage] EVENTO SOCKET 'connect' RECEBIDO! ID: ${socket.id}.`, 'color: green; font-weight: bold;');
        // Poderíamos re-buscar campanhas aqui se necessário, mas geralmente não é preciso nesta página.
        // fetchCampaigns(); 
    };

    // Listener: disconnect (NOVO)
    const handleDisconnect = (reason) => {
        console.error(`%c[CampaignsPage] EVENTO SOCKET 'disconnect' RECEBIDO! Razão: ${reason}`, 'color: red; font-weight: bold;');
    };
    
    // --- REGISTRAR LISTENERS --- 
    // (Registrar os novos handlers diretos)
    socket.on('campaignProgress', handleCampaignProgress);
    socket.on('campaignStatusUpdate', handleCampaignStatusUpdate);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    
    // --- Limpeza do Efeito --- 
    return () => {
      // ... (Limpar os listeners registrados)
      socket.off('campaignProgress', handleCampaignProgress);
      socket.off('campaignStatusUpdate', handleCampaignStatusUpdate);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      // Remover clearTimeout se existia
      // clearTimeout(updateTimeout);
    };
  }, [socket]); // Dependência apenas no socket (pois setCampaigns é estável)

  // Função para lidar com seleção de linha
  const handleSelectCampaign = (campaignId) => {
    console.log(`[CampaignsPage] Selecionando/desselecionando campanha ID: ${campaignId}`);
    setSelectedCampaignIds(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(campaignId)) {
        newSelected.delete(campaignId);
      } else {
        newSelected.add(campaignId);
      }
      console.log('[CampaignsPage] Novo estado selectedCampaignIds:', newSelected);
      return newSelected;
    });
  };

  // Função para selecionar/desselecionar todos
  const handleSelectAll = (event) => {
    const isChecked = event.target.checked;
    console.log(`[CampaignsPage] Selecionar tudo: ${isChecked}`);
    if (isChecked) {
      // Selecionar todos os IDs visíveis/existentes
      const allIds = new Set(campaigns.map(c => c.id));
      setSelectedCampaignIds(allIds);
    } else {
      // Limpar seleção
      setSelectedCampaignIds(new Set());
    }
  };

  // Função para apagar campanhas selecionadas
  const handleDeleteSelectedCampaigns = async () => {
    const idsToDelete = Array.from(selectedCampaignIds);
    if (idsToDelete.length === 0) {
      alert("Nenhuma campanha selecionada para apagar.");
      return;
    }

    if (!window.confirm(`Tem a certeza que deseja apagar ${idsToDelete.length} campanha(s)? Esta ação não pode ser desfeita.`)) {
      return;
    }

    console.log(`%c[CampaignsPage] Iniciando handleDeleteSelectedCampaigns para IDs: ${idsToDelete.join(', ')}...`, 'color: red; font-weight: bold;');
    setIsDeleting(true);
    setBulkDeleteError(''); // Limpar erro anterior de delete em massa
    setListError(''); // Limpar erro geral da lista

    // Enviar pedidos de delete (podem ser em paralelo)
    const deletePromises = idsToDelete.map(id => {
      console.log(`[CampaignsPage] Chamando apiClient.delete('/api/campaigns/${id}')`);
      return apiClient.delete(`/api/campaigns/${id}`);
    });
    const results = await Promise.allSettled(deletePromises);

    const successfullyDeletedIds = [];
    const failedDeletions = [];

    results.forEach((result, index) => {
      const campaignId = idsToDelete[index];
      if (result.status === 'fulfilled') {
        successfullyDeletedIds.push(campaignId);
        console.log(`[CampaignsPage] Campaign ${campaignId} deleted successfully.`);
      } else {
        const errorMessage = result.reason?.response?.data?.message || result.reason?.message || 'Erro desconhecido';
        console.error(`[CampaignsPage] Error deleting campaign ${campaignId}:`, result.reason);
        failedDeletions.push({ id: campaignId, error: errorMessage });
      }
    });

    // Atualizar estado local removendo os apagados com sucesso
    if (successfullyDeletedIds.length > 0) {
       setCampaigns(prevCampaigns => prevCampaigns.filter(c => !successfullyDeletedIds.includes(c.id)));
    }
    
    // Limpar seleção
    setSelectedCampaignIds(new Set());
    setIsDeleting(false);

    // Mostrar erros, se houver (usando bulkDeleteError)
    if (failedDeletions.length > 0) {
      const errorSummary = failedDeletions.map(f => `ID ${f.id}: ${f.error}`).join('\n');
      // Usar o estado dedicado
      setBulkDeleteError(`Falha ao apagar ${failedDeletions.length} campanha(s). Verifique os detalhes ou os logs do servidor.`); 
      // Manter o alert temporário para visibilidade imediata
      alert(`Falha ao apagar ${failedDeletions.length} campanha(s). Verifique a mensagem de erro acima da tabela ou os logs do servidor.`);
    }
  };

  // Funções para o modal de detalhes
  const openDetailsModal = (campaign) => {
    console.log("[CampaignsPage] Abrindo modal de DETALHES para:", campaign);
    setViewingCampaign(campaign);
  }
  const closeDetailsModal = () => {
     console.log("[CampaignsPage] Fechando modal de DETALHES.");
     setViewingCampaign(null);
  }

  // Calcular se todos estão selecionados (para o checkbox do cabeçalho)
  const allSelected = campaigns.length > 0 && selectedCampaignIds.size === campaigns.length;
  const isIndeterminate = selectedCampaignIds.size > 0 && selectedCampaignIds.size < campaigns.length;

  // --- Log de Renderização ---
  console.log(`%c[CampaignsPage] Renderizando... (Campanhas: ${campaigns.length}, Selecionadas: ${selectedCampaignIds.size}, Modal Aberto: ${isModalOpen}, Detalhes Abertos: ${!!viewingCampaign})`, 'color: purple;');

  return (
    <div>
      {/* Cabeçalho da Página */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Campanhas</h1>
        <div className="space-x-2 flex items-center"> {/* Adicionar flex items-center aqui também se necessário */}
          {/* Botão Apagar Selecionadas (Condicional) */} 
          {selectedCampaignIds.size > 0 && (
            <button 
              onClick={handleDeleteSelectedCampaigns}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center" // Adicionado flex items-center
              disabled={isDeleting} // Simplificar disabled
            >
              {isDeleting ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin"/> 
              ) : (
                  <Trash2 className="h-5 w-5 mr-2" /> 
              )}
               Apagar ({selectedCampaignIds.size})
            </button>
          )}
          {/* Botão Nova Campanha */}
          <button 
            onClick={openModal}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Nova Campanha
          </button>
        </div>
      </div>

      {/* Tabela de Campanhas */}
      <div className="bg-white rounded-lg shadow overflow-x-auto overflow-hidden">
        {/* Mostrar erros (incluindo bulkDeleteError) */}
        {startError && <p className="mb-3 text-sm text-center text-red-600 bg-red-100 p-2 rounded mx-4 mt-4">{startError}</p>} 
        {bulkDeleteError && <p className="mb-3 text-sm text-center text-red-600 bg-red-100 p-2 rounded mx-4 mt-4">{bulkDeleteError}</p>} {/* Mostrar erro dedicado */}
        {listError && <p className="mb-3 text-sm text-center text-red-600 bg-red-100 p-2 rounded mx-4 mt-4">{listError}</p>}

        {isLoadingList && <p className="text-center text-gray-500 py-4">A carregar campanhas...</p>}
        {!isLoadingList && !listError && (
          <> 
            {campaigns.length === 0 ? (
              <p className="text-center text-gray-500 py-4">Nenhuma campanha encontrada.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {/* Checkbox Selecionar Tudo (com alinhamento) */} 
                    <th scope="col" className="px-6 py-3 flex items-center"> {/* Adicionar flex items-center */}
                       <input 
                         type="checkbox"
                         className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                         checked={allSelected}
                         ref={el => el && (el.indeterminate = isIndeterminate)}
                         onChange={handleSelectAll}
                       />
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progresso (Sucesso/Total)</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Criada Em</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agendada Para</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {campaigns.map((campaign) => {
                    const isStartingThis = isStartingCampaignId === campaign.id;
                    const isSelected = selectedCampaignIds.has(campaign.id);
                    const successCount = campaign.success_count || 0;
                    const totalRecipients = campaign.recipients_total || 0;
                    // Atualizar condição para desativar Ações
                    const isActionDisabled = isStartingThis || isStartingCampaignId !== null || isDeleting || campaign.status === 'scheduled';
                    const canPerformAction = !isActionDisabled;
                    
                    return (
                      <tr key={campaign.id} className={`${isSelected ? 'bg-blue-50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                           <input 
                              type="checkbox"
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              checked={isSelected}
                              onChange={() => handleSelectCampaign(campaign.id)}
                            />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{campaign.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap"><BadgeWithDelivery status={campaign.status || 'pending'} /></td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {campaign.status === 'pending' ? (
                            // Para campanhas pendentes, mostrar apenas texto sem progresso na barra
                            <div className="text-sm text-gray-500">
                              {`0/${totalRecipients}`}
                            </div>
                          ) : (
                            // Para outros estados, mostrar a barra de progresso normal
                            <ProgressBar 
                              current={successCount} 
                              total={totalRecipients} 
                              failures={campaign.failure_count || 0} 
                            />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(campaign.created_at)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {campaign.status === 'scheduled' && campaign.scheduled_at 
                             ? formatDate(campaign.scheduled_at, true) // Mostrar data e hora
                             : '-'
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          {/* Botão Ver Detalhes */}
                          <button 
                            onClick={() => openDetailsModal(campaign)} 
                            className="text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center w-8 h-8"
                            title="Ver Detalhes"
                            disabled={isActionDisabled}
                          >
                            <Eye className="h-5 w-5" />
                          </button>
                          {/* Botão Iniciar (atualizar condição disabled) */}
                          {campaign.status !== 'completed' && campaign.status !== 'processing' && campaign.status !== 'scheduled' && (
                            <button 
                              onClick={() => handleStartCampaign(campaign.id)}
                              className="text-blue-600 hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center w-8 h-8" 
                              title="Iniciar Campanha"
                              disabled={isActionDisabled}
                            >
                              {isStartingThis ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {/* Modal para Nova Campanha (Estrutura Corrigida) */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={closeModal} 
        title="Nova Campanha"
      >
        {/* Conteúdo do Modal (Formulário com Grid) */}
        {submitError && <p className="mb-3 text-sm text-red-600 bg-red-100 p-2 rounded">{submitError}</p>} 
        <form onSubmit={handleSubmit}>
          {/* Grid Principal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> 
            
            {/* Coluna Esquerda */}
            <div className="space-y-4">
              {/* Campo Nome */}
              <div>
                <label htmlFor="campaignName" className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input 
                  type="text" 
                  id="campaignName"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                />
              </div>

              {/* Modo Personalizado */}
              <div> 
                <div className="flex items-center justify-between mb-1"> 
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-700">Modo Personalizado</span>
                      <Badge status={isVariableMode ? 'completed' : 'failed'} customText={isVariableMode ? 'Ativado' : 'Desativado'} /> 
                    </div>
                    <ToggleSwitch enabled={isVariableMode} setEnabled={setIsVariableMode} />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                    {isVariableMode 
                      ? "Permite usar variáveis como {nome} na mensagem. Requer colunas 'nome' e 'telefone' no Excel."
                      : "Envia a mesma mensagem para todos. Requer apenas coluna 'telefone' no Excel."
                    }
                </p>
              </div>

              {/* Agendamento */}
               <div> 
                  <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">Agendar Envio</span>
                      <ToggleSwitch enabled={isScheduled} setEnabled={setIsScheduled} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {isScheduled 
                        ? "A campanha será enviada na data e hora selecionadas abaixo."
                        : "A campanha será enviada imediatamente após a criação."
                    }
                  </p>
               </div>

              {/* Inputs de Data e Hora Condicionais */}
              {isScheduled && (
                <div className="grid grid-cols-2 gap-4"> 
                    <div>
                      <label htmlFor="scheduledDate" className="block text-sm font-medium text-gray-700 mb-1">Data Envio</label>
                      <input 
                          type="date"
                          id="scheduledDate"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          required={isScheduled}
                          disabled={isSubmitting}
                          min={new Date().toISOString().split('T')[0]} // Mínimo hoje
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label htmlFor="scheduledTime" className="block text-sm font-medium text-gray-700 mb-1">Hora Envio</label>
                      <input 
                          type="time"
                          id="scheduledTime"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          required={isScheduled}
                          disabled={isSubmitting}
                          // Poderia adicionar validação de hora mínima se a data for hoje
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                </div>
              )}
            </div> {/* Fim Coluna Esquerda */}

            {/* Coluna Direita */}
            <div className="space-y-4">
              {/* Campo Mensagem */}
              <div>
                <label htmlFor="campaignMessage" className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
                <textarea 
                  id="campaignMessage"
                  rows={10}
                  value={campaignMessage}
                  onChange={(e) => setCampaignMessage(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  placeholder={isVariableMode ? "Ex: Olá {nome}, tudo bem?" : "Digite a sua mensagem SMS aqui..."}
                />
                <div className="flex justify-end items-center mt-1 text-xs text-gray-500 space-x-4">
                    {isVariableMode && (
                        <span className="italic">Use {`{nome}`}, {`{telefone}`}, etc.</span>
                    )}
                    <span> 
                        Caracteres: {characterCount} / SMS: {smsCount}
                    </span>
                </div>
              </div>

              {/* Campo Ficheiro */}
              <div>
                <label htmlFor="campaignFile" className="block text-sm font-medium text-gray-700 mb-1">
                   {/* ... label dinâmica ... */}
                </label>
                <input 
                  type="file" 
                  id="campaignFile"
                  accept=".xlsx, .xls" 
                  onChange={handleFileChange}
                  required
                  disabled={isSubmitting}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                />
                <div className="flex justify-between items-center mt-1 text-xs text-gray-500">
                   {/* ... nome e contagem ... */}
                </div>
              </div>
            </div> {/* Fim Coluna Direita */} 

          </div> {/* Fim Grid Principal */}

          {/* Botões do Formulário (fora do grid) */}
          <div className="flex justify-end space-x-3 mt-6">
            <button 
              type="button" 
              onClick={closeModal} 
              disabled={isSubmitting}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting || !campaignName || !campaignFile || !campaignMessage || (isScheduled && (!scheduledDate || !scheduledTime))}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isSubmitting ? 'Criando...' : 'Criar Campanha'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal para Ver Detalhes */}
      {viewingCampaign && (
        <Modal
          isOpen={viewingCampaign !== null}
          onClose={closeDetailsModal}
          title="Detalhes da Campanha"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome</label>
              <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-2 rounded border border-gray-200">{viewingCampaign.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Mensagem</label>
              <div className="mt-1 text-sm text-gray-900 bg-gray-50 p-2 rounded border border-gray-200 whitespace-pre-wrap min-h-[6rem]">
                {viewingCampaign.message_template}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Ficheiro Original</label>
              <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-2 rounded border border-gray-200">{viewingCampaign.source_file_name || 'Não disponível'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Destinatários Detetados</label>
              <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-2 rounded border border-gray-200">{viewingCampaign.recipients_total || 0}</p>
            </div>
            <div className="flex justify-end mt-6">
              <button 
                type="button" 
                onClick={closeDetailsModal} 
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              >
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  )
}

export default CampaignsPage 