import express from 'express';
import db from '../../db.js';

const router = express.Router();

const formatarData = (d) => {
  if (!d) return null;
  if (typeof d === 'string' && d.includes('T')) return d.split('T')[0];
  return d;
};

// ========================================================
// A. ROTAS DE VEÍCULOS / FROTA
// ========================================================

router.get('/veiculos', async (req, res) => {
  const sql = `
    SELECT 
      id, placa, marca, modelo, ano, tipo, titularidade, descricao, status, id_gestor, id_funcionario,
      km_atual, km_troca_oleo,
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
    return res.status(500).json({ error: `Erro no banco de dados: ${err.message}` });
  }
});

router.post('/veiculos', async (req, res) => {
  const { 
    placa, marca, modelo, ano, tipo, titularidade, 
    descricao, status, id_gestor, data_topografia, 
    emitido_crlv, km_atual, km_troca_oleo 
  } = req.body;

  if (!placa || !marca || !modelo || !ano || !tipo || !titularidade) {
    return res.status(400).json({ error: 'Os campos Placa, Marca, Modelo, Ano, Tipo e Titularidade são obrigatórios.' });
  }

  const gestorId = id_gestor && String(id_gestor).trim() !== '' ? parseInt(id_gestor, 10) : null;
  
  // Preserva os status de manutenção vindos do React; caso contrário, define EM USO ou DISPONÍVEL
  let statusFinal = status;
  if (status !== 'EM MANUTENÇÃO' && status !== 'MANUTENÇÃO COMPRESSOR') {
    statusFinal = gestorId ? 'EM USO' : 'DISPONÍVEL';
  }

  const sql = `
    INSERT INTO veiculos (
      placa, marca, modelo, ano, tipo, titularidade, 
      descricao, status, id_gestor, id_funcionario, 
      data_topografia, emitido_crlv, km_atual, km_troca_oleo
    ) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
  `;

  // Tratamento de conversão para evitar NaN no banco de dados
  const parsedKmAtual = km_atual !== null && km_atual !== undefined && km_atual !== '' && !isNaN(parseFloat(km_atual)) 
    ? parseFloat(km_atual) 
    : null;

  const parsedKmTrocaOleo = km_troca_oleo !== null && km_troca_oleo !== undefined && km_troca_oleo !== '' && !isNaN(parseFloat(km_troca_oleo)) 
    ? parseFloat(km_troca_oleo) 
    : null;

  try {
    const [result] = await db.query(sql, [
      String(placa).trim().toUpperCase(),
      String(marca).trim(),
      String(modelo).trim(),
      parseInt(ano, 10),
      String(tipo).trim(),
      String(titularidade).trim().toUpperCase(),
      descricao ? String(descricao).trim() : null,
      statusFinal,
      isNaN(gestorId) ? null : gestorId,
      formatarData(data_topografia),
      emitido_crlv === 'SIM' ? 'SIM' : 'NÃO',
      parsedKmAtual,
      parsedKmTrocaOleo
    ]);
    return res.status(201).json({ message: 'Veículo registrado com sucesso na frota!', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Já existe um veículo com esta placa!' });
    return res.status(500).json({ error: `Erro no banco de dados: ${err.message}` });
  }
});

router.put('/veiculos/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    placa, marca, modelo, ano, tipo, titularidade, 
    descricao, status, id_gestor, data_topografia, 
    emitido_crlv, km_atual, km_troca_oleo 
  } = req.body;

  if (!placa || !marca || !modelo || !ano || !tipo || !titularidade) {
    return res.status(400).json({ error: 'Os campos Placa, Marca, Modelo, Ano, Tipo e Titularidade são obrigatórios.' });
  }

  const gestorId = id_gestor && String(id_gestor).trim() !== '' ? parseInt(id_gestor, 10) : null;
  
  // Preserva os status de manutenção vindos do React; caso contrário, define EM USO ou DISPONÍVEL
  let statusFinal = status;
  if (status !== 'EM MANUTENÇÃO' && status !== 'MANUTENÇÃO COMPRESSOR') {
    statusFinal = gestorId ? 'EM USO' : 'DISPONÍVEL';
  }

  const sql = `
    UPDATE veiculos 
    SET 
      placa = ?, marca = ?, modelo = ?, ano = ?, tipo = ?, 
      titularidade = ?, descricao = ?, status = ?, id_gestor = ?, 
      data_topografia = ?, emitido_crlv = ?, km_atual = ?, km_troca_oleo = ?
    WHERE id = ?
  `;

  // Tratamento de conversão para evitar NaN no banco de dados
  const parsedKmAtual = km_atual !== null && km_atual !== undefined && km_atual !== '' && !isNaN(parseFloat(km_atual)) 
    ? parseFloat(km_atual) 
    : null;

  const parsedKmTrocaOleo = km_troca_oleo !== null && km_troca_oleo !== undefined && km_troca_oleo !== '' && !isNaN(parseFloat(km_troca_oleo)) 
    ? parseFloat(km_troca_oleo) 
    : null;

  try {
    const [result] = await db.query(sql, [
      String(placa).trim().toUpperCase(), 
      String(marca).trim(), 
      String(modelo).trim(), 
      parseInt(ano, 10),
      String(tipo).trim(), 
      String(titularidade).trim().toUpperCase(), 
      descricao ? String(descricao).trim() : null,
      statusFinal, 
      isNaN(gestorId) ? null : gestorId, 
      formatarData(data_topografia), 
      emitido_crlv === 'SIM' ? 'SIM' : 'NÃO', 
      parsedKmAtual,
      parsedKmTrocaOleo,
      id
    ]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Veículo não encontrado.' });
    return res.json({ message: 'Veículo atualizado com sucesso!' });
  } catch (err) {
    return res.status(500).json({ error: `Erro no banco de dados: ${err.message}` });
  }
});

router.delete('/veiculos/:id', async (req, res) => {
  try {
    const [result] = await db.query(`DELETE FROM veiculos WHERE id = ?`, [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Veículo não encontrado.' });
    return res.json({ message: 'Veículo removido com sucesso!' });
  } catch (err) {
    return res.status(500).json({ error: `Erro no banco de dados: ${err.message}` });
  }
});

// ========================================================
// B. ROTAS DE MANUTENÇÃO
// ========================================================

router.get('/veiculos/manutencoes/todas', async (req, res) => {
  try {
    const sql = `
      SELECT 
        m.id, 
        m.id_veiculo, 
        v.placa AS placa_veiculo,
        v.marca,
        v.modelo,
        m.id_item_manutencao, 
        i.cod AS cod_item, 
        i.nome AS nome_item, 
        m.categoria, 
        m.numero_nf,
        m.quantidade,
        m.descricao, 
        m.custo, 
        m.status, 
        DATE_FORMAT(m.data_manutencao, '%Y-%m-%d') AS data_manutencao, 
        m.criado_em
      FROM manutencoes_veiculos m
      LEFT JOIN veiculos v ON m.id_veiculo = v.id
      LEFT JOIN itens_manutencao i ON m.id_item_manutencao = i.id
      ORDER BY m.data_manutencao DESC, m.id DESC
    `;
    const [rows] = await db.query(sql);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: `Erro ao carregar histórico geral: ${err.message}` });
  }
});

router.get('/veiculos/:id/manutencoes', async (req, res) => {
  try {
    const sql = `
      SELECT 
        m.id, 
        m.id_veiculo, 
        m.id_item_manutencao, 
        i.cod AS cod_item, 
        i.nome AS nome_item, 
        m.categoria, 
        m.numero_nf,
        m.quantidade,
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
    const [rows] = await db.query(sql, [req.params.id]);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar manutenções do veículo.' });
  }
});

router.post('/veiculos/manutencoes', async (req, res) => {
  const { id_veiculo, itens_com_custo, data_manutencao, numero_nf, descricao, status } = req.body;
  const listaItens = itens_com_custo || req.body.itens_manutencao;

  if (!id_veiculo || !listaItens || !Array.isArray(listaItens) || listaItens.length === 0 || !data_manutencao) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }

  try {
    const valoresInsercao = listaItens.map(item => [
      parseInt(id_veiculo, 10),
      parseInt(typeof item === 'object' ? item.id_item : item, 10),
      (typeof item === 'object' && item.categoria ? item.categoria : 'CORRETIVA').toUpperCase(),
      numero_nf ? String(numero_nf).trim() : null,
      typeof item === 'object' && item.quantidade ? parseInt(item.quantidade, 10) : 1,
      descricao ? String(descricao).trim() : null,
      typeof item === 'object' && item.custo ? parseFloat(item.custo) : 0.00,
      status || 'PENDENTE',
      formatarData(data_manutencao)
    ]);

    await db.query(`
      INSERT INTO manutencoes_veiculos 
        (id_veiculo, id_item_manutencao, categoria, numero_nf, quantidade, descricao, custo, status, data_manutencao)
      VALUES ?
    `, [valoresInsercao]);

    if (status !== 'CONCLUIDO') {
      await db.query(`UPDATE veiculos SET status = 'EM MANUTENÇÃO' WHERE id = ?`, [id_veiculo]);
    }

    return res.status(201).json({ message: 'Manutenção(ões) registrada(s) com sucesso!' });
  } catch (err) {
    return res.status(500).json({ error: `Erro ao registrar manutenção: ${err.message}` });
  }
});

router.put('/veiculos/manutencoes/:id', async (req, res) => {
  const { id } = req.params;
  const { id_veiculo, id_item_manutencao, categoria, numero_nf, quantidade, descricao, custo, status, data_manutencao } = req.body;

  if (!id_veiculo || !id_item_manutencao || !data_manutencao) {
    return res.status(400).json({ error: 'Veículo, Item e Data são obrigatórios.' });
  }

  const sql = `
    UPDATE manutencoes_veiculos
    SET 
      id_veiculo = ?,
      id_item_manutencao = ?,
      categoria = ?,
      numero_nf = ?,
      quantidade = ?,
      descricao = ?,
      custo = ?,
      status = ?,
      data_manutencao = ?
    WHERE id = ?
  `;

  try {
    const [result] = await db.query(sql, [
      parseInt(id_veiculo, 10),
      parseInt(id_item_manutencao, 10),
      (categoria || 'CORRETIVA').toUpperCase(),
      numero_nf ? String(numero_nf).trim() : null,
      quantidade ? parseInt(quantidade, 10) : 1,
      descricao ? String(descricao).trim() : null,
      custo ? parseFloat(custo) : 0.00,
      status || 'PENDENTE',
      formatarData(data_manutencao),
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Registro de manutenção não encontrado.' });
    }

    return res.json({ message: 'Manutenção atualizada com sucesso!' });
  } catch (err) {
    return res.status(500).json({ error: `Erro ao atualizar manutenção: ${err.message}` });
  }
});

router.delete('/veiculos/manutencoes/:id', async (req, res) => {
  try {
    const [result] = await db.query(`DELETE FROM manutencoes_veiculos WHERE id = ?`, [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Registro não encontrado.' });
    return res.json({ message: 'Manutenção removida com sucesso!' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao remover manutenção.' });
  }
});

// ========================================================
// C. ROTAS DE ITENS DE MANUTENÇÃO
// ========================================================

router.get('/veiculos/itens-manutencao', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT id, cod, nome, ativo FROM itens_manutencao WHERE ativo = TRUE ORDER BY cod ASC`);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar lista de itens.' });
  }
});

router.post('/veiculos/itens-manutencao', async (req, res) => {
  const { cod, nome } = req.body;
  if (!cod || !nome) return res.status(400).json({ error: 'Código e Nome são obrigatórios.' });

  try {
    const [result] = await db.query(`INSERT INTO itens_manutencao (cod, nome, ativo) VALUES (?, ?, TRUE)`, [String(cod).trim().toUpperCase(), String(nome).trim().toUpperCase()]);
    return res.status(201).json({ message: 'Item cadastrado com sucesso!', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Já existe um item com este código.' });
    return res.status(500).json({ error: 'Erro ao salvar item.' });
  }
});

router.put('/veiculos/itens-manutencao/:id', async (req, res) => {
  const { cod, nome, ativo } = req.body;
  if (!cod || !nome) return res.status(400).json({ error: 'Código e Nome são obrigatórios.' });

  try {
    const [result] = await db.query(`UPDATE itens_manutencao SET cod = ?, nome = ?, ativo = ? WHERE id = ?`, [
      String(cod).trim().toUpperCase(), String(nome).trim().toUpperCase(), ativo !== undefined ? Boolean(ativo) : true, req.params.id
    ]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Item não encontrado.' });
    return res.json({ message: 'Item atualizado com sucesso!' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao atualizar item.' });
  }
});

router.delete('/veiculos/itens-manutencao/:id', async (req, res) => {
  try {
    await db.query(`DELETE FROM itens_manutencao WHERE id = ?`, [req.params.id]);
    return res.json({ message: 'Item removido com sucesso!' });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      await db.query(`UPDATE itens_manutencao SET ativo = FALSE WHERE id = ?`, [req.params.id]);
      return res.json({ message: 'Item desativado pois possui histórico atrelado.' });
    }
    return res.status(500).json({ error: 'Erro ao remover item.' });
  }
});

export default router;