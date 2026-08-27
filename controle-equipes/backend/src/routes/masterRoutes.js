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

    // VÍNCULOS DO GESTOR (Regra original mantida)
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

    // NEW: VÍNCULOS DA ENGENHARIA
    if (cargo === 'ENGENHARIA' && Array.isArray(ids_obras)) {
      const sqlEng = 'INSERT INTO engenharia_obras (id_usuario, id_obra) VALUES (?, ?)';
      for (const idObra of ids_obras) {
        await connection.execute(sqlEng, [idNovoUsuario, idObra]);
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
// 9. GET: LISTAR TODOS OS USUÁRIOS (MASTER e ALIAS /usuarios)
// ========================================================
router.get(['/master/usuarios', '/usuarios'], async (req, res) => {
  try {
    const sql = `
      SELECT 
        u.id, u.nome, u.usuario, u.senha, u.cargo,
        IFNULL(
          CASE 
            WHEN u.cargo = 'ENGENHARIA' THEN GROUP_CONCAT(DISTINCT eo.id_obra SEPARATOR ',')
            ELSE GROUP_CONCAT(DISTINCT go.id_obra SEPARATOR ',')
          END, ''
        ) AS id_obras,
        IFNULL(GROUP_CONCAT(DISTINCT f.id SEPARATOR ','), '') AS id_funcionarios,
        IFNULL(
          CASE 
            WHEN u.cargo = 'ENGENHARIA' THEN GROUP_CONCAT(DISTINCT o_eng.nome_obra SEPARATOR ', ')
            ELSE GROUP_CONCAT(DISTINCT o_gestor.nome_obra SEPARATOR ', ')
          END, 'Nenhuma'
        ) AS obras,
        IFNULL(GROUP_CONCAT(DISTINCT f.nome SEPARATOR ', '), 'Nenhum') AS funcionarios
      FROM usuarios_sistema u
      LEFT JOIN gestor_obras go ON u.id = go.id_usuario
      LEFT JOIN obras o_gestor ON go.id_obra = o_gestor.id
      LEFT JOIN engenharia_obras eo ON u.id = eo.id_usuario
      LEFT JOIN obras o_eng ON eo.id_obra = o_eng.id
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
    await connection.execute('DELETE FROM engenharia_obras WHERE id_usuario = ?', [id]);
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

    // Limpa vínculos anteriores de obras e funcionários
    await connection.execute('DELETE FROM gestor_obras WHERE id_usuario = ?', [id]);
    await connection.execute('DELETE FROM engenharia_obras WHERE id_usuario = ?', [id]);
    await connection.execute('DELETE FROM gestor_funcionarios WHERE id_usuario = ?', [id]);

    // Trata novos vínculos do Gestor
    if (cargo === 'GESTOR') {
      if (Array.isArray(ids_obras)) {
        const sqlVinculoObra = 'INSERT INTO gestor_obras (id_usuario, id_obra) VALUES (?, ?)';
        for (const idObra of ids_obras) {
          await connection.execute(sqlVinculoObra, [id, idObra]);
        }
      }
      if (Array.isArray(ids_funcionarios)) {
        const sqlVinculoFunc = 'INSERT INTO gestor_funcionarios (id_usuario, id_funcionario, id_obra) VALUES (?, ?, NULL)';
        for (const idFunc of ids_funcionarios) {
          await connection.execute(sqlVinculoFunc, [id, idFunc]);
        }
      }
    }

    // Trata novos vínculos da Engenharia
    if (cargo === 'ENGENHARIA' && Array.isArray(ids_obras)) {
      const sqlVinculoEng = 'INSERT INTO engenharia_obras (id_usuario, id_obra) VALUES (?, ?)';
      for (const idObra of ids_obras) {
        await connection.execute(sqlVinculoEng, [id, idObra]);
      }
    }

    await connection.commit();
    res.json({ success: true, message: "Usuário atualizado com sucesso!" });
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
// 12-B. GET: LISTAR APENAS FUNCIONÁRIOS DISPONÍVEIS
// ========================================================
router.get('/master/funcionarios-disponiveis', async (req, res) => {
  const { id_usuario_editando } = req.query;

  try {
    const paramIdUsuario = id_usuario_editando ? parseInt(id_usuario_editando) : -1;
    
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
// 12-C. GET: LISTAR OBRAS DISPONÍVEIS NO FORMULÁRIO
// ========================================================
router.get('/master/obras-todas', async (req, res) => {
  const { id_editando, cargo } = req.query;
  
  try {
    const paramId = id_editando ? parseInt(id_editando) : -1;

    // Se for perfil ENGENHARIA, retorna todas as obras ativas para ele associar
    if (cargo === 'ENGENHARIA') {
      const sql = `SELECT id, codigo_obra, nome_obra FROM obras WHERE status = 'ATIVA' ORDER BY nome_obra ASC`;
      const [rows] = await db.execute(sql);
      return res.json(rows);
    }

    // Regra padrão para GESTOR (Obras ativas que não estão com outros gestores)
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
// 13. ROTAS DE MATERIAIS (CODIGO, DESCRICAO, UNIDADE_MEDIDA, TIPO)
// ========================================================

// 13-A. GET: Listar todos os materiais
router.get('/materiais', async (req, res) => {
  try {
    const sql = `
      SELECT 
        m.id, 
        m.codigo, 
        m.descricao, 
        m.unidade_medida, 
        m.tipo,
        GROUP_CONCAT(fm.id_fornecedor) AS fornecedores_ids
      FROM materiais m
      LEFT JOIN fornecedor_materiais fm ON m.id = fm.id_material
      GROUP BY m.id, m.codigo, m.descricao, m.unidade_medida, m.tipo
      ORDER BY m.descricao ASC
    `;
    const [rows] = await db.execute(sql);
    
    const formatados = rows.map(mat => ({
      ...mat,
      fornecedores_ids: mat.fornecedores_ids 
        ? mat.fornecedores_ids.split(',').map(Number) 
        : []
    }));

    res.json(formatados);
  } catch (err) {
    console.error('Erro ao buscar materiais:', err);
    res.status(500).json({ error: 'Erro ao carregar lista de materiais.' });
  }
});

// 13-B. POST: Cadastrar novo material
router.post('/materiais', async (req, res) => {
  const { codigo, descricao, unidade_medida, tipo } = req.body;

  if (!descricao) {
    return res.status(400).json({ error: 'A descrição é obrigatória.' });
  }

  try {
    const sql = 'INSERT INTO materiais (codigo, descricao, unidade_medida, tipo) VALUES (?, ?, ?, ?)';
    
    const codigoValido = codigo && codigo.trim() !== '' ? codigo.trim().toUpperCase() : null;
    const descMaiuscula = descricao.trim().toUpperCase();
    const unidadeMaiuscula = unidade_medida ? unidade_medida.trim().toUpperCase() : 'UN';
    const tipoMaiusculo = tipo ? tipo.trim().toUpperCase() : 'HORIZONTAL';

    const [result] = await db.execute(sql, [
      codigoValido,
      descMaiuscula,
      unidadeMaiuscula,
      tipoMaiusculo
    ]);

    res.status(201).json({ success: true, message: 'Material cadastrado com sucesso!', id: result.insertId });
  } catch (err) {
    console.error('Erro ao cadastrar material:', err);
    res.status(500).json({ error: 'Erro ao salvar o material no banco de dados.' });
  }
});

// 13-C. PUT: Atualizar material existente
router.put('/materiais/:id', async (req, res) => {
  const { id } = req.params;
  const { codigo, descricao, unidade_medida, tipo } = req.body;

  if (!descricao) {
    return res.status(400).json({ error: 'A descrição é obrigatória.' });
  }

  try {
    const sql = 'UPDATE materiais SET codigo = ?, descricao = ?, unidade_medida = ?, tipo = ? WHERE id = ?';
    
    const codigoValido = codigo && codigo.trim() !== '' ? codigo.trim().toUpperCase() : null;
    const descMaiuscula = descricao.trim().toUpperCase();
    const unidadeMaiuscula = unidade_medida ? unidade_medida.trim().toUpperCase() : 'UN';
    const tipoMaiusculo = tipo ? tipo.trim().toUpperCase() : 'HORIZONTAL';

    await db.execute(sql, [
      codigoValido,
      descMaiuscula,
      unidadeMaiuscula,
      tipoMaiusculo,
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
    res.status(500).json({ error: 'Erro ao excluir o material. Verifique se ele não possui vínculos atrelados.' });
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

// ========================================================
// 14. ROTAS DE FORNECEDORES E VÍNCULOS DE MATERIAIS
// ========================================================

// 14-A. GET: Listar Fornecedores
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

// 14-B. GET: Listar Relação de Fornecedor x Materiais (Auxiliar para Frontend)
router.get('/fornecedor-materiais', async (req, res) => {
  try {
    const sql = 'SELECT id_fornecedor, id_material FROM fornecedor_materiais';
    const [rows] = await db.execute(sql);
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar vinculos fornecedor-materiais:', err);
    res.status(500).json({ error: 'Erro ao buscar vinculos de fornecedor x materiais.' });
  }
});

// 14-C. POST: Cadastrar Fornecedor
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

// 14-D. PUT: Atualizar Fornecedor
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

// 14-E. DELETE: Excluir Fornecedor
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
// 15. ROTAS DE FATURAMENTO DIRETO (INCLUINDO ITENS COM CAPACIDADE DE USO)
// ========================================================

// 15-A. GET: Listar Faturamentos Diretos com Gestor e Itens (Filtrado por Vínculo de Obra em engenharia_obras)
router.get('/faturamento-direto', async (req, res) => {
  try {
    const { usuario_id, id, cargo, id_obra } = req.query;
    const idUsuario = usuario_id || id;

    let sql = `
      SELECT 
        fd.*,
        u.nome AS gestor_nome
      FROM faturamentos_diretos fd
      LEFT JOIN usuarios_sistema u ON fd.id_gestor = u.id
      WHERE 1=1
    `;
    const params = [];

    // 🔒 RESTRIÇÃO DE ACESSO VIA TABELA ENGENHARIA_OBRAS
    if (idUsuario) {
      const cargoUpper = cargo ? String(cargo).toUpperCase() : '';
      const isMaster = cargoUpper === 'MASTER' || cargoUpper === 'RH';

      if (!isMaster) {
        // Filtra sempre pela tabela engenharia_obras para não-masters
        sql += ` AND fd.obra_id IN (SELECT id_obra FROM engenharia_obras WHERE id_usuario = ?)`;
        params.push(Number(idUsuario));
      }
    }

    // Filtro adicional por obra específica
    if (id_obra && id_obra !== '' && id_obra !== 'TODAS') {
      sql += ` AND fd.obra_id = ?`;
      params.push(Number(id_obra));
    }

    sql += ` ORDER BY fd.id DESC`;

    const [faturamentos] = await db.query(sql, params);

    try {
      const [itens] = await db.query(`
        SELECT fi.*, m.descricao AS nome_material 
        FROM faturamento_itens fi
        LEFT JOIN materiais m ON fi.material_id = m.id
      `);

      const faturamentosComItens = faturamentos.map(fat => ({
        ...fat,
        itens: itens.filter(it => String(it.faturamento_id) === String(fat.id))
      }));

      return res.json(faturamentosComItens);
    } catch {
      return res.json(faturamentos);
    }

  } catch (error) {
    console.error('Erro ao buscar faturamentos:', error);
    res.status(500).json({ error: 'Erro ao buscar faturamentos' });
  }
});

// ========================================================
// 15-B. POST: Criar Faturamento Direto (Com ajuste de Estoque)
// ========================================================
router.post('/faturamento-direto', async (req, res) => {
  const { 
    obra_id, 
    numero_pedido_obra, 
    numero_pedido_concessionaria,
    boletim_medicao, 
    fornecedor_id, 
    numero_nota_fiscal, 
    data_nota_fiscal,
    valor_nota_fiscal, 
    valor_frete,
    status, 
    id_gestor,
    data_solicitacao,
    observacao,
    data_envio,
    url_email,
    itens,
    id_usuario,
    cargo
  } = req.body;

  const valorFreteValido = (valor_frete !== undefined && valor_frete !== '' && valor_frete !== null) ? parseFloat(valor_frete) : 0;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const obraIdValida = (obra_id && String(obra_id).trim() !== '') ? parseInt(obra_id) : null;
    const gestorIdValido = (id_gestor && String(id_gestor).trim() !== '') ? parseInt(id_gestor) : null;
    const usuarioAcaoId = id_usuario || gestorIdValido || 1; // Garante um id_usuario válido

    if (usuarioAcaoId && obraIdValida) {
      const cargoUpper = cargo ? String(cargo).toUpperCase() : '';
      if (cargoUpper !== 'MASTER' && cargoUpper !== 'RH') {
        const [vinculo] = await connection.query(
          `SELECT id FROM engenharia_obras WHERE id_usuario = ? AND id_obra = ?`,
          [Number(usuarioAcaoId), Number(obraIdValida)]
        );

        if (vinculo.length === 0) {
          await connection.rollback();
          return res.status(403).json({ error: 'Você não possui permissão para cadastrar lançamentos nesta obra.' });
        }
      }
    }

    const statusFinal = status || 'Solicitado';
    const boletimFormatado = boletim_medicao ? String(boletim_medicao).replace(/\s+/g, '').toUpperCase() : null;
    const pedidoRaw = numero_pedido_obra ?? numero_pedido_concessionaria;
    const pedidoObraValido = (pedidoRaw !== undefined && pedidoRaw !== '' && pedidoRaw !== null) ? parseInt(pedidoRaw) : 0;
    const fornecedorIdValido = (fornecedor_id && String(fornecedor_id).trim() !== '') ? parseInt(fornecedor_id) : null;
    const parseDate = (val) => (val && String(val).trim() !== '') ? val : null;
    const valorNfValido = (valor_nota_fiscal !== undefined && valor_nota_fiscal !== '' && valor_nota_fiscal !== null) ? parseFloat(valor_nota_fiscal) : 0;

    // CORREÇÃO: Adicionado o 14º '?' na cláusula VALUES
    const sqlFaturamento = `
      INSERT INTO faturamentos_diretos 
      (obra_id, numero_pedido_obra, boletim_medicao, fornecedor_id, numero_nota_fiscal, data_nota_fiscal, valor_nota_fiscal, valor_frete, status, id_gestor, data_solicitacao, observacao, data_envio, url_email) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await connection.query(sqlFaturamento, [
      obraIdValida, 
      pedidoObraValido, 
      boletimFormatado, 
      fornecedorIdValido, 
      numero_nota_fiscal ? String(numero_nota_fiscal).trim() : '', 
      parseDate(data_nota_fiscal),
      valorNfValido, 
      valorFreteValido,
      statusFinal, 
      gestorIdValido,
      parseDate(data_solicitacao),
      observacao ? String(observacao).trim() : '',
      parseDate(data_envio),
      url_email ? String(url_email).trim() : null
    ]);

    const idFaturamento = result.insertId;

    if (Array.isArray(itens) && itens.length > 0) {
      const sqlItem = `
        INSERT INTO faturamento_itens 
        (faturamento_id, material_id, quantidade, capacidade_uso, valor_unitario) 
        VALUES (?, ?, ?, ?, ?)
      `;

      const sqlMovimentacao = `
        INSERT INTO estoque_movimentacoes 
        (tipo_movimentacao, origem_tipo, origem_id, destino_tipo, destino_id, material_id, quantidade, faturamento_id, data_movimentacao, status, data_solicitada, id_usuario, quem_pede_id)
        VALUES ('ENTRADA_FORNECEDOR', 'FORNECEDOR', ?, 'OBRA', ?, ?, ?, ?, NOW(), 'PENDENTE', CURDATE(), ?, ?)
      `;

      const sqlAtualizaSaldo = `
        INSERT INTO estoque_saldos (local_tipo, local_id, material_id, quantidade)
        VALUES ('OBRA', ?, ?, ?)
        ON DUPLICATE KEY UPDATE quantidade = quantidade + VALUES(quantidade)
      `;

      for (const item of itens) {
        if (item.material_id && String(item.material_id).trim() !== '') {
          const matId = parseInt(item.material_id);
          const qtd = parseFloat(item.quantidade) || 0;

          await connection.query(sqlItem, [
            idFaturamento,
            matId,
            qtd,
            item.capacidade_uso ? String(item.capacidade_uso).trim() : null,
            parseFloat(item.valor_unitario) || 0
          ]);

          // Movimentação e Saldo SOMENTE se status for 'NF recebida e em estoque'
          if (statusFinal === 'NF recebida e em estoque' && qtd > 0 && obraIdValida) {
            await connection.query(sqlMovimentacao, [
              fornecedorIdValido || 0,
              obraIdValida,
              matId,
              qtd,
              idFaturamento,
              usuarioAcaoId,
              gestorIdValido
            ]);

            await connection.query(sqlAtualizaSaldo, [
              obraIdValida,
              matId,
              qtd
            ]);
          }
        }
      }
    }

    await connection.commit();
    res.status(201).json({ id: idFaturamento, message: 'Faturamento cadastrado com sucesso!' });
  } catch (error) {
    await connection.rollback();
    console.error('ERRO REAL NO BANCO DE DADOS:', error);
    res.status(500).json({ error: 'Erro ao cadastrar faturamento', detalhe: error.message });
  } finally {
    connection.release();
  }
});


// ========================================================
// 15-C. PUT: Atualizar Faturamento (Gera/Estorna Estoque)
// ========================================================
router.put('/faturamento-direto/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    obra_id, 
    numero_pedido_obra, 
    numero_pedido_concessionaria,
    boletim_medicao, 
    fornecedor_id, 
    numero_nota_fiscal, 
    data_nota_fiscal,
    valor_nota_fiscal, 
    valor_frete,
    status, 
    id_gestor,
    data_solicitacao,
    observacao,
    data_envio,
    url_email,
    itens,
    id_usuario
  } = req.body;

  const faturamentoId = parseInt(id);
  const statusNovo = status || 'Solicitado';
  const gestorIdValido = (id_gestor && String(id_gestor).trim() !== '') ? parseInt(id_gestor) : null;
  const usuarioAcaoId = id_usuario || gestorIdValido || 1;
  const valorFreteValido = (valor_frete !== undefined && valor_frete !== '' && valor_frete !== null) ? parseFloat(valor_frete) : 0;

  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Estorna os saldos com bloqueio de leitura FOR UPDATE (Previne Deadlock)
      const [movsAntigas] = await connection.query(
        `SELECT material_id, destino_id AS obra_id, quantidade 
         FROM estoque_movimentacoes 
         WHERE faturamento_id = ? AND tipo_movimentacao = 'ENTRADA_FORNECEDOR' FOR UPDATE`,
        [faturamentoId]
      );

      for (const mov of movsAntigas) {
        await connection.query(
          `UPDATE estoque_saldos 
           SET quantidade = GREATEST(0, quantidade - ?) 
           WHERE local_tipo = 'OBRA' AND local_id = ? AND material_id = ?`,
          [parseFloat(mov.quantidade), mov.obra_id, mov.material_id]
        );
      }

      // 2. Limpa dados antigos vinculados ao faturamento
      await connection.query('DELETE FROM estoque_movimentacoes WHERE faturamento_id = ?', [faturamentoId]);
      await connection.query('DELETE FROM faturamento_itens WHERE faturamento_id = ?', [faturamentoId]);

      const boletimFormatado = boletim_medicao ? String(boletim_medicao).replace(/\s+/g, '').toUpperCase() : '';
      const pedidoRaw = numero_pedido_obra ?? numero_pedido_concessionaria;
      const pedidoObraValido = (pedidoRaw !== undefined && pedidoRaw !== '' && pedidoRaw !== null) ? parseInt(pedidoRaw) : 0;
      const parseDate = (val) => (val && String(val).trim() !== '') ? val : null;
      const obraIdValida = (obra_id && String(obra_id).trim() !== '') ? parseInt(obra_id) : null;
      const fornecedorIdValido = (fornecedor_id && String(fornecedor_id).trim() !== '') ? parseInt(fornecedor_id) : null;

      const sqlUpdateFat = `
        UPDATE faturamentos_diretos SET 
          obra_id = ?, 
          numero_pedido_obra = ?, 
          boletim_medicao = ?, 
          fornecedor_id = ?, 
          numero_nota_fiscal = ?, 
          data_nota_fiscal = ?,
          valor_nota_fiscal = ?, 
          valor_frete = ?, 
          status = ?, 
          id_gestor = ?,
          data_solicitacao = ?,
          observacao = ?,
          data_envio = ?,
          url_email = ? 
        WHERE id = ?
      `;

      await connection.query(sqlUpdateFat, [
        obraIdValida, 
        pedidoObraValido, 
        boletimFormatado, 
        fornecedorIdValido, 
        numero_nota_fiscal ? String(numero_nota_fiscal).trim() : '', 
        parseDate(data_nota_fiscal),
        parseFloat(valor_nota_fiscal) || 0, 
        valorFreteValido,
        statusNovo, 
        gestorIdValido,
        parseDate(data_solicitacao), 
        observacao ? String(observacao).trim() : '',
        parseDate(data_envio),
        url_email ? String(url_email).trim() : null,
        faturamentoId
      ]);

      // 3. Insere os novos itens e atualiza saldo se o status for 'NF recebida e em estoque'
      if (Array.isArray(itens) && itens.length > 0) {
        const sqlItem = `
          INSERT INTO faturamento_itens 
          (faturamento_id, material_id, quantidade, capacidade_uso, valor_unitario) 
          VALUES (?, ?, ?, ?, ?)
        `;

        // Ajustado status de movimentação para 'CONCLUIDO' (alinhado com a rota POST)
        const sqlMovimentacao = `
          INSERT INTO estoque_movimentacoes 
          (tipo_movimentacao, origem_tipo, origem_id, destino_tipo, destino_id, material_id, quantidade, faturamento_id, data_movimentacao, status, data_solicitada, id_usuario, quem_pede_id)
          VALUES ('ENTRADA_FORNECEDOR', 'FORNECEDOR', ?, 'OBRA', ?, ?, ?, ?, NOW(), 'PENDENTE', CURDATE(), ?, ?)
        `;

        const sqlAtualizaSaldo = `
          INSERT INTO estoque_saldos (local_tipo, local_id, material_id, quantidade)
          VALUES ('OBRA', ?, ?, ?)
          ON DUPLICATE KEY UPDATE quantidade = quantidade + VALUES(quantidade)
        `;

        for (const item of itens) {
          if (item.material_id) {
            const matId = parseInt(item.material_id);
            const qtd = parseFloat(item.quantidade) || 0;

            await connection.query(sqlItem, [
              faturamentoId,
              matId,
              qtd,
              item.capacidade_uso ? String(item.capacidade_uso).trim() : null,
              parseFloat(item.valor_unitario) || 0
            ]);

            if (statusNovo === 'NF recebida e em estoque' && qtd > 0 && obraIdValida) {
              await connection.query(sqlMovimentacao, [
                fornecedorIdValido || 0,
                obraIdValida,
                matId,
                qtd,
                faturamentoId,
                usuarioAcaoId,
                gestorIdValido
              ]);

              await connection.query(sqlAtualizaSaldo, [
                obraIdValida,
                matId,
                qtd
              ]);
            }
          }
        }
      }

      await connection.commit();
      return res.json({ success: true, message: 'Faturamento e estoque processados com sucesso!' });

    } catch (error) {
      await connection.rollback();

      // Se for Deadlock (1213) e ainda houver tentativas, tenta novamente
      if (error.errno === 1213 && attempt < maxRetries - 1) {
        attempt++;
        await new Promise(resolve => setTimeout(resolve, 50 * attempt));
        continue;
      }

      console.error('Erro ao atualizar faturamento:', error);
      return res.status(500).json({ error: 'Erro interno ao atualizar faturamento', detalhe: error.message });
    } finally {
      connection.release();
    }
  }
});

// ========================================================
// DELETE: Remover faturamento (Com estorno de estoque e exclusão em cascata)
// ========================================================
router.delete('/faturamento-direto/:id', async (req, res) => {
  const { id } = req.params;
  const faturamentoId = parseInt(id);

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Busca as movimentações associadas a este faturamento com bloqueio
    const [movs] = await connection.query(
      `SELECT material_id, destino_id AS obra_id, quantidade 
       FROM estoque_movimentacoes 
       WHERE faturamento_id = ? AND tipo_movimentacao = 'ENTRADA_FORNECEDOR' FOR UPDATE`,
      [faturamentoId]
    );

    // 2. Estorna o saldo das obras que receberam os materiais
    for (const mov of movs) {
      await connection.query(
        `UPDATE estoque_saldos 
         SET quantidade = GREATEST(0, quantidade - ?) 
         WHERE local_tipo = 'OBRA' AND local_id = ? AND material_id = ?`,
        [parseFloat(mov.quantidade), mov.obra_id, mov.material_id]
      );
    }

    // 3. Remove os registros filhos nas tabelas dependentes
    await connection.query('DELETE FROM estoque_movimentacoes WHERE faturamento_id = ?', [faturamentoId]);
    await connection.query('DELETE FROM faturamento_itens WHERE faturamento_id = ?', [faturamentoId]);

    // 4. Exclui o faturamento principal
    const [result] = await connection.query('DELETE FROM faturamentos_diretos WHERE id = ?', [faturamentoId]);

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Registro não encontrado para exclusão' });
    }

    await connection.commit();
    return res.json({ success: true, message: 'Faturamento e vínculos excluídos com sucesso!' });

  } catch (error) {
    await connection.rollback();
    console.error('Erro ao deletar faturamento:', error);
    return res.status(500).json({ error: 'Erro ao excluir faturamento', detalhe: error.message });
  } finally {
    connection.release();
  }
});

// GET: Listar todas as bases com suas obras associadas
router.get('/bases', async (req, res) => {
  try {
    const [bases] = await db.query('SELECT * FROM bases ORDER BY nome ASC');
    
    const [vinculos] = await db.query(`
      SELECT bo.base_id, bo.obra_id, o.nome_obra 
      FROM base_obras bo
      JOIN obras o ON o.id = bo.obra_id
    `);

    const resultado = bases.map(b => ({
      ...b,
      obras_ids: vinculos.filter(v => v.base_id === b.id).map(v => v.obra_id),
      obras_nomes: vinculos.filter(v => v.base_id === b.id).map(v => v.nome_obra)
    }));

    res.json(resultado);
  } catch (error) {
    console.error("Erro ao buscar bases:", error);
    res.status(500).json({ error: "Erro ao buscar bases" });
  }
});

// POST: Criar nova Base e vincular com as Obras selecionadas
router.post('/bases', async (req, res) => {
  const { nome, endereco, obras_ids } = req.body;
  if (!nome) return res.status(400).json({ error: "O nome da base é obrigatório." });

  try {
    const [resBase] = await db.query(
      'INSERT INTO bases (nome, endereco) VALUES (?, ?)',
      [nome, endereco || '']
    ); // 'F' removido daqui

    const baseId = resBase.insertId;

    if (Array.isArray(obras_ids) && obras_ids.length > 0) {
      const valores = obras_ids.map(obraId => [baseId, obraId]);
      await db.query('INSERT INTO base_obras (base_id, obra_id) VALUES ?', [valores]);
    }

    res.status(201).json({ message: "Base criada com sucesso!", id: baseId });
  } catch (error) {
    console.error("Erro ao criar base:", error);
    res.status(500).json({ error: "Erro ao cadastrar base" });
  }
});

// PUT: Atualizar Base e recriar vínculos das Obras
router.put('/bases/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, endereco, obras_ids } = req.body;

  try {
    await db.query('UPDATE bases SET nome = ?, endereco = ? WHERE id = ?', [nome, endereco || '', id]);

    await db.query('DELETE FROM base_obras WHERE base_id = ?', [id]);

    if (Array.isArray(obras_ids) && obras_ids.length > 0) {
      const valores = obras_ids.map(obraId => [id, obraId]);
      await db.query('INSERT INTO base_obras (base_id, obra_id) VALUES ?', [valores]);
    }

    res.json({ message: "Base atualizada com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar base:", error);
    res.status(500).json({ error: "Erro ao atualizar base" });
  }
});

// DELETE: Remover Base
router.delete('/bases/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM bases WHERE id = ?', [id]);
    res.json({ message: "Base excluída com sucesso!" });
  } catch (error) {
    console.error("Erro ao excluir base:", error);
    res.status(500).json({ error: "Erro ao excluir base" });
  }
});

// ========================================================
// ROTA DE GESTORES (Ajustada para incluir MASTER e tratar vazios)
// ========================================================
router.get('/gestores', async (req, res) => {
  try {
    const [gestores] = await db.query(`
      SELECT id, nome, usuario, cargo 
      FROM usuarios_sistema 
      WHERE cargo IS NOT NULL 
        AND (
          LOWER(cargo) LIKE '%gestor%' 
          OR LOWER(cargo) LIKE '%gerente%'
          OR LOWER(cargo) LIKE '%admin%'
          OR LOWER(cargo) LIKE '%master%'
        )
      ORDER BY nome ASC
    `);

    if (gestores.length === 0) {
      const [todosUsuarios] = await db.query(`SELECT id, nome, usuario, cargo FROM usuarios_sistema ORDER BY nome ASC`);
      return res.json(todosUsuarios);
    }

    res.json(gestores);
  } catch (error) {
    console.error("Erro ao buscar gestores:", error);
    res.status(500).json({ error: "Erro ao buscar gestores." });
  }
});

// ========================================================
// GET: LISTAR MOVIMENTAÇÕES COM FILTRO DE STATUS
// ========================================================
router.get('/master/movimentacoes', async (req, res) => {
  try {
    const { status } = req.query;

    let sql = `
      SELECT 
        em.*,
        m.descricao AS material_nome,
        m.unidade_medida,
        u_envia.nome AS quem_envia_nome,
        u_pede.nome AS quem_pede_nome,
        u_reg.nome AS usuario_nome
      FROM estoque_movimentacoes em
      LEFT JOIN materiais m ON em.material_id = m.id
      LEFT JOIN usuarios_sistema u_envia ON em.quem_envia_id = u_envia.id
      LEFT JOIN usuarios_sistema u_pede ON em.quem_pede_id = u_pede.id
      LEFT JOIN usuarios_sistema u_reg ON em.id_usuario = u_reg.id
      WHERE 1=1
    `;
    
    const params = [];

    // Filtra pelo status caso seja fornecido (ex: ?status=PENDENTE ou ?status=CONCLUIDO)
    if (status && status.trim() !== '') {
      sql += ` AND em.status = ?`;
      params.push(status.trim().toUpperCase());
    }

    sql += ` ORDER BY em.id DESC`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar movimentações:", err);
    res.status(500).json({ error: "Erro ao buscar histórico de movimentações." });
  }
});

// ========================================================
// POST: CRIAR MOVIMENTAÇÃO (COM STATUS PENDENTE)
// ========================================================
router.post('/master/movimentacoes', async (req, res) => {
  const { 
    tipo_movimentacao, 
    origem_tipo, 
    origem_id, 
    destino_tipo, 
    destino_id, 
    material_id, 
    quantidade, 
    faturamento_id, 
    rdo_id,
    data_solicitada,
    id_usuario, 
    quem_envia_id,
    quem_pede_id,
    observacao 
  } = req.body;

  if (!material_id || !quantidade || !destino_id) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes." });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO estoque_movimentacoes 
       (tipo_movimentacao, origem_tipo, origem_id, destino_tipo, destino_id, material_id, quantidade, faturamento_id, rdo_id, data_movimentacao, data_solicitada, status, id_usuario, quem_envia_id, quem_pede_id, observacao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 'CONCLUIDO', ?, ?, ?, ?)`,
      [
        tipo_movimentacao || 'TRANSFERENCIA_SAIDA',
        origem_tipo || 'BASE',
        (origem_id && String(origem_id).trim() !== '') ? parseInt(origem_id) : 0,
        destino_tipo || 'OBRA',
        parseInt(destino_id),
        parseInt(material_id),
        parseFloat(quantidade),
        faturamento_id ? parseInt(faturamento_id) : null,
        rdo_id ? parseInt(rdo_id) : null,
        data_solicitada || null,
        id_usuario ? parseInt(id_usuario) : 1,
        (quem_envia_id && String(quem_envia_id).trim() !== '') ? parseInt(quem_envia_id) : null,
        (quem_pede_id && String(quem_pede_id).trim() !== '') ? parseInt(quem_pede_id) : null,
        observacao ? observacao.trim() : ''
      ]
    );

    res.status(201).json({ message: "Movimentação registrada com sucesso!", id: result.insertId });
  } catch (error) {
    console.error("Erro ao criar movimentação:", error);
    res.status(500).json({ error: "Erro ao registrar movimentação.", detalhe: error.message });
  }
});

// ========================================================
// PUT: EDITAR MOVIMENTAÇÃO
// ========================================================
// Localize a rota UPDATE na linha 1249 do masterRoutes.js
router.put('/master/movimentacoes/:id', async (req, res) => {
  const { id } = req.params;
  let { data_solicitada } = req.body;

  // Trata a data no backend antes de montar a SQL Query
  if (data_solicitada && typeof data_solicitada === 'string') {
    data_solicitada = data_solicitada.split('T')[0];
  } else {
    data_solicitada = null;
  }

  try {
    const sql = `
      UPDATE estoque_movimentacoes 
      SET quem_envia_id = ?, material_id = ?, quantidade = ?, tipo_movimentacao = ?, 
          quem_pede_id = ?, origem_tipo = ?, origem_id = ?, destino_tipo = ?, 
          destino_id = ?, data_solicitada = ?, observacao = ?, status = ?
      WHERE id = ?
    `;

    await db.query(sql, [
      req.body.quem_envia_id || null,
      req.body.material_id,
      req.body.quantidade,
      req.body.tipo_movimentacao,
      req.body.quem_pede_id || null,
      req.body.origem_tipo,
      req.body.origem_id || null,
      req.body.destino_tipo,
      req.body.destino_id,
      data_solicitada, // <--- Passa o valor 'YYYY-MM-DD' tratado
      req.body.observacao || '',
      req.body.status || 'CONCLUIDO',
      id
    ]);

    res.json({ message: "Movimentação atualizada com sucesso!" });
  } catch (err) {
    console.error("Erro no MySQL:", err);
    res.status(500).json({ error: "Erro ao atualizar registro no banco." });
  }
});
// ========================================================
// DELETE: EXCLUIR MOVIMENTAÇÃO
// ========================================================
router.delete('/master/movimentacoes/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [movs] = await db.query('SELECT * FROM estoque_movimentacoes WHERE id = ?', [id]);
    if (movs.length === 0) return res.status(404).json({ error: "Movimentação não encontrada." });

    await db.query('DELETE FROM estoque_movimentacoes WHERE id = ?', [id]);

    res.json({ message: "Movimentação excluída com sucesso!" });
  } catch (error) {
    console.error("Erro ao excluir movimentação:", error);
    res.status(500).json({ error: "Erro ao excluir movimentação." });
  }
});

// ========================================================
// PUT: CONFIRMAR RECEBIMENTO
// ========================================================
router.put('/master/movimentacoes/:id/confirmar', async (req, res) => {
  const { id } = req.params;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [movs] = await connection.query('SELECT * FROM estoque_movimentacoes WHERE id = ?', [id]);
    if (!movs || movs.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Movimentação não encontrada." });
    }

    const mov = movs[0];
    if (mov.status === 'CONCLUIDO' || mov.status === 'CONFIRMADO') {
      await connection.rollback();
      return res.status(400).json({ error: "Movimentação já foi concluída anteriormente." });
    }

    // 1. Atualiza status da movimentação para CONCLUIDO
    await connection.query('UPDATE estoque_movimentacoes SET status = "CONCLUIDO" WHERE id = ?', [id]);

    // 2. Incrementa o saldo do estoque no destino
    if (mov.destino_tipo === 'OBRA' && mov.destino_id) {
      const sqlAtualizaSaldo = `
        INSERT INTO estoque_saldos (local_tipo, local_id, material_id, quantidade)
        VALUES ('OBRA', ?, ?, ?)
        ON DUPLICATE KEY UPDATE quantidade = quantidade + VALUES(quantidade)
      `;
      await connection.query(sqlAtualizaSaldo, [mov.destino_id, mov.material_id, mov.quantidade]);
    }

    await connection.commit();
    res.json({ message: "Movimentação concluída e saldo atualizado com sucesso!" });
  } catch (error) {
    await connection.rollback();
    console.error("Erro ao concluir movimentação:", error);
    res.status(500).json({ error: "Erro ao concluir movimentação.", detalhe: error.message });
  } finally {
    connection.release();
  }
});
// GET: Locais (Bases e Obras)
router.get('/master/locais', async (req, res) => {
  try {
    const [bases] = await db.query('SELECT id, nome FROM bases ORDER BY nome ASC');
    
    // Corrigido: aspas simples em 'ATIVA'
    const [obras] = await db.query("SELECT id, nome_obra AS nome, codigo_obra FROM obras WHERE status = 'ATIVA' ORDER BY nome_obra ASC");
    
    const [baseObras] = await db.query('SELECT base_id, obra_id FROM base_obras');

    res.json({ bases, obras, baseObras });
  } catch (error) {
    console.error("Erro ao buscar locais:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});



// GET: Saldo de Estoque Consolidado por Local (Apenas Movimentações CONCLUÍDAS)
router.get('/master/estoque/saldos', async (req, res) => {
  try {
    const { data_inicio, data_fim, tipo_local, id_local } = req.query;

    const queryParams = [
      tipo_local || null, id_local || null,
      tipo_local || null, id_local || null,
      tipo_local || null,
      data_inicio || null, data_inicio || null,
      data_fim || null, data_fim || null,
      tipo_local || null, id_local || null,
      tipo_local || null, id_local || null,
      tipo_local || null
    ];

    const query = `
      SELECT 
        m.id AS material_id,
        m.codigo,
        m.descricao AS nome,
        m.unidade_medida,
        m.tipo,
        COALESCE(SUM(
          CASE 
            WHEN mov.destino_tipo = ? AND mov.destino_id = ? THEN mov.quantidade
            WHEN mov.origem_tipo = ? AND mov.origem_id = ? THEN -mov.quantidade
            WHEN ? IS NULL THEN 
              CASE 
                WHEN mov.tipo_movimentacao IN ('ENTRADA_FORNECEDOR', 'TRANSFERENCIA_ENTRADA') THEN mov.quantidade 
                WHEN mov.tipo_movimentacao IN ('TRANSFERENCIA_SAIDA', 'CONSUMO_RDO') THEN -mov.quantidade 
                ELSE 0 
              END
            ELSE 0 
          END
        ), 0) AS saldo_atual,
        COALESCE(SUM(
          CASE 
            WHEN (? IS NULL OR mov.data_movimentacao >= ?) 
             AND (? IS NULL OR mov.data_movimentacao <= ?) THEN
              CASE 
                WHEN mov.destino_tipo = ? AND mov.destino_id = ? THEN mov.quantidade
                WHEN mov.origem_tipo = ? AND mov.origem_id = ? THEN -mov.quantidade
                WHEN ? IS NULL THEN 
                  CASE 
                    WHEN mov.tipo_movimentacao IN ('ENTRADA_FORNECEDOR', 'TRANSFERENCIA_ENTRADA') THEN mov.quantidade 
                    WHEN mov.tipo_movimentacao IN ('TRANSFERENCIA_SAIDA', 'CONSUMO_RDO') THEN -mov.quantidade 
                    ELSE 0 
                  END
                ELSE 0 
              END
            ELSE 0 
          END
        ), 0) AS total_movimentado
      FROM materiais m
      LEFT JOIN estoque_movimentacoes mov 
        ON m.id = mov.material_id 
       AND UPPER(mov.status) = 'CONCLUIDO'
      GROUP BY m.id, m.codigo, m.descricao, m.unidade_medida, m.tipo
      ORDER BY m.descricao ASC
    `;

    const [rows] = await db.query(query, queryParams);
    res.json(rows);
  } catch (error) {
    console.error("Erro na rota /master/estoque/saldos:", error);
    res.status(500).json({ error: "Erro interno do servidor", details: error.message });
  }
});

// GET: Relatório Avançado de Movimentações
router.get('/master/relatorios/movimentacoes', async (req, res) => {
  const { data_inicio, data_fim, tipo_movimentacao, material_id, origem_tipo, destino_tipo } = req.query;

  try {
    let query = `
      SELECT 
        e.id,
        e.tipo_movimentacao,
        e.origem_tipo,
        e.origem_id,
        e.destino_tipo,
        e.destino_id,
        e.quantidade,
        e.status,
        e.data_movimentacao,
        e.observacao,
        m.descricao AS material_nome,
        m.unidade_medida,
        CASE 
          WHEN e.origem_tipo = 'BASE' THEN b_origem.nome
          WHEN e.origem_tipo = 'OBRA' THEN o_origem.nome_obra
          WHEN e.origem_tipo = 'FORNECEDOR' THEN 'Fornecedor'
        END AS origem_nome,
        CASE 
          WHEN e.destino_tipo = 'BASE' THEN b_destino.nome
          WHEN e.destino_tipo = 'OBRA' THEN o_destino.nome_obra
        END AS destino_nome
      FROM estoque_movimentacoes e
      INNER JOIN materiais m ON m.id = e.material_id
      LEFT JOIN bases b_origem ON e.origem_tipo = 'BASE' AND b_origem.id = e.origem_id
      LEFT JOIN obras o_origem ON e.origem_tipo = 'OBRA' AND o_origem.id = e.origem_id
      LEFT JOIN bases b_destino ON e.destino_tipo = 'BASE' AND b_destino.id = e.destino_id
      LEFT JOIN obras o_destino ON e.destino_tipo = 'OBRA' AND o_destino.id = e.destino_id
      WHERE 1=1
    `;

    const params = [];

    if (data_inicio) {
      query += ` AND e.data_movimentacao >= ?`;
      params.push(`${data_inicio} 00:00:00`);
    }
    if (data_fim) {
      query += ` AND e.data_movimentacao <= ?`;
      params.push(`${data_fim} 23:59:59`);
    }
    if (tipo_movimentacao) {
      query += ` AND e.tipo_movimentacao = ?`;
      params.push(tipo_movimentacao);
    }
    if (material_id) {
      query += ` AND e.material_id = ?`;
      params.push(material_id);
    }
    if (origem_tipo) {
      query += ` AND e.origem_tipo = ?`;
      params.push(origem_tipo);
    }
    if (destino_tipo) {
      query += ` AND e.destino_tipo = ?`;
      params.push(destino_tipo);
    }

    query += ` ORDER BY e.data_movimentacao DESC, e.id DESC`;

    const [movimentacoes] = await db.query(query, params);
    res.json(movimentacoes);
  } catch (error) {
    console.error("Erro ao gerar relatório de movimentações:", error);
    res.status(500).json({ error: "Erro ao carregar relatório." });
  }
});

// ========================================================
// 16. ROTAS DE RELATÓRIO DE COMPRAS
// ========================================================

function getOrderBySql(ordenacao, tipoRelatorio) {
  switch (ordenacao) {
    case 'maior_gasto':
      return 'valor_total_gasto DESC';
    case 'menor_gasto':
      return 'valor_total_gasto ASC';
    case 'maior_qtd':
      return tipoRelatorio === 'material' ? 'quantidade_total_comprada DESC' : 'total_pedidos DESC';
    case 'menor_qtd':
      return tipoRelatorio === 'material' ? 'quantidade_total_comprada ASC' : 'total_pedidos ASC';
    case 'ultima_compra':
      return 'ultima_compra DESC';
    case 'primeira_compra':
      return 'primeira_compra ASC';
    default:
      return 'valor_total_gasto DESC';
  }
}

// 16-A. GET: Relatório por Produto / Material
router.get('/relatorios/compras-por-material', async (req, res) => {
  const { data_inicio, data_fim, fornecedor_id, obra_id, ordenacao } = req.query;

  try {
    let sql = `
      SELECT 
        m.id AS material_id,
        m.descricao AS material_nome,
        m.unidade_medida,
        m.tipo AS material_tipo,
        COUNT(DISTINCT fd.id) AS total_pedidos,
        SUM(fi.quantidade) AS quantidade_total_comprada,
        SUM(fi.quantidade * fi.valor_unitario) AS valor_total_gasto,
        AVG(fi.valor_unitario) AS preco_medio_unitario,
        MIN(fi.valor_unitario) AS menor_preco_unitario,
        MAX(fi.valor_unitario) AS maior_preco_unitario,
        MAX(fd.data_solicitacao) AS ultima_compra,
        MIN(fd.data_solicitacao) AS primeira_compra
      FROM faturamento_itens fi
      INNER JOIN faturamentos_diretos fd ON fi.faturamento_id = fd.id
      INNER JOIN materiais m ON fi.material_id = m.id
      WHERE fd.status != 'Cancelado'
    `;

    const params = [];

    if (data_inicio) {
      sql += ` AND fd.data_solicitacao >= ?`;
      params.push(data_inicio);
    }
    if (data_fim) {
      sql += ` AND fd.data_solicitacao <= ?`;
      params.push(data_fim);
    }
    if (fornecedor_id) {
      sql += ` AND fd.fornecedor_id = ?`;
      params.push(fornecedor_id);
    }
    if (obra_id) {
      sql += ` AND fd.obra_id = ?`;
      params.push(obra_id);
    }

    sql += ` GROUP BY m.id, m.descricao, m.unidade_medida, m.tipo`;
    sql += ` ORDER BY ${getOrderBySql(ordenacao, 'material')}`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error("Erro no relatório por material:", error);
    res.status(500).json({ error: "Erro ao gerar relatório por material." });
  }
});

// 16-B. GET: Relatório por Fornecedor
router.get('/relatorios/compras-por-fornecedor', async (req, res) => {
  const { data_inicio, data_fim, material_id, obra_id, ordenacao } = req.query;

  try {
    let sql = `
      SELECT 
        f.id AS fornecedor_id,
        f.nome_fantasia,
        f.razao_social,
        f.cnpj,
        COUNT(DISTINCT fd.id) AS total_pedidos,
        SUM(fi.quantidade * fi.valor_unitario) AS valor_total_gasto,
        COUNT(DISTINCT fi.material_id) AS diversidade_produtos,
        MAX(fd.data_solicitacao) AS ultima_compra,
        MIN(fd.data_solicitacao) AS primeira_compra
      FROM faturamentos_diretos fd
      INNER JOIN fornecedores f ON fd.fornecedor_id = f.id
      INNER JOIN faturamento_itens fi ON fi.faturamento_id = fd.id
      WHERE fd.status != 'Cancelado'
    `;

    const params = [];

    if (data_inicio) {
      sql += ` AND fd.data_solicitacao >= ?`;
      params.push(data_inicio);
    }
    if (data_fim) {
      sql += ` AND fd.data_solicitacao <= ?`;
      params.push(data_fim);
    }
    if (material_id) {
      sql += ` AND fi.material_id = ?`;
      params.push(material_id);
    }
    if (obra_id) {
      sql += ` AND fd.obra_id = ?`;
      params.push(obra_id);
    }

    sql += ` GROUP BY f.id, f.nome_fantasia, f.razao_social, f.cnpj`;
    sql += ` ORDER BY ${getOrderBySql(ordenacao, 'fornecedor')}`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error("Erro no relatório por fornecedor:", error);
    res.status(500).json({ error: "Erro ao gerar relatório por fornecedor." });
  }
});

// 16-C. GET: Relatório por Obra
router.get('/relatorios/compras-por-obra', async (req, res) => {
  const { data_inicio, data_fim, fornecedor_id, material_id, ordenacao } = req.query;

  try {
    let sql = `
      SELECT 
        o.id AS obra_id,
        o.nome_obra AS obra_nome,
        COUNT(DISTINCT fd.id) AS total_pedidos,
        SUM(fi.quantidade * fi.valor_unitario) AS valor_total_gasto,
        COUNT(DISTINCT fi.material_id) AS diversidade_produtos,
        MAX(fd.data_solicitacao) AS ultima_compra,
        MIN(fd.data_solicitacao) AS primeira_compra
      FROM faturamentos_diretos fd
      INNER JOIN obras o ON fd.obra_id = o.id
      INNER JOIN faturamento_itens fi ON fi.faturamento_id = fd.id
      WHERE fd.status != 'Cancelado'
    `;

    const params = [];

    if (data_inicio) {
      sql += ` AND fd.data_solicitacao >= ?`;
      params.push(data_inicio);
    }
    if (data_fim) {
      sql += ` AND fd.data_solicitacao <= ?`;
      params.push(data_fim);
    }
    if (fornecedor_id) {
      sql += ` AND fd.fornecedor_id = ?`;
      params.push(fornecedor_id);
    }
    if (material_id) {
      sql += ` AND fi.material_id = ?`;
      params.push(material_id);
    }

    sql += ` GROUP BY o.id, o.nome_obra`;
    sql += ` ORDER BY ${getOrderBySql(ordenacao, 'obra')}`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error("Erro no relatório por obra:", error);
    res.status(500).json({ error: "Erro ao gerar relatório por obra." });
  }
});

export default router;