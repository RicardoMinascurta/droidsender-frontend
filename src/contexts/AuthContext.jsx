import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../lib/apiClient'; // Ajustar caminho se necessário
// Importar Socket.IO
import { io, Socket } from 'socket.io-client';

// Definir a estrutura do utilizador (apenas campos não sensíveis)
const UserShape = {
  id: null,
  email: null,
  // adicionar outros campos se necessário (ex: subscription_plan)
};

const AuthContext = createContext(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// URL do Servidor Socket.IO (Usar variável de ambiente!)
const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Função para desconectar o socket
  const disconnectSocket = useCallback(() => {
    if (socket) {
      console.log(`[AuthContext][Socket] Disconnecting socket ${socket.id} (from stable callback)...`);
      socket.disconnect();
      console.log('[AuthContext][Socket] DEFININDO ESTADO socket para NULL (em disconnectSocket).');
      setSocket(null);
    } else {
       console.log('[AuthContext][Socket] disconnectSocket chamado, mas socket já era NULL.');
    }
  }, [socket]);

  // Função para buscar dados do utilizador com base no token
  const fetchUser = useCallback(async (currentToken) => {
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${currentToken}`;
      const response = await apiClient.get('/api/users/me'); // Endpoint do backend
      setUser(response.data); // Assumindo que a resposta tem os dados do user
      setToken(currentToken);
      console.log('[AuthContext] User loaded:', response.data.email);
    } catch (error) {
      console.error('[AuthContext] Failed to fetch user:', error);
      localStorage.removeItem('jwtToken');
      delete apiClient.defaults.headers.common['Authorization'];
      setUser(null);
      setToken(null);
      disconnectSocket(); // <-- Desconectar se fetch falhar
    } finally {
      setIsLoading(false);
    }
  }, [disconnectSocket]);

  // Verificar token no localStorage ao iniciar
  useEffect(() => {
    const storedToken = localStorage.getItem('jwtToken');
    if (storedToken) {
      fetchUser(storedToken);
    } else {
      setIsLoading(false);
    }
  }, [fetchUser]);

  // Efeito para gerir conexão/desconexão do socket baseado no token/user
  useEffect(() => {
    console.log(`[AuthContext][Socket Effect RUN] token: ${token ? 'present' : 'absent'}, user?.id: ${user?.id ?? 'N/A'}`);
    
    if (token && user?.id) { 
      console.log('[AuthContext][Socket] Token and user ID present, attempting to connect...');
      const newSocket = io(SOCKET_SERVER_URL, {
        auth: { token: token },
        query: { 
          userId: user.id, // Usar user.id aqui
          type: 'web'
        },
        reconnection: true,
        reconnectionAttempts: 5,
      });

      newSocket.on('connect', () => {
        console.log(`[AuthContext][Socket] Connected with ID: ${newSocket.id}`);
        // Emitir evento para backend se juntar à sala do utilizador
        console.log(`[AuthContext][Socket] Emitting joinUserRoom...`);
        newSocket.emit('joinUserRoom'); // O backend usará o userId do socket autenticado
      });

      newSocket.on('disconnect', (reason) => {
        console.warn(`[AuthContext][Socket] Disconnected. Reason: ${reason}`);
      });

      newSocket.on('connect_error', (error) => {
        console.error('[AuthContext][Socket] Connection Error:', error.message);
      });

      console.log('[AuthContext][Socket] DEFININDO ESTADO socket com nova instância.');
      setSocket(newSocket);

      return () => {
        console.log(`[AuthContext][Socket Effect CLEANUP] Cleanup: Disconnecting socket ${newSocket.id}...`);
        newSocket.disconnect();
        console.log('[AuthContext][Socket Effect CLEANUP] DEFININDO ESTADO socket para NULL.');
        setSocket(null); 
      };
    } else {
      console.log('[AuthContext][Socket Effect] Token ou User ID ausente. Garantindo desconexão...');
      disconnectSocket(); // Chamada continua aqui, mas não é uma dependência do efeito
    }
  // CORREÇÃO FINAL: Remover disconnectSocket das dependências. 
  // O efeito só deve reagir diretamente a mudanças em token ou user.id.
  }, [token, user?.id]);

  // Função de Login (chamada após callback do Google)
  const login = useCallback((jwtToken) => {
    localStorage.setItem('jwtToken', jwtToken);
    setIsLoading(true); // Ativar loading enquanto busca user
    fetchUser(jwtToken);
    // Navegação será feita na página de Callback
  }, [fetchUser]);

  // Atualizar Logout para desconectar socket
  const logout = useCallback(() => {
    console.log('[AuthContext] Logging out...');
    localStorage.removeItem('jwtToken');
    delete apiClient.defaults.headers.common['Authorization'];
    setUser(null);
    setToken(null);
    // A desconexão acontecerá automaticamente pelo useEffect principal quando token/user ficam null
    // Não precisamos chamar disconnectSocket explicitamente aqui se o efeito estiver correto.
    navigate('/login');
  // CORREÇÃO: Remover disconnectSocket das dependências
  }, [navigate]);

  const value = {
    isAuthenticated: !!user && !!token,
    user,
    token,
    isLoading,
    socket, // <-- Disponibilizar socket no contexto
    login,
    logout,
  };

  // Não renderizar children enquanto estiver a carregar dados iniciais
  if (isLoading) {
    return <div>Loading authentication...</div>; // Ou um componente Spinner
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
} 