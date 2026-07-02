import express from 'express';
const router = express.Router();

// Caminho para a estrutura real do banco
import db from '../../db.js';

// ========================================================
// 7. POST: CADASTRAR NOVA OBRA (MASTER)
// ========================================================
router.post('/master/obras', async (req, res) => {
  const { nome_obra, codigo_obra, status, tipo_obra } = req.body;

  if (!nome_obra || !codigo_obra) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }

  try {
    const sqlObra = 'INSERT INTO obras (nome_obra, codigo_obra, status, tipo_obra) VALUES (?, ?, ?, ?)';
    
    const [resultadoObra] = await db.execute(sqlObra, [
      nome_obra.trim(), 
      codigo_obra.trim(), 
      status || 'ATIVA',
      tipo_obra ? tipo_obra.trim().toUpperCase() : 'PRODUTIVA'
    ]);

    return res.status(201).json({ 
      success: true, 
      message: 'Obra criada com sucesso no sistema global!',
      id_obra: resultadoObra.insertId 
    });

  } catch (error) {
    console.error("Erro ao criar obra:", error);
    return res.status(500).json({ error: 'Erro interno ao salvar a obra.' });
  }
});

// ========================================================
// 7-B. PUT: ATUALIZAR DADOS DA OBRA (MASTER)
// ========================================================
router.put('/master/obras/:id', async (req, res) => {
  const { id } = req.params;
  const { nome_obra, codigo_obra, status, tipo_obra } = req.body;

  if (!nome_obra || !codigo_obra || !status || !tipo_obra) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes." });
  }

  try {
    const sql = "UPDATE obras SET nome_obra = ?, codigo_obra = ?, status = ?, tipo_obra = ? WHERE id = ?";
    
    await db.execute(sql, [
      nome_obra.trim(), 
      codigo_obra.trim(), 
      status.trim().toUpperCase(), 
      tipo_obra.trim().toUpperCase(), 
      parseInt(id)
    ]);
    
    res.json({ success: true, message: "Obra atualizada com sucesso!" });
  } catch (err) {
    console.error("Erro no banco ao atualizar obra:", err);
    res.status(500).json({ error: "Erro ao atualizar dados da obra no banco." });
  }
});

// ========================================================
// 7-C. GET: LISTAR TODAS AS OBRAS GLOBALMENTE (Ativas e Inativas - MASTER)
// ========================================================
router.get('/master/obras-geral', async (req, res) => {
  try {
    const sql = "SELECT id, nome_obra, codigo_obra, status, tipo_obra FROM obras ORDER BY status ASC, nome_obra ASC";
    const [rows] = await db.execute(sql);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar todas as obras:", err);
    res.status(500).json({ error: "Erro interno ao carregar lista geral de obras." });
  }
});

// ========================================================
// 8. POST: CRIAR NOVO USUÁRIO DO SISTEMA (MASTER)
// ========================================================
router.post('/master/usuarios', async (req, res) => {
  const { nome, usuario, senha, cargo, ids_obras, ids_funcionarios } = req.body;

  if (!nome || !usuario || !senha || !cargo) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const sqlUser = 'INSERT INTO usuarios_sistema (nome, usuario, senha, cargo) VALUES (?, ?, ?, ?)';
    const [resultadoUser] = await connection.execute(sqlUser, [nome.trim(), usuario.trim(), String(senha).trim(), cargo]);
    const idNovoUsuario = resultadoUser.insertId;

    if (cargo === 'GESTOR' && Array.isArray(ids_obras)) {
      for (const idObra of ids_obras) {
        const [emUso] = await connection.execute(
          'SELECT id FROM gestor_obras WHERE id_obra = ? AND id_usuario != 1', 
          [idObra]
        );
        
        if (emUso.length > 0) {
          throw { customMessage: "Uma ou mais obras selecionadas já estão vinculadas a outro Gestor. Atualize a página." };
        }

        await connection.execute('INSERT INTO gestor_obras (id_usuario, id_obra) VALUES (?, ?)', [idNovoUsuario, idObra]);
      }
    }

    if (cargo === 'GESTOR' && Array.isArray(ids_funcionarios)) {
      const sqlVinculoFunc = 'INSERT INTO gestor_funcionarios (id_usuario, id_funcionario) VALUES (?, ?)';
      for (const idFunc of ids_funcionarios) {
        await connection.execute(sqlVinculoFunc, [idNovoUsuario, idFunc]);
      }
    }

    await connection.commit();
    res.status(201).json({ success: true, message: "Usuário gravado com sucesso!", id: idNovoUsuario });
  } catch (err) {
    await connection.rollback();
    
    if (err.customMessage) {
      return res.status(400).json({ error: err.customMessage });
    }
    if (err.errno === 1062 || err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: `O login '${usuario}' já está em uso.` });
    }
    console.error("Erro no cadastro:", err);
    res.status(500).json({ error: "Erro interno ao cadastrar usuário." });
  } finally {
    connection.release();
  }
});

// ========================================================
// 9. GET: LISTAR TODOS OS USUÁRIOS (MASTER) - Mantém a listagem completa intacta
// ========================================================
router.get('/master/usuarios', async (req, res) => {
  try {
    const sql = `
      SELECT 
        u.id, u.nome, u.usuario, u.senha, u.cargo,
        IFNULL(GROUP_CONCAT(DISTINCT o.id SEPARATOR ','), '') AS id_obras,
        IFNULL(GROUP_CONCAT(DISTINCT f.id SEPARATOR ','), '') AS id_funcionarios,
        IFNULL(GROUP_CONCAT(DISTINCT o.nome_obra SEPARATOR ', '), 'Nenhuma') AS obras,
        IFNULL(GROUP_CONCAT(DISTINCT f.nome SEPARATOR ', '), 'Nenhum') AS funcionarios
      FROM usuarios_sistema u
      LEFT JOIN gestor_obras go ON u.id = go.id_usuario
      LEFT JOIN obras o ON go.id_obra = o.id
      LEFT JOIN gestor_funcionarios gf ON u.id = gf.id_usuario
      LEFT JOIN funcionarios f ON gf.id_funcionario = f.id
      GROUP BY u.id, u.nome, u.usuario, u.senha, u.cargo
      ORDER BY u.nome ASC
    `;
    const [rows] = await db.execute(sql);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar usuários:", err);
    res.status(500).json({ error: "Erro ao carregar lista de usuários." });
  }
});

// ========================================================
// 10. DELETE: EXCLUIR UM USUÁRIO DO SISTEMA (MASTER)
// ========================================================
router.delete('/master/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM gestor_obras WHERE id_usuario = ?', [id]);
    await connection.execute('DELETE FROM gestor_funcionarios WHERE id_usuario = ?', [id]);
    await connection.execute('DELETE FROM usuarios_sistema WHERE id = ?', [id]);
    await connection.commit();
    res.json({ success: true, message: "Usuário excluído com sucesso!" });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: "Erro ao remover usuário do sistema." });
  } finally {
    connection.release();
  }
});

// ========================================================
// 11. PUT: ATUALIZAR USUÁRIO (MASTER)
// ========================================================
router.put('/master/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, usuario, senha, cargo, ids_obras, ids_funcionarios } = req.body;

  if (!nome || !usuario || !cargo) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    let sqlUpdateUser, paramsUpdateUser;
    if (senha && String(senha).trim() !== '') {
      sqlUpdateUser = `UPDATE usuarios_sistema SET nome = ?, usuario = ?, senha = ?, cargo = ? WHERE id = ?`;
      paramsUpdateUser = [nome.trim(), usuario.trim(), String(senha).trim(), cargo, id];
    } else {
      sqlUpdateUser = `UPDATE usuarios_sistema SET nome = ?, usuario = ?, cargo = ? WHERE id = ?`;
      paramsUpdateUser = [nome.trim(), usuario.trim(), cargo, id];
    }
    await connection.execute(sqlUpdateUser, paramsUpdateUser);

    await connection.execute('DELETE FROM gestor_obras WHERE id_usuario = ?', [id]);
    if (cargo === 'GESTOR' && Array.isArray(ids_obras)) {
      const sqlVinculoObra = 'INSERT INTO gestor_obras (id_usuario, id_obra) VALUES (?, ?)';
      for (const idObra of ids_obras) {
        await connection.execute(sqlVinculoObra, [id, idObra]);
      }
    }

    await connection.execute('DELETE FROM gestor_funcionarios WHERE id_usuario = ?', [id]);
    if (cargo === 'GESTOR' && Array.isArray(ids_funcionarios)) {
      const sqlVinculoFunc = 'INSERT INTO gestor_funcionarios (id_usuario, id_funcionario) VALUES (?, ?)';
      for (const idFunc of ids_funcionarios) {
        await connection.execute(sqlVinculoFunc, [id, idFunc]);
      }
    }

    await connection.commit();
    res.json({ success: true, message: "Usuário updated com sucesso!" });
  } catch (err) {
    await connection.rollback();
    if (err.errno === 1062 || err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: `O login '${usuario}' já está em uso.` });
    }
    res.status(500).json({ error: "Erro interno ao atualizar usuário." });
  } finally {
    connection.release();
  }
});

// ========================================================
// 12-A. GET: LISTAR TODOS OS FUNCIONÁRIOS (EXCLUSIVO PARA O RH)
// ========================================================
router.get(['/master/funcionarios-todos', '/funcionarios'], async (req, res) => {
  try {
    // 💡 Traz absolutamente TODO MUNDO. Não importa se tem gestor, se não tem, status, etc.
    const sql = `
      SELECT id, matricula, nome, cargo, ativo 
      FROM funcionarios 
      ORDER BY nome ASC
    `;
    const [rows] = await db.execute(sql);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar funcionários para o RH:", err);
    res.status(500).json({ error: "Erro ao carregar lista geral de funcionários." });
  }
});

// ========================================================
// 12-B. GET: LISTAR APENAS FUNCIONÁRIOS DISPONÍVEIS (EXCLUSIVO PARA CRIAR/EDITAR USUÁRIOS)
// ========================================================
router.get('/master/funcionarios-disponiveis', async (req, res) => {
  const { id_usuario_editando } = req.query;

  try {
    const paramIdUsuario = id_usuario_editando ? parseInt(id_usuario_editando) : -1;
    
    // 💡 Regra cirúrgica: Esconde quem já está com outro gestor, 
    // mas mantém os do próprio gestor caso seja uma edição.
    const sql = `
      SELECT id, matricula, nome, cargo, ativo 
      FROM funcionarios 
      WHERE id NOT IN (
        SELECT id_funcionario 
        FROM gestor_funcionarios 
        WHERE id_usuario != ?
      )
      ORDER BY nome ASC
    `;
    
    const [rows] = await db.execute(sql, [paramIdUsuario]);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar funcionários disponíveis:", err);
    res.status(500).json({ error: "Erro ao carregar funcionários disponíveis." });
  }
});

// ========================================================
// 12-B. GET: LISTAR OBRAS DISPONÍVEIS NO FORMULÁRIO
// ========================================================
router.get('/master/obras-todas', async (req, res) => {
  const { id_editando } = req.query;
  
  try {
    const paramId = id_editando ? parseInt(id_editando) : -1;

    const sql = `
      SELECT id, codigo_obra, nome_obra 
      FROM obras 
      WHERE status = 'ATIVA'
      AND id NOT IN (
        SELECT id_obra 
        FROM gestor_obras 
        WHERE id_usuario != ? AND id_usuario != 1
      )
      ORDER BY nome_obra ASC
    `;
    const [rows] = await db.execute(sql, [paramId]);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar obras disponíveis:", err);
    res.status(500).json({ error: "Erro ao carregar obras globais." });
  }
});

export default router;