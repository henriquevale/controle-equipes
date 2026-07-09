import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, AlertCircle, Plus, Trash2, FileText, Package, HardHat, CalendarDays, Car, Wrench, AlertTriangle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Em vez de: const API_URL = 'http://localhost:3001/api';
const API_URL = 'https://controle-equipes.onrender.com/api'; //i

const SERVICOS_PADRONIZADOS = [
  "REMOÇÃO DE TACHA (UN)",
  "IMPLANTAÇÃO DE TACHA (UN)",
  "PINTURA MECÂNICA (M²)",
  "PINTURA MANUAL (M²)",
  "TERMOPLÁSTICO (M²)",
  "PLÁSTICO PARA FRIO (M²)",
  "IMPLATAÇÃO DEFENSA (UN)",
  "IMPLATAÇÃO TAE UN (UN)",
  "IMPLATAÇÃO (M²)"
];

const MATERIAIS_PADRONIZADOS = [
  "TACHA MONODIRECIONAL (UN)",
  "TACHA BIDIRECIONAL (UN)",
  "TACHÃO MONODIRECIONAL (UN)",
  "TACHÃO BIDIRECIONAL (UN)",
  "TINTA DE DEMARCAÇÃO VIÁRIA - BRANCA (GL)",
  "TINTA DE DEMARCAÇÃO VIÁRIA - AMARELA (GL)",
  "MICROESFERA DE VIDRO - PREMIX (KG)",
  "MICROESFERA DE VIDRO - DROP-ON (KG)",
  "SOLVENTE PARA TINTA (L)",
  "PLÁSTICO A FRIO - RESINA (KG)",
  "TERMOPLÁSTICO (KG)",
  "DEFENSA METÁLICA (M)",
  "POSTE PARA DEFENSA (UN)"
];

export default function DiarioObraTecnico({ usuarioLogado }) {
  const [dataDiario, setDataDiario] = useState(new Date().toISOString().split('T')[0]);
  const [idObraSelecionada, setIdObraSelecionada] = useState('');
  const [obraDadosCompletos, setObraDadosCompletos] = useState(null);
  
  const [obrasDoGestor, setObrasDoGestor] = useState([]);
  const [termoBuscaObra, setTermoBuscaObra] = useState('');
  const [obrasFiltradasExcel, setObrasFiltradasExcel] = useState([]);
  const [mostrarGridExcelObra, setMostrarGridExcelObra] = useState(false);

  const [efetivoAgendado, setEfetivoAgendado] = useState([]);
  const [atividadesLancadas, setAtividadesLancadas] = useState([]); 
  const [materiaisLancados, setMateriaisLancados] = useState([]);
  const [equipeSelecionadaFiltro, setEquipeSelecionadaFiltro] = useState('GERAL');
  const [equipeConfirmada, setEquipeConfirmada] = useState(false);
  const [carregando, setLoading] = useState(false);
  const [erroPainel, setErroPainel] = useState('');
  const [statusEnvio, setStatusEnvio] = useState({ texto: '', tipo: '' });
  const [salvoComSucesso, setSalvoComSucesso] = useState(false);
  const [observacoesContratada, setObservacoesContratada] = useState('');
  const [statusDiario, setStatusDiario] = useState('Normal');

  // NOVOS ESTADOS PARA INTEGRAR A TABELA DE VEÍCULOS IDÊNTICA AO SEU OUTRO CÓDIGO
  const [listaVeiculos, setListaVeiculos] = useState([]);
  const [mostrarTabelaVeiculos, setMostrarTabelaVeiculos] = useState(false);

  const ehEquipeFolguista = equipeSelecionadaFiltro === 'FOLGUISTAS';
  const rdoInterrompido = ['Choveu', 'Sem Material', 'Outros'].includes(statusDiario);

  useEffect(() => {
    carregarObrasIniciais();
    carregarVeiculosDoSistema();
  }, []);

  useEffect(() => {
    if (idObraSelecionada && dataDiario) {
      buscarEfetivoVindoDoAgendamento();
      setAtividadesLancadas([{ tipoServico: '', quantidade: '' }]);
      setMateriaisLancados([{ material: '', quantidade: '' }]);
      setSalvoComSucesso(false);
      setStatusDiario('Normal'); 
    } else {
      setEfetivoAgendado([]);
      setAtividadesLancadas([]);
      setMateriaisLancados([]);
      setEquipeConfirmada(false);
    }
  }, [idObraSelecionada, dataDiario]);

  useEffect(() => {
    if (rdoInterrompido) {
      setAtividadesLancadas([]);
      setMateriaisLancados([]);
    } else if (idObraSelecionada && equipeConfirmada && atividadesLancadas.length === 0) {
      setAtividadesLancadas([{ tipoServico: '', quantidade: '' }]);
      setMateriaisLancados([{ material: '', quantidade: '' }]);
    }
  }, [statusDiario]);

  const carregarVeiculosDoSistema = async () => {
    try {
      const res = await axios.get(`${API_URL}/veiculos`);
      setListaVeiculos(res.data || []);
    } catch (e) {
      console.error("Erro ao carregar veículos para o diário técnico:", e);
    }
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
  
  const buscarEfetivoVindoDoAgendamento = async () => {
    setLoading(true);
    setErroPainel('');
    setEfetivoAgendado([]);
    try {
      const user = usuarioLogado || JSON.parse(localStorage.getItem('usuario') || '{}');
      if (!user.id) {
        setErroPainel('Sessão expirada. reconecte-se.');
        return;
      }

      const params = { data_diario: dataDiario, id_obra: idObraSelecionada };
      const res = await axios.get(`${API_URL}/gestor/diario-efetivo`, { params });
      
      if (res.data && res.data.length > 0) {
        const idsVistos = new Set();
        const listaSemDuplicados = [];

        res.data.forEach(item => {
          const isFolguista = String(item.equipe).toUpperCase() === 'FOLGUISTAS';
          const chaveUnica = isFolguista ? String(item.id_funcionario) : `${item.id_funcionario}-${item.turno}`;

          if (!idsVistos.has(chaveUnica)) {
            idsVistos.add(chaveUnica);
            listaSemDuplicados.push({
              id_funcionario: item.id_funcionario,
              name: item.nome,
              cargo: item.cargo,
              matricula: item.matricula,
              statusPresenca: isFolguista ? 'Folga' : 'Presente', 
              statusCustomizado: '',
              turno: isFolguista ? 'DIURNO e NOTURNO' : (item.turno || 'DIURNO'), 
              equipe: item.equipe || 'Geral',
              id_veiculo: item.id_veiculo || ''
            });
          }
        });
        setEfetivoAgendado(listaSemDuplicados);
      } else {
        setEfetivoAgendado([]);
      }
    } catch (err) {
      console.error(err);
      setErroPainel('Erro ao buscar a escala planejada para esta data.');
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

  const handleMudarVeiculoFuncionario = (indexInEfetivo, valor) => {
    const listaNova = [...efetivoAgendado];
    listaNova[indexInEfetivo].id_veiculo = valor;
    setEfetivoAgendado(listaNova);
    setSalvoComSucesso(false);
  };

  const adicionarLinhaAtividade = () => {
    if (rdoInterrompido) return;
    setAtividadesLancadas([...atividadesLancadas, { tipoServico: '', quantidade: '' }]);
    setSalvoComSucesso(false);
  };

  const removerLinhaAtividade = (index) => {
    if (rdoInterrompido) return;
    const listaNova = atividadesLancadas.filter((_, i) => i !== index);
    setAtividadesLancadas(listaNova.length > 0 ? listaNova : [{ tipoServico: '', quantidade: '' }]);
    setSalvoComSucesso(false);
  };

  const handleMudarAtividadeCampo = (index, campo, valor) => {
    const listaNova = [...atividadesLancadas];
    listaNova[index][campo] = valor;
    setAtividadesLancadas(listaNova);
    setSalvoComSucesso(false);
  };

  const adicionarLinhaMaterial = () => {
    if (rdoInterrompido) return;
    setMateriaisLancados([...materiaisLancados, { material: '', quantidade: '' }]);
    setSalvoComSucesso(false);
  };

  const removerLinhaMaterial = (index) => {
    if (rdoInterrompido) return;
    const listaNova = materiaisLancados.filter((_, i) => i !== index);
    setMateriaisLancados(listaNova.length > 0 ? listaNova : [{ material: '', quantidade: '' }]);
    setSalvoComSucesso(false);
  };

  const handleMudarMaterialCampo = (index, campo, valor) => {
    const listaNova = [...materiaisLancados];
    listaNova[index][campo] = valor;
    setMateriaisLancados(listaNova);
    setSalvoComSucesso(false);
  };

  // FUNÇÃO DE RENDERIZAÇÃO DE BADGE DO SEU SEGUNDO CÓDIGO
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

      const idsVistos = new Set();
      const nomesDuplicados = [];
      efetivoFiltradoPorEquipe.forEach(f => {
        if (f.id_funcionario) {
          if (idsVistos.has(f.id_funcionario)) {
            if (!nomesDuplicados.includes(f.name)) {
              nomesDuplicados.push(f.name);
            }
          } else {
            idsVistos.add(f.id_funcionario);
          }
        }
      });
      if (nomesDuplicados.length > 0) {
        setErroPainel(`Não é permitido salvar funcionários repetidos no mesmo diário: ${nomesDuplicados.join(', ')}`);
        setStatusEnvio({ texto: "Falha na validação dos dados.", tipo: "erro" });
        return;
      }

      setStatusEnvio({ texto: "Processando e salvando relatório unificado...", tipo: "processando" });
      const atividadesFiltradas = (ehEquipeFolguista || rdoInterrompido)
        ? []
        : atividadesLancadas
            .filter(act => act.tipoServico && act.tipoServico.trim() !== '')
            .map(act => ({
              tipoServico: act.tipoServico,
              quantidade: parseFloat(act.quantidade) || 0.00
            }));
      const materiaisFiltrados = (ehEquipeFolguista || obraDadosCompletos?.tipo_obra === 'ADMINISTRATIVA' || rdoInterrompido)
        ? []
        : materiaisLancados
            .filter(mat => mat.material && mat.material.trim() !== '')
            .map(mat => ({
              material: mat.material,
              quantidade: parseFloat(mat.quantidade) || 0.00
            }));
      const efetivoMapeado = [];
      efetivoFiltradoPorEquipe.forEach(f => {
        const statusOriginal = f.statusPresenca === 'Outros' ? f.statusCustomizado : f.statusPresenca;
        
        if (f.turno === 'DIURNO e NOTURNO') {
          efetivoMapeado.push({
            id_funcionario: f.id_funcionario || null, 
            nome: f.name, cargo: f.cargo, matricula: f.matricula,
            turno: 'DIURNO', status_presenca: statusOriginal.toUpperCase(), 
            observacao: f.statusPresenca === 'Outros' ? f.statusCustomizado : null, equipe: f.equipe || 'Geral',
            id_veiculo: f.id_veiculo || null
          });
          efetivoMapeado.push({
            id_funcionario: f.id_funcionario || null, 
            nome: f.name, cargo: f.cargo, matricula: f.matricula,
            turno: 'NOTURNO', status_presenca: statusOriginal.toUpperCase(), 
            observacao: f.statusPresenca === 'Outros' ? f.statusCustomizado : null, equipe: f.equipe || 'Geral',
            id_veiculo: f.id_veiculo || null
          });
        } else {
          efetivoMapeado.push({
            id_funcionario: f.id_funcionario || null, 
            nome: f.name, cargo: f.cargo, matricula: f.matricula,
            turno: f.turno || 'DIURNO', status_presenca: statusOriginal.toUpperCase(), 
            observacao: f.statusPresenca === 'Outros' ? f.statusCustomizado : null, equipe: f.equipe || 'Geral',
            id_veiculo: f.id_veiculo || null
          });
        }
      });

      const payload = {
        data_diario: dataDiario,
        id_obra: idObraSelecionada,
        id_gestor: usuarioLogado?.id,
        equipe: equipeSelecionadaFiltro, 
        status: statusDiario, 
        efetivo_confirmado: efetivoMapeado,
        atividades_tachas: atividadesFiltradas, 
        materials_apontados: materiaisFiltrados, 
        observacoes: observacoesContratada
      };
      
      await axios.post(`${API_URL}/gestor/salvar-diario-completo`, payload);
      setStatusEnvio({ texto: `✓ RDO Completo salvo com sucesso com o status: ${statusDiario}`, tipo: "sucesso" });
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

      let currentY = 54;

      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text(`1. Efetivo e Presença (Equipe: ${equipeSelecionadaFiltro})`, 10, currentY);
      const colunasEfetivo = ["Colaborador / Nome", "Função", "Turno", "Status de Presença", "Veículo"];
      const linhasEfetivo = (efetivoAgendado || [])
        .filter(f => String(f.equipe || 'Geral').toUpperCase() === equipeSelecionadaFiltro.toUpperCase())
        .map(f => [
          String(f?.name || '---'), 
          String(f?.cargo || '---'), 
          String(f?.turno || 'DIURNO'), 
          f?.statusPresenca === 'Outros' ? String(f?.statusCustomizado || 'Outros') : String(f?.statusPresenca).toUpperCase(),
          String(f?.id_veiculo || 'Nenhum')
        ]);
      autoTable(doc, {
        startY: currentY + 2,
        head: [colunasEfetivo],
        body: linhasEfetivo,
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
          .filter(mat => mat.material !== '')
          .map((mat, index) => [String(index + 1), String(mat.material), mat.quantidade || '0.00']);
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

  const listaDeEquipesDisponiveis = Array.from(
    new Set(efetivoAgendado.map(f => String(f.equipe || 'Geral').toUpperCase()))
  );

  useEffect(() => {
    if (listaDeEquipesDisponiveis.length > 0 && !listaDeEquipesDisponiveis.includes(equipeSelecionadaFiltro) && !equipeConfirmada) {
      setEquipeSelecionadaFiltro(listaDeEquipesDisponiveis[0]);
    } else if (listaDeEquipesDisponiveis.length === 0 && !equipeConfirmada) {
      setEquipeSelecionadaFiltro('GERAL');
    }
  }, [efetivoAgendado]);

  const funcionariosDaEquipe = efetivoAgendado.filter(f => String(f.equipe || 'Geral').toUpperCase() === equipeSelecionadaFiltro);
  const totalPresentes = funcionariosDaEquipe.filter(f => f.statusPresenca === 'Presente' || f.statusPresenca === 'Integração').length;
  const totalFolgas = funcionariosDaEquipe.filter(f => f.statusPresenca === 'Folga').length;
  const totalFaltas = funcionariosDaEquipe.filter(f => f.statusPresenca === 'Faltou').length;

  // FILTRA VEÍCULOS ADAPTADOS A SUA NOVA ESTRUTURA DE FILTRO
  const veiculosDoQuadroAtivo = listaVeiculos.filter(v => 
    v.id_funcionario && funcionariosDaEquipe.some(f => Number(f.id_funcionario) === Number(v.id_funcionario))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', fontFamily: 'sans-serif', fontSize: '12px' }}>
      
      {erroPainel && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', color: '#991b1b', fontWeight: 'bold' }}>
          <AlertCircle style={{ width: '16px', height: '16px', marginRight: '8px' }} />
          <span>{erroPainel}</span>
        </div>
      )}

      {/* BLOCO 1: ESCOPO DE SELEÇÃO */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
        <div style={{ padding: '8px 12px', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '11px', borderBottom: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#475569' }}>
          <span>CONTEXT: RDO_INTEGRADO_PRODUCAO_E_MATERIAIS;</span>
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
                setStatusDiario('Normal');
              }} 
              style={{ height: '32px', padding: '0 12px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Mudar Obra
            </button>
          )}
        </div>

        {idObraSelecionada && (
          <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
            <div style={{ flex: '1', maxWidth: '400px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', marginBottom: '4px', color: '#475569' }}>
                IDENTIFICAÇÃO DA EQUIPE DE TRABALHO
              </label>
              <select
                disabled={equipeConfirmada}
                value={equipeSelecionadaFiltro}
                onChange={e => setEquipeSelecionadaFiltro(e.target.value.toUpperCase())}
                style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: equipeConfirmada ? '#e2e8f0' : '#fff', fontWeight: 'bold', color: '#334155' }}
              >
                <option value="GERAL">-- SELECIONE UMA EQUIPE DISPONÍVEL --</option>
                {listaDeEquipesDisponiveis.map(eq => (
                  <option key={eq} value={eq}>{eq}</option>
                ))}
              </select>
            </div>
            
            {!equipeConfirmada ? (
              <button
                type="button"
                disabled={equipeSelecionadaFiltro === 'GERAL'}
                onClick={() => setEquipeConfirmada(true)}
                style={{ height: '32px', padding: '0 16px', backgroundColor: equipeSelecionadaFiltro === 'GERAL' ? '#cbd5e1' : '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: equipeSelecionadaFiltro === 'GERAL' ? 'not-allowed' : 'pointer' }}
              >
                Confirmar Equipe
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEquipeConfirmada(false);
                  setAtividadesLancadas([{ tipoServico: '', quantity: '' }]);
                  setMateriaisLancados([{ material: '', quantity: '' }]);
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

      {statusEnvio.texto && (
        <div style={{ 
          padding: '10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', 
          backgroundColor: statusEnvio.tipo === 'sucesso' ? '#bbf7d0' : statusEnvio.tipo === 'erro' ? '#fecaca' : '#eff6ff', 
          color: statusEnvio.tipo === 'sucesso' ? '#166534' : statusEnvio.tipo === 'erro' ? '#991b1b' : '#1e40af' 
        }}>
          {statusEnvio.texto}
        </div>
      )}

      {/* BLOCOS INFERIORES ATIVOS APÓS CONFIRMAÇÃO */}
      {idObraSelecionada && equipeConfirmada && (
        <>
          {/* SEÇÃO STATUS OPERACIONAL */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px' }}>
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
              <option value="Outros">Obra Interrompida por Outros Motivos</option>
            </select>
          </div>

          {/* NOVA SEÇÃO DE STATUS DE VEÍCULOS VINCULADOS IDÊNTICA AO SEU SEGUNDO CÓDIGO */}
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
                          Nenhum veículo da frota está atualmente vinculado a seus colaboradores nesta equipe.
                        </td>
                      </tr>
                    ) : (
                      veiculosDoQuadroAtivo.map((veiculo, index) => {
                        const motorista = funcionariosDaEquipe.find(f => Number(f.id_funcionario) === Number(veiculo.id_funcionario));
                        return (
                          <tr key={`veic-${veiculo.id}`} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#0f172a' }}>{veiculo.placa}</td>
                            <td style={{ padding: '10px 12px', color: '#334155' }}>{veiculo.marca} {veiculo.modelo} ({veiculo.ano})</td>
                            <td style={{ padding: '10px 12px', color: '#64748b' }}>{veiculo.tipo}</td>
                            <td style={{ padding: '10px 12px', fontWeight: '500', color: '#1e293b' }}>
                              {motorista ? `${motorista.name} (${motorista.cargo})` : `ID Funcionário: #${veiculo.id_funcionario}`}
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

          {/* SEÇÃO 1: EFETIVO (CARDS) */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', color: '#1e293b' }}>
              EFETIVO ATIVO - EQUIPE: <span style={{ color: '#2563eb' }}>{equipeSelecionadaFiltro}</span> {carregando && '(Carregando...)'}
              
              {funcionariosDaEquipe.length > 0 && (
                <div style={{ display: 'inline-flex', gap: '8px', marginLeft: '15px', fontSize: '11px', fontWeight: 'normal', verticalAlign: 'middle' }}>
                  <span style={{ backgroundColor: '#e2fbe8', color: '#15803d', padding: '2px 6px', borderRadius: '3px' }}>Pres: <strong>{totalPresentes}</strong></span>
                  <span style={{ backgroundColor: '#fffbeb', color: '#b45309', padding: '2px 6px', borderRadius: '3px' }}>Folg: <strong>{totalFolgas}</strong></span>
                  <span style={{ backgroundColor: '#fef2f2', color: '#b91c1c', padding: '2px 6px', borderRadius: '3px' }}>Falt: <strong>{totalFaltas}</strong></span>
                </div>
              )}
            </div>

            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {funcionariosDaEquipe.length === 0 ? (
                <div style={{ padding: '16px', color: '#b45309', backgroundColor: '#fffbeb', border: '1px dashed #fcd34d', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold' }}>
                  Nenhum funcionário agendado para a equipe "{equipeSelecionadaFiltro}".
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                  {efetivoAgendado
                    .filter(f => String(f.equipe || 'Geral').toUpperCase() === equipeSelecionadaFiltro)
                    .map((func, index) => {
                      const indexGlobal = efetivoAgendado.findIndex(original => original.id_funcionario === func.id_funcionario && original.turno === func.turno);
                      return (
                        <div key={`${func.id_funcionario}-${func.turno}-${index}`} style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '8px', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '2px', textTransform: 'uppercase' }}>{func.name}</div>
                            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px' }}>{func.cargo} | <span style={{ fontWeight: 'bold' }}>{func.turno}</span></div>
                            
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                              <select 
                                value={func.statusPresenca} 
                                onChange={e => handleMudarStatusPresenca(indexGlobal, e.target.value)}
                                style={{ flex: 1, height: '26px', padding: '0 4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }}
                              >
                                <option value="Presente">Presente</option>
                                <option value="Folga">Folga</option>
                                <option value="Faltou">Faltou</option>
                                <option value="Integração">Integração</option>
                                <option value="Outros">Outros</option>
                              </select>

                              <input 
                                type="text" 
                                placeholder="Placa / Prefixo" 
                                value={func.id_veiculo || ''} 
                                onChange={e => handleMudarVeiculoFuncionario(indexGlobal, e.target.value)}
                                style={{ width: '100px', height: '24px', padding: '0 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }}
                              />
                            </div>

                            {func.statusPresenca === 'Outros' && (
                              <input 
                                type="text" 
                                placeholder="Motivo..." 
                                value={func.statusCustomizado || ''} 
                                onChange={e => handleMudarTextoCustomizado(indexGlobal, e.target.value)}
                                style={{ width: '100%', height: '24px', padding: '0 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
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
                      <select value={act.tipoServico} onChange={e => handleMudarAtividadeCampo(index, 'tipoServico', e.target.value)} style={{ flex: 1, height: '30px', padding: '0 6px', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                        <option value="">-- SELECIONE O SERVIÇO --</option>
                        {SERVICOS_PADRONIZADOS.map(s => <option key={s} value={s}>{s}</option>)}
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
                      <select value={mat.material} onChange={e => handleMudarMaterialCampo(index, 'material', e.target.value)} style={{ flex: 1, height: '30px', padding: '0 6px', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                        <option value="">-- SELECIONE O MATERIAL --</option>
                        {MATERIAIS_PADRONIZADOS.map(m => <option key={m} value={m}>{m}</option>)}
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
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="button" onClick={exportarParaPDF} style={{ height: '36px', padding: '0 16px', backgroundColor: '#475569', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={16} /> Exportar PDF
            </button>
            <button type="button" onClick={salvarDiarioCompleto} style={{ height: '36px', padding: '0 20px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Save size={16} /> Salvar RDO no Banco
            </button>
          </div>
        </>
      )}
    </div>
  );
}