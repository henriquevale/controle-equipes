import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Save, AlertCircle, Plus, Trash2, FileText, Package, HardHat, 
  CalendarDays, Car, Wrench, AlertTriangle, CheckCircle, Eye, EyeOff, 
  LogOut, Clock, UserPlus, Users, Search, X 
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_URL = 'http://localhost:3001/api';
//const API_URL = 'https://api-controle-impacto.duckdns.org/api';

export default function DiarioObraTecnico({ usuarioLogado }) {
  const [dataDiario, setDataDiario] = useState(new Date().toISOString().split('T')[0]);
  const [idObraSelecionada, setIdObraSelecionada] = useState('');
  const [obraDadosCompletos, setObraDadosCompletos] = useState(null);
  
  const [obrasDoGestor, setObrasDoGestor] = useState([]);
  const [listaAtividadesCadastradas, setListaAtividadesCadastradas] = useState([]);
  const [listaMateriaisCadastrados, setListaMateriaisCadastrados] = useState([]);
  const [termoBuscaObra, setTermoBuscaObra] = useState('');
  const [obrasFiltradasExcel, setObrasFiltradasExcel] = useState([]);
  const [mostrarGridExcelObra, setMostrarGridExcelObra] = useState(false);

  const [efetivoAgendado, setEfetivoAgendado] = useState([]);
  const [atividadesLancadas, setAtividadesLancadas] = useState([]); 
  const [materiaisLancados, setMateriaisLancados] = useState([]);
  const [equipeSelecionadaFiltro, setEquipeSelecionadaFiltro] = useState('GERAL');
  
  // Estado para preservar TODAS as equipes encontradas na obra/data
  // Equipes que vieram do banco + equipes criadas localmente (nunca se sobrescrevem)
  const [equipesDoBanco, setEquipesDoBanco] = useState([]);
  const [equipesLocais, setEquipesLocais] = useState([]);
  const listaEquipesTotal = useMemo(() => {
    const combinadas = [...equipesDoBanco];
    equipesLocais.forEach(eq => {
      if (!combinadas.includes(eq)) combinadas.push(eq);
    });
    return combinadas;
  }, [equipesDoBanco, equipesLocais]);

  // Agendas usadas para validar duplicidade de funcionários e veículos
  const [agendaDaObra, setAgendaDaObra] = useState([]);     // todas as equipes da obra/data (servidor)
  const [agendaGlobalDia, setAgendaGlobalDia] = useState([]); // todas as obras na data (servidor)

  const [equipeConfirmada, setEquipeConfirmada] = useState(false);
  const [turnoSelecionado, setTurnoSelecionado] = useState('DIURNO'); // 'DIURNO' ou 'NOTURNO'

  // Estados para o Horário Geral Recomendado/Aplicado a todos da equipe
  const [horarioGeralInicio, setHorarioGeralInicio] = useState('07:00');
  const [horarioGeralFim, setHorarioGeralFim] = useState('17:00');

  const [carregando, setLoading] = useState(false);
  const [erroPainel, setErroPainel] = useState('');
  const [statusEnvio, setStatusEnvio] = useState({ texto: '', tipo: '' });
  const [salvoComSucesso, setSalvoComSucesso] = useState(false);
  const [observacoesContratada, setObservacoesContratada] = useState('');
  const [statusDiario, setStatusDiario] = useState('Normal');

  const [liberarEquipeAoSalvar, setLiberarEquipeAoSalvar] = useState(false);
  const [listaVeiculos, setListaVeiculos] = useState([]);
  const [mostrarTabelaVeiculos, setMostrarTabelaVeiculos] = useState(false);

  // --- NOVOS ESTADOS PARA GESTÃO LOCAL DE EQUIPES E FUNCIONÁRIOS ---
  const [nomeNovaEquipe, setNomeNovaEquipe] = useState('');
  const [todosFuncionariosCadastrados, setTodosFuncionariosCadastrados] = useState([]);
  const [mostrarPainelAdicionarFunc, setMostrarPainelAdicionarFunc] = useState(false);
  const [termoBuscaFuncionario, setTermoBuscaFuncionario] = useState('');

  const ehEquipeFolguista = equipeSelecionadaFiltro === 'FOLGUISTAS';
  const rdoInterrompido = ['Choveu', 'Sem Material', 'Sem Equipamento','Apoio','Sem Atividade','Folga/FDS', 'Outros'].includes(statusDiario);

  useEffect(() => {
    carregarObrasIniciais();
    carregarCadastroAtividades();
    carregarCadastroMateriais();
  }, []);

  useEffect(() => {
    carregarVeiculosDoSistema(); 
    carregarTodosFuncionariosDoSistema();
  }, [dataDiario]); 

  useEffect(() => {
    if (idObraSelecionada && dataDiario && equipeSelecionadaFiltro) {
      buscarEfetivoVindoDoAgendamento();
    }
  }, [idObraSelecionada, dataDiario, equipeSelecionadaFiltro]);

  useEffect(() => {
    if (idObraSelecionada && dataDiario) {
      setSalvoComSucesso(false);
      setStatusDiario('Normal'); 
      setLiberarEquipeAoSalvar(false);
      setObservacoesContratada('');
      
      buscarEfetivoVindoDoAgendamento();
    } else {
      setEfetivoAgendado([]);
      setAtividadesLancadas([]);
      setMateriaisLancados([]);
      setEquipeConfirmada(false);
      setEquipesDoBanco([]);
      setEquipesLocais([]);
      setAgendaDaObra([]);
      setAgendaGlobalDia([]);
    }
  }, [idObraSelecionada, dataDiario]);

  // Ao trocar de obra/data: zera equipes locais e carrega a agenda do dia (todas as obras)
  useEffect(() => {
    if (idObraSelecionada && dataDiario) {
      setEfetivoAgendado([]);
      setEquipesLocais([]);
      setEquipesDoBanco([]);
      setAgendaDaObra([]);
      carregarAgendaGlobalDoDia();
    }
  }, [idObraSelecionada, dataDiario]);
  
  useEffect(() => {
    if (rdoInterrompido) {
      setAtividadesLancadas([]);
      setMateriaisLancados([]);
    } else if (idObraSelecionada && equipeConfirmada) {
      if (atividadesLancadas.length === 0) {
        setAtividadesLancadas([{ id_atividade: '', tipoServico: '', quantidade: '' }]);
      }
      if (materiaisLancados.length === 0) {
        setMateriaisLancados([{ id_material: '', material_nome: '', quantidade: '' }]);
      }
    }
  }, [statusDiario, equipeConfirmada]);

  // Atualização do seletor para respeitar a lista de equipes sem forçar a limpeza
  useEffect(() => {
    if (listaEquipesTotal.length > 0 && !equipeConfirmada) {
      if (!listaEquipesTotal.includes(equipeSelecionadaFiltro)) {
        setEquipeSelecionadaFiltro(listaEquipesTotal[0]);
      }
    } else if (listaEquipesTotal.length === 0 && !equipeConfirmada) {
      setEquipeSelecionadaFiltro('GERAL');
    }
  }, [listaEquipesTotal]);

  const carregarTodosFuncionariosDoSistema = async () => {
    try {
      const user = usuarioLogado || JSON.parse(localStorage.getItem('usuario') || '{}');
      const res = await axios.get(`${API_URL}/gestor/funcionarios-disponiveis`, {
        params: { id: user.id, cargo: user.cargo, data_diario: dataDiario }
      });
      const lista = res.data && res.data.funcionarios ? res.data.funcionarios : (Array.isArray(res.data) ? res.data : []);
      // remove duplicados (mesmo id) e ordena de A a Z
      const mapa = new Map();
      lista.forEach(f => {
        const id = String(f.id_funcionario || f.id);
        if (!mapa.has(id)) mapa.set(id, f);
      });
      setTodosFuncionariosCadastrados(
        [...mapa.values()].sort((a, b) =>
          (a.nome || a.name || '').localeCompare(b.nome || b.name || '', 'pt-BR', { sensitivity: 'base' })
        )
      );
    } catch (e) {
      console.error("Erro ao carregar banco global de funcionários:", e);
    }
  };

  const carregarCadastroAtividades = async () => {
    try {
      const res = await axios.get(`${API_URL}/cadastro-atividades`);
      setListaAtividadesCadastradas(res.data || []);
    } catch (e) {
      console.error("Erro ao carregar cadastro de atividades:", e);
    }
  };

  const carregarCadastroMateriais = async () => {
    try {
      const res = await axios.get(`${API_URL}/materiais/diario-obra`);
      setListaMateriaisCadastrados(res.data || []);
    } catch (e) {
      console.error("Erro ao carregar cadastro de materiais:", e);
    }
  };

  const carregarVeiculosDoSistema = async () => {
    try {
      const gestorId = usuarioLogado?.id || 0; 
      const gestorCargo = usuarioLogado?.cargo || 'GESTOR';

      const res = await axios.get(`${API_URL}/gestor/veiculos`, {
        params: {
          id: gestorId,
          cargo: gestorCargo,
          data_diario: dataDiario
        }
      });
      
      setListaVeiculos(res.data || []);
    } catch (e) {
      console.error("Erro ao carregar veículos para o diário técnico:", e);
    }
  };

  const handleMudarStatusVeiculo = (idVeiculo, novoStatus) => {
    setListaVeiculos(prev => 
      prev.map(v => v.id === idVeiculo ? { ...v, status: novoStatus } : v)
    );
  };

  const carregarObrasIniciais = async () => {
    try {
      setErroPainel('');
      const user = usuarioLogado || JSON.parse(localStorage.getItem('usuario') || '{}');
      if (!user.id) {
        setErroPainel('Sessão inválida. Faça login novamente.');
        return;
      }
      const params = { id: user.id, cargo: user.cargo };
      const res = await axios.get(`${API_URL}/gestor/obras-ativas`, { params });
      const dadosObras = Array.isArray(res.data) ? res.data : [];
      setObrasDoGestor(dadosObras);
      setObrasFiltradasExcel(dadosObras);
    } catch (err) {
      console.error(err);
      setErroPainel('Erro ao carregar as obras vinculadas.');
    }
  };

  const handleFiltrarObraExcel = (e) => {
    const valor = e.target.value;
    setTermoBuscaObra(valor);
    if (valor.trim() === '') {
      setObrasFiltradasExcel(obrasDoGestor);
    } else {
      setObrasFiltradasExcel(obrasDoGestor.filter(o => 
        o.nome_obra.toLowerCase().includes(valor.toLowerCase()) || String(o.codigo_obra).toLowerCase().includes(valor.toLowerCase())
      ));
    }
    setMostrarGridExcelObra(true);
  };

  // --- HELPERS DE VALIDAÇÃO ANTI-DUPLICIDADE (FUNCIONÁRIOS E VEÍCULOS) ---
  const eqUp = (s) => String(s || 'GERAL').trim().toUpperCase();
  const idFuncDe = (f) => String(f.id_funcionario || f.id);
  const regLiberado = (r) =>
    Number(r?.liberado) === 1 || r?.liberado === true || String(r?.status_presenca || '').toUpperCase() === 'LIBERADO';
  const nomeObraDe = (r) => r.obra_nome || `Obra ID ${r.id_obra}`;

  const carregarAgendaGlobalDoDia = async () => {
    try {
      const res = await axios.get(`${API_URL}/gestor/diario-efetivo`, { params: { data_diario: dataDiario } });
      setAgendaGlobalDia(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Erro ao carregar agenda global do dia:", e);
    }
  };

  const carregarAgendaDaObra = async () => {
    try {
      const res = await axios.get(`${API_URL}/gestor/diario-efetivo`, {
        params: { data_diario: dataDiario, id_obra: idObraSelecionada }
      });
      setAgendaDaObra(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Erro ao carregar agenda da obra:", e);
    }
  };

  // Funcionário já usado em OUTRA equipe da obra ou em OUTRA obra (retorna o motivo ou null)
  const conflitoFuncionarioExterno = (idFunc) => {
 /*   const id = String(idFunc);
    const eqAtiva = eqUp(equipeSelecionadaFiltro);

    const outraEquipeLocal = efetivoAgendado.find(
      f => idFuncDe(f) === id && eqUp(f.equipe) !== eqAtiva && !f.liberado
    );
    if (outraEquipeLocal) return `já está na equipe ${eqUp(outraEquipeLocal.equipe)} desta obra`;

    const outraEquipeServidor = agendaDaObra.find(
      r => String(r.id_funcionario) === id && eqUp(r.equipe) !== eqAtiva && !regLiberado(r)
    );
    if (outraEquipeServidor) return `já está na equipe ${eqUp(outraEquipeServidor.equipe)} desta obra`;

    const outraObra = agendaGlobalDia.find(
      r => String(r.id_funcionario) === id && Number(r.id_obra) !== Number(idObraSelecionada) && !regLiberado(r)
    );
    if (outraObra) return `já está alocado em "${nomeObraDe(outraObra)}" [${eqUp(outraObra.equipe)}]`;
*/
    return null;
  };

  // Ao adicionar: bloqueia também se já estiver na própria equipe
  const conflitoFuncionarioAdicionar = (idFunc) => {
    const id = String(idFunc);
    const naEquipe = efetivoAgendado.find(
      f => idFuncDe(f) === id && eqUp(f.equipe) === eqUp(equipeSelecionadaFiltro)
    );
    if (naEquipe) return 'já está nesta equipe';
    return conflitoFuncionarioExterno(idFunc);
  };

  // Veículo já usado em OUTRA equipe da obra ou em OUTRA obra
  const conflitoVeiculoExterno = (idVeic, idFuncAtual) => {
    const v = Number(idVeic);
    const eu = String(idFuncAtual);
    const eqAtiva = eqUp(equipeSelecionadaFiltro);

    const outroLocal = efetivoAgendado.find(
      f => Number(f.id_veiculo) === v && idFuncDe(f) !== eu && eqUp(f.equipe) !== eqAtiva && !f.liberado
    );
    if (outroLocal) return `já está com ${outroLocal.nome} (equipe ${eqUp(outroLocal.equipe)})`;

    const outroServidor = agendaDaObra.find(
      r => Number(r.id_veiculo) === v && String(r.id_funcionario) !== eu && eqUp(r.equipe) !== eqAtiva && !regLiberado(r)
    );
    if (outroServidor) return `já está com ${outroServidor.nome} (equipe ${eqUp(outroServidor.equipe)})`;

    const outraObra = agendaGlobalDia.find(
      r => Number(r.id_veiculo) === v && Number(r.id_obra) !== Number(idObraSelecionada) && !regLiberado(r)
    );
    if (outraObra) return `já está em "${nomeObraDe(outraObra)}" com ${outraObra.nome}`;

    return null;
  };

  // Ao atribuir: bloqueia também se outro colaborador da própria equipe já usa o veículo
  const conflitoVeiculo = (idVeic, idFuncAtual) => {
    const naEquipe = efetivoAgendado.find(
      f => Number(f.id_veiculo) === Number(idVeic) &&
           idFuncDe(f) !== String(idFuncAtual) &&
           eqUp(f.equipe) === eqUp(equipeSelecionadaFiltro)
    );
    if (naEquipe) return `já está atribuído a ${naEquipe.nome}`;
    return conflitoVeiculoExterno(idVeic, idFuncAtual);
  };

  // --- NOVA FUNÇÃO: CRIAR EQUIPE LOCALMENTE ---
  const handleCriarNovaEquipe = (e) => {
    e.preventDefault();
    const nomeFormatado = nomeNovaEquipe.trim().toUpperCase();
    if (!nomeFormatado) return;

    if (listaEquipesTotal.includes(nomeFormatado)) {
      alert(`⚠️ A equipe "${nomeFormatado}" já existe para este diário!`);
      return;
    }

    setEquipesLocais(prev => [...prev, nomeFormatado]);
    setEquipeSelecionadaFiltro(nomeFormatado);
    setNomeNovaEquipe('');
  };

  // --- NOVA FUNÇÃO: ADICIONAR FUNCIONÁRIO COM VALIDAÇÃO ANTI-DUPLICIDADE ---
  const handleAdicionarFuncionarioEquipe = (funcObj) => {
    setErroPainel('');
    const idNovo = String(funcObj.id_funcionario || funcObj.id);

    // 1. Validação Anti-Duplicidade de Funcionários
    const motivoConflito = conflitoFuncionarioAdicionar(idNovo);

    if (motivoConflito) {
      alert(`⚠️ O colaborador ${funcObj.nome || funcObj.name} ${motivoConflito}!`);
      return;
    }

    const horaInicioPadrao = turnoSelecionado === 'NOTURNO' ? '19:00' : '07:00';
    const horaFimPadrao = turnoSelecionado === 'NOTURNO' ? '05:00' : '17:00';

    const novoIntegrante = {
      id_funcionario: funcObj.id_funcionario || funcObj.id,
      nome: funcObj.nome || funcObj.name,
      cargo: funcObj.cargo || 'N/D',
      matricula: funcObj.matricula || '—',
      equipe: equipeSelecionadaFiltro,
      statusPresenca: 'Presente',
      hora_inicio: horarioGeralInicio || horaInicioPadrao,
      hora_fim: horarioGeralFim || horaFimPadrao,
      id_veiculo: null,
      liberado: false,
      _novo: true // adicionado localmente, ainda não salvo
    };

    setEfetivoAgendado(prev => [...prev, novoIntegrante]);
    setSalvoComSucesso(false);
  };

  // --- NOVA FUNÇÃO: REMOVER FUNCIONÁRIO DA EQUIPE ---
  const handleRemoverFuncionarioEquipe = (idFuncionarioRemover) => {
    setEfetivoAgendado(prev => prev.filter(f => String(f.id_funcionario || f.id) !== String(idFuncionarioRemover)));
    // libera o veículo que estava com o colaborador removido
    setListaVeiculos(prev => prev.map(v =>
      Number(v.id_funcionario) === Number(idFuncionarioRemover)
        ? { ...v, id_funcionario: null, status: 'DISPONÍVEL' }
        : v
    ));
    setSalvoComSucesso(false);
  };

  // --- NOVA FUNÇÃO: ALTERAR E VALIDAR VEÍCULO ANTI-DUPLICIDADE ---
  const handleAtribuirVeiculoFuncionario = (idFuncionario, idVeiculoNovo) => {
    const idVeiculoTratado = idVeiculoNovo ? Number(idVeiculoNovo) : null;

    if (idVeiculoTratado) {
      // 2. Validação Anti-Duplicidade de Veículos na mesma obra/data
      const motivoVeiculo = conflitoVeiculo(idVeiculoTratado, idFuncionario);

      if (motivoVeiculo) {
        const veic = listaVeiculos.find(v => Number(v.id) === idVeiculoTratado);
        alert(`⚠️ O veículo ${veic ? veic.placa : '#' + idVeiculoTratado} ${motivoVeiculo}!`);
        return;
      }
    }

    setEfetivoAgendado(prev => prev.map(f => {
      if (String(f.id_funcionario || f.id) === String(idFuncionario)) {
        return { ...f, id_veiculo: idVeiculoTratado };
      }
      return f;
    }));

    // Atualiza espelho na lista global de veículos
    if (!idVeiculoTratado) {
      setListaVeiculos(prev => prev.map(v =>
        Number(v.id_funcionario) === Number(idFuncionario)
          ? { ...v, id_funcionario: null, status: 'DISPONÍVEL' }
          : v
      ));
    }
    if (idVeiculoTratado) {
      setListaVeiculos(prev => prev.map(v => {
        if (Number(v.id) === idVeiculoTratado) {
          return { ...v, id_funcionario: idFuncionario, status: 'EM USO' };
        }
        if (Number(v.id_funcionario) === Number(idFuncionario)) {
          return { ...v, id_funcionario: null, status: 'DISPONÍVEL' };
        }
        return v;
      }));
    }

    setSalvoComSucesso(false);
  };
  
  const aplicarSugestaoHorarioTurno = (turno, listaFuncionarios) => {
    const horaInicioPadrao = turno === 'NOTURNO' ? '19:00' : '07:00';
    const horaFimPadrao = turno === 'NOTURNO' ? '05:00' : '17:00';

    return listaFuncionarios.map(f => ({
      ...f,
      hora_inicio: f.hora_inicio || horaInicioPadrao,
      hora_fim: f.hora_fim || horaFimPadrao
    }));
  };

  const handleMudarTurno = (novoTurno) => {
    setTurnoSelecionado(novoTurno);
    const horaInicioPadrao = novoTurno === 'NOTURNO' ? '19:00' : '07:00';
    const horaFimPadrao = novoTurno === 'NOTURNO' ? '05:00' : '17:00';

    setHorarioGeralInicio(horaInicioPadrao);
    setHorarioGeralFim(horaFimPadrao);

    setEfetivoAgendado(prev => prev.map(f => {
      const pertenceAEquipeAtiva = String(f.equipe || 'Geral').toUpperCase() === String(equipeSelecionadaFiltro || '').toUpperCase();
      if (pertenceAEquipeAtiva) {
        return {
          ...f,
          hora_inicio: horaInicioPadrao,
          hora_fim: horaFimPadrao
        };
      }
      return f;
    }));
    setSalvoComSucesso(false);
  };

  const handleMudarHorarioGeral = (campo, valor) => {
    if (campo === 'hora_inicio') setHorarioGeralInicio(valor);
    if (campo === 'hora_fim') setHorarioGeralFim(valor);

    setEfetivoAgendado(prev => prev.map(f => {
      const pertenceAEquipeAtiva = String(f.equipe || 'Geral').toUpperCase() === String(equipeSelecionadaFiltro || '').toUpperCase();
      if (pertenceAEquipeAtiva) {
        return { ...f, [campo]: valor };
      }
      return f;
    }));
    setSalvoComSucesso(false);
  };

  const buscarEfetivoVindoDoAgendamento = async () => {
    try {
      if (!idObraSelecionada || !dataDiario) return;

      setLoading(true);

      let colaboradoresCarregados = [];

      try {
        const resEfetivo = await axios.get(`${API_URL}/gestor/diario-efetivo`, {
          params: { 
            id_obra: idObraSelecionada, 
            data_diario: dataDiario
          }
        });
        colaboradoresCarregados = Array.isArray(resEfetivo.data) ? resEfetivo.data : [];
        setAgendaDaObra(colaboradoresCarregados);
        
        const equipesUnicas = Array.from(
          new Set(colaboradoresCarregados.map(f => String(f.equipe || 'GERAL').trim().toUpperCase()))
        ).filter(Boolean);

        if (equipesUnicas.length > 0) {
          setEquipesDoBanco(equipesUnicas);
        }
      } catch (errEfetivo) {
        if (errEfetivo.response?.status !== 404) {
          console.warn("Rota de agendamento não encontrada ou sem dados prévios.");
        }
      }

      const resCompleto = await axios.get(`${API_URL}/gestor/salvar-diario-completo`, {
        params: { 
          id_obra: idObraSelecionada, 
          data_diario: dataDiario, 
          equipe: equipeSelecionadaFiltro 
        }
      });

      if (resCompleto.data && resCompleto.data.existe) {
        const { status, observacoes, atividades_tachas, materials_apontados, efetivo_confirmado, turno } = resCompleto.data;

        setStatusDiario(status || 'Normal');
        setObservacoesContratada(observacoes || '');
        if (turno) {
          setTurnoSelecionado(turno);
          setHorarioGeralInicio(turno === 'NOTURNO' ? '19:00' : '07:00');
          setHorarioGeralFim(turno === 'NOTURNO' ? '05:00' : '17:00');
        }

        setAtividadesLancadas(
          (atividades_tachas || []).map(a => ({
            id_atividade: a.id_atividade || a.id_material || '',
            tipoServico: a.tipoServico || a.tipo_servico || '',
            quantidade: a.quantidade || ''
          }))
        );

        setMateriaisLancados(
          (materials_apontados || []).map(m => ({
            id_material: m.id_material || '',
            material_nome: m.material_nome || m.material || '',
            quantidade: m.quantidade || ''
          }))
        );

        if (efetivo_confirmado && efetivo_confirmado.length > 0) {
          colaboradoresCarregados = efetivo_confirmado.map(colab => ({
            ...colab,
            nome: colab.nome || colab.nome,
            statusPresenca: colab.status_presenca || colab.statusPresenca || 'Presente',
            hora_inicio: colab.hora_inicio || (colab.turno === 'NOTURNO' ? '19:00' : '07:00'),
            hora_fim: colab.hora_fim || (colab.turno === 'NOTURNO' ? '05:00' : '17:00')
          }));

          const colabEquipe = colaboradoresCarregados.find(f => String(f.equipe || 'Geral').toUpperCase() === equipeSelecionadaFiltro.toUpperCase());
          if (colabEquipe) {
            setHorarioGeralInicio(colabEquipe.hora_inicio ? colabEquipe.hora_inicio.slice(0,5) : (turnoSelecionado === 'NOTURNO' ? '19:00' : '07:00'));
            setHorarioGeralFim(colabEquipe.hora_fim ? colabEquipe.hora_fim.slice(0,5) : (turnoSelecionado === 'NOTURNO' ? '05:00' : '17:00'));
          }
        } else {
          colaboradoresCarregados = aplicarSugestaoHorarioTurno(turnoSelecionado, colaboradoresCarregados);
        }
      } else {
        setAtividadesLancadas([]);
        setMateriaisLancados([]);
        setObservacoesContratada('');
        setStatusDiario('Normal');
        colaboradoresCarregados = aplicarSugestaoHorarioTurno(turnoSelecionado, colaboradoresCarregados);
      }

      // Remove duplicados do servidor e preserva quem foi adicionado localmente (ainda não salvo)
      setEfetivoAgendado(prev => {
        const chavesVistas = new Set();
        const base = colaboradoresCarregados.filter(f => {
          const chave = `${idFuncDe(f)}|${eqUp(f.equipe)}`;
          if (chavesVistas.has(chave)) return false;
          chavesVistas.add(chave);
          return true;
        });
        const locaisNovos = prev.filter(f => f._novo && !base.some(b => idFuncDe(b) === idFuncDe(f)));
        return [...base, ...locaisNovos];
      });

    } catch (error) {
      if (error.response?.status === 404) {
        console.error(`404 Not Found: Verifique a URL do backend em gestorRoutes.js -> ${error.config?.url}`);
      } else {
        console.error("Erro ao buscar dados do RDO:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const selecionarObra = (obra) => {
    setIdObraSelecionada(obra.id);
    setObraDadosCompletos(obra);
    setTermoBuscaObra(`[${obra.codigo_obra || 'ID: ' + obra.id}] ${obra.nome_obra}`);
    setMostrarGridExcelObra(false);
  };

  const handleMudarStatusPresenca = (indexInEfetivo, valor) => {
    const listaNova = [...efetivoAgendado];
    listaNova[indexInEfetivo].statusPresenca = valor;
    if (valor !== 'Outros') {
      listaNova[indexInEfetivo].statusCustomizado = '';
    }
    setEfetivoAgendado(listaNova);
    setSalvoComSucesso(false);
  };

  const handleMudarTextoCustomizado = (indexInEfetivo, valor) => {
    const listaNova = [...efetivoAgendado];
    listaNova[indexInEfetivo].statusCustomizado = valor;
    setEfetivoAgendado(listaNova);
    setSalvoComSucesso(false);
  };

  const handleMudarHorarioIndividual = (idxGlobal, campo, valor) => {
    setEfetivoAgendado(prev => prev.map((f, i) => {
      if (i === idxGlobal) {
        return { ...f, [campo]: valor };
      }
      return f;
    }));
    setSalvoComSucesso(false);
  };

  // --- MÉTODOS DE ATIVIDADES ---
  const adicionarLinhaAtividade = () => {
    if (rdoInterrompido) return;
    setAtividadesLancadas([...atividadesLancadas, { id_atividade: '', tipoServico: '', quantidade: '' }]);
    setSalvoComSucesso(false);
  };

  const removerLinhaAtividade = (index) => {
    if (rdoInterrompido) return;
    const listaNova = atividadesLancadas.filter((_, i) => i !== index);
    setAtividadesLancadas(listaNova.length > 0 ? listaNova : [{ id_atividade: '', tipoServico: '', quantidade: '' }]);
    setSalvoComSucesso(false);
  };

  const handleMudarAtividadeSelecionada = (index, idAtividadeSelecionada) => {
    const listaNova = [...atividadesLancadas];
    const atvEncontrada = listaAtividadesCadastradas.find(a => String(a.id) === String(idAtividadeSelecionada));

    if (atvEncontrada) {
      const descFormatada = `${atvEncontrada.descricao} (${atvEncontrada.unidade || 'UN'})`;
      listaNova[index].id_atividade = atvEncontrada.id;
      listaNova[index].tipoServico = descFormatada;
    } else {
      listaNova[index].id_atividade = '';
      listaNova[index].tipoServico = '';
    }

    setAtividadesLancadas(listaNova);
    setSalvoComSucesso(false);
  };

  const handleMudarAtividadeCampo = (index, campo, valor) => {
    const listaNova = [...atividadesLancadas];
    listaNova[index][campo] = valor;
    setAtividadesLancadas(listaNova);
    setSalvoComSucesso(false);
  };

  // --- MÉTODOS DE MATERIAIS ---
  const adicionarLinhaMaterial = () => {
    if (rdoInterrompido) return;
    setMateriaisLancados([...materiaisLancados, { id_material: '', material_nome: '', quantidade: '' }]);
    setSalvoComSucesso(false);
  };

  const removerLinhaMaterial = (index) => {
    if (rdoInterrompido) return;
    const listaNova = materiaisLancados.filter((_, i) => i !== index);
    setMateriaisLancados(listaNova.length > 0 ? listaNova : [{ id_material: '', material_nome: '', quantidade: '' }]);
    setSalvoComSucesso(false);
  };

  const handleMudarMaterialSelecionado = (index, idMaterialSelecionado) => {
    const listaNova = [...materiaisLancados];
    const matEncontrado = listaMateriaisCadastrados.find(m => String(m.id || m) === String(idMaterialSelecionado));

    if (matEncontrado) {
      if (typeof matEncontrado === 'object') {
        listaNova[index].id_material = matEncontrado.id || null;
        listaNova[index].material_nome = matEncontrado.nome || matEncontrado.descricao || '';
      } else {
        listaNova[index].id_material = null;
        listaNova[index].material_nome = matEncontrado;
      }
    } else {
      listaNova[index].id_material = '';
      listaNova[index].material_nome = '';
    }

    setMateriaisLancados(listaNova);
    setSalvoComSucesso(false);
  };

  const handleMudarMaterialCampo = (index, campo, valor) => {
    const listaNova = [...materiaisLancados];
    listaNova[index][campo] = valor;
    setMateriaisLancados(listaNova);
    setSalvoComSucesso(false);
  };

  const salvarDiarioCompleto = async () => {
    if (!idObraSelecionada) {
      setErroPainel("Por favor, selecione uma obra antes de salvar.");
      return;
    }
    if (!equipeSelecionadaFiltro || equipeSelecionadaFiltro === 'GERAL') {
      setErroPainel("Selecione e confirme uma equipe específica antes de salvar o diário técnico.");
      return;
    }
    
    try {
      setErroPainel('');
      const efetivoFiltradoPorEquipe = efetivoAgendado.filter(f => {
        return String(f.equipe || 'Geral').toUpperCase() === String(equipeSelecionadaFiltro || '').toUpperCase();
      });

      if (efetivoFiltradoPorEquipe.length === 0) {
        setErroPainel(`Não há funcionários agendados para a equipe selecionada "${equipeSelecionadaFiltro}".`);
        setStatusEnvio({ texto: "Falha na validação dos dados.", tipo: "erro" });
        return;
      }

      // Validação Estrita Anti-Duplicidade de Funcionários antes da submissão
      const idsVistos = new Set();
      const nomesDuplicados = [];

      efetivoFiltradoPorEquipe.forEach(f => {
        const idColab = f.id_funcionario || f.id;
        if (idColab) {
          if (idsVistos.has(String(idColab))) {
            if (!nomesDuplicados.includes(f.nome)) {
              nomesDuplicados.push(f.nome);
            }
          }
          idsVistos.add(String(idColab));
        }
      });

      if (nomesDuplicados.length > 0) {
        setErroPainel(`Não é permitido salvar funcionários repetidos no mesmo diário: ${nomesDuplicados.join(', ')}`);
        setStatusEnvio({ texto: "Falha na validação dos dados.", tipo: "erro" });
        return;
      }

      // Validação anti-duplicidade: funcionários/veículos em outras equipes, outras obras ou repetidos
      const veiculosVistos = new Map();
      const problemas = [];
      efetivoFiltradoPorEquipe.forEach(f => {
        const idF = f.id_funcionario || f.id;
        const conflitoFunc = conflitoFuncionarioExterno(idF);
        if (conflitoFunc) problemas.push(`${f.nome} ${conflitoFunc}`);

        if (f.id_veiculo) {
          const idV = Number(f.id_veiculo);
          const veic = listaVeiculos.find(v => Number(v.id) === idV);
          const placa = veic ? veic.placa : `#${idV}`;

          if (veiculosVistos.has(idV)) {
            problemas.push(`Veículo ${placa} repetido (${veiculosVistos.get(idV)} e ${f.nome})`);
          } else {
            veiculosVistos.set(idV, f.nome);
          }

          const conflitoVeic = conflitoVeiculoExterno(idV, idF);
          if (conflitoVeic) problemas.push(`Veículo ${placa} ${conflitoVeic}`);
        }
      });

      if (problemas.length > 0) {
        setErroPainel(`Corrija antes de salvar: ${problemas.join(' | ')}`);
        setStatusEnvio({ texto: "Falha na validação dos dados.", tipo: "erro" });
        return;
      }

      setStatusEnvio({ texto: "Processando e salvando relatório unificado...", tipo: "processando" });
      
      const atividadesFiltradas = (ehEquipeFolguista || rdoInterrompido)
        ? []
        : atividadesLancadas
            .filter(act => act.tipoServico && act.tipoServico.trim() !== '')
            .map(act => ({
              id_atividade: act.id_atividade || null,
              tipo_servico: act.tipoServico,
              quantidade: parseFloat(act.quantidade) || 0.00
            }));

      const materiaisFiltradas = (ehEquipeFolguista || obraDadosCompletos?.tipo_obra === 'ADMINISTRATIVA' || rdoInterrompido)
        ? []
        : materiaisLancados
            .filter(mat => mat.material_nome && mat.material_nome.trim() !== '')
            .map(mat => ({
              id_material: mat.id_material || null,
              material_nome: mat.material_nome,
              quantidade: parseFloat(mat.quantidade) || 0.00
            }));

      const horaPadraoInicio = turnoSelecionado === 'NOTURNO' ? '19:00' : '07:00';
      const horaPadraoFim = turnoSelecionado === 'NOTURNO' ? '05:00' : '17:00';

      const efetivoMapeado = [];
      efetivoFiltradoPorEquipe.forEach(f => {
        const statusFormatado = f.statusPresenca === 'Outros' 
          ? 'OUTROS' 
          : (f.statusPresenca ? f.statusPresenca.toUpperCase() : 'PRESENTE');

        const veiculoDados = listaVeiculos.find(v => Number(v.id) === Number(f.id_veiculo));

        const baseFuncionario = {
          id_funcionario: f.id_funcionario || f.id || null, 
          nome: f.nome, 
          cargo: f.cargo, 
          matricula: f.matricula,
          status_presenca: statusFormatado, 
          observacao: f.statusPresenca === 'Outros' ? f.statusCustomizado : (f.observacao || null), 
          equipe: f.equipe || 'Geral',
          liberado: liberarEquipeAoSalvar ? 1 : (f.liberado ? 1 : 0),
          data_hora_liberacao: liberarEquipeAoSalvar ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
          hora_inicio: f.hora_inicio || horaPadraoInicio,
          hora_fim: f.hora_fim || horaPadraoFim,
          
          id_veiculo: veiculoDados ? veiculoDados.id : null,
          placa_veiculo: veiculoDados ? veiculoDados.placa : null,
          marca_veiculo: veiculoDados ? veiculoDados.marca : null,
          modelo_veiculo: veiculoDados ? veiculoDados.modelo : null,
          ano_veiculo: veiculoDados ? veiculoDados.ano : null,
          tipo_veiculo: veiculoDados ? veiculoDados.tipo : null,
          status_veiculo: veiculoDados ? veiculoDados.status : null
        };

        efetivoMapeado.push(baseFuncionario);
      });

      const payload = {
        data_diario: dataDiario,
        id_obra: idObraSelecionada,
        id_gestor: usuarioLogado?.id,
        equipe: equipeSelecionadaFiltro, 
        turno: turnoSelecionado,
        status: statusDiario, 
        liberar_equipe: liberarEquipeAoSalvar,
        efetivo_confirmado: efetivoMapeado,
        atividades_tachas: atividadesFiltradas, 
        materials_apontados: materiaisFiltradas, 
        observacoes: observacoesContratada
      };
      
      await axios.post(`${API_URL}/gestor/salvar-diario-completo`, payload);
      
      if (liberarEquipeAoSalvar) {
        setEfetivoAgendado(prev => prev.map(f => {
          if (String(f.equipe || 'Geral').toUpperCase() === equipeSelecionadaFiltro.toUpperCase()) {
            return { ...f, liberado: true };
          }
          return f;
        }));
      }

      const msgSucesso = liberarEquipeAoSalvar 
        ? `✓ RDO salvo e equipe LIBERADA com sucesso!` 
        : `✓ RDO Completo salvo com sucesso com o status: ${statusDiario}`;

      setStatusEnvio({ texto: msgSucesso, tipo: "sucesso" });
      // o que foi salvo deixa de ser "local" e as agendas são atualizadas
      setEfetivoAgendado(prev => prev.map(f => ({ ...f, _novo: false })));
      carregarAgendaDaObra();
      carregarAgendaGlobalDoDia();
      setSalvoComSucesso(true);
      setTimeout(() => setStatusEnvio({ texto: '', tipo: '' }), 4000);
    } catch (err) {
      console.error("Erro ao salvar diário:", err);
      const mensagemErro = err.response?.data?.mensagem || err.message || "Erro interno no servidor.";
      setErroPainel(`Erro ao salvar o relatório: ${mensagemErro}`);
      setStatusEnvio({ texto: "Erro ao salvar o relatório técnico completo.", tipo: "erro" });
    }
  };

  const exportarParaPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const dataFormatada = dataDiario ? dataDiario.split('-').reverse().join('/') : '--/--/----';
      const nomeObraText = obraDadosCompletos?.nome_obra || 'Não informada';
      const codObraText = obraDadosCompletos?.codigo_obra || idObraSelecionada || '---';

      doc.setFillColor(15, 23, 42); 
      doc.rect(10, 10, 190, 10, 'F');
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
      doc.text("DIÁRIO DE OBRA COMPLETO - RELATÓRIO DIÁRIO DE OPERAÇÃO (RDO)", 14, 16.5);

      doc.setFontSize(9); doc.setTextColor(0, 0, 0); doc.setFillColor(241, 245, 249);
      doc.rect(10, 25, 190, 22, 'F'); doc.rect(10, 25, 190, 22, 'S');

      doc.setFont("helvetica", "bold"); doc.text("OBRA/CONTRATO:", 13, 31);
      doc.setFont("helvetica", "normal");
      doc.text(`[${String(codObraText)}] ${String(nomeObraText)}`, 45, 31);

      doc.setFont("helvetica", "bold"); doc.text("DATA DO DIÁRIO:", 13, 37);
      doc.setFont("helvetica", "normal"); doc.text(`${String(dataFormatada)}`, 45, 37);

      doc.setFont("helvetica", "bold");
      doc.text("STATUS DO DIA:", 13, 43);
      doc.setFont("helvetica", "normal"); doc.text(`${String(statusDiario).toUpperCase()}`, 45, 43);

      doc.setFont("helvetica", "bold"); doc.text("CONTRATADA:", 120, 31);
      doc.setFont("helvetica", "normal");
      doc.text("IMPACTO SINALIZAÇÕES", 150, 31);

      doc.setFont("helvetica", "bold"); doc.text("TURNO:", 120, 37);
      doc.setFont("helvetica", "normal");
      doc.text(turnoSelecionado === 'NOTURNO' ? "NOTURNO (19h - 05h)" : "DIURNO (07h - 17h)", 150, 37);

      let currentY = 54;

      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text(`1. Efetivo e Presença (Equipe: ${equipeSelecionadaFiltro} | Turno: ${turnoSelecionado})`, 10, currentY);
      const colunasEfetivo = ["Colaborador / Nome", "Função", "Horário", "Status de Presença", "Veículo / Placa"];
      
      const funcionariosDaEquipeAtiva = (efetivoAgendado || []).filter(
        f => String(f.equipe || 'Geral').toUpperCase() === equipeSelecionadaFiltro.toUpperCase()
      );

      const horaPadraoPDFInicio = turnoSelecionado === 'NOTURNO' ? '19:00' : '07:00';
      const horaPadraoPDFFim = turnoSelecionado === 'NOTURNO' ? '05:00' : '17:00';

      const linhasEfetivo = funcionariosDaEquipeAtiva.map(f => {
        const v = (listaVeiculos || []).find(ve => Number(ve.id) === Number(f.id_veiculo));
        const veiculoText = v ? `${v.placa} (${v.modelo})` : 'Nenhum';

        const baseStatus = f?.statusPresenca === 'Outros' ? String(f?.statusCustomizado || 'Outros') : String(f?.statusPresenca).toUpperCase();
        const statusTexto = f.liberado 
          ? `${baseStatus} (🟡 LIBERADO)` 
          : baseStatus;

        const hi = f?.hora_inicio || horaPadraoPDFInicio;
        const hf = f?.hora_fim || horaPadraoPDFFim;
        const horarioTexto = `${hi.slice(0, 5)} - ${hf.slice(0, 5)}`;

        return [
          String(f?.nome || '---'), 
          String(f?.cargo || '---'), 
          horarioTexto, 
          statusTexto,
          veiculoText
        ];
      });

      autoTable(doc, {
        startY: currentY + 2,
        head: [colunasEfetivo],
        body: linhasEfetivo.length > 0 ? linhasEfetivo : [["Nenhum funcionário encontrado para esta equipe", "-", "-", "-", "-"]],
        theme: 'grid',
        headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8.5 },
        styles: { cellPadding: 2 }
      });
      currentY = doc.lastAutoTable.finalY + 8;

      let sectionCounter = 2;

      if (!ehEquipeFolguista) {
        if (currentY > 230) { doc.addPage(); currentY = 15; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(10);
        doc.text(`${sectionCounter}. Produção e Atividades Executadas`, 10, currentY);
        sectionCounter++;
        
        const colunasAtividades = ["Item", "Descrição do Serviço / Atividade", "Quantidade Produzida"];
        const linesAtividades = rdoInterrompido ? [] : atividadesLancadas
          .filter(act => act.tipoServico !== '')
          .map((act, index) => [String(index + 1), String(act.tipoServico), act.quantidade || '0.00']);
        autoTable(doc, {
          startY: currentY + 2,
          head: [colunasAtividades],
          body: linesAtividades.length > 0 ? linesAtividades : [["-", rdoInterrompido ? `Obra interrompida: ${statusDiario}` : "Nenhuma atividade registrada.", "0.00"]],
          theme: 'grid',
          headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 9 },
          bodyStyles: { fontSize: 8.5 },
          columnStyles: { 0: { cellWidth: 15, halign: 'center' }, 1: { cellWidth: 130 }, 2: { cellWidth: 45, halign: 'right' } },
          styles: { cellPadding: 2 }
        });
        currentY = doc.lastAutoTable.finalY + 8;
      }

      if (obraDadosCompletos?.tipo_obra !== 'ADMINISTRATIVA' && !ehEquipeFolguista) {
        if (currentY > 230) { doc.addPage(); currentY = 15; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(10);
        doc.text(`${sectionCounter}. Materiais Diários e Insumos Aplicados`, 10, currentY);
        sectionCounter++;
        
        const colunasMateriais = ["Item", "Descrição do Insumo / Material", "Qtd Aplicada"];
        const linesMateriais = rdoInterrompido ? [] : materiaisLancados
          .filter(mat => mat.material_nome !== '')
          .map((mat, index) => [String(index + 1), String(mat.material_nome), mat.quantidade || '0.00']);
        autoTable(doc, {
          startY: currentY + 2,
          head: [colunasMateriais],
          body: linesMateriais.length > 0 ? linesMateriais : [["-", rdoInterrompido ? `Obra interrompida: ${statusDiario}` : "Nenhum material associado.", "0.00"]],
          theme: 'grid',
          headStyles: { fillColor: [14, 116, 144], textColor: 255, fontSize: 9 },
          bodyStyles: { fontSize: 8.5 },
          columnStyles: { 0: { cellWidth: 15, halign: 'center' }, 1: { cellWidth: 130 }, 2: { cellWidth: 45, halign: 'right' } },
          styles: { cellPadding: 2 }
        });
        currentY = doc.lastAutoTable.finalY + 8;
      }

      if (observacoesContratada && observacoesContratada.trim() !== '') {
        if (currentY > 240) { doc.addPage(); currentY = 15; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(10);
        doc.text(`${sectionCounter}. Observações e Ocorrências Importantes`, 10, currentY);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9);
        const obsCortada = doc.splitTextToSize(observacoesContratada, 185);
        doc.text(obsCortada, 12, currentY + 5);
      }

      doc.save(`RDO_Completo_Producao_Materiais_${codObraText}_${dataDiario}.pdf`);
    } catch (pdfError) {
      console.error("Erro interno ao processar o PDF:", pdfError);
      alert("Houve um problema de estruturação ao gerar o PDF.");
    }
  };

  const funcionariosDaEquipe = efetivoAgendado.filter(f => String(f.equipe || 'Geral').toUpperCase() === equipeSelecionadaFiltro.toUpperCase());
  const totalPresentes = funcionariosDaEquipe.filter(f => f.statusPresenca === 'Presente' || f.statusPresenca === 'Integração').length;
  const totalFolgas = funcionariosDaEquipe.filter(f => f.statusPresenca === 'Folga').length;
  const totalFaltas = funcionariosDaEquipe.filter(f => f.statusPresenca === 'Faltou').length;
  const totalLiberados = funcionariosDaEquipe.filter(f => f.liberado).length;

  // Filtragem de funcionários disponíveis no sistema para adicionar na equipe
  const funcionariosDisponiveisParaAdicionar = todosFuncionariosCadastrados.filter(func => {
    const idFunc = String(func.id_funcionario || func.id);
    const jaNaEquipe = !!conflitoFuncionarioAdicionar(idFunc);
    
    if (jaNaEquipe) return false;

    const termo = termoBuscaFuncionario.toLowerCase().trim();
    if (!termo) return true;

    const nomeMatch = (func.nome || func.name || '').toLowerCase().includes(termo);
    const cargoMatch = (func.cargo || '').toLowerCase().includes(termo);
    const matMatch = String(func.matricula || '').toLowerCase().includes(termo);

    return nomeMatch || cargoMatch || matMatch;
  });

  const idsFuncionariosNaEquipe = new Set(
    funcionariosDaEquipe
      .map(f => f.id_funcionario || f.id)
      .filter(Boolean)
      .map(id => String(id).trim())
  );

  const veiculosDoQuadroAtivo = listaVeiculos.filter(veiculo => {
    const idMotoristaVeiculo = veiculo.id_funcionario || veiculo.id_condutor;
    if (idMotoristaVeiculo && idsFuncionariosNaEquipe.has(String(idMotoristaVeiculo).trim())) {
      return true;
    }
    return funcionariosDaEquipe.some(f => Number(f.id_veiculo) === Number(veiculo.id));
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', fontFamily: 'sans-serif', fontSize: '12px' }}>
      
      {erroPainel && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', color: '#991b1b', fontWeight: 'bold' }}>
          <AlertCircle style={{ width: '16px', height: '16px', marginRight: '8px' }} />
          <span>{erroPainel}</span>
        </div>
      )}

      {/* BLOCO 1: ESCOPO DE SELEÇÃO E CRIAÇÃO DE EQUIPE */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
        <div style={{ padding: '8px 12px', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '11px', borderBottom: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#475569' }}>
          <span>SELEÇÃO DE DATA, OBRA ALVO E EQUIPES</span>
        </div>
        
        <div style={{ padding: '12px 16px', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', borderBottom: idObraSelecionada ? '1px dashed #cbd5e1' : 'none' }}>
          <div style={{ width: '180px' }}>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', marginBottom: '4px' }}>DATA DO DIÁRIO</label>
            <input type="date" disabled={!!idObraSelecionada} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} value={dataDiario} onChange={e => setDataDiario(e.target.value)} />
          </div>

          <div style={{ flex: '1', minWidth: '300px', position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', marginBottom: '4px' }}>OBRA ALVO</label>
            <input type="text" placeholder="Selecione a obra..." disabled={!!idObraSelecionada} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} value={termoBuscaObra} onChange={handleFiltrarObraExcel} onFocus={() => setMostrarGridExcelObra(true)} />
            {mostrarGridExcelObra && (
              <div style={{ position: 'absolute', top: '56px', left: 0, right: 0, backgroundColor: '#fff', border: '2px solid #94a3b8', borderRadius: '4px', zIndex: 110, maxHeight: '150px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace' }}>
                  <tbody>
                    {obrasFiltradasExcel.map(obra => (
                      <tr key={obra.id} onClick={() => selecionarObra(obra)} style={{ cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#dbeafe'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}>
                        <td style={{ padding: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold', width: '70px' }}>{obra.codigo_obra || obra.id}</td>
                        <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>{obra.nome_obra} {obra.tipo_obra && `(${obra.tipo_obra})`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {idObraSelecionada && (
            <button 
              onClick={() => { 
                setIdObraSelecionada(''); 
                setObraDadosCompletos(null);
                setTermoBuscaObra(''); 
                setEfetivoAgendado([]); 
                setAtividadesLancadas([]);
                setMateriaisLancados([]); 
                setSalvoComSucesso(false); 
                setEquipeConfirmada(false);
                setEquipeSelecionadaFiltro('GERAL');
                setEquipesDoBanco([]);
                setEquipesLocais([]);
                setAgendaDaObra([]);
                setStatusDiario('Normal');
                setLiberarEquipeAoSalvar(false);
              }} 
              style={{ height: '32px', padding: '0 12px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Mudar Obra
            </button>
          )}
        </div>

        {idObraSelecionada && (
          <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', maxWidth: '350px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', marginBottom: '4px', color: '#475569' }}>
                IDENTIFICAÇÃO DA EQUIPE DE TRABALHO
              </label>
              <select
                disabled={equipeConfirmada}
                value={equipeSelecionadaFiltro}
                onChange={e => setEquipeSelecionadaFiltro(e.target.value)}
                style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: equipeConfirmada ? '#e2e8f0' : '#fff', fontWeight: 'bold', color: '#334155' }}
              >
                {listaEquipesTotal.length === 0 && (
                  <option value="GERAL">-- NENHUMA EQUIPE ENCONTRADA --</option>
                )}
                {listaEquipesTotal.map(eq => (
                  <option key={eq} value={eq}>{eq}</option>
                ))}
              </select>
            </div>

            {/* CRIAR NOVA EQUIPE */}
            {!equipeConfirmada && (
              <form onSubmit={handleCriarNovaEquipe} style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '9px', fontWeight: 'bold', color: '#475569' }}>CRIAR EQUIPE LOCAL</label>
                  <input
                    type="text"
                    placeholder="Ex: EQUIPE ASFALTO"
                    value={nomeNovaEquipe}
                    onChange={e => setNomeNovaEquipe(e.target.value)}
                    style={{ height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}
                  />
                </div>
                <button
                  type="submit"
                  style={{ height: '32px', padding: '0 12px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={14} /> Criar
                </button>
              </form>
            )}
            
            {!equipeConfirmada ? (
              <button
                type="button"
                disabled={listaEquipesTotal.length === 0}
                onClick={() => setEquipeConfirmada(true)}
                style={{ height: '32px', padding: '0 16px', backgroundColor: listaEquipesTotal.length === 0 ? '#cbd5e1' : '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: listaEquipesTotal.length === 0 ? 'not-allowed' : 'pointer' }}
              >
                Confirmar Equipe
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEquipeConfirmada(false);
                  setAtividadesLancadas([{ id_atividade: '', tipoServico: '', quantidade: '' }]);
                  setMateriaisLancados([{ id_material: '', material_nome: '', quantidade: '' }]);
                  setSalvoComSucesso(false);
                }}
                style={{ height: '32px', padding: '0 16px', backgroundColor: '#262626', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Mudar Equipe
              </button>
            )}
          </div>
        )}
      </div>

      {/* BLOCOS INFERIORES ATIVOS APÓS CONFIRMAÇÃO */}
      {idObraSelecionada && equipeConfirmada && (
        <>
          {/* SEÇÃO STATUS OPERACIONAL E SELEÇÃO DE TURNO / HORÁRIO GERAL */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px', display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#334155', marginBottom: '6px', fontFamily: 'monospace' }}>
                STATUS OPERACIONAL DO DIÁRIO (RDO)
              </label>
              <select
                value={statusDiario}
                onChange={e => setStatusDiario(e.target.value)}
                style={{ width: '280px', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 'bold', backgroundColor: rdoInterrompido ? '#fff5f5' : '#f0fdf4', color: rdoInterrompido ? '#991b1b' : '#166534' }}
              >
                <option value="Normal">Obra Normal / Em Andamento</option>
                <option value="Choveu">Obra Interrompida por Chuva</option>
                <option value="Sem Material">Obra Interrompida Sem Material</option>
                <option value="Sem Equipamento">Obra Interrompida Sem Equipamento</option>
                <option value="Apoio">Apoio</option>
                <option value="Sem Atividade">Sem Atividade</option>
                <option value="Folga/FDS">Folga / Fim de Semana</option>
                <option value="Outros">Obra Interrompida por Outros Motivos</option>
              </select>
            </div>

            {/* SELEÇÃO DE TURNO E HORÁRIO GERAL APLICADO A TODOS */}
            <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#334155', fontFamily: 'monospace' }}>
                TURNO E HORÁRIO GERAL DA EQUIPE
              </label>
              
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', height: '24px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'bold', color: '#1e293b' }}>
                  <input
                    type="checkbox"
                    checked={turnoSelecionado === 'DIURNO'}
                    onChange={() => handleMudarTurno('DIURNO')}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2563eb' }}
                  />
                  <span>Diurno</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'bold', color: '#1e293b' }}>
                  <input
                    type="checkbox"
                    checked={turnoSelecionado === 'NOTURNO'}
                    onChange={() => handleMudarTurno('NOTURNO')}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2563eb' }}
                  />
                  <span>Noturno</span>
                </label>
              </div>

              {/* INPUTS DE HORÁRIO GERAL REPLICADOS EM LOTE */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                <Clock size={14} color="#2563eb" />
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569' }}>Aplicar p/ Todos:</span>
                <input 
                  type="time" 
                  value={horarioGeralInicio} 
                  onChange={e => handleMudarHorarioGeral('hora_inicio', e.target.value)} 
                  style={{ fontSize: '11px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '3px', fontWeight: 'bold' }} 
                />
                <span style={{ fontSize: '10px', color: '#64748b' }}>até</span>
                <input 
                  type="time" 
                  value={horarioGeralFim} 
                  onChange={e => handleMudarHorarioGeral('hora_fim', e.target.value)} 
                  style={{ fontSize: '11px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '3px', fontWeight: 'bold' }} 
                />
              </div>
            </div>

          </div>

          {/* STATUS DE VEÍCULOS VINCULADOS À EQUIPE ATIVA */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: mostrarTabelaVeiculos ? '12px' : '0' }}>
              <div style={{ fontWeight: 'bold', textTransform: 'uppercase', color: '#1e293b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Car style={{ width: '16px', height: '16px', color: '#2563eb' }} />
                Status dos Veículos no RDO (Atrelados aos seus Colaboradores e Equipe)
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
                      <th style={{ padding: '10px 12px', textAlign: 'center', width: '180px' }}>Status no RDO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {veiculosDoQuadroAtivo.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                          Nenhum veículo da frota está atualmente vinculado a colaboradores desta equipe selecionada.
                        </td>
                      </tr>
                    ) : (
                      veiculosDoQuadroAtivo.map((veiculo, index) => {
                        const motorista = funcionariosDaEquipe.find(f => Number(f.id_funcionario || f.id) === Number(veiculo.id_funcionario) || Number(f.id_veiculo) === Number(veiculo.id));
                        return (
                          <tr key={`veic-${veiculo.id}`} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#0f172a' }}>{veiculo.placa}</td>
                            <td style={{ padding: '10px 12px', color: '#334155' }}>{veiculo.marca} {veiculo.modelo} ({veiculo.ano})</td>
                            <td style={{ padding: '10px 12px', color: '#64748b' }}>{veiculo.tipo}</td>
                            <td style={{ padding: '10px 12px', fontWeight: '500', color: '#1e293b' }}>
                              {motorista ? `${motorista.nome} (${motorista.cargo})` : (veiculo.id_funcionario ? `ID Funcionário: #${veiculo.id_funcionario}` : 'Sem Motorista')}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <select
                                value={veiculo.status || 'DISPONÍVEL'}
                                onChange={(e) => handleMudarStatusVeiculo(veiculo.id, e.target.value)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: 
                                    veiculo.status === 'EM MANUTENÇÃO' ? '#fef2f2' : 
                                    veiculo.status === 'EM USO' ? '#fef9c3' : '#f0fdf4',
                                  color: 
                                    veiculo.status === 'EM MANUTENÇÃO' ? '#991b1b' : 
                                    veiculo.status === 'EM USO' ? '#713f12' : '#166534',
                                  cursor: 'pointer'
                                }}
                              >
                                <option value="DISPONÍVEL">🟢 DISPONÍVEL</option>
                                <option value="EM USO">🟡 EM USO</option>
                                <option value="EM MANUTENÇÃO">🔴 EM MANUTENÇÃO</option>
                              </select>
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

          {/* SEÇÃO 1: EFETIVO (CARDS E PAINEL DE ADIÇÃO ANTI-DUPLICIDADE) */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', color: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                EFETIVO ATIVO - EQUIPE: <span style={{ color: '#2563eb' }}>{equipeSelecionadaFiltro}</span> {carregando && '(Carregando...)'}
                
                {funcionariosDaEquipe.length > 0 && (
                  <div style={{ display: 'inline-flex', gap: '8px', marginLeft: '15px', fontSize: '11px', fontWeight: 'normal', verticalAlign: 'middle' }}>
                    <span style={{ backgroundColor: '#e2fbe8', color: '#15803d', padding: '2px 6px', borderRadius: '3px' }}>Pres: <strong>{totalPresentes}</strong></span>
                    <span style={{ backgroundColor: '#fffbeb', color: '#b45309', padding: '2px 6px', borderRadius: '3px' }}>Folg: <strong>{totalFolgas}</strong></span>
                    <span style={{ backgroundColor: '#fef2f2', color: '#b91c1c', padding: '2px 6px', borderRadius: '3px' }}>Falt: <strong>{totalFaltas}</strong></span>
                    {totalLiberados > 0 && (
                      <span style={{ backgroundColor: '#fef9c3', color: '#854d0e', padding: '2px 6px', borderRadius: '3px' }}>Liberados: <strong>{totalLiberados}</strong></span>
                    )}
                  </div>
                )}
              </div>

              {/* BOTÃO PARA EXPANDIR PAINEL DE ADIÇÃO DE FUNCIONÁRIOS */}
              <button
                type="button"
                onClick={() => setMostrarPainelAdicionarFunc(!mostrarPainelAdicionarFunc)}
                style={{ height: '28px', padding: '0 12px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}
              >
                <UserPlus size={14} /> {mostrarPainelAdicionarFunc ? 'Fechar Adição' : 'Adicionar Colaborador'}
              </button>
            </div>

            {/* PAINEL DE BUSCA E ADIÇÃO DE FUNCIONÁRIOS */}
            {mostrarPainelAdicionarFunc && (
              <div style={{ padding: '12px', backgroundColor: '#f0f9ff', borderBottom: '1px solid #bae6fd', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', color: '#0369a1', fontSize: '11px' }}>
                    Selecione um Colaborador Disponível para incluir na equipe ({equipeSelecionadaFiltro}):
                  </span>
                  <div style={{ position: 'relative', width: '250px' }}>
                    <input
                      type="text"
                      placeholder="Pesquisar por nome ou cargo..."
                      value={termoBuscaFuncionario}
                      onChange={e => setTermoBuscaFuncionario(e.target.value)}
                      style={{ width: '100%', height: '26px', padding: '0 24px 0 8px', fontSize: '10px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                    />
                    <Search style={{ width: '12px', height: '12px', color: '#94a3b8', position: 'absolute', right: '6px', top: '7px' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {funcionariosDisponiveisParaAdicionar.length === 0 ? (
                    <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', gridColumn: '1/-1', textAlign: 'center', padding: '10px' }}>
                      Nenhum colaborador livre disponível encontrado.
                    </div>
                  ) : (
                    funcionariosDisponiveisParaAdicionar.map(func => {
                      const idF = func.id_funcionario || func.id;
                      return (
                        <div key={`add-func-${idF}`} style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '10px' }}>{func.nome || func.name}</div>
                            <div style={{ fontSize: '8px', color: '#64748b' }}>{func.cargo} | MAT: {func.matricula || '—'}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAdicionarFuncionarioEquipe(func)}
                            style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '3px', padding: '3px 8px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }}
                          >
                            + Adicionar
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {funcionariosDaEquipe.length === 0 ? (
                <div style={{ padding: '16px', color: '#b45309', backgroundColor: '#fffbeb', border: '1px dashed #fcd34d', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold' }}>
                  Nenhum funcionário agendado para a equipe "{equipeSelecionadaFiltro}". Clique em "+ Adicionar Colaborador" acima para incluir membros.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                  {efetivoAgendado
                    .filter(f => String(f.equipe || 'Geral').toUpperCase() === equipeSelecionadaFiltro.toUpperCase())
                    .map((func, index) => {
                      const indexGlobal = efetivoAgendado.findIndex(original => (original.id_funcionario || original.id) ? String(original.id_funcionario || original.id) === String(func.id_funcionario || func.id) : original.nome === func.nome);
                      const estaLiberado = func.liberado;
                      const horaInicioCard = func.hora_inicio || horarioGeralInicio;
                      const horaFimCard = func.hora_fim || horarioGeralFim;
                      const idFuncionarioAtual = func.id_funcionario || func.id;

                      // Veículos disponíveis ordenados para seleção sem duplicidade
                      const veiculosDisponiveisOuAtual = [...listaVeiculos].sort((a, b) => (a.placa || '').localeCompare(b.placa || '')).filter(v => {
                        const idOcupante = v.id_funcionario || v.id_condutor;
                        const ehDoMesmo = Number(v.id) === Number(func.id_veiculo) || String(idOcupante) === String(idFuncionarioAtual);
                        const outroUsoNoEfetivo = efetivoAgendado.some(f => 
                          String(f.id_funcionario || f.id) !== String(idFuncionarioAtual) && Number(f.id_veiculo) === Number(v.id)
                        );
                        // mantém o veículo atual e só lista os que não estão em uso por outro colaborador/equipe/obra
                        return Number(v.id) === Number(func.id_veiculo) || !conflitoVeiculo(v.id, idFuncionarioAtual);
                      });

                      return (
                        <div key={`${idFuncionarioAtual || indexGlobal}-${index}`} style={{ border: estaLiberado ? '1px solid #fde047' : '1px solid #e2e8f0', borderRadius: '4px', padding: '8px', backgroundColor: estaLiberado ? '#fefce8' : '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '6px' }}>
                          <div>
                            <div style={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '2px', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{func.nome}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {estaLiberado && (
                                  <span style={{ fontSize: '9px', backgroundColor: '#fef08a', color: '#854d0e', padding: '1px 5px', borderRadius: '3px', fontWeight: 'bold' }}>
                                    🟡 LIBERADO
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoverFuncionarioEquipe(idFuncionarioAtual)}
                                  title="Remover da equipe"
                                  style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px' }}>{func.cargo}</div>
                            
                            <div style={{ display: 'flex', gap: 4, marginTop: 4, marginBottom: 6, alignItems: 'center' }}>
                              <Clock size={12} color="#64748b" />
                              <input type="time" value={horaInicioCard.slice(0,5)}
                                onChange={e => handleMudarHorarioIndividual(indexGlobal, 'hora_inicio', e.target.value)} style={{ fontSize: '10px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '3px' }} />
                              <span style={{ fontSize: '10px', color: '#64748b' }}>até</span>
                              <input type="time" value={horaFimCard.slice(0,5)}
                                onChange={e => handleMudarHorarioIndividual(indexGlobal, 'hora_fim', e.target.value)} style={{ fontSize: '10px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '3px' }} />
                            </div>

                            <select 
                              value={func.statusPresenca} 
                              onChange={e => handleMudarStatusPresenca(indexGlobal, e.target.value)}
                              style={{ width: '100%', height: '26px', padding: '0 4px', fontSize: '11px', fontWeight: 'bold', marginBottom: '6px' }}
                            >
                              <option value="Presente">Presente</option>
                              <option value="Folga">Folga</option>
                              <option value="Faltou">Faltou</option>
                              <option value="Integração">Integração</option>
                              <option value="Outros">Outros</option>
                            </select>

                            {/* SELETOR DE VEÍCULO DO COLABORADOR */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Car size={12} color="#2563eb" />
                              <select
                                value={func.id_veiculo || ''}
                                onChange={e => handleAtribuirVeiculoFuncionario(idFuncionarioAtual, e.target.value)}
                                style={{ flex: 1, fontSize: '9px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '3px', fontWeight: 'bold', color: func.id_veiculo ? '#15803d' : '#64748b' }}
                              >
                                <option value="">-- Sem Veículo Atribuído --</option>
                                {veiculosDisponiveisOuAtual.map(v => (
                                  <option key={v.id} value={v.id}>
                                    [{v.placa}] {v.marca} {v.modelo}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {func.statusPresenca === 'Outros' && (
                              <input
                                type="text"
                                placeholder="Especifique o motivo..."
                                value={func.statusCustomizado || ''}
                                onChange={e => handleMudarTextoCustomizado(indexGlobal, e.target.value)}
                                style={{ marginTop: '4px', height: '24px', padding: '0 6px', fontSize: '10px', width: '100%', boxSizing: 'border-box' }}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* SEÇÃO 2: PRODUÇÃO */}
          {!ehEquipeFolguista && (
            <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px' }}>
              <div style={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>PRODUÇÃO E ATIVIDADES EXECUTADAS</span>
                <button type="button" disabled={rdoInterrompido} onClick={adicionarLinhaAtividade} style={{ height: '26px', padding: '0 10px', backgroundColor: rdoInterrompido ? '#cbd5e1' : '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: rdoInterrompido ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                  + Adicionar Serviço
                </button>
              </div>

              {rdoInterrompido ? (
                <div style={{ padding: '10px', backgroundColor: '#fef2f2', border: '1px dashed #fca5a5', color: '#991b1b', borderRadius: '4px', textAlign: 'center' }}>
                  Lançamento de produção bloqueado devido ao status da obra: <strong>{statusDiario}</strong>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {atividadesLancadas.map((act, index) => (
                    <div key={`act-${index}`} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select 
                        value={act.id_atividade || ''} 
                        onChange={e => handleMudarAtividadeSelecionada(index, e.target.value)} 
                        style={{ flex: 1, height: '30px', padding: '0 6px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                      >
                        <option value="">-- SELECIONE O SERVIÇO --</option>
                        {listaAtividadesCadastradas.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.descricao} ({a.unidade || 'UN'}) - [{a.categoria || 'GERAL'}]
                          </option>
                        ))}
                      </select>
                      <input type="number" placeholder="Qtd" value={act.quantidade} onChange={e => handleMudarAtividadeCampo(index, 'quantidade', e.target.value)} style={{ width: '90px', height: '28px', padding: '0 6px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                      <button type="button" onClick={() => removerLinhaAtividade(index)} style={{ padding: '6px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SEÇÃO 3: MATERIAIS */}
          {!ehEquipeFolguista && obraDadosCompletos?.tipo_obra !== 'ADMINISTRATIVA' && (
            <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px' }}>
              <div style={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>MATERIAIS DIÁRIOS E INSUMOS APLICADOS</span>
                <button type="button" disabled={rdoInterrompido} onClick={adicionarLinhaMaterial} style={{ height: '26px', padding: '0 10px', backgroundColor: rdoInterrompido ? '#cbd5e1' : '#0e7490', color: '#fff', border: 'none', borderRadius: '4px', cursor: rdoInterrompido ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                  + Adicionar Material
                </button>
              </div>

              {rdoInterrompido ? (
                <div style={{ padding: '10px', backgroundColor: '#fef2f2', border: '1px dashed #fca5a5', color: '#991b1b', borderRadius: '4px', textAlign: 'center' }}>
                  Lançamento de materiais bloqueado devido ao status da obra: <strong>{statusDiario}</strong>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {materiaisLancados.map((mat, index) => (
                    <div key={`mat-${index}`} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select 
                        value={mat.id_material || ''} 
                        onChange={e => handleMudarMaterialSelecionado(index, e.target.value)} 
                        style={{ flex: 1, height: '30px', padding: '0 6px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                      >
                        <option value="">-- SELECIONE O MATERIAL --</option>
                        {listaMateriaisCadastrados.map(m => {
                          const idVal = typeof m === 'object' ? m.id : m;
                          const nomeExibicao = typeof m === 'object' ? `${m.nome || m.descricao} ${m.unidade ? `(${m.unidade})` : ''}` : m;
                          return (
                            <option key={idVal} value={idVal}>
                              {nomeExibicao}
                            </option>
                          );
                        })}
                      </select>
                      <input type="number" placeholder="Qtd" value={mat.quantidade} onChange={e => handleMudarMaterialCampo(index, 'quantidade', e.target.value)} style={{ width: '90px', height: '28px', padding: '0 6px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                      <button type="button" onClick={() => removerLinhaMaterial(index)} style={{ padding: '6px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* OBSERVAÇÕES */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', color: '#1e293b', marginBottom: '6px' }}>OBSERVAÇÕES E OCORRÊNCIAS DO DIA</label>
            <textarea rows="3" value={observacoesContratada} onChange={e => setObservacoesContratada(e.target.value)} placeholder="Digite aqui problemas mecânicos, paralisações, condições climáticas detalhadas..." style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontFamily: 'sans-serif', fontSize: '12px', boxSizing: 'border-box' }}></textarea>
          </div>

          {/* PAINEL DE OPERAÇÕES FINAIS */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '10px' }}>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold', color: liberarEquipeAoSalvar ? '#854d0e' : '#475569', fontSize: '11px', userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={liberarEquipeAoSalvar} 
                onChange={e => setLiberarEquipeAoSalvar(e.target.checked)} 
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#ca8a04' }}
              />
              <LogOut size={16} color={liberarEquipeAoSalvar ? '#ca8a04' : '#64748b'} />
              <span>Liberar esta equipe ao salvar RDO (Permite realocação em outra obra no mesmo turno)</span>
            </label>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={exportarParaPDF} style={{ height: '36px', padding: '0 16px', backgroundColor: '#475569', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={16} /> Exportar PDF
              </button>
              <button type="button" onClick={salvarDiarioCompleto} style={{ height: '36px', padding: '0 20px', backgroundColor: liberarEquipeAoSalvar ? '#ca8a04' : '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Save size={16} /> {liberarEquipeAoSalvar ? 'Salvar RDO e Liberar Equipe' : 'Salvar RDO no Banco'}
              </button>
            </div>
          </div>

          {/* NOTIFICAÇÃO DE STATUS DO ENVIO NA PARTE INFERIOR */}
          {statusEnvio.texto && (
            <div style={{ 
              padding: '10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', 
              backgroundColor: statusEnvio.tipo === 'sucesso' ? '#bbf7d0' : statusEnvio.tipo === 'erro' ? '#fecaca' : '#eff6ff', 
              color: statusEnvio.tipo === 'sucesso' ? '#166534' : statusEnvio.tipo === 'erro' ? '#991b1b' : '#1e40af' 
            }}>
              {statusEnvio.texto}
            </div>
          )}
        </>
      )}
    </div>
  );
}