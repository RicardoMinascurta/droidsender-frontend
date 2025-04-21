import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
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

// Helper para descodificar JWT (exemplo básico, use uma biblioteca como jwt-decode em produção)
function decodeJWT(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Failed to decode JWT", error);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const socketRef = useRef(null);

  // Função para limpar estado e token
  const clearAuthData = useCallback(() => {
    localStorage.removeItem('authToken');
    delete apiClient.defaults.headers.common['Authorization'];
    setUser(null);
    setToken(null);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  // Verificar token no localStorage ao iniciar a aplicação
  useEffect(() => {
    console.log("[Auth Init Effect] Checking local storage...");
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      console.log("[Auth Init Effect] Token found, decoding and setting state...");
      try {
          const decoded = decodeJWT(storedToken);
          if (decoded && decoded.exp * 1000 > Date.now()) {
              apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
              setUser({ id: decoded.id, email: decoded.email });
              setToken(storedToken);
              console.log("[Auth Init Effect] User set from stored token:", decoded.email);
          } else {
              console.log("[Auth Init Effect] Stored token invalid or expired.");
              clearAuthData();
          }
      } catch(e){
          console.error("[Auth Init Effect] Error processing stored token:", e);
          clearAuthData();
      }
    } else {
      console.log("[Auth Init Effect] No token found.");
      setUser(null);
      setToken(null);
    }
    setIsLoading(false);
    console.log("[Auth Init Effect] Finished, isLoading:", false);
  }, [clearAuthData]);

  // Efeito para gerir a conexão do Socket.IO *apenas* quando houver um token válido
  useEffect(() => {
    if (token && user?.id) {
      console.log(`[Socket Effect] Token valid, connecting socket for user ${user.id}...`);
      if (!socketRef.current || !socketRef.current.connected) {
          if (socketRef.current) {
              socketRef.current.disconnect();
          }
          const newSocket = io(SOCKET_SERVER_URL, {
            auth: { token: token },
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
          });

          newSocket.on('connect', () => {
            console.log(`[Socket Effect] Socket connected: ${newSocket.id}`);
          });

          newSocket.on('disconnect', (reason) => {
            console.log(`[Socket Effect] Socket disconnected: ${reason}`);
            if (reason === 'io server disconnect') {
                socketRef.current = null;
            }
          });

          newSocket.on('connect_error', (error) => {
            console.error(`[Socket Effect] Socket connection error: ${error.message}`);
            socketRef.current = null;
          });

          socketRef.current = newSocket;
      } else {
           console.log("[Socket Effect] Socket already connected.");
      }

      return () => {
        console.log('[Socket Effect Cleanup] Token/User changed or component unmounted. Disconnecting socket...');
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      };
    } else {
       console.log('[Socket Effect] No token, ensuring socket is disconnected...');
       if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
       }
    }
  }, [token, user?.id]);

  // Função de Login (chamada após callback do Google ou login normal)
  const login = useCallback((jwtToken) => {
    console.log("[Login Function] Called with new token.");
    localStorage.setItem('authToken', jwtToken);
    try {
        const decoded = decodeJWT(jwtToken);
        if (decoded) {
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${jwtToken}`;
            setUser({ id: decoded.id, email: decoded.email });
            setToken(jwtToken);
            console.log("[Login Function] Token set, user set:", decoded.email);
            navigate('/');
        } else {
            console.error("[Login Function] Failed to decode new token.");
            clearAuthData();
        }
    } catch(e) {
        console.error("[Login Function] Error processing new token:", e);
        clearAuthData();
    }
  }, [navigate, clearAuthData]);

  // Função de Logout
  const logout = useCallback(() => {
    console.log('[Logout Function] Logging out...');
    clearAuthData();
    navigate('/login');
  }, [navigate, clearAuthData]);

  const value = {
    isAuthenticated: !!user && !!token,
    user,
    isLoading,
    socket: socketRef.current,
    login,
    logout,
  };

  if (isLoading) {
    return <div>Loading authentication...</div>;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
} 