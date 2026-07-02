import express from 'express';
const router = express.Router();

// Caminho para a estrutura real do banco
import db from '../../db.js';

// ========================================================
// 1. POST: LOGIN DO SISTEMA (usuarios_sistema)
// ========================================================
router.post('/login', async (req, res) => {
  const { usuario, senha } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ error: "Preencha o usuário e a senha." });
  }

  try {
    const sql = "SELECT id, nome, usuario, senha, cargo FROM usuarios_sistema WHERE usuario = ?";
    const [rows] = await db.execute(sql, [usuario.trim()]);

    if (rows.length === 0) {
      return res.status(401).json({ error: "Usuário não encontrado." });
    }

    const user = rows[0];

    if (String(senha) !== String(user.senha)) {
      return res.status(401).json({ error: "Senha incorreta." });
    }

    res.json({
      success: true,
      usuario: {
        id: user.id,
        id_usuario: user.nome,  // Nome do usuário para identificação visual
        nome: user.nome,
        cargo: user.cargo
      }
    });

  } catch (err) {
    console.error("Erro na autenticação:", err);
    res.status(500).json({ error: "Erro interno no servidor de autenticação." });
  }
});

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
// 3. GET: LISTAR FUNCIONÁRIOS DO GESTOR OU GLOBAL (MASTER/RH)
// ========================================================
router.get('/gestor/funcionarios-disponiveis', async (req, res) => {
  const { id, cargo, data_diario } = req.query;

  if (!id) {
    return res.status(400).json({ error: "ID do usuário não fornecido." });
  }

  try {
    let sql;
    let params;

    // 💡 Ajustado para trazer funcionários 'ATIVO' ou 'INTEGRAÇÃO PENDENTE' para o diário
    if (cargo === 'MASTER' || cargo === 'RH') {
      sql = `SELECT id, matricula, nome, cargo, ativo FROM funcionarios WHERE ativo IN ('ATIVO', 'INTEGRAÇÃO PENDENTE') ORDER BY nome ASC`;
      params = [];
    } else {
      if (data_diario && data_diario.trim() !== '') {
        sql = `
          SELECT f.id, f.matricula, f.nome, f.cargo, f.ativo 
          FROM gestor_funcionarios gf
          INNER JOIN funcionarios f ON gf.id_funcionario = f.id
          WHERE gf.id_usuario = ? AND f.ativo IN ('ATIVO', 'INTEGRAÇÃO PENDENTE')

          UNION

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
          FROM gestor_funcionarios gf
          INNER JOIN funcionarios f ON gf.id_funcionario = f.id
          WHERE gf.id_usuario = ? AND f.ativo IN ('ATIVO', 'INTEGRAÇÃO PENDENTE') 
          ORDER BY f.nome ASC
        `;
        params = [parseInt(id)];
      }
    }

    // 💡 Executa a listagem de funcionários
    const [funcionarios] = await db.execute(sql, params);

    // 💡 Executa a query de contagem que você criou!
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

    // Retorna um objeto contendo a lista e os dados do painel de contadores
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
// B. PUT: ATUALIZAR FUNCIONÁRIO (RH)
// Suporta chamadas para /rh/funcionarios/:id ou /api/rh/funcionarios/:id
// ========================================================
router.put(['/rh/funcionarios/:id', '/api/rh/funcionarios/:id'], async (req, res) => {
  const { id } = req.params;
  const { nome, matricula, cargo, ativo } = req.body;

  if (!nome || !matricula || !cargo || !ativo) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes." });
  }

  try {
    const sql = "UPDATE funcionarios SET nome = ?, matricula = ?, cargo = ?, ativo = ? WHERE id = ?";
    await db.execute(sql, [nome.trim(), matricula.trim(), cargo.trim(), ativo, parseInt(id)]);
    res.json({ success: true, message: "Dados atualizados com sucesso!" });
  } catch (err) {
    console.error("Erro no banco ao atualizar funcionário:", err);
    res.status(500).json({ error: "Erro ao atualizar dados do funcionário no banco." });
  }
});

// ========================================================
// C. DELETE: EXCLUIR FUNCIONÁRIO (RH)
// Suporta chamadas para /rh/funcionarios/:id ou /api/rh/funcionarios/:id
// ========================================================
router.delete(['/rh/funcionarios/:id', '/api/rh/funcionarios/:id'], async (req, res) => {
  const { id } = req.params;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    // Remove os vínculos do funcionário primeiro para evitar quebra de chave estrangeira
    await connection.execute("DELETE FROM gestor_funcionarios WHERE id_funcionario = ?", [id]);
    await connection.execute("DELETE FROM funcionarios WHERE id = ?", [id]);
    
    await connection.commit();
    res.json({ success: true, message: "Funcionário deletado com sucesso!" });
  } catch (err) {
    await connection.rollback();
    console.error("Erro no banco ao deletar funcionário:", err);
    res.status(500).json({ error: "Erro ao remover funcionário do banco." });
  } finally {
    connection.release();
  }
});
// ========================================================
// 4. GET: RECUPERAR HISTÓRICO DO DIÁRIO (OBRA + DATA)
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
        SELECT id, id_funcionario, id_obra, equipe,
              nome, cargo, matricula, turno, status_presenca, observacao 
        FROM diario_efetivo 
        WHERE data_diario = ? AND id_obra = ?
        ORDER BY equipe ASC, nome ASC
`;
      params = [data_diario, parseInt(id_obra)];
    } else {
      sql = `
        SELECT id, id_funcionario, id_obra, equipe,
              nome, cargo, matricula, turno, status_presenca, observacao 
        FROM diario_efetivo 
        WHERE data_diario = ?
        ORDER BY equipe ASC, nome ASC
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
// 6. POST: SALVAR DIÁRIO TÉCNICO COMPLETO (PRODUÇÃO + MATERIAIS) ✅ ATUALIZADO
// ========================================================
router.post('/gestor/salvar-diario-completo', async (req, res) => {
  const { data_diario, id_obra, id_gestor, equipe, efetivo_confirmado, atividades_tachas, materiais_apontados, observacoes } = req.body;
  
  if (!data_diario || !id_obra || !id_gestor || !equipe) {
    return res.status(400).json({ error: "Dados obrigatórios ausentes (Data, Obra, ID Gestor ou Identificação da Equipe)." });
  }

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
      await connection.execute(
        'UPDATE diario_obra SET observacoes = ?, id_gestor = ? WHERE id = ?',
        [observacoes || null, parseInt(id_gestor), diarioId]
      );
    } else {
      // Cria o registro técnico mestre vinculando a respectiva equipe
      const [resultadoInsereMestre] = await connection.execute(
        'INSERT INTO diario_obra (id_obra, data_diario, observacoes, id_gestor, equipe) VALUES (?, ?, ?, ?, ?)',
        [parseInt(id_obra), data_diario, observacoes || null, parseInt(id_gestor), String(equipe).trim()]
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

    // 🌟 SEÇÃO ADICIONADA: Limpa e reinsere os materiais apontados por esta equipe
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
    console.error("Erro ao salvar RDO Completo por Equipe:", err);
    res.status(500).json({ error: "Erro interno ao salvar diário completo." });
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
      materiais_apontados: materiaisRows // 🌟 RETORNO ADICIONADO
    });

  } catch (err) {
    console.error("Erro ao recuperar diário completo por equipe:", err);
    res.status(500).json({ error: "Erro interno ao buscar diário completo." });
  }
});
// ========================================================
// 7. POST: CADASTRAR NOVA OBRA (MASTER)
// ========================================================
router.post('/master/obras', async (req, res) => {
  // Adicionado 'tipo_obra' na desestruturação do corpo da requisição
  const { nome_obra, codigo_obra, status, tipo_obra } = req.body;

  if (!nome_obra || !codigo_obra) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }

  try {
    // Incluído 'tipo_obra' na Query SQL de inserção
    const sqlObra = 'INSERT INTO obras (nome_obra, codigo_obra, status, tipo_obra) VALUES (?, ?, ?, ?)';
    
    // Se o frontend não enviar o tipo_obra, ele assume 'PRODUTIVA' por padrão
    const [resultadoObra] = await db.execute(sqlObra, [
      nome_obra.trim(), 
      codigo_obra.trim(), 
      status || 'ATIVA',
      tipo_obra ? tipo_obra.trim().toUpperCase() : 'PRODUTIVA'
    ]);

    return res.status(201).json({ 
      success: true, 
      message: 'Obra criada com sucesso no sistema global!',
      id_obra: resultadoObra.insertId 
    });

  } catch (error) {
    console.error("Erro ao criar obra:", error);
    return res.status(500).json({ error: 'Erro interno ao salvar a obra.' });
  }
});

// ========================================================
// 7-B. PUT: ATUALIZAR DADOS DA OBRA (MASTER)
// ========================================================
router.put('/master/obras/:id', async (req, res) => {
  const { id } = req.params;
  // Adicionado 'tipo_obra' na desestruturação
  const { nome_obra, codigo_obra, status, tipo_obra } = req.body;

  // Incluído o 'tipo_obra' na verificação de campos obrigatórios
  if (!nome_obra || !codigo_obra || !status || !tipo_obra) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes." });
  }

  try {
    // Atualizado o comando SQL para fazer o SET do tipo_obra
    const sql = "UPDATE obras SET nome_obra = ?, codigo_obra = ?, status = ?, tipo_obra = ? WHERE id = ?";
    
    await db.execute(sql, [
      nome_obra.trim(), 
      codigo_obra.trim(), 
      status.trim().toUpperCase(), 
      tipo_obra.trim().toUpperCase(), // Garante que salve em caixa alta ('ADMINISTRATIVA', etc)
      parseInt(id)
    ]);
    
    res.json({ success: true, message: "Obra atualizada com sucesso!" });
  } catch (err) {
    console.error("Erro no banco ao atualizar obra:", err);
    res.status(500).json({ error: "Erro ao atualizar dados da obra no banco." });
  }
});

// ========================================================
// 7-C. GET: LISTAR TODAS AS OBRAS GLOBALMENTE (Ativas e Inativas - MASTER)
// ========================================================
router.get('/master/obras-geral', async (req, res) => {
  try {
    // Adicionado o campo 'tipo_obra' no SELECT para que o frontend consiga listá-lo
    const sql = "SELECT id, nome_obra, codigo_obra, status, tipo_obra FROM obras ORDER BY status ASC, nome_obra ASC";
    const [rows] = await db.execute(sql);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar todas as obras:", err);
    res.status(500).json({ error: "Erro interno ao carregar lista geral de obras." });
  }
});
// ========================================================
// 8. POST: CRIAR NOVO USUÁRIO DO SISTEMA (MASTER)
// ========================================================
router.post('/master/usuarios', async (req, res) => {
  const { nome, usuario, senha, cargo, ids_obras, ids_funcionarios } = req.body;

  if (!nome || !usuario || !senha || !cargo) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const sqlUser = 'INSERT INTO usuarios_sistema (nome, usuario, senha, cargo) VALUES (?, ?, ?, ?)';
    const [resultadoUser] = await connection.execute(sqlUser, [nome.trim(), usuario.trim(), String(senha).trim(), cargo]);
    const idNovoUsuario = resultadoUser.insertId;

    if (cargo === 'GESTOR' && Array.isArray(ids_obras)) {
      for (const idObra of ids_obras) {
        const [emUso] = await connection.execute(
          'SELECT id FROM gestor_obras WHERE id_obra = ? AND id_usuario != 1', 
          [idObra]
        );
        
        if (emUso.length > 0) {
          throw { customMessage: "Uma ou mais obras selecionadas já estão vinculadas a outro Gestor. Atualize a página." };
        }

        await connection.execute('INSERT INTO gestor_obras (id_usuario, id_obra) VALUES (?, ?)', [idNovoUsuario, idObra]);
      }
    }

    if (cargo === 'GESTOR' && Array.isArray(ids_funcionarios)) {
      const sqlVinculoFunc = 'INSERT INTO gestor_funcionarios (id_usuario, id_funcionario) VALUES (?, ?)';
      for (const idFunc of ids_funcionarios) {
        await connection.execute(sqlVinculoFunc, [idNovoUsuario, idFunc]);
      }
    }

    await connection.commit();
    res.status(201).json({ success: true, message: "Usuário gravado com sucesso!", id: idNovoUsuario });
  } catch (err) {
    await connection.rollback();
    
    if (err.customMessage) {
      return res.status(400).json({ error: err.customMessage });
    }
    if (err.errno === 1062 || err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: `O login '${usuario}' já está em uso.` });
    }
    console.error("Erro no cadastro:", err);
    res.status(500).json({ error: "Erro interno ao cadastrar usuário." });
  } finally {
    connection.release();
  }
});

// ========================================================
// 9. GET: LISTAR TODOS OS USUÁRIOS (MASTER) - CORRIGIDO DISTINCT
// ========================================================
router.get('/master/usuarios', async (req, res) => {
  try {
    const sql = `
      SELECT 
        u.id, u.nome, u.usuario, u.senha, u.cargo,
        IFNULL(GROUP_CONCAT(DISTINCT o.id SEPARATOR ','), '') AS id_obras,
        IFNULL(GROUP_CONCAT(DISTINCT f.id SEPARATOR ','), '') AS id_funcionarios,
        IFNULL(GROUP_CONCAT(DISTINCT o.nome_obra SEPARATOR ', '), 'Nenhuma') AS obras,
        IFNULL(GROUP_CONCAT(DISTINCT f.nome SEPARATOR ', '), 'Nenhum') AS funcionarios
      FROM usuarios_sistema u
      LEFT JOIN gestor_obras go ON u.id = go.id_usuario
      LEFT JOIN obras o ON go.id_obra = o.id
      LEFT JOIN gestor_funcionarios gf ON u.id = gf.id_usuario
      LEFT JOIN funcionarios f ON gf.id_funcionario = f.id
      GROUP BY u.id, u.nome, u.usuario, u.senha, u.cargo
      ORDER BY u.nome ASC
    `;
    const [rows] = await db.execute(sql);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar usuários:", err);
    res.status(500).json({ error: "Erro ao carregar lista de usuários." });
  }
});

// ========================================================
// 10. DELETE: EXCLUIR UM USUÁRIO DO SISTEMA (MASTER)
// ========================================================
router.delete('/master/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM gestor_obras WHERE id_usuario = ?', [id]);
    await connection.execute('DELETE FROM gestor_funcionarios WHERE id_usuario = ?', [id]);
    await connection.execute('DELETE FROM usuarios_sistema WHERE id = ?', [id]);
    await connection.commit();
    res.json({ success: true, message: "Usuário excluído com sucesso!" });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: "Erro ao remover usuário do sistema." });
  } finally {
    connection.release();
  }
});

// ========================================================
// 11. PUT: ATUALIZAR USUÁRIO (MASTER)
// ========================================================
router.put('/master/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, usuario, senha, cargo, ids_obras, ids_funcionarios } = req.body;

  if (!nome || !usuario || !cargo) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    let sqlUpdateUser, paramsUpdateUser;
    if (senha && String(senha).trim() !== '') {
      sqlUpdateUser = `UPDATE usuarios_sistema SET nome = ?, usuario = ?, senha = ?, cargo = ? WHERE id = ?`;
      paramsUpdateUser = [nome.trim(), usuario.trim(), String(senha).trim(), cargo, id];
    } else {
      sqlUpdateUser = `UPDATE usuarios_sistema SET nome = ?, usuario = ?, cargo = ? WHERE id = ?`;
      paramsUpdateUser = [nome.trim(), usuario.trim(), cargo, id];
    }
    await connection.execute(sqlUpdateUser, paramsUpdateUser);

    await connection.execute('DELETE FROM gestor_obras WHERE id_usuario = ?', [id]);
    if (cargo === 'GESTOR' && Array.isArray(ids_obras)) {
      const sqlVinculoObra = 'INSERT INTO gestor_obras (id_usuario, id_obra) VALUES (?, ?)';
      for (const idObra of ids_obras) {
        await connection.execute(sqlVinculoObra, [id, idObra]);
      }
    }

    await connection.execute('DELETE FROM gestor_funcionarios WHERE id_usuario = ?', [id]);
    if (cargo === 'GESTOR' && Array.isArray(ids_funcionarios)) {
      const sqlVinculoFunc = 'INSERT INTO gestor_funcionarios (id_usuario, id_funcionario) VALUES (?, ?)';
      for (const idFunc of ids_funcionarios) {
        await connection.execute(sqlVinculoFunc, [id, idFunc]);
      }
    }

    await connection.commit();
    res.json({ success: true, message: "Usuário updated com sucesso!" });
  } catch (err) {
    await connection.rollback();
    if (err.errno === 1062 || err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: `O login '${usuario}' já está em uso.` });
    }
    res.status(500).json({ error: "Erro interno ao atualizar usuário." });
  } finally {
    connection.release();
  }
});

// ========================================================
// 12. GET: LISTAR TODOS OS FUNCIONÁRIOS (GERAL PARA O RH)
// ========================================================
router.get(['/master/funcionarios-todos', '/funcionarios'], async (req, res) => {
  const { id_editando } = req.query;
  
  try {
    const paramId = id_editando ? parseInt(id_editando) : -1;
    
    // 💡 REMOVIDO o filtro de 'ativo' para que o RH consiga ver quem está INATIVO também!
    const sql = `
      SELECT id, matricula, nome, cargo, ativo 
      FROM funcionarios 
      WHERE id NOT IN (
          SELECT id_funcionario 
          FROM gestor_funcionarios 
          WHERE id_usuario != ? AND id_usuario != 1
        )
      ORDER BY nome ASC
    `;
    const [rows] = await db.execute(sql, [paramId]);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar funcionários:", err);
    res.status(500).json({ error: "Erro ao carregar funcionários." });
  }
});
// ========================================================
// 12-B. GET: LISTAR OBRAS DISPONÍVEIS NO FORMULÁRIO
// ========================================================
router.get('/master/obras-todas', async (req, res) => {
  const { id_editando } = req.query;
  
  try {
    const paramId = id_editando ? parseInt(id_editando) : -1;

    const sql = `
      SELECT id, codigo_obra, nome_obra 
      FROM obras 
      WHERE status = 'ATIVA'
      AND id NOT IN (
        SELECT id_obra 
        FROM gestor_obras 
        WHERE id_usuario != ? AND id_usuario != 1
      )
      ORDER BY nome_obra ASC
    `;
    const [rows] = await db.execute(sql, [paramId]);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar obras disponíveis:", err);
    res.status(500).json({ error: "Erro ao carregar obras globais." });
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
    res.json({ success: true, message: "Status atualizado com sucesso!" });
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
// NO SEU BACK-END: ROTA DO HISTÓRICO CORRIGIDA (PRODUÇÃO + MATERIAIS) ✅
// ========================================================
router.get('/gestor/historico-diarios', async (req, res) => {
  try {
    const { id, cargo, id_obra, data_inicio, data_fim } = req.query;

    // ===== LOGS DE DIAGNÓSTICO =====
    console.log('\n========== [DIAGNÓSTICO] /gestor/historico-diarios ==========');
    console.log('[1] Parâmetros recebidos (req.query):', { id, cargo, id_obra });

    if (!id) {
      console.log('[ERRO] ID não fornecido!');
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
        GROUP_CONCAT(DISTINCT CONCAT(da.tipo_servico, ': ', da.quantidade) SEPARATOR '\n') AS servicos_resumo,
        IFNULL(SUM(da.quantidade), 0) AS total_quantidade_produzida,

        -- 🌟 ADICIONADO: Busca os materiais vinculados a este diário específico (do.id)
        (
          SELECT GROUP_CONCAT(CONCAT(dma.material_nome, ': ', dma.quantidade) SEPARATOR '\n')
          FROM diario_materiais_apontados dma
          WHERE dma.id_diario = do.id
        ) AS materiais_resumo

      FROM diario_efetivo r
      INNER JOIN obras o ON r.id_obra = o.id
      LEFT JOIN diario_obra do ON do.id_obra = r.id_obra AND do.data_diario = r.data_diario AND do.equipe = r.equipe
      LEFT JOIN diario_atividades da ON da.id_diario = do.id
      WHERE 1=1
    `;

    const params = [];

    // Filtra pelo gestor que efetivamente assinou o diário da obra
    if (cargo !== 'MASTER') {
      sql += ` AND do.id_gestor = ? `;
      params.push(Number(id));
      console.log(`[3] Filtro GESTOR aplicado para id_gestor=${Number(id)}`);
    }

    if (id_obra && id_obra !== '') {
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
// 18. GET: HISTÓRICO DE PRESENÇA CONSOLIDADO 
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
      // Filtra presença apenas pelos diários assinados pelo gestor logado
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
      filterCondicional += ` AND de.data_diario >= ? `;
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
        SUM(CASE WHEN resumo_diario.status_final = 'PRESENTE' THEN 1 ELSE 0 END) AS total_presente,
        SUM(CASE WHEN resumo_diario.status_final = 'FALTOU' THEN 1 ELSE 0 END) AS total_faltou,
        SUM(CASE WHEN resumo_diario.status_final = 'INTEGRAÇÃO' THEN 1 ELSE 0 END) AS total_integracao,
        SUM(CASE WHEN resumo_diario.status_final = 'FÉRIAS' THEN 1 ELSE 0 END) AS total_ferias,
        SUM(CASE WHEN resumo_diario.status_final = 'FOLGA' THEN 1 ELSE 0 END) AS total_folga,
        SUM(CASE WHEN resumo_diario.status_final NOT IN ('PRESENTE', 'FALTOU', 'INTEGRAÇÃO', 'FÉRIAS', 'FOLGA') THEN 1 ELSE 0 END) AS total_outro
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
// GET: LISTAR TODOS OS FUNCIONÁRIOS (TABELA RH GERAL)
// ========================================================
router.get('/rh/funcionarios-geral', async (req, res) => {
  try {
    const sql = `
      SELECT id, matricula, nome, cargo 
      FROM funcionarios 
      WHERE ativo = 'ATIVO' 
      ORDER BY nome ASC
    `;
    const [rows] = await db.execute(sql);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar todos os funcionários:", err);
    res.status(500).json({ error: "Erro ao carrxxxxxegar lista completa de RH." });
  }
});
router.post('/rh/funcionarios', async (req, res) => {
  const { nome, matricula, cargo, ativo } = req.body;

  if (!nome || !matricula || !cargo) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes (nome, matricula ou cargo)." });
  }

  try {
    const sql = 'INSERT INTO funcionarios (nome, matricula, cargo, ativo) VALUES (?, ?, ?, ?)';
    const [resultado] = await db.execute(sql, [
      nome.trim(), 
      matricula.trim(), 
      cargo.trim(), 
      ativo || 'ATIVO'
    ]);

    res.status(201).json({ 
      success: true, 
      message: 'Funcionário cadastrado com sucesso!', 
      id: resultado.insertId 
    });
  } catch (error) {
    console.error("Erro ao cadastrar funcionário:", error);
    res.status(500).json({ error: 'Erro interno ao salvar o funcionário no banco de dados.' });
  }
});

export default router;