import React, { useState, useEffect } from 'react';
import axios from 'axios'; 
import { Users, Trash2, MoveHorizontal, Plus, X, Eye, EyeOff, Car, Wrench, AlertTriangle, CheckCircle } from 'lucide-react';

export default function DiarioEfetivo({ obrasDisponiveis, usuarioLogado }) {

  const [dataSelecionada, setDataSelecionada] = useState(new Date().toISOString().split('T')[0]);
  const [obraFiltro, setObraFiltro] = useState('');
  const [filtroEquipe, setFiltroEquipe] = useState('TODAS');
  const [funcionariosAlocados, setFuncionariosAlocados] = useState([]);
  const [todosOsAgendamentosDoDia, setTodosOsAgendamentosDoDia] = useState([]);
  const [listaFuncionariosDisponiveis, setListaFuncionariosDisponiveis] = useState([]);

  // Estados para a gestão e visibilidade dos veículos vinculados
  const [listaVeiculos, setListaVeiculos] = useState([]);
  const [mostrarTabelaVeiculos, setMostrarTabelaVeiculos] = useState(false);

  const [novaAlocacao, setNovaAlocacao] = useState({
    id_funcionario: '',
    turno: 'DIURNO',
    equipe: '', 
    observacao: ''
  });

  const [novaFolga, setNovaFolga] = useState({
    id_funcionario: '',
    observacao: 'Folga Programada'
  });
  
  // Estados para controlar a visibilidade das tabelas (no final do layout)
  const [mostrarResumoOcupacao, setMostrarResumoOcupacao] = useState(false);
  const [mostrarRemanejamento, setMostrarRemanejamento] = useState(false);

  // Estados do Modal de Remanejamento
  const [modalAberto, setModalAberto] = useState(false);
  const [remanejamentoDados, setRemanejamentoDados] = useState({
    id_funcionario: null, 
    nome_funcionario: '',
    id_gestor_destino: ''
  });
  const [listaGestores, setListaGestores] = useState([]);

  useEffect(() => {
    if (obrasDisponiveis && obrasDisponiveis.length > 0 && !obraFiltro) {
      setObraFiltro(obrasDisponiveis[0].id);
    }
  }, [obrasDisponiveis]);

  useEffect(() => {
    if (obraFiltro) {
      carregarAlocacoesDaObra();
    }
    carregarTodosOsAgendamentosDoDia();
    carregarFuncionariosDoGestor();
    carregarVeiculosDoSistema(); 
  }, [dataSelecionada, obraFiltro, novaAlocacao.turno]);

  const carregarVeiculosDoSistema = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/veiculos');
      setListaVeiculos(res.data || []);
    } catch (e) {
      console.error("Erro ao carregar veículos para o diário:", e);
    }
  };

  const carregarAlocacoesDaObra = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/gestor/diario-efetivo', {
        params: { data_diario: dataSelecionada, id_obra: obraFiltro }
      });
      setFuncionariosAlocados(res.data || []);
    } catch (e) {
      console.error("Erro ao carregar alocações da obra:", e);
    }
  };

  const carregarTodosOsAgendamentosDoDia = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/gestor/funcionarios-disponiveis-todos', {
        params: { data_diario: dataSelecionada }
      });
      const dados = Array.isArray(res.data) ? res.data : (res.data.registros || []);
      setTodosOsAgendamentosDoDia(dados);
    } catch (err) {
      console.error("⚠️ Erro ao carregar agendamentos globais:", err);
      setTodosOsAgendamentosDoDia([]);
    }
  };

  const carregarFuncionariosDoGestor = async () => {
    try {
      const usuario = usuarioLogado || JSON.parse(localStorage.getItem('usuario') || '{}');
      const params = { id: usuario?.id, cargo: usuario?.cargo, data_diario: dataSelecionada };
      const res = await axios.get('http://localhost:3001/api/gestor/funcionarios-disponiveis', { params });
      
      // Correção e normalização para garantir que toda a lista de funcionários do gestor seja salva
      const funcionariosTratados = res.data && res.data.funcionarios ? res.data.funcionarios : (Array.isArray(res.data) ? res.data : []);
      setListaFuncionariosDisponiveis(funcionariosTratados);
    } catch (e) {
      console.error("Erro ao carregar funcionários do gestor:", e);
    }
  };

  const carregarGestoresParaModal = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/gestor/lista-remanejamento-gestores');
      const usuario = usuarioLogado || JSON.parse(localStorage.getItem('usuario') || '{}');
      const idLogado = usuario?.id;
      const gestoresFiltrados = (res.data || []).filter(g => Number(g.id) !== Number(idLogado));
      setListaGestores(gestoresFiltrados);
    } catch (err) {
      console.error("Erro ao buscar gestores:", err);
    }
  };

  const handleAbrirRemanejamento = (func) => {
    setRemanejamentoDados({
      id_funcionario: func.id_funcionario || func.id,
      nome_funcionario: func.nome,
      id_gestor_destino: ''
    });
    carregarGestoresParaModal();
    setModalAberto(true);
  };

  const handleConfirmarTransferencia = async (e) => {
    e.preventDefault();
    const gestorDestinoObj = listaGestores.find(g => Number(g.id) === Number(remanejamentoDados.id_gestor_destino));

    if (!remanejamentoDados.id_gestor_destino || !gestorDestinoObj) {
      alert("Por favor, selecione o Gestor de Destino!");
      return;
    }

    try {
      const usuario = usuarioLogado || JSON.parse(localStorage.getItem('usuario') || '{}');
      const idUsuarioAlteracao = usuario?.id || null;

      const dadosPayload = {
        id_usuario: Number(remanejamentoDados.id_gestor_destino), 
        id_funcionario: Number(remanejamentoDados.id_funcionario),
        id_obra: obraFiltro ? Number(obraFiltro) : null, 
        data_inicio: dataSelecionada, 
        data_fim: null, 
        id_usuario_alteracao: idUsuarioAlteracao 
      };

      await axios.post('http://localhost:3001/api/gestor/remanezar-funcionario-vincular', dadosPayload);

      alert(
        `📢 NOTIFICAÇÃO ENVIADA COM SUCESSO!\n\n` +
        `Para: Engenheiro/Gestor ${gestorDestinoObj.nome}\n` +
        `Mensagem: "O colaborador ${remanejamentoDados.nome_funcionario} foi transferido para a sua gerência técnica a partir de ${dataSelecionada}."`
      );

      setModalAberto(false);
      await carregarAlocacoesDaObra();
      await carregarTodosOsAgendamentosDoDia();
      await carregarFuncionariosDoGestor();
    } catch (err) {
      console.error(err);
      alert("Erro ao realizar transferência e vincular funcionário ao novo gestor.");
    }
  };

  const ejecutarInclusaoFolga = async (funcionario, turnoAlvo, observacaoTexto, equipeTexto) => {
    try {
      const resAtual = await axios.get('http://localhost:3001/api/gestor/diario-efetivo', {
        params: { data_diario: dataSelecionada, id_obra: obraFiltro }
      });
      let listaEfetivoAtualizada = resAtual.data || [];

      const turnosParaAplicar = turnoAlvo === 'AMBOS' ? ['DIURNO', 'NOTURNO'] : [turnoAlvo];
      const nomeEquipeTratado = equipeTexto;

      const usuario = usuarioLogado || JSON.parse(localStorage.getItem('usuario') || '{}');
      const idGestorAtual = usuario?.id || null;

      turnosParaAplicar.forEach(turno => {
        listaEfetivoAtualizada = listaEfetivoAtualizada.filter(
          a => !(String(a.id_funcionario) === String(funcionario.id) && String(a.turno).toUpperCase() === turno)
        );

        listaEfetivoAtualizada.push({
          id_funcionario: funcionario.id,
          id_obra: Number(obraFiltro), 
          id_gestor: idGestorAtual, 
          nome: funcionario.nome || 'N/D',
          cargo: funcionario.cargo || 'N/D',
          matricula: funcionario.matricula || '',
          turno: turno,
          status_presenca: 'Folga', 
          observacao: observacaoTexto || 'Folga Programada',
          equipe: nomeEquipeTratado
        });
      });

      return await axios.post('http://localhost:3001/api/gestor/diario-efetivo', {
        data_diario: dataSelecionada,
        id_obra: Number(obraFiltro),
        efetivo: listaEfetivoAtualizada
      });

    } catch (err) {
      console.error("Erro ao aplicar folga:", err);
      throw err;
    }
  };

  const handleSalvarFolgaEspecifica = async (e) => {
    e.preventDefault();
    if (!obraFiltro || !novaFolga.id_funcionario) {
      alert("⚠️ Selecione a Obra ativa e o Funcionário para a folga!");
      return;
    }

    const funcionarioCompleto = listaFuncionariosDisponiveis.find(
      f => String(f.id) === String(novaFolga.id_funcionario)
    );

    if (!funcionarioCompleto) {
      alert("⚠️ Funcionário não encontrado.");
      return;
    }

    if (!window.confirm(`Confirmar registro de FOLGA para ${funcionarioCompleto.nome} nos turnos Diurno e Noturno?`)) {
      return;
    }

    try {
      await ejecutarInclusaoFolga(funcionarioCompleto, 'AMBOS', novaFolga.observacao, 'FOLGUISTAS');
      alert('Folga registrada com sucesso!');
      setFiltroEquipe('FOLGUISTAS');
      setNovaFolga({ id_funcionario: '', observacao: 'Folga Programada' });
      carregarAlocacoesDaObra();
      carregarTodosOsAgendamentosDoDia();
      carregarFuncionariosDoGestor();
    } catch {
      alert("Erro ao salvar folga no banco de dados.");
    }
  };

  const handleSalvarAlocacao = async (e) => {
    e.preventDefault();
    const nomeEquipeTratado = novaAlocacao.equipe ? novaAlocacao.equipe.trim() : '';

    if (!nomeEquipeTratado) {
      alert("⚠️ O preenchimento do nome da equipe é OBRIGATÓRIO!");
      return;
    }

    if (!obraFiltro || !novaAlocacao.id_funcionario) {
      alert("⚠️ Preencha a Obra e selecione um Funcionário!");
      return;
    }

    const funcionarioCompleto = listaFuncionariosDisponiveis.find(
      f => String(f.id) === String(novaAlocacao.id_funcionario)
    );

    if (!funcionarioCompleto) {
      alert("⚠️ Erro: Funcionário selecionado não foi encontrado na lista de disponíveis.");
      return;
    }

    const jaAlocadoNoTurno = todosOsAgendamentosDoDia.find(
      a => String(a.id_funcionario) === String(novaAlocacao.id_funcionario)
    );

    if (jaAlocadoNoTurno) {
      const dadosObraJaAlocada = obrasDisponiveis.find(o => Number(o.id) === Number(jaAlocadoNoTurno.id_obra));
      const nomeObraConflito = dadosObraJaAlocada ? dadosObraJaAlocada.nome_obra : `ID Obra ${jaAlocadoNoTurno.id_obra}`;
      alert(`⚠️ Impossível alocar! O colaborador já está escalado na equipe "${jaAlocadoNoTurno.equipe}" da obra: "${nomeObraConflito}".`);
      return;
    }

    try {
      const resAtual = await axios.get('http://localhost:3001/api/gestor/diario-efetivo', {
        params: { data_diario: dataSelecionada, id_obra: obraFiltro }
      });
      const todosOsTurnosEEquipesDessaObra = Array.isArray(resAtual.data) ? resAtual.data : [];

      const usuario = usuarioLogado || JSON.parse(localStorage.getItem('usuario') || '{}');
      const idGestorAtual = usuario?.id || null;

      const listaEfetivoAtualizada = [
        ...todosOsTurnosEEquipesDessaObra.map(a => ({
          id_funcionario: Number(a.id_funcionario),
          id_obra: a.id_obra || Number(obraFiltro),
          id_gestor: a.id_gestor || idGestorAtual,
          nome: a.nome || 'N/D',
          cargo: a.cargo || 'N/D',
          matricula: a.matricula || '',
          turno: a.turno,
          status_presenca: a.status_presenca || 'Presente',
          observacao: a.observacao || '',
          equipe: a.equipe ? a.equipe.trim() : 'Geral'
        })),
        {
          id_funcionario: Number(funcionarioCompleto.id),
          id_obra: Number(obraFiltro),
          id_gestor: idGestorAtual,
          nome: funcionarioCompleto.nome,
          cargo: funcionarioCompleto.cargo,
          matricula: funcionarioCompleto.matricula || '',
          turno: novaAlocacao.turno,
          status_presenca: 'Presente', 
          observacao: novaAlocacao.observacao || '',
          equipe: nomeEquipeTratado
        }
      ];

      await axios.post('http://localhost:3001/api/gestor/diario-efetivo', {
        data_diario: dataSelecionada,
        id_obra: Number(obraFiltro),
        efetivo: listaEfetivoAtualizada
      });
      
      setNovaAlocacao({ id_funcionario: '', turno: 'DIURNO', equipe: '', observacao: '' });
      
      carregarAlocacoesDaObra();
      carregarTodosOsAgendamentosDoDia();
      carregarFuncionariosDoGestor(); 
      
      alert("🚀 Funcionário alocado com sucesso!");
    } catch (err) {
      console.error("❌ Erro ao salvar alocação:", err);
      alert(`Erro crítico ao salvar alocação no banco de dados.`);
    }
  };

  const handleDeletarAlocacao = async (idFuncionario, turnoAloc, equipeAloc) => {
    if (!window.confirm("Remover este funcionário da escala?")) return;
    try {
      const resAtual = await axios.get('http://localhost:3001/api/gestor/diario-efetivo', {
        params: { data_diario: dataSelecionada, id_obra: obraFiltro }
      });
      const todosOsTurnosDessaObra = resAtual.data || [];
      const eFolguista = String(equipeAloc).toUpperCase() === 'FOLGUISTAS';

      const listaEfetivoAtualizada = todosOsTurnosDessaObra
        .filter(a => {
          if (eFolguista) {
            return !(String(a.id_funcionario) === String(idFuncionario) && String(a.equipe).toUpperCase() === 'FOLGUISTAS');
          }
          const eqA = String(a.equipe).toUpperCase();
          const eqB = String(equipeAloc).toUpperCase();
          return !(
            String(a.id_funcionario) === String(idFuncionario) && 
            String(a.turno).toUpperCase() === String(turnoAloc).toUpperCase() &&
            eqA === eqB
          );
        })
        .map(a => ({
          id_funcionario: a.id_funcionario,
          id_obra: a.id_obra || Number(obraFiltro),
          nome: a.nome || 'N/D',
          cargo: a.cargo || 'N/D',
          matricula: a.matricula || '',
          turno: a.turno,
          status_presenca: a.status_presenca || 'Presente',
          observacao: a.observacao || '',
          equipe: a.equipe.trim()
        }));

      await axios.post('http://localhost:3001/api/gestor/diario-efetivo', {
        data_diario: dataSelecionada,
        id_obra: Number(obraFiltro),
        efetivo: listaEfetivoAtualizada
      });
      
      carregarAlocacoesDaObra();
      carregarTodosOsAgendamentosDoDia();
      carregarFuncionariosDoGestor(); 
    } catch (err) {
      console.error("❌ Erro ao remover agendamento:", err);
      alert("Erro ao remover agendamento.");
    }
  };

  const obterStatusPorTurno = (idFuncionario, turnoAlvo) => {
    const agendamentoNoTurno = todosOsAgendamentosDoDia.find(
      a => String(a.id_funcionario) === String(idFuncionario) && String(a.turno).toUpperCase() === turnoAlvo
    );
    
    if (agendamentoNoTurno) {
      if (agendamentoNoTurno.status_presenca === 'Folga' || String(agendamentoNoTurno.equipe).toUpperCase() === 'FOLGUISTAS') {
        return { texto: 'FOLGA', alocado: true };
      }
      const dadosObra = obrasDisponiveis.find(o => Number(o.id) === Number(agendamentoNoTurno.id_obra));
      const nomeObra = dadosObra ? dadosObra.nome_obra : `Obra ID ${agendamentoNoTurno.id_obra}`;
      return { texto: `${nomeObra} [${agendamentoNoTurno.equipe}]`, alocado: true };
    }
    return { texto: 'Disponível / Banco', alocado: false };
  };

  // Filtro Dinâmico Corrigido: O funcionário só fica indisponível se já estiver alocado NO MESMO TURNO selecionado no formulário
  const funcionariosNaoAlocadosNoDia = listaFuncionariosDisponiveis.filter(func => {
    return !todosOsAgendamentosDoDia.some(agend => 
      String(agend.id_funcionario) === String(func.id) && 
      String(agend.turno).toUpperCase() === String(novaAlocacao.turno).toUpperCase()
    );
  });

  const veiculosDoQuadroAtivo = listaVeiculos.filter(v => 
    v.id_funcionario && listaFuncionariosDisponiveis.some(f => Number(f.id) === Number(v.id_funcionario))
  );

  // Paleta de Estilos Padronizada (Slate/Escura Unificada)
  const estilos = {
    card: { backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px' },
    tituloSecao: { fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', color: '#1e293b', fontSize: '12px' },
    label: { fontSize: '10px', fontWeight: 'bold', color: '#475569' },
    input: { height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' },
    select: { height: '32px', padding: '0 4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', backgroundColor: '#fff' },
    botaoPrincipal: { height: '32px', padding: '0 24px', backgroundColor: '#1e293b', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' },
    botaoSecundario: { display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#fff', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', color: '#1e293b' },
    th: { padding: '10px 12px', backgroundColor: '#1e293b', color: '#fff', textTransform: 'uppercase', fontSize: '11px' },
    td: { padding: '10px 12px', color: '#334155', borderBottom: '1px solid #e2e8f0' },
    badgeGeral: { backgroundColor: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1', padding: '3px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '10px' },
    badgeAlocado: { backgroundColor: '#e2e8f0', color: '#0f172a', border: '1px solid #94a3b8', padding: '3px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '10px' }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', boxSizing: 'border-box', position: 'relative' }}>
      
      {/* 1. PAINEL DE FILTROS */}
      <div style={estilos.card}>
        <div style={estilos.tituloSecao}>Parâmetros do Diário Técnico</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={estilos.label}>Data do Diário</label>
            <input type="date" style={estilos.input} value={dataSelecionada} onChange={e => setDataSelecionada(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={estilos.label}>Selecione a Obra para Gerenciamento *</label>
            <select style={estilos.select} value={obraFiltro} onChange={e => setObraFiltro(e.target.value)}>
              <option value="">-- Escolha uma Obra Ativa --</option>
              {obrasDisponiveis.map(o => (
                <option key={o.id} value={o.id}>[{o.codigo_obra}] {o.nome_obra}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. FORMULÁRIO DE ALOCAÇÃO DINÂMICA */}
      <div style={estilos.card}>
        <div style={estilos.tituloSecao}>Alocar e Criar Equipes Dinamicamente</div>
        <form onSubmit={handleSalvarAlocacao} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={estilos.label}>Funcionários Livres no Dia ({funcionariosNaoAlocadosNoDia.length}) *</label>
              <select required style={estilos.select} value={novaAlocacao.id_funcionario} onChange={e => setNovaAlocacao({...novaAlocacao, id_funcionario: e.target.value})}>
                <option value="">-- Escolha o Funcionário --</option>
                {funcionariosNaoAlocadosNoDia.map(f => (
                  <option key={f.id} value={f.id}>{f.nome} ({f.cargo})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={estilos.label}>Turno em Foco *</label>
              <select style={estilos.select} value={novaAlocacao.turno} onChange={e => setNovaAlocacao({...novaAlocacao, turno: e.target.value})}>
                <option value="DIURNO">DIURNO</option>
                <option value="NOTURNO">NOTURNO</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={estilos.label}>Nome da Equipe *</label>
              <input 
                required
                type="text" 
                placeholder="Ex: Equipe 1, Alfa..."
                style={estilos.input} 
                value={novaAlocacao.equipe} 
                onChange={e => setNovaAlocacao({...novaAlocacao, equipe: e.target.value})}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={estilos.label}>Observação Adicional</label>
              <input type="text" placeholder="Ex: Motorista..." style={estilos.input} value={novaAlocacao.observacao} onChange={e => setNovaAlocacao({...novaAlocacao, observacao: e.target.value})} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" style={estilos.botaoPrincipal}>
              <Plus style={{ width: '14px', height: '14px' }} /> Alocar na Escala ({novaAlocacao.turno})
            </button>
          </div>
        </form>
      </div>

      {/* PROGRAMAÇÃO DE FOLGA DIRETA */}
      <div style={estilos.card}>
        <div style={estilos.tituloSecao}>Programar Folga Direta (Lançamento Rápido — Ambos os Turnos)</div>
        <form onSubmit={handleSalvarFolgaEspecifica} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={estilos.label}>Colaborador que entrará em Folga *</label>
              <select required style={estilos.select} value={novaFolga.id_funcionario} onChange={e => setNovaFolga({...novaFolga, id_funcionario: e.target.value})} >
                <option value="">-- Selecione o Colaborador --</option>
                {funcionariosNaoAlocadosNoDia.map(f => (
                  <option key={f.id} value={f.id}>{f.nome} ({f.cargo})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={estilos.label}>Motivo / Observação</label>
              <input type="text" style={estilos.input} value={novaFolga.observacao} onChange={e => setNovaFolga({...novaFolga, observacao: e.target.value})} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" style={estilos.botaoPrincipal} >
              Confirmar Registro de Folga
            </button>
          </div>
        </form>
      </div>

      {/* SEÇÃO STATUS DE VEÍCULOS VINCULADOS */}
      <div style={estilos.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: mostrarTabelaVeiculos ? '12px' : '0' }}>
          <div style={{ fontWeight: 'bold', textTransform: 'uppercase', color: '#1e293b', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Car style={{ width: '16px', height: '16px' }} />
            Status dos Veículos da Frota (Atrelados aos seus Colaboradores)
          </div>
          <button type="button" onClick={() => setMostrarTabelaVeiculos(!mostrarTabelaVeiculos)} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#fff', border: '1px solid #cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#1e293b' }} >
            {mostrarTabelaVeiculos ? <EyeOff size={14} /> : <Eye size={14} />}
            {mostrarTabelaVeiculos ? 'Ocultar Veículos' : 'Visualizar Veículos'}
          </button>
        </div>

        {mostrarTabelaVeiculos && (
          <div style={{ overflowX: 'auto', marginTop: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th style={estilos.th}>Placa</th>
                  <th style={estilos.th}>Veículo / Modelo</th>
                  <th style={estilos.th}>Tipo</th>
                  <th style={estilos.th}>Colaborador Vinculado</th>
                  <th style={{ ...estilos.th, textAlign: 'center', width: '140px' }}>Status do Veículo</th>
                </tr>
              </thead>
              <tbody>
                {veiculosDoQuadroAtivo.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                      Nenhum veículo da frota está atualmente vinculado a seus colaboradores diretos.
                    </td>
                  </tr>
                ) : (
                  veiculosDoQuadroAtivo.map((veiculo) => {
                    const funcDono = listaFuncionariosDisponiveis.find(f => Number(f.id) === Number(veiculo.id_funcionario));
                    return (
                      <tr key={`veic-tab-${veiculo.id}`}>
                        <td style={{ ...estilos.td, fontWeight: 'bold', color: '#0f172a' }}>{veiculo.placa}</td>
                        <td style={estilos.td}>{veiculo.marca} {veiculo.modelo} ({veiculo.ano || '—'})</td>
                        <td style={{ ...estilos.td, textTransform: 'uppercase' }}>{veiculo.tipo}</td>
                        <td style={{ ...estilos.td, fontWeight: '500' }}>{funcDono ? funcDono.nome : `ID Func: ${veiculo.id_funcionario}`}</td>
                        <td style={{ ...estilos.td, textAlign: 'center' }}>
                          <span style={estilos.badgeGeral}>{veiculo.status ? veiculo.status.toUpperCase() : 'ATIVO'}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. LISTAGEM DO EFETIVO ALOCADO NO DIA (OBRA EM FOCO) */}
      <div style={estilos.card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          <div style={{ fontWeight: 'bold', textTransform: 'uppercase', color: '#1e293b', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users style={{ width: '16px', height: '16px' }} />
            Efetivo Escalado Geral (Nesta Obra)
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={estilos.label}>FILTRAR EQUIPE:</label>
            <select value={filtroEquipe} onChange={(e) => setFiltroEquipe(e.target.value)} style={estilos.select}>
              <option value="TODAS">⚠️ TODAS AS EQUIPES</option>
              {[...new Set(funcionariosAlocados.map(a => a.equipe).filter(Boolean))].map(eq => (
                <option key={eq} value={eq}>{eq.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
            <thead>
              <tr>
                <th style={estilos.th}>Colaborador / Matrícula</th>
                <th style={estilos.th}>Cargo</th>
                <th style={estilos.th}>Turno</th>
                <th style={estilos.th}>Equipe Vinculada</th>
                <th style={estilos.th}>Veículo Atrelado (Tabela Veiculos)</th>
                <th style={{ ...estilos.th, textAlign: 'center' }}>Remanejar</th>
                <th style={{ ...estilos.th, textAlign: 'center', width: '60px' }}>Excluir</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const alocacoesFiltradas = funcionariosAlocados.filter(aloc => {
                  if (filtroEquipe === 'TODAS') return true;
                  return String(aloc.equipe).toUpperCase().trim() === filtroEquipe.toUpperCase().trim();
                });

                if (alocacoesFiltradas.length === 0) {
                  return (
                    <tr>
                      <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                        Nenhum colaborador alocado nesta obra ou com o filtro de equipe selecionado.
                      </td>
                    </tr>
                  );
                }

                return alocacoesFiltradas.map((aloc, index) => {
                  const veiculoDoFuncionario = listaVeiculos.find(
                    v => String(v.id_funcionario) === String(aloc.id_funcionario)
                  );

                  return (
                    <tr key={`aloc-row-${aloc.id_funcionario}-${index}`}>
                      <td style={estilos.td}>
                        <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{aloc.nome}</span>
                        <div style={{ fontSize: '9px', color: '#64748b' }}>MAT: {aloc.matricula || '—'}</div>
                      </td>
                      <td style={estilos.td}>{aloc.cargo || '—'}</td>
                      <td style={estilos.td}>
                        <span style={estilos.badgeGeral}>{aloc.turno || 'DIURNO'}</span>
                      </td>
                      <td style={{ ...estilos.td, fontWeight: 'bold' }}>{aloc.equipe || 'Geral'}</td>
                      <td style={estilos.td}>
                        {veiculoDoFuncionario ? (
                          <div style={{ fontWeight: '500' }}>
                            🚗 <span style={{ fontWeight: 'bold' }}>{veiculoDoFuncionario.placa}</span> - {veiculoDoFuncionario.marca} {veiculoDoFuncionario.modelo}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Nenhum veículo</span>
                        )}
                      </td>
                      <td style={{ ...estilos.td, textAlign: 'center' }}>
                        <button type="button" onClick={() => handleAbrirRemanejamento(aloc)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#1e293b' }}>
                          <MoveHorizontal size={16} />
                        </button>
                      </td>
                      <td style={{ ...estilos.td, textAlign: 'center' }}>
                        <button type="button" onClick={() => handleDeletarAlocacao(aloc.id_funcionario, aloc.turno, aloc.equipe)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#1e293b' }}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONTROLES INFERIORES ADICIONAIS */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', borderTop: '1px dashed #cbd5e1', paddingTop: '16px', marginTop: '8px' }}>
        <button type="button" onClick={() => setMostrarResumoOcupacao(!mostrarResumoOcupacao)} style={estilos.botaoSecundario}>
          {mostrarResumoOcupacao ? <EyeOff size={16} /> : <Eye size={16} />}
          {mostrarResumoOcupacao ? 'Ocultar Espelho de Ocupação' : 'Visualizar Espelho de Ocupação do Dia (Status de Todo o Meu Efetivo)'}
        </button>
        <button type="button" onClick={() => setMostrarRemanejamento(!mostrarRemanejamento)} style={estilos.botaoSecundario}>
          <MoveHorizontal size={16} />
          {mostrarRemanejamento ? 'Ocultar Tabela de Remanejamento' : 'Abrir Quadro de Remanejamento'}
        </button>
      </div>

      {/* TABELA: ESPELHO DE OCUPAÇÃO DO DIA */}
      {mostrarResumoOcupacao && (
        <div style={estilos.card}>
          <div style={estilos.tituloSecao}>
            <CheckCircle size={16} style={{ marginRight: '4px', display: 'inline' }} /> Espelho de Ocupação do Dia (Efetivo Ativo e Obras Destinadas)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th style={estilos.th}>Colaborador / Matrícula</th>
                  <th style={estilos.th}>Cargo</th>
                  <th style={estilos.th}>Status / Obra Alocada (DIURNO)</th>
                  <th style={estilos.th}>Status / Obra Alocada (NOTURNO)</th>
                </tr>
              </thead>
              <tbody>
                {listaFuncionariosDisponiveis.map(func => {
                  const statusDiurn = obterStatusPorTurno(func.id, 'DIURNO');
                  const statusNoturn = obterStatusPorTurno(func.id, 'NOTURNO');
                  return (
                    <tr key={`espelho-func-${func.id}`}>
                      <td style={estilos.td}>
                        <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{func.nome}</span>
                        <div style={{ fontSize: '9px', color: '#64748b' }}>MAT: {func.matricula || '—'}</div>
                      </td>
                      <td style={estilos.td}>{func.cargo || '—'}</td>
                      <td style={estilos.td}>
                        <span style={statusDiurn.alocado ? estilos.badgeAlocado : estilos.badgeGeral}>
                          {statusDiurn.texto}
                        </span>
                      </td>
                      <td style={estilos.td}>
                        <span style={statusNoturn.alocado ? estilos.badgeAlocado : estilos.badgeGeral}>
                          {statusNoturn.texto}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TABELA / QUADRO DE REMANEJAMENTO */}
      {mostrarRemanejamento && (
        <div style={estilos.card}>
          <div style={estilos.tituloSecao}>
            Quadro Executivo de Remanejamento de Funcionários (Transferências de Engenharia)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th style={estilos.th}>Colaborador</th>
                  <th style={estilos.th}>Matrícula / Cargo</th>
                  <th style={estilos.th}>Ocupação do Dia</th>
                  <th style={{ ...estilos.th, textAlign: 'center', width: '150px' }}>Ação Técnico-Gerencial</th>
                </tr>
              </thead>
              <tbody>
                {listaFuncionariosDisponiveis.map(func => {
                  const alocadoNoDia = todosOsAgendamentosDoDia.filter(a => String(a.id_funcionario) === String(func.id));
                  let resumoOcupacao = "Disponível / Banco";
                  if (alocadoNoDia.length > 0) {
                    resumoOcupacao = alocadoNoDia.map(a => {
                      if (String(a.equipe).toUpperCase() === 'FOLGUISTAS' || a.status_presenca === 'Folga') return "Folga";
                      const oData = obrasDisponiveis.find(o => Number(o.id) === Number(a.id_obra));
                      return `${oData ? oData.nome_obra : 'Obra'} (${a.turno})`;
                    }).join(" | ");
                  }
                  return (
                    <tr key={`reman-row-${func.id}`}>
                      <td style={{ ...estilos.td, fontWeight: 'bold' }}>{func.nome}</td>
                      <td style={estilos.td}>{func.cargo} (MAT: {func.matricula || '—'})</td>
                      <td style={{ ...estilos.td, fontWeight: '500' }}>{resumoOcupacao}</td>
                      <td style={{ ...estilos.td, textAlign: 'center' }}>
                        <button type="button" onClick={() => handleAbrirRemanejamento(func)} style={{ padding: '4px 8px', backgroundColor: '#1e293b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <MoveHorizontal size={12} /> Transferir Engenharia
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DE REMANEJAMENTO TÉCNICO */}
      {modalAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', width: '450px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '14px' }}>
              <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MoveHorizontal size={18} /> REMANEJAR COLABORADOR / TRANSFERIR ENGENHARIA
              </div>
              <button type="button" onClick={() => setModalAberto(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmarTransferencia}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>COLABORADOR SELECIONADO:</span>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>{remanejamentoDados.nome_funcionario}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={estilos.label}>Engenheiro / Gestor Técnico Destino *</label>
                  <select 
                    required 
                    value={remanejamentoDados.id_gestor_destino}
                    onChange={e => setRemanejamentoDados({ ...remanejamentoDados, id_gestor_destino: e.target.value })}
                    style={estilos.select}
                  >
                    <option value="">-- Selecione o Engenheiro Destino --</option>
                    {listaGestores.map(g => (
                      <option key={`gestor-dest-${g.id}`} value={g.id}>
                        {g.nome} ({g.cargo || 'Gestor'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" onClick={() => setModalAberto(false)} style={{ height: '32px', padding: '0 14px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', color: '#475569', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" style={estilos.botaoPrincipal}>
                  Confirmar Transferência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}