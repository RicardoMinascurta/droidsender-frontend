import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Battery, Signal, Smartphone, Wifi, AlertCircle } from 'lucide-react';
import styled from 'styled-components';

const StatusPanel = styled.div`
  background-color: #ffffff; /* Definir explicitamente como branco */
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
  /* box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); */ /* Manter sombra comentada */
`;

const PanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.5rem;
`;

const PanelTitle = styled.h2`
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
`;

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  background-color: ${(props) => (props.connected ? '#dcfce7' : '#fee2e2')};
  color: ${(props) => (props.connected ? '#166534' : '#b91c1c')};
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
`;

const StatusGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
`;

const StatusItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ItemIcon = styled.div`
  color: #6366f1;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ItemContent = styled.div`
  display: flex;
  flex-direction: column;
`;

const ItemLabel = styled.span`
  font-size: 0.75rem;
  color: #64748b;
`;

const ItemValue = styled.span`
  font-size: 0.875rem;
  font-weight: 500;
  color: #1e293b;
`;

// Componente para a barra de bateria
const BatteryBar = styled.div`
  width: 100%;
  height: 0.5rem;
  background-color: #e2e8f0;
  border-radius: 9999px;
  margin-top: 0.25rem;
  overflow: hidden;
`;

const BatteryLevel = styled.div`
  height: 100%;
  border-radius: 9999px;
  background-color: ${(props) => {
    if (props.level > 60) return '#22c55e'; // Verde para > 60%
    if (props.level > 20) return '#f59e0b'; // Amarelo para 20-60%
    return '#ef4444'; // Vermelho para < 20%
  }};
  width: ${(props) => props.level}%;
  transition: width 0.3s ease;
`;

function DeviceStatusPanel() {
  const { socket } = useAuth();
  const [deviceStatus, setDeviceStatus] = useState({
    isConnected: false,
    batteryLevel: 0,
    smsPackage: 'Desconhecido',
    deviceModel: 'Dispositivo não conectado',
    lastUpdate: null
  });

  useEffect(() => {
    if (!socket) return;

    const handleDeviceStatus = (data) => {
      console.log('[DeviceStatusPanel] Received device status update:', data);
      setDeviceStatus({
        isConnected: data.isConnected || false,
        batteryLevel: data.batteryLevel || 0,
        smsPackage: data.smsPackage || 'Desconhecido',
        deviceModel: data.deviceModel || 'Dispositivo desconhecido',
        lastUpdate: new Date()
      });
    };

    const handleConnect = () => {
      console.log('[DeviceStatusPanel] Socket connected');
      // Solicitar atualização do status ao conectar
      socket.emit('requestDeviceStatus');
    };

    const handleDisconnect = () => {
      console.log('[DeviceStatusPanel] Socket disconnected');
      setDeviceStatus(prev => ({
        ...prev,
        isConnected: false
      }));
    };

    // Configurar listeners
    socket.on('deviceStatusUpdate', handleDeviceStatus);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Verificar se já está conectado
    if (socket.connected) {
      console.log('[DeviceStatusPanel] Socket already connected, requesting status');
      socket.emit('requestDeviceStatus');
    }

    // Solicitar atualizações periódicas a cada 30 segundos
    const intervalId = setInterval(() => {
      if (socket.connected) {
        console.log('[DeviceStatusPanel] Periodic status request');
        socket.emit('requestDeviceStatus');
      }
    }, 30000); // 30 segundos

    // Cleanup listeners e timer
    return () => {
      socket.off('deviceStatusUpdate', handleDeviceStatus);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      clearInterval(intervalId);
    };
  }, [socket]);

  return (
    <StatusPanel>
      <PanelHeader>
        <PanelTitle>Estado do Dispositivo</PanelTitle>
        <StatusBadge connected={deviceStatus.isConnected}>
          {deviceStatus.isConnected ? (
            <>
              <Wifi size={14} className="mr-1" /> Conectado
            </>
          ) : (
            <>
              <AlertCircle size={14} className="mr-1" /> Desconectado
            </>
          )}
        </StatusBadge>
      </PanelHeader>

      <StatusGrid>
        {/* Dispositivo */}
        <StatusItem>
          <ItemIcon>
            <Smartphone size={18} />
          </ItemIcon>
          <ItemContent>
            <ItemLabel>Dispositivo</ItemLabel>
            <ItemValue>{deviceStatus.deviceModel}</ItemValue>
          </ItemContent>
        </StatusItem>

        {/* Pacote SMS */}
        <StatusItem>
          <ItemIcon>
            <Signal size={18} />
          </ItemIcon>
          <ItemContent>
            <ItemLabel>Pacote SMS</ItemLabel>
            <ItemValue>{deviceStatus.smsPackage}</ItemValue>
          </ItemContent>
        </StatusItem>

        {/* Bateria */}
        <StatusItem style={{ gridColumn: '1 / -1' }}>
          <ItemIcon>
            <Battery size={18} />
          </ItemIcon>
          <ItemContent style={{ flex: 1 }}>
            <div className="flex justify-between">
              <ItemLabel>Bateria</ItemLabel>
              <ItemValue>{deviceStatus.batteryLevel}%</ItemValue>
            </div>
            <BatteryBar>
              <BatteryLevel level={deviceStatus.batteryLevel} />
            </BatteryBar>
          </ItemContent>
        </StatusItem>
      </StatusGrid>
    </StatusPanel>
  );
}

export default DeviceStatusPanel; 