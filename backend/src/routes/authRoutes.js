import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../../db.js';


// src/config/mailer.js
export const enviarCodigo2FA = async (email, codigo) => {
  // Sua lógica do nodemailer aqui
};
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_super_segura';

// ========================================================
// 1. POST: ETAPA 1 DO LOGIN (Validação de credenciais e envio de 2FA)
// ========================================================
router.post('/login', async (req, res) => {
  const { usuario, senha } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ error: "Preencha o usuário e a senha." });
  }

  try {
    const sql = "SELECT id, nome, usuario, email, senha, cargo FROM usuarios_sistema WHERE usuario = ?";
    const [rows] = await db.execute(sql, [usuario.trim()]);

    if (rows.length === 0) {
      return res.status(401).json({ error: "Usuário não encontrado." });
    }

    const user = rows[0];

    // Compara a senha informada com o Hash armazenado (suporta também texto simples para migração)
    let senhaValida = await bcrypt.compare(String(senha), user.senha);
    if (!senhaValida && String(senha) === String(user.senha)) {
      senhaValida = true; // Permite migração gradual caso a senha antiga esteja em texto puro
    }

    if (!senhaValida) {
      return res.status(401).json({ error: "Senha incorreta." });
    }

    // Se o utilizador não tiver e-mail registado, realiza o login direto retornando o token
    if (!user.email) {
      const token = jwt.sign(
        { id: user.id, nome: user.nome, cargo: user.cargo },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      return res.json({
        success: true,
        requer2FA: false,
        token,
        usuario: { id: user.id, nome: user.nome, cargo: user.cargo }
      });
    }

    // Gerar código aleatório de 6 dígitos
    const codigo2FA = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracao = new Date(Date.now() + 10 * 60 * 1000); // Válido por 10 minutos

    // Salva o código no banco
    await db.execute(
      "UPDATE usuarios_sistema SET codigo_2fa = ?, expiracao_2fa = ? WHERE id = ?",
      [codigo2FA, expiracao, user.id]
    );

    // Envia o e-mail
    await enviarCodigo2FA(user.email, codigo2FA);

    res.json({
      success: true,
      requer2FA: true,
      userId: user.id,
      message: "Código de segurança enviado para o seu e-mail."
    });

  } catch (err) {
    console.error("Erro na autenticação:", err);
    res.status(500).json({ error: "Erro interno no servidor de autenticação." });
  }
});

// ========================================================
// 2. POST: ETAPA 2 DO LOGIN (Validação do código 2FA)
// ========================================================
router.post('/validar-2fa', async (req, res) => {
  const { userId, codigo } = req.body;

  if (!userId || !codigo) {
    return res.status(400).json({ error: "Identificador do usuário e código são obrigatórios." });
  }

  try {
    const sql = "SELECT id, nome, cargo, codigo_2fa, expiracao_2fa FROM usuarios_sistema WHERE id = ?";
    const [rows] = await db.execute(sql, [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const user = rows[0];

    if (!user.codigo_2fa || user.codigo_2fa !== codigo.trim()) {
      return res.status(400).json({ error: "Código de segurança inválido." });
    }

    if (new Date() > new Date(user.expiracao_2fa)) {
      return res.status(400).json({ error: "Código expirado. Solicite um novo login." });
    }

    // Limpa o código utilizado
    await db.execute(
      "UPDATE usuarios_sistema SET codigo_2fa = NULL, expiracao_2fa = NULL WHERE id = ?",
      [user.id]
    );

    // Gera o Token JWT de acesso
    const token = jwt.sign(
      { id: user.id, nome: user.nome, cargo: user.cargo },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      token,
      usuario: {
        id: user.id,
        nome: user.nome,
        cargo: user.cargo
      }
    });

  } catch (err) {
    console.error("Erro ao validar 2FA:", err);
    res.status(500).json({ error: "Erro ao processar validação do código." });
  }
});
// 1. Solicitar código de redefinição
router.post('/esqueci-senha', async (req, res) => {
  const { contato } = req.body; // Aceita email ou usuario
  if (!contato) return res.status(400).json({ error: "Informe seu e-mail ou usuário." });

  try {
    const [rows] = await db.execute(
      "SELECT id, email, telefone FROM usuarios_sistema WHERE email = ? OR usuario = ?",
      [contato.trim(), contato.trim()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuário/E-mail não encontrado." });
    }

    const user = rows[0];
    const codigoReset = Math.floor(100000 + Math.random() * 900000).toString(); // Código 6 dígitos
    const expiracao = new Date(Date.now() + 15 * 60 * 1000); // 15 min de validade

    await db.execute(
      "UPDATE usuarios_sistema SET reset_token = ?, reset_expiracao = ? WHERE id = ?",
      [codigoReset, expiracao, user.id]
    );

    // TODO: Enviar SMS ou E-mail com o código de 6 dígitos
    // await enviarEmailOuSMS(user.email, user.telefone, codigoReset);

    res.json({ success: true, message: "Código enviado com sucesso!", userId: user.id });
  } catch (err) {
    res.status(500).json({ error: "Erro ao processar solicitação de redefinição." });
  }
});

// 2. Confirmar Código e Definir Nova Senha
router.post('/redefinir-senha', async (req, res) => {
  const { userId, codigo, novaSenha } = req.body;

  if (!userId || !codigo || !novaSenha) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
  }

  try {
    const [rows] = await db.execute(
      "SELECT id, reset_token, reset_expiracao FROM usuarios_sistema WHERE id = ?",
      [userId]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Usuário não encontrado." });
    const user = rows[0];

    if (!user.reset_token || user.reset_token !== codigo.trim()) {
      return res.status(400).json({ error: "Código de verificação inválido." });
    }

    if (new Date() > new Date(user.reset_expiracao)) {
      return res.status(400).json({ error: "Código expirado. Solicite novamente." });
    }

    // Opcional: bcrypt.hash(novaSenha, 10) se estiver utilizando hash
    const senhaFinal = novaSenha.trim();

    await db.execute(
      "UPDATE usuarios_sistema SET senha = ?, reset_token = NULL, reset_expiracao = NULL WHERE id = ?",
      [senhaFinal, user.id]
    );

    res.json({ success: true, message: "Senha redefinida com sucesso!" });
  } catch (err) {
    res.status(500).json({ error: "Erro ao redefinir senha." });
  }
});
// Buscar Perfil do Usuário
router.get('/perfil/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT id, nome, usuario, email, telefone, cargo FROM usuarios_sistema WHERE id = ?",
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Usuário não encontrado." });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Erro ao carregar perfil." });
  }
});

// Atualizar Dados Pessoais (Sem alterar cargo ou vínculos de obras)
router.put('/perfil/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, email, telefone, senhaAtual, novaSenha } = req.body;

  try {
    const [rows] = await db.execute("SELECT id, senha FROM usuarios_sistema WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Usuário não encontrado." });

    // Atualização de senha opcional (exige verificação da senha atual)
    if (novaSenha && novaSenha.trim() !== '') {
      if (senhaAtual !== rows[0].senha) {
        return res.status(400).json({ error: "A senha atual está incorreta." });
      }
      await db.execute(
        "UPDATE usuarios_sistema SET nome = ?, email = ?, telefone = ?, senha = ? WHERE id = ?",
        [nome.trim(), email?.trim(), telefone?.trim(), novaSenha.trim(), id]
      );
    } else {
      await db.execute(
        "UPDATE usuarios_sistema SET nome = ?, email = ?, telefone = ? WHERE id = ?",
        [nome.trim(), email?.trim(), telefone?.trim(), id]
      );
    }

    res.json({ success: true, message: "Dados pessoais atualizados com sucesso!" });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar dados pessoais." });
  }
});
export default router;