import express from 'express';
import db from '../../db.js';

const router = express.Router();

// ========================================================
// 1. GET: ATIVIDADES EXECUTADAS VS MÉDIA GERAL DE TODAS AS OBRAS
// ========================================================
router.get('/relatorios/atividades-executadas', async (req, res) => {
  try {
    const { obra_id, data_inicio, data_fim } = req.query;

    if (!obra_id) {
      return res.json([]);
    }

    // 1. Total da obra selecionada vindo da tabela diario_atividades
    let sqlObra = `
      SELECT 
        da.tipo_servico AS atividade,
        SUM(da.quantidade) AS quantidade
      FROM diario_atividades da
      INNER JOIN diario_obra do ON da.id_diario = do.id
      WHERE do.id_obra = ?
    `;
    const paramsObra = [Number(obra_id)];

    if (data_inicio && data_fim) {
      sqlObra += ` AND do.data_diario BETWEEN ? AND ? `;
      paramsObra.push(data_inicio, data_fim);
    }
    sqlObra += ` GROUP BY da.tipo_servico `;

    // 2. Média geral de todas as obras que executaram a atividade no período
    let sqlMedia = `
      SELECT 
        da.tipo_servico AS atividade,
        SUM(da.quantidade) / COUNT(DISTINCT do.id_obra) AS media_todas_obras
      FROM diario_atividades da
      INNER JOIN diario_obra do ON da.id_diario = do.id
      WHERE 1=1
    `;
    const paramsMedia = [];

    if (data_inicio && data_fim) {
      sqlMedia += ` AND do.data_diario BETWEEN ? AND ? `;
      paramsMedia.push(data_inicio, data_fim);
    }
    sqlMedia += ` GROUP BY da.tipo_servico `;

    const [dadosObra] = await db.query(sqlObra, paramsObra);
    const [dadosMedia] = await db.query(sqlMedia, paramsMedia);

    // Mapeia as médias obtidas
    const mapaMedia = {};
    dadosMedia.forEach(row => {
      if (row.atividade) {
        mapaMedia[row.atividade.trim().toUpperCase()] = Number(row.media_todas_obras) || 0;
      }
    });

    // Formata o resultado garantindo nomes padronizados em maiúsculo
    const resultadoFinal = dadosObra.map(item => {
      const nomeAtividade = (item.atividade || '').trim().toUpperCase();
      return {
        atividade: nomeAtividade,
        quantidade: Number(item.quantidade) || 0,
        mediaGeral: Number((mapaMedia[nomeAtividade] || 0).toFixed(2))
      };
    });

    return res.json(resultadoFinal);

  } catch (error) {
    console.error("Erro ao carregar atividades executadas:", error);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
}); 

// ========================================================
// 2. GET: MATERIAIS CONSUMIDOS (Baseado em diario_materiais_apontados)
// ========================================================
router.get('/relatorios/materiais-consumidos', async (req, res) => {
  try {
    const { obra_id, data_inicio, data_fim } = req.query;

    if (!obra_id) {
      return res.json([]);
    }

    // 1. Total da obra selecionada
    let sqlObra = `
      SELECT 
        dm.material_nome AS material,
        SUM(dm.quantidade) AS quantidade
      FROM diario_materiais_apontados dm
      INNER JOIN diario_obra do ON dm.id_diario = do.id
      WHERE do.id_obra = ?
    `;
    const paramsObra = [Number(obra_id)];

    if (data_inicio && data_fim) {
      sqlObra += ` AND do.data_diario BETWEEN ? AND ? `;
      paramsObra.push(data_inicio, data_fim);
    }
    sqlObra += ` GROUP BY dm.material_nome `;

    // 2. Média geral de todas as obras que consumiram cada material no período
    let sqlMedia = `
      SELECT 
        dm.material_nome AS material,
        SUM(dm.quantidade) / COUNT(DISTINCT do.id_obra) AS media_todas_obras
      FROM diario_materiais_apontados dm
      INNER JOIN diario_obra do ON dm.id_diario = do.id
      WHERE 1=1
    `;
    const paramsMedia = [];

    if (data_inicio && data_fim) {
      sqlMedia += ` AND do.data_diario BETWEEN ? AND ? `;
      paramsMedia.push(data_inicio, data_fim);
    }
    sqlMedia += ` GROUP BY dm.material_nome `;

    const [dadosObra] = await db.query(sqlObra, paramsObra);
    const [dadosMedia] = await db.query(sqlMedia, paramsMedia);

    const mapaMedia = {};
    dadosMedia.forEach(row => {
      mapaMedia[row.material] = Number(row.media_todas_obras) || 0;
    });

    const resultadoFinal = dadosObra.map(item => ({
      material: item.material,
      quantidade: Number(item.quantidade) || 0,
      mediaGeral: Number((mapaMedia[item.material] || 0).toFixed(2))
    }));

    return res.json(resultadoFinal);
  } catch (error) {
    console.error("Erro ao carregar materiais consumidos:", error);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// ========================================================
// 3. GET: PRESENÇA DETALHADA E FREQUÊNCIA BASEADA NOS RDOs
// ========================================================
router.get('/relatorios/presenca-detalhada', async (req, res) => {
  try {
    const { obra_id, data_inicio, data_fim } = req.query;

    if (!obra_id) {
      return res.json({
        totalRdos: 0,
        percentualFrequenciaGeral: 0,
        relacaoPresenca: []
      });
    }

    // 1. Obter o Total de RDOs cadastrados no período para a obra
    let sqlRdoCount = `
      SELECT COUNT(DISTINCT id) AS total_rdos
      FROM diario_obra
      WHERE id_obra = ?
    `;
    const paramsRdo = [Number(obra_id)];

    if (data_inicio && data_fim) {
      sqlRdoCount += ` AND data_diario BETWEEN ? AND ? `;
      paramsRdo.push(data_inicio, data_fim);
    }

    const [rdoRows] = await db.query(sqlRdoCount, paramsRdo);
    const totalRdos = Number(rdoRows[0]?.total_rdos) || 0;

    // 2. Montar query com agrupação garantida por funcionário (evitando duplicidades)
    let filtroCondicional = " WHERE de.id_obra = ? ";
    let paramsPresenca = [Number(obra_id)];

    if (data_inicio && data_fim) {
      filtroCondicional += ` AND de.data_diario BETWEEN ? AND ? `;
      paramsPresenca.push(data_inicio, data_fim);
    }

    const sqlPresenca = `
      SELECT 
        resumo_diario.id_funcionario,
        resumo_diario.matricula,
        resumo_diario.colaborador,
        resumo_diario.cargo,
        SUM(CASE WHEN resumo_diario.status_final IN ('PRESENTE', 'ALOCADO') THEN 1 ELSE 0 END) AS presente,
        SUM(CASE WHEN resumo_diario.status_final = 'FALTOU' THEN 1 ELSE 0 END) AS faltou,
        SUM(CASE WHEN resumo_diario.status_final NOT IN ('PRESENTE', 'ALOCADO', 'FALTOU') THEN 1 ELSE 0 END) AS outros
      FROM (
        SELECT 
          de.id_funcionario,
          COALESCE(de.matricula, '') AS matricula,
          TRIM(de.nome) AS colaborador,
          TRIM(de.cargo) AS cargo,
          de.data_diario,
          MAX(de.status_presenca) AS status_final
        FROM diario_efetivo de
        ${filtroCondicional}
        GROUP BY de.id_funcionario, de.matricula, de.nome, de.cargo, de.data_diario
      ) AS resumo_diario
      GROUP BY 
        resumo_diario.id_funcionario, 
        resumo_diario.matricula, 
        resumo_diario.colaborador, 
        resumo_diario.cargo
      ORDER BY resumo_diario.colaborador ASC
    `;

    const [rows] = await db.query(sqlPresenca, paramsPresenca);

    let somaPresencasGeral = 0;

    // 3. Processar cálculos por colaborador
    const relacaoPresenca = rows.map(item => {
      const presente = Number(item.presente) || 0;
      const faltou = Number(item.faltou) || 0;
      const outros = Number(item.outros) || 0;

      // Porcentagem calculada em cima do Total de RDOs
      const percentualFrequencia = totalRdos > 0 
        ? Number(((presente / totalRdos) * 100).toFixed(1)) 
        : 0;

      somaPresencasGeral += presente;

      return {
        id_funcionario: item.id_funcionario,
        matricula: item.matricula,
        colaborador: item.colaborador,
        cargo: item.cargo,
        presente,
        faltou,
        outros,
        percentualFrequencia
      };
    });

    const totalPossivelGeral = relacaoPresenca.length * totalRdos;
    const percentualFrequenciaGeral = totalPossivelGeral > 0 
      ? Number(((somaPresencasGeral / totalPossivelGeral) * 100).toFixed(1)) 
      : 0;

    return res.json({
      totalRdos,
      percentualFrequenciaGeral,
      relacaoPresenca
    });

  } catch (err) {
    console.error("Erro ao buscar histórico de presença detalhado:", err);
    return res.status(500).json({ error: "Erro ao carregar relatório de presença." });
  }
});

// ========================================================
// 4. GET: RESUMO DE RDOS (Status, Status Operacional e QTD)
// ========================================================
router.get('/relatorios/rdos-resumo', async (req, res) => {
  try {
    const { obra_id, data_inicio, data_fim } = req.query;

    if (!obra_id) {
      return res.json({
        totalRegistros: 0,
        relacaoPorDias: [],
        porStatusRdo: [],
        porStatusOperacional: []
      });
    }

    let filtroCondicional = " WHERE id_obra = ? ";
    let params = [Number(obra_id)];

    if (data_inicio && data_fim) {
      filtroCondicional += ` AND data_diario BETWEEN ? AND ? `;
      params.push(data_inicio, data_fim);
    }

    // Query 1: Total de registros de diários de equipe no período
    const sqlTotal = `
      SELECT COUNT(*) AS total 
      FROM controle_diarios_equipe 
      ${filtroCondicional}
    `;
    const [totalRows] = await db.query(sqlTotal, params);
    const totalRegistros = Number(totalRows[0]?.total) || 0;

    // Query 2: Relação de quantidade por dia do filtro com %
    const sqlPorDias = `
      SELECT 
        DATE_FORMAT(data_diario, '%d/%m/%Y') AS data_formatada,
        COUNT(*) AS quantidade
      FROM controle_diarios_equipe
      ${filtroCondicional}
      GROUP BY data_diario
      ORDER BY data_diario ASC
    `;
    const [rowsPorDias] = await db.query(sqlPorDias, params);

    const relacaoPorDias = rowsPorDias.map(row => {
      const qtd = Number(row.quantidade) || 0;
      return {
        data: row.data_formatada,
        quantidade: qtd,
        percentual: totalRegistros > 0 ? Number(((qtd / totalRegistros) * 100).toFixed(1)) : 0
      };
    });

    // Query 3: Relação por Status do RDO (PENDENTE, FINALIZADO, etc.) com %
    const sqlStatusRdo = `
      SELECT 
        COALESCE(status_rdo, 'NÃO INFORMADO') AS status,
        COUNT(*) AS quantidade
      FROM controle_diarios_equipe
      ${filtroCondicional}
      GROUP BY status_rdo
      ORDER BY quantidade DESC
    `;
    const [rowsStatusRdo] = await db.query(sqlStatusRdo, params);

    const porStatusRdo = rowsStatusRdo.map(row => {
      const qtd = Number(row.quantidade) || 0;
      return {
        status: row.status.toUpperCase(),
        quantidade: qtd,
        percentual: totalRegistros > 0 ? Number(((qtd / totalRegistros) * 100).toFixed(1)) : 0
      };
    });

    // Query 4: Relação por Status Operacional (Normal, Choveu, Sem produção, etc.) com %
    const sqlStatusOp = `
      SELECT 
        COALESCE(status_operacional, 'OUTROS') AS status_operacional,
        COUNT(*) AS quantidade
      FROM controle_diarios_equipe
      ${filtroCondicional}
      GROUP BY status_operacional
      ORDER BY quantidade DESC
    `;
    const [rowsStatusOp] = await db.query(sqlStatusOp, params);

    const porStatusOperacional = rowsStatusOp.map(row => {
      const qtd = Number(row.quantidade) || 0;
      return {
        status_operacional: row.status_operacional.toUpperCase(),
        quantidade: qtd,
        percentual: totalRegistros > 0 ? Number(((qtd / totalRegistros) * 100).toFixed(1)) : 0
      };
    });

    return res.json({
      totalRegistros,
      relacaoPorDias,
      porStatusRdo,
      porStatusOperacional
    });

  } catch (err) {
    console.error("Erro ao carregar relatório de RDOs:", err);
    return res.status(500).json({ error: "Erro ao carregar diários de equipe." });
  }
});
// ========================================================
// 4. GET: VEÍCULOS ALOCADOS
// ========================================================
router.get('/relatorios/veiculos', async (req, res) => {
  try {
    const { obra_id } = req.query;

    let sql = `
      SELECT 
        v.placa,
        v.modelo,
        COALESCE(v.uso_acumulado, '0 Km') AS uso_acumulado,
        v.status,
        COALESCE(v.custo_manutencao, 0) AS custo_manutencao
      FROM veiculos v
      WHERE 1=1
    `;
    const params = [];

    if (obra_id) {
      sql += ` AND v.obra_id = ?`;
      params.push(obra_id);
    }

    const [rows] = await db.query(sql, params);
    return res.json(rows || []);
  } catch (error) {
    console.error("Erro ao carregar veículos:", error);
    return res.status(500).json({ error: "Erro ao carregar lista de veículos." });
  }
});

// ========================================================
// 5. GET: FATURAMENTO DIRETO
// ========================================================
router.get('/relatorios/faturamento-direto', async (req, res) => {
  try {
    const { obra_id, data_inicio, data_fim } = req.query;

    let sql = `
      SELECT 
        fd.numero_pedido,
        fd.fornecedor,
        DATE_FORMAT(fd.data_solicitacao, '%d/%m/%Y') AS data,
        fd.valor_nota_fiscal AS valor,
        fd.status
      FROM faturamentos_diretos fd
      WHERE fd.status != 'Cancelado'
    `;
    const params = [];

    if (obra_id) {
      sql += ` AND fd.obra_id = ?`;
      params.push(obra_id);
    }
    if (data_inicio) {
      sql += ` AND fd.data_solicitacao >= ?`;
      params.push(data_inicio);
    }
    if (data_fim) {
      sql += ` AND fd.data_solicitacao <= ?`;
      params.push(data_fim);
    }

    sql += ` ORDER BY fd.data_solicitacao DESC`;

    const [rows] = await db.query(sql, params);
    return res.json(rows || []);
  } catch (error) {
    console.error("Erro ao carregar faturamento direto:", error);
    return res.status(500).json({ error: "Erro ao carregar faturamento direto." });
  }
});

export default router;