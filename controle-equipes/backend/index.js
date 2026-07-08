import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import gestorRoutes from './src/routes/gestorRoutes.js'; // 💡 Ajuste este caminho se o seu arquivo estiver em outra pasta!
import authRoutes from './src/routes/authRoutes.js'; // 💡 Ajuste este caminho se o seu arquivo estiver em outra pasta!
import rhRoutes from './src/routes/rhRoutes.js'; // 💡 Ajuste este caminho se o seu arquivo estiver em outra pasta!
import masterRoutes from './src/routes/masterRoutes.js'; // 💡 Ajuste este caminho se o seu arquivo estiver em outra pasta
// !
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Vincula o arquivo de rotas ao prefixo /api que o React usa
app.use('/api', authRoutes);
app.use('/api', rhRoutes);
app.use('/api', masterRoutes);
app.use('/api', gestorRoutes);

// 🟢 ADICIONE ESTAS LINHAS AQUI PARA SUMIR O CANNOT GET:
app.get('/', (req, res) => {
  res.json({ 
    status: "OK", 
    mensagem: "O back-end do sistema está rodando com sucesso no Render!" 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando com sucesso em http://localhost:${PORT}`);
});