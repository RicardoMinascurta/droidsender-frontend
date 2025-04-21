import axios from 'axios';

// Usar variável de ambiente para a URL base do backend!
const baseURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Adicionar withCredentials: true para permitir o envio de cookies de sessão
  withCredentials: true,
});

// Interceptor para adicionar o token JWT às requisições
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('jwtToken'); // Ou de onde guardares o token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para lidar com erros de resposta (incluindo 401)
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Verificar se o erro é de autenticação (401)
    if (error.response && error.response.status === 401) {
      console.warn('[API] Erro de autenticação (401). Redirecionando para login...');
      
      // Se estiver numa rota protegida, redirecionar para login
      if (!window.location.pathname.includes('/login')) {
        // Armazenar a URL atual para redirecionar de volta após login
        sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
        
        // Redirecionar para login
        window.location.href = '/login';
      }
    }
    
    // Continuar rejeitando o erro para que os componentes possam tratá-lo
    return Promise.reject(error);
  }
);

export default apiClient; 