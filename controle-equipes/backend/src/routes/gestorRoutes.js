import express from 'express';
const router = express.Router();

// Caminho para a estrutura real do banco
import db from '../../db.js';


// ========================================================
// 2. GET: LISTAR OBRAS (ATIVAS E INATIVAS PARA GESTÃO)
// ========================================================
router.get('/gestor/obras-ativas', async (req, res) => {
  try {
    const { id, cargo, incluirInativas, tipo_obra } = req.query;

    if (!id) {
      return res.status(400).json({ error: "ID do usuário não foi fornecido." });
    }

    const cargoUpper = cargo ? String(cargo).toUpperCase() : '';
    const apenasAtivas = incluirInativas !== 'true';
    const params = [];

    let sql = '';

    if (cargoUpper === 'MASTER' || cargoUpper === 'RH') {
      sql = `SELECT * FROM obras WHERE 1=1`;
      if (apenasAtivas) sql += ` AND status = 'ATIVA'`;
    } 
    else if (cargoUpper === 'ENGENHARIA') {
      sql = `
        SELECT DISTINCT o.* 
        FROM obras o
        INNER JOIN engenharia_obras eo ON o.id = eo.id_obra
        WHERE eo.id_usuario = ?
      `;
      if (apenasAtivas) sql += ` AND o.status = 'ATIVA'`;
      params.push(Number(id));
    } 
    else {
      sql = `
        SELECT DISTINCT o.* 
        FROM obras o
        INNER JOIN gestor_obras go ON o.id = go.id_obra
        WHERE go.id_usuario = ?
      `;
      if (apenasAtivas) sql += ` AND o.status = 'ATIVA'`;
      params.push(Number(id));
    }

    if (tipo_obra && tipo_obra !== '' && tipo_obra !== 'TODOS') {
      const tiposArray = Array.isArray(tipo_obra) ? tipo_obra : String(tipo_obra).split(',');
      const placeholders = tiposArray.map(() => '?').join(',');
      
      const coluna = (cargoUpper === 'MASTER' || cargoUpper === 'RH') ? 'tipo_obra' : 'o.tipo_obra';
      sql += ` AND ${coluna} IN (${placeholders})`;
      params.push(...tiposArray);
    }

    const [resultados] = await db.execute(sql, params);
    res.json(resultados);

  } catch (error) {
    console.error("Erro na rota de obras ativas:", error);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// ========================================================
// 3. GET: LISTAR FUNCIONÁRIOS DISPONÍVEIS
// ========================================================
router.get('/gestor/funcionarios-disponiveis', async (req, res) => {
  const { id, cargo, data_diario, turno } = req.query;

  if (!id) {
    return res.status(400).json({ error: "ID do usuário não fornecido." });
  }

  try {
    let params = [];
    let filtroExclusaoAgendamento = "";

    if (data_diario && data_diario.trim() !== '') {
      let condicaoTurno = "";
      if (turno && turno.trim() !== '') {
        condicaoTurno = "AND UPPER(TRIM(turno)) = UPPER(TRIM(?))";
      }

      // Regra: Exclui da lista apenas o colaborador que possui registro ATIVO (liberado = 0/NULL e status != 'LIBERADO') na mesma data/turno.
      filtroExclusaoAgendamento = `
        AND f.id NOT IN (
          SELECT id_funcionario 
          FROM diario_efetivo 
          WHERE DATE(data_diario) = DATE(?) 
            ${condicaoTurno}
            AND (liberado IS NULL OR liberado = 0 OR liberado = false OR liberado = '0')
            AND UPPER(TRIM(COALESCE(status_presenca, ''))) != 'LIBERADO'
        )
      `;
      
      params.push(data_diario);
      if (turno && turno.trim() !== '') {
        params.push(turno);
      }
    }

    const cargoUpper = cargo ? String(cargo).toUpperCase() : '';
    let sql;

    if (['MASTER', 'RH', 'ADMIN', 'ENGENHARIA'].includes(cargoUpper)) {
      sql = `
        SELECT id, matricula, nome, cargo, ativo 
        FROM funcionarios f
        WHERE UPPER(TRIM(ativo)) IN ('ATIVO', 'INTEGRAÇÃO PENDENTE')
        ${filtroExclusaoAgendamento}
        ORDER BY nome ASC
      `;
    } else {
      sql = `
        SELECT DISTINCT f.id, f.matricula, f.nome, f.cargo, f.ativo 
        FROM funcionarios f
        INNER JOIN gestor_funcionarios gf ON gf.id_funcionario = f.id
        WHERE gf.id_usuario = ? 
          AND UPPER(TRIM(f.ativo)) IN ('ATIVO', 'INTEGRAÇÃO PENDENTE')
          ${filtroExclusaoAgendamento}
        ORDER BY f.nome ASC
      `;
      params.unshift(parseInt(id));
    }

    const [funcionarios] = await db.execute(sql, params);

    res.json({
      funcionarios: funcionarios
    });

  } catch (err) {
    console.error("Erro ao buscar funcionários disponíveis:", err);
    res.status(500).json({ error: "Erro ao carregar colaboradores disponíveis." });
  }
});

// ========================================================
// 4. GET: RECUPERAR HISTÓRICO DO DIÁRIO DE EFETIVO
// ========================================================
router.get('/gestor/diario-efetivo', async (req, res) => {
  const { data_diario, id_obra } = req.query;
  
  if (!data_diario) {
    return res.status(400).json({ error: "O parâmetro data_diario é obrigatório." });
  }

  try {
    let sql;
    let params;

    if (id_obra && id_obra !== 'TODAS' && id_obra !== '') {
      sql = `
        SELECT 
          de.id, de.id_funcionario, de.id_obra, de.equipe, de.id_veiculo,
          de.nome, de.cargo, de.matricula, de.turno, de.status_presenca, de.observacao,
          de.liberado, de.data_hora_liberacao,
          o.nome_obra AS obra_nome
        FROM diario_efetivo de
        LEFT JOIN obras o ON de.id_obra = o.id
        WHERE de.data_diario = ? AND de.id_obra = ?
        ORDER BY de.equipe ASC, de.nome ASC
      `;
      params = [data_diario, parseInt(id_obra)];
    } else {
      sql = `
        SELECT 
          de.id, de.id_funcionario, de.id_obra, de.equipe, de.id_veiculo,
          de.nome, de.cargo, de.matricula, de.turno, de.status_presenca, de.observacao,
          de.liberado, de.data_hora_liberacao,
          o.nome_obra AS obra_nome
        FROM diario_efetivo de
        LEFT JOIN obras o ON de.id_obra = o.id
        WHERE de.data_diario = ?
        ORDER BY de.equipe ASC, de.nome ASC
      `;
      params = [data_diario];
    }

    const [rows] = await db.execute(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao recuperar diário:", err);
    res.status(500).json({ error: "Erro ao buscar dados do diário." });
  }
});

// ========================================================
// 5. POST: SALVAR / ATUALIZAR APONTAMENTOS DE EFETIVO
// ========================================================
router.post('/gestor/diario-efetivo', async (req, res) => {
  const { data_diario, id_obra, equipe, turno } = req.body;
  const listaFuncionarios = req.body.funcionarios || req.body.efetivo || []; 

  if (!data_diario || !id_obra || !Array.isArray(listaFuncionarios)) {
    return res.status(400).json({ error: "Dados incompletos ou inválidos." });
  }

  const equipeTratada = equipe ? String(equipe).trim().toUpperCase() : null;
  const connection = await db.getConnection();

  try {
    if (equipeTratada) {
      const [rdoStatus] = await connection.execute(
        `SELECT status_rdo FROM controle_diarios_equipe 
         WHERE data_diario = ? AND id_obra = ? AND UPPER(TRIM(equipe)) = ?`,
        [data_diario, parseInt(id_obra), equipeTratada]
      );

      if (rdoStatus.length > 0 && rdoStatus[0].status_rdo === 'FINALIZADO') {
        connection.release();
        return res.status(403).json({ 
          error: `A equipe '${equipeTratada}' já teve o RDO finalizado nesta data e está travada para edições.` 
        });
      }
    }

    await connection.beginTransaction();

    let queryVeiculosAnteriores = "SELECT DISTINCT id_veiculo FROM diario_efetivo WHERE data_diario = ? AND id_obra = ? AND id_veiculo IS NOT NULL";
    let paramsVeiculosAnteriores = [data_diario, parseInt(id_obra)];

    if (equipeTratada) {
      queryVeiculosAnteriores += " AND UPPER(TRIM(equipe)) = ?";
      paramsVeiculosAnteriores.push(equipeTratada);
    }

    const [veiculosRemovidos] = await connection.execute(queryVeiculosAnteriores, paramsVeiculosAnteriores);

    // Remoção dos dados antigos da equipe e turno correspondente
    if (equipeTratada) {
      await connection.execute(
        "DELETE FROM diario_efetivo WHERE data_diario = ? AND id_obra = ? AND UPPER(TRIM(equipe)) = ? AND UPPER(TRIM(turno)) = ?", 
        [data_diario, parseInt(id_obra), equipeTratada, turno ? String(turno).trim().toUpperCase() : 'DIURNO']
      );
    } else {
      await connection.execute(
        "DELETE FROM diario_efetivo WHERE data_diario = ? AND id_obra = ?", 
        [data_diario, parseInt(id_obra)]
      );
    }
    
    const veiculosAlocadosAtualmente = new Set();

    if (listaFuncionarios.length > 0) {
      const valoresParaInserir = [];
      const paramsInsercao = [];

      for (const f of listaFuncionarios) {
        const idFuncionario = parseInt(f.id_funcionario);
        const nomeFuncionario = f.nome ? String(f.nome).trim() : null;

        if (!idFuncionario || !nomeFuncionario) continue; 

        let statusCru = f.status_presenca ? String(f.status_presenca).trim().toUpperCase() : 'ALOCADO';
        const equipeFuncionario = f.equipe ? String(f.equipe).trim().toUpperCase() : (equipeTratada || 'GERAL');
        const idVeiculoValido = f.id_veiculo ? parseInt(f.id_veiculo) : null;

        if (idVeiculoValido) {
          veiculosAlocadosAtualmente.add(idVeiculoValido);
        }

        // Adicionando liberado e data_hora_liberacao
        valoresParaInserir.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        paramsInsercao.push(
          data_diario,
          parseInt(id_obra),
          idFuncionario,
          f.id_gestor ? parseInt(f.id_gestor) : null,
          nomeFuncionario,
          f.cargo ? String(f.cargo) : null,
          f.matricula ? String(f.matricula) : null,
          f.turno || turno || 'DIURNO', 
          statusCru, 
          f.observacao && f.observacao.trim() !== '' ? String(f.observacao) : null,
          equipeFuncionario,
          idVeiculoValido,
          f.liberado ? 1 : 0,
          f.data_hora_liberacao || null
        );
      }

      if (valoresParaInserir.length > 0) {
        const sqlInsert = `
          INSERT INTO diario_efetivo 
          (data_diario, id_obra, id_funcionario, id_gestor, nome, cargo, matricula, turno, status_presenca, observacao, equipe, id_veiculo, liberado, data_hora_liberacao) 
          VALUES ${valoresParaInserir.join(', ')}
        `;
        await connection.execute(sqlInsert, paramsInsercao);
      }
    }

    for (const row of veiculosRemovidos) {
      const idVeicAntigo = row.id_veiculo;
      if (idVeicAntigo && !veiculosAlocadosAtualmente.has(idVeicAntigo)) {
        const [outroUso] = await connection.execute(
          "SELECT id FROM diario_efetivo WHERE id_veiculo = ? AND data_diario = ?",
          [idVeicAntigo, data_diario]
        );

        if (outroUso.length === 0) {
          await connection.execute(
            "UPDATE veiculos SET status = 'DISPONÍVEL' WHERE id = ?",
            [idVeicAntigo]
          );
        }
      }
    }

    await connection.commit();
    res.status(200).json({ success: true, message: "Efetivo e veículos salvos com sucesso!" });
  } catch (err) {
    await connection.rollback();
    console.error("Erro na transação:", err);
    res.status(500).json({ error: "Falha ao persistir diário." });
  } finally {
    connection.release();
  }
});

// ========================================================
// 6. POST: SALVAR DIÁRIO TÉCNICO COMPLETO
// ========================================================
router.post('/gestor/salvar-diario-completo', async (req, res) => {
  const { 
    data_diario, 
    id_obra, 
    id_gestor, 
    equipe, 
    efetivo_confirmado, 
    atividades_tachas, 
    materials_apontados, 
    observacoes,
    status,
    liberar_equipe 
  } = req.body;

  if (!data_diario || !id_obra || !id_gestor || !equipe) {
    return res.status(400).json({ mensagem: "Dados obrigatórios ausentes para salvar o diário." });
  }

  const gestorIdValido = parseInt(id_gestor) || null;
  const obraIdValida = parseInt(id_obra) || null;
  const equipeMaiuscula = String(equipe).trim().toUpperCase();
  const statusTratadoDiario = status && String(status).trim() !== '' ? String(status).trim().toUpperCase() : 'SALVO';

  const estaLiberado = liberar_equipe ? 1 : 0;
  const dataHoraLiberacao = liberar_equipe ? new Date() : null;

  if (!gestorIdValido || !obraIdValida) {
    return res.status(400).json({ mensagem: "IDs de obra ou gestor são inválidos." });
  }

  const connection = await db.getConnection();

  try {
    const [statusAtual] = await connection.execute(
      `SELECT status_rdo FROM controle_diarios_equipe 
       WHERE data_diario = ? AND id_obra = ? AND UPPER(TRIM(equipe)) = ?`,
      [data_diario, obraIdValida, equipeMaiuscula]
    );
/*
    if (statusAtual.length > 0 && statusAtual[0].status_rdo === 'FINALIZADO') {
      connection.release();
      return res.status(403).json({ 
        mensagem: `O RDO da equipe '${equipeMaiuscula}' já foi finalizado e está travado para alterações.` 
      });
    }*/

    await connection.beginTransaction();
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    const [existenteMestre] = await connection.execute(
      'SELECT id FROM diario_obra WHERE id_obra = ? AND data_diario = ? AND UPPER(TRIM(equipe)) = ?',
      [obraIdValida, data_diario, equipeMaiuscula]
    );

    let diarioId;
    if (existenteMestre.length > 0) {
      diarioId = existenteMestre[0].id;
      await connection.execute(
        'UPDATE diario_obra SET observacoes = ?, id_gestor = ?, status = ? WHERE id = ?',
        [observacoes || null, gestorIdValido, statusTratadoDiario, diarioId]
      );
    } else {
      const [resultadoInsereMestre] = await connection.execute(
        'INSERT INTO diario_obra (id_obra, data_diario, observacoes, id_gestor, equipe, status) VALUES (?, ?, ?, ?, ?, ?)',
        [obraIdValida, data_diario, observacoes || null, gestorIdValido, equipeMaiuscula, statusTratadoDiario]
      );
      diarioId = resultadoInsereMestre.insertId;
    }

    const [veiculosAtuais] = await connection.execute(
      'SELECT id_funcionario, id_veiculo FROM diario_efetivo WHERE id_obra = ? AND data_diario = ? AND UPPER(TRIM(equipe)) = ?',
      [obraIdValida, data_diario, equipeMaiuscula]
    );
    const mapaVeiculos = new Map(veiculosAtuais.map(v => [v.id_funcionario, v.id_veiculo]));

    await connection.execute('DELETE FROM diario_efetivo_confirmado WHERE id_diario = ?', [diarioId]);
    await connection.execute(
      'DELETE FROM diario_efetivo WHERE id_obra = ? AND data_diario = ? AND UPPER(TRIM(equipe)) = ?', 
      [obraIdValida, data_diario, equipeMaiuscula]
    );

    if (efetivo_confirmado && efetivo_confirmado.length > 0) {
      const sqlConfirmado = `
        INSERT INTO diario_efetivo_confirmado 
        (id_diario, id_funcionario, status_presenca, horas_trabalhadas, equipe, data_diario, id_obra) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      const sqlDiarioEfetivo = `
        INSERT INTO diario_efetivo 
        (nome, data_diario, id_obra, id_funcionario, cargo, matricula, turno, status_presenca, observacao, equipe, id_gestor, id_veiculo, liberado, data_hora_liberacao) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      for (const f of efetivo_confirmado) {
        if (!f.id_funcionario) continue;
        const fid = parseInt(f.id_funcionario);
        
        let statusTratado = f.status_presenca ? String(f.status_presenca).trim().toUpperCase() : 'ALOCADO';
        if (statusTratado === 'FERIAS') statusTratado = 'FÉRIAS';
        if (statusTratado === 'INTEGRACAO') statusTratado = 'INTEGRAÇÃO';

        const idVeiculoPreservado = f.id_veiculo ? parseInt(f.id_veiculo) : (mapaVeiculos.get(fid) || null);

        await connection.execute(sqlConfirmado, [
          diarioId, 
          fid, 
          statusTratado, 
          0, 
          equipeMaiuscula, 
          data_diario, 
          obraIdValida
        ]);
        
        await connection.execute(sqlDiarioEfetivo, [
          f.nome || 'Não Informado',
          data_diario,
          obraIdValida,
          fid,
          f.cargo || null,
          f.matricula || null,
          f.turno || 'DIURNO',
          statusTratado,
          f.observacao || null,
          equipeMaiuscula,
          gestorIdValido,
          idVeiculoPreservado,
          estaLiberado,
          dataHoraLiberacao
        ]);
      }
    }

    await connection.execute('DELETE FROM diario_atividades WHERE id_diario = ?', [diarioId]);
    if (atividades_tachas && atividades_tachas.length > 0) {
      const sqlAtividade = `INSERT INTO diario_atividades (id_diario, tipo_servico, quantidade) VALUES (?, ?, ?)`;
      for (const l of atividades_tachas) {
        const nomeServico = l.tipo_servico || l.tipoServico || l.servico || l.atividade;
        if (!nomeServico) continue;
        
        await connection.execute(sqlAtividade, [
          diarioId, 
          String(nomeServico).trim(), 
          parseFloat(l.quantidade) || 0.00
        ]);
      }
    }

    await connection.execute('DELETE FROM diario_materiais_apontados WHERE id_diario = ?', [diarioId]);
    if (materials_apontados && materials_apontados.length > 0) {
      const sqlMaterial = `INSERT INTO diario_materiais_apontados (id_diario, material_nome, quantidade) VALUES (?, ?, ?)`;
      for (const m of materials_apontados) {
        const materialNome = m.material || m.nome;
        if (!materialNome) continue; 
        
        await connection.execute(sqlMaterial, [
          diarioId, 
          String(materialNome).trim(), 
          parseFloat(m.quantidade) || 0.00
        ]);
      }
    }

    await connection.execute(
      `INSERT INTO controle_diarios_equipe (data_diario, id_obra, equipe, status_rdo) 
       VALUES (?, ?, ?, 'FINALIZADO') 
       ON DUPLICATE KEY UPDATE status_rdo = 'FINALIZADO'`,
      [data_diario, obraIdValida, equipeMaiuscula]
    );

    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    await connection.commit();

    return res.status(200).json({ 
      success: true, 
      message: `RDO da equipe '${equipeMaiuscula}' salvo com sucesso!` 
    });

  } catch (err) {
    try { await connection.execute('SET FOREIGN_KEY_CHECKS = 1'); } catch(e){}
    await connection.rollback();
    
    console.error("❌ ERRO NO SALVAMENTO:", err);
    return res.status(500).json({ 
      mensagem: "Erro interno no servidor ao salvar o RDO.", 
      detalhes: err.message 
    });
  } finally {
    connection.release();
  }
});

// ========================================================
// 6-B. GET: RECUPERAR DIÁRIO TÉCNICO COMPLETO (POR EQUIPE)
// ========================================================
router.get('/gestor/salvar-diario-completo', async (req, res) => {
  const { data_diario, id_obra, equipe } = req.query;

  if (!data_diario || !id_obra || !equipe) {
    return res.status(400).json({ error: "Parâmetros ausentes (data_diario, id_obra e equipe são obrigatórios)." });
  }

  const equipeMaiusculaBusca = String(equipe).trim().toUpperCase();

  try {
    // Incluído o campo 'status' para retornar a situação do diário (Ex: Normal, Choveu, etc.)
    const sqlMestre = `
      SELECT id, status, observacoes, id_gestor 
      FROM diario_obra 
      WHERE id_obra = ? AND data_diario = ? AND equipe = ?
    `;
    const [mestreRows] = await db.execute(sqlMestre, [parseInt(id_obra), data_diario, equipeMaiusculaBusca]);

    if (mestreRows.length === 0) {
      return res.json({ existe: false, mensagem: "Nenhum diário técnico encontrado para esta equipe nesta data." });
    }

    const diarioId = mestreRows[0].id;

    // Substitua o bloco sqlEfetivo antigo por este corrigido:
    const sqlEfetivo = `
      SELECT 
        dec.id_funcionario,
        dec.status_presenca,
        dec.horas_trabalhadas,
        dec.equipe,
        dec.data_diario,
        dec.id_obra,
        f.nome,
        f.matricula,
        f.cargo,
        de.id_veiculo,         
        v.modelo AS modelo_veiculo, 
        v.placa AS placa_veiculo    
      FROM diario_efetivo_confirmado dec
      INNER JOIN funcionarios f ON dec.id_funcionario = f.id
      LEFT JOIN diario_efetivo de ON de.id_funcionario = dec.id_funcionario 
        AND de.data_diario = dec.data_diario 
        AND de.id_obra = dec.id_obra
      LEFT JOIN veiculos v ON de.id_veiculo = v.id
      WHERE dec.id_diario = ?
      ORDER BY f.nome ASC
    `;
    const [efetivoRows] = await db.execute(sqlEfetivo, [diarioId]);

    const sqlAtividades = `
      SELECT tipo_servico as tipoServico, quantidade 
      FROM diario_atividades 
      WHERE id_diario = ?
    `;
    const [atividadesRows] = await db.execute(sqlAtividades, [diarioId]);

    const sqlMateriais = `
      SELECT material_nome as material, quantidade 
      FROM diario_materiais_apontados 
      WHERE id_diario = ?
    `;
    const [materiaisRows] = await db.execute(sqlMateriais, [diarioId]);

    res.json({
      existe: true,
      data_diario,
      id_obra: parseInt(id_obra),
      id_gestor: mestreRows[0].id_gestor,
      equipe: equipeMaiusculaBusca,
      status: mestreRows[0].status || "Normal",
      observacoes: mestreRows[0].observacoes || "",
      efetivo_confirmado: efetivoRows, 
      atividades_tachas: atividadesRows,
      materials_apontados: materiaisRows
    });

  } catch (err) {
    console.error("Erro ao recuperar diário completo por equipe:", err);
    res.status(500).json({ error: "Erro interno ao buscar diário completo." });
  }
});

// ========================================================
// 13. PUT: ATUALIZAR STATUS DE PRESENÇA DIRETO (GESTOR)
// ========================================================
router.put('/gestor/diario-efetivo/status', async (req, res) => {
  const { id_lancamento, status_presenca } = req.body;

  if (!id_lancamento || !status_presenca) {
    return res.status(400).json({ error: "Lançamento e Status são obrigatórios." });
  }

  try {
    const sql = "UPDATE diario_efetivo SET status_presenca = ? WHERE id = ?";
    await db.execute(sql, [String(status_presenca).toUpperCase(), parseInt(id_lancamento)]);
    res.json({ success: true, message: "Status alterado com sucesso." });
  } catch (err) {
    console.error("Erro ao alterar status:", err);
    res.status(500).json({ error: "Erro interno ao alterar o status do colaborador." });
  }
});

// ========================================================
// 14. GET: LISTAR GESTORES (PARA REMANEJAMENTO)
// ========================================================
router.get('/gestor/lista-remanejamento-gestores', async (req, res) => {
  try {
    const sql = "SELECT id, nome FROM usuarios_sistema WHERE cargo = 'GESTOR' ORDER BY nome ASC";
    const [rows] = await db.execute(sql);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar gestores." });
  }
});

// ========================================================
// 15. GET: LISTAR OBRAS DE UM GESTOR ESPECÍFICO
// ========================================================
router.get('/gestor/lista-remanejamento-obras', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "ID do gestor é obrigatório." });
  try {
    const sql = `
      SELECT o.id, o.codigo_obra, o.nome_obra FROM gestor_obras go
      INNER JOIN obras o ON go.id_obra = o.id
      WHERE go.id_usuario = ? AND o.status = 'ATIVA' ORDER BY o.nome_obra ASC
    `;
    const [rows] = await db.execute(sql, [parseInt(id)]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao carregar obras." });
  }
});

// ========================================================
// 16. PUT: REMANEJAR FUNCIONÁRIO ENTRE OBRAS
// ========================================================
router.put('/gestor/remanezar-funcionario', async (req, res) => {
  const { 
    id_lancamento, 
    id_funcionario, 
    id_obra_destino, 
    data_diario,
    id_usuario_alteracao, 
    id_gestor_destino     
  } = req.body;

  if (!id_lancamento || !id_funcionario || !id_obra_destino || !data_diario || !id_usuario_alteracao || !id_gestor_destino) {
    return res.status(400).json({ error: "Dados para remanejamento ou auditoria incompletos." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [funcData] = await connection.execute("SELECT nome, cargo, matricula FROM funcionarios WHERE id = ?", [parseInt(id_funcionario)]);
    if (funcData.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Funcionário não encontrado." });
    }

    const { nome, cargo, matricula } = funcData[0];

    await connection.execute("DELETE FROM diario_efetivo WHERE id = ?", [parseInt(id_lancamento)]);

    const sqlInsertNovoAgendamento = `
      INSERT INTO diario_efetivo (
        data_diario, id_obra, id_funcionario, id_gestor, nome, cargo, matricula, turno, status_presenca, observacao
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await connection.execute(sqlInsertNovoAgendamento, [
      data_diario, 
      parseInt(id_obra_destino), 
      parseInt(id_funcionario), 
      parseInt(id_gestor_destino), 
      nome, 
      cargo, 
      matricula, 
      'DIURNO', 
      'AGENDADO', 
      'Remanejado de outra obra'
    ]);

    await connection.execute("DELETE FROM gestor_funcionarios WHERE id_funcionario = ?", [parseInt(id_funcionario)]);
    await connection.execute("INSERT INTO gestor_funcionarios (id_usuario, id_funcionario) VALUES (?, ?)", [parseInt(id_gestor_destino), parseInt(id_funcionario)]);

    await connection.commit();
    res.json({ success: true, message: "Funcionário remanejado com sucesso!" });

  } catch (err) {
    await connection.rollback();
    console.error("Erro no remanejamento:", err);
    res.status(500).json({ error: "Erro interno ao remanejar funcionário." });
  } finally {
    connection.release();
  }
});

// ========================================================
// 16-B. POST: REMANEZAR APENAS PARA O GESTOR
// ========================================================
router.post('/gestor/remanezar-funcionario-vincular', async (req, res) => {
  const { 
    id_usuario, 
    id_funcionario, 
    id_obra, 
    data_inicio, 
    id_usuario_alteracao 
  } = req.body;

  if (!id_usuario || !id_funcionario) {
    return res.status(400).json({ error: "Dados obrigatórios ausentes para o remanejamento." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      "DELETE FROM gestor_funcionarios WHERE id_funcionario = ?", 
      [parseInt(id_funcionario)]
    );

    const sqlInsert = `
      INSERT INTO gestor_funcionarios 
      (id_usuario, id_funcionario, id_obra, data_inicio, id_usuario_alteracao) 
      VALUES (?, ?, ?, ?, ?)
    `;

    await connection.execute(sqlInsert, [
      parseInt(id_usuario),
      parseInt(id_funcionario),
      id_obra ? parseInt(id_obra) : null,
      data_inicio || new Date().toISOString().split('T')[0],
      id_usuario_alteracao ? parseInt(id_usuario_alteracao) : null
    ]);

    if (data_inicio) {
      await connection.execute(
        "DELETE FROM diario_efetivo WHERE id_funcionario = ? AND data_diario = ?",
        [parseInt(id_funcionario), data_inicio]
      );
    }

    await connection.commit();
    res.status(200).json({ success: true, message: "Funcionário remanejado com sucesso!" });

  } catch (err) {
    await connection.rollback();
    console.error("Erro ao inserir em gestor_funcionarios:", err);
    res.status(500).json({ error: "Erro interno no servidor ao processar o vínculo do gestor." });
  } finally {
    connection.release();
  }
});

// ========================================================
// 17. GET: HISTÓRICO DE DIÁRIOS (PRODUÇÃO + MATERIAIS)
// ========================================================
router.get('/gestor/historico-diarios', async (req, res) => {
  try {
    const { 
      id, 
      cargo, 
      id_obra, 
      tipo_obra, 
      data_inicio, 
      data_fim, 
      status_rdo, 
      id_gestor_filtro 
    } = req.query;

    if (!id) {
      return res.status(400).json({ error: "ID numérico do usuário não foi fornecido." });
    }

    const cargoUpper = cargo ? String(cargo).toUpperCase() : '';
    const isMaster = cargoUpper === 'MASTER' || cargoUpper === 'ADMIN' || cargoUpper === 'RH';

    let sql = `
      SELECT
        r.data_diario,
        r.id_obra,
        r.equipe, 
        o.nome_obra,
        o.codigo_obra,
        u.nome AS nome_gestor,
        IFNULL(c.status_rdo, 'PENDENTE') AS status_rdo,
        COUNT(DISTINCT r.id_funcionario) AS total_efetivo,
        GROUP_CONCAT(DISTINCT r.nome ORDER BY r.nome SEPARATOR ', ') AS nomes_efetivo,
        IFNULL(do.observacoes, '') AS observacoes,
        (
          SELECT GROUP_CONCAT(CONCAT(sub_da.tipo_servico, ': ', sub_da.quantidade) SEPARATOR '\n')
          FROM diario_atividades sub_da
          WHERE sub_da.id_diario = do.id
        ) AS servicos_resumo,
        (
          SELECT IFNULL(SUM(sub_da.quantidade), 0)
          FROM diario_atividades sub_da
          WHERE sub_da.id_diario = do.id
        ) AS total_quantidade_produzida,
        (
          SELECT GROUP_CONCAT(CONCAT(dma.material_nome, ': ', dma.quantidade) SEPARATOR '\n')
          FROM diario_materiais_apontados dma
          WHERE dma.id_diario = do.id
        ) AS materiais_resumo
      FROM diario_efetivo r
      INNER JOIN obras o ON r.id_obra = o.id
      LEFT JOIN diario_obra do 
             ON do.id_obra = r.id_obra 
            AND do.data_diario = r.data_diario 
            AND UPPER(TRIM(do.equipe)) = UPPER(TRIM(r.equipe))
      LEFT JOIN usuarios_sistema u 
             ON u.id = COALESCE(do.id_gestor, r.id_gestor)
      LEFT JOIN controle_diarios_equipe c 
             ON c.data_diario = r.data_diario 
            AND c.id_obra = r.id_obra 
            AND UPPER(TRIM(c.equipe)) = UPPER(TRIM(r.equipe))
      WHERE 1=1
    `;

    const params = [];

    if (!isMaster) {
      if (cargoUpper === 'ENGENHARIA') {
        sql += ` AND r.id_obra IN (SELECT id_obra FROM engenharia_obras WHERE id_usuario = ?) `;
        params.push(Number(id));
      } else if (data_inicio && data_fim) {
        sql += ` AND r.id_obra IN (SELECT id_obra FROM gestor_obras WHERE id_usuario = ?) `;
        params.push(Number(id));
      } else {
        sql += ` AND (do.id_gestor = ? OR r.id_gestor = ?) `;
        params.push(Number(id), Number(id));
      }
    } else {
      if (id_gestor_filtro && id_gestor_filtro !== '' && id_gestor_filtro !== 'TODOS') {
        sql += ` AND (do.id_gestor = ? OR r.id_gestor = ?) `;
        params.push(Number(id_gestor_filtro), Number(id_gestor_filtro));
      }
    }

    if (id_obra && id_obra !== '' && id_obra !== 'TODAS') {
      sql += ` AND r.id_obra = ? `;
      params.push(Number(id_obra));
    }

    if (tipo_obra && tipo_obra !== '' && tipo_obra !== 'TODOS') {
      const tiposArray = Array.isArray(tipo_obra) 
        ? tipo_obra 
        : String(tipo_obra).split(',').map(t => t.trim()).filter(Boolean);

      if (tiposArray.length > 0) {
        const placeholders = tiposArray.map(() => '?').join(',');
        sql += ` AND o.tipo_obra IN (${placeholders}) `;
        params.push(...tiposArray);
      }
    }

    if (data_inicio && data_fim) {
      sql += ` AND r.data_diario BETWEEN ? AND ? `;
      params.push(data_inicio, data_fim);
    }

    if (status_rdo && status_rdo !== '' && status_rdo !== 'TODOS') {
      if (status_rdo.toUpperCase() === 'PENDENTE') {
        sql += ` AND (c.status_rdo IS NULL OR UPPER(TRIM(c.status_rdo)) = 'PENDENTE') `;
      } else {
        sql += ` AND UPPER(TRIM(c.status_rdo)) = ? `;
        params.push(status_rdo.toUpperCase());
      }
    }

    sql += `
      GROUP BY 
        r.data_diario, 
        r.id_obra, 
        r.equipe, 
        o.nome_obra, 
        o.codigo_obra, 
        u.nome, 
        c.status_rdo, 
        do.observacoes, 
        do.id
      ORDER BY r.data_diario DESC, r.equipe ASC
    `;

    const [resultados] = await db.execute(sql, params);
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(resultados);

  } catch (error) {
    console.error("Erro na rota de histórico de diários:", error);
    res.status(500).json({ error: "Erro interno no servidor ao carregar histórico." });
  }
});

// ========================================================
// 18. GET: HISTÓRICO DE PRESENÇA CONSOLIDADO (UNIFICADO)
// ========================================================
router.get('/gestor/historico-presenca', async (req, res) => {
  const { id, cargo, id_obra, data_inicio, data_fim } = req.query;

  if (!id || !cargo) {
    return res.status(400).json({ error: "ID e Cargo do usuário são obrigatórios." });
  }

  try {
    let filtroCondicional = "";
    let params = [];

    if (cargo !== 'MASTER' && cargo !== 'RH') {
      filtroCondicional += ` AND (
        de.id_gestor = ? OR 
        de.id_obra IN (SELECT id_obra FROM gestor_obras WHERE id_usuario = ?)
      ) `;
      params.push(parseInt(id), parseInt(id));
    }

    if (id_obra && id_obra !== '' && id_obra !== 'TODAS') {
      filtroCondicional += ` AND de.id_obra = ? `;
      params.push(parseInt(id_obra));
    }
    if (data_inicio && data_inicio !== '') {
      filtroCondicional += ` AND de.data_diario >= ? `;
      params.push(data_inicio);
    }
    if (data_fim && data_fim !== '') {
      filtroCondicional += ` AND de.data_diario <= ? `;
      params.push(data_fim);
    }

    const sql = `
      SELECT 
        resumo_diario.id_funcionario,
        resumo_diario.nome_funcionario,
        resumo_diario.matricula,
        resumo_diario.cargo,
        SUM(CASE WHEN resumo_diario.status_final = 'ALOCADO' THEN 1 ELSE 0 END) AS total_alocado, 
        SUM(CASE WHEN resumo_diario.status_final = 'PRESENTE' THEN 1 ELSE 0 END) AS total_presente,
        SUM(CASE WHEN resumo_diario.status_final = 'FALTOU' THEN 1 ELSE 0 END) AS total_faltou,
        SUM(CASE WHEN resumo_diario.status_final = 'INTEGRAÇÃO' THEN 1 ELSE 0 END) AS total_integracao,
        SUM(CASE WHEN resumo_diario.status_final = 'FÉRIAS' THEN 1 ELSE 0 END) AS total_ferias,
        SUM(CASE WHEN resumo_diario.status_final = 'FOLGA' THEN 1 ELSE 0 END) AS total_folga,
        SUM(CASE WHEN resumo_diario.status_final NOT IN ('PRESENTE', 'FALTOU', 'INTEGRAÇÃO', 'FÉRIAS', 'FOLGA', 'ALOCADO') THEN 1 ELSE 0 END) AS total_outro 
      FROM (
        SELECT 
          de.id_funcionario,
          de.nome AS nome_funcionario,
          de.matricula,
          de.cargo,
          de.data_diario,
          MAX(de.status_presenca) AS status_final
        FROM diario_efetivo de
        WHERE 1=1 ${filtroCondicional}
        GROUP BY de.id_funcionario, de.nome, de.matricula, de.cargo, de.data_diario
      ) AS resumo_diario
      GROUP BY 
        resumo_diario.id_funcionario, 
        resumo_diario.nome_funcionario, 
        resumo_diario.matricula, 
        resumo_diario.cargo
      ORDER BY nome_funcionario ASC
    `;

    const [resultados] = await db.execute(sql, params);
    res.status(200).json(resultados);
  } catch (err) {
    console.error("Erro ao buscar histórico consolidado:", err);
    res.status(500).json({ error: "Erro interno ao buscar histórico de presença." });
  }
});

// ========================================================
// 19. GET: ROTA DE AUDITORIA ATUALIZADA
// ========================================================
router.get('/gestor/auditoria-ausencias', async (req, res) => {
  try {
    const { id, cargo, id_obra, data_inicio, data_fim } = req.query;

    if (!id || !data_inicio || !data_fim || !id_obra) {
      return res.status(400).json({ error: "Parâmetros de auditoria insuficientes." });
    }

    let sql = `
      SELECT data_diario, equipe, status_rdo
      FROM controle_diarios_equipe
      WHERE data_diario BETWEEN ? AND ? AND id_obra = ?
    `;
    const params = [data_inicio, data_fim, Number(id_obra)];

    if (cargo !== 'MASTER') {
      sql += ` AND id_obra IN (SELECT id_obra FROM gestor_obras WHERE id_usuario = ?)`;
      params.push(Number(id));
    }

    const [resultados] = await db.execute(sql, params);
    const estruturaPorData = {};

    resultados.forEach(linha => {
      const dataStr = typeof linha.data_diario === 'string' 
        ? linha.data_diario.substring(0, 10) 
        : linha.data_diario.toISOString().substring(0, 10);

      if (!estruturaPorData[dataStr]) {
        estruturaPorData[dataStr] = {
          data_diario: dataStr,
          equipes_alocadas_sem_rdo: [],
          equipes_fechadas_com_sucesso: []
        };
      }

      const nomeEquipe = String(linha.equipe).toUpperCase();

      if (linha.status_rdo === 'PENDENTE') {
        estruturaPorData[dataStr].equipes_alocadas_sem_rdo.push(nomeEquipe);
      } else {
        estruturaPorData[dataStr].equipes_fechadas_com_sucesso.push(nomeEquipe);
      }
    });

    res.json(Object.values(estruturaPorData));

  } catch (error) {
    console.error("Erro na rota dedicada de auditoria:", error);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// ========================================================
// INDICADORES E LISTAGEM CONSOLIDADA POR RDO (EQUIPES)
// ========================================================
router.get('/gestor/status-diarios-consolidado', async (req, res) => {
  const { id, cargo, id_obra } = req.query;

  if (!id || !cargo || !id_obra) {
    return res.status(400).json({
      error: "Parâmetros id, cargo e id_obra são obrigatórios."
    });
  }

  try {
    let filtroCondicional = " WHERE cde.id_obra = ? AND TRIM(UPPER(cde.equipe)) != 'FOLGUISTAS' ";
    let params = [parseInt(id_obra)];

    if (cargo !== 'MASTER') {
      filtroCondicional += " AND do.id_gestor = ? ";
      params.push(parseInt(id));
    }

    const queryIndicadores = `
      SELECT
        COUNT(cde.id) AS total_diarios,
        SUM(CASE WHEN TRIM(UPPER(do.status)) = 'CHOVEU' THEN 1 ELSE 0 END) AS dias_chuva,
        SUM(CASE WHEN TRIM(UPPER(do.status)) = 'SEM MATERIAL' THEN 1 ELSE 0 END) AS sem_material,
        SUM(CASE WHEN TRIM(UPPER(do.status)) = 'NORMAL' THEN 1 ELSE 0 END) AS dias_normais,
        SUM(CASE WHEN TRIM(UPPER(do.status)) = 'OUTROS' THEN 1 ELSE 0 END) AS outros
      FROM controle_diarios_equipe cde
      INNER JOIN diario_obra do ON cde.id_diario = do.id
      ${filtroCondicional};
    `;

    const queryTabela = `
      SELECT 
        cde.id, 
        cde.data_diario, 
        cde.equipe,
        do.status AS status_condicao
      FROM controle_diarios_equipe cde
      INNER JOIN diario_obra do ON cde.id_diario = do.id
      ${filtroCondicional}
      ORDER BY cde.data_diario DESC, cde.equipe ASC;
    `;

    const [dadosIndicadores] = await db.execute(queryIndicadores, params);
    const [dadosTabela] = await db.execute(queryTabela, params);

    const linha = (dadosIndicadores && dadosIndicadores.length > 0) ? dadosIndicadores[0] : null;

    res.status(200).json({
      indicators: {
        total_diarios: linha ? (Number(linha.total_diarios) || 0) : 0,
        dias_chuva: linha ? (Number(linha.dias_chuva) || 0) : 0,
        sem_material: linha ? (Number(linha.sem_material) || 0) : 0,
        dias_normais: linha ? (Number(linha.dias_normais) || 0) : 0,
        outros: linha ? (Number(linha.outros) || 0) : 0
      },
      listaDiarios: dadosTabela || []
    });

  } catch (err) {
    console.error("❌ Erro fatal na query consolidada de RDOs:", err);
    res.status(500).json({ error: "Erro interno no servidor ao computar os indicadores." });
  }
});

// ========================================================
// HISTÓRICO DE MATERIAIS
// ========================================================
router.get('/gestor/historico-materiais', async (req, res) => {
  try {
    const { id, cargo, id_obra, data_inicio, data_fim } = req.query;

    if (!id) {
      return res.status(400).json({ error: "ID numérico do usuário não foi fornecido." });
    }

    let sql = `
      SELECT 
        r.data_diario,
        r.id_obra,
        r.equipe,
        o.nome_obra,
        o.codigo_obra,
        COUNT(DISTINCT r.id_funcionario) AS total_efetivo,
        GROUP_CONCAT(DISTINCT r.nome ORDER BY r.nome SEPARATOR ', ') AS nomes_efetivo,
        IFNULL(do.observacoes, '') AS observacoes,
        do.id
      FROM diario_efetivo r
      INNER JOIN obras o ON r.id_obra = o.id
      LEFT JOIN diario_obra do ON do.id_obra = r.id_obra AND do.data_diario = r.data_diario AND do.equipe = r.equipe
      LEFT JOIN controle_diarios_equipe cde 
        ON cde.id_obra = r.id_obra 
        AND cde.data_diario = r.data_diario 
        AND UPPER(TRIM(cde.equipe)) = UPPER(TRIM(r.equipe))
      WHERE 1=1
        AND (cde.status_rdo IS NULL OR TRIM(UPPER(cde.status_rdo)) <> 'PENDENTE')
    `;

    const params = [];

    const cargoUpper = cargo ? String(cargo).toUpperCase() : '';

    if (cargoUpper !== 'MASTER' && cargoUpper !== 'RH') {
      if (cargoUpper === 'ENGENHARIA') {
        sql += ` AND r.id_obra IN (SELECT id_obra FROM engenharia_obras WHERE id_usuario = ?) `;
        params.push(Number(id));
      } else if (data_inicio && data_fim) {
        sql += ` AND r.id_obra IN (SELECT id_obra FROM gestor_obras WHERE id_usuario = ?) `;
        params.push(Number(id));
      } else {
        sql += ` AND (do.id_gestor = ? OR r.id_gestor = ?) `;
        params.push(Number(id), Number(id));
      }
    }

    if (id_obra && id_obra !== '' && id_obra !== 'TODAS') {
      sql += ` AND r.id_obra = ? `;
      params.push(Number(id_obra));
    }

    if (data_inicio && data_fim) {
      sql += ` AND r.data_diario BETWEEN ? AND ? `;
      params.push(data_inicio, data_fim);
    }

    sql += `
      GROUP BY r.data_diario, r.id_obra, r.equipe, o.nome_obra, o.codigo_obra, do.observacoes, do.id
      ORDER BY r.data_diario DESC, r.equipe ASC
    `;

    const [resultadosTabela] = await db.execute(sql, params);

    let sqlGrafico = `
      SELECT 
        dm.material_nome AS material,
        SUM(dm.quantidade) AS total_quantidade
      FROM diario_materiais_apontados dm
      INNER JOIN diario_obra do ON dm.id_diario = do.id
      WHERE do.id_obra = ?
    `;
    const paramsGrafico = [Number(id_obra)];

    if (data_inicio && data_fim) {
      sqlGrafico += ` AND do.data_diario BETWEEN ? AND ? `;
      paramsGrafico.push(data_inicio, data_fim);
    }

    sqlGrafico += `
      GROUP BY dm.material_nome
      ORDER BY total_quantidade DESC
    `;

    let resultadosGrafico = [];
    if (id_obra && id_obra !== 'TODAS') {
      const [dadosGrafico] = await db.execute(sqlGrafico, paramsGrafico);
      resultadosGrafico = dadosGrafico;
    }

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({
      lista: resultadosTabela,
      materials_grafico: resultadosGrafico
    });

  } catch (error) {
    console.error("❌ Erro na rota de histórico de materiais:", error);
    res.status(500).json({ error: "Erro interno no servidor ao processar histórico de materiais." });
  }
});

// ========================================================
// GET: LISTAR VEÍCULOS COM COLABORADORES E EQUIPES
// ========================================================
router.get('/gestor/veiculos', async (req, res) => {
  const { id, cargo, data_diario } = req.query;

  if (!id) {
    return res.status(400).json({ error: "ID do usuário não fornecido." });
  }

  try {
    let sql;
    let params = [];

    sql = `
      SELECT 
        v.id, 
        v.marca, 
        v.modelo, 
        v.placa, 
        v.ano, 
        v.status, 
        v.id_gestor, 
        v.tipo,
        COALESCE(v.id_funcionario, MAX(de.id_funcionario)) AS id_funcionario,
        COALESCE(v.id_funcionario, MAX(de.id_funcionario)) AS id_condutor,
        GROUP_CONCAT(DISTINCT de.equipe SEPARATOR ', ') AS equipe,
        GROUP_CONCAT(DISTINCT COALESCE(f.nome, de.nome) SEPARATOR ', ') AS nome_colaborador,
        GROUP_CONCAT(DISTINCT o.nome_obra SEPARATOR ', ') AS nome_obra
      FROM veiculos v
      LEFT JOIN funcionarios f ON v.id_funcionario = f.id
      LEFT JOIN diario_efetivo de ON v.id = de.id_veiculo ${data_diario ? 'AND de.data_diario = ?' : ''}
      LEFT JOIN obras o ON de.id_obra = o.id
      WHERE 1=1
    `;

    if (data_diario) {
      params.push(data_diario);
    }

    if (cargo !== 'MASTER') {
      sql += " AND (v.id_gestor = ? OR de.id_gestor = ?)";
      params.push(parseInt(id), parseInt(id));
    }

    sql += ` GROUP BY 
              v.id, 
              v.marca, 
              v.modelo, 
              v.placa, 
              v.ano, 
              v.status, 
              v.id_gestor, 
              v.tipo, 
              v.id_funcionario 
            ORDER BY v.marca ASC, v.modelo ASC`;

    const [results] = await db.execute(sql, params);
    return res.json(results);

  } catch (error) {
    console.error("Erro ao buscar veículos com status de equipe:", error);
    return res.status(500).json({ error: "Erro interno ao carregar veículos." });
  }
});

// ========================================================
// 20. PUT: ATUALIZAR STATUS DO VEÍCULO DIRETAMENTE
// ========================================================
router.put('/gestor/veiculos/status/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "O campo status é obrigatório." });
  }

  try {
    const sql = "UPDATE veiculos SET status = ? WHERE id = ?";
    await db.execute(sql, [String(status).trim().toUpperCase(), parseInt(id)]);
    
    res.json({ success: true, message: "Status do veículo atualizado com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar status do veículo no banco:", err);
    res.status(500).json({ error: "Erro interno no servidor ao salvar status do veículo." });
  }
});

// ========================================================
// 21. DELETE: EXCLUIR EQUIPE DO CONTROLE E DESVINCULAR INTEGRANTES
// ========================================================
router.delete('/gestor/equipe', async (req, res) => {
  const { nome_equipe, id_obra, data_diario } = req.query;

  if (!nome_equipe || !id_obra || !data_diario) {
    return res.status(400).json({ error: "Parâmetros ausentes." });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const equipeTratada = String(nome_equipe).trim().toUpperCase();
    const idObraNum = parseInt(id_obra);

    await connection.execute(
      "DELETE FROM diario_efetivo WHERE data_diario = ? AND id_obra = ? AND UPPER(TRIM(equipe)) = ?",
      [data_diario, idObraNum, equipeTratada]
    );

    await connection.execute(
      "DELETE FROM controle_diarios_equipe WHERE data_diario = ? AND id_obra = ? AND UPPER(TRIM(equipe)) = ?",
      [data_diario, idObraNum, equipeTratada]
    );

    await connection.execute(
      "DELETE FROM diario_obra WHERE data_diario = ? AND id_obra = ? AND UPPER(TRIM(equipe)) = ?",
      [data_diario, idObraNum, equipeTratada]
    );

    await connection.commit();
    res.status(200).json({ success: true, message: "Equipe e histórico de atividades excluídos com sucesso." });
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao deletar equipe:", err);
    res.status(500).json({ error: "Erro ao excluir equipe do banco de dados." });
  } finally {
    connection.release();
  }
});

// ========================================================
// 22. GET: RECUPERAR ÚLTIMO AGENDAMENTO REGISTRADO DA OBRA
// ========================================================
router.get('/gestor/obter-ultimo-agendamento', async (req, res) => {
  const { id_obra, data_atual } = req.query;

  if (!id_obra) {
    return res.status(400).json({ error: "O ID da obra é obrigatório." });
  }

  try {
    const [dataRows] = await db.execute(
      `SELECT MAX(data_diario) as ultima_data 
       FROM diario_efetivo 
       WHERE id_obra = ? ${data_atual ? 'AND data_diario < ?' : ''}`,
      data_atual ? [parseInt(id_obra), data_atual] : [parseInt(id_obra)]
    );

    const ultimaData = dataRows[0]?.ultima_data;

    if (!ultimaData) {
      return res.status(404).json({ error: "Nenhum agendamento anterior foi encontrado para esta obra." });
    }

    const [alocacoesAnteriores] = await db.execute(
      `SELECT id_funcionario, id_obra, id_gestor, nome, cargo, matricula, turno, status_presenca, observacao, equipe, id_veiculo
       FROM diario_efetivo
       WHERE id_obra = ? AND data_diario = ?
       ORDER BY equipe ASC, nome ASC`,
      [parseInt(id_obra), ultimaData]
    );

    res.json({
      data_origem: ultimaData,
      alocacoes: alocacoesAnteriores
    });

  } catch (err) {
    console.error("Erro ao buscar último agendamento:", err);
    res.status(500).json({ error: "Erro interno ao buscar histórico." });
  }
});

// ========================================================
// 23. GET: TIPOS DE OBRA
// ========================================================
router.get('/gestor/tipos-obra', async (req, res) => {
  try {
    const { id, cargo } = req.query;

    let sql = `
      SELECT DISTINCT tipo_obra 
      FROM obras 
      WHERE tipo_obra IS NOT NULL AND tipo_obra != ''
    `;
    let params = [];

    const cargoUpper = cargo ? String(cargo).toUpperCase() : '';
    if (cargoUpper !== 'MASTER' && cargoUpper !== 'RH' && cargoUpper !== 'ADMIN') {
      sql += ` AND id IN (SELECT id_obra FROM gestor_obras WHERE id_usuario = ?) `;
      params.push(parseInt(id));
    }

    sql += ` ORDER BY tipo_obra ASC`;

    const [linhas] = await db.execute(sql, params);
    const tipos = linhas.map(item => item.tipo_obra);

    return res.status(200).json(tipos);
  } catch (err) {
    console.error("Erro ao buscar tipos de obra:", err);
    return res.status(500).json({ error: "Erro interno ao buscar tipos de obra." });
  }
});

// ========================================================
// 24. GET: EQUIPES TRAVADAS (RDO FINALIZADO)
// ========================================================
router.get('/gestor/equipes-finalizadas', async (req, res) => {
  const { data_diario, id_obra } = req.query;

  if (!data_diario || !id_obra) {
    return res.status(400).json({ error: "Parâmetros obrigatórios ausentes." });
  }

  try {
    const sql = `
      SELECT DISTINCT UPPER(TRIM(equipe)) as equipe
      FROM controle_diarios_equipe
      WHERE data_diario = ? AND id_obra = ? AND status_rdo = 'FINALIZADO'
    `;
    const [rows] = await db.execute(sql, [data_diario, parseInt(id_obra)]);
    const equipesFinalizadas = rows.map(r => r.equipe);
    
    res.json(equipesFinalizadas);
  } catch (err) {
    console.error("Erro ao buscar equipes finalizadas:", err);
    res.status(500).json({ error: "Erro ao consultar status das equipes." });
  }
});

export default router;