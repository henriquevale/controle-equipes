import express from 'express';
import multer from 'multer';
import db from '../../db.js'; // Ajuste o caminho da sua conexão com o MySQL

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @route   GET /api/master/materiais/comparativo
 * @desc    Retorna a lista de materiais comparando Faturamento Direto x Saldo em Estoque
 */
router.get('/materiais/comparativo', async (req, res) => {
  try {
    const { tipo_local, id_local, data_inicio, data_fim } = req.query;

    let filtroFd = [];
    let filtroEstoque = [];
    let params = [];

    if (data_inicio) {
      params.push(data_inicio);
      filtroFd.push(`fd.data_emissao >= $${params.length}`);
    }
    if (data_fim) {
      params.push(data_fim);
      filtroFd.push(`fd.data_emissao <= $${params.length}`);
    }

    if (tipo_local && id_local) {
      params.push(id_local);
      if (tipo_local.toUpperCase() === 'OBRA') {
        filtroFd.push(`fd.obra_id = $${params.length}`);
        filtroEstoque.push(`e.id_local = $${params.length} AND e.tipo_local = 'OBRA'`);
      } else if (tipo_local.toUpperCase() === 'BASE') {
        filtroFd.push(`fd.base_id = $${params.length}`);
        filtroEstoque.push(`e.id_local = $${params.length} AND e.tipo_local = 'BASE'`);
      }
    }

    const whereFd = filtroFd.length > 0 ? `WHERE ${filtroFd.join(' AND ')}` : '';
    const whereEstoque = filtroEstoque.length > 0 ? `WHERE ${filtroEstoque.join(' AND ')}` : '';

    const sqlQuery = `
      SELECT 
        m.id AS material_id,
        m.codigo,
        m.descricao AS nome,
        m.tipo AS categoria,
        m.unidade_estoque,
        m.unidade_consumo,
        m.fator_conversao_consumo,
        m.consumo_base,
        m.quantidade_aplicada,

        COALESCE((
          SELECT SUM(fd.quantidade) 
          FROM faturamento_direto_itens fd 
          ${whereFd ? `${whereFd} AND fd.material_id = m.id` : 'WHERE fd.material_id = m.id'}
        ), 0) AS qtd_faturamento_direto,

        COALESCE((
          SELECT SUM(fd.valor_total) 
          FROM faturamento_direto_itens fd 
          ${whereFd ? `${whereFd} AND fd.material_id = m.id` : 'WHERE fd.material_id = m.id'}
        ), 0) AS valor_faturamento_direto,

        COALESCE((
          SELECT SUM(e.saldo_atual) 
          FROM estoque_saldos e 
          ${whereEstoque ? `${whereEstoque} AND e.material_id = m.id` : 'WHERE e.material_id = m.id'}
        ), 0) AS saldo_estoque,

        COALESCE((
          SELECT SUM(e.valor_total_estoque) 
          FROM estoque_saldos e 
          ${whereEstoque ? `${whereEstoque} AND e.material_id = m.id` : 'WHERE e.material_id = m.id'}
        ), 0) AS valor_estoque

      FROM materiais m
      ORDER BY m.descricao ASC;
    `;

    // Executa no driver configurado (PostgreSQL ou MySQL)
    const result = await db.query(sqlQuery, params);
    return res.status(200).json(result.rows || result[0] || result);

  } catch (error) {
    console.error('Erro na rota /materiais/comparativo:', error);
    return res.status(500).json({ 
      erro: 'Erro interno ao buscar o comparativo de faturamento direto e estoque.' 
    });
  }
});

export default router;