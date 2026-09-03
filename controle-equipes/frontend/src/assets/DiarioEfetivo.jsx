import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios'; 
import { Users, Trash2, Plus, X, Eye, EyeOff, Car, Wrench, AlertTriangle, CheckCircle, MoveHorizontal, Search, Lock } from 'lucide-react';

export default function DiarioEfetivo({ obrasDisponiveis, usuarioLogado }) {

  const API_URL = 'http://localhost:3001/api';
  //const API_URL = 'https://api-controle-impacto.duckdns.org/api';

  // --- FILTROS PRIMÁRIOS DE CABEÇALHO ---
  const [dataSelecionada, setDataSelecionada] = useState(new Date().toISOString().split('T')[0]);
  const [obraFiltro, setObraFiltro] = useState('');
  const [turnoAtivo, setTurnoAtivo] = useState('DIURNO');
  const [filtroEquipeTabela, setFiltroEquipeTabela] = useState('TODAS');

  // --- CAMPO DE PESQUISA NOS DISPONÍVEIS ---
  const [termoBuscaDisponiveis, setTermoBuscaDisponiveis] = useState('');

  // --- DADOS DO SISTEMA ---
  const [todosFuncionarios, setTodosFuncionarios] = useState([]);
  const [listaCompletaFuncionarios, setListaCompletaFuncionarios] = useState([]); // Base completa para o Resumo
  const [alocacoesDoDia, setAlocacoesDoDia] = useState([]);
  const [todosOsAgendamentosDoDia, setTodosOsAgendamentosDoDia] = useState([]);
  const [listaVeiculos, setListaVeiculos] = useState([]);
  const [equipesBloqueadas, setEquipesBloqueadas] = useState([]);

  // --- CONTROLE DE EQUIPES LOCAIS (POR OBRA E TURNO) ---
  const [equipesLocais, setEquipesLocais] = useState([]); 
  const [nomeNovaEquipe, setNomeNovaEquipe] = useState('');
  
  // --- CONTROLE DE VISIBILIDADE DE PAINÉIS/TABELAS ---
  const [mostrarTabelaVeiculos, setMostrarTabelaVeiculos] = useState(false);
  const [mostrarResumoOcupacao, setMostrarResumoOcupacao] = useState(false);
  const [mostrarResumoVeiculos, setMostrarResumoVeiculos] = useState(false);
  const [mostrarRemanejamento, setMostrarRemanejamento] = useState(false);
  const [mostrarEfetivoEscalado, setMostrarEfetivoEscalado] = useState(false);
  // --- MODAL DE REMANEJAMENTO DE GESTOR ---
  const [modalAberto, setModalAberto] = useState(false);
  const [remanejamentoDados, setRemanejamentoDados] = useState({
    id_funcionario: null, 
    nome_funcionario: '',
    id_gestor_destino: ''
  });
  const [listaGestores, setListaGestores] = useState([]);

  // --- EFEITOS DE CARREGAMENTO ---
  useEffect(() => {
    if (obrasDisponiveis && obrasDisponiveis.length > 0 && !obraFiltro) {
      setObraFiltro(obrasDisponiveis[0].id);
    }
  }, [obrasDisponiveis]);

  useEffect(() => {
    if (obraFiltro) {
      carregarAlocacoesDaObra();
      carregarEquipesBloqueadas();
    }
    carregarTodosOsAgendamentosDoDia();
    carregarFuncionariosDoGestor();
    carregarVeiculosDoGestor(); 
  }, [dataSelecionada, obraFiltro, turnoAtivo]);

  // --- BUSCAR EQUIPES FINALIZADAS (TRAVADAS) ---
  const carregarEquipesBloqueadas = async () => {
    if (!obraFiltro || !dataSelecionada) return;
    try {
      const res = await axios.get(`${API_URL}/gestor/equipes-finalizadas`, {
        params: { data_diario: dataSelecionada, id_obra: obraFiltro }
      });
      setEquipesBloqueadas(res.data || []);
    } catch (e) {
      console.error("Erro ao carregar status de bloqueio das equipes:", e);
      setEquipesBloqueadas([]);
    }
  };

  // --- COPIAR ÚLTIMO AGENDAMENTO/ESCALA REGISTRADO ---
  const handleCopiarUltimoAgendamento = async () => {
    if (!obraFiltro) {
      alert("⚠️ Selecione uma Obra ativa antes de copiar a escala!");
      return;
    }

    if (alocacoesDoDia.length > 0) {
      const confirma = window.confirm(
        "⚠️ Já existem alocações na data selecionada. Deseja substituí-las pelo histórico do último agendamento?"
      );
      if (!confirma) return;
    }

    try {
      const res = await axios.get(`${API_URL}/gestor/obter-ultimo-agendamento`, {
        params: { id_obra: obraFiltro, data_atual: dataSelecionada }
      });

      const { data_origem, alocacoes } = res.data;

      if (!alocacoes || alocacoes.length === 0) {
        alert("Nenhum histórico encontrado para esta obra.");
        return;
      }

      const novasAlocacoes = alocacoes.map(item => ({
        ...item,
        id_obra: Number(obraFiltro)
      }));

      await axios.post(`${API_URL}/gestor/diario-efetivo`, {
        data_diario: dataSelecionada,
        id_obra: Number(obraFiltro),
        efetivo: novasAlocacoes
      });

      alert(`✅ Escala copiada com sucesso do dia ${data_origem}!`);

      carregarAlocacoesDaObra();
      carregarTodosOsAgendamentosDoDia();
      carregarFuncionariosDoGestor();

    } catch (err) {
      console.error("Erro ao copiar último agendamento:", err);
      if (err.response?.status === 403) {
        alert(`🔒 ${err.response.data.error}`);
      } else {
        alert(err.response?.data?.error || "Erro ao copiar a escala do agendamento anterior.");
      }
    }
  };

  // --- MÉTODOS DE REQUISIÇÃO (API) ---
  const carregarVeiculosDoGestor = async () => {
    try {
      const usuario = usuarioLogado || JSON.parse(localStorage.getItem('usuario') || '{}');
      const params = { id: usuario?.id, cargo: usuario?.cargo };
      const res = await axios.get(`${API_URL}/gestor/veiculos`, { params });
      setListaVeiculos(res.data || []);
    } catch (e) {
      console.error("Erro ao carregar veículos:", e);
    }
  };

  const carregarAlocacoesDaObra = async () => {
    try {
      const res = await axios.get(`${API_URL}/gestor/diario-efetivo`, {
        params: { data_diario: dataSelecionada, id_obra: obraFiltro }
      });
      const alocs = res.data || [];
      setAlocacoesDoDia(alocs);

      setEquipesLocais(prev => {
        const deOutrasObras = prev.filter(e => String(e.id_obra) !== String(obraFiltro));
        const novasDaObraAtual = [];

        alocs.forEach(aloc => {
          if (aloc.equipe && aloc.turno) {
            const eqNome = aloc.equipe.trim().toUpperCase();
            const eqTurno = String(aloc.turno).trim().toUpperCase();
            
            const jaExiste = novasDaObraAtual.some(
              e => e.nome.toUpperCase() === eqNome && 
                   e.turno.toUpperCase() === eqTurno && 
                   String(e.id_obra) === String(obraFiltro)
            );

            if (!jaExiste) {
              novasDaObraAtual.push({ 
                nome: eqNome, 
                turno: eqTurno, 
                id_obra: String(obraFiltro) 
              });
            }
          }
        });

        return [...deOutrasObras, ...novasDaObraAtual];
      });

    } catch (e) {
      console.error("Erro ao carregar alocações da obra:", e);
    }
  };

  const carregarTodosOsAgendamentosDoDia = async () => {
    try {
      const res = await axios.get(`${API_URL}/gestor/diario-efetivo`, {
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
      
      const params = { 
        id: usuario?.id, 
        cargo: usuario?.cargo, 
        data_diario: dataSelecionada,
        turno: turnoAtivo
      };
      const res = await axios.get(`${API_URL}/gestor/funcionarios-disponiveis`, { params });
      setTodosFuncionarios(res.data && res.data.funcionarios ? res.data.funcionarios : []);

      const resGeral = await axios.get(`${API_URL}/gestor/funcionarios-disponiveis`, { 
        params: { id: usuario?.id, cargo: usuario?.cargo, data_diario: dataSelecionada } 
      });
      setListaCompletaFuncionarios(resGeral.data && resGeral.data.funcionarios ? resGeral.data.funcionarios : []);

    } catch (e) {
      console.error("Erro ao carregar colaboradores:", e);
    }
  };

  const carregarGestoresParaModal = async () => {
    try {
      const res = await axios.get(`${API_URL}/gestor/lista-remanejamento-gestores`);
      const usuario = usuarioLogado || JSON.parse(localStorage.getItem('usuario') || '{}');
      const idLogado = usuario?.id;
      const gestoresFiltrados = (res.data || []).filter(g => Number(g.id) !== Number(idLogado));
      setListaGestores(gestoresFiltrados);
    } catch (err) {
      console.error("Erro ao buscar gestores:", err);
    }
  };

  // --- CRIAÇÃO AUTOMÁTICA DA EQUIPE FOLGUISTA ---
  const handleCriarEquipeFolguista = () => {
    if (!obraFiltro) {
      alert("⚠️ Selecione uma Obra ativa!");
      return;
    }

    const nomeFolguista = "FOLGUISTAS";

    setEquipesLocais((prevEquipes) => {
      const jaExiste = prevEquipes.some(
        (eq) => eq.nome.toUpperCase() === nomeFolguista && 
               eq.turno.toUpperCase() === turnoAtivo.toUpperCase() &&
               String(eq.id_obra) === String(obraFiltro)
      );

      if (jaExiste) {
        alert("A equipe de Folguistas já foi criada para este turno e obra!");
        return prevEquipes;
      }

      return [
        ...prevEquipes,
        { nome: nomeFolguista, turno: turnoAtivo, id_obra: String(obraFiltro) }
      ];
    });
  };

  // --- EQUIPES FILTRADAS EXCLUSIVAMENTE PARA A OBRA E TURNO SELECIONADOS ---
  const equipesDoTurnoAtivo = equipesLocais.filter(
    eq => eq.turno.toUpperCase() === turnoAtivo.toUpperCase() && 
          String(eq.id_obra) === String(obraFiltro)
  );

  // --- DISPONIBILIDADE EM TEMPO REAL POR TURNO (LÓGICA AJUSTADA) ---
  const funcionariosDisponiveisNoTurno = useMemo(() => {
    const baseFuncionarios = todosFuncionarios.length > 0 
      ? todosFuncionarios 
      : listaCompletaFuncionarios;

    return baseFuncionarios.filter(func => {
      const idFunc = Number(func.id_funcionario || func.id);

      const termo = termoBuscaDisponiveis.toLowerCase().trim();
      const nomeMatch = (func.nome || func.name || '').toLowerCase().includes(termo);
      const cargoMatch = (func.cargo || '').toLowerCase().includes(termo);
      const matMatch = String(func.matricula || '').toLowerCase().includes(termo);

      if (termo && !nomeMatch && !cargoMatch && !matMatch) {
        return false;
      }

      const jaEstaAlocadoNaTela = alocacoesDoDia.some(a => {
      const mesmoFunc = Number(a.id_funcionario) === idFunc;
      const mesmoTurno = String(a.turno).toUpperCase() === turnoAtivo.toUpperCase();
      const estaLiberado = Number(a.liberado) === 1 || String(a.status_presenca).toUpperCase() === 'LIBERADO';
      
        // Se está no mesmo turno E NÃO está liberado, considera ocupado/bloqueado
        return mesmoFunc && mesmoTurno && !estaLiberado;
      });

      return !jaEstaAlocadoNaTela;
    });
  }, [todosFuncionarios, listaCompletaFuncionarios, alocacoesDoDia, turnoAtivo, termoBuscaDisponiveis]);

  // --- CRIAÇÃO DE EQUIPE ---
  const handleCriarEquipe = (e) => {
    e.preventDefault();
    if (!obraFiltro) {
      alert("⚠️ Selecione uma Obra ativa!");
      return;
    }

    const nomeFormatado = nomeNovaEquipe.trim().toUpperCase();
    if (!nomeFormatado) return;

    const jaExisteNoTurno = equipesLocais.some(
      eq => eq.nome.toUpperCase() === nomeFormatado && 
            eq.turno.toUpperCase() === turnoAtivo.toUpperCase() &&
            String(eq.id_obra) === String(obraFiltro)
    );

    if (jaExisteNoTurno) {
      alert(`⚠️ A equipe "${nomeFormatado}" já existe para esta obra no turno ${turnoAtivo}!`);
      return;
    }

    setEquipesLocais([...equipesLocais, { nome: nomeFormatado, turno: turnoAtivo.toUpperCase(), id_obra: String(obraFiltro) }]);
    setNomeNovaEquipe('');
  };

  // --- ALOCAÇÃO DO COLABORADOR À EQUIPE ---
  const handleAlocarParaEquipe = async (idFuncionario, nomeEquipe) => {
    if (!obraFiltro) {
      alert("⚠️ Selecione uma Obra ativa!");
      return;
    }

    if (equipesBloqueadas.includes(nomeEquipe.toUpperCase())) {
      alert(`🔒 A equipe '${nomeEquipe}' já foi finalizada no RDO desta data e está bloqueada para alterações.`);
      return;
    }

    const funcObj = todosFuncionarios.find(f => Number(f.id_funcionario || f.id) === Number(idFuncionario));
    if (!funcObj) return;

    const usuario = usuarioLogado || JSON.parse(localStorage.getItem('usuario') || '{}');
    const ehFolguista = nomeEquipe.toUpperCase() === 'FOLGUISTAS';

    let listaAtualizada = [...alocacoesDoDia];

    if (ehFolguista) {
      listaAtualizada = listaAtualizada.filter(a => Number(a.id_funcionario) !== Number(idFuncionario));

      ['DIURNO', 'NOTURNO'].forEach(t => {
        listaAtualizada.push({
          id_funcionario: funcObj.id_funcionario || funcObj.id,
          id_obra: Number(obraFiltro),
          id_gestor: usuario?.id || null,
          nome: funcObj.nome || funcObj.name,
          cargo: funcObj.cargo || 'N/D',
          matricula: funcObj.matricula || '',
          turno: t,
          status_presenca: 'Folga',
          observacao: 'Folga Programada (Escala)',
          equipe: 'FOLGUISTAS',
          id_veiculo: null
        });
      });
    } else {
      const novaAloc = {
        id_funcionario: funcObj.id_funcionario || funcObj.id,
        id_obra: Number(obraFiltro),
        id_gestor: usuario?.id || null,
        nome: funcObj.nome || funcObj.name,
        cargo: funcObj.cargo || 'N/D',
        matricula: funcObj.matricula || '',
        turno: turnoAtivo,
        status_presenca: 'ALOCADO',
        observacao: '',
        equipe: nomeEquipe,
        id_veiculo: null
      };
      listaAtualizada.push(novaAloc);
    }

    setAlocacoesDoDia(listaAtualizada);

    try {
      await axios.post(`${API_URL}/gestor/diario-efetivo`, {
        data_diario: dataSelecionada,
        id_obra: Number(obraFiltro),
        equipe: nomeEquipe,
        funcionarios: listaAtualizada.filter(a => a.equipe.toUpperCase() === nomeEquipe.toUpperCase())
      });
      
      await carregarTodosOsAgendamentosDoDia();
      await carregarFuncionariosDoGestor();
    } catch (err) {
      console.error("Erro ao alocar funcionário:", err);
      if (err.response?.status === 403) {
        alert(`🔒 ${err.response.data.error}`);
      } else {
        alert("Erro ao salvar alocação no servidor.");
      }
      carregarAlocacoesDaObra();
    }
  };

  // --- REMOVER COLABORADOR DA EQUIPE ---
  const handleRemoverDaEquipe = async (idFuncionario) => {
    const membro = alocacoesDoDia.find(a => Number(a.id_funcionario) === Number(idFuncionario));
    if (!membro) return;

    if (equipesBloqueadas.includes(membro.equipe.toUpperCase())) {
      alert(`🔒 A equipe '${membro.equipe}' já teve o RDO finalizado e está bloqueada.`);
      return;
    }

    const listaAtualizada = alocacoesDoDia.filter(a => Number(a.id_funcionario) !== Number(idFuncionario));
    setAlocacoesDoDia(listaAtualizada);

    try {
      await axios.post(`${API_URL}/gestor/diario-efetivo`, {
        data_diario: dataSelecionada,
        id_obra: Number(obraFiltro),
        equipe: membro.equipe,
        funcionarios: listaAtualizada.filter(a => a.equipe.toUpperCase() === membro.equipe.toUpperCase())
      });

      await carregarTodosOsAgendamentosDoDia();
      await carregarFuncionariosDoGestor();
    } catch (err) {
      console.error("Erro ao remover funcionário da equipe:", err);
      if (err.response?.status === 403) {
        alert(`🔒 ${err.response.data.error}`);
      } else {
        alert("Erro ao atualizar equipe no servidor.");
      }
      carregarAlocacoesDaObra();
    }
  };

  // --- ALTERAR VEÍCULO ATRIBUÍDO AO COLABORADOR ---
  const handleAlterarVeiculoFuncionario = async (idFuncionario, idVeiculo) => {
    const membro = alocacoesDoDia.find(a => Number(a.id_funcionario) === Number(idFuncionario));
    if (!membro) return;

    if (equipesBloqueadas.includes(membro.equipe.toUpperCase())) {
      alert(`🔒 A equipe '${membro.equipe}' já foi finalizada no RDO desta data.`);
      return;
    }

    const idVeicTratado = idVeiculo ? Number(idVeiculo) : null;

    const listaAtualizada = alocacoesDoDia.map(a => {
      if (Number(a.id_funcionario) === Number(idFuncionario)) {
        return { ...a, id_veiculo: idVeicTratado };
      }
      return a;
    });

    setAlocacoesDoDia(listaAtualizada);

    try {
      await axios.post(`${API_URL}/gestor/diario-efetivo`, {
        data_diario: dataSelecionada,
        id_obra: Number(obraFiltro),
        equipe: membro.equipe,
        funcionarios: listaAtualizada.filter(a => a.equipe.toUpperCase() === membro.equipe.toUpperCase())
      });

      carregarTodosOsAgendamentosDoDia();
    } catch (err) {
      console.error("Erro ao alterar veículo:", err);
      if (err.response?.status === 403) {
        alert(`🔒 ${err.response.data.error}`);
      } else {
        alert("Erro ao salvar veículo no servidor.");
      }
      carregarAlocacoesDaObra();
    }
  };

  // --- EXCLUSÃO DE EQUIPE ---
  const handleDeletarEquipe = async (nomeEquipeDeletar) => {
    if (!obraFiltro) {
      alert("⚠️ Selecione uma Obra ativa!");
      return;
    }

    if (equipesBloqueadas.includes(nomeEquipeDeletar.toUpperCase())) {
      alert(`🔒 A equipe '${nomeEquipeDeletar}' já teve seu RDO finalizado e não pode ser excluída.`);
      return;
    }

    if (!window.confirm(`Tem certeza que deseja apagar a equipe "${nomeEquipeDeletar}"? Os colaboradores alocados nela voltarão para a lista de disponíveis e o registro da equipe será excluído.`)) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/gestor/equipe`, {
        params: {
          nome_equipe: nomeEquipeDeletar,
          turno: turnoAtivo,
          id_obra: Number(obraFiltro),
          data_diario: dataSelecionada
        }
      });

      const listaAtualizada = alocacoesDoDia.filter(
        a => !(a.equipe.toUpperCase() === nomeEquipeDeletar.toUpperCase() && String(a.turno).toUpperCase() === turnoAtivo.toUpperCase())
      );

      setAlocacoesDoDia(listaAtualizada);
      setEquipesLocais(prev => prev.filter(
        eq => !(eq.nome.toUpperCase() === nomeEquipeDeletar.toUpperCase() && eq.turno.toUpperCase() === turnoAtivo.toUpperCase() && String(eq.id_obra) === String(obraFiltro))
      ));

      await carregarTodosOsAgendamentosDoDia();
      await carregarFuncionariosDoGestor();

    } catch (err) {
      console.error("Erro ao deletar equipe:", err);
      if (err.response?.status === 403) {
        alert(`🔒 ${err.response.data.error}`);
      } else {
        alert("⚠️ Erro ao excluir a equipe do banco de dados.");
      }
    }
  };

  // --- REMANEJAMENTO DE GESTOR DE ENGENHARIA ---
  const handleIniciarRemanejamento = async (funcionario) => {
    try {
      await carregarGestoresParaModal();
      setRemanejamentoDados({
        id_funcionario: funcionario.id_funcionario || funcionario.id,
        nome_funcionario: funcionario.nome || funcionario.name,
        id_gestor_destino: ''
      });
      setModalAberto(true);
    } catch (err) {
      console.error("Erro ao preparar modal:", err);
      alert("Erro ao buscar lista de gestores.");
    }
  };

  const handleConfirmarTransferencia = async (e) => {
    e.preventDefault();
    const gestorDestinoObj = listaGestores.find(g => Number(g.id) === Number(remanejamentoDados.id_gestor_destino));

    if (!remanejamentoDados.id_gestor_destino || !gestorDestinoObj) {
      alert("Por favor, selecione o Gestor Destino!");
      return;
    }

    try {
      const usuario = usuarioLogado || JSON.parse(localStorage.getItem('usuario') || '{}');

      await axios.post(`${API_URL}/gestor/remanezar-funcionario-vincular`, {
        id_usuario: Number(remanejamentoDados.id_gestor_destino),
        id_funcionario: Number(remanejamentoDados.id_funcionario),
        id_obra: obraFiltro ? Number(obraFiltro) : null,
        data_inicio: dataSelecionada,
        data_fim: null,
        id_usuario_alteracao: usuario?.id || null
      });

      alert(`📢 NOTIFICAÇÃO ENVIADA COM SUCESSO!\n\nColaborador ${remanejamentoDados.nome_funcionario} foi transferido para o Gestor ${gestorDestinoObj.nome}.`);

      setModalAberto(false);
      
      // RE-FETCH SÍNCRONO PARA GARANTIR QUE O COLABORADOR REAPAREÇA OU SEJA REMOVIDO CORRETAMENTE DA INTERFACE
      await carregarAlocacoesDaObra();
      await carregarTodosOsAgendamentosDoDia();
      await carregarFuncionariosDoGestor();
    } catch (err) {
      console.error(err);
      alert("Erro ao realizar transferência do colaborador.");
    }
  };

  // --- UTILITÁRIOS DE STATUS DE TABELAS ---
  const obterStatusPorTurno = (idFuncionario, turnoAlvo) => {
    const ag = todosOsAgendamentosDoDia.find(
      a => String(a.id_funcionario) === String(idFuncionario) && String(a.turno).toUpperCase() === turnoAlvo
    );
    
    if (ag) {
      const statusUpper = String(ag.status_presenca || '').toUpperCase();
      if (statusUpper === 'FOLGA' || String(ag.equipe).toUpperCase() === 'FOLGUISTAS') {
        return { texto: 'FOLGA', corBg: '#fef2f2', corTxt: '#991b1b' };
      }
      if (ag.liberado === 1) {
        return { texto: 'LIBERADO', corBg: '#fef9c3', corTxt: '#854d0e' };
      }
      const dadosObra = obrasDisponiveis.find(o => Number(o.id) === Number(ag.id_obra));
      const nomeObra = dadosObra ? dadosObra.nome_obra : `Obra ID ${ag.id_obra}`;
      return { texto: `${nomeObra} [${ag.equipe}]`, corBg: '#e0f2fe', corTxt: '#0369a1' };
    }
    return { texto: 'Disponível', corBg: '#dcfce7', corTxt: '#15803d' };
  };

  const obterStatusVeiculoPorTurno = (idVeiculo, turnoAlvo) => {
    const aloc = todosOsAgendamentosDoDia.find(
      a => Number(a.id_veiculo) === Number(idVeiculo) && String(a.turno).toUpperCase() === turnoAlvo
    );

    if (aloc) {
      const dadosObra = obrasDisponiveis.find(o => Number(o.id) === Number(aloc.id_obra));
      const nomeObra = dadosObra ? dadosObra.nome_obra : `Obra ID ${aloc.id_obra}`;
      return { texto: `ESCALADO - ${nomeObra} (${aloc.nome})`, corBg: '#e0f2fe', corTxt: '#0369a1' };
    }
    return { texto: 'Disponível', corBg: '#dcfce7', corTxt: '#15803d' };
  };

  // --- FILTRO DE FUNCIONÁRIOS DISPONÍVEIS PARA REMANEJAMENTO ---
  const baseFuncionariosResumo = listaCompletaFuncionarios.length > 0 ? listaCompletaFuncionarios : todosFuncionarios;

  const funcionariosDisponiveisParaRemanejamento = baseFuncionariosResumo.filter(func => {
    const idFunc = func.id_funcionario || func.id;
    const agendamentosDoFuncionario = todosOsAgendamentosDoDia.filter(
      ag => String(ag.id_funcionario) === String(idFunc)
    );

    if (agendamentosDoFuncionario.length === 0) return true;

    const totalmenteLiberado = agendamentosDoFuncionario.every(ag => {
      const st = String(ag.status_presenca || '').toUpperCase();
      return Number(ag.liberado) === 1 || st === 'LIBERADO' || st === 'FOLGA' || String(ag.equipe).toUpperCase() === 'FOLGUISTAS';
    });

    return totalmenteLiberado;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', boxSizing: 'border-box' }}>
      
      {/* 1. SELEÇÃO PRIMÁRIA DE FILTROS DA ESCALA */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px' }}>
        <div style={{ fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '12px', color: '#0f172a', fontSize: '12px' }}>
          1. Parâmetros da Escala (Defina o Turno Primário)
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          
          {/* SELEÇÃO DE TURNO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb' }}>Turno Ativo em Foco *</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setTurnoAtivo('DIURNO')}
                style={{
                  flex: 1,
                  height: '36px',
                  borderRadius: '4px',
                  border: turnoAtivo === 'DIURNO' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  backgroundColor: turnoAtivo === 'DIURNO' ? '#eff6ff' : '#f8fafc',
                  color: turnoAtivo === 'DIURNO' ? '#1d4ed8' : '#64748b',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                ☀️ DIURNO
              </button>

              <button
                type="button"
                onClick={() => setTurnoAtivo('NOTURNO')}
                style={{
                  flex: 1,
                  height: '36px',
                  borderRadius: '4px',
                  border: turnoAtivo === 'NOTURNO' ? '2px solid #1e1b4b' : '1px solid #cbd5e1',
                  backgroundColor: turnoAtivo === 'NOTURNO' ? '#312e81' : '#f8fafc',
                  color: turnoAtivo === 'NOTURNO' ? '#fff' : '#64748b',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                🌙 NOTURNO
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Data do Diário</label>
            <input 
              type="date" 
              style={{ height: '36px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 'bold' }} 
              value={dataSelecionada} 
              onChange={e => setDataSelecionada(e.target.value)} 
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Obra em Gerenciamento *</label>
            <select 
              style={{ height: '36px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 'bold' }} 
              value={obraFiltro} 
              onChange={e => setObraFiltro(e.target.value)}
            >
              <option value="">-- Selecione uma Obra Ativa --</option>
              {obrasDisponiveis.map(o => (
                <option key={o.id} value={o.id}>[{o.codigo_obra}] {o.nome_obra}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

{/* 2. BARRA DE CRIAR EQUIPES E FOLGUISTAS */}
<div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px' }}>
  
  <form onSubmit={handleCriarEquipe} style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', flex: '1 1 300px' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
      <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#334155' }}>
        Nome da Equipe (Turno {turnoAtivo})
      </label>
      <input 
        required
        type="text" 
        placeholder="Ex: EQUIPE HORIZONTAL, VERTICAL..." 
        value={nomeNovaEquipe}
        onChange={e => setNomeNovaEquipe(e.target.value)}
        style={{ height: '36px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: '500', boxSizing: 'border-box' }}
      />
    </div>

    <button 
      type="submit" 
      style={{ height: '36px', padding: '0 16px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
    >
      <Plus style={{ width: '14px', height: '14px' }} /> Criar Equipe ({turnoAtivo})
    </button>
  </form>

  <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '12px' }}>
    <button 
      type="button" 
      onClick={handleCriarEquipeFolguista}
      style={{ height: '36px', padding: '0 16px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
      title="Cria o painel de Folguistas para ambos os turnos (Diurno + Noturno)"
    >
      <Plus style={{ width: '14px', height: '14px' }} /> Criar Equipe de Folga (Ambos os Turnos)
    </button>
  </div>
  
  <button
    type="button"
    onClick={handleCopiarUltimoAgendamento}
    style={{
      height: '36px',
      padding: '0 16px',
      backgroundColor: '#0284c7',
      color: '#fff',
      border: 'none',
      borderRadius: '4px',
      fontWeight: 'bold',
      fontSize: '11px',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      whiteSpace: 'nowrap'
    }}
    title="Copia a formação de equipes e veículos do último dia em que houve agendamento para esta obra"
  >
    📋 Copiar Últimos Agendamentos
  </button> 
</div>
       
      {/* 3. PAINEL DINÂMICO DE ALOCAÇÃO */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px', alignItems: 'start' }}>
        
        {/* COLUNA ESQUERDA: DISPONÍVEIS NO TURNO */}
        <div style={{ backgroundColor: '#fff', border: '2px solid #3b82f6', borderRadius: '6px', padding: '12px', minHeight: '380px' }}>
          <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', fontSize: '11px', color: '#1e40af', textTransform: 'uppercase' }}>
              Disponíveis ({turnoAtivo}): {funcionariosDisponiveisNoTurno.length}
            </span>
          </div>

          {/* CAMPO DE BUSCA DOS DISPONÍVEIS */}
          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <input
              type="text"
              placeholder="Pesquisar por nome, cargo ou mat..."
              value={termoBuscaDisponiveis}
              onChange={(e) => setTermoBuscaDisponiveis(e.target.value)}
              style={{
                width: '100%',
                height: '30px',
                padding: '0 28px 0 8px',
                fontSize: '10px',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
            <Search style={{ width: '12px', height: '12px', color: '#94a3b8', position: 'absolute', right: '8px', top: '9px' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '460px', overflowY: 'auto' }}>
            {funcionariosDisponiveisNoTurno.length === 0 ? (
              <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                {termoBuscaDisponiveis ? 'Nenhum colaborador encontrado com essa busca.' : `Todos os colaboradores já foram alocados para o turno ${turnoAtivo}!`}
              </div>
            ) : (
              funcionariosDisponiveisNoTurno.map(f => {
                const idFunc = f.id_funcionario || f.id;
                return (
                  <div 
                    key={`disp-${idFunc}`} 
                    style={{ padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '6px' }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#0f172a' }}>{f.nome || f.name}</div>
                      <div style={{ fontSize: '9px', color: '#64748b' }}>{f.cargo} | MAT: {f.matricula || '—'}</div>
                    </div>

                    {equipesDoTurnoAtivo.length > 0 && (
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAlocarParaEquipe(idFunc, e.target.value);
                            e.target.value = "";
                          }
                        }}
                        style={{ fontSize: '10px', padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', color: '#1d4ed8', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        <option value="" disabled>+ Mover para Equipe ({turnoAtivo})...</option>
                        {equipesDoTurnoAtivo.map(eq => {
                          const bloqueada = equipesBloqueadas.includes(eq.nome.toUpperCase());
                          return (
                            <option key={`opt-${eq.nome}`} value={eq.nome} disabled={bloqueada}>
                              {eq.nome} {bloqueada ? '🔒 (RDO Finalizado)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: CARDS DE EQUIPES EXCLUSIVAS DO TURNO E OBRA */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
          {equipesDoTurnoAtivo.length === 0 ? (
            <div style={{ backgroundColor: '#fff', border: '1px dashed #cbd5e1', borderRadius: '6px', padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '12px', gridColumn: '1/-1' }}>
              Nenhuma equipe cadastrada para esta obra no turno <strong>{turnoAtivo}</strong>. Crie uma equipe para esta obra acima!
            </div>
          ) : (
            equipesDoTurnoAtivo.map((eq) => {
              const estaBloqueada = equipesBloqueadas.includes(eq.nome.toUpperCase());
              const integrantes = alocacoesDoDia.filter(
                a => a.equipe.toUpperCase() === eq.nome.toUpperCase() && 
                     String(a.turno).toUpperCase() === turnoAtivo.toUpperCase()
              );

              return (
                <div 
                  key={`card-eq-${eq.nome}-${eq.turno}`} 
                  style={{ 
                    backgroundColor: '#fff', 
                    border: estaBloqueada ? '2px solid #f59e0b' : '1px solid #cbd5e1', 
                    borderRadius: '6px', 
                    overflow: 'hidden', 
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    opacity: estaBloqueada ? 0.9 : 1 
                  }}
                >
                  
                  {/* BARRA DE TRAVA DE RDO FINALIZADO */}
                  {estaBloqueada && (
                    <div style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                      <Lock style={{ width: '12px', height: '12px' }} /> RDO FINALIZADO (ESCALA BLOQUEADA)
                    </div>
                  )}

                  {/* Cabeçalho do Card da Equipe */}
                  <div style={{ backgroundColor: estaBloqueada ? '#334155' : '#0f172a', color: '#fff', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{eq.nome}</div>
                      <div style={{ fontSize: '9px', color: '#94a3b8' }}>TURNO: {eq.turno}</div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ backgroundColor: '#334155', padding: '2px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold' }}>
                        {integrantes.length} Colaboradores
                      </span>

                      {!estaBloqueada && (
                        <button
                          type="button"
                          onClick={() => handleDeletarEquipe(eq.nome)}
                          title="Excluir esta equipe"
                          style={{ border: 'none', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', borderRadius: '4px', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          <Trash2 style={{ width: '13px', height: '13px' }} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Integrantes da Equipe */}
                  <div style={{ padding: '8px', minHeight: '120px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#fafafa' }}>
                    {integrantes.length === 0 ? (
                      <div style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '16px' }}>
                        Selecione colaboradores na caixa ao lado para alocar nesta equipe.
                      </div>
                    ) : (
                      integrantes.map((membro) => {
                        const veiculosOrdenados = [...listaVeiculos].sort((a, b) => 
                          (a.placa || '').localeCompare(b.placa || '')
                        );

                        const veiculosDisponiveisOuAtual = veiculosOrdenados.filter(v => {
                          const ocupante = todosOsAgendamentosDoDia.find(
                            a => Number(a.id_veiculo) === Number(v.id) &&
                                 String(a.turno).toUpperCase() === turnoAtivo.toUpperCase()
                          );
                          const ehOVeiculoAtual = Number(membro.id_veiculo) === Number(v.id);
                          return !ocupante || ehOVeiculoAtual;
                        });

                        return (
                          <div 
                            key={`membro-${membro.id_funcionario}`} 
                            style={{ padding: '8px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#0f172a' }}>{membro.nome}</div>
                                <div style={{ fontSize: '8px', color: '#64748b' }}>{membro.cargo}</div>
                              </div>

                              {!estaBloqueada && (
                                <button 
                                  type="button" 
                                  onClick={() => handleRemoverDaEquipe(membro.id_funcionario)}
                                  title="Remover da equipe (retorna para disponíveis)"
                                  style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                                >
                                  <X style={{ width: '14px', height: '14px' }} />
                                </button>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Car style={{ width: '12px', height: '12px', color: '#2563eb' }} />
                              <select
                                disabled={estaBloqueada}
                                value={membro.id_veiculo || ''}
                                onChange={(e) => handleAlterarVeiculoFuncionario(membro.id_funcionario, e.target.value)}
                                style={{ flex: 1, fontSize: '9px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '3px', backgroundColor: estaBloqueada ? '#f1f5f9' : '#f8fafc', color: membro.id_veiculo ? '#15803d' : '#64748b', fontWeight: 'bold' }}
                              >
                                <option value="">-- Sem Veículo Atribuído --</option>
                                {veiculosDisponiveisOuAtual.map(v => (
                                  <option key={v.id} value={v.id}>
                                    [{v.placa}] {v.marca} {v.modelo}
                                  </option>
                                ))}
                              </select>
                            </div>

                          </div>
                        );
                      })
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>

      </div>

{/* 6. TABELA GERAL DE EFETIVO ALOCADO NO DIA */}
<div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px' }}>
  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: mostrarEfetivoEscalado ? '16px' : '0', borderBottom: mostrarEfetivoEscalado ? '1px solid #e2e8f0' : 'none', paddingBottom: mostrarEfetivoEscalado ? '12px' : '0' }}>
    <div style={{ fontWeight: 'bold', textTransform: 'uppercase', color: '#1e293b', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
      <Users style={{ width: '16px', height: '16px', color: '#475569' }} />
      Efetivo Escalado na Obra ({alocacoesDoDia.length} Registro(s))
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      {mostrarEfetivoEscalado && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Filtrar Equipe:</label>
          <select
            value={filtroEquipeTabela}
            onChange={(e) => setFiltroEquipeTabela(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: '500', color: '#334155' }}
          >
            <option value="TODAS">⚠️ TODAS AS EQUIPES</option>
            {[...new Set(alocacoesDoDia.map(a => a.equipe).filter(Boolean))].map(eq => (
              <option key={eq} value={eq}>{eq.toUpperCase()}</option>
            ))}
          </select>
        </div>
      )}

      {/* BOTÃO DE VISIBILIDADE */}
      <button 
        type="button"
        onClick={() => setMostrarEfetivoEscalado(!mostrarEfetivoEscalado)}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#1e293b' }}
      >
        {mostrarEfetivoEscalado ? <EyeOff style={{ width: '14px', height: '14px' }} /> : <Eye style={{ width: '14px', height: '14px' }} />}
        {mostrarEfetivoEscalado ? 'Ocultar Tabela' : 'Ver Tabela'}
      </button>
    </div>
  </div>

  {mostrarEfetivoEscalado && (
    <div style={{ overflowX: 'auto', marginTop: '12px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
        <thead>
          <tr style={{ backgroundColor: '#0f172a', color: '#fff', textTransform: 'uppercase' }}>
            <th style={{ padding: '10px 12px' }}>Colaborador / Matrícula</th>
            <th style={{ padding: '10px 12px' }}>Cargo</th>
            <th style={{ padding: '10px 12px', textAlign: 'center' }}>Turno</th>
            <th style={{ padding: '10px 12px' }}>Equipe Vinculada</th>
            <th style={{ padding: '10px 12px' }}>Veículo Utilizado</th>
            <th style={{ padding: '10px 12px' }}>Obs</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            const alocsFiltradas = alocacoesDoDia.filter(aloc => {
              if (filtroEquipeTabela === 'TODAS') return true;
              return String(aloc.equipe).toUpperCase().trim() === filtroEquipeTabela.toUpperCase().trim();
            });

            if (alocsFiltradas.length === 0) {
              return (
                <tr>
                  <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                    Nenhum colaborador alocado para os critérios selecionados.
                  </td>
                </tr>
              );
            }

            return alocsFiltradas.map((aloc, index) => {
              const ehFolguista = String(aloc.equipe).toUpperCase().includes('FOLGUISTA') || 
                                  String(aloc.status_presenca).toUpperCase() === 'FOLGA';
              const veiculoUtilizado = listaVeiculos.find(v => Number(v.id) === Number(aloc.id_veiculo));

              return (
                <tr 
                  key={`aloc-row-${aloc.id_funcionario}-${aloc.turno}-${index}`} 
                  style={{ 
                    borderBottom: '1px solid #e2e8f0', 
                    backgroundColor: ehFolguista ? '#fef2f2' : (index % 2 === 0 ? '#ffffff' : '#f8fafc') 
                  }}
                >
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 'bold', color: ehFolguista ? '#dc2626' : '#0f172a' }}>
                      {aloc.nome}
                    </div>
                    <div style={{ fontSize: '9px', color: '#64748b' }}>MAT: {aloc.matricula || '—'}</div>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#334155' }}>{aloc.cargo || '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{ backgroundColor: ehFolguista ? '#fee2e2' : '#e2e8f0', color: ehFolguista ? '#991b1b' : '#1e293b', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '9px' }}>
                      {aloc.turno || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 'bold', color: ehFolguista ? '#b91c1c' : '#1e3a8a' }}>
                    {aloc.equipe || 'Geral'}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: '500', color: '#16a34a' }}>
                    {veiculoUtilizado ? `🚗 ${veiculoUtilizado.placa} (${veiculoUtilizado.modelo})` : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#475569', fontStyle: 'italic' }}>
                    {aloc.observacao || '—'}
                  </td>
                </tr>
              );
            });
          })()}
        </tbody>
      </table>
    </div>
  )}
</div>

      {/* 7. RESUMO DE OCUPAÇÃO DE FUNCIONÁRIOS */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: mostrarResumoOcupacao ? '12px' : '0' }}>
          <div style={{ fontWeight: 'bold', textTransform: 'uppercase', color: '#334155', fontSize: '12px' }}>
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
                {baseFuncionariosResumo.map((func, index) => {
                  const idFunc = func.id_funcionario || func.id;
                  const statusDiurno = obterStatusPorTurno(idFunc, 'DIURNO');
                  const statusNoturno = obterStatusPorTurno(idFunc, 'NOTURNO');
                  return (
                    <tr key={`resumo-${idFunc}`} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{func.nome || func.name}</div>
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
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 8. RESUMO DE OCUPAÇÃO DOS VEÍCULOS NO DIA */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: mostrarResumoVeiculos ? '12px' : '0' }}>
          <div style={{ fontWeight: 'bold', textTransform: 'uppercase', color: '#1e3a8a', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Car style={{ width: '16px', height: '16px' }} />
            Resumo Geral da Ocupação dos Veículos no Dia (Por Turno)
          </div>
          <button 
            type="button"
            onClick={() => setMostrarResumoVeiculos(!mostrarResumoVeiculos)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#1e293b' }}
          >
            {mostrarResumoVeiculos ? <EyeOff style={{ width: '14px', height: '14px' }} /> : <Eye style={{ width: '14px', height: '14px' }} />}
            {mostrarResumoVeiculos ? 'Ocultar Tabela' : 'Ver Tabela'}
          </button>
        </div>

        {mostrarResumoVeiculos && (
          <div style={{ overflowX: 'auto', maxHeight: '350px', marginTop: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#1e3a8a', color: '#fff', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{ padding: '10px 12px' }}>Veículo / Identificação</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', width: '40%' }}>Status Turno DIURNO</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', width: '40%' }}>Status Turno NOTURNO</th>
                </tr>
              </thead>
              <tbody>
                {listaVeiculos.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                      Nenhum veículo cadastrado sob sua responsabilidade técnica.
                    </td>
                  </tr>
                ) : (
                  [...listaVeiculos]
                    .sort((a, b) => (a.placa || '').localeCompare(b.placa || ''))
                    .map((veiculo, index) => {
                      const statusDiurno = obterStatusVeiculoPorTurno(veiculo.id, 'DIURNO');
                      const statusNoturno = obterStatusVeiculoPorTurno(veiculo.id, 'NOTURNO');

                      return (
                        <tr key={`resumo-veic-${veiculo.id}`} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{veiculo.placa}</div>
                            <div style={{ fontSize: '9px', color: '#64748b' }}>{veiculo.marca} {veiculo.modelo}</div>
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

      {/* 9. TRANSFERÊNCIA EXTERNA DE ENGENHARIA */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: mostrarRemanejamento ? '12px' : '0' }}>
          <div style={{ fontWeight: 'bold', textTransform: 'uppercase', color: '#334155', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#65a30d', color: '#fff', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px' }}>Colaborador</th>
                  <th style={{ padding: '10px 12px' }}>Cargo</th>
                  <th style={{ padding: '10px 12px' }}>Matrícula</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', width: '180px' }}>Ação de Remanejamento</th>
                </tr>
              </thead>
              <tbody>
                {funcionariosDisponiveisParaRemanejamento.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                      Nenhum colaborador livre ou liberado para remanejamento técnico hoje.
                    </td>
                  </tr>
                ) : (
                  funcionariosDisponiveisParaRemanejamento.map((func, idx) => {
                    const idFunc = func.id_funcionario || func.id;
                    return (
                      <tr key={`reman-item-${idFunc}`} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#0f172a' }}>{func.nome || func.name}</td>
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
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE SELEÇÃO DE DESTINO DE TRANSFERÊNCIA DE GESTOR */}
      {modalAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '6px', width: '90%', maxWidth: '450px', padding: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '16px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', color: '#0f172a' }}>
                Selecionar Engenheiro / Gestor Destino
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