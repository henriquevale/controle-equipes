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

  const [equipeSelecionadaFiltro, setEquipeSelecionadaFiltro] = useState('ALL');
  
  // Estados para controlar a visibilidade das tabelas
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
      const res = await axios.get('https://controle-equipes.onrender.com/api/veiculos');
      setListaVeiculos(res.data || []);
    } catch (e) {
      console.error("Erro ao carregar veículos para o diário:", e);
    }
  };

  const carregarAlocacoesDaObra = async () => {
    try {
      const res = await axios.get('https://controle-equipes.onrender.com/api/gestor/diario-efetivo', {
        params: { data_diario: dataSelecionada, id_obra: obraFiltro }
      });
      setFuncionariosAlocados(res.data || []);
    } catch (e) {
      console.error("Erro ao carregar alocações da obra:", e);
    }
  };

  const carregarTodosOsAgendamentosDoDia = async () => {
    try {
      const res = await axios.get('https://controle-equipes.onrender.com/api/gestor/diario-efetivo', {
        params: { data_diario: dataSelecionada }
      });
      setTodosOsAgendamentosDoDia(res.data || []);
    } catch (e) {
      console.error("Erro ao carregar agendamentos globais:", e);
    }
  };

  const carregarFuncionariosDoGestor = async () => {
    try {
      const usuario = usuarioLogado || JSON.parse(localStorage.getItem('usuario') || '{}');
      const params = { id: usuario?.id, cargo: usuario?.cargo, data_diario: dataSelecionada };
      const res = await axios.get('https://controle-equipes.onrender.com/api/gestor/funcionarios-disponiveis', { params });
      setListaFuncionariosDisponiveis(res.data && res.data.funcionarios ? res.data.funcionarios : []);
    } catch (e) {
      console.error("Erro ao carregar funcionários do gestor:", e);
    }
  };

  const carregarGestoresParaModal = async () => {
    try {
      const res = await axios.get('https://controle-equipes.onrender.com/api/gestor/lista-remanejamento-gestores');
      const usuario = usuarioLogado || JSON.parse(localStorage.getItem('usuario') || '{}');
      const idLogado = usuario?.id;
      const gestoresFiltrados = (res.data || []).filter(g => Number(g.id) !== Number(idLogado));
      setListaGestores(gestoresFiltrados);
    } catch (err) {
      console.error("Erro ao buscar gestores:", err);
    }
  };

  const handleIniciarRemanejamento = async (funcionario) => {
    try {
      await carregarGestoresParaModal();
      setRemanejamentoDados({
        id_funcionario: funcionario.id,
        nome_funcionario: funcionario.nome,
        id_gestor_destino: ''
      });
      setModalAberto(true);
    } catch (err) {
      console.error("Erro ao preparar dados para o modal de remanejamento:", err);
      alert("Não foi possível carregar a lista de gestores. Tente novamente.");
    }
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

      await axios.post('https://controle-equipes.onrender.com/api/gestor/remanezar-funcionario-vincular', dadosPayload);

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
      const resAtual = await axios.get('https://controle-equipes.onrender.com/api/gestor/diario-efetivo', {
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

      return await axios.post('https://controle-equipes.onrender.com/api/gestor/diario-efetivo', {
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
    const nomeEquipeTratado = novaAlocacao.equipe.trim();

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
      a => String(a.id_funcionario) === String(novaAlocacao.id_funcionario) && 
           String(a.turno).toUpperCase() === String(novaAlocacao.turno).toUpperCase()
    );

    if (jaAlocadoNoTurno) {
      const dadosObraJaAlocada = obrasDisponiveis.find(o => Number(o.id) === Number(jaAlocadoNoTurno.id_obra));
      const nomeObraConflito = dadosObraJaAlocada ? dadosObraJaAlocada.nome_obra : `ID Obra ${jaAlocadoNoTurno.id_obra}`;
      alert(`⚠️ Impossível alocar! O colaborador já está escalado neste turno (${jaAlocadoNoTurno.turno}) na equipe "${jaAlocadoNoTurno.equipe}" da obra: "${nomeObraConflito}".`);
      return;
    }

    try {
      const resAtual = await axios.get('https://controle-equipes.onrender.com/api/gestor/diario-efetivo', {
        params: { data_diario: dataSelecionada, id_obra: obraFiltro }
      });
      const todosOsTurnosEEquipesDessaObra = resAtual.data || [];
      const usuario = usuarioLogado || JSON.parse(localStorage.getItem('usuario') || '{}');
      const idGestorAtual = usuario?.id || null;

      const listaEfetivoAtualizada = [
        ...todosOsTurnosEEquipesDessaObra.map(a => ({
          id_funcionario: a.id_funcionario,
          id_obra: a.id_obra || Number(obraFiltro),
          id_gestor: a.id_gestor || idGestorAtual, 
          nome: a.nome || 'N/D',
          cargo: a.cargo || 'N/D',
          matricula: a.matricula || '',
          turno: a.turno,
          status_presenca: a.status_presenca || 'ALOCADO',
          observacao: a.observacao || '',
          equipe: a.equipe.trim()
        })),
        {
          id_funcionario: funcionarioCompleto.id,
          id_obra: Number(obraFiltro),
          id_gestor: idGestorAtual, 
          nome: funcionarioCompleto.nome || 'N/D',
          cargo: funcionarioCompleto.cargo || 'N/D',
          matricula: funcionarioCompleto.matricula || '',
          turno: novaAlocacao.turno,
          status_presenca: 'ALOCADO', 
          observacao: novaAlocacao.observacao || '',
          equipe: nomeEquipeTratado
        }
      ];

      await axios.post('https://controle-equipes.onrender.com/api/gestor/diario-efetivo', {
        data_diario: dataSelecionada,
        id_obra: Number(obraFiltro),
        efetivo: listaEfetivoAtualizada
      });
      
      setFiltroEquipe(nomeEquipeTratado.toUpperCase());
      setNovaAlocacao({ ...novaAlocacao, id_funcionario: '', equipe: '', observacao: '' });
      
      carregarAlocacoesDaObra();
      carregarTodosOsAgendamentosDoDia();
      carregarFuncionariosDoGestor(); 
    } catch (err) {
      console.error("❌ Erro ao salvar alocação:", err);
      alert(`Erro crítico ao salvar alocação no banco de dados.`);
    }
  };

  const handleDeletarAlocacao = async (idFuncionario, turnoAloc, equipeAloc) => {
    if (!window.confirm("Remover este funcionário da escala?")) return;
    try {
      const resAtual = await axios.get('https://controle-equipes.onrender.com/api/gestor/diario-efetivo', {
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
          status_presenca: a.status_presenca || 'ALOCADO',
          observacao: a.observacao || '',
          equipe: a.equipe.trim()
        }));

      await axios.post('https://controle-equipes.onrender.com/api/gestor/diario-efetivo', {
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
        return { texto: 'FOLGA', corBg: '#fef2f2', corTxt: '#991b1b' };
      }
      const dadosObra = obrasDisponiveis.find(o => Number(o.id) === Number(agendamentoNoTurno.id_obra));
      const nomeObra = dadosObra ? dadosObra.nome_obra : `Obra ID ${agendamentoNoTurno.id_obra}`;
      return { texto: `${nomeObra} [${agendamentoNoTurno.equipe}]`, corBg: '#e0f2fe', corTxt: '#0369a1' };
    }
    return { texto: 'Disponível', corBg: '#dcfce7', corTxt: '#15803d' };
  };

  const renderBadgeStatusVeiculo = (statusTxt) => {
    const st = statusTxt ? statusTxt.toUpperCase() : '';
    let bg = '#dcfce7', text = '#166534', icone = <CheckCircle style={{ width: '11px', height: '11px' }} />;
    
    if (st === 'EM MANUTENÇÃO') { 
        bg = '#fef2f2'; text = '#991b1b'; icone = <Wrench style={{ width: '11px', height: '11px' }} />; 
    } else if (st === 'EM USO') { 
        bg = '#fef9c3'; text = '#713f12'; icone = <AlertTriangle style={{ width: '11px', height: '11px' }} />; 
    }

    return (
        <span style={{ backgroundColor: bg, color: text, padding: '3px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '9px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            {icone} {statusTxt}
        </span>
    );
  };

  const funcionariosNaoAlocadosNoDia = listaFuncionariosDisponiveis.filter(func => {
    return !todosOsAgendamentosDoDia.some(agend => String(agend.id_funcionario) === String(func.id));
  });

  // --- NOVO FILTRO GLOBAL CORRIGIDO: Se tiver QUALQUER agendamento no dia, ele some da transferência ---
  const funcionariosDisponiveisParaRemanejamento = listaFuncionariosDisponiveis.filter(func => {
    const possuiQualquerAgendamentoNoDia = todosOsAgendamentosDoDia.some(agend => {
      return String(agend.id_funcionario) === String(func.id);
    });
    return !possuiQualquerAgendamentoNoDia;
  });

  const veiculosDoQuadroAtivo = listaVeiculos.filter(v => 
    v.id_funcionario && listaFuncionariosDisponiveis.some(f => Number(f.id) === Number(v.id_funcionario))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', boxSizing: 'border-box', position: 'relative' }}>
      
      {/* 1. PAINEL DE FILTROS */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px' }}>
        <div style={{ fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
          Parâmetros do Diário Técnico
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569' }}>Data do Diário</label>
            <input type="date" style={{ height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} value={dataSelecionada} onChange={e => setDataSelecionada(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569' }}>Selecione a Obra para Gerenciamento *</label>
            <select style={{ height: '32px', padding: '0 4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 'bold' }} value={obraFiltro} onChange={e => setObraFiltro(e.target.value)}>
              <option value="">-- Escolha uma Obra Ativa --</option>
              {obrasDisponiveis.map(o => (
                <option key={o.id} value={o.id}>[{o.codigo_obra}] {o.nome_obra}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. FORMULÁRIO DE ALOCAÇÃO DINÂMICA */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px' }}>
        <div style={{ fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
          Alocar e Criar Equipes Dinamicamente
        </div>
        <form onSubmit={handleSalvarAlocacao} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Selecione o Funcionário *</label>
              <select required style={{ height: '32px', padding: '0 4px', border: '1px solid #cbd5e1', borderRadius: '4px' }} value={novaAlocacao.id_funcionario} onChange={e => setNovaAlocacao({...novaAlocacao, id_funcionario: e.target.value})}>
                <option value="">-- Escolha o Funcionário --</option>
                {listaFuncionariosDisponiveis.map(f => (
                  <option key={f.id} value={f.id}>{f.nome} ({f.cargo})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Turno em Foco *</label>
              <select style={{ height: '32px', padding: '0 4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 'bold', backgroundColor: '#fff' }} value={novaAlocacao.turno} onChange={e => setNovaAlocacao({...novaAlocacao, turno: e.target.value})}>
                <option value="DIURNO">DIURNO</option>
                <option value="NOTURNO">NOTURNO</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#1e293b' }}>Nome da Equipe *</label>
              <input 
                required
                type="text" 
                placeholder="Ex: Equipe 1, Equipe 20, Alfa..."
                style={{ height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 'bold' }} 
                value={novaAlocacao.equipe} 
                onChange={e => setNovaAlocacao({...novaAlocacao, equipe: e.target.value})}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Observação Adicional</label>
              <input type="text" placeholder="Ex: Motorista..." style={{ height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} value={novaAlocacao.observacao} onChange={e => setNovaAlocacao({...novaAlocacao, observacao: e.target.value})} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" style={{ height: '32px', padding: '0 24px', backgroundColor: '#1e293b', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus style={{ width: '14px', height: '14px' }} />
              Alocar na Escala ({novaAlocacao.turno})
            </button>
          </div>
        </form>
      </div>

      {/* PROGRAMAÇÃO DE FOLGA DIRETA */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px' }}>
        <div style={{ fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
          Programar Folga Direta (Lançamento Rápido — Ambos os Turnos)
        </div>
        <form onSubmit={handleSalvarFolgaEspecifica} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569' }}>Colaborador que entrará em Folga *</label>
              <select 
                required
                style={{ height: '32px', padding: '0 4px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff' }} 
                value={novaFolga.id_funcionario} 
                onChange={e => setNovaFolga({...novaFolga, id_funcionario: e.target.value})}
              >
                <option value="">-- Selecione o Colaborador --</option>
                {listaFuncionariosDisponiveis.map(f => (
                  <option key={f.id} value={f.id}>{f.nome} ({f.cargo})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569' }}>Motivo / Observação</label>
              <input 
                type="text" 
                style={{ height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} 
                value={novaFolga.observacao} 
                onChange={e => setNovaFolga({...novaFolga, observacao: e.target.value})}
              />
            </div>

          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              type="submit" 
              style={{ height: '32px', padding: '0 24px', backgroundColor: '#1e293b', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Confirmar Registro de Folga
            </button>
          </div>
        </form>
      </div>

      {/* SEÇÃO STATUS DE VEÍCULOS VINCULADOS */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: mostrarTabelaVeiculos ? '12px' : '0' }}>
          <div style={{ fontWeight: 'bold', textTransform: 'uppercase', color: '#1e293b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Car style={{ width: '16px', height: '16px', color: '#2563eb' }} />
            Status dos Veículos da Frota (Atrelados aos seus Colaboradores)
          </div>
          
          <button 
            type="button"
            onClick={() => setMostrarTabelaVeiculos(!mostrarTabelaVeiculos)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              backgroundColor: '#f1f5f9', 
              border: '1px solid #cbd5e1', 
              padding: '4px 12px', 
              borderRadius: '4px', 
              cursor: 'pointer', 
              fontSize: '11px', 
              fontWeight: 'bold', 
              color: '#1e293b' 
            }}
          >
            {mostrarTabelaVeiculos ? <EyeOff style={{ width: '14px', height: '14px' }} /> : <Eye style={{ width: '14px', height: '14px' }} />}
            {mostrarTabelaVeiculos ? 'Ocultar Veículos' : 'Visualizar Veículos'}
          </button>
        </div>

        {mostrarTabelaVeiculos && (
          <div style={{ overflowX: 'auto', marginTop: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#1e293b', color: '#fff', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px' }}>Placa</th>
                  <th style={{ padding: '10px 12px' }}>Veículo / Modelo</th>
                  <th style={{ padding: '10px 12px' }}>Tipo</th>
                  <th style={{ padding: '10px 12px' }}>Colaborador Vinculado</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', width: '140px' }}>Status do Veículo</th>
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
                  veiculosDoQuadroAtivo.map((veiculo, index) => {
                    const motorista = listaFuncionariosDisponiveis.find(f => Number(f.id) === Number(veiculo.id_funcionario));
                    return (
                      <tr key={`veic-${veiculo.id}`} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#0f172a' }}>{veiculo.placa}</td>
                        <td style={{ padding: '10px 12px', color: '#334155' }}>{veiculo.marca} {veiculo.modelo} ({veiculo.ano})</td>
                        <td style={{ padding: '10px 12px', color: '#64748b' }}>{veiculo.tipo}</td>
                        <td style={{ padding: '10px 12px', fontWeight: '500', color: '#1e293b' }}>
                          {motorista ? `${motorista.nome} (${motorista.cargo})` : `ID Funcionário: #${veiculo.id_funcionario}`}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {renderBadgeStatusVeiculo(veiculo.status)}
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

      {/* 3. LISTAGEM DO EFETIVO ALOCADO NO DIA COM FILTRO INTEGRAÇÃO */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          <div style={{ fontWeight: 'bold', textTransform: 'uppercase', color: '#1e293b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users style={{ width: '16px', height: '16px', color: '#475569' }} />
            Efetivo Escalado Geral (Apenas Alocados)
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Filtrar Equipe:</label>
            <select
              value={filtroEquipe}
              onChange={(e) => setFiltroEquipe(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: '500', color: '#334155' }}
            >
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
              <tr style={{ backgroundColor: '#0f172a', color: '#fff', textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 12px' }}>Colaborador / Matrícula</th>
                <th style={{ padding: '10px 12px' }}>Cargo</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Turno</th>
                <th style={{ padding: '10px 12px' }}>Equipe Vinculada</th>
                <th style={{ padding: '10px 12px' }}>Obs</th>
                <th style={{ padding: '10px 12px' }}>Obra Destino</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '80px' }}>Ação</th>
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
                        Nenhum colaborador alocado para os critérios selecionados.
                      </td>
                    </tr>
                  );
                }

                return alocacoesFiltradas.map((aloc, index) => {
                  const ehFolguista = String(aloc.equipe).toUpperCase().includes('FOLGUISTA') || 
                                      String(aloc.status_presenca).toUpperCase() === 'FOLGA';

                  return (
                    <tr 
                      key={`aloc-row-${aloc.id_funcionario}-${aloc.turno}-${index}`} 
                      style={{ 
                        borderBottom: '1px solid #e2e8f0', 
                        backgroundColor: ehFolguista ? '#fef2f2' : (index % 2 === 0 ? '#ffffff' : '#f8fafc') 
                      }}
                    >
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ 
                            fontWeight: 'bold', 
                            color: ehFolguista ? '#dc2626' : '#0f172a' 
                          }}>
                            {aloc.nome}
                          </span>
                          {ehFolguista && (
                            <span style={{ 
                              backgroundColor: '#fee2e2', 
                              color: '#b91c1c', 
                              fontSize: '9px', 
                              fontWeight: 'bold', 
                              padding: '2px 6px', 
                              borderRadius: '4px',
                              textTransform: 'uppercase'
                            }}>
                              🔄 Folguista
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '9px', color: '#64748b' }}>MAT: {aloc.matricula || '—'}</div>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#334155' }}>{aloc.cargo || '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ 
                          backgroundColor: ehFolguista ? '#fee2e2' : '#e2e8f0', 
                          color: ehFolguista ? '#991b1b' : '#1e293b', 
                          padding: '2px 6px', 
                          borderRadius: '4px', 
                          fontWeight: 'bold', 
                          fontSize: '9px' 
                        }}>
                          {aloc.turno || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 'bold', color: ehFolguista ? '#b91c1c' : '#1e3a8a' }}>
                        {aloc.equipe || 'Geral'}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#475569', fontStyle: 'italic' }}>
                        {aloc.observacao || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: '500', color: '#334155' }}>
                        {aloc.obra_nome || aloc.nome_obra || 'Obra Alocada'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button 
                          type="button" 
                          title="Remover esta alocação"
                          onClick={() => handleDeletarAlocacao(aloc.id_funcionario, aloc.turno, aloc.equipe)} 
                          style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                        >
                          <Trash2 style={{ width: '14px', height: '14px' }} />
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

      {/* SEÇÃO RESUMO DE OCUPAÇÃO (CONECTADA E INTEGRADA) */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: mostrarResumoOcupacao ? '12px' : '0' }}>
          <div style={{ fontWeight: 'bold', textTransform: 'uppercase', color: '#334155', fontSize: '13px' }}>
            Resumo Geral da Ocupação dos Funcionários no Dia (Por Turno)
          </div>
          <button 
            type="button"
            onClick={() => setMostrarResumoOcupacao(!mostrarResumoOcupacao)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#1e293b' }}
          >
            {mostrarResumoOcupacao ? <EyeOff style={{ width: '14px', height: '14px' }} /> : <Eye style={{ width: '14px', height: '14px' }} />}
            {mostrarResumoOcupacao ? 'Ocultar Tabela' : 'Ver Tabela'}
          </button>
        </div>

        {mostrarResumoOcupacao && (
          <div style={{ overflowX: 'auto', maxHeight: '350px', marginTop: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#475569', color: '#fff', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{ padding: '10px 12px' }}>Funcionário / Cadastro</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', width: '40%' }}>Status Turno DIURNO</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', width: '40%' }}>Status Turno NOTURNO</th>
                </tr>
              </thead>
              <tbody>
                {listaFuncionariosDisponiveis.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                      Nenhum colaborador vinculado a sua gerência técnica.
                    </td>
                  </tr>
                ) : (
                  listaFuncionariosDisponiveis.map((func, index) => {
                    const statusDiurno = obterStatusPorTurno(func.id, 'DIURNO');
                    const statusNoturno = obterStatusPorTurno(func.id, 'NOTURNO');

                    return (
                      <tr key={`resumo-${func.id}`} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{func.nome}</div>
                          <div style={{ fontSize: '9px', color: '#64748b' }}>{func.cargo} | MAT: {func.matricula || '—'}</div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ backgroundColor: statusDiurno.corBg, color: statusDiurno.corTxt, padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                            {statusDiurno.texto}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ backgroundColor: statusNoturno.corBg, color: statusNoturno.corTxt, padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                            {statusNoturno.texto}
                          </span>
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

      {/* 4. SEÇÃO REMANEJAMENTO E TRANSFERÊNCIA INTERNA */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: mostrarRemanejamento ? '12px' : '0' }}>
          <div style={{ fontWeight: 'bold', textTransform: 'uppercase', color: '#334155', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MoveHorizontal style={{ width: '16px', height: '16px', color: '#65a30d' }} />
            Transferência Externa de Engenharia (Remanejamento Definitivo)
          </div>
          <button 
            type="button"
            onClick={() => setMostrarRemanejamento(!mostrarRemanejamento)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#1e293b' }}
          >
            {mostrarRemanejamento ? <EyeOff style={{ width: '14px', height: '14px' }} /> : <Eye style={{ width: '14px', height: '14px' }} />}
            {mostrarRemanejamento ? 'Ocultar Painel' : 'Abrir Painel'}
          </button>
        </div>

        {mostrarRemanejamento && (
          <div style={{ overflowX: 'auto', marginTop: '8px' }}>
            <p style={{ margin: '0 0 12px 0', fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
              Utilize esta tabela para transferir a gerência técnica do colaborador de forma definitiva para outro Engenheiro responsável.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#65a30d', color: '#fff', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px' }}>Colaborador</th>
                  <th style={{ padding: '10px 12px' }}>Cargo Atual</th>
                  <th style={{ padding: '10px 12px' }}>Matrícula</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', width: '180px' }}>Ação de Remanejamento</th>
                </tr>
              </thead>
              <tbody>
                {funcionariosDisponiveisParaRemanejamento.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                      Nenhum colaborador disponível para remanejamento técnico nesta obra hoje.
                    </td>
                  </tr>
                ) : (
                  funcionariosDisponiveisParaRemanejamento.map((func, idx) => (
                    <tr key={`reman-item-${func.id}`} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#0f172a' }}>{func.nome}</td>
                      <td style={{ padding: '10px 12px', color: '#334155' }}>{func.cargo || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>{func.matricula || '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleIniciarRemanejamento(func)}
                          style={{ backgroundColor: '#65a30d', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}
                        >
                          Transferir de Gestor
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE SELEÇÃO DE DESTINO PARA TRANSFERÊNCIA */}
      {modalAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '6px', width: '90%', maxWidth: '450px', padding: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '16px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', color: '#0f172a' }}>
                Selecionar Gestor de Engenharia Destino
              </div>
              <button type="button" onClick={() => setModalAberto(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            <form onSubmit={handleConfirmarTransferencia} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Colaborador Selecionado:</label>
                <div style={{ padding: '8px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px', fontWeight: 'bold', fontSize: '12px', color: '#1e293b' }}>
                  {remanejamentoDados.nome_funcionario}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Escolha o Novo Gestor Responsável *</label>
                <select
                  required
                  value={remanejamentoDados.id_gestor_destino}
                  onChange={e => setRemanejamentoDados({ ...remanejamentoDados, id_gestor_destino: e.target.value })}
                  style={{ height: '36px', padding: '0 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', backgroundColor: '#fff' }}
                >
                  <option value="">-- Selecione o Engenheiro Destino --</option>
                  {listaGestores.map(g => (
                    <option key={`gestor-dest-${g.id}`} value={g.id}>
                      {g.nome} ({g.cargo || 'Gestor'})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setModalAberto(false)} style={{ height: '32px', padding: '0 14px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', color: '#475569', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ height: '32px', padding: '0 16px', backgroundColor: '#65a30d', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
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