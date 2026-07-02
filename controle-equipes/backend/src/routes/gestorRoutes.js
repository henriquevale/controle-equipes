import express from 'express';
const router = express.Router();

// Caminho para a estrutura real do banco
import db from '../../db.js';


// ========================================================
// 2. GET: LISTAR OBRAS VINCULADAS (GESTOR) OU TUDO (MASTER)
// ========================================================
// ========================================================
// ROTA NO BACK-END: GET /gestor/obras-ativas (CORRIGIDA)
// ========================================================
router.get('/gestor/obras-ativas', async (req, res) => {
  try {
    // 💡 AJUSTE AQUI: Mude de id_usuario para id
    const { id, cargo } = req.query; 

    if (!id) {
      return res.status(400).json({ error: "ID do usuário não foi fornecido." });
    }

    // Exemplo de como deve estar sua query SQL interna:
    let sql = `SELECT * FROM obras WHERE status = 'ATIVA'`;
    const params = [];

    if (cargo !== 'MASTER') {
      // A coluna no banco continua id_usuario, mas passamos a variável 'id' do JS
      sql = `
        SELECT o.* FROM obras o
        INNER JOIN gestor_obras go ON o.id = go.id_obra
        WHERE go.id_usuario = ? AND o.status = 'ATIVA'
      `;
      params.push(Number(id)); // 💡 Usando o 'id' corrigido
    }

    const [resultados] = await db.execute(sql, params);
    res.json(resultados);

  } catch (error) {
    console.error("Erro na rota de obras ativas:", error);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// ========================================================
// 3. GET: LISTAR FUNCIONÁRIOS DO GESTOR OU GLOBAL (MASTER/RH) - CORRIGIDO
// ========================================================
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

          -- Mantém os funcionários que já possuem apontamento nesta obra/data para este gestor
          SELECT DISTINCT f.id, f.matricula, f.nome, f.cargo, f.ativo
          FROM funcionarios f
          INNER JOIN diario_efetivo de ON f.id = de.id_funcionario
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

// ========================================================
// 4. GET: RECUPERAR HISTÓRICO DO DIÁRIO (OBRA + DATA OU DIA GLOBAL) ✅ CORRIGIDO & OTIMIZADO
// ========================================================
router.get('/gestor/diario-efetivo', async (req, res) => {
  const { data_diario, id_obra } = req.query;
  
  if (!data_diario) {
    return res.status(400).json({ error: "O parâmetro data_diario é obrigatório." });
  }

  try {
    let sql;
    let params;

    // Se passou uma obra específica e válida, filtra por Data E por Obra
    if (id_obra && id_obra !== 'TODAS' && id_obra !== '') {
      sql = `
        SELECT 
          de.id, de.id_funcionario, de.id_obra, de.equipe,
          de.nome, de.cargo, de.matricula, de.turno, de.status_presenca, de.observacao,
          o.nome_obra AS obra_nome -- 🌟 Traz o nome da obra real
        FROM diario_efetivo de
        LEFT JOIN obras o ON de.id_obra = o.id
        WHERE de.data_diario = ? AND de.id_obra = ?
        ORDER BY de.equipe ASC, de.nome ASC
      `;
      params = [data_diario, parseInt(id_obra)];
    } else {
      // 💡 Se for 'TODAS' ou vazio, traz o HISTÓRICO GLOBAL DO DIA (Ignora filtro de obra, mas traz o nome dela)
      sql = `
        SELECT 
          de.id, de.id_funcionario, de.id_obra, de.equipe,
          de.nome, de.cargo, de.matricula, de.turno, de.status_presenca, de.observacao,
          o.nome_obra AS obra_nome -- 🌟 Traz o nome da obra real onde cada um está alocado
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
// 5. POST: SALVAR / ATUALIZAR APONTAMENTOS (DIÁRIO EFETIVO) ✅ CORRIGIDO PARA GRAVAR IMEDIATAMENTE COMO 'ALOCADO'
// ========================================================
router.post('/gestor/diario-efetivo', async (req, res) => {
  const { data_diario, id_obra, equipe } = req.body;
  
  // Aceita tanto o formato 'funcionarios' quanto 'efetivo' vindo do Front
  const listaFuncionarios = req.body.funcionarios || req.body.efetivo || []; 
  
  if (!data_diario || !id_obra || !Array.isArray(listaFuncionarios)) {
    return res.status(400).json({ error: "Dados incompletos ou inválidos." });
  }

  const equipeTratada = equipe ? String(equipe).trim().toUpperCase() : null;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Deleta apenas os registros da equipe selecionada para permitir a gravação limpa
    if (equipeTratada) {
      await connection.execute(
        "DELETE FROM diario_efetivo WHERE data_diario = ? AND id_obra = ? AND UPPER(TRIM(equipe)) = ?", 
        [data_diario, parseInt(id_obra), equipeTratada]
      );
    } else {
      await connection.execute(
        "DELETE FROM diario_efetivo WHERE data_diario = ? AND id_obra = ?", 
        [data_diario, parseInt(id_obra)]
      );
    }
    
    if (listaFuncionarios.length > 0) {
      const sqlInsert = `
        INSERT INTO diario_efetivo 
        (data_diario, id_obra, id_funcionario, id_gestor, nome, cargo, matricula, turno, status_presenca, observacao, equipe) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      for (const f of listaFuncionarios) {
        const idFuncionario = parseInt(f.id_funcionario);
        const nomeFuncionario = f.nome ? String(f.nome).trim() : null;

        if (!idFuncionario || !nomeFuncionario) continue; 

        // 🌟 ALTERAÇÃO AQUI: Força QUALQUER status inicial vindo da primeira tela a ser gravado como 'ALOCADO' no banco de dados.
        // Isso ignora o 'Presente' ou 'Presente' que o Front-end possa estar enviando por padrão nesta etapa.
        let statusCru = 'ALOCADO';

        // Se por acaso for uma Folga Programada vinda do Front, você pode abrir uma exceção se quiser, senão tudo vira ALOCADO:
        if (f.status_presenca && String(f.status_presenca).trim().toUpperCase() === 'FOLGA') {
          statusCru = 'FOLGA';
        }

        const equipeFuncionario = f.equipe ? String(f.equipe).trim().toUpperCase() : (equipeTratada || 'GERAL');

        await connection.execute(sqlInsert, [
          data_diario,
          parseInt(id_obra),
          idFuncionario,
          f.id_gestor ? parseInt(f.id_gestor) : null,
          nomeFuncionario,
          f.cargo ? String(f.cargo) : null,
          f.matricula ? String(f.matricula) : null,
          f.turno || 'DIURNO', 
          statusCru, // 🌟 Salva como 'ALOCADO' na tabela diario_efetivo imediatamente!
          f.observacao && f.observacao.trim() !== '' ? String(f.observacao) : null,
          equipeFuncionario
        ]);
      }
    }

    await connection.commit();
    res.status(200).json({ success: true, message: "Efetivo gravado como ALOCADO com sucesso!" });
  } catch (err) {
    await connection.rollback();
    console.error("Erro crítico na transação:", err);
    res.status(500).json({ error: "Falha ao persistir diário." });
  } finally {
    connection.release();
  }
});
// ========================================================
// 6. POST: SALVAR DIÁRIO TÉCNICO COMPLETO (PRODUÇÃO + MATERIAIS) ✅ BLINDADO CONTRA ERRO 500
// ========================================================
router.post('/gestor/salvar-diario-completo', async (req, res) => {
  const { 
    data_diario, 
    id_obra, 
    id_gestor, 
    equipe, 
    efetivo_confirmado, 
    atividades_tachas, 
    materials_apontados, // Captura exatamente o nome que vem do Front-end
    observacoes,
    status 
  } = req.body;

  // Validação inicial rigorosa para impedir que valores nulos quebrem o banco
  if (!data_diario || !id_obra || !id_gestor || !equipe) {
    return res.status(400).json({ error: "Dados obrigatórios ausentes para salvar o diário." });
  }

  // Tratamentos de segurança contra valores inválidos
  const gestorIdValido = parseInt(id_gestor) || null;
  const obraIdValida = parseInt(id_obra) || null;
  const equipeMaiuscula = String(equipe).trim().toUpperCase();
  const statusTratadoDiario = status && String(status).trim() !== '' ? String(status).trim().toUpperCase() : 'SALVO';

  if (!gestorIdValido || !obraIdValida) {
    return res.status(400).json({ error: "IDs de obra ou gestor são inválidos." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    // 1. Busca se já existe um cabeçalho técnico mestre para esta Obra, Data e Equipe
    const [existenteMestre] = await connection.execute(
      'SELECT id FROM diario_obra WHERE id_obra = ? AND data_diario = ? AND equipe = ?',
      [obraIdValida, data_diario, equipeMaiuscula]
    );

    let diarioId;
    if (existenteMestre.length > 0) {
      diarioId = existenteMestre[0].id;
      await connection.execute(
        'UPDATE diario_obra SET observacoes = ?, id_gestor = ?, status = ? WHERE id = ?',
        [observacoes || null, gestorIdValido, statusTratadoDiario, diarioId]
      );

      await connection.execute(
        `INSERT INTO controle_diarios_equipe (data_diario, id_obra, equipe, status_rdo) 
         VALUES (?, ?, ?, 'FINALIZADO') 
         ON DUPLICATE KEY UPDATE status_rdo = 'FINALIZADO'`,
        [data_diario, obraIdValida, equipeMaiuscula]
      );
    } else {
      const [resultadoInsereMestre] = await connection.execute(
        'INSERT INTO diario_obra (id_obra, data_diario, observacoes, id_gestor, equipe, status) VALUES (?, ?, ?, ?, ?, ?)',
        [obraIdValida, data_diario, observacoes || null, gestorIdValido, equipeMaiuscula, statusTratadoDiario]
      );
      diarioId = resultadoInsereMestre.insertId;
    }

    // 2. Limpa e reinsere o Efetivo Confirmado
    await connection.execute('DELETE FROM diario_efetivo_confirmado WHERE id_diario = ?', [diarioId]);
    await connection.execute(
      'DELETE FROM diario_efetivo WHERE id_obra = ? AND data_diario = ? AND equipe = ?', 
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
        (nome, data_diario, id_obra, id_funcionario, cargo, matricula, turno, status_presenca, observacao, equipe, id_gestor) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      for (const f of efetivo_confirmado) {
        if (!f.id_funcionario) continue;
        
        let statusTratado = f.status_presenca ? String(f.status_presenca).trim().toUpperCase() : 'ALOCADO';
        if (statusTratado === 'FERIAS') statusTratado = 'FÉRIAS';
        if (statusTratado === 'INTEGRACAO') statusTratado = 'INTEGRAÇÃO';

        await connection.execute(sqlConfirmado, [
          diarioId, 
          parseInt(f.id_funcionario), 
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
          parseInt(f.id_funcionario),
          f.cargo || null,
          f.matricula || null,
          f.turno || 'DIURNO',
          statusTratado,
          f.observacao || null,
          equipeMaiuscula,
          gestorIdValido
        ]);
      }
    }

    // 3. Limpa e reinsere as Atividades / Produção
    await connection.execute('DELETE FROM diario_atividades WHERE id_diario = ?', [diarioId]);
    if (atividades_tachas && atividades_tachas.length > 0) {
      const sqlAtividade = `INSERT INTO diario_atividades (id_diario, tipo_servico, quantidade) VALUES (?, ?, ?)`;
      for (const l of atividades_tachas) {
        // Aceita qualquer uma das variações de propriedades enviadas do Front
        const nomeServico = l.tipo_servico || l.tipoServico || l.servico || l.atividade;
        if (!nomeServico) continue;
        
        await connection.execute(sqlAtividade, [
          diarioId, 
          String(nomeServico).trim(), 
          parseFloat(l.quantidade) || 0.00
        ]);
      }
    }

    // 4. Limpa e reinsere os Materiais Apontados (Tabela: diario_materiais_apontados)
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
        console.log(`[Sucesso] Material Salvo no BD: ${materialNome}`);
      }
    }

    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    await connection.commit();
    res.status(200).json({ success: true, message: `RDO da equipe '${equipeMaiuscula}' salvo com sucesso!` });

  } catch (err) {
    try { await connection.execute('SET FOREIGN_KEY_CHECKS = 1'); } catch(e){}
    await connection.rollback();
    console.error("ERRO CRÍTICO NO BANCO DE DADOS:", err.message);
    res.status(500).json({ error: "Erro interno no banco de dados ao salvar o RDO completo." });
  } finally {
    connection.release();
  }
});

// ========================================================
// 6-B. GET: RECUPERAR DIÁRIO TÉCNICO COMPLETO (POR EQUIPE) ✅ CORRIGIDO RETORNO DE CAMPOS
// ========================================================
router.get('/gestor/salvar-diario-completo', async (req, res) => {
  const { data_diario, id_obra, equipe } = req.query;

  if (!data_diario || !id_obra || !equipe) {
    return res.status(400).json({ error: "Parâmetros ausentes (data_diario, id_obra e equipe são obrigatórios)." });
  }

  // Tratamos o parâmetro da busca para maiúscula para sincronizar com a gravação
  const equipeMaiusculaBusca = String(equipe).trim().toUpperCase();

  try {
    const sqlMestre = `
      SELECT id, observacoes, id_gestor 
      FROM diario_obra 
      WHERE id_obra = ? AND data_diario = ? AND equipe = ?
    `;
    const [mestreRows] = await db.execute(sqlMestre, [parseInt(id_obra), data_diario, equipeMaiusculaBusca]);

    if (mestreRows.length === 0) {
      return res.json({ existe: false, mensagem: "Nenhum diário técnico encontrado para esta equipe nesta data." });
    }

    const diarioId = mestreRows[0].id;

    // 🌟 ATUALIZADO: Puxando os novos campos direto da tabela diario_efetivo_confirmado (dec.equipe, dec.data_diario, dec.id_obra)
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
      observacoes: mestreRows[0].observacoes || "",
      efetivo_confirmado: efetivoRows, // 🌟 Agora cada objeto aqui dentro virá preenchido com equipe, data_diario e id_obra
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
// NO SEU BACK-END: ROTA DO HISTÓRICO CORRIGIDA (PRODUÇÃO + MATERIAIS) ⚙️ AJUSTADA PARA AUDITORIA DE DIÁRIOS PENDENTES
// ========================================================
router.get('/gestor/historico-diarios', async (req, res) => {
  try {
    const { id, cargo, id_obra, data_inicio, data_fim } = req.query;

    // ===== LOGS DE DIAGNÓSTICO =====
    console.log('\n========== [DIAGNÓSTICO] /gestor/historico-diarios ==========');
    console.log('[1] Parâmetros recebidos (req.query):', { id, cargo, id_obra, data_inicio, data_fim });

    if (!id) {
      console.log('[ERRO] ID não fornecido!');
      return res.status(400).json({ error: "ID numérico do usuário não foi fornecido." });
    }

    // ✅ SUBSTITUA O BLOCO DA QUERY POR ESTA VERSÃO CORRIGIDA:
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

        -- 🌟 CORRIGIDO: Busca os serviços agrupados sem duplicar as linhas do relatório principal
        (
          SELECT GROUP_CONCAT(CONCAT(sub_da.tipo_servico, ': ', sub_da.quantidade) SEPARATOR '\n')
          FROM diario_atividades sub_da
          WHERE sub_da.id_diario = do.id
        ) AS servicos_resumo,

        -- 🌟 CORRIGIDO: Soma exata das quantidades de atividades deste diário
        (
          SELECT IFNULL(SUM(sub_da.quantidade), 0)
          FROM diario_atividades sub_da
          WHERE sub_da.id_diario = do.id
        ) AS total_quantidade_produzida,

        -- Busca os materiais vinculados a este diário específico (do.id)
        (
          SELECT GROUP_CONCAT(CONCAT(dma.material_nome, ': ', dma.quantidade) SEPARATOR '\n')
          FROM diario_materiais_apontados dma
          WHERE dma.id_diario = do.id
        ) AS materiais_resumo

      FROM diario_efetivo r
      INNER JOIN obras o ON r.id_obra = o.id
      LEFT JOIN diario_obra do ON do.id_obra = r.id_obra AND do.data_diario = r.data_diario AND do.equipe = r.equipe
      WHERE 1=1
    `;

    const params = [];

    // 💡 IMPORTANTE PARA A AUDITORIA DE AUSÊNCIAS:
    // Se a busca enviar datas específicas de filtro (Auditoria de Dias Pendentes), 
    // nós não amarramos o 'do.id_gestor = id' no WHERE, pois se o diário não existir, 
    // o registro não retornaria e a auditoria de lacunas falharia. 
    // Filtramos apenas pela amarração direta do gestor logado com a obra ativa.
    if (cargo !== 'MASTER') {
      if (data_inicio && data_fim) {
        // Se veio intervalo de auditoria, garante que o gestor só veja dados das obras vinculadas a ele
        sql += ` AND r.id_obra IN (SELECT id_obra FROM gestor_obras WHERE id_usuario = ?) `;
        params.push(Number(id));
        console.log(`[3] Filtro de Auditoria: Restringindo histórico às obras associadas ao Gestor ID=${Number(id)}`);
      } else {
        // Fluxo normal do histórico clássico do gestor
        sql += ` AND (do.id_gestor = ? OR r.id_gestor = ?) `;
        params.push(Number(id), Number(id));
        console.log(`[3] Filtro Clássico GESTOR aplicado para RDOs assinados pelo id=${Number(id)}`);
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

    const [resultados] = await db.execute(sql, params);

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(resultados);

  } catch (error) {
    console.error("Erro na rota de histórico de diários:", error);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// ========================================================
// 18. GET: HISTÓRICO DE PRESENÇA CONSOLIDADO (ATUALIZADO)
// ========================================================
router.get('/gestor/historico-presenca', async (req, res) => {
  const { id, cargo, id_obra, data_inicio, data_fim } = req.query;

  if (!id || !cargo) {
    return res.status(400).json({ error: "ID e Cargo do usuário são obrigatórios." });
  }

  try {
    let filtroCondicional = "";
    let params = [];

    if (cargo !== 'MASTER') {
      filtroCondicional += ` AND EXISTS (
        SELECT 1
        FROM diario_obra do
        WHERE do.id_obra = de.id_obra
          AND do.data_diario = de.data_diario
          AND do.id_gestor = ?
      ) `;
      params.push(parseInt(id));
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

    // 🌟 QUERY ATUALIZADA COM A COLUNA TOTAL_ALOCADO
    const sql = `
      SELECT 
        resumo_diario.id_funcionario,
        resumo_diario.nome_funcionario,
        resumo_diario.matricula,
        resumo_diario.cargo,
        SUM(CASE WHEN resumo_diario.status_final = 'ALOCADO' THEN 1 ELSE 0 END) AS total_alocado, -- 🌟 Nova linha
        SUM(CASE WHEN resumo_diario.status_final = 'PRESENTE' THEN 1 ELSE 0 END) AS total_presente,
        SUM(CASE WHEN resumo_diario.status_final = 'FALTOU' THEN 1 ELSE 0 END) AS total_faltou,
        SUM(CASE WHEN resumo_diario.status_final = 'INTEGRAÇÃO' THEN 1 ELSE 0 END) AS total_integracao,
        SUM(CASE WHEN resumo_diario.status_final = 'FÉRIAS' THEN 1 ELSE 0 END) AS total_ferias,
        SUM(CASE WHEN resumo_diario.status_final = 'FOLGA' THEN 1 ELSE 0 END) AS total_folga,
        SUM(CASE WHEN resumo_diario.status_final NOT IN ('PRESENTE', 'FALTOU', 'INTEGRAÇÃO', 'FÉRIAS', 'FOLGA', 'ALOCADO') THEN 1 ELSE 0 END) AS total_outro -- 🌟 Incluído 'ALOCADO' aqui
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
// 🌟 ROTA DE AUDITORIA ATUALIZADA PARA LER A NOVA TABELA
// ========================================================
router.get('/gestor/auditoria-ausencias', async (req, res) => {
  try {
    const { id, cargo, id_obra, data_inicio, data_fim } = req.query;

    if (!id || !data_inicio || !data_fim || !id_obra) {
      return res.status(400).json({ error: "Parâmetros de auditoria insuficientes." });
    }

    // Buscamos os dados agrupados direto da nossa nova tabela de controle!
    let sql = `
      SELECT data_diario, equipe, status_rdo
      FROM controle_diarios_equipe
      WHERE data_diario BETWEEN ? AND ? AND id_obra = ?
    `;
    const params = [data_inicio, data_fim, Number(id_obra)];

    // Se o usuário não for MASTER, filtramos para garantir que ele só veja obras que gerencia
    if (cargo !== 'MASTER') {
      sql += ` AND id_obra IN (SELECT id_obra FROM gestor_obras WHERE id_usuario = ?)`;
      params.push(Number(id));
    }

    const [resultados] = await db.execute(sql, params);
    
    // Mapeamos e estruturamos os dados por DATA para o Front-end ler facilmente
    const estruturaPorData = {};

    resultados.forEach(linha => {
      // Garante que a data esteja no formato texto 'YYYY-MM-DD'
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

  // Validação inicial de segurança dos parâmetros obrigatórios
  if (!id || !cargo || !id_obra) {
    return res.status(400).json({
      error: "Parâmetros id, cargo e id_obra são obrigatórios para consolidar os diários."
    });
  }

  try {
    // Filtro inicial por obra e exclusão explícita da equipe de FOLGUISTAS
    let filtroCondicional = " WHERE do.id_obra = ? AND TRIM(UPPER(cde.equipe)) != 'FOLGUISTAS' ";
    let params = [parseInt(id_obra)];

    // Se o usuário logado não for MASTER, ele só pode ver os diários criados por ele mesmo
    if (cargo !== 'MASTER') {
      filtroCondicional += " AND do.id_gestor = ? ";
      params.push(parseInt(id));
    }

    // 1️⃣ CONSULTA DOS CARDS: Soma e agrupa os status exatos por RDO de cada Equipe
    const queryIndicadores = `
      SELECT
        COUNT(cde.id) AS total_diarios,
        SUM(CASE WHEN TRIM(UPPER(cde.status)) = 'CHOVEU' THEN 1 ELSE 0 END) AS dias_chuva,
        SUM(CASE WHEN TRIM(UPPER(cde.status)) = 'SEM MATERIAL' THEN 1 ELSE 0 END) AS sem_material,
        SUM(CASE WHEN TRIM(UPPER(cde.status)) = 'NORMAL' THEN 1 ELSE 0 END) AS dias_normais,
        SUM(CASE WHEN TRIM(UPPER(cde.status)) = 'OUTROS' THEN 1 ELSE 0 END) AS outros
      FROM controle_diarios_equipe cde
      INNER JOIN diario_obra do ON cde.id_diario = do.id
      ${filtroCondicional};
    `;

    // 2️⃣ CONSULTA DA TABELA: Puxa o histórico detalhado com o nome da Equipe e Data
    const queryTabela = `
      SELECT 
        cde.id, 
        do.data_diario, 
        cde.equipe,
        cde.status
      FROM controle_diarios_equipe cde
      INNER JOIN diario_obra do ON cde.id_diario = do.id
      ${filtroCondicional}
      ORDER BY do.data_diario DESC, cde.equipe ASC;
    `;

    // Executa ambas as consultas no banco de dados
    const [dadosIndicadores] = await db.execute(queryIndicadores, params);
    const [dadosTabela] = await db.execute(queryTabela, params);

    // Captura a primeira linha resultante da agregação dos cards
    const linha = (dadosIndicadores && dadosIndicadores.length > 0) ? dadosIndicadores[0] : null;

    // 🔍 FERRAMENTA DE RASTREIO NO TERMINAL DO BACK-END
    console.log(" \n=== 🛠️ RASTREIO BACK-END: STATUS DIÁRIOS ===");
    console.log(`Filtros Recebidos -> id_gestor: ${id} | cargo: ${cargo} | id_obra: ${id_obra}`);
    console.log("Parâmetros aplicados no SQL (Array):", params);
    console.log("Resultado bruto dos Cards (dadosIndicadores):", dadosIndicadores);
    console.log(`Quantidade de RDOs encontrados para a tabela: ${dadosTabela ? dadosTabela.length : 0}`);
    if (dadosTabela && dadosTabela.length > 0) {
      console.log("Exemplo do primeiro RDO retornado do banco:", dadosTabela[0]);
    }
    console.log("=============================================\n");

    // Retorna os dados estruturados para o Front-end
    res.status(200).json({
      indicadores: {
        total_diarios: linha ? (Number(linha.total_diarios) || 0) : 0,
        dias_chuva: linha ? (Number(linha.dias_chuva) || 0) : 0,
        sem_material: linha ? (Number(linha.sem_material) || 0) : 0,
        dias_normais: linha ? (Number(linha.dias_normais) || 0) : 0,
        outros: linha ? (Number(linha.outros) || 0) : 0
      },
      listaDiarios: dadosTabela || []
    });

  } catch (err) {
    console.error("❌ Erro fatal ao computar indicadores consolidados:", err);
    res.status(500).json({
      error: "Erro interno no servidor ao gerar os indicadores e status da obra."
    });
  }
});
// ========================================================
// INDICADORES E LISTAGEM CONSOLIDADA POR RDO (EQUIPES) ✅ (VERSÃO ÚNICA E CORRIGIDA)
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

    // 1️⃣ CONSULTA DOS CARDS: Agrega as condições vindas da tabela pai (do.status)
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

    // 2️⃣ CONSULTA DA TABELA: Histórico detalhado por equipe
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
      indicadores: {
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
// 🌟 ROTA CORRIGIDA: HISTÓRICO DE MATERIAIS (FILTRANDO PENDENTES) ⚙️
// ========================================================
router.get('/gestor/historico-materiais', async (req, res) => {
  try {
    const { id, cargo, id_obra, data_inicio, data_fim } = req.query;

    console.log('\n========== [DIAGNÓSTICO] /gestor/historico-materiais ==========');
    console.log('[1] Parâmetros recebidos:', { id, cargo, id_obra, data_inicio, data_fim });

    if (!id) {
      return res.status(400).json({ error: "ID numérico do usuário não foi fornecido." });
    }

    // 1️⃣ QUERY DA LISTA/TABELA PRINCIPAL
    // Mudamos para LEFT JOIN no controle para garantir que dados históricos não sumam, 
    // mas adicionamos a trava correta para sumir com os PENDENTES.
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
        -- 🌟 SE EXISTIR UM CONTROLE, ELE NÃO PODE SER PENDENTE. SE NÃO EXISTIR, EXIBE O HISTÓRICO NORMALMENTE.
        AND (cde.status_rdo IS NULL OR TRIM(UPPER(cde.status_rdo)) <> 'PENDENTE')
    `;

    const params = [];

    // Filtros de segurança por cargo
    if (cargo !== 'MASTER') {
      if (data_inicio && data_fim) {
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

    // Executa a busca da tabela no lugar correto (depois que a string SQL foi montada)
    const [resultadosTabela] = await db.execute(sql, params);

    // 🔍 LOG DE RASTREAMENTO POSICIONADO NO LUGAR CORRETO:
    console.log('\n🔍 [RASTREAMENTO DE DADOS RETORNADOS]:');
    if (resultadosTabela.length === 0) {
      console.log('Nenhum dado retornado do banco para a tabela.');
    } else {
      resultadosTabela.slice(0, 5).forEach((linha, index) => {
        console.log(`Linha [${index}] -> Data: ${linha.data_diario} | Equipe: "${linha.equipe}" | Tem Diário ID: ${linha.id ? 'SIM ('+linha.id+')' : 'NÃO (NULO)'}`);
      });
    }

    // 2️⃣ QUERY ISOLADA DO GRÁFICO DE MATERIAIS
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

    // 3️⃣ RETORNA A RESPOSTA PARA O FRONT-END
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
export default router;