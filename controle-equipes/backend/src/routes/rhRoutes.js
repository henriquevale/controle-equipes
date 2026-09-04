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
// Exemplo de adequação da rota GET em routes.js
router.get('/rh/funcionarios-geral', async (req, res) => {
  try {
    const sql = `
      SELECT 
        f.id, 
        f.matricula, 
        f.nome, 
        f.cargo, 
        f.ativo, 
        COALESCE(f.cpf, '') AS cpf, 
        COALESCE(f.telefone, '') AS telefone, 
        COALESCE(f.tam_calca, '') AS tam_calca, 
        COALESCE(f.tam_camisa, '') AS tam_camisa, 
        COALESCE(f.tam_calcado, '') AS tam_calcado, 
        COALESCE(f.atualizado_em, f.data_admissao) AS atualizado_em,
        f.data_admissao, 
        f.data_demissao, 
        f.data_postagem_aso_pasta, 
        f.data_documentos_rh_completos,
        COALESCE(f.observacoes, '') AS observacoes,
        gf.id_usuario AS id_usuario_gestor,
        COALESCE(u.nome, 'Sem Gestor') AS gestor,
        COALESCE(u.nome, 'Sem Gestor') AS nome_gestor
      FROM funcionarios f
      LEFT JOIN gestor_funcionarios gf 
        ON f.id = gf.id_funcionario AND gf.data_fim IS NULL
      LEFT JOIN usuarios_sistema u 
        ON gf.id_usuario = u.id
      ORDER BY f.id DESC
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
        data_admissao, data_demissao, data_postagem_aso_pasta, data_documentos_rh_completos, observacoes, atualizado_em)
      VALUES (?, ?, ?, 'INTEGRAÇÃO PENDENTE', ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NOW())
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

// PUT: Atualizar dados cadastrais do funcionário
router.put('/rh/funcionarios/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    nome, matricula, cargo, ativo, 
    cpf, telefone, tam_calca, tam_camisa, tam_calcado,
    data_admissao, data_demissao, data_postagem_aso_pasta, data_documentos_rh_completos,
    observacoes,
    id_usuario_gestor, gestor
  } = req.body;

  const limparTexto = (valor) => {
    if (valor === null || valor === undefined) return null;
    const str = String(valor).trim();
    return str === '' ? null : str;
  };

  const formatarDataParaBD = (data) => {
    if (!data) return null;
    const str = String(data).trim();
    if (!str) return null;

    if (str.includes('-')) {
      return str.split('T')[0];
    }
    if (str.includes('/')) {
      const partes = str.split('/');
      if (partes.length === 3) {
        return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
      }
    }
    return null;
  };

  try {
    const idFunc = parseInt(id, 10);
    if (isNaN(idFunc)) {
      return res.status(400).json({ error: "ID de funcionário inválido." });
    }

    // Busca o status atual caso o formulário envie em branco
    const [atual] = await db.execute(`SELECT ativo FROM funcionarios WHERE id = ?`, [idFunc]);
    if (atual.length === 0) {
      return res.status(404).json({ error: "Funcionário não encontrado." });
    }

    const statusFormatado = ativo ? String(ativo).trim().toUpperCase() : atual[0].ativo;
    const nomeFormatado = limparTexto(nome);
    const matriculaFormatada = limparTexto(matricula);
    const cargoFormatado = limparTexto(cargo);

    if (!nomeFormatado || !matriculaFormatada || !cargoFormatado) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes (nome, matrícula ou cargo)." });
    }

    const cpfTratado = cpf ? String(cpf).trim().substring(0, 14) : null;
    const calcadoTratado = (tam_calcado === '' || tam_calcado === undefined || tam_calcado === null) 
      ? null 
      : parseInt(tam_calcado, 10);

    const dataDemissaoFinal = (statusFormatado === 'INATIVO') ? formatarDataParaBD(data_demissao) : null;

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
        data_demissao = ?,
        data_postagem_aso_pasta = ?,
        data_documentos_rh_completos = ?,
        observacoes = ?,
        atualizado_em = NOW() 
      WHERE id = ?
    `;
    
    const [result] = await db.execute(sql, [
      nomeFormatado, 
      matriculaFormatada, 
      cargoFormatado, 
      statusFormatado, 
      cpfTratado,
      limparTexto(telefone),
      limparTexto(tam_calca),
      limparTexto(tam_camisa),
      isNaN(calcadoTratado) ? null : calcadoTratado,
      formatarDataParaBD(data_admissao),
      dataDemissaoFinal,
      formatarDataParaBD(data_postagem_aso_pasta),
      formatarDataParaBD(data_documentos_rh_completos),
      limparTexto(observacoes),
      idFunc
    ]);

    // Atualização do gestor vinculado
    try {
      const gestorIdTarget = id_usuario_gestor !== undefined ? id_usuario_gestor : gestor;

      if (gestorIdTarget !== undefined) {
        const novoIdGestor = (gestorIdTarget && gestorIdTarget !== '') ? parseInt(gestorIdTarget, 10) : null;

        const [vinculoAtual] = await db.execute(
          `SELECT id_usuario FROM gestor_funcionarios WHERE id_funcionario = ? AND data_fim IS NULL LIMIT 1`,
          [idFunc]
        );

        const idGestorAtual = vinculoAtual.length > 0 ? vinculoAtual[0].id_usuario : null;

        if (novoIdGestor !== idGestorAtual) {
          await db.execute(
            `UPDATE gestor_funcionarios SET data_fim = NOW() WHERE id_funcionario = ? AND data_fim IS NULL`,
            [idFunc]
          );

          if (novoIdGestor && !isNaN(novoIdGestor)) {
            const sqlUpsertGestor = `
              INSERT INTO gestor_funcionarios (id_usuario, id_funcionario, id_obra, data_inicio, data_fim) 
              VALUES (?, ?, 0, NOW(), NULL)
              ON DUPLICATE KEY UPDATE 
                id_obra = 0,
                data_inicio = NOW(),
                data_fim = NULL
            `;
            await db.execute(sqlUpsertGestor, [novoIdGestor, idFunc]);
          }
        }
      }
    } catch (gestorErr) {
      console.warn("Aviso: Não foi possível atualizar o gestor vinculado:", gestorErr.message);
    }

    return res.json({ success: true, message: "Dados do funcionário atualizados com sucesso!" });
  } catch (err) {
    console.error("Erro interno no MySQL/Backend ao atualizar funcionário:", err);
    return res.status(500).json({ error: `Erro no servidor: ${err.message}` });
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

// 1. GET: Listar histórico completo das integrações (com Gestor atualizado)
router.get('/rh/integracoes-pendentes', async (req, res) => {
  try {
    const sql = `
      SELECT 
        i.id AS id_integracao,
        i.id_funcionario,
        i.id_obra,
        o.nome_obra,
        f.nome, 
        f.matricula, 
        f.cargo, 
        f.ativo,
        COALESCE(u.nome, 'Sem Gestor') AS gestor, -- 👈 Adicionado o nome do Gestor
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
      LEFT JOIN obras o ON i.id_obra = o.id
      LEFT JOIN gestor_funcionarios gf ON f.id = gf.id_funcionario AND gf.data_fim IS NULL -- 👈 Vinculo do Gestor Ativo
      LEFT JOIN usuarios_sistema u ON gf.id_usuario = u.id -- 👈 Tabela de Usuários
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
    id_obra,               // 👈 1. Recebe id_obra do req.body
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
    const obraIdFinal = (id_obra && id_obra !== '') ? parseInt(id_obra, 10) : null; // 👈 Trata o id_obra

    if (id_integracao) {
      const sqlUpdate = `
        UPDATE integracoes_funcionarios SET
          id_obra = ?,            -- 👈 2. Adicionado na Query
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
        obraIdFinal,              // 👈 3. Adicionado no Array de parâmetros
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
      const sqlUpdateGenerico = `
        UPDATE integracoes_funcionarios SET
          id_obra = ?,            -- 👈 Adicionado na Query genérica
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
        obraIdFinal,              // 👈 Adicionado no Array de parâmetros
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

// 1. GET: Listar veículos com cálculo de dias para vencer a topografia
router.get('/veiculos', async (req, res) => {
  const sql = `
    SELECT 
      id, placa, marca, modelo, ano, tipo, titularidade, descricao, status, id_gestor, id_funcionario,
      data_topografia,
      COALESCE(emitido_crlv, 'NÃO') AS emitido_crlv,
      DATEDIFF(data_topografia, CURRENT_DATE()) AS dias_para_vencer_topografia
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

// 2. POST: Cadastrar veículo
router.post('/veiculos', async (req, res) => {
  const { 
    placa, marca, modelo, ano, tipo, titularidade, descricao, status, id_gestor,
    data_topografia, emitido_crlv 
  } = req.body;

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
  const dataTopografiaTratada = formatarData(data_topografia);
  const crlvStatus = emitido_crlv === 'SIM' ? 'SIM' : 'NÃO';

  let statusFinal = 'DISPONÍVEL';
  if (status === 'EM MANUTENÇÃO') {
    statusFinal = 'EM MANUTENÇÃO';
  } else if (gestorId) {
    statusFinal = 'EM USO';
  }

  const sql = `
    INSERT INTO veiculos (placa, marca, modelo, ano, tipo, titularidade, descricao, status, id_gestor, id_funcionario, data_topografia, emitido_crlv) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
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
      isNaN(gestorId) ? null : gestorId,
      dataTopografiaTratada,
      crlvStatus
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

// 3. PUT: Atualizar veículo
router.put('/veiculos/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    placa, marca, modelo, ano, tipo, titularidade, descricao, status, id_gestor,
    data_topografia, emitido_crlv 
  } = req.body;

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
    SET placa = ?, marca = ?, modelo = ?, ano = ?, tipo = ?, titularidade = ?, descricao = ?, status = ?, id_gestor = ?, data_topografia = ?, emitido_crlv = ?
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
      formatarData(data_topografia),
      emitido_crlv === 'SIM' ? 'SIM' : 'NÃO',
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

// 4. DELETE: Remover veículo
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

// ========================================================
// F. ROTAS DE MONITORAMENTO DE MANUTENÇÃO
// ========================================================

// ========================================================
// ROTAS DE GERENCIAMENTO DE MANUTENÇÕES
// ========================================================

// 1. Listar histórico de manutenção de um veículo (com JOIN no item cadastrado)
router.get('/veiculos/:id/manutencoes', async (req, res) => {
  const { id } = req.params;
  try {
    const sql = `
      SELECT 
        m.id, 
        m.id_veiculo, 
        m.id_item_manutencao,
        i.cod AS cod_item,
        i.nome AS nome_item, 
        m.categoria, 
        m.descricao, 
        m.custo, 
        m.status, 
        DATE_FORMAT(m.data_manutencao, '%Y-%m-%d') AS data_manutencao, 
        m.criado_em
      FROM manutencoes_veiculos m
      INNER JOIN itens_manutencao i ON m.id_item_manutencao = i.id
      WHERE m.id_veiculo = ?
      ORDER BY m.data_manutencao DESC, m.id DESC
    `;
    const [rows] = await db.query(sql, [id]);
    return res.json(rows);
  } catch (err) {
    console.error('Erro ao listar manutenções:', err.message);
    return res.status(500).json({ error: 'Erro ao carregar manutenções.' });
  }
});

// 2. Registrar novas manutenções vinculadas aos itens cadastrados (Múltiplos itens)
// POST: Registrar novas manutenções vinculadas aos itens cadastrados
router.post('/veiculos/manutencoes', async (req, res) => {
  const { id_veiculo, itens_com_custo, data_manutencao, descricao, status } = req.body;

  // Aceita "itens_com_custo" ou "itens_manutencao" para manter retrocompatibilidade
  const listaItens = itens_com_custo || req.body.itens_manutencao;

  if (!id_veiculo || !listaItens || !Array.isArray(listaItens) || listaItens.length === 0 || !data_manutencao) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes (veículo, ao menos um item de manutenção e data).' });
  }

  try {
    const dataTratada = formatarData(data_manutencao);
    const statusFinal = status || 'PENDENTE';
    const descFinal = descricao && String(descricao).trim() !== '' ? String(descricao).trim() : null;

    // Mapeia os itens capturando id, custo individual e a categoria escolhida
    const valoresInsercao = listaItens.map(item => {
      // Se vier um objeto { id_item, custo, categoria }, usa as propriedades; senão trata como ID puro
      const idItem = typeof item === 'object' ? item.id_item : item;
      const custoItem = typeof item === 'object' && item.custo ? parseFloat(item.custo) : 0.00;
      const categoriaItem = typeof item === 'object' && item.categoria ? item.categoria : 'CORRETIVA';

      return [
        parseInt(id_veiculo, 10),
        parseInt(idItem, 10),
        categoriaItem.toUpperCase(),
        descFinal,
        custoItem,
        statusFinal,
        dataTratada
      ];
    });

    const sql = `
      INSERT INTO manutencoes_veiculos 
        (id_veiculo, id_item_manutencao, categoria, descricao, custo, status, data_manutencao)
      VALUES ?
    `;

    await db.query(sql, [valoresInsercao]);

    if (statusFinal !== 'CONCLUIDO') {
      await db.query(`UPDATE veiculos SET status = 'EM MANUTENÇÃO' WHERE id = ?`, [id_veiculo]);
    }

    return res.status(201).json({ message: 'Manutenção(ões) registrada(s) com sucesso!' });
  } catch (err) {
    console.error('Erro ao criar manutenções:', err.message);
    return res.status(500).json({ error: 'Erro ao registrar manutenção.' });
  }
});

// 3. Excluir registro de manutenção
router.delete('/veiculos/manutencoes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query(`DELETE FROM manutencoes_veiculos WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Registro de manutenção não encontrado.' });
    }
    return res.json({ message: 'Manutenção removida com sucesso!' });
  } catch (err) {
    console.error('Erro ao remover manutenção:', err.message);
    return res.status(500).json({ error: 'Erro ao remover manutenção.' });
  }
});

// ========================================================
// CRUD DE ITENS DE MANUTENÇÃO (itens_manutencao)
// ========================================================

// 1. GET: Buscar todos os itens ativos (sua rota atual)
router.get('/veiculos/itens-manutencao', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, cod, nome, ativo FROM itens_manutencao WHERE ativo = TRUE ORDER BY cod ASC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar itens de manutenção:', err.message);
    return res.status(500).json({ error: 'Erro ao carregar lista de itens.' });
  }
});

// 2. POST: Cadastrar novo item de manutenção
router.post('/veiculos/itens-manutencao', async (req, res) => {
  const { cod, nome } = req.body;

  if (!cod || !nome) {
    return res.status(400).json({ error: 'Código (cod) e Nome são campos obrigatórios.' });
  }

  try {
    const codFormatado = String(cod).trim().toUpperCase();
    const nomeFormatado = String(nome).trim().toUpperCase();

    const sql = `INSERT INTO itens_manutencao (cod, nome, ativo) VALUES (?, ?, TRUE)`;
    const [result] = await db.query(sql, [codFormatado, nomeFormatado]);

    return res.status(201).json({
      message: 'Item de manutenção cadastrado com sucesso!',
      id: result.insertId,
      cod: codFormatado,
      nome: nomeFormatado
    });
  } catch (err) {
    console.error('Erro ao cadastrar item de manutenção:', err.message);

    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Já existe um item cadastrado com este código (cod).' });
    }

    return res.status(500).json({ error: 'Erro ao salvar item no banco de dados.' });
  }
});

// 3. PUT: Atualizar item de manutenção existente
router.put('/veiculos/itens-manutencao/:id', async (req, res) => {
  const { id } = req.params;
  const { cod, nome, ativo } = req.body;

  if (!cod || !nome) {
    return res.status(400).json({ error: 'Código (cod) e Nome são campos obrigatórios.' });
  }

  try {
    const codFormatado = String(cod).trim().toUpperCase();
    const nomeFormatado = String(nome).trim().toUpperCase();
    const statusAtivo = ativo !== undefined ? Boolean(ativo) : true;

    const sql = `
      UPDATE itens_manutencao 
      SET cod = ?, nome = ?, ativo = ? 
      WHERE id = ?
    `;

    const [result] = await db.query(sql, [codFormatado, nomeFormatado, statusAtivo, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Item de manutenção não encontrado.' });
    }

    return res.json({ message: 'Item de manutenção atualizado com sucesso!' });
  } catch (err) {
    console.error('Erro ao atualizar item de manutenção:', err.message);

    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'O código (cod) informado já pertence a outro item.' });
    }

    return res.status(500).json({ error: 'Erro ao atualizar item de manutenção.' });
  }
});

// 4. DELETE: Excluir ou Desativar item de manutenção
router.delete('/veiculos/itens-manutencao/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Tenta remover o registro do banco
    const [result] = await db.query(`DELETE FROM itens_manutencao WHERE id = ?`, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Item de manutenção não encontrado.' });
    }

    return res.json({ message: 'Item de manutenção removido com sucesso!' });
  } catch (err) {
    console.error('Erro ao deletar item de manutenção:', err.message);

    // Se houver histórico de manutenções vinculadas (Foreign Key), faz Soft Delete (desativa)
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      await db.query(`UPDATE itens_manutencao SET ativo = FALSE WHERE id = ?`, [id]);
      return res.json({ 
        message: 'O item possui histórico de manutenções vinculadas e foi desativado em vez de excluído.' 
      });
    }

    return res.status(500).json({ error: 'Erro ao remover item de manutenção.' });
  }
});
// ========================================================
// E. ROTA DE OBRAS DISPONÍVEIS
// ========================================================
router.get('/obras', async (req, res) => {
  try {
    // Busca id e nome_obra
    const sql = `
      SELECT id, nome_obra AS nome 
      FROM obras 
      ORDER BY nome_obra ASC
    `;
    const [rows] = await db.execute(sql);
    return res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar obras:", err);
    return res.status(500).json({ error: "Erro ao carregar lista de obras." });
  }
});



export default router;