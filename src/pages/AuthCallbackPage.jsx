import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function AuthCallbackPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Obter token da URL (query string)
    const params = new URLSearchParams(location.search);
    const token = params.get('token');

    if (token) {
      // Tem token, fazer login
      login(token);
      
      // Verificar se há um redirect pendente após login
      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      if (redirectPath) {
        // Limpar o valor armazenado
        sessionStorage.removeItem('redirectAfterLogin');
        // Navegar para o caminho armazenado
        navigate(redirectPath);
      } else {
        // Se não houver redirect pendente, ir para a dashboard
        navigate('/');
      }
    } else {
      // Não tem token, redirecionar para login
      navigate('/login?error=no_token');
    }
  }, [login, navigate, location]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-10 rounded-lg shadow-md w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-700">A processar login...</h2>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    </div>
  );
}

export default AuthCallbackPage; 