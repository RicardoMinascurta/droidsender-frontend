import React, { useState, useEffect, useCallback } from 'react';
import DeviceStatusPanel from '../components/DeviceStatusPanel';
import StatsChart from '../components/StatsChart';
import apiClient from '../lib/apiClient';
import { ChevronLeft, ChevronRight, Send, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import ProgressBar from '../components/ProgressBar';
import { useAuth } from '../contexts/AuthContext';

// Função helper para formatar data como YYYY-MM-DD
const formatDate = (date) => {
    if (!(date instanceof Date) || isNaN(date)) {
        console.error("formatDate received invalid date:", date);
        return null; // Retorna null se a data for inválida
    }
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Função helper para obter texto do período
const getPeriodText = (period, date) => {
     if (!(date instanceof Date) || isNaN(date)) return '';
    const optionsLong = { year: 'numeric', month: 'long', day: 'numeric' };
    const optionsShort = { month: 'short', day: 'numeric' };
    const locale = 'pt-PT';

    try {
        switch (period) {
            case 'day':
                return date.toLocaleDateString(locale, optionsLong);
            case 'week':
                const startOfWeek = new Date(date);
                const dayOfWeek = date.getDay(); // 0=Dom, 1=Seg, ...
                const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Ajusta para segunda
                startOfWeek.setDate(diff);
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);
                // Evitar mostrar anos diferentes se a semana cruzar o ano
                if (startOfWeek.getFullYear() !== endOfWeek.getFullYear()) {
                     return `${startOfWeek.toLocaleDateString(locale, optionsShort)} - ${endOfWeek.toLocaleDateString(locale, optionsLong)}`;
                } else {
                    return `${startOfWeek.toLocaleDateString(locale, optionsShort)} - ${endOfWeek.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}`;
                }
            case 'month':
                return date.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
            default:
                return '';
        }
    } catch (e) {
        console.error("Error formatting period text:", e);
        return "Data inválida";
    }
}

function HomePage() {
    const [viewPeriod, setViewPeriod] = useState('week'); // 'day', 'week', 'month'
    const [referenceDate, setReferenceDate] = useState(new Date()); // Data de referência
    const [chartData, setChartData] = useState([]);
    const [apiResponse, setApiResponse] = useState(null); // Guardar resposta completa
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Novo estado para a campanha ativa
    const [activeCampaign, setActiveCampaign] = useState(null);
    const [loadingCampaign, setLoadingCampaign] = useState(true);
    const [campaignError, setCampaignError] = useState(null);
    
    const navigate = useNavigate();
    
    // --- ADICIONAR CHAMADA useAuth --- 
    const { socket, user, token } = useAuth();

    // Função para buscar dados da API (AJUSTADA)
    const fetchStatsData = useCallback(async () => {
        console.log(`[HomePage] fetchStatsData - Período: ${viewPeriod}, Data Ref: ${referenceDate.toISOString()}`);
        setLoading(true);
        setError(null);
        const formattedDate = formatDate(referenceDate);
        if (!formattedDate) {
            setError("Data de referência inválida.");
            setLoading(false);
            return;
        }

        try {
            console.log(`[HomePage] Chamando /api/stats com params: period=${viewPeriod}, referenceDate=${formattedDate}`);
            const response = await apiClient.get('/api/stats', {
                params: { period: viewPeriod, referenceDate: formattedDate }
            });
            console.log('[HomePage] Resposta de /api/stats recebida:', response.data);
            setApiResponse(response.data); // Guardar resposta completa (pode não ser mais necessário)

            // --- AJUSTE PRINCIPAL: Esperar sempre um array em response.data.stats --- 
            if (response.data && Array.isArray(response.data.stats)) {
                console.log(`[HomePage] Definindo chartData com ${response.data.stats.length} pontos.`);
                setChartData(response.data.stats); // Usar diretamente o array recebido
            } else {
                // Se a API não retornar o array esperado
                console.warn("[HomePage] Formato inesperado da API de stats (esperava response.data.stats como array):", response.data);
                setError("Formato de dados inválido recebido do servidor.");
                setChartData([]);
            }

        } catch (err) {
            console.error("[HomePage] Erro ao buscar estatísticas:", err);
            const errorMsg = err.response?.data?.message || "Não foi possível carregar as estatísticas.";
            setError(errorMsg);
            setChartData([]);
            setApiResponse(null);
        } finally {
            setLoading(false);
            console.log('[HomePage] fetchStatsData finalizado.');
        }
    }, [viewPeriod, referenceDate]);

    // Efeito para buscar dados quando o período ou a data mudam
    useEffect(() => {
        fetchStatsData();
    }, [fetchStatsData]);

    // Nova função para buscar campanha ativa
    const fetchActiveCampaign = useCallback(async () => {
        setLoadingCampaign(true);
        setCampaignError(null);
        
        try {
            // Garantir que a rota esteja correta - adicionamos /api no início
            const response = await apiClient.get('/api/campaigns/active');
            setActiveCampaign(response.data || null);
        } catch (err) {
            console.error("Erro ao buscar campanha ativa:", err);
            // Não mostrar erro na UI para não atrapalhar a experiência do utilizador
            // Apenas logar para debug
            setCampaignError(null);
            setActiveCampaign(null);
        } finally {
            setLoadingCampaign(false);
        }
    }, []);
    
    // Efeito para buscar campanha ativa
    useEffect(() => {
        fetchActiveCampaign();
        // Podemos configurar um intervalo para atualizar a cada x segundos se necessário
        const interval = setInterval(() => {
            fetchActiveCampaign();
        }, 30000); // Atualizar a cada 30 segundos
        
        return () => clearInterval(interval);
    }, [fetchActiveCampaign]);

    // Funções para navegação
    const handlePrevious = () => {
        const newDate = new Date(referenceDate);
        switch (viewPeriod) {
            case 'day':
                newDate.setDate(newDate.getDate() - 1);
                break;
            case 'week':
                newDate.setDate(newDate.getDate() - 7);
                break;
            case 'month':
                newDate.setMonth(newDate.getMonth() - 1);
                break;
        }
        setReferenceDate(newDate);
    };

    const handleNext = () => {
        const newDate = new Date(referenceDate);
        switch (viewPeriod) {
            case 'day':
                newDate.setDate(newDate.getDate() + 1);
                break;
            case 'week':
                newDate.setDate(newDate.getDate() + 7);
                break;
            case 'month':
                newDate.setMonth(newDate.getMonth() + 1);
                break;
        }
        // Evitar ir para o futuro
        if (newDate > new Date()) {
            // Opcional: Mostrar uma mensagem ou simplesmente não atualizar
            console.log("Não é possível navegar para o futuro.");
            return; 
        }
        setReferenceDate(newDate);
    };

    // Função para mudar o período de visualização
    const changePeriod = (newPeriod) => {
        setViewPeriod(newPeriod);
        // Resetar data para hoje ao mudar de período para evitar confusão
        setReferenceDate(new Date());
    };

    // Formatar o texto do período a exibir
    const currentPeriodText = apiResponse
        ? getPeriodText(viewPeriod, referenceDate)
        : "A carregar...";

    // --- Efeito Principal para Socket Listeners (ESTRUTURA CORRIGIDA) ---
    useEffect(() => {
        // LOG DE ENTRADA NO EFEITO
        console.log(`%c[HomePage] !!! EFEITO SOCKET LISTENERS EXECUTADO !!! (Socket existe? ${!!socket}, Socket conectado? ${socket?.connected})`, 'background: #222; color: #bada55; font-size: 14px; padding: 3px;');
        
        // Log quando o efeito é executado 
        console.log(`%c[HomePage] Executando useEffect para listeners de socket... (Socket: ${socket ? `Conectado? ${socket.connected}, ID: ${socket.id}` : 'NULO'}, ActiveCampaign ID: ${activeCampaign?.id ?? 'N/A'})`, 'color: #6f42c1; font-weight: bold;');

        if (!socket) {
          console.warn('[HomePage] Socket NULO neste render do useEffect. Não configurando listeners.');
          return; 
        }
        
        console.log('[HomePage] Socket VÁLIDO. Definindo e configurando listeners SIMPLIFICADOS...');

        // --- DEFINIÇÃO DOS HANDLERS DENTRO DO USEEFFECT --- 
        const handleActiveCampaignUpdate = (campaign) => {
          if (campaign && campaign.id) {
            console.log('%c[HomePage] RECEBIDO VIA SOCKET (activeCampaignUpdate): Campanha ATIVA', 'color: white; background-color: #28a745; font-size: 14px; padding: 3px;', campaign);
            console.log('[HomePage] DEFININDO ESTADO activeCampaign para campanha recebida.');
            setActiveCampaign(campaign);
          } else {
            console.log(`%c[HomePage] RECEBIDO VIA SOCKET (activeCampaignUpdate): Nenhuma campanha ativa (payload: ${JSON.stringify(campaign)})`, 'color: white; background-color: #dc3545; font-size: 14px; padding: 3px;');
            console.log('[HomePage] DEFININDO ESTADO activeCampaign para NULL.');
            setActiveCampaign(null);
          }
        };
        
        const handleCampaignStatusUpdate = (data) => {
          console.log(`%c[HomePage] RECEBIDO VIA SOCKET (campaignStatusUpdate): Status=${data?.status} para Campanha ID=${data?.campaignId}`, 'color: white; background-color: #ffc107; color: black; font-size: 14px; padding: 3px;', data);
          if (data && (data.status === 'completed' || data.status === 'failed')) {
             if (activeCampaign && activeCampaign.id === data.campaignId) {
                 console.log(`[HomePage] Campanha ${data.campaignId} terminou (${data.status}). DEFININDO ESTADO activeCampaign para NULL.`);
                 setActiveCampaign(null);
             } else {
                 console.log(`[HomePage] Campanha ${data.campaignId} terminou (${data.status}), mas não era a ativa. Nenhuma alteração de estado.`);
             }
          }
        };
        
        const handleConnect = () => {
          console.log(`%c[HomePage] EVENTO SOCKET 'connect' RECEBIDO! ID: ${socket.id}. Solicitando campanha ativa...`, 'color: green; font-weight: bold;');
          socket.emit('requestActiveCampaign');
        };

        const handleDisconnect = (reason) => {
            console.error(`%c[HomePage] EVENTO SOCKET 'disconnect' RECEBIDO! Razão: ${reason}`, 'color: red; font-weight: bold;');
        };

        // --- REGISTRAR LISTENERS --- 
        console.log('[HomePage] Registrando listeners: activeCampaignUpdate, campaignStatusUpdate, connect, disconnect');
        socket.on('activeCampaignUpdate', handleActiveCampaignUpdate);
        socket.on('campaignStatusUpdate', handleCampaignStatusUpdate);
        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        
        // --- EMIT INICIAL --- 
        if (socket.connected) {
          console.log(`[HomePage] Socket já conectado (${socket.id}) na montagem/execução do efeito. Solicitando campanha ativa...`);
          socket.emit('requestActiveCampaign');
        } else {
          console.warn(`[HomePage] Socket NÃO conectado na montagem/execução do efeito. Aguardando evento 'connect'...`);
        }
        
        // --- FUNÇÃO DE LIMPEZA --- 
        return () => {
          console.log(`%c[HomePage] Limpando useEffect dos listeners de socket... (Socket ID: ${socket?.id})`, 'color: #6f42c1; font-weight: bold;');
          console.log('[HomePage] Removendo listeners: activeCampaignUpdate, campaignStatusUpdate, connect, disconnect');
          socket.off('activeCampaignUpdate', handleActiveCampaignUpdate);
          socket.off('campaignStatusUpdate', handleCampaignStatusUpdate);
          socket.off('connect', handleConnect);
          socket.off('disconnect', handleDisconnect);
        };
    // --- TESTE: REMOVER setCampaignActive TEMPORARIAMENTE DAS DEPENDÊNCIAS ---
    // O ESLint vai reclamar disto, mas é para diagnóstico.
    }, [socket, token, user?.id, activeCampaign?.id]);

    console.log(`%c[HomePage] Renderizando... (Campanha Ativa: ${activeCampaign ? `ID ${activeCampaign.id}` : 'NÃO'})`, 'color: purple;');

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

            {/* Painel de Status do Dispositivo */}
            <DeviceStatusPanel />

            {/* NOVO: Card de Campanha Ativa */}
            <div className="mt-6 p-4 border rounded-lg bg-white shadow-sm">
                <h2 className="text-lg font-semibold mb-4 flex items-center">
                    <Send size={20} className="mr-2 text-blue-600" /> 
                    Campanha Atual
                </h2>
                
                {loadingCampaign ? (
                    <div className="flex justify-center items-center py-10">
                        <p className="text-gray-500 animate-pulse">A carregar campanha...</p>
                    </div>
                ) : campaignError ? (
                    <div className="flex justify-center items-center py-10 bg-red-50 rounded-md">
                        <p className="text-red-600 font-medium">{campaignError}</p>
                    </div>
                ) : activeCampaign ? (
                    <div className="space-y-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-medium text-gray-900">{activeCampaign.name}</h3>
                                <p className="text-sm text-gray-500">
                                    Iniciada: {new Date(activeCampaign.started_at || activeCampaign.created_at).toLocaleString('pt-PT')}
                                </p>
                            </div>
                            <div className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Em Progresso
                            </div>
                        </div>
                        
                        <div className="mt-2">
                            <p className="text-sm text-gray-700 mb-1">Progresso:</p>
                            <ProgressBar 
                                current={activeCampaign.success_count || 0}
                                total={activeCampaign.recipients_total || 0}
                                failures={activeCampaign.failure_count || 0}
                            />
                        </div>
                        
                        <div className="mt-2 flex justify-end">
                            <Link 
                                to={`/campaigns?id=${activeCampaign.id}`}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
                            >
                                Ver Detalhes
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="py-10 flex flex-col items-center justify-center space-y-4">
                        <p className="text-gray-500 text-center">Sem campanhas em progresso de momento.</p>
                        <button 
                            onClick={() => navigate('/campaigns')}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                            <Plus size={18} className="mr-1" />
                            Criar Campanha
                        </button>
                    </div>
                )}
            </div>

            {/* Secção de Estatísticas */}
            <div className="mt-8 p-4 border rounded-lg bg-white shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Estatísticas de Envio</h2>

                {/* Controles de Período e Navegação */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    {/* Botões de Período */}
                    <div className="flex space-x-1 border border-gray-200 rounded-lg p-1 bg-gray-50">
                        {['day', 'week', 'month'].map((period) => (
                            <button
                                key={period}
                                onClick={() => changePeriod(period)}
                                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors duration-150 ${
                                    viewPeriod === period
                                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-inset ring-gray-200'
                                        : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                {period === 'day' ? 'Dia' : period === 'week' ? 'Semana' : 'Mês'}
                            </button>
                        ))}
                    </div>

                    {/* Navegação e Data */}
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={handlePrevious}
                            className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                            aria-label="Período anterior"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span className="text-sm font-medium text-gray-700 text-center w-48 sm:w-auto tabular-nums">
                            {loading ? "A carregar..." : currentPeriodText}
                        </span>
                        <button
                             onClick={handleNext}
                             className={`p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors ${
                                // Desativar botão Next se a próxima data for futura
                                new Date(new Date(referenceDate).setDate(referenceDate.getDate() + (viewPeriod === 'day' ? 1 : viewPeriod === 'week' ? 7 : 31))) > new Date() ? 'opacity-50 cursor-not-allowed' : ''
                             }`}
                             aria-label="Próximo período"
                             disabled={new Date(new Date(referenceDate).setDate(referenceDate.getDate() + (viewPeriod === 'day' ? 1 : viewPeriod === 'week' ? 7 : 31))) > new Date()}
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
                
                {/* --- LEGENDA PERSONALIZADA --- */}
                <div className="flex justify-center items-center space-x-4 text-xs text-gray-600">
                    <div className="flex items-center">
                        <span className="inline-block w-3 h-3 bg-blue-600 rounded-full mr-1.5"></span>
                        Enviados
                    </div>
                    <div className="flex items-center">
                         <span className="inline-block w-3 h-3 bg-red-400 rounded-full mr-1.5"></span>
                        Falhados
                    </div>
                </div>

                {/* Gráfico ou Mensagem de Loading/Erro */}
                <div className="min-h-[270px]">
                    {loading ? (
                        <div className="flex justify-center items-center h-full py-10">
                            <p className="text-gray-500 animate-pulse">A carregar estatísticas...</p>
                        </div>
                    ) : error ? (
                        <div className="flex justify-center items-center h-full py-10 bg-red-50 rounded-md">
                            <p className="text-red-600 font-medium">{error}</p>
                        </div>
                    ) : chartData && chartData.length > 0 ? (
                        <StatsChart 
                            statsData={chartData} 
                            viewPeriod={viewPeriod} 
                            referenceDate={referenceDate}
                        />
                    ) : (
                        <div className="flex justify-center items-center h-full py-10 bg-gray-50 rounded-md">
                             <p className="text-gray-500">Sem dados de envio para este período.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default HomePage 