import express from 'express';
const router = express.Router();

// Caminho para a estrutura real do banco
import db from '../../db.js';

// Função utilitária para tratar datas vindas do frontend
// Função utilitária para tratar datas vindas do frontend removendo o formato ISO (T00:00:00...)
const formatarData = (d) => {
  if (d === '' || d === undefined || d === null) return null;
  // Se a data vier com o formato ISO completo, extrai apenas a data 'YYYY-MM-DD'
  if (typeof d === 'string' && d.includes('T')) {
    return d.split('T')[0];
  }
  return d;
};

// ========================================================
// A. GET: LISTAR TODOS OS FUNCIONÁRIOS (TABELA RH GERAL)
// ========================================================
router.get('/rh/funcionarios-geral', async (req, res) => {
  try {
    const sql = `
      SELECT 
        id, matricula, nome, cargo, ativo, cpf, telefone, 
        tam_calca, tam_camisa, tam_calcado, atualizado_em,
        data_admissao, data_postagem_aso_pasta, data_documentos_rh_completos
      FROM funcionarios 
      WHERE ativo = 'ATIVO' 
      ORDER BY nome ASC
    `;
    const [rows] = await db.execute(sql);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar todos os funcionários:", err);
    res.status(500).json({ error: "Erro ao carregar lista completa de RH." });
  }
});

// ========================================================
// B. POST: CADASTRAR NOVO FUNCIONÁRIO COM VÍNCULO AO GESTOR
// ========================================================
router.post('/rh/funcionarios', async (req, res) => {
  const { 
    nome, matricula, cargo, 
    cpf, telefone, tam_calca, tam_camisa, tam_calcado,
    id_usuario_gestor, id_usuario_cadastro,
    data_admissao, data_postagem_aso_pasta, data_documentos_rh_completos
  } = req.body;

  if (!nome || !matricula || !cargo) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes (nome, matricula ou cargo)." });
  }

  try {
    let idNovoFuncionario = null;

    const sqlFuncionario = `
      INSERT INTO funcionarios 
        (nome, matricula, cargo, ativo, cpf, telefone, tam_calca, tam_camisa, tam_calcado,
         data_admissao, data_postagem_aso_pasta, data_documentos_rh_completos) 
      VALUES (?, ?, ?, 'INTEGRAÇÃO PENDENTE', ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const calcadoFinal = (tam_calcado === '' || tam_calcado === undefined || tam_calcado === null) 
      ? null 
      : parseInt(tam_calcado, 10);

    const [resultadoFunc] = await db.execute(sqlFuncionario, [
      nome.trim(), 
      matricula.trim(), 
      cargo.trim(), 
      cpf && cpf.trim() !== '' ? cpf.trim() : null,
      telefone && telefone.trim() !== '' ? telefone.trim() : null,
      tam_calca && tam_calca.trim() !== '' ? tam_calca.trim() : null,
      tam_camisa && tam_camisa.trim() !== '' ? tam_camisa.trim() : null,
      calcadoFinal,
      formatarData(data_admissao),
      formatarData(data_postagem_aso_pasta),
      formatarData(data_documentos_rh_completos)
    ]);

    idNovoFuncionario = resultadoFunc.insertId;

    if (id_usuario_gestor) {
      const sqlVinculo = `
        INSERT INTO gestor_funcionarios 
          (id_usuario, id_funcionario, id_obra, data_inicio, data_fim, id_usuario_alteracao) 
        VALUES (?, ?, 0, NOW(), NULL, ?)
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

    const sqlInicializarIntegracao = `
      INSERT INTO integracoes_funcionarios (id_funcionario) VALUES (?)
    `;
    await db.execute(sqlInicializarIntegracao, [idNovoFuncionario]);

    return res.status(201).json({ 
      success: true, 
      message: 'Funcionário cadastrado, vinculado e enviado para a esteira de integração!' 
    });

  } catch (error) {
    console.error("🚨 ERRO DETALHADO NO BANCO:", error);

    if (error.errno === 1062 || error.code === 'ER_DUP_ENTRY') {
      const mensagemErro = error.message || '';
      if (mensagemErro.includes('matricula')) {
        return res.status(400).json({ error: 'Esta matrícula já está cadastrada.' });
      }
      if (mensagemErro.includes('cpf')) {
        return res.status(400).json({ error: 'Este CPF já está cadastrado.' });
      }
    }

    return res.status(500).json({ 
      error: `Erro no Banco de Dados: ${error.message || 'Erro desconhecido.'}`,
      sqlMessage: error.sqlMessage,
      code: error.code
    });
  }
});

// ========================================================
// C. PUT: ATUALIZAR CRONOLOGIA DE INTEGRAÇÃO DO FUNCIONÁRIO
// ========================================================
router.put('/rh/funcionarios/:id/integracao', async (req, res) => {
  const id_funcionario = req.params.id;
  const {
    data_documentos_sst,
    data_enviados,
    data_recebidos,
    data_postado_bex,
    data_analise,
    data_integracao_agendada,
    data_integracao
  } = req.body;

  try {
    // 💡 SEGURANÇA: Garante que a linha de integração exista antes de tentar dar UPDATE
    const sqlVerificar = `SELECT id_funcionario FROM integracoes_funcionarios WHERE id_funcionario = ?`;
    const [existe] = await db.execute(sqlVerificar, [id_funcionario]);
    
    if (existe.length === 0) {
      const sqlCriarEspaco = `INSERT INTO integracoes_funcionarios (id_funcionario) VALUES (?)`;
      await db.execute(sqlCriarEspaco, [id_funcionario]);
    }

    const sqlUpdateIntegracao = `
      UPDATE integracoes_funcionarios SET
        data_documentos_sst = ?,
        data_enviados = ?,
        data_recebidos = ?,
        data_postado_bex = ?,
        data_analise = ?,
        data_integracao_agendada = ?,
        data_integracao = ?
      WHERE id_funcionario = ?
    `;

    await db.execute(sqlUpdateIntegracao, [
      formatarData(data_documentos_sst),
      formatarData(data_enviados),
      formatarData(data_recebidos),
      formatarData(data_postado_bex),
      formatarData(data_analise),
      formatarData(data_integracao_agendada),
      formatarData(data_integracao),
      id_funcionario
    ]);

    if (data_integracao && data_integracao.trim() !== '') {
      const sqlAtivarFuncionario = `
        UPDATE funcionarios 
        SET ativo = 'ATIVO' 
        WHERE id = ?
      `;
      await db.execute(sqlAtivarFuncionario, [id_funcionario]);
      
      return res.json({ 
        success: true, 
        message: 'Cronologia salva! Como a integração foi concluída, o funcionário agora está ATIVO.' 
      });
    }

    return res.json({ success: true, message: 'Cronologia de integração updated com sucesso!' });

  } catch (error) {
    console.error("Erro ao atualizar integração:", error);
    return res.status(500).json({ error: "Erro interno ao atualizar os dados de integração." });
  }
});

// ========================================================
// E. PUT: ATUALIZAR FUNCIONÁRIO (EDIÇÃO DIRETA NO CADASTRO DO RH)
// ========================================================
router.put('/rh/funcionarios/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    nome, matricula, cargo, ativo, 
    cpf, telefone, tam_calca, tam_camisa, tam_calcado,
    data_admissao, data_postagem_aso_pasta, data_documentos_rh_completos
  } = req.body;

  if (!nome || !matricula || !cargo || !ativo) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes." });
  }

  try {
    const sql = `
      UPDATE funcionarios 
      SET 
        nome = ?, 
        matricula = ?, 
        cargo = ?, 
        ativo = ?, 
        cpf = ?, 
        telefone = ?, 
        tam_calca = ?, 
        tam_camisa = ?, 
        tam_calcado = ?,
        data_admissao = ?,
        data_postagem_aso_pasta = ?,
        data_documentos_rh_completos = ?,
        atualizado_em = NOW() 
      WHERE id = ?
    `;
    
    await db.execute(sql, [
      nome.trim(), 
      matricula.trim(), 
      cargo.trim(), 
      ativo, 
      cpf ? cpf.trim() : null,
      telefone ? telefone.trim() : null,
      tam_calca ? tam_calca.trim() : null,
      tam_camisa ? tam_camisa.trim() : null,
      tam_calcado ? tam_calcado.trim() : null,
      formatarData(data_admissao),
      formatarData(data_postagem_aso_pasta),
      formatarData(data_documentos_rh_completos),
      parseInt(id)
    ]);
    
    res.json({ success: true, message: "Dados updated com sucesso!" });
  } catch (err) {
    console.error("Erro no banco ao atualizar funcionário:", err);
    res.status(500).json({ error: "Erro ao atualizar dados do funcionário no banco." });
  }
});

// ========================================================
// F. GET: LISTAR FUNCIONÁRIOS EM PROCESSO DE INTEGRAÇÃO (CORRIGIDO)
// ========================================================
router.get('/rh/integracoes-pendentes', async (req, res) => {
  try {
    // 💡 MODIFICADO: Alterado de INNER JOIN para LEFT JOIN 
    // Garante que mesmo os funcionários modificados para pendente apareçam aqui!
    const sql = `
      SELECT 
        f.id, f.nome, f.matricula, f.cargo, f.ativo,
        f.data_admissao, f.data_postagem_aso_pasta, f.data_documentos_rh_completos,
        i.data_documentos_sst, i.data_enviados, i.data_recebidos,
        i.data_postado_bex, i.data_analise, i.data_integracao_agendada, i.data_integracao
      FROM funcionarios f
      LEFT JOIN integracoes_funcionarios i ON f.id = i.id_funcionario
      WHERE f.ativo = 'INTEGRAÇÃO PENDENTE'
      ORDER BY f.nome ASC
    `;
    const [rows] = await db.execute(sql);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar integrações pendentes:", err);
    res.status(500).json({ error: "Erro ao carregar a esteira de integração." });
  }
});

// ========================================================
// G. GET: LISTAR APENAS GESTORES (PARA O SELECT DO RH)
// ========================================================
router.get('/rh/gestores-disponiveis', async (req, res) => {
  try {
    const sql = `
      SELECT id AS id_usuario, nome AS nome_gestor
      FROM usuarios_sistema
      WHERE cargo = 'GESTOR'
      ORDER BY nome ASC
    `;
    const [rows] = await db.execute(sql);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar gestores:", err);
    res.status(500).json({ error: "Erro ao carregar lista de gestores." });
  }
});
// =========================================================================
// ROTAS DE GESTÃO DE VEÍCULOS E FROTA INTELIGENTE
// =========================================================================

// 1. ROTA GET: LISTAR TODOS OS VEÍCULOS DA FROTA
router.get('/veiculos', async (req, res) => {
    try {
        // Busca todos os veículos ordenando pelo ID decrescente (mais recentes primeiro)
        const [rows] = await db.query('SELECT * FROM veiculos ORDER BY id DESC');
        return res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar veículos no banco:', err.message);
        return res.status(500).json({ error: 'Erro interno ao listar a frota de veículos.' });
    }
});

// 2. ROTA POST: CADASTRAR NOVO VEÍCULO (COM TITULARIDADE E STATUS AUTOMÁTICO)
router.post('/veiculos', async (req, res) => {
    const { placa, marca, modelo, ano, tipo, titularidade, descricao, status, id_funcionario } = req.body;

    // Validação estrita de presença dos campos obrigatórios (Incluída a titularidade)
    if (!placa || !marca || !modelo || !ano || !tipo || !titularidade) {
        return res.status(400).json({ error: 'Os campos Placa, Marca, Modelo, Ano, Tipo e Titularidade são obrigatórios.' });
    }

    // Tratamento e formatação rígida dos dados para evitar valores 'undefined'
    const placaFormatada = String(placa).trim().toUpperCase();
    const marcaFormatada = String(marca).trim();
    const modeloFormatada = String(modelo).trim();
    const anoFormatado = parseInt(ano, 10);
    const tipoFormatado = String(tipo).trim();
    const titularidadeFormatada = String(titularidade).trim().toUpperCase(); // Formatado
    const descricaoFormatada = descricao && String(descricao).trim() !== '' ? String(descricao).trim() : null;
    const funcionarioId = id_funcionario && String(id_funcionario).trim() !== '' ? parseInt(id_funcionario, 10) : null;

    // Regra de negócio automatizada: Manutenção define o status, mas não descarta o ID do funcionário
    let statusFinal = 'DISPONÍVEL';
    if (status === 'EM MANUTENÇÃO') {
        statusFinal = 'EM MANUTENÇÃO';
    } else if (funcionarioId) {
        statusFinal = 'EM USO';
    }

    const sql = `
        INSERT INTO veiculos (placa, marca, modelo, ano, tipo, titularidade, descricao, status, id_funcionario) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
        const parametros = [
            placaFormatada || '',
            marcaFormatada || '',
            modeloFormatada || '',
            isNaN(anoFormatado) ? null : anoFormatado,
            tipoFormatado || '',
            titularidadeFormatada || '', // Passado no parâmetro
            descricaoFormatada, 
            statusFinal || 'DISPONÍVEL',
            isNaN(funcionarioId) ? null : funcionarioId 
        ];

        const [result] = await db.query(sql, parametros);
        
        return res.status(201).json({ 
            message: 'Veículo registrado com sucesso na frota!', 
            id: result.insertId 
        });

    } catch (err) {
        console.error('Erro interno detectado ao inserir veículo:', err.message);
        
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Já existe um veículo cadastrado com esta placa!' });
        }
        
        return res.status(500).json({ error: `Erro no banco de dados: ${err.message}` });
    }
});

// 3. ROTA PUT: ATUALIZAR UM VEÍCULO EXISTENTE
router.put('/veiculos/:id', async (req, res) => {
    const { id } = req.params;
    const { placa, marca, modelo, ano, tipo, titularidade, descricao, status, id_funcionario } = req.body;

    // Validação estrita dos campos obrigatórios (Incluída a titularidade)
    if (!placa || !marca || !modelo || !ano || !tipo || !titularidade) {
        return res.status(400).json({ error: 'Os campos Placa, Marca, Modelo, Ano, Tipo e Titularidade são obrigatórios.' });
    }

    const placaFormatada = String(placa).trim().toUpperCase();
    const marcaFormatada = String(marca).trim();
    const modeloFormatada = String(modelo).trim();
    const anoFormatado = parseInt(ano, 10);
    const tipoFormatado = String(tipo).trim();
    const titularidadeFormatada = String(titularidade).trim().toUpperCase(); // Formatado
    const descricaoFormatada = descricao && String(descricao).trim() !== '' ? String(descricao).trim() : null;
    const funcionarioId = id_funcionario && String(id_funcionario).trim() !== '' ? parseInt(id_funcionario, 10) : null;

    let statusFinal = 'DISPONÍVEL';
    if (status === 'EM MANUTENÇÃO') {
        statusFinal = 'EM MANUTENÇÃO';
    } else if (funcionarioId) {
        statusFinal = 'EM USO';
    }

    const sql = `
        UPDATE veiculos 
        SET placa = ?, marca = ?, modelo = ?, ano = ?, tipo = ?, titularidade = ?, descricao = ?, status = ?, id_funcionario = ? 
        WHERE id = ?
    `;

    try {
        const parametros = [
            placaFormatada, 
            marcaFormatada, 
            modeloFormatada, 
            isNaN(anoFormatado) ? null : anoFormatado,
            tipoFormatado, 
            titularidadeFormatada, // Adicionado aqui
            descricaoFormatada, 
            statusFinal, 
            isNaN(funcionarioId) ? null : funcionarioId,
            parseInt(id, 10)
        ];

        const [result] = await db.query(sql, parametros);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Veículo não encontrado para atualização.' });
        }

        return res.json({ message: 'Veículo atualizado com sucesso na frota!' });
    } catch (err) {
        console.error('Erro ao atualizar veículo:', err.message);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Já existe outro veículo cadastrado com esta placa!' });
        }
        return res.status(500).json({ error: `Erro no banco de dados: ${err.message}` });
    }
});

// 4. ROTA DELETE: REMOVER UM VEÍCULO DA FROTA
router.delete('/veiculos/:id', async (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM veiculos WHERE id = ?';

    try {
        const [result] = await db.query(sql, [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Veículo não encontrado ou já removido.' });
        }
        
        return res.json({ message: 'Veículo removido da frota com sucesso.' });
    } catch (err) {
        console.error('Erro ao deletar veículo no banco:', err.message);
        return res.status(500).json({ error: 'Erro interno ao tentar excluir o veículo do sistema.' });
    }
});

export default router;