import express from 'express';
import db from '../../db.js';

const router = express.Router();

// Função auxiliar segura para ordenação das rotas de compras
function getOrderBySql(ordenacao, tipoRelatorio) {
  const mapeamento = {
    maior_gasto: 'valor_total_gasto DESC',
    menor_gasto: 'valor_total_gasto ASC',
    maior_qtd: tipoRelatorio === 'material' ? 'quantidade_total_comprada DESC' : 'total_pedidos DESC',
    menor_qtd: tipoRelatorio === 'material' ? 'quantidade_total_comprada ASC' : 'total_pedidos ASC',
    ultima_compra: 'ultima_compra DESC',
    primeira_compra: 'primeira_compra ASC'
  };

  return mapeamento[ordenacao] || 'valor_total_gasto DESC';
}

// 1. GET: ATIVIDADES EXECUTADAS
router.get('/relatorios/atividades-executadas', async (req, res) => {
  try {
    const { obra_id, data_inicio, data_fim } = req.query;

    if (!obra_id) return res.json([]);

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

    const mapaMedia = {};
    dadosMedia.forEach(row => {
      if (row.atividade) {
        mapaMedia[row.atividade.trim().toUpperCase()] = Number(row.media_todas_obras) || 0;
      }
    });

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

// 2. GET: MATERIAIS CONSUMIDOS (Sincronizado tratamento de strings)
router.get('/relatorios/materiais-consumidos', async (req, res) => {
  try {
    const { obra_id, data_inicio, data_fim } = req.query;

    if (!obra_id) return res.json([]);

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
      if (row.material) {
        mapaMedia[row.material.trim().toUpperCase()] = Number(row.media_todas_obras) || 0;
      }
    });

    const resultadoFinal = dadosObra.map(item => {
      const nomeMaterial = (item.material || '').trim().toUpperCase();
      return {
        material: item.material,
        quantidade: Number(item.quantidade) || 0,
        mediaGeral: Number((mapaMedia[nomeMaterial] || 0).toFixed(2))
      };
    });

    return res.json(resultadoFinal);
  } catch (error) {
    console.error("Erro ao carregar materiais consumidos:", error);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// 3. GET: PRESENÇA DETALHADA
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

    const relacaoPresenca = rows.map(item => {
      const presente = Number(item.presente) || 0;
      const faltou = Number(item.faltou) || 0;
      const outros = Number(item.outros) || 0;

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

// 4. GET: RESUMO DE RDOS
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

    const sqlTotal = `
      SELECT COUNT(*) AS total 
      FROM controle_diarios_equipe 
      ${filtroCondicional}
    `;
    const [totalRows] = await db.query(sqlTotal, params);
    const totalRegistros = Number(totalRows[0]?.total) || 0;

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
        status: String(row.status).toUpperCase(),
        quantidade: qtd,
        percentual: totalRegistros > 0 ? Number(((qtd / totalRegistros) * 100).toFixed(1)) : 0
      };
    });

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
        status_operacional: String(row.status_operacional).toUpperCase(),
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

// 5. GET: FATURAMENTO DIRETO
router.get('/relatorios/faturamento-direto', async (req, res) => {
  try {
    const { obra_id, usuario_id, cargo, data_inicio, data_fim } = req.query;

    let sql = `
      SELECT 
        fd.id,
        fd.numero_nota_fiscal,
        fd.numero_pedido_obra,
        COALESCE(f.nome_fantasia, f.razao_social, 'NÃO INFORMADO') AS fornecedor_nome,
        u.nome AS gestor_nome,
        COALESCE(fd.data_nota_fiscal, fd.data_solicitacao) AS data_emissao,
        COALESCE(fd.valor_nota_fiscal, 0) AS valor_total,
        fd.status
      FROM faturamentos_diretos fd
      LEFT JOIN fornecedores f ON fd.fornecedor_id = f.id
      LEFT JOIN usuarios_sistema u ON fd.id_gestor = u.id
      WHERE 1=1
    `;
    const params = [];

    const cargoUpper = cargo ? String(cargo).toUpperCase() : '';
    const isMaster = cargoUpper === 'MASTER' || cargoUpper === 'RH';

    if (!isMaster && usuario_id) {
      sql += ` AND (
        fd.obra_id IN (SELECT id_obra FROM engenharia_obras WHERE id_usuario = ?)
        OR fd.id_gestor = ?
      )`;
      params.push(Number(usuario_id), Number(usuario_id));
    }

    if (obra_id) {
      sql += ` AND fd.obra_id = ?`;
      params.push(Number(obra_id));
    }
    if (data_inicio) {
      sql += ` AND COALESCE(fd.data_nota_fiscal, fd.data_solicitacao) >= ?`;
      params.push(data_inicio);
    }
    if (data_fim) {
      sql += ` AND COALESCE(fd.data_nota_fiscal, fd.data_solicitacao) <= ?`;
      params.push(data_fim);
    }

    sql += ` ORDER BY COALESCE(fd.data_nota_fiscal, fd.data_solicitacao) DESC`;

    const [rows] = await db.query(sql, params);
    return res.json(rows || []);
  } catch (error) {
    console.error("Erro ao carregar faturamento direto:", error);
    return res.status(500).json({ error: "Erro ao carregar faturamento direto." });
  }
});

// 6-A. COMPRAS POR MATERIAL
router.get('/relatorios/compras-por-material', async (req, res) => {
  const { data_inicio, data_fim, fornecedor_id, obra_id, ordenacao } = req.query;

  try {
    let sql = `
      SELECT 
        m.id AS material_id,
        m.descricao AS material_nome,
        m.unidade_consumo AS unidade_medida,
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

    if (obra_id) {
      sql += ` AND fd.obra_id = ?`;
      params.push(Number(obra_id));
    }
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
      params.push(Number(fornecedor_id));
    }

    sql += ` GROUP BY m.id, m.descricao, m.unidade_consumo, m.tipo`;
    sql += ` ORDER BY ${getOrderBySql(ordenacao, 'material')}`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error("Erro no relatório por material:", error);
    res.status(500).json({ error: "Erro ao gerar relatório por material." });
  }
});

// 6-B. COMPRAS POR FORNECEDOR
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

    if (obra_id) {
      sql += ` AND fd.obra_id = ?`;
      params.push(Number(obra_id));
    }
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
      params.push(Number(material_id));
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

// 7. GET: RELATÓRIO DE VEÍCULOS UTILIZADOS
router.get('/relatorios/veiculos-utilizados', async (req, res) => {
  try {
    const { 
      data_inicio, 
      data_fim, 
      obra_id, 
      id_obra, 
      status_veiculo, 
      id_gestor,
      id,
      cargo 
    } = req.query;

    const obraIdFinal = obra_id || id_obra;

    let query = `
      SELECT 
        v.id,
        v.data_diario,
        v.id_obra,
        o.nome_obra,
        o.codigo_obra,
        v.id_veiculo,
        ve.placa,
        ve.modelo,
        ve.marca,
        v.id_condutor,
        c.nome AS nome_condutor,
        v.id_funcionario,
        f.nome AS nome_funcionario,
        v.id_gestor,
        g.nome AS nome_gestor,
        v.status_veiculo,
        v.status_uso,
        v.status AS status_diario
      FROM diarios_veiculos v
      LEFT JOIN obras o ON o.id = v.id_obra
      LEFT JOIN veiculos ve ON ve.id = v.id_veiculo
      LEFT JOIN funcionarios c ON c.id = v.id_condutor
      LEFT JOIN funcionarios f ON f.id = v.id_funcionario
      LEFT JOIN funcionarios g ON g.id = v.id_gestor
      WHERE 1=1
    `;

    const params = [];
    const cargoUsuario = (cargo || '').toUpperCase();

    if (cargoUsuario === 'GESTOR') {
      query += ` AND v.id_gestor = ?`;
      params.push(Number(id));
    } else if (['MASTER', 'RH'].includes(cargoUsuario) && id_gestor) {
      query += ` AND v.id_gestor = ?`;
      params.push(Number(id_gestor));
    }

    if (data_inicio && data_fim) {
      query += ` AND v.data_diario BETWEEN ? AND ?`;
      params.push(data_inicio, data_fim);
    }

    if (obraIdFinal) {
      query += ` AND v.id_obra = ?`;
      params.push(Number(obraIdFinal));
    }

    if (status_veiculo) {
      query += ` AND v.status_veiculo = ?`;
      params.push(status_veiculo);
    }

    query += ` ORDER BY ve.placa ASC, v.data_diario DESC`;

    const [detalhes] = await db.query(query, params);

    const resumoStatus = detalhes.reduce((acc, item) => {
      const status = (item.status_veiculo || 'INDEFINIDO').toUpperCase();
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    res.json({
      totalVeiculosUtilizados: detalhes.length,
      resumoStatus,
      detalhes
    });

  } catch (error) {
    console.error("Erro ao buscar veículos:", error);
    res.status(500).json({ mensagem: "Erro ao consultar veículos." });
  }
});

export default router;