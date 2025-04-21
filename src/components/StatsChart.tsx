import React from 'react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';

// Registar os componentes
ChartJS.register(
    CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
);

// Interface de dados vinda da API (assumimos que é sempre diária)
interface DailyStatPoint {
    date: string; // YYYY-MM-DD
    sent_count?: string | number; // Alterado para corresponder à API
    failed_count?: string | number; // Alterado para corresponder à API
    hour?: string | number;
    dayOfMonth?: string | number;
    local_date_str?: string;
    local_weekday?: string | number;
    local_day_of_month?: string | number;
}

// Interface para os dados processados internamente
interface ProcessedStatPoint {
    label: string; // O label para o eixo X (hora, dia da semana, dia do mês)
    sent: number;
    failed: number;
    tooltipTitle?: string; // Título opcional para o tooltip
}

interface StatsChartProps {
    statsData: DailyStatPoint[]; // Array de dados DIÁRIOS vindos da API
    viewPeriod: 'day' | 'week' | 'month';
    referenceDate: Date;
}

// Nomes dos dias da semana (para período 'week')
const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Helper para obter o número de dias num mês/ano
function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

const StatsChart: React.FC<StatsChartProps> = ({ statsData, viewPeriod, referenceDate }) => {
    console.log(`[StatsChart] Renderizando. Período: ${viewPeriod}, RefDate: ${referenceDate.toISOString()}`, statsData);
    console.log(`[StatsChart] Estrutura detalhada do primeiro item de statsData:`, 
                statsData && statsData.length > 0 ? JSON.stringify(statsData[0]) : 'Sem dados');

    // --- Processar os dados brutos (statsData) para o formato do gráfico --- 
    let processedLabels: string[] = [];
    let processedSent: number[] = [];
    let processedFailed: number[] = [];
    let processedTooltips: string[] = [];

    try {
        switch (viewPeriod) {
            case 'day':
                const hourlyMap = new Map<number, { sent: number; failed: number }>();
                console.log(`[StatsChart - Day] Dados brutos recebidos (${statsData.length} registros):`, statsData);
                
                statsData.forEach((d: any, index) => {
                    console.log(`[StatsChart - Day] Processando item ${index}:`, d);
                    const hour = typeof d.hour === 'undefined' ? null : parseInt(String(d.hour), 10);
                    
                    if (hour !== null) {
                        // Tentar extrair sent_count e failed_count de diferentes formas
                        let sentCount = 0;
                        let failedCount = 0;
                        
                        if (d.sent_count !== undefined) {
                            sentCount = parseInt(String(d.sent_count), 10) || 0;
                            console.log(`[StatsChart - Day] Usando d.sent_count: ${d.sent_count} → ${sentCount}`);
                        } else if (d.sent !== undefined) {
                            sentCount = parseInt(String(d.sent), 10) || 0;
                            console.log(`[StatsChart - Day] Usando d.sent: ${d.sent} → ${sentCount}`);
                        }
                        
                        if (d.failed_count !== undefined) {
                            failedCount = parseInt(String(d.failed_count), 10) || 0;
                            console.log(`[StatsChart - Day] Usando d.failed_count: ${d.failed_count} → ${failedCount}`);
                        } else if (d.failed !== undefined) {
                            failedCount = parseInt(String(d.failed), 10) || 0;
                            console.log(`[StatsChart - Day] Usando d.failed: ${d.failed} → ${failedCount}`);
                        }
                        
                        console.log(`[StatsChart - Day] Para hora ${hour}: Enviados=${sentCount}, Falhados=${failedCount}`);
                        hourlyMap.set(hour, { sent: sentCount, failed: failedCount });
                    }
                });
                console.log("[StatsChart - Day] Hourly Map Content:", Object.fromEntries(hourlyMap));
                
                processedLabels = []; 
                processedSent = []; 
                processedFailed = []; 
                processedTooltips = [];
                
                for (let hour = 0; hour < 24; hour++) {
                    const stats = hourlyMap.get(hour) || { sent: 0, failed: 0 };
                    processedLabels.push(`${hour}h`);
                    processedSent.push(stats.sent);
                    processedFailed.push(stats.failed);
                    processedTooltips.push(`Dia ${referenceDate.toLocaleDateString('pt-PT')}, ${hour}:00-${hour}:59`);
                    console.log(`[StatsChart - Day] Hora ${hour}: Enviados=${stats.sent}, Falhados=${stats.failed}`);
                }
                console.log("[StatsChart - Day] Processed Data (after fix):", { processedLabels, processedSent, processedFailed });
                break;

            case 'week':
                console.log("[StatsChart - Week] Processing weekly data:", statsData);
                console.log(`[StatsChart - Week] Estrutura detalhada de cada item:`, 
                            statsData.map((item, idx) => `Item ${idx}: ${JSON.stringify(item)}`).join('\n'));
                
                const weekLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
                // Calcular início da semana (Segunda-feira) com base na referenceDate
                const startOfWeek = new Date(referenceDate);
                startOfWeek.setUTCHours(0, 0, 0, 0); // Normalizar para início do dia UTC
                const dayOfWeek = startOfWeek.getUTCDay(); // 0=Dom, 1=Seg
                const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                startOfWeek.setUTCDate(startOfWeek.getUTCDate() + diffToMonday);
                console.log(`[StatsChart - Week] Start of week calculated: ${startOfWeek.toISOString()}`);

                // Criar mapa dos dados recebidos (chave: YYYY-MM-DD)
                const receivedDataMap = new Map<string, { sent: number; failed: number }>();
                statsData.forEach((d: any, index) => {
                    console.log(`[StatsChart - Week] Processando item ${index}:`, d);
                    
                    // Tentar extrair a data de diferentes formas
                    let dateStr: string | null = null;
                    if (d.date) {
                        dateStr = d.date;
                        console.log(`[StatsChart - Week] Usando d.date: ${dateStr}`);
                    } else if (d.local_date_str) {
                        dateStr = d.local_date_str;
                        console.log(`[StatsChart - Week] Usando d.local_date_str: ${dateStr}`);
                    }
                    
                    if (dateStr) {
                        // Tentar extrair sent_count e failed_count de diferentes formas
                        let sentCount = 0;
                        let failedCount = 0;
                        
                        if (d.sent_count !== undefined) {
                            sentCount = parseInt(String(d.sent_count), 10) || 0;
                            console.log(`[StatsChart - Week] Usando d.sent_count: ${d.sent_count} → ${sentCount}`);
                        } else if (d.sent !== undefined) {
                            sentCount = parseInt(String(d.sent), 10) || 0;
                            console.log(`[StatsChart - Week] Usando d.sent: ${d.sent} → ${sentCount}`);
                        }
                        
                        if (d.failed_count !== undefined) {
                            failedCount = parseInt(String(d.failed_count), 10) || 0;
                            console.log(`[StatsChart - Week] Usando d.failed_count: ${d.failed_count} → ${failedCount}`);
                        } else if (d.failed !== undefined) {
                            failedCount = parseInt(String(d.failed), 10) || 0;
                            console.log(`[StatsChart - Week] Usando d.failed: ${d.failed} → ${failedCount}`);
                        }
                        
                        console.log(`[StatsChart - Week] Para data ${dateStr}: Enviados=${sentCount}, Falhados=${failedCount}`);
                        receivedDataMap.set(dateStr, { sent: sentCount, failed: failedCount });
                    }
                });
                console.log("[StatsChart - Week] Received Data Map (after correction):", Object.fromEntries(receivedDataMap));

                // Inicializar arrays processados para 7 dias
                processedLabels = [];
                processedSent = Array(7).fill(0);
                processedFailed = Array(7).fill(0);
                processedTooltips = Array(7).fill('');

                // Preencher os 7 dias da semana
                for (let i = 0; i < 7; i++) {
                    const currentDate = new Date(startOfWeek);
                    currentDate.setUTCDate(startOfWeek.getUTCDate() + i);
                    const dateStr = currentDate.toISOString().split('T')[0];
                    const dayIndex = i; // 0=Seg, 1=Ter, ..., 6=Dom
                    const dayOfMonth = currentDate.getUTCDate();

                    const currentLabel = `${weekLabels[dayIndex]} ${dayOfMonth}`;
                    processedLabels.push(currentLabel);
                    
                    const dataForThisDay = receivedDataMap.get(dateStr);
                    if (dataForThisDay) {
                        processedSent[dayIndex] = dataForThisDay.sent;
                        processedFailed[dayIndex] = dataForThisDay.failed;
                        console.log(`[StatsChart - Week] Data found for ${dateStr}:`, dataForThisDay);
                    } else {
                         console.log(`[StatsChart - Week] No data found for ${dateStr}, using zeros.`);
                         // Já está preenchido com 0
                    }

                    try {
                        processedTooltips[dayIndex] = currentDate.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
                    } catch (e) { processedTooltips[dayIndex] = dateStr; }
                }
                console.log("[StatsChart - Week] Processed Data:", { processedLabels, processedSent, processedFailed });
                break;

            case 'month':
                console.log("[StatsChart - Month] Processing monthly data:", statsData);
                console.log(`[StatsChart - Month] Estrutura detalhada de cada item:`, 
                            statsData.map((item, idx) => `Item ${idx}: ${JSON.stringify(item)}`).join('\n'));
                
                const year = referenceDate.getFullYear();
                const month = referenceDate.getMonth();
                const daysInMonth = getDaysInMonth(year, month);
                
                // Criar mapa dos dados recebidos (chave: dia do mês)
                const monthlyMap = new Map<number, { sent: number; failed: number; dateStr: string }>();
                statsData.forEach((dayData: any, index) => {
                    console.log(`[StatsChart - Month] Processando item ${index}:`, dayData);
                    
                    // Tentar extrair o dia do mês de diferentes formas
                    let dayOfMonth: number | null = null;
                    let dateStr = '';  // Inicializar como string vazia em vez de null
                    
                    if (dayData.dayOfMonth !== undefined) {
                        dayOfMonth = parseInt(String(dayData.dayOfMonth), 10);
                        console.log(`[StatsChart - Month] Usando dayData.dayOfMonth: ${dayOfMonth}`);
                    } else if (dayData.local_day_of_month !== undefined) {
                        dayOfMonth = parseInt(String(dayData.local_day_of_month), 10);
                        console.log(`[StatsChart - Month] Usando dayData.local_day_of_month: ${dayOfMonth}`);
                    } else if (dayData.date) {
                        dateStr = dayData.date;
                        const dateParts = dateStr.split('-');
                        if (dateParts.length === 3) {
                            const monthFromDate = parseInt(dateParts[1], 10) - 1; // mês é 0-indexed
                            if (monthFromDate === month) {
                                dayOfMonth = parseInt(dateParts[2], 10);
                                console.log(`[StatsChart - Month] Extraído dia ${dayOfMonth} da data ${dateStr}`);
                            }
                        }
                    }
                    
                    if (dayOfMonth !== null) {
                        // Tentar extrair sent_count e failed_count de diferentes formas
                        let sentCount = 0;
                        let failedCount = 0;
                        
                        if (dayData.sent_count !== undefined) {
                            sentCount = parseInt(String(dayData.sent_count), 10) || 0;
                            console.log(`[StatsChart - Month] Usando dayData.sent_count: ${dayData.sent_count} → ${sentCount}`);
                        } else if (dayData.sent !== undefined) {
                            sentCount = parseInt(String(dayData.sent), 10) || 0;
                            console.log(`[StatsChart - Month] Usando dayData.sent: ${dayData.sent} → ${sentCount}`);
                        }
                        
                        if (dayData.failed_count !== undefined) {
                            failedCount = parseInt(String(dayData.failed_count), 10) || 0;
                            console.log(`[StatsChart - Month] Usando dayData.failed_count: ${dayData.failed_count} → ${failedCount}`);
                        } else if (dayData.failed !== undefined) {
                            failedCount = parseInt(String(dayData.failed), 10) || 0;
                            console.log(`[StatsChart - Month] Usando dayData.failed: ${dayData.failed} → ${failedCount}`);
                        }
                        
                        // Se dateStr estiver vazio, gerar baseado no dia/mês/ano
                        if (!dateStr) {
                            dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(dayOfMonth).padStart(2,'0')}`;
                        }
                        
                        console.log(`[StatsChart - Month] Para dia ${dayOfMonth}: Enviados=${sentCount}, Falhados=${failedCount}`);
                        monthlyMap.set(dayOfMonth, { sent: sentCount, failed: failedCount, dateStr });
                    }
                });
                console.log("[StatsChart - Month] Received Data Map (after correction):", Object.fromEntries(monthlyMap));

                // Inicializar arrays processados
                processedLabels = [];
                processedSent = Array(daysInMonth).fill(0);
                processedFailed = Array(daysInMonth).fill(0);
                processedTooltips = Array(daysInMonth).fill('');

                for (let day = 1; day <= daysInMonth; day++) {
                    const dayIndex = day - 1; 
                    processedLabels.push(String(day)); 
                    const stats = monthlyMap.get(day);
                    if (stats) {
                        const sentValue = stats.sent || 0; 
                        const failedValue = stats.failed || 0;
                        processedSent[dayIndex] = sentValue;
                        processedFailed[dayIndex] = failedValue;
                        console.log(`[StatsChart - Month] Day ${day}: Assigning Sent=${sentValue} to index ${dayIndex}, Failed=${failedValue} to index ${dayIndex}`);
                    } else {
                        processedSent[dayIndex] = 0;
                        processedFailed[dayIndex] = 0;
                    }
                    try {
                        const dateStr = stats?.dateStr || `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                        processedTooltips[dayIndex] = new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
                    } catch(e) { processedTooltips[dayIndex] = String(day); }
                }
                console.log("[StatsChart - Month] Final Processed Sent Data:", processedSent);
                console.log("[StatsChart - Month] Final Processed Failed Data:", processedFailed);
                break;
        }
    } catch (error) {
        console.error("[StatsChart] Erro ao processar dados para o gráfico:", error);
        // Limpar dados em caso de erro no processamento
        processedLabels = [];
        processedSent = [];
        processedFailed = [];
        processedTooltips = [];
    }

    // Calcular valor máximo para ajudar na escala Y
    const maxSent = Math.max(...processedSent, 0);
    const maxFailed = Math.max(...processedFailed, 0);
    const overallMax = Math.max(maxSent, maxFailed);
    console.log(`[StatsChart] Calculated Max Y value: ${overallMax}`);

    // Garantir que os dados são números
    const finalSentData: number[] = processedSent.map(v => Number(v) || 0);
    const finalFailedData: number[] = processedFailed.map(v => Number(v) || 0);
    console.log(`[StatsChart] Final arrays: Sent=${JSON.stringify(finalSentData)}, Failed=${JSON.stringify(finalFailedData)}`);

    // --- Configuração final dos datasets --- 
    const data = {
        labels: processedLabels,
        datasets: [
            {
                label: 'Enviados',
                data: finalSentData,
                borderColor: '#1976D2',
                backgroundColor: (context: any) => {
                    const chart = context.chart;
                    const {ctx, chartArea} = chart;
                     if (!chartArea) return null;
                    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                     gradient.addColorStop(0, 'rgba(25, 118, 210, 0)'); 
                    gradient.addColorStop(0.5, 'rgba(25, 118, 210, 0.25)'); 
                     gradient.addColorStop(1, 'rgba(25, 118, 210, 0.5)'); 
                    return gradient;
                },
                tension: 0.3,
                fill: true,
                pointRadius: 3,
                pointBackgroundColor: '#1976D2',
                borderWidth: 2,
            },
            {
                label: 'Falhados',
                data: finalFailedData,
                borderColor: '#E57373',
                backgroundColor: 'rgba(229, 115, 115, 0.1)',
                tension: 0.3,
                fill: false,
                pointRadius: 3,
                pointBackgroundColor: '#E57373',
                borderWidth: 2,
            },
        ],
    };
    console.log("[StatsChart] Final data object being passed to Chart.js:", JSON.stringify(data)); 

    // --- Opções do Gráfico (ajustes finais) ---
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                titleFont: { size: 12 },
                bodyFont: { size: 11 },
                padding: 10,
                boxPadding: 4,
                callbacks: {
                    title: function(tooltipItems: any[]) {
                        const index = tooltipItems[0]?.dataIndex;
                        return processedTooltips[index] || ''; 
                    },
                    label: function(context: any) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += context.parsed.y;
                        }
                        return label;
                    },
                }
            },
            title: { display: false },
        },
        scales: {
            x: {
                border: { display: false },
                grid: { display: false },
                ticks: {
                    maxRotation: 0,
                    minRotation: 0,
                    autoSkip: true,
                    // Ajustar limite de ticks
                    maxTicksLimit: viewPeriod === 'day' ? 12 : (viewPeriod === 'week' ? 7 : 15), 
                     font: { size: 10 },
                    color: '#6B7280'
                }
            },
            y: {
                beginAtZero: true,
                 border: { display: false },
                 grid: { color: '#F3F4F6', drawTicks: false },
                 suggestedMax: overallMax + Math.max(1, Math.ceil(overallMax * 0.1)),
                 ticks: {
                     callback: function(value: number | string) {
                        if (typeof value === 'number' && Number.isInteger(value) && value >= 0) { return value; } 
                        return null;
                    },
                     font: { size: 10 },
                     color: '#6B7280'
                }
            }
        },
        interaction: { mode: 'nearest' as const, axis: 'x' as const, intersect: false }
    };

    return (
        <div style={{ height: '270px' }}>
            <Line options={options} data={data} />
        </div>
    );
};

export default StatsChart; 