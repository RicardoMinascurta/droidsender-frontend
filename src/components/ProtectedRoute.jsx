import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Ajustar caminho

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    // Se ainda estiver a verificar a autenticação, mostra loading
    // (ou podes deixar o AuthProvider mostrar o loading global)
    return <div>Checking authentication...</div>; 
  }

  if (!isAuthenticated) {
    // Se não estiver autenticado, redireciona para a página de login
    console.log('[ProtectedRoute] Not authenticated, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  // Se estiver autenticado, renderiza o conteúdo da rota (Outlet)
  console.log('[ProtectedRoute] Authenticated, rendering route content.');
  return <Outlet />;
}

export default ProtectedRoute; 