import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios'; 
import { Users, Trash2, Plus, X, Eye, EyeOff, Car, Search, CheckCircle2, MoveHorizontal, Download, Pencil, Check } from 'lucide-react';

// --- HELPERS ---
const eqUp = (s) => String(s || '').toUpperCase().trim();

const estaLiberado = (a) =>
  Number(a?.liberado) === 1 || String(a?.status_presenca || '').toUpperCase() === 'LIBERADO';

// Remove registros duplicados do mesmo funcionário (prioriza o registro NÃO liberado)
const deduplicarAlocacoes = (lista = []) => {
  const mapa = new Map();
  lista.forEach(a => {
    const chave = String(a.id_funcionario);
    const existente = mapa.get(chave);
    if (!existente) {
      mapa.set(chave, a);
    } else if (estaLiberado(existente) && !estaLiberado(a)) {
      mapa.set(chave, a);
    }
  });
  return [...mapa.values()];
};

// Remove funcionários duplicados da base (mesmo id) e ordena A-Z
const deduplicarFuncionarios = (lista = []) => {
  const mapa = new Map();
  lista.forEach(f => {
    const id = String(f.id_funcionario || f.id);
    if (!mapa.has(id)) mapa.set(id, f);
  });
  return [...mapa.values()].sort((a, b) =>
    (a.nome || a.name || '').localeCompare(b.nome || b.name || '', 'pt-BR', { sensitivity: 'base' })
  );
};

export default function DiarioEfetivo({ obrasDisponiveis = [], usuarioLogado }) {

  const API_URL = 'http://localhost:3001/api';
  //const API_URL = 'https://api-controle-impacto.duckdns.org/api';

  // --- FILTROS PRIMÁRIOS DE CABEÇALHO ---
  const [dataSelecionada, setDataSelecionada] = useState(new Date().toISOString().split('T')[0]);
  const [obraFiltro, setObraFiltro] = useState('');
  const [filtroEquipeTabela, setFiltroEquipeTabela] = useState('TODAS');

  // --- CAMPO DE PESQUISA NOS DISPONÍVEIS, VEÍCULOS E BUSCA DE VEÍCULO NO VÍNCULO ---
  const [termoBuscaDisponiveis, setTermoBuscaDisponiveis] = useState('');
  const [termoBuscaVeiculos, setTermoBuscaVeiculos] = useState('');
  const [buscaVeiculoFiltro, setBuscaVeiculoFiltro] = useState({});

  // --- DADOS DO SISTEMA ---
  const [todosFuncionarios, setTodosFuncionarios] = useState([]);
  const [listaCompletaFuncionarios, setListaCompletaFuncionarios] = useState([]); // Base completa para o Resumo
  const [alocacoesDoDia, setAlocacoesDoDia] = useState([]);
  const [todosOsAgendamentosDoDia, setTodosOsAgendamentosDoDia] = useState([]);
  const [listaVeiculos, setListaVeiculos] = useState([]);
  const [equipesConcluidas, setEquipesConcluidas] = useState([]); // equipes com RDO finalizado (apenas visual)

  // --- CONTROLE DE EQUIPES LOCAIS (POR OBRA) ---
  const [equipesLocais, setEquipesLocais] = useState([]); 
  const [nomeNovaEquipe, setNomeNovaEquipe] = useState('');
  const [equipeEditando, setEquipeEditando] = useState(null); // { nomeAntigo, novoNome }
  
  // --- CONTROLE DE VISIBILIDADE DE PAINÉIS/TABELAS ---
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
      carregarEquipesConcluidas();
    }
    carregarTodosOsAgendamentosDoDia();
    carregarFuncionariosDoGestor();
    carregarVeiculosDoGestor(); 
  }, [dataSelecionada, obraFiltro]);

  // --- BUSCAR EQUIPES COM RDO FINALIZADO (APENAS PARA MUDAR A COR, NÃO BLOQUEIA) ---
  const carregarEquipesConcluidas = async () => {
    if (!obraFiltro || !dataSelecionada) return;
    try {
      const res = await axios.get(`${API_URL}/gestor/equipes-finalizadas`, {
        params: { data_diario: dataSelecionada, id_obra: obraFiltro }
      });
      setEquipesConcluidas((res.data || []).map(eqUp));
    } catch (e) {
      console.error("Erro ao carregar status de conclusão das equipes:", e);
      setEquipesConcluidas([]);
    }
  };

  const equipeEstaConcluida = (nomeEquipe) => equipesConcluidas.includes(eqUp(nomeEquipe));

  // --- COPIAR ÚLTIMO AGENDAMENTO/ESCALA REGISTRADO (SEM DUPLICAR FUNCIONÁRIOS) ---
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

      // Funcionários e veículos já ocupados em OUTRAS obras na data atual
      const funcionariosOcupadosOutrasObras = new Set(
        todosOsAgendamentosDoDia
          .filter(a => Number(a.id_obra) !== Number(obraFiltro) && !estaLiberado(a))
          .map(a => String(a.id_funcionario))
      );
      const veiculosOcupadosOutrasObras = new Set(
        todosOsAgendamentosDoDia
          .filter(a => Number(a.id_obra) !== Number(obraFiltro) && a.id_veiculo)
          .map(a => String(a.id_veiculo))
      );

      const funcionariosVistos = new Set();
      const veiculosVistos = new Set();
      let ignoradosOutraObra = 0;

      const novasAlocacoes = [];
      alocacoes.forEach(item => {
        const idFunc = String(item.id_funcionario);

        // evita duplicar o mesmo funcionário
        if (funcionariosVistos.has(idFunc)) return;

        // evita puxar quem já está escalado em outra obra hoje
        if (funcionariosOcupadosOutrasObras.has(idFunc)) {
          ignoradosOutraObra++;
          return;
        }
        funcionariosVistos.add(idFunc);

        // evita repetir/conflitar veículo
        let idVeiculo = item.id_veiculo ? String(item.id_veiculo) : null;
        if (idVeiculo && (veiculosVistos.has(idVeiculo) || veiculosOcupadosOutrasObras.has(idVeiculo))) {
          idVeiculo = null;
        }
        if (idVeiculo) veiculosVistos.add(idVeiculo);

        novasAlocacoes.push({
          ...item,
          id_obra: Number(obraFiltro),
          id_veiculo: idVeiculo ? Number(idVeiculo) : null
        });
      });

      if (novasAlocacoes.length === 0) {
        alert("Nenhum colaborador do histórico está livre para ser copiado (todos já estão escalados em outras obras).");
        return;
      }

      // Se vai substituir, limpa primeiro as equipes existentes do dia (evita duplicar)
      if (alocacoesDoDia.length > 0) {
        const equipesExistentes = [...new Set(alocacoesDoDia.map(a => a.equipe).filter(Boolean))];
        for (const nomeEq of equipesExistentes) {
          await axios.delete(`${API_URL}/gestor/equipe`, {
            params: {
              nome_equipe: nomeEq,
              id_obra: Number(obraFiltro),
              data_diario: dataSelecionada
            }
          });
        }
      }

      await axios.post(`${API_URL}/gestor/diario-efetivo`, {
        data_diario: dataSelecionada,
        id_obra: Number(obraFiltro),
        efetivo: novasAlocacoes
      });

      let msg = `✅ Escala copiada com sucesso do dia ${data_origem}! (${novasAlocacoes.length} colaborador(es))`;
      if (ignoradosOutraObra > 0) {
        msg += `\n\nℹ️ ${ignoradosOutraObra} colaborador(es) não foram copiados porque já estão escalados em outra obra hoje.`;
      }
      alert(msg);

      await carregarAlocacoesDaObra();
      await carregarTodosOsAgendamentosDoDia();
      await carregarFuncionariosDoGestor();

    } catch (err) {
      console.error("Erro ao copiar último agendamento:", err);
      if (err.response?.status === 403) {
        alert(`🔒 ${err.response.data.error}`);
      } else {
        alert(err.response?.data?.error || "Erro ao copiar a escala do agendamento anterior.");
      }
      carregarAlocacoesDaObra();
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
      const alocs = deduplicarAlocacoes((res.data || []).map(colab => ({
        ...colab
      })));
      setAlocacoesDoDia(alocs);

      setEquipesLocais(prev => {
        const deOutrasObras = prev.filter(e => String(e.id_obra) !== String(obraFiltro));
        const novasDaObraAtual = [];

        alocs.forEach(aloc => {
          if (aloc.equipe) {
            const eqNome = aloc.equipe.trim().toUpperCase();
            
            const jaExiste = novasDaObraAtual.some(
              e => e.nome.toUpperCase() === eqNome && 
                   String(e.id_obra) === String(obraFiltro)
            );

            if (!jaExiste) {
              novasDaObraAtual.push({ 
                nome: eqNome, 
                id_obra: String(obraFiltro) 
              });
            }
          }
        });

        const equipesLocaisCriadasManualmente = prev.filter(
          e => String(e.id_obra) === String(obraFiltro)
        );

        const combinadas = [...novasDaObraAtual];
        equipesLocaisCriadasManualmente.forEach(eqManual => {
          if (!combinadas.some(c => c.nome.toUpperCase() === eqManual.nome.toUpperCase())) {
            combinadas.push(eqManual);
          }
        });

        return [...deOutrasObras, ...combinadas];
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
        data_diario: dataSelecionada
      };
      const res = await axios.get(`${API_URL}/gestor/funcionarios-disponiveis`, { params });
      const lista = res.data && res.data.funcionarios ? res.data.funcionarios : [];
      setTodosFuncionarios(lista);
      setListaCompletaFuncionarios(lista);

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
               String(eq.id_obra) === String(obraFiltro)
      );

      if (jaExiste) {
        alert("A equipe de Folguistas já foi criada para esta obra!");
        return prevEquipes;
      }

      return [
        ...prevEquipes,
        { nome: nomeFolguista, id_obra: String(obraFiltro) }
      ];
    });
  };

  // --- EQUIPES FILTRADAS EXCLUSIVAMENTE PARA A OBRA SELECIONADA ---
  const equipesDaObraAtiva = equipesLocais.filter(
    eq => String(eq.id_obra) === String(obraFiltro)
  );

  // --- UTILITÁRIOS DE STATUS DE TABELAS ---
  const obterStatusFuncionario = (idFuncionario) => {
    const ag = todosOsAgendamentosDoDia.find(
      a => String(a.id_funcionario) === String(idFuncionario)
    );
    
    if (ag) {
      const statusUpper = String(ag.status_presenca || '').toUpperCase();
      if (statusUpper === 'FOLGA' || String(ag.equipe).toUpperCase() === 'FOLGUISTAS') {
        return { texto: 'FOLGA', corBg: '#fef2f2', corTxt: '#991b1b', id_obra: ag.id_obra, grupo: 'indisponivel' };
      }
      if (ag.liberado === 1) {
        return { texto: 'LIBERADO', corBg: '#fef9c3', corTxt: '#854d0e', id_obra: ag.id_obra, grupo: 'disponivel' };
      }
      const dadosObra = obrasDisponiveis.find(o => Number(o.id) === Number(ag.id_obra));
      const nomeObra = dadosObra ? dadosObra.nome_obra : `Obra ID ${ag.id_obra}`;
      return { texto: `${nomeObra} [${ag.equipe}]`, corBg: '#e0f2fe', corTxt: '#0369a1', id_obra: ag.id_obra, emOutraObra: true, grupo: 'indisponivel' };
    }
    return { texto: 'Disponível', corBg: '#dcfce7', corTxt: '#15803d', emOutraObra: false, grupo: 'disponivel' };
  };

  // --- BASE ÚNICA (SEM DUPLICADOS, A-Z) USADA NO QUADRO E NOS RESUMOS ---
  const baseFuncionariosResumo = useMemo(() => {
    const base = listaCompletaFuncionarios.length > 0 ? listaCompletaFuncionarios : todosFuncionarios;
    return deduplicarFuncionarios(base);
  }, [listaCompletaFuncionarios, todosFuncionarios]);

  // --- QUADRO DE FUNCIONÁRIOS: DISPONÍVEIS EM CIMA, DEPOIS OS INDISPONÍVEIS, TUDO EM ORDEM ALFABÉTICA ---
  const { quadroDisponiveis, quadroIndisponiveis } = useMemo(() => {
    const termo = termoBuscaDisponiveis.toLowerCase().trim();

    const filtrados = baseFuncionariosResumo.filter(func => {
      const idFunc = func.id_funcionario || func.id;

      if (termo) {
        const nomeMatch = (func.nome || func.name || '').toLowerCase().includes(termo);
        const cargoMatch = (func.cargo || '').toLowerCase().includes(termo);
        const matMatch = String(func.matricula || '').toLowerCase().includes(termo);
        if (!nomeMatch && !cargoMatch && !matMatch) return false;
      }

      // Oculta APENAS quem já está alocado na obra selecionada (e não foi liberado)
      const jaEstaAlocadoNaObraAtual = alocacoesDoDia.some(a =>
        String(a.id_funcionario) === String(idFunc) && !estaLiberado(a)
      );
      return !jaEstaAlocadoNaObraAtual;
    });

    const comStatus = filtrados.map(func => ({
      func,
      status: obterStatusFuncionario(func.id_funcionario || func.id)
    }));

    return {
      quadroDisponiveis: comStatus.filter(x => x.status.grupo === 'disponivel'),
      quadroIndisponiveis: comStatus.filter(x => x.status.grupo !== 'disponivel')
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseFuncionariosResumo, alocacoesDoDia, termoBuscaDisponiveis, todosOsAgendamentosDoDia, obrasDisponiveis]);

  const totalQuadro = quadroDisponiveis.length + quadroIndisponiveis.length;

  // --- EXPORTAÇÃO DO RESUMO DE OCUPAÇÃO PARA O RH (CSV) ---
  const handleDownloadResumoRH = () => {
    const base = baseFuncionariosResumo;
    if (!base || base.length === 0) {
      alert("Não há dados de funcionários para exportar.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // \uFEFF força o UTF-8 correto no MS Excel
    csvContent += "Nome;Matricula;Cargo;Data;Status / Ocupacao\n";

    base.forEach(func => {
      const idFunc = func.id_funcionario || func.id;
      const status = obterStatusFuncionario(idFunc);
      const nome = (func.nome || func.name || '').replace(/;/g, ',');
      const matricula = (func.matricula || '—').replace(/;/g, ',');
      const cargo = (func.cargo || '—').replace(/;/g, ',');
      const statusTexto = status.texto.replace(/;/g, ',');

      csvContent += `"${nome}";"${matricula}";"${cargo}";"${dataSelecionada}";"${statusTexto}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Resumo_Ocupacao_RH_${dataSelecionada}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- VEÍCULOS FILTRADOS POR BUSCA DE PLACA ---
  const veiculosFiltrados = useMemo(() => {
    return [...listaVeiculos]
      .sort((a, b) => (a.placa || '').localeCompare(b.placa || ''))
      .filter(veiculo => {
        const termo = termoBuscaVeiculos.toLowerCase().trim();
        if (!termo) return true;

        const placaMatch = (veiculo.placa || '').toLowerCase().includes(termo);
        const marcaMatch = (veiculo.marca || '').toLowerCase().includes(termo);
        const modeloMatch = (veiculo.modelo || '').toLowerCase().includes(termo);

        return placaMatch || marcaMatch || modeloMatch;
      });
  }, [listaVeiculos, termoBuscaVeiculos]);

  // --- CRIAÇÃO DE EQUIPE ---
  const handleCriarEquipe = (e) => {
    e.preventDefault();
    if (!obraFiltro) {
      alert("⚠️ Selecione uma Obra ativa!");
      return;
    }

    const nomeFormatado = nomeNovaEquipe.trim().toUpperCase();
    if (!nomeFormatado) return;

    const jaExiste = equipesLocais.some(
      eq => eq.nome.toUpperCase() === nomeFormatado && 
            String(eq.id_obra) === String(obraFiltro)
    );

    if (jaExiste) {
      alert(`⚠️ A equipe "${nomeFormatado}" já existe para esta obra!`);
      return;
    }

    setEquipesLocais([...equipesLocais, { nome: nomeFormatado, id_obra: String(obraFiltro) }]);
    setNomeNovaEquipe('');
  };

  // --- RENOMEAR EQUIPE ---
  const handleConfirmarRenomear = async () => {
    if (!equipeEditando) return;
    const { nomeAntigo, novoNome } = equipeEditando;
    const nomeNovo = novoNome.trim().toUpperCase();

    if (!nomeNovo || nomeNovo === eqUp(nomeAntigo)) {
      setEquipeEditando(null);
      return;
    }

    const jaExiste = equipesDaObraAtiva.some(eq => eqUp(eq.nome) === nomeNovo);
    if (jaExiste) {
      alert(`⚠️ Já existe uma equipe chamada "${nomeNovo}" nesta obra!`);
      return;
    }

    const membros = alocacoesDoDia.filter(a => eqUp(a.equipe) === eqUp(nomeAntigo));

    // Atualiza o nome localmente (lista de equipes da obra)
    const renomearLocal = () => setEquipesLocais(prev => prev.map(eq =>
      (eqUp(eq.nome) === eqUp(nomeAntigo) && String(eq.id_obra) === String(obraFiltro))
        ? { ...eq, nome: nomeNovo }
        : eq
    ));

    // Equipe vazia: só existe localmente
    if (membros.length === 0) {
      renomearLocal();
      setEquipeEditando(null);
      return;
    }

    try {
      // remove a equipe com o nome antigo e recria com o novo nome mantendo os integrantes
      await axios.delete(`${API_URL}/gestor/equipe`, {
        params: {
          nome_equipe: nomeAntigo,
          id_obra: Number(obraFiltro),
          data_diario: dataSelecionada
        }
      });

      await axios.post(`${API_URL}/gestor/diario-efetivo`, {
        data_diario: dataSelecionada,
        id_obra: Number(obraFiltro),
        equipe: nomeNovo,
        funcionarios: membros.map(m => ({ ...m, equipe: nomeNovo }))
      });

      renomearLocal();
      setEquipeEditando(null);

      await carregarAlocacoesDaObra();
      await carregarTodosOsAgendamentosDoDia();
      await carregarFuncionariosDoGestor();
      await carregarEquipesConcluidas();
    } catch (err) {
      console.error("Erro ao renomear equipe:", err);
      alert(err.response?.data?.error || "Erro ao renomear a equipe no servidor.");
      setEquipeEditando(null);
      carregarAlocacoesDaObra();
      carregarTodosOsAgendamentosDoDia();
    }
  };

  // --- ALOCAÇÃO / TROCA DE COLABORADOR ENTRE EQUIPES ---
  const handleAlocarParaEquipe = async (idFuncionario, nomeEquipe) => {
    if (!obraFiltro) {
      alert("⚠️ Selecione uma Obra ativa!");
      return;
    }

    const funcObj = baseFuncionariosResumo.find(
      f => String(f.id_funcionario || f.id) === String(idFuncionario)
    );
    if (!funcObj) return;

    const usuario = usuarioLogado || JSON.parse(localStorage.getItem('usuario') || '{}');
    const ehFolguista = eqUp(nomeEquipe) === 'FOLGUISTAS';

    // Se já estava em outra equipe desta obra, guardamos a origem e preservamos o veículo
    const membroAtual = alocacoesDoDia.find(
      a => String(a.id_funcionario) === String(idFuncionario) && !estaLiberado(a)
    );
    const equipeOrigem = membroAtual?.equipe || null;

    let listaAtualizada = alocacoesDoDia.filter(a => String(a.id_funcionario) !== String(idFuncionario));

    const baseFuncionario = {
      id_funcionario: funcObj.id_funcionario || funcObj.id,
      id_obra: Number(obraFiltro),
      id_gestor: usuario?.id || null,
      nome: funcObj.nome || funcObj.name,
      cargo: funcObj.cargo || 'N/D',
      matricula: funcObj.matricula || '',
      id_veiculo: ehFolguista ? null : (membroAtual?.id_veiculo || null)
    };

    if (ehFolguista) {
      listaAtualizada.push({
        ...baseFuncionario,
        status_presenca: 'Folga',
        observacao: 'Folga Programada (Escala)',
        equipe: 'FOLGUISTAS'
      });
    } else {
      listaAtualizada.push({
        ...baseFuncionario,
        status_presenca: 'ALOCADO',
        observacao: '',
        equipe: nomeEquipe
      });
    }

    setAlocacoesDoDia(listaAtualizada);

    try {
      await axios.post(`${API_URL}/gestor/diario-efetivo`, {
        data_diario: dataSelecionada,
        id_obra: Number(obraFiltro),
        equipe: nomeEquipe,
        funcionarios: listaAtualizada.filter(a => eqUp(a.equipe) === eqUp(nomeEquipe))
      });

      // Se veio de outra equipe, atualiza também a equipe de origem
      if (equipeOrigem && eqUp(equipeOrigem) !== eqUp(nomeEquipe)) {
        await axios.post(`${API_URL}/gestor/diario-efetivo`, {
          data_diario: dataSelecionada,
          id_obra: Number(obraFiltro),
          equipe: equipeOrigem,
          funcionarios: listaAtualizada.filter(a => eqUp(a.equipe) === eqUp(equipeOrigem))
        });
      }
      
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
    const membro = alocacoesDoDia.find(a => String(a.id_funcionario) === String(idFuncionario));
    if (!membro) return;

    const listaAtualizada = alocacoesDoDia.filter(a => String(a.id_funcionario) !== String(idFuncionario));
    setAlocacoesDoDia(listaAtualizada);

    try {
      await axios.post(`${API_URL}/gestor/diario-efetivo`, {
        data_diario: dataSelecionada,
        id_obra: Number(obraFiltro),
        equipe: membro.equipe,
        funcionarios: listaAtualizada.filter(a => eqUp(a.equipe) === eqUp(membro.equipe))
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
    const membro = alocacoesDoDia.find(a => String(a.id_funcionario) === String(idFuncionario));
    if (!membro) return;

    const idVeicTratado = idVeiculo ? Number(idVeiculo) : null;

    const listaAtualizada = alocacoesDoDia.map(a => {
      if (String(a.id_funcionario) === String(idFuncionario)) {
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
        funcionarios: listaAtualizada.filter(a => eqUp(a.equipe) === eqUp(membro.equipe))
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

    if (!window.confirm(`Tem certeza que deseja apagar a equipe "${nomeEquipeDeletar}"? Os colaboradores alocados nela voltarão para a lista de disponíveis e o registro da equipe será excluído.`)) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/gestor/equipe`, {
        params: {
          nome_equipe: nomeEquipeDeletar,
          id_obra: Number(obraFiltro),
          data_diario: dataSelecionada
        }
      });

      const listaAtualizada = alocacoesDoDia.filter(
        a => !(eqUp(a.equipe) === eqUp(nomeEquipeDeletar))
      );

      setAlocacoesDoDia(listaAtualizada);
      setEquipesLocais(prev => prev.filter(
        eq => !(eqUp(eq.nome) === eqUp(nomeEquipeDeletar) && String(eq.id_obra) === String(obraFiltro))
      ));

      await carregarAlocacoesDaObra();
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

  // --- CONFIRMAÇÃO E SUBMISSÃO DA TRANSFERÊNCIA ---
  const handleConfirmarTransferencia = async (e) => {
    e.preventDefault();
    const idDestino = remanejamentoDados.id_gestor_destino;
    const gestorDestinoObj = listaGestores.find(g => Number(g.id) === Number(idDestino));

    if (!idDestino || !gestorDestinoObj) {
      alert("Por favor, selecione o Gestor Destino!");
      return;
    }

    try {
      const usuario = usuarioLogado || JSON.parse(localStorage.getItem('usuario') || '{}');

      await axios.post(`${API_URL}/gestor/remanezar-funcionario-vincular`, {
        id_usuario: Number(idDestino),
        id_gestor_destino: Number(idDestino),
        id_funcionario: Number(remanejamentoDados.id_funcionario),
        id_obra: obraFiltro ? Number(obraFiltro) : null,
        data_inicio: dataSelecionada,
        data_fim: null,
        id_usuario_alteracao: usuario?.id || null
      });

      alert(`📢 NOTIFICAÇÃO ENVIADA COM SUCESSO!\n\nColaborador ${remanejamentoDados.nome_funcionario} foi transferido para o Gestor ${gestorDestinoObj.nome}.`);

      setModalAberto(false);
      setRemanejamentoDados({ id_funcionario: null, nome_funcionario: '', id_gestor_destino: '' });

      await carregarAlocacoesDaObra();
      await carregarTodosOsAgendamentosDoDia();
      await carregarFuncionariosDoGestor();
    } catch (err) {
      console.error("Erro ao realizar transferência:", err);
      alert(err.response?.data?.error || err.response?.data?.message || "Erro ao realizar transferência do colaborador.");
    }
  };

  const obterStatusVeiculo = (idVeiculo) => {
    const aloc = todosOsAgendamentosDoDia.find(
      a => Number(a.id_veiculo) === Number(idVeiculo)
    );

    if (aloc) {
      const dadosObra = obrasDisponiveis.find(o => Number(o.id) === Number(aloc.id_obra));
      const nomeObra = dadosObra ? dadosObra.nome_obra : `Obra ID ${aloc.id_obra}`;
      return { texto: `ESCALADO - ${nomeObra} (${aloc.nome})`, corBg: '#e0f2fe', corTxt: '#0369a1' };
    }
    return { texto: 'Disponível', corBg: '#dcfce7', corTxt: '#15803d' };
  };

  // --- FILTRO DE FUNCIONÁRIOS DISPONÍVEIS PARA REMANEJAMENTO ---
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

  // --- CARD DE UM FUNCIONÁRIO NO QUADRO ---
  const renderCardFuncionarioQuadro = ({ func, status }) => {
    const idFunc = func.id_funcionario || func.id;

    return (
      <div 
        key={`disp-${idFunc}`} 
        style={{ 
          padding: '8px', 
          border: '1px solid #e2e8f0', 
          borderRadius: '4px', 
          backgroundColor: status.emOutraObra ? '#f0f9ff' : '#f8fafc', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '6px' 
        }}
      >
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#0f172a' }}>{func.nome || func.name}</div>
          <div style={{ fontSize: '9px', color: '#64748b' }}>{func.cargo} | MAT: {func.matricula || '—'}</div>
          
          <div style={{ marginTop: '4px' }}>
            <span style={{ 
              fontSize: '9px', 
              fontWeight: 'bold', 
              padding: '2px 6px', 
              borderRadius: '3px', 
              backgroundColor: status.corBg, 
              color: status.corTxt,
              display: 'inline-block' 
            }}>
              {status.texto}
            </span>
          </div>
        </div>

        {equipesDaObraAtiva.length > 0 && (
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
            <option value="" disabled>+ Mover para Equipe...</option>
            {equipesDaObraAtiva.map(eq => (
              <option key={`opt-${eq.nome}`} value={eq.nome}>
                {eq.nome} {equipeEstaConcluida(eq.nome) ? '✅ (Concluída)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', boxSizing: 'border-box' }}>
      
      {/* 1. SELEÇÃO PRIMÁRIA DE FILTROS DA ESCALA */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px' }}>
        <div style={{ fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '12px', color: '#0f172a', fontSize: '12px' }}>
          1. Parâmetros da Escala
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          
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
              Nome da Equipe
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
            <Plus style={{ width: '14px', height: '14px' }} /> Criar Equipe
          </button>
        </form>

        <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '12px' }}>
          <button 
            type="button" 
            onClick={handleCriarEquipeFolguista}
            style={{ height: '36px', padding: '0 16px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            title="Cria o painel de Folguistas"
          >
            <Plus style={{ width: '14px', height: '14px' }} /> Criar Equipe de Folga
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
        
        {/* COLUNA ESQUERDA: QUADRO DE FUNCIONÁRIOS (DISPONÍVEIS EM CIMA, A-Z, SEM DUPLICADOS) */}
        <div style={{ backgroundColor: '#fff', border: '2px solid #3b82f6', borderRadius: '6px', padding: '12px', minHeight: '380px' }}>
          <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', fontSize: '11px', color: '#1e40af', textTransform: 'uppercase' }}>
              Quadro de Funcionários: {totalQuadro}
            </span>
          </div>

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
            {totalQuadro === 0 ? (
              <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                {termoBuscaDisponiveis ? 'Nenhum colaborador encontrado com essa busca.' : 'Nenhum colaborador disponível.'}
              </div>
            ) : (
              <>
                {/* DISPONÍVEIS */}
                {quadroDisponiveis.length > 0 && (
                  <>
                    <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#15803d', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '3px', padding: '3px 8px', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 2 }}>
                      Disponíveis ({quadroDisponiveis.length})
                    </div>
                    {quadroDisponiveis.map(renderCardFuncionarioQuadro)}
                  </>
                )}

                {/* INDISPONÍVEIS (OUTRA OBRA / FOLGA) */}
                {quadroIndisponiveis.length > 0 && (
                  <>
                    <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#0369a1', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '3px', padding: '3px 8px', textTransform: 'uppercase', marginTop: quadroDisponiveis.length > 0 ? '4px' : 0, position: 'sticky', top: 0, zIndex: 2 }}>
                      Em outra obra / Folga ({quadroIndisponiveis.length})
                    </div>
                    {quadroIndisponiveis.map(renderCardFuncionarioQuadro)}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: CARDS DE EQUIPES EXCLUSIVAS DA OBRA */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
          {equipesDaObraAtiva.length === 0 ? (
            <div style={{ backgroundColor: '#fff', border: '1px dashed #cbd5e1', borderRadius: '6px', padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '12px', gridColumn: '1/-1' }}>
              Nenhuma equipe cadastrada para esta obra. Crie uma equipe para esta obra acima!
            </div>
          ) : (
            equipesDaObraAtiva.map((eq) => {
              const concluida = equipeEstaConcluida(eq.nome);
              const editando = equipeEditando && eqUp(equipeEditando.nomeAntigo) === eqUp(eq.nome);
              const integrantes = alocacoesDoDia
                .filter(a => eqUp(a.equipe) === eqUp(eq.nome))
                .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));

              return (
                <div 
                  key={`card-eq-${eq.nome}`} 
                  style={{ 
                    backgroundColor: '#fff', 
                    border: concluida ? '2px solid #16a34a' : '1px solid #cbd5e1', 
                    borderRadius: '6px', 
                    overflow: 'hidden', 
                    boxShadow: concluida ? '0 1px 4px rgba(22,163,74,0.25)' : '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                >
                  
                  {concluida && (
                    <div style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                      <CheckCircle2 style={{ width: '12px', height: '12px' }} /> EQUIPE CONCLUÍDA (RDO FINALIZADO)
                    </div>
                  )}

                  <div style={{ backgroundColor: concluida ? '#166534' : '#0f172a', color: '#fff', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {editando ? (
                        <form
                          onSubmit={(e) => { e.preventDefault(); handleConfirmarRenomear(); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <input
                            autoFocus
                            type="text"
                            value={equipeEditando.novoNome}
                            onChange={(e) => setEquipeEditando({ ...equipeEditando, novoNome: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Escape') setEquipeEditando(null); }}
                            style={{ width: '100%', height: '24px', fontSize: '11px', fontWeight: 'bold', padding: '0 6px', border: '1px solid #cbd5e1', borderRadius: '3px', color: '#0f172a', boxSizing: 'border-box', textTransform: 'uppercase' }}
                          />
                          <button
                            type="submit"
                            title="Salvar novo nome"
                            style={{ border: 'none', background: 'rgba(34,197,94,0.25)', color: '#bbf7d0', borderRadius: '4px', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            <Check style={{ width: '13px', height: '13px' }} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEquipeEditando(null)}
                            title="Cancelar"
                            style={{ border: 'none', background: 'rgba(255,255,255,0.15)', color: '#e2e8f0', borderRadius: '4px', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            <X style={{ width: '13px', height: '13px' }} />
                          </button>
                        </form>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq.nome}</div>
                          <button
                            type="button"
                            onClick={() => setEquipeEditando({ nomeAntigo: eq.nome, novoNome: eq.nome })}
                            title="Renomear equipe"
                            style={{ border: 'none', background: 'rgba(255,255,255,0.15)', color: '#e2e8f0', borderRadius: '4px', padding: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            <Pencil style={{ width: '11px', height: '11px' }} />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ backgroundColor: concluida ? '#15803d' : '#334155', padding: '2px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        {integrantes.length} Colaboradores
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDeletarEquipe(eq.nome)}
                        title="Excluir esta equipe"
                        style={{ border: 'none', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', borderRadius: '4px', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        <Trash2 style={{ width: '13px', height: '13px' }} />
                      </button>
                    </div>
                  </div>

                  <div style={{ padding: '8px', minHeight: '120px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: concluida ? '#f0fdf4' : '#fafafa' }}>
                    {integrantes.length === 0 ? (
                      <div style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '16px' }}>
                        Selecione colaboradores na caixa ao lado para alocar nesta equipe.
                      </div>
                    ) : (
                      integrantes.map((membro, index) => {
                        const veiculosOrdenados = [...listaVeiculos].sort((a, b) => 
                          (a.placa || '').localeCompare(b.placa || '')
                        );

                        const termoFiltroVeiculo = (buscaVeiculoFiltro[membro.id_funcionario] || '').toLowerCase().trim();

                        const veiculosDisponiveisOuAtual = veiculosOrdenados.filter(v => {
                          const ocupante = todosOsAgendamentosDoDia.find(
                            a => Number(a.id_veiculo) === Number(v.id)
                          );
                          const ehOVeiculoAtual = Number(membro.id_veiculo) === Number(v.id);
                          const disponivelOuAtual = !ocupante || ehOVeiculoAtual;

                          if (!termoFiltroVeiculo) return disponivelOuAtual;

                          const placaMatch = (v.placa || '').toLowerCase().includes(termoFiltroVeiculo);
                          const marcaMatch = (v.marca || '').toLowerCase().includes(termoFiltroVeiculo);
                          const modeloMatch = (v.modelo || '').toLowerCase().includes(termoFiltroVeiculo);

                          return disponivelOuAtual && (placaMatch || marcaMatch || modeloMatch);
                        });

                        const outrasEquipes = equipesDaObraAtiva.filter(e => eqUp(e.nome) !== eqUp(eq.nome));

                        return (
                          <div 
                            key={`${membro.id_funcionario}-${index}`} 
                            style={{ padding: '8px', backgroundColor: '#fff', border: concluida ? '1px solid #bbf7d0' : '1px solid #e2e8f0', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#0f172a' }}>{membro.nome}</div>
                                <div style={{ fontSize: '8px', color: '#64748b' }}>{membro.cargo}</div>
                              </div>

                              <button 
                                type="button" 
                                onClick={() => handleRemoverDaEquipe(membro.id_funcionario)}
                                title="Remover da equipe (retorna para disponíveis)"
                                style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                              >
                                <X style={{ width: '14px', height: '14px' }} />
                              </button>
                            </div>

                            {/* TROCAR DE EQUIPE */}
                            {outrasEquipes.length > 0 && (
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAlocarParaEquipe(membro.id_funcionario, e.target.value);
                                    e.target.value = "";
                                  }
                                }}
                                style={{ fontSize: '9px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '3px', backgroundColor: '#fff', color: '#1d4ed8', fontWeight: 'bold', cursor: 'pointer' }}
                              >
                                <option value="" disabled>⇄ Trocar de equipe...</option>
                                {outrasEquipes.map(e => (
                                  <option key={`troca-${membro.id_funcionario}-${e.nome}`} value={e.nome}>
                                    {e.nome} {equipeEstaConcluida(e.nome) ? '✅' : ''}
                                  </option>
                                ))}
                              </select>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ position: 'relative', width: '100%' }}>
                                <input
                                  type="text"
                                  placeholder="Pesquisar veículo por placa/modelo..."
                                  value={buscaVeiculoFiltro[membro.id_funcionario] || ''}
                                  onChange={(e) => setBuscaVeiculoFiltro({
                                    ...buscaVeiculoFiltro,
                                    [membro.id_funcionario]: e.target.value
                                  })}
                                  style={{
                                    width: '100%',
                                    height: '24px',
                                    padding: '0 22px 0 6px',
                                    fontSize: '9px',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '3px',
                                    boxSizing: 'border-box',
                                    outline: 'none'
                                  }}
                                />
                                <Search style={{ width: '10px', height: '10px', color: '#94a3b8', position: 'absolute', right: '6px', top: '7px' }} />
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Car style={{ width: '12px', height: '12px', color: '#2563eb' }} />
                                <select
                                  value={membro.id_veiculo || ''}
                                  onChange={(e) => handleAlterarVeiculoFuncionario(membro.id_funcionario, e.target.value)}
                                  style={{ flex: 1, fontSize: '9px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '3px', backgroundColor: '#f8fafc', color: membro.id_veiculo ? '#15803d' : '#64748b', fontWeight: 'bold' }}
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
                  <option value="TODAS">⚠ TODAS AS EQUIPES</option>
                  {[...new Set(alocacoesDoDia.map(a => a.equipe).filter(Boolean))].map(eq => (
                    <option key={eq} value={eq}>{eq.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            )}

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
                  <th style={{ padding: '10px 12px' }}>Equipe Vinculada</th>
                  <th style={{ padding: '10px 12px' }}>Veículo Utilizado</th>
                  <th style={{ padding: '10px 12px' }}>Obs</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const alocsFiltradas = alocacoesDoDia
                    .filter(aloc => {
                      if (filtroEquipeTabela === 'TODAS') return true;
                      return eqUp(aloc.equipe) === eqUp(filtroEquipeTabela);
                    })
                    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));

                  if (alocsFiltradas.length === 0) {
                    return (
                      <tr>
                        <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                          Nenhum colaborador alocado para os critérios selecionados.
                        </td>
                      </tr>
                    );
                  }

                  return alocsFiltradas.map((aloc, index) => {
                    const ehFolguista = String(aloc.equipe).toUpperCase().includes('FOLGUISTA') || 
                                        String(aloc.status_presenca).toUpperCase() === 'FOLGA';
                    const concluida = equipeEstaConcluida(aloc.equipe);
                    const veiculoUtilizado = listaVeiculos.find(v => Number(v.id) === Number(aloc.id_veiculo));

                    return (
                      <tr 
                        key={`aloc-row-${aloc.id_funcionario}-${index}`} 
                        style={{ 
                          borderBottom: '1px solid #e2e8f0', 
                          backgroundColor: ehFolguista ? '#fef2f2' : (concluida ? '#f0fdf4' : (index % 2 === 0 ? '#ffffff' : '#f8fafc')) 
                        }}
                      >
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 'bold', color: ehFolguista ? '#dc2626' : '#0f172a' }}>
                            {aloc.nome}
                          </div>
                          <div style={{ fontSize: '9px', color: '#64748b' }}>MAT: {aloc.matricula || '—'}</div>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#334155' }}>{aloc.cargo || '—'}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 'bold', color: ehFolguista ? '#b91c1c' : (concluida ? '#166534' : '#1e3a8a') }}>
                          {aloc.equipe || 'Geral'} {concluida ? '✅' : ''}
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

      {/* 7. RESUMO DE OCUPAÇÃO DE FUNCIONÁRIOS (COM BOTÃO DE EXPORTAÇÃO PARA O RH) */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: mostrarResumoOcupacao ? '12px' : '0' }}>
          <div style={{ fontWeight: 'bold', textTransform: 'uppercase', color: '#334155', fontSize: '12px' }}>
            Resumo Geral da Ocupação dos Funcionários no Dia
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleDownloadResumoRH}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#16a34a',
                color: '#fff',
                border: 'none',
                padding: '4px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 'bold'
              }}
              title="Baixar planilha formatada para envio ao RH"
            >
              <Download style={{ width: '14px', height: '14px' }} />
              Exportar Resumo (CSV p/ RH)
            </button>

            <button 
              type="button"
              onClick={() => setMostrarResumoOcupacao(!mostrarResumoOcupacao)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#1e293b' }}
            >
              {mostrarResumoOcupacao ? <EyeOff style={{ width: '14px', height: '14px' }} /> : <Eye style={{ width: '14px', height: '14px' }} />}
              {mostrarResumoOcupacao ? 'Ocultar Tabela' : 'Ver Tabela'}
            </button>
          </div>
        </div>

        {mostrarResumoOcupacao && (
          <div style={{ overflowX: 'auto', maxHeight: '350px', marginTop: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#475569', color: '#fff', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{ padding: '10px 12px' }}>Funcionário / Cadastro</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {baseFuncionariosResumo.map((func, index) => {
                  const idFunc = func.id_funcionario || func.id;
                  const status = obterStatusFuncionario(idFunc);
                  return (
                    <tr key={`resumo-${idFunc}`} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{func.nome || func.name}</div>
                        <div style={{ fontSize: '9px', color: '#64748b' }}>{func.cargo} | MAT: {func.matricula || '—'}</div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ backgroundColor: status.corBg, color: status.corTxt, padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                          {status.texto}
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
            Resumo Geral da Ocupação dos Veículos no Dia
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <input
                type="text"
                placeholder="Pesquisar veículo por placa, modelo..."
                value={termoBuscaVeiculos}
                onChange={(e) => setTermoBuscaVeiculos(e.target.value)}
                style={{
                  width: '100%',
                  height: '30px',
                  padding: '0 28px 0 8px',
                  fontSize: '11px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
              <Search style={{ width: '13px', height: '13px', color: '#94a3b8', position: 'absolute', right: '8px', top: '8px' }} />
            </div>

            <div style={{ overflowX: 'auto', maxHeight: '350px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e3a8a', color: '#fff', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 10 }}>
                    <th style={{ padding: '10px 12px' }}>Veículo / Identificação</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {veiculosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan="2" style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                        {termoBuscaVeiculos ? 'Nenhum veículo encontrado com esta placa/modelo.' : 'Nenhum veículo cadastrado sob sua responsabilidade técnica.'}
                      </td>
                    </tr>
                  ) : (
                    veiculosFiltrados.map((veiculo, index) => {
                      const status = obterStatusVeiculo(veiculo.id);

                      return (
                        <tr key={`resumo-veic-${veiculo.id}`} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{veiculo.placa}</div>
                            <div style={{ fontSize: '9px', color: '#64748b' }}>{veiculo.marca} {veiculo.modelo}</div>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span style={{ backgroundColor: status.corBg, color: status.corTxt, padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                              {status.texto}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
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