import express from 'express';
const router = express.Router();

// Caminho para a estrutura real do banco de dados
import db from '../../db.js';

// =========================================================================
// 🟢 BLOCO IMUTÁVEL: ROTAS DE INFRAESTRUTURA, FILTROS E HISTÓRICOS (OK)
// =========================================================================

// 1. GET: LISTAR OBRAS VINCULADAS AO GESTOR LOGADO
router.get('/gestor/obras-ativas', async (req, res) => {
  try {
    const { id, cargo } = req.query; 

    if (!id) {
      return res.status(400).json({ error: "ID do usuário não foi fornecido." });
    }

    let sql = `SELECT * FROM obras WHERE status = 'ATIVA'`;
    const params = [];

    if (cargo !== 'MASTER') {
      sql = `
        SELECT o.* FROM obras o
        INNER JOIN gestor_obras go ON o.id = go.id_obra
        WHERE go.id_usuario = ? AND o.status = 'ATIVA'
      `;
      params.push(Number(id));
    }

    const [rows] = await db.execute(sql, params);
    return res.status(200).json(rows);
  } catch (error) {
    console.error("Erro ao listar obras ativas:", error);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// 2. GET: LISTAR VEÍCULOS DISPONÍVEIS PARA ALOCAÇÃO NA ESCALA
router.get('/gestor/veiculos-disponiveis', async (req, res) => {
  try {
    const query = "SELECT id, tag, modelo, placa, tipo FROM veiculos WHERE status = 'ATIVO' ORDER BY tag ASC";
    const [rows] = await db.execute(query);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Erro ao buscar veículos cadastrados:", error);
    res.status(500).json({ error: "Erro ao carregar frota corporativa." });
  }
});

// 3. GET: LISTAR GESTORES (PARA O MODAL DE REMANEJAMENTO EXTERNO)
router.get('/gestor/lista-remanejamento-gestores', async (req, res) => {
  try {
    const query = `
      SELECT id, nome, cargo 
      FROM usuarios_sistema 
      WHERE cargo = 'GESTOR'
      ORDER BY nome ASC
    `;
    const [rows] = await db.execute(query);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Erro ao buscar engenheiros para remanejamento:", error);
    res.status(500).json({ error: "Erro interno ao listar gestores de destino." });
  }
});
// ========================================================
// 🔄 NOVO GET: LISTAR APENAS FUNCIONÁRIOS INDISPONÍVEIS DO DIA
// ========================================================
router.get('/gestor/funcionarios-indisponiveis', async (req, res) => {
  const { data_diario } = req.query;

  if (!data_diario) {
    return res.status(400).json({ error: "A data do diário é obrigatória." });
  }

  try {
    const sql = `
      SELECT 
        dec.id,
        dec.funcionario AS id_funcionario, 
        dec.status_presenca, 
        dec.turno,
        dec.equipe, 
        dec.data_diario, 
        dec.id_obra,
        o.nome_obra 
      FROM diario_efetivo_confirmado dec
      LEFT JOIN obras o ON dec.id_obra = o.id
      WHERE dec.data_diario = ? 
        AND dec.status_presenca IN ('Presente', 'Folga')
      ORDER BY o.nome_obra ASC
    `;

    const [rows] = await db.execute(sql, [data_diario]);
    res.status(200).json(rows);
  } catch (err) {
    console.error("Erro ao buscar funcionários indisponíveis:", err);
    res.status(500).json({ error: "Erro interno ao listar colaboradores indisponíveis." });
  }
});

// 4. GET: LISTAR FUNCIONÁRIOS DO GESTOR OU GLOBAL (MASTER/RH) - CORRIGIDO
router.get('/gestor/funcionarios-disponiveis', async (req, res) => {
  const { id, cargo, data_diario } = req.query;

  if (!id) {
    return res.status(400).json({ error: "ID do usuário não fornecido." });
  }

  try {
    let sql;
    let params;

    // 💡 Se for MASTER ou RH, continua trazendo a lista global de ativos
    if (cargo === 'MASTER' || cargo === 'RH') {
      sql = `SELECT id, matricula, nome, cargo, ativo FROM funcionarios WHERE ativo IN ('ATIVO', 'INTEGRAÇÃO PENDENTE') ORDER BY nome ASC`;
      params = [];
    } else {
      // 💡 Se for GESTOR comum:
      if (data_diario && data_diario.trim() !== '') {
        sql = `
          SELECT f.id, f.matricula, f.nome, f.cargo, f.ativo 
          FROM funcionarios f
          -- 🔒 Mudado para INNER JOIN para trazer APENAS quem pertence explicitamente a este gestor
          INNER JOIN gestor_funcionarios gf ON gf.id_funcionario = f.id
          WHERE gf.id_usuario = ? 
            AND f.ativo IN ('ATIVO', 'INTEGRAÇÃO PENDENTE')

          UNION

          -- CORRIGIDO: Mudado de 'diario_efetivo' para 'diario_efetivo_confirmado' para manter consistência com as outras rotas
          SELECT DISTINCT f.id, f.matricula, f.nome, f.cargo, f.ativo
          FROM funcionarios f
          INNER JOIN diario_efetivo_confirmado de ON f.id = de.id_funcionario
          INNER JOIN gestor_obras go ON de.id_obra = go.id_obra
          WHERE go.id_usuario = ? 
            AND de.data_diario = ? 
            AND f.ativo IN ('ATIVO', 'INTEGRAÇÃO PENDENTE')
            
          ORDER BY nome ASC
        `;
        params = [parseInt(id), parseInt(id), data_diario];
      } else {
        sql = `
          SELECT f.id, f.matricula, f.nome, f.cargo, f.ativo 
          FROM funcionarios f
          -- 🔒 Mudado para INNER JOIN para amarrar 100% ao id do gestor logado
          INNER JOIN gestor_funcionarios gf ON gf.id_funcionario = f.id
          WHERE gf.id_usuario = ? 
            AND f.ativo IN ('ATIVO', 'INTEGRAÇÃO PENDENTE') 
          ORDER BY f.nome ASC
        `;
        params = [parseInt(id)];
      }
    }

    // Executa a listagem filtrada de funcionários
    const [funcionarios] = await db.execute(sql, params);

    // Executa a query de contagem (Painel de Status)
    const sqlContagem = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN ativo = 'ATIVO' THEN 1 ELSE 0 END) as ativos,
        SUM(CASE WHEN ativo = 'INATIVO' THEN 1 ELSE 0 END) as inativos,
        SUM(CASE WHEN ativo = 'INTEGRAÇÃO PENDENTE' THEN 1 ELSE 0 END) as pendentes
      FROM funcionarios
    `;
    const [contagemRows] = await db.execute(sqlContagem);
    const painelStatus = contagemRows[0];

    // Retorna a lista restrita e o resumo dos contadores
    res.json({
      funcionarios: funcionarios,
      resumoStatus: painelStatus
    });

  } catch (err) {
    console.error("Erro ao buscar funcionários disponíveis:", err);
    res.status(500).json({ error: "Erro ao carregar colaboradores disponíveis." });
  }
});

// 5. GET: HISTÓRICO DE DIÁRIOS (INDICADORES DAS ABAS DE CONSULTA)
router.get('/gestor/historico-diarios', async (req, res) => {
  try {
    const { id_obra } = req.query;
    if (!id_obra) {
      return res.status(400).json({ error: "ID da obra é obrigatório." });
    }

    const queryIndicadores = `
      SELECT 
        COUNT(id) AS total_diarios,
        SUM(CASE WHEN TRIM(UPPER(status)) = 'CHUVA' THEN 1 ELSE 0 END) AS dias_chuva,
        SUM(CASE WHEN TRIM(UPPER(status)) = 'FALTA DE MATERIAL' THEN 1 ELSE 0 END) AS sem_material,
        SUM(CASE WHEN TRIM(UPPER(status)) = 'ATIVA (OCORREU NORMAL)' THEN 1 ELSE 0 END) AS dias_normais,
        SUM(CASE WHEN TRIM(UPPER(status)) = 'OUTROS' THEN 1 ELSE 0 END) AS outros
      FROM diario_obra
      WHERE id_obra = ?;
    `;

    const queryTabela = `
      SELECT id, data_diario, status
      FROM diario_obra
      WHERE id_obra = ?
      ORDER BY data_diario DESC;
    `;

    const [dadosIndicadores] = await db.execute(queryIndicadores, [parseInt(id_obra)]);
    const [dadosTabela] = await db.execute(queryTabela, [parseInt(id_obra)]);

    const linha = (dadosIndicadores && dadosIndicadores.length > 0) ? dadosIndicadores[0] : null;

    res.status(200).json({
      indicadores: {
        total_diarios: linha ? (Number(linha.total_diarios) || 0) : 0,
        dias_chuva: dynamic = linha ? (Number(linha.dias_chuva) || 0) : 0,
        sem_material: linha ? (Number(linha.sem_material) || 0) : 0,
        dias_normais: linha ? (Number(linha.dias_normais) || 0) : 0,
        outros: linha ? (Number(linha.outros) || 0) : 0
      },
      registros: dadosTabela
    });
  } catch (error) {
    console.error("Erro ao gerar histórico de diários:", error);
    res.status(500).json({ error: "Erro ao processar indicadores da obra." });
  }
});

// 6. GET: HISTÓRICO DE OBSERVAÇÕES E NOTAS PASSADAS DE UMA OBRA
router.get('/gestor/historico-observacoes', async (req, res) => {
  try {
    const { id_obra } = req.query;
    if (!id_obra) {
      return res.status(400).json({ error: "O parâmetro id_obra é mandatório." });
    }

    const query = `
      SELECT id, data_diario, equipe, status, observacoes 
      FROM diario_obra
      WHERE id_obra = ? AND observacoes IS NOT NULL AND TRIM(observacoes) != ''
      ORDER BY data_diario DESC;
    `;
    const [rows] = await db.execute(query);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Erro ao coletar histórico de observações:", error);
    res.status(500).json({ error: "Erro interno ao buscar notas operacionais." });
  }
});

// =========================================================================
// 🔀 PARTE 1: ROTAS DE PLANEAMENTO RÁPIDO (VERSÃO PURIFICADA SEM CARACTERES INVISÍVEIS)
// =========================================================================

// A. GET: CARREGAR OS FUNCIONÁRIOS JÁ ALOCADOS COM SEUS RESPECTIVOS VEÍCULOS - CORRIGIDO
router.get('/gestor/diario-efetivo', async (req, res) => {
  try {
    const { data_diario, id_obra } = req.query;

    if (!data_diario || !id_obra) {
      return res.status(400).json({ error: "Parâmetros 'data_diario' e 'id_obra' são obrigatórios." });
    }

    // CORRIGIDO: Agora seleciona explicitamente v.id como id_veiculo para o Front-end mapear corretamente
    const query = `
      SELECT 
        dfc.id, 
        dfc.id_diario, 
        dfc.id_funcionario, 
        dfc.status_presenca, 
        dfc.horas_trabalhadas, 
        dfc.equipe, 
        dfc.data_diario, 
        dfc.id_obra, 
        f.nome, 
        f.cargo, 
        f.matricula, 
        v.id AS id_veiculo,
        v.placa, 
        v.modelo 
      FROM diario_efetivo_confirmado dfc 
      LEFT JOIN funcionarios f ON dfc.id_funcionario = f.id 
      LEFT JOIN veiculos v ON dfc.id_diario = v.id 
      WHERE dfc.data_diario = ? AND dfc.id_obra = ? 
      ORDER BY dfc.equipe ASC
    `;

    const [rows] = await db.execute(query, [data_diario, parseInt(id_obra)]);

    const dadosTratados = rows.map(item => ({
      ...item,
      id_veiculo: item.id_veiculo || item.id_diario || null, // Garante que o ID do veículo retorne redondo pro front
      nome: item.nome || `Colaborador (ID: ${item.id_funcionario})`,
      cargo: item.cargo || 'Operacional',
      matricula: item.matricula || '',
      placa: item.placa || '',
      modelo: item.modelo || ''
    }));

    return res.status(200).json(dadosTratados);

  } catch (error) {
    console.error("Erro crítico na rota GET diário efetivo:", error);
    return res.status(500).json({ error: "Erro interno ao carregar alocações com veículos." });
  }
});

// B. GET: AGENDAMENTOS GLOBAIS DO DIA (Para validação de duplicidade no front)
router.get('/gestor/funcionarios-disponiveis-todos', async (req, res) => {
  try {
    const { data_diario } = req.query;
    if (!data_diario) {
      return res.status(400).json({ error: "A data_diario é obrigatória." });
    }

    const query = "SELECT id_funcionario, id_obra, equipe FROM diario_efetivo_confirmado WHERE data_diario = ?";
    const [rows] = await db.execute(query, [data_diario]);
    return res.status(200).json(rows);
  } catch (error) {
    console.error("Erro ao buscar agendamentos globais:", error);
    return res.status(500).json({ error: "Erro ao ler agendamentos do dia." });
  }
});

// C. POST: GUARDAR / ATUALIZAR A LISTA SALVANDO O ID DO VEÍCULO CORRETAMENTE - CORRIGIDO
router.post('/gestor/diario-efetivo', async (req, res) => {
  const { data_diario, id_obra } = req.body;
  const efetivo = req.body.efetivo || []; 
  
  if (!data_diario || !id_obra || !Array.isArray(efetivo)) {
    return res.status(400).json({ error: "Dados incompletos ou formato de array inválido." });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1️⃣ Limpa o histórico anterior deste dia e obra
    await connection.execute(
      "DELETE FROM diario_efetivo_confirmado WHERE data_diario = ? AND id_obra = ?", 
      [data_diario, parseInt(id_obra)]
    );

    // 2️⃣ Insere os novos dados mapeando o ID do veículo enviado pelo Front-end
    if (efetivo.length > 0) {
      const sqlInsertConfirmado = "INSERT INTO diario_efetivo_confirmado (id_diario, id_funcionario, status_presenca, horas_trabalhadas, equipe, data_diario, id_obra) VALUES (?, ?, ?, ?, ?, ?, ?)";

      for (const f of efetivo) {
        const idFuncionario = parseInt(f.id_funcionario);
        if (!idFuncionario) continue; 

        const statusTratado = f.status_presenca && String(f.status_presenca).toUpperCase() === 'PRESENTE' ? 'Presente' : 'Folga';
        const equipeTratada = f.equipe ? String(f.equipe).trim() : 'Geral';
        
        // Captura o veículo selecionado vindo do front (aceita id_veiculo ou id_diario como fallback)
        const idVeiculoFinal = f.id_veiculo || f.id_diario || null;

        await connection.execute(sqlInsertConfirmado, [
          idVeiculoFinal,            // Salva na coluna id_diario (Veículo)
          idFuncionario,             // id_funcionario
          statusTratado,             // status_presenca
          f.horas_trabalhadas || 0,  // horas_trabalhadas
          equipeTratada,             // equipe
          data_diario,               // data_diario
          parseInt(id_obra)          // id_obra
        ]);
      }
    }

    await connection.commit();
    return res.status(200).json({ success: true, message: "Escala salva com sucesso!" });
  } catch (err) {
    if (connection) await connection.rollback();
    
    console.log("\n==================== ERRO REAL NO MYSQL ====================");
    console.error("Mensagem:", err.message);
    console.error("Código do Erro:", err.code);
    console.log("============================================================\n");

    return res.status(500).json({ 
      error: "Falha interna no banco de dados.", 
      detalhes: err.message,
      codigo: err.code 
    });
  } finally {
    if (connection) connection.release(); // Evita queda de conexão se o getConnection falhar
  }
});

// ========================================================
// GET: CONSULTAR OCUPAÇÕES CONFIRMADAS DO DIA (TRAVAS E STATUS)
// ========================================================
router.get('/gestor/ocupacoes-dia', async (req, res) => {
  const { data_diario } = req.query;

  if (!data_diario) {
    return res.status(400).json({ error: "Data do diário não informada." });
  }

  try {
    // Busca todas as alocações confirmadas para o dia e traz o nome da obra
    const sql = `
      SELECT 
        dec.id_funcionario,
        dec.status_presenca,
        dec.equipe,
        o.nome AS nome_obra
      FROM diario_efetivo_confirmado dec
      INNER JOIN obras o ON dec.id_obra = o.id
      WHERE dec.data_diario = ?
    `;

    const [rows] = await db.execute(sql, [data_diario]);
    
    // Retorna uma lista simples de funcionários ocupados no dia
    return res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar ocupações do dia:", err);
    return res.status(500).json({ error: "Erro interno ao buscar ocupações." });
  }
});
// ========================================================
// 13. PUT: ATUALIZAR STATUS DE PRESENÇA DIRETO (GESTOR)
// ========================================================
router.put('/gestor/diario-efetivo/status/:id', async (req, res) => {
  const { id } = req.params;
  const { status_presenca } = req.body;

  if (!status_presenca) {
    return res.status(400).json({ error: "Status de presença não fornecido." });
  }

  try {
    const sql = "UPDATE diario_efetivo SET status_presenca = ? WHERE id = ?";
    await db.execute(sql, [String(status_presenca).trim().toUpperCase(), parseInt(id)]);
    res.json({ success: true, message: "Status updated successfully!" });
  } catch (err) {
    res.status(500).json({ error: "Erro interno ao atualizar status." });
  }
});



// ========================================================
// 15. GET: LISTAR OBRAS DE UM GESTOR ESPECÍFICO (REMANEJAMENTO)
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
// 16. PUT: REMANEJAR FUNCIONÁRIO ENTRE OBRAS (CONCLUÍDO) ✅
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

    // 1. Verifica se o funcionário existe de fato
    const [funcData] = await connection.execute("SELECT nome, cargo, matricula FROM funcionarios WHERE id = ?", [parseInt(id_funcionario)]);
    if (funcData.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Funcionário não encontrado." });
    }

    const { nome, cargo, matricula } = funcData[0];

    // 2. Remove o agendamento/presença do diário da obra anterior
    await connection.execute("DELETE FROM diario_efetivo WHERE id = ?", [parseInt(id_lancamento)]);

    // 3. Insere o agendamento no diário da nova obra de destino
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

    // 4. Finaliza vínculos antigos e cria a nova amarração do gestor
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
// 16-B. POST: REMANEZAR APENAS PARA O GESTOR (ATUALIZA GESTOR_FUNCIONARIOS) ✅ NOVA
// ========================================================
router.post('/gestor/remanezar-funcionario-vincular', async (req, res) => {
  const { 
    id_usuario, 
    id_funcionario, 
    id_obra, 
    data_inicio, 
    data_fim, 
    id_usuario_alteracao 
  } = req.body;

  // Validação dos campos obrigatórios mínimos
  if (!id_usuario || !id_funcionario || !data_inicio) {
    return res.status(400).json({ error: "Dados obrigatórios ausentes para o remanejamento." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Simulação da Notificação no console do Servidor
    console.log(`\n[NOTIFICAÇÃO EVENTO] Funcionário ID ${id_funcionario} movido para o Gestor ID ${id_usuario}.`);

    // 2. Remove o vínculo antigo do funcionário se houver (para ele não ter dois gestores ao mesmo tempo)
    await connection.execute(
      "DELETE FROM gestor_funcionarios WHERE id_funcionario = ?", 
      [parseInt(id_funcionario)]
    );

    // 3. Insere o novo registro com a estrutura solicitada
    const sqlInsert = `
      INSERT INTO gestor_funcionarios 
      (id_usuario, id_funcionario, id_obra, data_inicio, data_fim, id_usuario_alteracao) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await connection.execute(sqlInsert, [
      parseInt(id_usuario),
      parseInt(id_funcionario),
      id_obra ? parseInt(id_obra) : null,
      data_inicio,
      data_fim || null,
      id_usuario_alteracao ? parseInt(id_usuario_alteracao) : null
    ]);

    await connection.commit();
    res.status(200).json({ success: true, message: "Funcionário remanejado e tabela gestor_funcionarios atualizada!" });

  } catch (err) {
    await connection.rollback();
    console.error("Erro ao inserir em gestor_funcionarios:", err);
    res.status(500).json({ error: "Erro interno no servidor ao processar o vínculo do gestor." });
  } finally {
    connection.release();
  }
});
// ========================================================
// 5. POST: SALVAR / ATUALIZAR APONTAMENTOS (DIÁRIO EFETIVO)
// ========================================================
router.post('/gestor/diario-efetivo', async (req, res) => {
  const { data_diario, id_obra } = req.body;
  const efetivo = req.body.efetivo || []; 
  
  if (!data_diario || !id_obra || !Array.isArray(efetivo)) {
    return res.status(400).json({ error: "Dados incompletos ou inválidos." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      "DELETE FROM diario_efetivo WHERE data_diario = ? AND id_obra = ?", 
      [data_diario, parseInt(id_obra)]
    );
    
    if (efetivo.length > 0) {
      // 💡 Adicionado 'id_gestor' na lista de colunas e mais um '?' nos VALUES
      const sqlInsert = `
        INSERT INTO diario_efetivo 
        (data_diario, id_obra, id_funcionario, id_gestor, nome, cargo, matricula, turno, status_presenca, observacao, equipe) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      for (const f of efetivo) {
        const idFuncionario = parseInt(f.id_funcionario);
        const nomeFuncionario = f.nome ? String(f.nome).trim() : null;

        if (!idFuncionario || !nomeFuncionario) continue; 

        const statusCru = f.status_presenca ? String(f.status_presenca).trim().toUpperCase() : 'AGENDADO';

        await connection.execute(sqlInsert, [
          data_diario,
          parseInt(id_obra),
          idFuncionario,
          f.id_gestor ? parseInt(f.id_gestor) : null, // 💡 Pegando o id_gestor diretamente do objeto do funcionário
          nomeFuncionario,
          f.cargo ? String(f.cargo) : null,
          f.matricula ? String(f.matricula) : null,
          f.turno || 'MANHÃ', 
          statusCru,
          f.observacao && f.observacao.trim() !== '' ? String(f.observacao) : null,
          f.equipe ? String(f.equipe).trim() : 'Geral' 
        ]);
      }
    }

    await connection.commit();
    res.status(200).json({ success: true, message: "Gravado com sucesso!" });
  } catch (err) {
    await connection.rollback();
    console.error("Erro crítico na transação:", err);
    res.status(500).json({ error: "Falha ao persistir diário." });
  } finally {
    connection.release();
  }
});


// ========================================================
// 5. POST: SALVAR / ATUALIZAR APONTAMENTOS (DIÁRIO EFETIVO)
// ========================================================
router.post('/gestor/diario-efetivo', async (req, res) => {
  const { data_diario, id_obra } = req.body;
  const efetivo = req.body.efetivo || []; 
  
  if (!data_diario || !id_obra || !Array.isArray(efetivo)) {
    return res.status(400).json({ error: "Dados incompletos ou inválidos." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      "DELETE FROM diario_efetivo WHERE data_diario = ? AND id_obra = ?", 
      [data_diario, parseInt(id_obra)]
    );
    
    if (efetivo.length > 0) {
      // 💡 Adicionado 'id_gestor' na lista de colunas e mais um '?' nos VALUES
      const sqlInsert = `
        INSERT INTO diario_efetivo 
        (data_diario, id_obra, id_funcionario, id_gestor, nome, cargo, matricula, turno, status_presenca, observacao, equipe) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      for (const f of efetivo) {
        const idFuncionario = parseInt(f.id_funcionario);
        const nomeFuncionario = f.nome ? String(f.nome).trim() : null;

        if (!idFuncionario || !nomeFuncionario) continue; 

        const statusCru = f.status_presenca ? String(f.status_presenca).trim().toUpperCase() : 'AGENDADO';

        await connection.execute(sqlInsert, [
          data_diario,
          parseInt(id_obra),
          idFuncionario,
          f.id_gestor ? parseInt(f.id_gestor) : null, // 💡 Pegando o id_gestor diretamente do objeto do funcionário
          nomeFuncionario,
          f.cargo ? String(f.cargo) : null,
          f.matricula ? String(f.matricula) : null,
          f.turno || 'MANHÃ', 
          statusCru,
          f.observacao && f.observacao.trim() !== '' ? String(f.observacao) : null,
          f.equipe ? String(f.equipe).trim() : 'Geral' 
        ]);
      }
    }

    await connection.commit();
    res.status(200).json({ success: true, message: "Gravado com sucesso!" });
  } catch (err) {
    await connection.rollback();
    console.error("Erro crítico na transação:", err);
    res.status(500).json({ error: "Falha ao persistir diário." });
  } finally {
    connection.release();
  }
});

// ========================================================
// 6. POST: SALVAR DIÁRIO TÉCNICO COMPLETO (PRODUÇÃO + MATERIAIS) ✅ ATUALIZADO COM STATUS
// ========================================================
router.post('/gestor/salvar-diario-completo', async (req, res) => {
  // 💡 Incluído 'status' na desestruturação do corpo da requisição
  const { 
    data_diario, 
    id_obra, 
    id_gestor, 
    equipe, 
    efetivo_confirmado, 
    atividades_tachas, 
    materiais_apontados, 
    observacoes,
    status 
  } = req.body;
  
  // 🔍 LOG DE INSPEÇÃO INTERNA E AUDITORIA
  console.log("\n====== RECEBIDO NO SALVAR DIÁRIO COMPLETO ======");
  console.log("data_diario:", data_diario, `(${typeof data_diario})`);
  console.log("id_obra:", id_obra, `(${typeof id_obra})`);
  console.log("id_gestor:", id_gestor, `(${typeof id_gestor})`);
  console.log("equipe:", equipe, `(${typeof equipe})`);
  console.log("status recebido:", status, `(${typeof status})`);
  console.log("observacoes:", observacoes);
  console.log("================================================\n");

  if (!data_diario || !id_obra || !id_gestor || !equipe) {
    return res.status(400).json({ error: "Dados obrigatórios ausentes (Data, Obra, ID Gestor ou Identificação da Equipe)." });
  }

  // 📝 Garante que o status seja uma string limpa em caixa alta ou assume um padrão válido
  const statusTratadoDiario = status && String(status).trim() !== '' ? String(status).trim().toUpperCase() : 'SALVO';

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    // Busca se já existe um cabeçalho técnico mestre para esta Obra, Data E EQUIPE específica
    const [existenteMestre] = await connection.execute(
      'SELECT id FROM diario_obra WHERE id_obra = ? AND data_diario = ? AND equipe = ?',
      [parseInt(id_obra), data_diario, String(equipe).trim()]
    );

    let diarioId;
    if (existenteMestre.length > 0) {
      diarioId = existenteMestre[0].id;
      
      // 🌟 ATUALIZAÇÃO: Adicionada a coluna 'status' no UPDATE da diario_obra
      await connection.execute(
        'UPDATE diario_obra SET observacoes = ?, id_gestor = ?, status = ? WHERE id = ?',
        [observacoes || null, parseInt(id_gestor), statusTratadoDiario, diarioId]
      );
    } else {
      // 🌟 ATUALIZAÇÃO: Adicionada a coluna 'status' no INSERT da diario_obra
      const [resultadoInsereMestre] = await connection.execute(
        'INSERT INTO diario_obra (id_obra, data_diario, observacoes, id_gestor, equipe, status) VALUES (?, ?, ?, ?, ?, ?)',
        [parseInt(id_obra), data_diario, observacoes || null, parseInt(id_gestor), String(equipe).trim(), statusTratadoDiario]
      );
      diarioId = resultadoInsereMestre.insertId;
    }

    // Limpa apenas as confirmações vinculadas a ESTE diário técnico (desta equipe)
    await connection.execute('DELETE FROM diario_efetivo_confirmado WHERE id_diario = ?', [diarioId]);
    
    // Limpa a listagem geral da tabela 'diario_efetivo' filtrando também pela equipe
    await connection.execute(
      'DELETE FROM diario_efetivo WHERE id_obra = ? AND data_diario = ? AND equipe = ?', 
      [parseInt(id_obra), data_diario, String(equipe).trim()]
    );

    if (efetivo_confirmado && efetivo_confirmado.length > 0) {
      const sqlConfirmado = `INSERT INTO diario_efetivo_confirmado (id_diario, id_funcionario, status_presenca, horas_trabalhadas) VALUES (?, ?, ?, ?)`;
      
      const sqlDiarioEfetivo = `
        INSERT INTO diario_efetivo 
        (nome, data_diario, id_obra, id_funcionario, cargo, matricula, turno, status_presenca, observacao, equipe, id_gestor) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      for (const f of efetivo_confirmado) {
        if (!f.id_funcionario) continue;
        
        let statusTratado = f.status_presenca ? String(f.status_presenca).trim().toUpperCase() : 'PRESENTE';
        if (statusTratado === 'FÉRIAS' || statusTratado === 'FERIAS') statusTratado = 'FÉRIAS';
        if (statusTratado === 'INTEGRAÇÃO' || statusTratado === 'INTEGRACAO') statusTratado = 'INTEGRAÇÃO';

        await connection.execute(sqlConfirmado, [diarioId, parseInt(f.id_funcionario), statusTratado, 0]);
        
        await connection.execute(sqlDiarioEfetivo, [
          f.nome || 'Não Informado',
          data_diario,
          parseInt(id_obra),
          parseInt(f.id_funcionario),
          f.cargo || null,
          f.matricula || null,
          f.turno || 'DIURNO',
          statusTratado,
          f.observacao || null,
          String(equipe).trim(),
          parseInt(id_gestor)
        ]);
      }
    }

    // Limpa e reinsere as atividades específicas computadas por esta equipe
    await connection.execute('DELETE FROM diario_atividades WHERE id_diario = ?', [diarioId]);
    if (atividades_tachas && atividades_tachas.length > 0) {
      const sqlAtividade = `INSERT INTO diario_atividades (id_diario, tipo_servico, quantidade) VALUES (?, ?, ?)`;
      for (const l of atividades_tachas) {
        if (!l.tipoServico) continue;
        await connection.execute(sqlAtividade, [diarioId, String(l.tipoServico).trim(), parseFloat(l.quantidade) || 0.00]);
      }
    }

    // Limpa e reinsere os materiais apontados por esta equipe
    await connection.execute('DELETE FROM diario_materiais_apontados WHERE id_diario = ?', [diarioId]);
    if (materiais_apontados && materiais_apontados.length > 0) {
      const sqlMaterial = `INSERT INTO diario_materiais_apontados (id_diario, material_nome, quantidade) VALUES (?, ?, ?)`;
      for (const m of materiais_apontados) {
        if (!m.material) continue; 
        await connection.execute(sqlMaterial, [
          diarioId, 
          String(m.material).trim(), 
          parseFloat(m.quantidade) || 0.00
        ]);
      }
    }

    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    await connection.commit();
    res.status(200).json({ success: true, message: `RDO da equipe '${equipe}' salvo com sucesso!` });

  } catch (err) {
    try { await connection.execute('SET FOREIGN_KEY_CHECKS = 1'); } catch(e){}
    await connection.rollback();
    console.error("Erro crítico ao salvar RDO Completo por Equipe:", err.code, "-", err.message);
    res.status(500).json({ error: "Erro interno ao salvar diário completo no banco de dados." });
  } finally {
    connection.release();
  }
});

// ========================================================
// 6-B. GET: RECUPERAR DIÁRIO TÉCNICO COMPLETO (POR EQUIPE) ✅ ATUALIZADO
// ========================================================
router.get('/gestor/salvar-diario-completo', async (req, res) => {
  const { data_diario, id_obra, equipe } = req.query;

  if (!data_diario || !id_obra || !equipe) {
    return res.status(400).json({ error: "Parâmetros ausentes (data_diario, id_obra e equipe são obrigatórios)." });
  }

  try {
    const sqlMestre = `
      SELECT id, observacoes, id_gestor 
      FROM diario_obra 
      WHERE id_obra = ? AND data_diario = ? AND equipe = ?
    `;
    const [mestreRows] = await db.execute(sqlMestre, [parseInt(id_obra), data_diario, String(equipe).trim()]);

    if (mestreRows.length === 0) {
      return res.json({ existe: false, mensagem: "Nenhum diário técnico encontrado para esta equipe nesta data." });
    }

    const diarioId = mestreRows[0].id;

    const sqlEfetivo = `
      SELECT 
        dec.id_funcionario,
        dec.status_presenca,
        dec.horas_trabalhadas,
        f.nome,
        f.matricula,
        f.cargo
      FROM diario_efetivo_confirmado dec
      INNER JOIN funcionarios f ON dec.id_funcionario = f.id
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

    // 🌟 CONSULTA ADICIONADA: Busca os materiais vinculados a este diário
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
      equipe: String(equipe).trim(),
      observacoes: mestreRows[0].observacoes || "",
      efetivo_confirmado: efetivoRows,
      atividades_tachas: atividadesRows,
      materials_apontados: materiaisRows // 🌟 RETORNO ADICIONADO
    });

  } catch (err) {
    console.error("Erro ao recuperar diário completo por equipe:", err);
    res.status(500).json({ error: "Erro interno ao buscar diário completo." });
  }
});

export default router;