import express from 'express';
const router = express.Router();

// Caminho para a estrutura real do banco
import db from '../../db.js';

// ========================================================
// 1. POST: LOGIN DO SISTEMA (usuarios_sistema)
// ========================================================
router.post('/login', async (req, res) => {
  const { usuario, senha } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ error: "Preencha o usuário e a senha." });
  }

  try {
    const sql = "SELECT id, nome, usuario, senha, cargo FROM usuarios_sistema WHERE usuario = ?";
    const [rows] = await db.execute(sql, [usuario.trim()]);

    if (rows.length === 0) {
      return res.status(401).json({ error: "Usuário não encontrado." });
    }

    const user = rows[0];

    if (String(senha) !== String(user.senha)) {
      return res.status(401).json({ error: "Senha incorreta." });
    }

    res.json({
      success: true,
      usuario: {
        id: user.id,
        id_usuario: user.nome,  // Nome do usuário para identificação visual
        nome: user.nome,
        cargo: user.cargo
      }
    });

  } catch (err) {
    console.error("Erro na autenticação:", err);
    res.status(500).json({ error: "Erro interno no servidor de autenticação." });
  }
});
export default router;