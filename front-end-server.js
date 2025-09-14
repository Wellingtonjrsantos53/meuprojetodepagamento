const express = require('express');
const path = require('path');
const app = express();
const port = 3001;

// Define a pasta do projeto como a raiz para servir arquivos estáticos
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
