import express from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import db from '../../db.js'; // Ajuste o caminho da sua conexão com o MySQL

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function converterValor(valorInput) {
  if (valorInput === null || valorInput === undefined || valorInput === '') return 0.00;

  // Se já for um número retornado do Excel JS
  if (typeof valorInput === 'number') {
    return isNaN(valorInput) ? 0.00 : valorInput;
  }

  let str = String(valorInput).trim();

  // Remove R$, espaços e caracteres invisíveis
  str = str.replace(/R\$/g, '').replace(/\s/g, '');

  // Detecta se contém vírgula (Formato Brasileiro: 1.000,50 ou -3.650,00)
  if (str.includes(',')) {
    // Remove os pontos de milhar e troca a vírgula por ponto decimal
    str = str.replace(/\./g, '').replace(',', '.');
  }

  const valorFinal = parseFloat(str);
  return isNaN(valorFinal) ? 0.00 : valorFinal;
}

function converterData(dataStr) {
  if (!dataStr) return null;
  if (dataStr instanceof Date) return dataStr.toISOString().split('T')[0];
  
  const partes = String(dataStr).trim().split('/');
  if (partes.length === 3) {
    const [dia, mes, ano] = partes;
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }
  return null;
}

// 1. GET: Lista Unificada de Centros de Custo e Obras
router.get('/financeiro/centros-custo-obras', async (req, res) => {
  try {
    const [centros] = await db.query('SELECT id, nome, tipo FROM centros_custo ORDER BY nome ASC');
    const [obras] = await db.query('SELECT id, nome_obra as nome FROM obras ORDER BY nome_obra ASC');

    res.json({
      centrosCusto: centros || [],
      obras: obras || []
    });
  } catch (err) {
    console.error('Erro ao buscar centros de custo:', err);
    res.status(500).json({ error: 'Erro ao buscar centros de custo e obras.' });
  }
});

// POST: Recebe tipo_destino ('OBRA' ou 'CENTRO_CUSTO') e o destino_id
router.post('/financeiro/importar-planilha', upload.single('arquivo'), async (req, res) => {
  const { tipo_destino, destino_id } = req.body;

  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  if (!tipo_destino || !destino_id) {
    return res.status(400).json({ error: 'Selecione o tipo e a opção de destino para a planilha.' });
  }

  const centroCustoId = tipo_destino === 'CENTRO_CUSTO' ? destino_id : null;
  const obraId = tipo_destino === 'OBRA' ? destino_id : null;

  const connection = await db.getConnection();

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const linhas = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'yyyy-mm-dd' });

    if (linhas.length === 0) return res.status(400).json({ error: 'A planilha está vazia.' });

    await connection.beginTransaction();

    // Insere no histórico
    const [resHist] = await connection.query(
      'INSERT INTO historico_importacoes_financeiras (nome_arquivo, centro_custo_id, obra_id, total_linhas) VALUES (?, ?, ?, ?)',
      [req.file.originalname, centroCustoId, obraId, linhas.length]
    );

    const importacaoId = resHist.insertId;

    // Cache de Categorias
    const [catRows] = await connection.query('SELECT id, UPPER(nome) as nome FROM categorias_financeiras');
    const categoriaMap = new Map(catRows.map(c => [c.nome, c.id]));

    const CHUNK_SIZE = 500;
    let registrosParaInserir = [];
    let valorSomaTotal = 0;

    for (const linha of linhas) {
      const dataMov = converterData(linha['Data movimento']);
      const doc = linha['Identificador do fornecedor/cliente'] || '';
      const nomeClienteForn = linha['Nome do fornecedor/cliente'] || '';
      const descricao = linha['Descrição'] || '';
      const tipoRaw = (linha['Tipo'] || 'DESPESA').toUpperCase().trim();
      const valor = converterValor(linha['Valor (R$)']);
      const dataComp = converterData(linha['Data de competência']);
      const nomeCat = (linha['Categoria 1'] || '').toUpperCase().trim();

      if (!dataMov) continue;
      valorSomaTotal += valor;

      let categoriaId = null;
      if (nomeCat) {
        if (!categoriaMap.has(nomeCat)) {
          const [resCat] = await connection.query('INSERT INTO categorias_financeiras (nome) VALUES (?)', [nomeCat]);
          categoriaMap.set(nomeCat, resCat.insertId);
        }
        categoriaId = categoriaMap.get(nomeCat);
      }

      registrosParaInserir.push([
        importacaoId, dataMov, doc, nomeClienteForn, descricao, tipoRaw, valor, dataComp, categoriaId, centroCustoId, obraId
      ]);

      if (registrosParaInserir.length >= CHUNK_SIZE) {
        const sqlBatch = `
          INSERT INTO lancamentos_financeiros 
          (importacao_id, data_movimento, identificador_cliente_fornecedor, nome_cliente_fornecedor, descricao, tipo, valor, data_competencia, categoria_id, centro_custo_id, obra_id) 
          VALUES ?
        `;
        await connection.query(sqlBatch, [registrosParaInserir]);
        registrosParaInserir = [];
      }
    }

    if (registrosParaInserir.length > 0) {
      const sqlBatch = `
        INSERT INTO lancamentos_financeiros 
        (importacao_id, data_movimento, identificador_cliente_fornecedor, nome_cliente_fornecedor, descricao, tipo, valor, data_competencia, categoria_id, centro_custo_id, obra_id) 
        VALUES ?
      `;
      await connection.query(sqlBatch, [registrosParaInserir]);
    }

    await connection.query('UPDATE historico_importacoes_financeiras SET valor_total = ? WHERE id = ?', [valorSomaTotal, importacaoId]);

    await connection.commit();
    return res.json({ success: true, message: `${linhas.length} linhas importadas com sucesso!` });

  } catch (err) {
    await connection.rollback();
    return res.status(500).json({ error: 'Erro ao processar a planilha.', detalhe: err.message });
  } finally {
    connection.release();
  }
});

// GET: Histórico com nome do Centro ou Obra
router.get('/financeiro/historico-importacoes', async (req, res) => {
  try {
    const sql = `
      SELECT 
        h.id,
        h.nome_arquivo,
        h.total_linhas,
        h.valor_total,
        h.criado_em,
        COALESCE(CONCAT('[OBRA] ', o.nome_obra), CONCAT('[CENTRO] ', cc.nome)) AS centro_custo_nome
      FROM historico_importacoes_financeiras h
      LEFT JOIN centros_custo cc ON h.centro_custo_id = cc.id
      LEFT JOIN obras o ON h.obra_id = o.id
      ORDER BY h.id DESC
    `;
    const [rows] = await db.query(sql);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar histórico de importações.' });
  }
});

// 4. GET: Ver Detalhes (Linhas) de uma Importação Específica
router.get('/financeiro/importacao/:id/linhas', async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT 
        lf.*, 
        cat.nome AS categoria_nome
      FROM lancamentos_financeiros lf
      LEFT JOIN categorias_financeiras cat ON lf.categoria_id = cat.id
      WHERE lf.importacao_id = ?
      ORDER BY lf.id ASC
    `;
    const [rows] = await db.query(sql, [id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar linhas da importação.' });
  }
});

// DELETE: Exclui a importação e todos os lançamentos vinculados
router.delete('/financeiro/importacao/:id', async (req, res) => {
  const { id } = req.params;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Remove os lançamentos financeiros atrelados
    await connection.query('DELETE FROM lancamentos_financeiros WHERE importacao_id = ?', [id]);

    // 2. Remove o registro do histórico de importação
    const [result] = await connection.query('DELETE FROM historico_importacoes_financeiras WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Importação não encontrada.' });
    }

    await connection.commit();
    return res.json({ success: true, message: 'Importação e lançamentos excluídos com sucesso!' });
  } catch (err) {
    await connection.rollback();
    console.error('Erro ao excluir importação:', err);
    return res.status(500).json({ error: 'Erro ao excluir importação do banco de dados.' });
  } finally {
    connection.release();
  }
});
// GET: Rota simples para alimentar o Select de Categorias no Frontend
router.get('/categorias-financeiras', async (req, res) => {
  try {
    // Busca id e nome da tabela categorias_financeiras
    const [rows] = await db.query('SELECT id, nome FROM categorias_financeiras ORDER BY nome ASC');
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar categorias:', err);
    res.status(500).json({ error: 'Erro ao buscar categorias financeiras.' });
  }
});

// GET: Relatório Dinâmico (Cards, Gráfico e Tabela filtrados)
router.get('/financeiro/relatorio-geral', async (req, res) => {
  try {
    const { 
      data_inicio, 
      data_fim, 
      periodo_preset, 
      categoria_id, 
      tipo_destino, 
      destino_id 
    } = req.query;

    let whereClause = ['1=1'];
    let params = [];

    // 1. Filtro por Categoria
    if (categoria_id) {
      whereClause.push('lf.categoria_id = ?');
      params.push(categoria_id);
    }

    // 2. Filtro por Obra ou Centro de Custo
    if (tipo_destino === 'OBRA' && destino_id) {
      whereClause.push('lf.obra_id = ?');
      params.push(destino_id);
    } else if (tipo_destino === 'CENTRO_CUSTO' && destino_id) {
      whereClause.push('lf.centro_custo_id = ?');
      params.push(destino_id);
    }

    // 3. Trata Datas (Preset de Atalho ou Manual)
    let inicio = data_inicio;
    let fim = data_fim;

    if (periodo_preset) {
      const hoje = new Date();
      fim = hoje.toISOString().split('T')[0];

      let dInicio = new Date();
      if (periodo_preset === '7d') dInicio.setDate(hoje.getDate() - 7);
      else if (periodo_preset === '30d') dInicio.setDate(hoje.getDate() - 30);
      else if (periodo_preset === '6m') dInicio.setMonth(hoje.getMonth() - 6);
      else if (periodo_preset === '12m') dInicio.setMonth(hoje.getMonth() - 12);
      
      inicio = dInicio.toISOString().split('T')[0];
    }

    if (inicio && fim) {
      whereClause.push('lf.data_movimento BETWEEN ? AND ?');
      params.push(inicio, fim);
    }

    const whereString = whereClause.join(' AND ');

    // Query 1: Resumo Dinâmico do Período e Filtros Selecionados
    const sqlResumo = `
      SELECT 
        SUM(CASE WHEN lf.tipo = 'RECEITA' THEN lf.valor ELSE 0 END) AS total_receitas,
        SUM(CASE WHEN lf.tipo = 'DESPESA' THEN lf.valor ELSE 0 END) AS total_despesas,
        SUM(CASE WHEN lf.tipo = 'RECEITA' THEN lf.valor ELSE -lf.valor END) AS resultado_liquido,
        COUNT(*) as total_lancamentos
      FROM lancamentos_financeiros lf
      WHERE ${whereString}
    `;
    const [resumoRows] = await db.query(sqlResumo, params);

    // Query 2: Gráfico Histórico MENSAL — AGORA REAGE AOS FILTROS (Categoria / Destino)
    const sqlGrafico = `
      SELECT 
        DATE_FORMAT(lf.data_movimento, '%Y-%m') AS mes_ano,
        DATE_FORMAT(lf.data_movimento, '%m/%Y') AS mes_formatado,
        SUM(CASE WHEN lf.tipo = 'RECEITA' THEN lf.valor ELSE 0 END) AS receitas,
        SUM(CASE WHEN lf.tipo = 'DESPESA' THEN lf.valor ELSE 0 END) AS despesas,
        SUM(CASE WHEN lf.tipo = 'RECEITA' THEN lf.valor ELSE -lf.valor END) AS liquido
      FROM lancamentos_financeiros lf
      WHERE ${whereString}
      GROUP BY DATE_FORMAT(lf.data_movimento, '%Y-%m'), DATE_FORMAT(lf.data_movimento, '%m/%Y')
      ORDER BY mes_ano ASC
    `;
    const [graficoRows] = await db.query(sqlGrafico, params);

    // Cálculo das Médias com base nos dados filtrados do gráfico
    const qtdMeses = graficoRows.length || 1;
    const somaDespesas = graficoRows.reduce((acc, item) => acc + Number(item.despesas || 0), 0);
    const somaReceitas = graficoRows.reduce((acc, item) => acc + Number(item.receitas || 0), 0);

    // Query 3: Tabela Agrupada por Categoria
    const sqlCategorias = `
      SELECT 
        COALESCE(cat.nome, 'SEM CATEGORIA') AS categoria,
        lf.tipo,
        COUNT(*) AS qtd_lancamentos,
        SUM(lf.valor) AS valor_total_categoria
      FROM lancamentos_financeiros lf
      LEFT JOIN categorias_financeiras cat ON lf.categoria_id = cat.id
      WHERE ${whereString}
      GROUP BY cat.nome, lf.tipo
      ORDER BY valor_total_categoria DESC
    `;
    const [categoriasRows] = await db.query(sqlCategorias, params);

    res.json({
      resumoFiltrado: resumoRows[0] || {},
      mediaMensal: {
        despesas: somaDespesas / qtdMeses,
        receitas: somaReceitas / qtdMeses
      },
      dadosGrafico: graficoRows,
      tabelaCategorias: categoriasRows
    });

  } catch (err) {
    console.error('Erro ao gerar relatório financeiro:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório financeiro.' });
  }
});
// GET: Relatório Dinâmico de Faturas Pessoa Física (Para atender o componente RelatorioPF.jsx)
router.get('/faturas-pessoa-fisica/relatorio', async (req, res) => {
  try {
    const { 
      data_inicio, 
      data_fim, 
      periodo_preset, 
      banco, 
      favorecido, 
      solicitante, 
      conciliado,
      categoria // <-- 1. Captura o parâmetro de categoria enviado via query
    } = req.query;

    let whereClause = ['1=1'];
    let params = [];

    // 1. Filtros textuais e categóricos
    if (banco) {
      whereClause.push('f.banco = ?');
      params.push(banco);
    }

    if (favorecido) {
      whereClause.push('f.favorecido LIKE ?');
      params.push(`%${favorecido}%`);
    }

    if (solicitante) {
      whereClause.push('f.solicitante LIKE ?');
      params.push(`%${solicitante}%`);
    }

    // <-- Adicionado: Filtro dinâmico por Categoria
    if (categoria) {
      whereClause.push('f.categoria_id = ?');
      params.push(categoria);
    }

    if (conciliado === 'CONCILIADO') {
      whereClause.push('f.conciliado_em IS NOT NULL');
    } else if (conciliado === 'PENDENTE') {
      whereClause.push('f.conciliado_em IS NULL');
    }

    // 2. Trata Datas (Preset de Atalho ou Manual)
    let inicio = data_inicio;
    let fim = data_fim;

    if (periodo_preset) {
      const hoje = new Date();
      fim = hoje.toISOString().split('T')[0];

      let dInicio = new Date();
      if (periodo_preset === '7d') dInicio.setDate(hoje.getDate() - 7);
      else if (periodo_preset === '30d') dInicio.setDate(hoje.getDate() - 30);
      else if (periodo_preset === '6m') dInicio.setMonth(hoje.getMonth() - 6);
      else if (periodo_preset === '12m') dInicio.setMonth(hoje.getMonth() - 12);
      
      inicio = dInicio.toISOString().split('T')[0];
    }

    if (inicio && fim) {
      whereClause.push('f.data_fatura BETWEEN ? AND ?');
      params.push(inicio, fim);
    }

    const whereString = whereClause.join(' AND ');

    // Query 1: Cards e Resumo Consolidado
    const sqlResumo = `
      SELECT 
        SUM(f.valor) AS total_valor,
        SUM(CASE WHEN f.conciliado_em IS NOT NULL THEN f.valor ELSE 0 END) AS total_conciliado,
        SUM(CASE WHEN f.conciliado_em IS NULL THEN f.valor ELSE 0 END) AS total_pendente,
        SUM(CASE WHEN f.banco = 'BB' THEN f.valor ELSE 0 END) AS total_bb,
        SUM(CASE WHEN f.banco = 'SANTANDER' THEN f.valor ELSE 0 END) AS total_santander,
        COUNT(*) AS total_registros
      FROM faturas_pessoa_fisica f
      WHERE ${whereString}
    `;
    const [resumoRows] = await db.query(sqlResumo, params);

    // Query 2: Gráfico Histórico Mensal
    const sqlGrafico = `
      SELECT 
        DATE_FORMAT(f.data_fatura, '%Y-%m') AS mes_ano,
        DATE_FORMAT(f.data_fatura, '%m/%Y') AS mes_formatado,
        SUM(f.valor) AS total
      FROM faturas_pessoa_fisica f
      WHERE ${whereString}
      GROUP BY DATE_FORMAT(f.data_fatura, '%Y-%m'), DATE_FORMAT(f.data_fatura, '%m/%Y')
      ORDER BY mes_ano ASC
    `;
    const [graficoRows] = await db.query(sqlGrafico, params);

    // Média Mensal de Faturas
    const qtdMeses = graficoRows.length || 1;
    const somaTotal = graficoRows.reduce((acc, item) => acc + Number(item.total || 0), 0);

    // Query 3: Agrupamento por Solicitante
    const sqlSolicitantes = `
      SELECT 
        COALESCE(f.solicitante, 'NÃO INFORMADO') AS solicitante,
        COUNT(*) AS qtd_faturas,
        SUM(CASE WHEN f.banco = 'BB' THEN f.valor ELSE 0 END) AS total_bb,
        SUM(CASE WHEN f.banco = 'SANTANDER' THEN f.valor ELSE 0 END) AS total_santander,
        SUM(f.valor) AS total_geral
      FROM faturas_pessoa_fisica f
      WHERE ${whereString}
      GROUP BY f.solicitante
      ORDER BY total_geral DESC
    `;
    const [solicitantesRows] = await db.query(sqlSolicitantes, params);

    // Query 4 (NOVA): Agrupamento por Categoria
    const sqlCategorias = `
      SELECT 
        COALESCE(c.nome, 'NÃO CATEGORIZADO') AS categoria,
        COUNT(*) AS qtd_faturas,
        SUM(CASE WHEN f.banco = 'BB' THEN f.valor ELSE 0 END) AS total_bb,
        SUM(CASE WHEN f.banco = 'SANTANDER' THEN f.valor ELSE 0 END) AS total_santander,
        SUM(f.valor) AS total_geral
      FROM faturas_pessoa_fisica f
      LEFT JOIN categorias_financeiras c ON f.categoria_id = c.id
      WHERE ${whereString}
      GROUP BY c.id, c.nome
      ORDER BY total_geral DESC
    `;
    const [categoriasRows] = await db.query(sqlCategorias, params);

    res.json({
      resumoFiltrado: resumoRows[0] || {},
      mediaMensal: {
        faturas: somaTotal / qtdMeses
      },
      dadosGrafico: graficoRows,
      tabelaSolicitantes: solicitantesRows,
      tabelaCategorias: categoriasRows // <-- Retorna o novo agrupamento por categoria
    });

  } catch (err) {
    console.error('Erro ao gerar relatório de faturas:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório de faturas pessoa física.' });
  }
});
// ============================================================================
// ROTAS: FATURAS PESSOA FÍSICA (bb / santander)
// ============================================================================

// 1. GET: Listar todas as faturas (com JOIN para buscar o nome da categoria)
router.get('/faturas-pessoa-fisica', async (req, res) => {
  try {
    const { data_inicio, data_fim, banco, favorecido, solicitante, conciliado, categoria_id } = req.query;

    let whereClause = ['1=1'];
    let params = [];

    if (data_inicio && data_fim) {
      whereClause.push('f.data_fatura BETWEEN ? AND ?');
      params.push(data_inicio, data_fim);
    }

    if (banco) {
      whereClause.push('f.banco = ?');
      params.push(banco);
    }

    if (categoria_id) { // AJUSTE: Filtro por categoria
      whereClause.push('f.categoria_id = ?');
      params.push(categoria_id);
    }

    if (favorecido) {
      whereClause.push('f.favorecido LIKE ?');
      params.push(`%${favorecido}%`);
    }

    if (solicitante) {
      whereClause.push('f.solicitante LIKE ?');
      params.push(`%${solicitante}%`);
    }

    if (conciliado === 'CONCILIADO') {
      whereClause.push('f.conciliado_em IS NOT NULL');
    } else if (conciliado === 'PENDENTE') {
      whereClause.push('f.conciliado_em IS NULL');
    }

    // AJUSTE: Inclusão do LEFT JOIN com categorias_financeiras
    const sql = `
      SELECT 
        f.id, 
        f.data_fatura, 
        f.banco, 
        f.favorecido, 
        f.categoria_id,
        cat.nome AS categoria_nome,
        f.valor, 
        f.solicitante, 
        f.descricao_compra, 
        f.numero_nf, 
        f.conciliado_em, 
        f.criado_em
      FROM faturas_pessoa_fisica f
      LEFT JOIN categorias_financeiras cat ON f.categoria_id = cat.id
      WHERE ${whereClause.join(' AND ')}
      ORDER BY f.data_fatura DESC, f.id DESC
    `;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar faturas pessoa física:', err);
    res.status(500).json({ error: 'Erro ao buscar faturas pessoa física.' });
  }
});

// 2. GET: Buscar uma fatura por ID
router.get('/faturas-pessoa-fisica/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT f.*, cat.nome AS categoria_nome 
      FROM faturas_pessoa_fisica f
      LEFT JOIN categorias_financeiras cat ON f.categoria_id = cat.id
      WHERE f.id = ?
    `;
    const [rows] = await db.query(sql, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Fatura não encontrada.' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao buscar fatura por ID:', err);
    res.status(500).json({ error: 'Erro ao buscar detalhe da fatura.' });
  }
});

// 3. POST: Cadastrar uma nova fatura (com categoria_id)
router.post('/faturas-pessoa-fisica', async (req, res) => {
  try {
    const { 
      data_fatura, 
      banco, 
      favorecido, 
      categoria_id, // AJUSTE: Recebendo a categoria
      valor, 
      solicitante, 
      descricao_compra, 
      numero_nf, 
      conciliado_em 
    } = req.body;

    if (!data_fatura || !banco || !favorecido || valor === undefined || !solicitante) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios (data, banco, favorecido, valor e solicitante).' });
    }

    // AJUSTE: Incluída a coluna categoria_id no INSERT
    const sql = `
      INSERT INTO faturas_pessoa_fisica 
      (data_fatura, banco, favorecido, categoria_id, valor, solicitante, descricao_compra, numero_nf, conciliado_em) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(sql, [
      data_fatura,
      banco,
      favorecido,
      categoria_id || null, // AJUSTE
      valor,
      solicitante,
      descricao_compra || null,
      numero_nf || null,
      conciliado_em || null
    ]);

    res.status(201).json({
      success: true,
      message: 'Fatura registrada com sucesso!',
      id: result.insertId
    });
  } catch (err) {
    console.error('Erro ao salvar fatura:', err);
    res.status(500).json({ error: 'Erro ao salvar fatura no banco de dados.' });
  }
});

// 4. PUT: Atualizar fatura existente (com categoria_id)
router.put('/faturas-pessoa-fisica/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      data_fatura, 
      banco, 
      favorecido, 
      categoria_id, // AJUSTE: Recebendo a categoria
      valor, 
      solicitante, 
      descricao_compra, 
      numero_nf, 
      conciliado_em 
    } = req.body;

    if (!data_fatura || !banco || !favorecido || valor === undefined || !solicitante) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }

    // AJUSTE: Incluída a coluna categoria_id no UPDATE
    const sql = `
      UPDATE faturas_pessoa_fisica 
      SET 
        data_fatura = ?, 
        banco = ?, 
        favorecido = ?, 
        categoria_id = ?, 
        valor = ?, 
        solicitante = ?, 
        descricao_compra = ?, 
        numero_nf = ?, 
        conciliado_em = ?
      WHERE id = ?
    `;

    const [result] = await db.query(sql, [
      data_fatura,
      banco,
      favorecido,
      categoria_id || null, // AJUSTE
      valor,
      solicitante,
      descricao_compra || null,
      numero_nf || null,
      conciliado_em || null,
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Fatura não encontrada.' });
    }

    res.json({ success: true, message: 'Fatura atualizada com sucesso!' });
  } catch (err) {
    console.error('Erro ao atualizar fatura:', err);
    res.status(500).json({ error: 'Erro ao atualizar fatura no banco de dados.' });
  }
});

// 5. DELETE: Remover fatura por ID
router.delete('/faturas-pessoa-fisica/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM faturas_pessoa_fisica WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Fatura não encontrada.' });
    }

    res.json({ success: true, message: 'Fatura excluída com sucesso!' });
  } catch (err) {
    console.error('Erro ao excluir fatura:', err);
    res.status(500).json({ error: 'Erro ao excluir fatura do banco de dados.' });
  }
});


export default router;