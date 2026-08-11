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

    // 🌟 AQUI ESTÁ A ALTERAÇÃO: Forçando o id_obra como NULL para o banco aceitar
    await connection.execute('DELETE FROM gestor_funcionarios WHERE id_usuario = ?', [id]);
    if (cargo === 'GESTOR' && Array.isArray(ids_funcionarios)) {
      const sqlVinculoFunc = 'INSERT INTO gestor_funcionarios (id_usuario, id_funcionario, id_obra) VALUES (?, ?, NULL)';
      for (const idFunc of ids_funcionarios) {
        await connection.execute(sqlVinculoFunc, [id, idFunc]);
      }
    }

    await connection.commit();
    res.json({ success: true, message: "Usuário updated com sucesso!" });
  } catch (err) {
    await connection.rollback();
    console.error("ERRO REAL DO BANCO:", err);
    if (err.errno === 1062 || err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: `O login '${usuario}' já está em uso.` });
    }
    res.status(500).json({ error: err.message }); 
  } finally {
    connection.release();
  }
});

// ========================================================
// 12-A. GET: LISTAR TODOS OS FUNCIONÁRIOS (EXCLUSIVO PARA O RH)
// ========================================================
router.get(['/master/funcionarios-todos', '/funcionarios'], async (req, res) => {
  try {
    // 💡 Traz TODOS os funcionários e busca o último gestor vinculado (se houver)
    const sql = `
      SELECT 
        f.id, 
        f.matricula, 
        f.nome, 
        f.cargo, 
        f.ativo, 
        f.observacoes,
        gf.id_usuario AS id_usuario_gestor,
        u.nome AS nome_gestor,
        u.nome AS gestor
      FROM funcionarios f
      LEFT JOIN (
        -- Agrupa por funcionário pegando apenas a última inserção de vínculo
        SELECT gf_inner.*
        FROM gestor_funcionarios gf_inner
        INNER JOIN (
          SELECT id_funcionario, MAX(id) as max_id
          FROM gestor_funcionarios
          GROUP BY id_funcionario
        ) gf_max ON gf_inner.id = gf_max.max_id
      ) gf ON f.id = gf.id_funcionario
      LEFT JOIN usuarios_sistema u ON gf.id_usuario = u.id
      ORDER BY f.nome ASC
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
      SELECT id, matricula, nome, cargo, ativo, observacoes
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

// ========================================================
// 13. ROTAS DE MATERIAIS (CADASTRO, LISTAGEM, EDIÇÃO, EXCLUSÃO)
// ========================================================

// 13-A. GET: Listar todos os materiais
router.get('/materiais', async (req, res) => {
  try {
    const sql = 'SELECT id, descricao, unidade_medida, tipo, quantidade_atual FROM materiais ORDER BY descricao ASC';
    const [rows] = await db.execute(sql);
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar materiais:', err);
    res.status(500).json({ error: 'Erro ao carregar lista de materiais.' });
  }
});

// 13-B. POST: Cadastrar novo material (TUDO EM MAIÚSCULO)
router.post('/materiais', async (req, res) => {
  const { descricao, unidade_medida, tipo, quantidade_atual } = req.body;

  if (!descricao) {
    return res.status(400).json({ error: 'A descrição é obrigatória.' });
  }

  try {
    const sql = 'INSERT INTO materiais (descricao, unidade_medida, tipo, quantidade_atual) VALUES (?, ?, ?, ?)';
    
    // Convertendo todos os textos para MAIÚSCULAS antes de salvar
    const descMaiuscula = descricao.trim().toUpperCase();
    const unidadeMaiuscula = unidade_medida ? unidade_medida.trim().toUpperCase() : 'UN';
    const tipoMaiusculo = tipo ? tipo.trim().toUpperCase() : 'HORIZONTAL';

    const [result] = await db.execute(sql, [
      descMaiuscula,
      unidadeMaiuscula,
      tipoMaiusculo,
      quantidade_atual || 0
    ]);

    res.status(201).json({ success: true, message: 'Material cadastrado com sucesso!', id: result.insertId });
  } catch (err) {
    console.error('Erro ao cadastrar material:', err);
    res.status(500).json({ error: 'Erro ao salvar o material no banco de dados.' });
  }
});

// 13-C. PUT: Atualizar material existente (TUDO EM MAIÚSCULO)
router.put('/materiais/:id', async (req, res) => {
  const { id } = req.params;
  const { descricao, unidade_medida, tipo, quantidade_atual } = req.body;

  if (!descricao) {
    return res.status(400).json({ error: 'A descrição é obrigatória.' });
  }

  try {
    const sql = 'UPDATE materiais SET descricao = ?, unidade_medida = ?, tipo = ?, quantidade_atual = ? WHERE id = ?';
    
    // Convertendo todos os textos para MAIÚSCULAS antes de atualizar
    const descMaiuscula = descricao.trim().toUpperCase();
    const unidadeMaiuscula = unidade_medida ? unidade_medida.trim().toUpperCase() : 'UN';
    const tipoMaiusculo = tipo ? tipo.trim().toUpperCase() : 'HORIZONTAL';

    await db.execute(sql, [
      descMaiuscula,
      unidadeMaiuscula,
      tipoMaiusculo,
      quantidade_atual || 0,
      parseInt(id)
    ]);

    res.json({ success: true, message: 'Material atualizado com sucesso!' });
  } catch (err) {
    console.error('Erro ao atualizar material:', err);
    res.status(500).json({ error: 'Erro ao atualizar o material no banco de dados.' });
  }
});

// 13-D. DELETE: Excluir material
router.delete('/materiais/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const sql = 'DELETE FROM materiais WHERE id = ?';
    await db.execute(sql, [parseInt(id)]);
    res.json({ success: true, message: 'Material excluído com sucesso!' });
  } catch (err) {
    console.error('Erro ao excluir material:', err);
    res.status(500).json({ error: 'Erro ao remover o material do banco de dados.' });
  }
});
// 14-A. GET: Listar Fornecedores com seus Materiais vinculados
router.get('/fornecedores', async (req, res) => {
  try {
    const sql = `
      SELECT 
        f.id, f.nome_fantasia, f.razao_social, f.cnpj, f.telefone, f.email,
        IFNULL(GROUP_CONCAT(fm.id_material SEPARATOR ','), '') AS ids_materiais
      FROM fornecedores f
      LEFT JOIN fornecedor_materiais fm ON f.id = fm.id_fornecedor
      GROUP BY f.id
      ORDER BY f.nome_fantasia ASC
    `;
    const [rows] = await db.execute(sql);
    
    // Converte a string "1,2,3" em um Array de Números [1, 2, 3]
    const resultado = rows.map(item => ({
      ...item,
      ids_materiais: item.ids_materiais ? item.ids_materiais.split(',').map(Number) : []
    }));

    res.json(resultado);
  } catch (err) {
    console.error('Erro ao buscar fornecedores:', err);
    res.status(500).json({ error: 'Erro ao carregar lista de fornecedores.' });
  }
});

// POST: Cadastrar Fornecedor e seus Materiais
router.post('/fornecedores', async (req, res) => {
  const { nome_fantasia, razao_social, cnpj, telefone, email, ids_materiais } = req.body;

  if (!nome_fantasia) {
    return res.status(400).json({ error: 'O Nome Fantasia é obrigatório.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const sqlFornecedor = 'INSERT INTO fornecedores (nome_fantasia, razao_social, cnpj, telefone, email) VALUES (?, ?, ?, ?, ?)';
    const [result] = await connection.execute(sqlFornecedor, [
      nome_fantasia.trim().toUpperCase(),
      razao_social ? razao_social.trim().toUpperCase() : '',
      cnpj ? cnpj.trim() : '',
      telefone ? telefone.trim() : '',
      email ? email.trim().toLowerCase() : ''
    ]);

    const idFornecedor = result.insertId;

    // Inserir vinculos de materiais
    if (Array.isArray(ids_materiais) && ids_materiais.length > 0) {
      const sqlMat = 'INSERT INTO fornecedor_materiais (id_fornecedor, id_material) VALUES (?, ?)';
      for (const idMat of ids_materiais) {
        await connection.execute(sqlMat, [idFornecedor, idMat]);
      }
    }

    await connection.commit();
    res.status(201).json({ success: true, message: 'Fornecedor cadastrado com sucesso!' });
  } catch (err) {
    await connection.rollback();
    console.error('Erro ao cadastrar fornecedor:', err);
    res.status(500).json({ error: 'Erro ao cadastrar fornecedor.' });
  } finally {
    connection.release();
  }
});

// PUT: Atualizar Fornecedor
router.put('/fornecedores/:id', async (req, res) => {
  const { id } = req.params;
  const { nome_fantasia, razao_social, cnpj, telefone, email, ids_materiais } = req.body;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const sqlFornecedor = 'UPDATE fornecedores SET nome_fantasia = ?, razao_social = ?, cnpj = ?, telefone = ?, email = ? WHERE id = ?';
    await connection.execute(sqlFornecedor, [
      nome_fantasia.trim().toUpperCase(),
      razao_social ? razao_social.trim().toUpperCase() : '',
      cnpj ? cnpj.trim() : '',
      telefone ? telefone.trim() : '',
      email ? email.trim().toLowerCase() : '',
      parseInt(id)
    ]);

    // Recria os vínculos de materiais
    await connection.execute('DELETE FROM fornecedor_materiais WHERE id_fornecedor = ?', [id]);

    if (Array.isArray(ids_materiais) && ids_materiais.length > 0) {
      const sqlMat = 'INSERT INTO fornecedor_materiais (id_fornecedor, id_material) VALUES (?, ?)';
      for (const idMat of ids_materiais) {
        await connection.execute(sqlMat, [id, idMat]);
      }
    }

    await connection.commit();
    res.json({ success: true, message: 'Fornecedor atualizado com sucesso!' });
  } catch (err) {
    await connection.rollback();
    console.error('Erro ao atualizar fornecedor:', err);
    res.status(500).json({ error: 'Erro ao atualizar fornecedor.' });
  } finally {
    connection.release();
  }
});

// DELETE: Excluir Fornecedor
router.delete('/fornecedores/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute('DELETE FROM fornecedores WHERE id = ?', [parseInt(id)]);
    res.json({ success: true, message: 'Fornecedor excluído com sucesso!' });
  } catch (err) {
    console.error('Erro ao excluir fornecedor:', err);
    res.status(500).json({ error: 'Erro ao excluir fornecedor.' });
  }
});

// ========================================================
// ROTAS DE FATURAMENTO DIRETO (PADRONIZADAS E CORRIGIDAS)
// ========================================================

// 1. GET - Listar faturamentos trazendo o NOME do gestor
// ✅ CÓDIGO CORRIGIDO (PLURAL + LEFT JOIN DO GESTOR)
router.get('/faturamento-direto', async (req, res) => {
  try {
    const sql = `
      SELECT 
        fd.*,
        u.nome AS gestor_nome
      FROM faturamentos_diretos fd
      LEFT JOIN usuarios_sistema u ON fd.id_gestor = u.id
      ORDER BY fd.id DESC
    `;
    const [rows] = await db.query(sql);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar faturamentos:', error);
    res.status(500).json({ error: 'Erro ao buscar faturamentos' });
  }
});

// 2. POST - Criar novo faturamento (recebendo id_gestor)
router.post('/faturamento-direto', async (req, res) => {
  const { 
    obra_id, 
    numero_pedido_obra, 
    boletim_medicao, 
    fornecedor_id, 
    numero_nota_fiscal, 
    data_nota_fiscal,
    valor_nota_fiscal, 
    status, 
    id_gestor,
    data_solicitacao,
    observacao 
  } = req.body;

  try {
    const boletimFormatado = boletim_medicao 
      ? String(boletim_medicao).replace(/\s+/g, '').toUpperCase() 
      : null;

    const sql = `
      INSERT INTO faturamentos_diretos 
      (obra_id, numero_pedido_obra, boletim_medicao, fornecedor_id, numero_nota_fiscal, data_nota_fiscal, valor_nota_fiscal, status, id_gestor, data_solicitacao, observacao) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(sql, [
      obra_id || null, 
      numero_pedido_obra || null, 
      boletimFormatado, 
      fornecedor_id || null, 
      numero_nota_fiscal || null, 
      data_nota_fiscal || null,
      valor_nota_fiscal || 0, 
      status || 'Solicitado', 
      id_gestor || null,
      data_solicitacao || null,
      observacao ? observacao.trim() : null
    ]);

    res.status(201).json({ id: result.insertId, message: 'Faturamento criado com sucesso' });
  } catch (error) {
    console.error('Erro ao inserir faturamento:', error);
    res.status(500).json({ error: 'Erro ao cadastrar faturamento' });
  }
});

// 3. PUT - Atualizar faturamento existente
router.put('/faturamento-direto/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    obra_id, 
    numero_pedido_obra, 
    boletim_medicao, 
    fornecedor_id, 
    numero_nota_fiscal, 
    data_nota_fiscal,
    valor_nota_fiscal, 
    status, 
    id_gestor,
    data_solicitacao,
    observacao 
  } = req.body;

  try {
    const boletimFormatado = boletim_medicao 
      ? String(boletim_medicao).replace(/\s+/g, '').toUpperCase() 
      : null;

    const sql = `
      UPDATE faturamentos_diretos SET 
        obra_id = ?, 
        numero_pedido_obra = ?, 
        boletim_medicao = ?, 
        fornecedor_id = ?, 
        numero_nota_fiscal = ?, 
        data_nota_fiscal = ?,
        valor_nota_fiscal = ?, 
        status = ?, 
        id_gestor = ?,
        data_solicitacao = ?,
        observacao = ? 
      WHERE id = ?
    `;

    await db.query(sql, [
      obra_id || null, 
      numero_pedido_obra || null, 
      boletimFormatado, 
      fornecedor_id || null, 
      numero_nota_fiscal || null, 
      data_nota_fiscal || null,
      valor_nota_fiscal || 0, 
      status || 'Solicitado', 
      id_gestor || null,
      data_solicitacao || null, 
      observacao ? observacao.trim() : null,
      id
    ]);

    res.json({ message: 'Faturamento atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar faturamento:', error);
    res.status(500).json({ error: 'Erro ao atualizar faturamento' });
  }
});

// 4. DELETE - Remover faturamento
router.delete('/faturamento-direto/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM faturamentos_diretos WHERE id = ?', [id]);
    res.json({ message: 'Faturamento excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar faturamento:', error);
    res.status(500).json({ error: 'Erro ao excluir faturamento' });
  }
});
export default router;