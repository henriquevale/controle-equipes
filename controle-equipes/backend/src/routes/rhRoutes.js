import express from 'express';
const router = express.Router();

// Caminho para a estrutura do banco de dados
import db from '../../db.js';

// ========================================================
// FUNÇÃO UTILITÁRIA
// ========================================================
// Trata datas vindas do frontend removendo o formato ISO (T00:00:00...)
const formatarData = (d) => {
  if (d === '' || d === undefined || d === null) return null;
  if (typeof d === 'string' && d.includes('T')) {
    return d.split('T')[0];
  }
  return d;
};


// ========================================================
// A. ROTAS DE FUNCIONÁRIOS (CADASTRO PRINCIPAL DO RH)
// ========================================================

// 1. GET: Listar todos os funcionários ativos (Tabela Geral RH)
// GET: Listar todos os funcionários ativos com o Gestor Atual vinculado
router.get('/rh/funcionarios-geral', async (req, res) => {
  try {
    const sql = `
      SELECT 
        f.id, f.matricula, f.nome, f.cargo, f.ativo, f.cpf, f.telefone, 
        f.tam_calca, f.tam_camisa, f.tam_calcado, f.atualizado_em,
        f.data_admissao, f.data_postagem_aso_pasta, f.data_documentos_rh_completos,
        f.observacoes,
        gf.id_usuario AS id_usuario_gestor,
        u.nome AS nome_gestor
      FROM funcionarios f
      LEFT JOIN gestor_funcionarios gf ON f.id = gf.id_funcionario AND gf.data_fim IS NULL
      LEFT JOIN usuarios_sistema u ON gf.id_usuario = u.id
      WHERE f.ativo = 'ATIVO' OR f.ativo = 'ATIVO '
      ORDER BY f.nome ASC
    `;
    const [rows] = await db.execute(sql);
    return res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar funcionários:", err);
    return res.status(500).json({ error: "Erro ao carregar lista de RH." });
  }
});
// 2. POST: Cadastrar novo funcionário (e inicializar esteira de integração)
router.post('/rh/funcionarios', async (req, res) => {
  const { 
    nome, matricula, cargo, 
    cpf, telefone, tam_calca, tam_camisa, tam_calcado,
    id_usuario_gestor, id_usuario_cadastro,
    data_admissao, data_postagem_aso_pasta, data_documentos_rh_completos,
    observacoes 
  } = req.body;

  if (!nome || !matricula || !cargo) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes (nome, matricula ou cargo)." });
  }

  try {
    let idNovoFuncionario = null;

    const sqlFuncionario = `
      INSERT INTO funcionarios 
        (nome, matricula, cargo, ativo, cpf, telefone, tam_calca, tam_camisa, tam_calcado,
         data_admissao, data_postagem_aso_pasta, data_documentos_rh_completos, observacoes, atualizado_em)
      VALUES (?, ?, ?, 'INTEGRAÇÃO PENDENTE', ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    
    const calcadoFinal = (tam_calcado === '' || tam_calcado === undefined || tam_calcado === null) 
      ? null 
      : parseInt(tam_calcado, 10);

    const [resultadoFunc] = await db.execute(sqlFuncionario, [
      nome.trim(), 
      matricula.trim(), 
      cargo.trim(), 
      cpf && cpf.trim() !== '' ? cpf.trim() : null,
      telefone && telefone.trim() !== '' ? telefone.trim() : null,
      tam_calca && tam_calca.trim() !== '' ? tam_calca.trim() : null,
      tam_camisa && tam_camisa.trim() !== '' ? tam_camisa.trim() : null,
      calcadoFinal,
      formatarData(data_admissao),
      formatarData(data_postagem_aso_pasta),
      formatarData(data_documentos_rh_completos),
      observacoes && observacoes.trim() !== '' ? observacoes.trim() : null 
    ]);

    idNovoFuncionario = resultadoFunc.insertId;

    // Vincular Gestor (se informado) - Ajustado conforme a tabela gestor_funcionarios
    if (id_usuario_gestor) {
      const sqlVinculo = `
        INSERT INTO gestor_funcionarios 
          (id_usuario, id_funcionario, id_obra, data_inicio, id_usuario_alteracao) 
        VALUES (?, ?, 0, NOW(), ?)
      `;
      
      const usuarioAlteracao = (id_usuario_cadastro && id_usuario_cadastro !== '') 
        ? parseInt(id_usuario_cadastro, 10) 
        : parseInt(id_usuario_gestor, 10);

      await db.execute(sqlVinculo, [
        parseInt(id_usuario_gestor, 10),
        idNovoFuncionario,
        usuarioAlteracao
      ]);
    }

    // Inicializa a primeira linha na esteira de integração
    const sqlInicializarIntegracao = `
      INSERT INTO integracoes_funcionarios (id_funcionario, obs, criado_em) VALUES (?, ?, NOW())
    `;
    await db.execute(sqlInicializarIntegracao, [
      idNovoFuncionario,
      observacoes && observacoes.trim() !== '' ? observacoes.trim() : null
    ]);

    return res.status(201).json({ 
      success: true, 
      message: 'Funcionário cadastrado, vinculado e enviado para a esteira de integração!' 
    });

  } catch (error) {
    console.error("Erro ao cadastrar funcionário:", error);
    return res.status(500).json({ error: "Erro interno ao cadastrar funcionário." });
  }
});

// 3. PUT: Atualizar dados cadastrais do funcionário
router.put('/rh/funcionarios/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    nome, matricula, cargo, ativo, 
    cpf, telefone, tam_calca, tam_camisa, tam_calcado,
    data_admissao, data_postagem_aso_pasta, data_documentos_rh_completos,
    observacoes 
  } = req.body;

  if (!nome || !matricula || !cargo || !ativo) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes." });
  }

  try {
    const idFunc = parseInt(id, 10);

    const sql = `
      UPDATE funcionarios 
      SET 
        nome = ?, 
        matricula = ?, 
        cargo = ?, 
        ativo = ?, 
        cpf = ?, 
        telefone = ?, 
        tam_calca = ?, 
        tam_camisa = ?, 
        tam_calcado = ?,
        data_admissao = ?,
        data_postagem_aso_pasta = ?,
        data_documentos_rh_completos = ?,
        observacoes = ?,
        atualizado_em = NOW() 
      WHERE id = ?
    `;
    
    await db.execute(sql, [
      nome.trim(), 
      matricula.trim(), 
      cargo.trim(), 
      ativo, 
      cpf ? cpf.trim() : null,
      telefone ? telefone.trim() : null,
      tam_calca ? tam_calca.trim() : null,
      tam_camisa ? tam_camisa.trim() : null,
      tam_calcado ? tam_calcado.trim() : null,
      formatarData(data_admissao),
      formatarData(data_postagem_aso_pasta),
      formatarData(data_documentos_rh_completos),
      observacoes ? observacoes.trim() : null,
      idFunc
    ]);

    // CORREÇÃO: Força a criação de um novo ciclo na esteira sempre que o status mudar para INTEGRAÇÃO PENDENTE
    if (String(ativo).trim().toUpperCase() === 'INTEGRAÇÃO PENDENTE') {
      const sqlNovaIntegracao = `
        INSERT INTO integracoes_funcionarios (id_funcionario, obs, criado_em) 
        VALUES (?, ?, NOW())
      `;
      await db.execute(sqlNovaIntegracao, [
        idFunc, 
        observacoes ? observacoes.trim() : null
      ]);
    }
    
    return res.json({ success: true, message: "Dados do funcionário atualizados com sucesso!" });
  } catch (err) {
    console.error("Erro no banco ao atualizar funcionário:", err);
    return res.status(500).json({ error: "Erro ao atualizar dados do funcionário no banco." });
  }
});

// 4. DELETE: Excluir funcionário e seus vínculos do banco de dados
router.delete('/rh/funcionarios/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const idFunc = parseInt(id, 10);

    // Remove pendências e histórico da esteira
    await db.execute(`DELETE FROM integracoes_funcionarios WHERE id_funcionario = ?`, [idFunc]);
    
    // Remove vínculos com gestores
    await db.execute(`DELETE FROM gestor_funcionarios WHERE id_funcionario = ?`, [idFunc]);

    // Deleta o registro principal do funcionário
    const [result] = await db.execute(`DELETE FROM funcionarios WHERE id = ?`, [idFunc]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Funcionário não encontrado." });
    }

    return res.json({ success: true, message: "Funcionário e históricos removidos com sucesso!" });
  } catch (err) {
    console.error("Erro ao deletar funcionário:", err);

    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return res.status(400).json({
        error: "Não é possível excluir o funcionário pois há registros de diários ou presenças vinculados a ele. Recomenda-se alterar o status para INATIVO."
      });
    }

    return res.status(500).json({ error: "Erro interno ao deletar funcionário." });
  }
});


// ========================================================
// B. ROTAS DE INTEGRAÇÕES (ESTEIRA / HISTÓRICOS 1:N)
// ========================================================

// 1. GET: Listar histórico completo das integrações
router.get('/rh/integracoes-pendentes', async (req, res) => {
  try {
    const sql = `
      SELECT 
        i.id AS id_integracao,
        i.id_funcionario,
        f.nome, 
        f.matricula, 
        f.cargo, 
        f.ativo,
        i.data_documentos_sst, 
        i.data_enviados, 
        i.data_recebidos,
        i.data_postado_bex, 
        i.data_analise, 
        i.data_integracao_agendada, 
        i.data_integracao,
        i.obs,
        i.criado_em,
        i.atualizado_em
      FROM integracoes_funcionarios i
      INNER JOIN funcionarios f ON i.id_funcionario = f.id
      ORDER BY i.id DESC
    `;
    
    const [rows] = await db.execute(sql);
    return res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar integrações para histórico:", err);
    return res.status(500).json({ error: "Erro ao carregar a esteira de integração." });
  }
});

// 2. GET: Buscar integração específica de um funcionário
router.get('/rh/funcionarios/:id/integracao', async (req, res) => {
  const { id } = req.params;

  try {
    const sql = `
      SELECT 
        i.id AS id_integracao,
        i.id_funcionario,
        f.nome, 
        f.matricula, 
        f.cargo, 
        f.ativo,
        i.data_documentos_sst, 
        i.data_enviados, 
        i.data_recebidos,
        i.data_postado_bex, 
        i.data_analise, 
        i.data_integracao_agendada, 
        i.data_integracao,
        i.obs,
        i.criado_em,
        i.atualizado_em
      FROM integracoes_funcionarios i
      INNER JOIN funcionarios f ON i.id_funcionario = f.id
      WHERE i.id_funcionario = ?
      ORDER BY i.id DESC
    `;

    const [rows] = await db.execute(sql, [parseInt(id, 10)]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Registro de integração não encontrado." });
    }

    return res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar integração do funcionário:", err);
    return res.status(500).json({ error: "Erro interno ao buscar integração." });
  }
});

// 3. PUT: Atualizar linha da esteira de integração
router.put('/rh/funcionarios/:id/integracao', async (req, res) => {
  const id_funcionario = req.params.id;
  const {
    id_integracao,
    data_documentos_sst,
    data_enviados,
    data_recebidos,
    data_postado_bex,
    data_analise,
    data_integracao_agendada,
    data_integracao,
    obs
  } = req.body;

  try {
    const idFunc = parseInt(id_funcionario, 10);

    // Se tiver id_integracao, altera a linha específica (1:N)
    if (id_integracao) {
      const sqlUpdate = `
        UPDATE integracoes_funcionarios SET
          data_documentos_sst = ?,
          data_enviados = ?,
          data_recebidos = ?,
          data_postado_bex = ?,
          data_analise = ?,
          data_integracao_agendada = ?,
          data_integracao = ?,
          obs = ?,
          atualizado_em = NOW()
        WHERE id = ?
      `;

      await db.execute(sqlUpdate, [
        formatarData(data_documentos_sst),
        formatarData(data_enviados),
        formatarData(data_recebidos),
        formatarData(data_postado_bex),
        formatarData(data_analise),
        formatarData(data_integracao_agendada),
        formatarData(data_integracao),
        obs && obs.trim() !== '' ? obs.trim() : null,
        parseInt(id_integracao, 10)
      ]);
    } else {
      // Caso não passe id_integracao, atualiza o registro mais recente do funcionário
      const sqlUpdateGenerico = `
        UPDATE integracoes_funcionarios SET
          data_documentos_sst = ?,
          data_enviados = ?,
          data_recebidos = ?,
          data_postado_bex = ?,
          data_analise = ?,
          data_integracao_agendada = ?,
          data_integracao = ?,
          obs = ?,
          atualizado_em = NOW()
        WHERE id_funcionario = ?
        ORDER BY id DESC LIMIT 1
      `;

      await db.execute(sqlUpdateGenerico, [
        formatarData(data_documentos_sst),
        formatarData(data_enviados),
        formatarData(data_recebidos),
        formatarData(data_postado_bex),
        formatarData(data_analise),
        formatarData(data_integracao_agendada),
        formatarData(data_integracao),
        obs && obs.trim() !== '' ? obs.trim() : null,
        idFunc
      ]);
    }

    // Se concluiu a integração (data preenchida), define status como ATIVO
    if (data_integracao && data_integracao.trim() !== '') {
      await db.execute(
        `UPDATE funcionarios SET ativo = 'ATIVO' WHERE id = ?`, 
        [idFunc]
      );
      
      return res.json({ 
        success: true, 
        message: 'Integração concluída! Funcionário atualizado para ATIVO.' 
      });
    }

    return res.json({ success: true, message: 'Dados da esteira de integração salvos com sucesso!' });

  } catch (error) {
    console.error("Erro ao atualizar integração:", error);
    return res.status(500).json({ error: "Erro interno ao atualizar dados de integração." });
  }
});

// 4. DELETE: Excluir linha da esteira de integração (Aceita ID da integração ou ID do funcionário)
router.delete(['/rh/integracao/:idIntegracao', '/rh/integracoes/:idIntegracao'], async (req, res) => {
  const { idIntegracao } = req.params;

  try {
    const targetId = parseInt(idIntegracao, 10);

    // Tenta deletar diretamente pelo ID da linha da esteira
    const [result1] = await db.execute(`DELETE FROM integracoes_funcionarios WHERE id = ?`, [targetId]);
    if (result1.affectedRows > 0) {
      return res.json({ success: true, message: "Linha da esteira removida com sucesso!" });
    }

    // Caso o frontend envie o ID do funcionário por engano
    const [result2] = await db.execute(`DELETE FROM integracoes_funcionarios WHERE id_funcionario = ?`, [targetId]);
    if (result2.affectedRows > 0) {
      return res.json({ success: true, message: "Registro de integração removido com sucesso!" });
    }

    return res.status(404).json({ error: "Registro de integração não encontrado." });
  } catch (err) {
    console.error("Erro ao deletar linha da esteira:", err);
    return res.status(500).json({ error: "Erro interno ao remover integração." });
  }
});


// ========================================================
// C. ROTAS AUXILIARES (GESTORES)
// ========================================================

router.get('/gestores', async (req, res) => {
  try {
    const sql = `
      SELECT id AS id_usuario, nome AS nome_gestor
      FROM usuarios_sistema
      WHERE cargo = 'GESTOR'
      ORDER BY nome ASC
    `;
    const [rows] = await db.execute(sql);
    return res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar gestores:", err);
    return res.status(500).json({ error: "Erro ao carregar lista de gestores." });
  }
});

router.get('/rh/gestores-disponiveis', async (req, res) => {
  try {
    const sql = `
      SELECT id AS id_usuario, nome AS nome_gestor
      FROM usuarios_sistema
      WHERE cargo = 'GESTOR'
      ORDER BY nome ASC
    `;
    const [rows] = await db.execute(sql);
    return res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar gestores:", err);
    return res.status(500).json({ error: "Erro ao carregar lista de gestores." });
  }
});


// ========================================================
// D. ROTAS DE GESTÃO DE VEÍCULOS E FROTA
// ========================================================

// Listar veículos
router.get('/veiculos', async (req, res) => {
  const sql = `
    SELECT id, placa, marca, modelo, ano, tipo, titularidade, descricao, status, id_gestor, id_funcionario 
    FROM veiculos 
    ORDER BY id DESC
  `;
  try {
    const [rows] = await db.query(sql);
    return res.json(rows);
  } catch (err) {
    console.error('Erro ao listar veículos:', err.message);
    return res.status(500).json({ error: `Erro no banco de dados: ${err.message}` });
  }
});

// Cadastrar veículo
router.post('/veiculos', async (req, res) => {
  const { placa, marca, modelo, ano, tipo, titularidade, descricao, status, id_gestor } = req.body;

  if (!placa || !marca || !modelo || !ano || !tipo || !titularidade) {
    return res.status(400).json({ error: 'Os campos Placa, Marca, Modelo, Ano, Tipo e Titularidade são obrigatórios.' });
  }

  const placaFormatada = String(placa).trim().toUpperCase();
  const marcaFormatada = String(marca).trim();
  const modeloFormatada = String(modelo).trim();
  const anoFormatado = parseInt(ano, 10);
  const tipoFormatado = String(tipo).trim();
  const titularidadeFormatada = String(titularidade).trim().toUpperCase(); 
  const descricaoFormatada = descricao && String(descricao).trim() !== '' ? String(descricao).trim() : null;
  const gestorId = id_gestor && String(id_gestor).trim() !== '' ? parseInt(id_gestor, 10) : null;

  let statusFinal = 'DISPONÍVEL';
  if (status === 'EM MANUTENÇÃO') {
    statusFinal = 'EM MANUTENÇÃO';
  } else if (gestorId) {
    statusFinal = 'EM USO';
  }

  const sql = `
    INSERT INTO veiculos (placa, marca, modelo, ano, tipo, titularidade, descricao, status, id_gestor, id_funcionario) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `;

  try {
    const parametros = [
      placaFormatada,
      marcaFormatada,
      modeloFormatada,
      isNaN(anoFormatado) ? null : anoFormatado,
      tipoFormatado,
      titularidadeFormatada, 
      descricaoFormatada, 
      statusFinal,
      isNaN(gestorId) ? null : gestorId 
    ];

    const [result] = await db.query(sql, parametros);
    return res.status(201).json({ message: 'Veículo registrado com sucesso na frota!', id: result.insertId });
  } catch (err) {
    console.error('Erro ao inserir veículo:', err.message);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Já existe um veículo cadastrado com esta placa!' });
    }
    return res.status(500).json({ error: `Erro no banco de dados: ${err.message}` });
  }
});

// Atualizar veículo
router.put('/veiculos/:id', async (req, res) => {
  const { id } = req.params;
  const { placa, marca, modelo, ano, tipo, titularidade, descricao, status, id_gestor } = req.body;

  if (!placa || !marca || !modelo || !ano || !tipo || !titularidade) {
    return res.status(400).json({ error: 'Os campos Placa, Marca, Modelo, Ano, Tipo e Titularidade são obrigatórios.' });
  }

  const gestorId = id_gestor && String(id_gestor).trim() !== '' ? parseInt(id_gestor, 10) : null;

  let statusFinal = 'DISPONÍVEL';
  if (status === 'EM MANUTENÇÃO') {
    statusFinal = 'EM MANUTENÇÃO';
  } else if (gestorId) {
    statusFinal = 'EM USO';
  }

  const sql = `
    UPDATE veiculos 
    SET placa = ?, marca = ?, modelo = ?, ano = ?, tipo = ?, titularidade = ?, descricao = ?, status = ?, id_gestor = ?
    WHERE id = ?
  `;

  try {
    const parametros = [
      String(placa).trim().toUpperCase(),
      String(marca).trim(),
      String(modelo).trim(),
      parseInt(ano, 10),
      String(tipo).trim(),
      String(titularidade).trim().toUpperCase(),
      descricao && String(descricao).trim() !== '' ? String(descricao).trim() : null,
      statusFinal,
      isNaN(gestorId) ? null : gestorId,
      id
    ];

    const [result] = await db.query(sql, parametros);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Veículo não encontrado para atualização.' });
    }

    return res.json({ message: 'Veículo atualizado com sucesso!' });
  } catch (err) {
    console.error('Erro ao atualizar veículo:', err.message);
    return res.status(500).json({ error: `Erro no banco de dados: ${err.message}` });
  }
});

// Remover veículo
router.delete('/veiculos/:id', async (req, res) => {
  const { id } = req.params;
  const sql = `DELETE FROM veiculos WHERE id = ?`;

  try {
    const [result] = await db.query(sql, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Veículo não encontrado para exclusão.' });
    }

    return res.json({ message: 'Veículo removido com sucesso da frota!' });
  } catch (err) {
    console.error('Erro ao deletar veículo:', err.message);
    return res.status(500).json({ error: `Erro no banco de dados: ${err.message}` });
  }
});

export default router;