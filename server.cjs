        // frontend_bom/frontend/server.js
        const express = require('express');
        const path = require('path');
        const app = express();

        // Define a porta onde o servidor vai ouvir (Heroku define a PORT env var)
        const port = process.env.PORT || 3001; // Usar 3001 como fallback local

        // Serve os ficheiros estáticos da pasta 'dist' (onde o build do Vite coloca os ficheiros)
        app.use(express.static(path.join(__dirname, 'dist')));

        // Para qualquer outra rota GET não reconhecida (ex: /login, /dashboard),
        // envia o index.html para que o routing do React (React Router) funcione
        app.get('*', (req, res) => {
          res.sendFile(path.join(__dirname, 'dist', 'index.html'));
        });

        app.listen(port, () => {
          console.log(`Servidor frontend a correr na porta ${port}`);
          console.log(`Servindo ficheiros de ${path.join(__dirname, 'dist')}`);
        });