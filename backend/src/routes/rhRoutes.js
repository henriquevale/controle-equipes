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
        f.encarregado, /* NOVA COLUNA */
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
    observacoes, encarregado /* NOVA COLUNA */
  } = req.body;

  if (!nome || !matricula || !cargo) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes (nome, matricula ou cargo)." });
  }

  try {
    let idNovoFuncionario = null;
    const isEncarregado = encarregado ? 1 : 0; /* Tratamento do booleano */

    const sqlFuncionario = `
      INSERT INTO funcionarios 
        (nome, matricula, cargo, ativo, encarregado, cpf, telefone, tam_calca, tam_camisa, tam_calcado,
        data_admissao, data_demissao, data_postagem_aso_pasta, data_documentos_rh_completos, observacoes, atualizado_em)
      VALUES (?, ?, ?, 'INTEGRAÇÃO PENDENTE', ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NOW())
    `;
    
    const calcadoFinal = (tam_calcado === '' || tam_calcado === undefined || tam_calcado === null) 
      ? null 
      : parseInt(tam_calcado, 10);

    const [resultadoFunc] = await db.execute(sqlFuncionario, [
      nome.trim(), 
      matricula.trim(), 
      cargo.trim(),
      isEncarregado, /* NOVA COLUNA */
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
    id_usuario_gestor, gestor, encarregado /* NOVA COLUNA */
  } = req.body;

  // ... (funções de limpeza permanecem inalteradas)

  try {
    const idFunc = parseInt(id, 10);
    if (isNaN(idFunc)) {
      return res.status(400).json({ error: "ID de funcionário inválido." });
    }

    const [atual] = await db.execute(`SELECT ativo FROM funcionarios WHERE id = ?`, [idFunc]);
    if (atual.length === 0) {
      return res.status(404).json({ error: "Funcionário não encontrado." });
    }

    const statusFormatado = ativo ? String(ativo).trim().toUpperCase() : atual[0].ativo;
    const nomeFormatado = limparTexto(nome);
    const matriculaFormatada = limparTexto(matricula);
    const cargoFormatado = limparTexto(cargo);
    const isEncarregado = encarregado ? 1 : 0; /* Tratamento do booleano */

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
        encarregado = ?, /* NOVA COLUNA */
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
      isEncarregado, /* NOVA COLUNA */ 
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

// ========================================================
// 1. GET: HISTÓRICO DE PRESENÇA CONSOLIDADO (TOTAIS E MATRIZ)
// ========================================================
router.get('/rh/historico-presenca', async (req, res) => {
  const { id, cargo, id_obra, data_inicio, data_fim } = req.query;

  if (!id) {
    return res.status(400).json({ error: "O ID do usuário é obrigatório." });
  }

  try {
    let sql = `
      SELECT 
        f.id AS id_funcionario,
        f.matricula,
        f.nome AS nome_funcionario,
        f.cargo,
        SUM(CASE WHEN de.status_presenca = 'ALOCADO' THEN 1 ELSE 0 END) AS total_alocado,
        SUM(CASE WHEN de.status_presenca IN ('PRESENTE', 'NORMAL') THEN 1 ELSE 0 END) AS total_presente,
        SUM(CASE WHEN de.status_presenca = 'FALTOU' THEN 1 ELSE 0 END) AS total_faltou,
        SUM(CASE WHEN de.status_presenca = 'FOLGA' THEN 1 ELSE 0 END) AS total_folga,
        SUM(CASE WHEN de.status_presenca IN ('FÉRIAS', 'FERIAS') THEN 1 ELSE 0 END) AS total_ferias,
        SUM(CASE WHEN de.status_presenca = 'INTEGRAÇÃO' THEN 1 ELSE 0 END) AS total_integracao,
        SUM(CASE WHEN de.status_presenca NOT IN ('ALOCADO', 'PRESENTE', 'NORMAL', 'FALTOU', 'FOLGA', 'FÉRIAS', 'FERIAS', 'INTEGRAÇÃO') THEN 1 ELSE 0 END) AS total_outros,
        SUM(COALESCE(dc.horas_trabalhadas, 0)) AS total_horas
      FROM funcionarios f
      INNER JOIN diario_efetivo de ON de.id_funcionario = f.id
      LEFT JOIN diario_efetivo_confirmado dc ON dc.id_diario = de.id AND dc.id_funcionario = f.id
      WHERE de.data_diario BETWEEN ? AND ?
    `;

    const params = [data_inicio, data_fim];

    if (id_obra) {
      sql += ` AND de.id_obra = ? `;
      params.push(Number(id_obra));
    }

    sql += ` GROUP BY f.id, f.matricula, f.nome, f.cargo ORDER BY f.nome ASC `;

    const [linhas] = await db.execute(sql, params);
    res.json(linhas);
  } catch (err) {
    console.error("Erro na matriz de presença:", err);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// ========================================================
// 2. GET: RASTREABILIDADE DETALHADA E TIMELINE DE JORNADA
// ========================================================
// ========================================================
// ROTA: RASTREABILIDADE DETALHADA E TIMELINE DE JORNADA
// ========================================================
router.get('/rh/historico-presenca-detalhado', async (req, res) => {
  const { id_funcionario, data_inicio, data_fim, id_obra } = req.query;

  // Validação estrita do ID do funcionário para evitar consultas inconsistentes
  if (!id_funcionario || id_funcionario === 'undefined' || id_funcionario === 'null') {
    return res.status(400).json({ error: "ID do funcionário é obrigatório e deve ser um número válido." });
  }

  const funcId = parseInt(id_funcionario, 10);
  if (isNaN(funcId)) {
    return res.status(400).json({ error: "ID do funcionário informado é inválido." });
  }

  try {
    let sql = `
      SELECT 
        de.id,
        de.id_funcionario,
        de.id_obra,
        de.data_diario,
        de.equipe,
        de.hora_inicio,
        de.hora_fim,
        de.status_presenca,
        COALESCE(cde.status_operacional, do.status, 'Normal') AS status_operacional,
        -- Prioriza a observação geral lançada no RDO (diario_obra) e depois a individual (diario_efetivo)
        COALESCE(do.observacoes, de.observacao, 'Lançamento regular.') AS observacao,
        o.nome_obra,
        o.codigo_obra,
        -- Subconsulta para buscar imagens e anexos do RDO (diario_anexos) vinculados à mesma obra, data e equipe
        (
          SELECT GROUP_CONCAT(da.caminho_arquivo SEPARATOR ',')
          FROM diario_anexos da
          WHERE da.id_obra = de.id_obra 
            AND DATE(da.data_diario) = DATE(de.data_diario)
            AND UPPER(TRIM(da.equipe)) = UPPER(TRIM(de.equipe))
        ) AS fotos_anexadas
      FROM diario_efetivo de
      LEFT JOIN obras o 
             ON o.id = de.id_obra
      LEFT JOIN diario_obra do 
             ON do.id_obra = de.id_obra 
            AND DATE(do.data_diario) = DATE(de.data_diario) 
            AND UPPER(TRIM(do.equipe)) = UPPER(TRIM(de.equipe))
      LEFT JOIN controle_diarios_equipe cde 
             ON cde.id_obra = de.id_obra 
            AND DATE(cde.data_diario) = DATE(de.data_diario) 
            AND UPPER(TRIM(cde.equipe)) = UPPER(TRIM(de.equipe))
      WHERE de.id_funcionario = ?
    `;

    const params = [funcId];

    // Trata os filtros opcionais de intervalo de data
    if (data_inicio && data_fim && data_inicio !== '' && data_fim !== '') {
      sql += ` AND DATE(de.data_diario) BETWEEN ? AND ? `;
      params.push(data_inicio, data_fim);
    }

    // Trata o filtro opcional de obra específica
    if (id_obra && id_obra !== '' && id_obra !== 'TODAS') {
      const obraId = parseInt(id_obra, 10);
      if (!isNaN(obraId)) {
        sql += ` AND de.id_obra = ? `;
        params.push(obraId);
      }
    }

    sql += ` ORDER BY de.data_diario DESC, de.hora_inicio ASC `;

    const [linhas] = await db.execute(sql, params);
    
    // Define cabeçalho no-cache para garantir dados sempre atualizados
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.json(linhas);

  } catch (err) {
    console.error("Erro ao buscar histórico detalhado do funcionário:", err);
    return res.status(500).json({ error: "Erro interno no servidor ao carregar histórico detalhado." });
  }
});

export default router;