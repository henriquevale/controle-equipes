import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  BarChart3,
  Users,
  Filter,
  Briefcase,
  Calendar,
  Award,
  MapPin,
  ChevronDown,
  ChevronUp,
  Download,
  PackageCheck,
  TrendingUp,
  Truck,
  ShoppingCart,
  CheckSquare,
  Layers,
  FileText
} from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export default function DashboardObra({ obrasDisponiveis = [], usuarioLogado, API_URL }) {
  const baseUrl = API_URL || 'http://localhost:3001/api';
  //const baseUrl = API_URL ||'https://api-controle-impacto.duckdns.org/api';
  const listaObras = useMemo(() => (Array.isArray(obrasDisponiveis) ? obrasDisponiveis : []), [obrasDisponiveis]);

  // --- CONTROLE DE ABAS PRINCIPAIS ---
  const [abaPrincipal, setAbaPrincipal] = useState('obra'); // 'obra' | 'encarregados'
  const [mostrarFiltros, setMostrarFiltros] = useState(true);

  // --- ESTADOS: FILTROS / SELEÇÕES DE OBRAS E DATAS ---
  const [obrasSelecionadas, setObrasSelecionadas] = useState([]);
  const [todasObrasMarcadas, setTodasObrasMarcadas] = useState(true);
  const [dropdownObraAberto, setDropdownObraAberto] = useState(false);

  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [loading, setLoading] = useState(false);

  // Seções mantidas 100% da Obra
  const [planejamentoData, setPlanejamentoData] = useState([]);
  const [atividadesData, setAtividadesData] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [presenca, setPresenca] = useState({});
  const [rdosData, setRdosData] = useState({});
  const [veiculosData, setVeiculosData] = useState({ detalhes: [], resumoStatus: {}, totalVeiculosUtilizados: 0 });
  const [faturamento, setFaturamento] = useState([]);
  const [comprasMateriais, setComprasMateriais] = useState([]);
  const [comprasFornecedores, setComprasFornecedores] = useState([]);
  const [abaCompras, setAbaCompras] = useState('materiais');

  // --- ESTADOS: DASHBOARD ENCARREGADOS ---
  const [encarregadosLista, setEncarregadosLista] = useState([]);
  const [encarregadoId, setEncarregadoId] = useState('TODOS');
  const [obrasEncSelecionadas, setObrasEncSelecionadas] = useState([]);
  const [todasObrasEncMarcadas, setTodasObrasEncMarcadas] = useState(true);
  const [dataInicioEnc, setDataInicioEnc] = useState('');
  const [dataFimEnc, setDataFimEnc] = useState('');
  const [topRankEnc, setTopRankEnc] = useState(true);
  const [loadingEnc, setLoadingEnc] = useState(false);

  const [dadosEncarregado, setDadosEncarregado] = useState({
    resumo: { total_obras: 0, total_dias_campo: 0, total_presencas: 0 },
    obrasAtuadas: [],
    producao: []
  });

  // Carrega lista de encarregados
  useEffect(() => {
    const buscarEncarregados = async () => {
      try {
        const res = await axios.get(`${baseUrl}/relatorios/encarregados-lista`);
        setEncarregadosLista(res.data || []);
      } catch (err) {
        console.error("Erro ao carregar lista de encarregados:", err);
      }
    };
    buscarEncarregados();
  }, [baseUrl]);

  // Auxiliar para gerar parâmetro de obras (se 'TODAS' ou array concatenado por vírgula)
  const getObraParam = (todasMarcadas, selecaoArray) => {
    if (todasMarcadas || selecaoArray.length === 0) return 'TODAS';
    return selecaoArray.join(',');
  };

  // --- BUSCAR DADOS COMPLETO DA OBRA ---
  const handleBuscarDados = async () => {
    setLoading(true);

    try {
      const usuarioId = usuarioLogado?.id || usuarioLogado?.usuario_id;
      const usuarioCargo = usuarioLogado?.cargo;
      const obraParam = getObraParam(todasObrasMarcadas, obrasSelecionadas);

      const paramsGerais = {
        obra_id: obraParam,
        data_inicio: dataInicio,
        data_fim: dataFim
      };

      const [
        resPlanejamento,
        resAtividades,
        resMateriais,
        resPresenca,
        resRdos,
        resVeiculos,
        resFaturamento,
        resCompMat,
        resCompForn
      ] = await Promise.all([
        axios.get(`${baseUrl}/relatorios/planejado-vs-executado`, { params: paramsGerais }).catch(() => ({ data: [] })),
        axios.get(`${baseUrl}/relatorios/atividades-executadas`, { params: paramsGerais }).catch(() => ({ data: [] })),
        axios.get(`${baseUrl}/relatorios/materiais-consumidos`, { params: paramsGerais }).catch(() => ({ data: [] })),
        axios.get(`${baseUrl}/relatorios/presenca-detalhada`, { params: paramsGerais }).catch(() => ({ data: {} })),
        axios.get(`${baseUrl}/relatorios/rdos-resumo`, { params: paramsGerais }).catch(() => ({ data: {} })),
        axios.get(`${baseUrl}/relatorios/veiculos-utilizados`, {
          params: { ...paramsGerais, id_obra: obraParam, id: usuarioId, cargo: usuarioCargo }
        }).catch(() => ({
          data: { detalhes: [], resumoStatus: { 'EM USO': 0, 'DISPONÍVEL': 0, 'EM MANUTENÇÃO': 0 }, totalVeiculosUtilizados: 0 }
        })),
        axios.get(`${baseUrl}/relatorios/faturamento-direto`, {
          params: { ...paramsGerais, usuario_id: usuarioId, cargo: usuarioCargo }
        }).catch(() => ({ data: [] })),
        axios.get(`${baseUrl}/relatorios/compras-por-material`, { params: paramsGerais }).catch(() => ({ data: [] })),
        axios.get(`${baseUrl}/relatorios/compras-por-fornecedor`, { params: paramsGerais }).catch(() => ({ data: [] }))
      ]);

      setPlanejamentoData(Array.isArray(resPlanejamento.data) ? resPlanejamento.data : []);
      setAtividadesData(Array.isArray(resAtividades.data) ? resAtividades.data : []);
      setMateriais(Array.isArray(resMateriais.data) ? resMateriais.data : []);
      setPresenca(resPresenca.data || {});
      setRdosData(resRdos.data || {});
      setVeiculosData(resVeiculos.data?.detalhes ? resVeiculos.data : {
        detalhes: [],
        resumoStatus: { 'EM USO': 0, 'DISPONÍVEL': 0, 'EM MANUTENÇÃO': 0 },
        totalVeiculosUtilizados: 0
      });
      setFaturamento(Array.isArray(resFaturamento.data) ? resFaturamento.data : []);
      setComprasMateriais(Array.isArray(resCompMat.data) ? resCompMat.data : []);
      setComprasFornecedores(Array.isArray(resCompForn.data) ? resCompForn.data : []);

    } catch (error) {
      console.error("Erro ao carregar os dados do dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- BUSCAR DADOS DE ENCARREGADOS ---
  const handleBuscarDadosEncarregados = async () => {
    setLoadingEnc(true);
    try {
      const obraParam = getObraParam(todasObrasEncMarcadas, obrasEncSelecionadas);
      const res = await axios.get(`${baseUrl}/relatorios/dashboard-encarregado`, {
        params: {
          id_encarregado: encarregadoId,
          obra_id: obraParam,
          data_inicio: dataInicioEnc,
          data_fim: dataFimEnc
        }
      });
      setDadosEncarregado(res.data || { resumo: {}, obrasAtuadas: [], producao: [] });
    } catch (err) {
      console.error("Erro ao carregar dashboard de encarregados:", err);
    } finally {
      setLoadingEnc(false);
    }
  };

  useEffect(() => {
    if (abaPrincipal === 'encarregados') {
      handleBuscarDadosEncarregados();
    }
  }, [abaPrincipal]);

  // Totais
  const totalFaturamento = useMemo(() => faturamento.reduce((acc, item) => acc + (Number(item.valor_total || item.valor || 0)), 0), [faturamento]);
  const totalVolumeMateriais = useMemo(() => materiais.reduce((acc, item) => acc + (Number(item.quantidade) || 0), 0), [materiais]);
  const totalVolumeAtividades = useMemo(() => atividadesData.reduce((acc, item) => acc + (Number(item.quantidade) || 0), 0), [atividadesData]);
  const totalGastoCompras = useMemo(() => comprasFornecedores.reduce((acc, item) => acc + parseFloat(item.valor_total_gasto || 0), 0), [comprasFornecedores]);
  const totalPedidosCompras = useMemo(() => comprasFornecedores.reduce((acc, item) => acc + parseInt(item.total_pedidos || 0), 0), [comprasFornecedores]);

  // Agrupamento de frota
  const agruparVeiculos = (detalhes = []) => {
    const mapa = {};
    detalhes.forEach(item => {
      const chave = item.placa || `VEICULO_${item.id_veiculo}` || 'SEM_PLACA';
      if (!mapa[chave]) {
        mapa[chave] = {
          placa: item.placa || 'Sem Placa',
          veiculo: `${item.marca || ''} ${item.modelo || ''}`.trim() || 'Não informado',
          total_apontamentos: 0,
          em_uso: 0,
          disponivel: 0,
          manutencao: 0,
          condutores: new Set()
        };
      }
      mapa[chave].total_apontamentos += 1;
      const st = (item.status_veiculo || '').toUpperCase();
      if (st === 'EM USO') mapa[chave].em_uso += 1;
      else if (st === 'DISPONÍVEL') mapa[chave].disponivel += 1;
      else if (st === 'EM MANUTENÇÃO') mapa[chave].manutencao += 1;

      if (item.nome_condutor || item.nome_funcionario) {
        mapa[chave].condutores.add(item.nome_condutor || item.nome_funcionario);
      }
    });
    return Object.values(mapa);
  };

  const listaVeiculosAgrupada = agruparVeiculos(veiculosData.detalhes);

  const tabButtonStyle = (ativa) => ({
    padding: '8px 16px',
    fontWeight: 'bold',
    fontSize: '12px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    borderBottom: ativa ? '3px solid #0284c7' : '3px solid transparent',
    color: ativa ? '#0284c7' : '#64748b'
  });

  const calcularCapacidadeUso = (m) => {
    const qtdComprada = Number(m.quantidade_total_comprada) || 0;
    const unEstoque = m.unidade_medida || m.unidade_estoque || 'UN';
    const unConsumo = m.unidade_consumo || 'UN';
    const unAplicada = m.unidade_aplicada || 'M2';

    const fatorConsumo = Number(m.fator_conversao_consumo) || 1;
    const consBase = Number(m.consumo_base) || 0;
    const qtdAplicada = Number(m.quantidade_aplicada) || 0;

    const temConversaoEmbalagem = Boolean(fatorConsumo > 1 || m.tem_conversao);
    const temRendimentoArea = Boolean(consBase > 0 && qtdAplicada > 0 && m.tem_rendimento);

    if (temRendimentoArea) {
      const saldoEmUnidadeConsumo = temConversaoEmbalagem ? (qtdComprada * fatorConsumo) : qtdComprada;
      const rendimentoCalculado = (saldoEmUnidadeConsumo / consBase) * qtdAplicada;
      return `${rendimentoCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${unAplicada}`;
    } else if (temConversaoEmbalagem) {
      const totalUnidades = qtdComprada * fatorConsumo;
      return `${totalUnidades.toLocaleString('pt-BR')} ${unConsumo}`;
    } else {
      return `1 ${unEstoque} = 1 ${unConsumo}`;
    }
  };

  // Atividades filtradas por pesquisa
  const atividadesFiltradas = useMemo(() => {
    return atividadesData.filter(item =>
      String(item.atividade || '').toLowerCase().includes(termoPesquisa.toLowerCase())
    );
  }, [atividadesData, termoPesquisa]);

  // Produção do Encarregado
  const producaoEncarregadoExibicao = useMemo(() => {
    const sorted = [...dadosEncarregado.producao].sort((a, b) => Number(b.quantidade_total || 0) - Number(a.quantidade_total || 0));
    return topRankEnc ? sorted.slice(0, 10) : sorted;
  }, [dadosEncarregado.producao, topRankEnc]);

  // Funções para controle do Select de Checkbox Customizado (Obra)
  const handleToggleObra = (id) => {
    if (todasObrasMarcadas) {
      setTodasObrasMarcadas(false);
      setObrasSelecionadas([id]);
    } else {
      if (obrasSelecionadas.includes(id)) {
        const filtrados = obrasSelecionadas.filter(o => o !== id);
        if (filtrados.length === 0) {
          setTodasObrasMarcadas(true);
        } else {
          setObrasSelecionadas(filtrados);
        }
      } else {
        setObrasSelecionadas([...obrasSelecionadas, id]);
      }
    }
  };

  const handleToggleTodasObras = () => {
    setTodasObrasMarcadas(true);
    setObrasSelecionadas([]);
  };

  // Rótulo dinâmico do dropdown
  const rotuloObra = useMemo(() => {
    if (todasObrasMarcadas || obrasSelecionadas.length === 0) return 'Todos';
    if (obrasSelecionadas.length === 1) {
      const achada = listaObras.find(o => String(o.id || o.id_obra) === String(obrasSelecionadas[0]));
      return achada ? (achada.nome || achada.nome_obra) : '1 Obra Selecionada';
    }
    return `${obrasSelecionadas.length} Obras Selecionadas`;
  }, [todasObrasMarcadas, obrasSelecionadas, listaObras]);

  return (
    <div style={{ padding: '16px', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        @page landscape-page { size: A4 landscape; margin: 10mm; }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body, html { background-color: #fff !important; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .dashboard-card { border: 1px solid #cbd5e1 !important; box-shadow: none !important; page-break-inside: avoid !important; margin-bottom: 12px !important; padding: 8px !important; }
          .page-landscape { page: landscape-page; page-break-before: always; }
          .chart-container { height: 200px !important; width: 100% !important; }
          table { font-size: 9px !important; width: 100% !important; }
          th, td { padding: 3px 5px !important; }
        }
        .print-only { display: none; }
        .filter-label { font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 4px; display: block; letter-spacing: 0.025em; }
        .filter-input { width: 100%; height: 36px; padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 12px; background-color: #fff; box-sizing: border-box; transition: border-color 0.15s ease; color: #1e293b; }
        .filter-input:focus { outline: none; border-color: #10b981; }
      `}</style>

      {/* ======================================================== */}
      {/* CABEÇALHO E NAV DE ABAS                                   */}
      {/* ======================================================== */}
      <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderBottom: '2px solid #e2e8f0', marginBottom: '16px', backgroundColor: '#ffffff', padding: '12px 16px 0px 16px', borderRadius: '8px 8px 0 0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-end' }}>
          <button
            onClick={() => setAbaPrincipal('obra')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: '6px 6px 0 0',
              backgroundColor: abaPrincipal === 'obra' ? '#ffffff' : 'transparent',
              color: abaPrincipal === 'obra' ? '#10b981' : '#64748b',
              borderBottom: abaPrincipal === 'obra' ? '3px solid #10b981' : '3px solid transparent',
              cursor: 'pointer'
            }}
          >
            <BarChart3 size={18} color={abaPrincipal === 'obra' ? '#10b981' : '#64748b'} />
            <span>Dashboard Obra</span>
          </button>

          <button
            onClick={() => setAbaPrincipal('encarregados')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: '6px 6px 0 0',
              backgroundColor: abaPrincipal === 'encarregados' ? '#ffffff' : 'transparent',
              color: abaPrincipal === 'encarregados' ? '#10b981' : '#64748b',
              borderBottom: abaPrincipal === 'encarregados' ? '3px solid #10b981' : '3px solid transparent',
              cursor: 'pointer'
            }}
          >
            <Users size={18} color={abaPrincipal === 'encarregados' ? '#10b981' : '#64748b'} />
            <span>Encarregados & Funcionários</span>
          </button>
        </div>

        <div style={{ paddingBottom: '8px', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: '#ffffff', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            <Download size={14} />
            <span>CSV / Exportar</span>
          </button>
          <button
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Baixar PDF / Imprimir
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* PAINEL DE FILTROS (APENAS OBRA E DATAS)                   */}
      {/* ======================================================== */}
      <div className="no-print" style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px', overflow: 'visible', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div 
          onClick={() => setMostrarFiltros(!mostrarFiltros)}
          style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none', backgroundColor: '#ffffff', borderRadius: '8px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Filter size={16} color="#10b981" />
            <span>Filtros</span>
          </div>
          {mostrarFiltros ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
        </div>

        {mostrarFiltros && (
          <div style={{ padding: '16px', borderTop: '1px solid #f1f5f9', backgroundColor: '#ffffff', borderRadius: '0 0 8px 8px' }}>
            
            {abaPrincipal === 'obra' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
                
                {/* OBRA (DROPDOWN DE CHECKBOXES) */}
                <div style={{ position: 'relative' }}>
                  <label className="filter-label">Obra</label>
                  <div 
                    onClick={() => setDropdownObraAberto(!dropdownObraAberto)}
                    className="filter-input"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rotuloObra}</span>
                    <ChevronDown size={14} color="#64748b" />
                  </div>

                  {dropdownObraAberto && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', marginTop: '4px', maxHeight: '220px', overflowY: 'auto', padding: '6px 0' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontWeight: 'bold', color: '#10b981' }}>
                        <input type="checkbox" checked={todasObrasMarcadas} onChange={handleToggleTodasObras} />
                        Todos
                      </label>
                      {listaObras.map(obra => {
                        const idStr = String(obra.id || obra.id_obra);
                        const checado = !todasObrasMarcadas && obrasSelecionadas.includes(idStr);
                        return (
                          <label key={idStr} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '11px', cursor: 'pointer', color: '#334155' }}>
                            <input type="checkbox" checked={checado} onChange={() => handleToggleObra(idStr)} />
                            {obra.nome || obra.nome_obra}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* DATA INICIAL */}
                <div>
                  <label className="filter-label">Data Inicial</label>
                  <input type="date" className="filter-input" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                </div>

                {/* DATA FINAL */}
                <div>
                  <label className="filter-label">Data Final</label>
                  <input type="date" className="filter-input" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                </div>

                {/* BOTÃO APLICAR */}
                <div>
                  <button onClick={handleBuscarDados} style={{ width: '100%', height: '36px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                    {loading ? 'Filtrando...' : 'Aplicar Filtro'}
                  </button>
                </div>

              </div>
            ) : (
              /* ABA ENCARREGADOS FILTROS */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
                <div>
                  <label className="filter-label">Encarregado / Líder</label>
                  <select className="filter-input" value={encarregadoId} onChange={(e) => setEncarregadoId(e.target.value)}>
                    <option value="TODOS">-- Todos os Encarregados --</option>
                    {encarregadosLista.map((enc) => (
                      <option key={enc.id} value={enc.id}>{enc.nome} ({enc.cargo || 'Encarregado'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="filter-label">Data Inicial</label>
                  <input type="date" className="filter-input" value={dataInicioEnc} onChange={(e) => setDataInicioEnc(e.target.value)} />
                </div>

                <div>
                  <label className="filter-label">Data Final</label>
                  <input type="date" className="filter-input" value={dataFimEnc} onChange={(e) => setDataFimEnc(e.target.value)} />
                </div>

                <div>
                  <button onClick={handleBuscarDadosEncarregados} style={{ width: '100%', height: '36px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                    {loadingEnc ? 'Filtrando...' : 'Aplicar Filtro'}
                  </button>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* ABA 1: DASHBOARD COMPLETO DA OBRA                         */}
      {/* ======================================================== */}
      {abaPrincipal === 'obra' && (
        <>
          {/* CARDS INDICADORES SUPERIORES */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
              <div style={{ padding: '10px', backgroundColor: '#d1fae5', borderRadius: '8px' }}>
                <FileText size={22} color="#059669" />
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>RDOs no Período</span>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>{presenca.totalRdos || 83}</div>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
              <div style={{ padding: '10px', backgroundColor: '#e0e7ff', borderRadius: '8px' }}>
                <Calendar size={22} color="#4f46e5" />
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Dias com Registro</span>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>21</div>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
              <div style={{ padding: '10px', backgroundColor: '#ffedd5', borderRadius: '8px' }}>
                <Users size={22} color="#ea580c" />
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Efetivo Médio / RDO</span>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#ea580c', marginTop: '2px' }}>15 <span style={{ fontSize: '12px', fontWeight: 'normal' }}>pessoas</span></div>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
              <div style={{ padding: '10px', backgroundColor: '#e0f2fe', borderRadius: '8px' }}>
                <Layers size={22} color="#0284c7" />
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Atividades Distintas</span>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>12</div>
              </div>
            </div>
          </div>

          {/* DEMAIS CARDS MANTIDOS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div style={{ backgroundColor: '#fff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Volume Produzido</span>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981', marginTop: '2px' }}>
                  {totalVolumeAtividades.toLocaleString('pt-BR')}
                </div>
              </div>
              <TrendingUp size={24} color="#10b981" />
            </div>

            <div style={{ backgroundColor: '#fff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Consumo Materiais</span>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ea580c', marginTop: '2px' }}>
                  {totalVolumeMateriais.toLocaleString('pt-BR')}
                </div>
              </div>
              <PackageCheck size={24} color="#ea580c" />
            </div>

            <div style={{ backgroundColor: '#fff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Total em Compras</span>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2563eb', marginTop: '2px' }}>
                  R$ {totalGastoCompras.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <ShoppingCart size={24} color="#2563eb" />
            </div>

            <div style={{ backgroundColor: '#fff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Faturamento Direto</span>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#7c3aed', marginTop: '2px' }}>
                  R$ {totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <Truck size={24} color="#7c3aed" />
            </div>
          </div>

          {/* SEÇÃO VISUAL PRINCIPAL: RANKING E EVOLUÇÃO DA PRODUÇÃO */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            
            {/* 1. RANKING DE PRODUÇÃO */}
            <div className="dashboard-card" style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '13px', margin: 0, color: '#0f172a', fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={16} color="#10b981" />
                  <span>Ranking de Produção</span>
                </h3>
              </div>

              <div className="chart-container" style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={atividadesFiltradas.length > 0 ? atividadesFiltradas : [
                      { atividade: 'TERMOPLÁSTICO (M²)', quantidade: 8500 },
                      { atividade: 'REMOÇÃO PLACA SOLO (UN)', quantidade: 6200 },
                      { atividade: 'PINTURA MANUAL (M²)', quantidade: 4100 },
                      { atividade: 'INSTALAÇÃO DE DEFY (UN)', quantidade: 2800 }
                    ]}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="atividade" type="category" width={150} tick={{ fontSize: 10, fill: '#475569' }} />
                    <Tooltip />
                    <Bar dataKey="quantidade" name="Quantidade" fill="#10b981" radius={[0, 4, 4, 0]} barSize={18} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. EVOLUÇÃO DA PRODUÇÃO */}
            <div className="dashboard-card" style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '6px' }}>
                <h3 style={{ fontSize: '13px', margin: 0, color: '#0f172a', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  Evolução da Produção
                </h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}>
                    <option>Líder: TERMOPLÁSTICO (M²)</option>
                  </select>
                  <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '4px', padding: '2px' }}>
                    <button style={{ border: 'none', padding: '3px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#fff', color: '#0f172a', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', cursor: 'pointer' }}>Diária</button>
                    <button style={{ border: 'none', padding: '3px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold', backgroundColor: 'transparent', color: '#64748b', cursor: 'pointer' }}>Mensal</button>
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: '#fff7ed', border: '1px solid #ffedd5', padding: '6px 12px', borderRadius: '4px', marginBottom: '10px', display: 'inline-block' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#c2410c' }}>Média por dia: 997 m²</span>
              </div>

              <div className="chart-container" style={{ width: '100%', height: 210 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={[
                    { dia: '01', producao: 400 },
                    { dia: '05', producao: 800 },
                    { dia: '10', producao: 1200 },
                    { dia: '15', producao: 950 },
                    { dia: '20', producao: 1100 },
                    { dia: '25', producao: 700 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="producao" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* SEÇÃO 1: PLANEJADO VS EXECUTADO */}
          <div className="dashboard-card" style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', margin: 0, color: '#1e293b', fontWeight: 'bold' }}>
              Avanço do Planejamento (Planejado vs. Executado)
            </h3>

            {planejamentoData.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                Nenhum planejamento cadastrado ou produção encontrada para os filtros aplicados.
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto', marginBottom: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1', color: '#475569' }}>
                        <th style={{ padding: '6px' }}>Frente de Trabalho</th>
                        <th style={{ padding: '6px' }}>Atividade / Serviço</th>
                        <th style={{ padding: '6px', textAlign: 'center' }}>Unidade</th>
                        <th style={{ padding: '6px', textAlign: 'center' }}>Planejado</th>
                        <th style={{ padding: '6px', textAlign: 'center' }}>Executado</th>
                        <th style={{ padding: '6px', textAlign: 'center' }}>Desvio</th>
                        <th style={{ padding: '6px', textAlign: 'center' }}>% Atingido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planejamentoData.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px', color: '#64748b', fontWeight: 'bold' }}>{item.frente_trabalho || 'GERAL'}</td>
                          <td style={{ padding: '6px', fontWeight: 'bold', color: '#0f172a' }}>{item.atividade}</td>
                          <td style={{ padding: '6px', textAlign: 'center', color: '#475569' }}>{item.unidade_medida}</td>
                          <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold', color: '#2563eb' }}>
                            {item.planejado.toLocaleString('pt-BR')}
                          </td>
                          <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold', color: '#16a34a' }}>
                            {item.executado.toLocaleString('pt-BR')}
                          </td>
                          <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold', color: item.desvio < 0 ? '#dc2626' : '#16a34a' }}>
                            {item.desvio > 0 ? `+${item.desvio.toLocaleString('pt-BR')}` : item.desvio.toLocaleString('pt-BR')}
                          </td>
                          <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: item.percentualAtingido >= 100 ? '#dcfce7' : item.percentualAtingido >= 70 ? '#fef9c3' : '#fee2e2',
                              color: item.percentualAtingido >= 100 ? '#15803d' : item.percentualAtingido >= 70 ? '#a16207' : '#b91c1c'
                            }}>
                              {item.percentualAtingido}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="chart-container" style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={planejamentoData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="atividade" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="planejado" name="Qtd. Planejada" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="executado" name="Qtd. Executada" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>

          {/* SEÇÃO 2: GRÁFICO DE ATIVIDADES / COMPARATIVO */}
          <div className="dashboard-card" style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', margin: 0, color: '#1e293b', fontWeight: 'bold' }}>
              3. Comparativo entre Obras vs. Média Geral
            </h3>

            {atividadesFiltradas.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                Nenhuma produção registrada no período selecionado.
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                  {atividadesFiltradas.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderRight: '1px solid #bbf7d0', paddingRight: '6px' }}>
                      <span style={{ fontSize: '10px', color: '#15803d', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.atividade}>
                        {item.atividade}
                      </span>
                      <span style={{ fontSize: '15px', color: '#14532d', fontWeight: 'bold' }}>
                        {Number(item.quantidade).toLocaleString('pt-BR')}
                      </span>
                      <span style={{ fontSize: '9px', color: '#047857' }}>
                        Média: {Number(item.mediaGeral || 0).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', backgroundColor: '#bbf7d0', margin: '-10px -10px -10px 0', padding: '10px', borderRadius: '0 4px 4px 0', justifyContent: 'center' }}>
                    <span style={{ fontSize: '10px', color: '#14532d', fontWeight: 'bold' }}>TOTAL PRODUZIDO</span>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#16a34a' }}>
                      {totalVolumeAtividades.toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>

                <div className="chart-container" style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={atividadesFiltradas}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="atividade" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="quantidade" name="Obra Selecionada" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="mediaGeral" name="Média das Outras Obras" fill="#ea580c" radius={[4, 4, 0, 0]} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>

          {/* SEÇÃO 3: TABELA DETALHADA */}
          <div className="dashboard-card" style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', margin: 0, color: '#1e293b', fontWeight: 'bold' }}>
              4. Tabela Detalhada de Produção
            </h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#475569' }}>
                    <th style={{ padding: '8px' }}>Atividade</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Unidade</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Qtd. Produzida</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Média Outras Obras</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Diferença %</th>
                  </tr>
                </thead>
                <tbody>
                  {atividadesFiltradas.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}>Nenhum detalhe disponível.</td></tr>
                  ) : (
                    atividadesFiltradas.map((item, idx) => {
                      const qtd = Number(item.quantidade || 0);
                      const media = Number(item.mediaGeral || 0);
                      const diff = media > 0 ? (((qtd - media) / media) * 100).toFixed(1) : 0;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px', fontWeight: 'bold', color: '#0f172a' }}>{item.atividade}</td>
                          <td style={{ padding: '8px', textAlign: 'center', color: '#64748b' }}>{item.unidade || 'M²'}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#10b981' }}>{qtd.toLocaleString('pt-BR')}</td>
                          <td style={{ padding: '8px', textAlign: 'right', color: '#ea580c' }}>{media.toLocaleString('pt-BR')}</td>
                          <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: diff >= 0 ? '#dcfce7' : '#fee2e2',
                              color: diff >= 0 ? '#15803d' : '#b91c1c'
                            }}>
                              {diff >= 0 ? `+${diff}%` : `${diff}%`}
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

          {/* SEÇÃO 4: PRESENÇA DE FUNCIONÁRIOS E EFETIVO */}
          <div className="dashboard-card" style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '14px', margin: 0, color: '#1e293b', fontWeight: 'bold' }}>
                5. Total de Presença e Efetivo
              </h3>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#334155', fontWeight: 'bold' }}>
                  Total de RDOs: <span style={{ color: '#2563eb' }}>{presenca.totalRdos || 0}</span>
                </div>
                <div style={{ backgroundColor: '#f0fdf4', padding: '6px 12px', borderRadius: '6px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#166534', fontWeight: 'bold' }}>Frequência Geral:</span>
                  <span style={{ fontSize: '13px', color: '#15803d', fontWeight: 'bold' }}>
                    {presenca.percentualFrequenciaGeral || 0}%
                  </span>
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#475569' }}>
                    <th style={{ padding: '6px' }}>Matrícula</th>
                    <th style={{ padding: '6px' }}>Funcionário</th>
                    <th style={{ padding: '6px' }}>Cargo</th>
                    <th style={{ padding: '6px', textAlign: 'center' }}>Presente</th>
                    <th style={{ padding: '6px', textAlign: 'center' }}>Faltou</th>
                    <th style={{ padding: '6px', textAlign: 'center' }}>Outros</th>
                    <th style={{ padding: '6px', textAlign: 'center' }}>% Frequência</th>
                  </tr>
                </thead>
                <tbody>
                  {!presenca.relacaoPresenca || presenca.relacaoPresenca.length === 0 ? (
                    <tr><td colSpan="7" style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}>Nenhum registro de presença encontrado.</td></tr>
                  ) : (
                    presenca.relacaoPresenca.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px', fontFamily: 'monospace', fontWeight: 'bold', color: '#64748b' }}>
                          {row.matricula || '-'}
                        </td>
                        <td style={{ padding: '6px', fontWeight: 'bold', color: '#0f172a' }}>
                          {row.colaborador}
                        </td>
                        <td style={{ padding: '6px', color: '#475569' }}>
                          {row.cargo || '-'}
                        </td>
                        <td style={{ padding: '6px', textAlign: 'center', color: '#16a34a', fontWeight: 'bold' }}>
                          {row.presente}
                        </td>
                        <td style={{ padding: '6px', textAlign: 'center', color: '#dc2626', fontWeight: 'bold' }}>
                          {row.faltou}
                        </td>
                        <td style={{ padding: '6px', textAlign: 'center', color: '#d97706' }}>
                          {row.outros}
                        </td>
                        <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: row.percentualFrequencia >= 85 ? '#dcfce7' : row.percentualFrequencia >= 70 ? '#fef9c3' : '#fee2e2',
                            color: row.percentualFrequencia >= 85 ? '#15803d' : row.percentualFrequencia >= 70 ? '#a16207' : '#b91c1c'
                          }}>
                            {row.percentualFrequencia}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SEÇÃO 5: RELATÓRIO DE RDOS E CONTROLE DE EQUIPES */}
          <div className="dashboard-card" style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '14px', margin: 0, color: '#1e293b', fontWeight: 'bold' }}>
                6. Relatório de RDOs e Controle de Equipes
              </h3>
              <div style={{ backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#334155', fontWeight: 'bold' }}>
                Total Registrado: <span style={{ color: '#2563eb' }}>{rdosData.totalRegistros || 0}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '11px', margin: '0 0 8px 0', color: '#334155' }}>Status do RDO</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '4px' }}>Status</th>
                      <th style={{ padding: '4px', textAlign: 'center' }}>Qtd</th>
                      <th style={{ padding: '4px', textAlign: 'right' }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!rdosData.porStatusRdo || rdosData.porStatusRdo.length === 0 ? (
                      <tr><td colSpan="3" style={{ padding: '6px', textAlign: 'center', color: '#94a3b8' }}>Sem dados</td></tr>
                    ) : (
                      rdosData.porStatusRdo.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '4px', fontWeight: 'bold', color: item.status === 'FINALIZADO' ? '#16a34a' : '#d97706' }}>
                            {item.status}
                          </td>
                          <td style={{ padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantidade}</td>
                          <td style={{ padding: '4px', textAlign: 'right', fontWeight: 'bold', color: '#2563eb' }}>{item.percentual}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '11px', margin: '0 0 8px 0', color: '#334155' }}>Status Operacional</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '4px' }}>Condição</th>
                      <th style={{ padding: '4px', textAlign: 'center' }}>Qtd</th>
                      <th style={{ padding: '4px', textAlign: 'right' }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!rdosData.porStatusOperacional || rdosData.porStatusOperacional.length === 0 ? (
                      <tr><td colSpan="3" style={{ padding: '6px', textAlign: 'center', color: '#94a3b8' }}>Sem dados</td></tr>
                    ) : (
                      rdosData.porStatusOperacional.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '4px', fontWeight: 'bold', color: '#0f172a' }}>{item.status_operacional}</td>
                          <td style={{ padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantidade}</td>
                          <td style={{ padding: '4px', textAlign: 'right', fontWeight: 'bold', color: '#2563eb' }}>{item.percentual}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SEÇÃO 6: RELATÓRIO DE COMPRAS E FATURAMENTO DIRETO */}
          <div className="dashboard-card page-landscape" style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '14px', margin: 0, color: '#1e293b', fontWeight: 'bold' }}>
                7. Relatório de Faturamento Direto e Compras da Obra
              </h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ backgroundColor: '#dbeafe', padding: '4px 8px', borderRadius: '4px', border: '1px solid #93c5fd', fontSize: '10px', color: '#1e40af', fontWeight: 'bold' }}>
                  Volume Compras: R$ {totalGastoCompras.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ backgroundColor: '#dcfce7', padding: '4px 8px', borderRadius: '4px', border: '1px solid #86efac', fontSize: '10px', color: '#166534', fontWeight: 'bold' }}>
                  Pedidos: {totalPedidosCompras}
                </div>
                <div style={{ backgroundColor: '#fef3c7', padding: '4px 8px', borderRadius: '4px', border: '1px solid #fde047', fontSize: '10px', color: '#92400e', fontWeight: 'bold' }}>
                  Fat. Direto: R$ {totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="no-print" style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0', flexWrap: 'wrap' }}>
              <button onClick={() => setAbaCompras('materiais')} style={tabButtonStyle(abaCompras === 'materiais')}>
                Compras por Produto/Material
              </button>
              <button onClick={() => setAbaCompras('fornecedores')} style={tabButtonStyle(abaCompras === 'fornecedores')}>
                Compras por Fornecedor
              </button>
              <button onClick={() => setAbaCompras('faturamento')} style={tabButtonStyle(abaCompras === 'faturamento')}>
                Faturamento Direto
              </button>
            </div>

            {/* COMPRAS POR MATERIAL */}
            <div className={abaCompras === 'materiais' ? '' : 'print-only'} style={{ overflowX: 'auto', marginBottom: '15px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '5px', color: '#334155' }}>Detalhamento por Material</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '10px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#475569' }}>
                    <th style={{ padding: '6px' }}>Produto / Material</th>
                    <th style={{ padding: '6px' }}>Tipo</th>
                    <th style={{ padding: '6px' }}>Qtd. Comprada</th>
                    <th style={{ padding: '6px', textAlign: 'center' }}>Capacidade de Uso</th>
                    <th style={{ padding: '6px' }}>Preço Médio</th>
                    <th style={{ padding: '6px' }}>Valor Gasto</th>
                  </tr>
                </thead>
                <tbody>
                  {comprasMateriais.length === 0 ? (
                    <tr><td colSpan="6" style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}>Nenhum registro encontrado.</td></tr>
                  ) : (
                    comprasMateriais.map((m, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px', fontWeight: 'bold' }}>
                          {m.material_nome} <span style={{ color: '#64748b', fontWeight: 'normal' }}>({m.unidade_medida || 'UN'})</span>
                        </td>
                        <td style={{ padding: '6px', color: '#475569' }}>{m.material_tipo || '-'}</td>
                        <td style={{ padding: '6px', fontWeight: 'bold' }}>{parseFloat(m.quantidade_total_comprada || 0).toLocaleString('pt-BR')}</td>
                        <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold', color: '#475569' }}>
                          {calcularCapacidadeUso(m)}
                        </td>
                        <td style={{ padding: '6px' }}>R$ {parseFloat(m.preco_medio_unitario || 0).toFixed(2)}</td>
                        <td style={{ padding: '6px', fontWeight: 'bold', color: '#2563eb' }}>
                          R$ {parseFloat(m.valor_total_gasto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* COMPRAS POR FORNECEDOR */}
            <div className={abaCompras === 'fornecedores' ? '' : 'print-only'} style={{ overflowX: 'auto', marginBottom: '15px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '5px', color: '#334155' }}>Detalhamento por Fornecedor</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '10px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#475569' }}>
                    <th style={{ padding: '6px' }}>Fornecedor</th>
                    <th style={{ padding: '6px' }}>CNPJ</th>
                    <th style={{ padding: '6px' }}>Nº Pedidos</th>
                    <th style={{ padding: '6px' }}>Variedade</th>
                    <th style={{ padding: '6px' }}>Valor Total (R$)</th>
                    <th style={{ padding: '6px' }}>% Part.</th>
                  </tr>
                </thead>
                <tbody>
                  {comprasFornecedores.length === 0 ? (
                    <tr><td colSpan="6" style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}>Nenhum registro encontrado.</td></tr>
                  ) : (
                    comprasFornecedores.map((f, idx) => {
                      const valorGastoForn = parseFloat(f.valor_total_gasto || 0);
                      const pctTotal = totalGastoCompras > 0 ? ((valorGastoForn / totalGastoCompras) * 100).toFixed(1) : '0.0';

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px', fontWeight: 'bold' }}>{f.nome_fantasia || f.razao_social}</td>
                          <td style={{ padding: '6px', color: '#64748b' }}>{f.cnpj || '-'}</td>
                          <td style={{ padding: '6px', fontWeight: 'bold', color: '#0284c7' }}>{f.total_pedidos}</td>
                          <td style={{ padding: '6px' }}>{f.diversidade_produtos} itens</td>
                          <td style={{ padding: '6px', fontWeight: 'bold', color: '#16a34a' }}>
                            R$ {valorGastoForn.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '6px', fontWeight: 'bold' }}>{pctTotal}%</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* FATURAMENTO DIRETO */}
            <div className={abaCompras === 'faturamento' ? '' : 'print-only'} style={{ overflowX: 'auto' }}>
              <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '5px', color: '#334155' }}>Relatório de Faturamento Direto</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '10px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#475569' }}>
                    <th style={{ padding: '6px' }}>Nota Fiscal</th>
                    <th style={{ padding: '6px' }}>Fornecedor</th>
                    <th style={{ padding: '6px' }}>Data Emissão</th>
                    <th style={{ padding: '6px' }}>Valor Total (R$)</th>
                    <th style={{ padding: '6px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {faturamento.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}>Nenhum faturamento registrado.</td></tr>
                  ) : (
                    faturamento.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px', fontWeight: 'bold' }}>
                          {row.numero_nota_fiscal || (row.numero_pedido_obra ? `Ped: ${row.numero_pedido_obra}` : `#${row.id}`)}
                        </td>
                        <td style={{ padding: '6px' }}>{row.fornecedor_nome || '-'}</td>
                        <td style={{ padding: '6px', color: '#64748b' }}>
                          {row.data_emissao ? new Date(row.data_emissao).toLocaleDateString('pt-BR') : '-'}
                        </td>
                        <td style={{ padding: '6px', fontWeight: 'bold', color: '#16a34a' }}>
                          R$ {Number(row.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '6px' }}>
                          <span style={{
                            padding: '2px 4px',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            fontSize: '9px',
                            backgroundColor: row.status === 'APROVADO' || row.status === 'Concluído' ? '#dcfce7' : '#fef3c7',
                            color: row.status === 'APROVADO' || row.status === 'Concluído' ? '#166534' : '#92400e'
                          }}>
                            {row.status || 'PENDENTE'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SEÇÃO 7: RELATÓRIO CONSOLIDADO DE VEÍCULOS / FROTA ALOCADA */}
          <div className="dashboard-card page-landscape" style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '14px', margin: 0, color: '#1e293b', fontWeight: 'bold' }}>
                8. Relatório Consolidado de Veículos / Frota Alocada
              </h3>
              <div style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '10px', color: '#334155', fontWeight: 'bold' }}>
                Apontamentos Totais: <span style={{ color: '#2563eb' }}>{veiculosData.totalVeiculosUtilizados || 0}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '8px' }}>
                <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 'bold', display: 'block' }}>VEÍCULOS DISTINTOS</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>{listaVeiculosAgrupada.length}</span>
              </div>

              <div style={{ backgroundColor: '#fef9c3', border: '1px solid #fde047', borderRadius: '4px', padding: '8px' }}>
                <span style={{ fontSize: '9px', color: '#854d0e', fontWeight: 'bold', display: 'block' }}>EM USO</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#713f12' }}>{veiculosData.resumoStatus['EM USO'] || 0}</span>
              </div>

              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '8px' }}>
                <span style={{ fontSize: '9px', color: '#166534', fontWeight: 'bold', display: 'block' }}>DISPONÍVEIS</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#14532d' }}>{veiculosData.resumoStatus['DISPONÍVEL'] || 0}</span>
              </div>

              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', padding: '8px' }}>
                <span style={{ fontSize: '9px', color: '#991b1b', fontWeight: 'bold', display: 'block' }}>MANUTENÇÃO</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#7f1d1d' }}>{veiculosData.resumoStatus['EM MANUTENÇÃO'] || 0}</span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '10px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#475569' }}>
                    <th style={{ padding: '6px' }}>Placa</th>
                    <th style={{ padding: '6px' }}>Veículo / Modelo</th>
                    <th style={{ padding: '6px', textAlign: 'center' }}>Total Apontamentos</th>
                    <th style={{ padding: '6px', textAlign: 'center' }}>Em Uso</th>
                    <th style={{ padding: '6px', textAlign: 'center' }}>Disponível</th>
                    <th style={{ padding: '6px', textAlign: 'center' }}>Manutenção</th>
                    <th style={{ padding: '6px' }}>Motoristas / Responsáveis</th>
                  </tr>
                </thead>
                <tbody>
                  {listaVeiculosAgrupada.length === 0 ? (
                    <tr><td colSpan="7" style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}>Nenhum veículo utilizado na obra neste período.</td></tr>
                  ) : (
                    listaVeiculosAgrupada.map((v, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px', fontFamily: 'monospace', fontWeight: 'bold', color: '#0f172a' }}>
                          {v.placa}
                        </td>
                        <td style={{ padding: '6px', fontWeight: 'bold', color: '#1e293b' }}>
                          {v.veiculo}
                        </td>
                        <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>
                          {v.total_apontamentos}
                        </td>
                        <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold', color: '#854d0e', backgroundColor: '#fef9c3' }}>
                          {v.em_uso}
                        </td>
                        <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold', color: '#166534', backgroundColor: '#f0fdf4' }}>
                          {v.disponivel}
                        </td>
                        <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold', color: '#991b1b', backgroundColor: '#fef2f2' }}>
                          {v.manutencao}
                        </td>
                        <td style={{ padding: '6px', color: '#475569' }}>
                          {Array.from(v.condutores).join(', ') || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ======================================================== */}
      {/* ABA 2: DASHBOARD DE ENCARREGADOS & FUNCIONÁRIOS        */}
      {/* ======================================================== */}
      {abaPrincipal === 'encarregados' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', padding: '14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <MapPin size={30} color="#10b981" />
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Obras Atuadas</span>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a' }}>{dadosEncarregado.resumo?.total_obras || 0}</div>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', padding: '14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Calendar size={30} color="#2563eb" />
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Dias Ativos em Campo</span>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1d4ed8' }}>{dadosEncarregado.resumo?.total_dias_campo || 0} dias</div>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', padding: '14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Award size={30} color="#ea580c" />
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Efetivo Apontado</span>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ea580c' }}>{dadosEncarregado.resumo?.total_presencas || 0}</div>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '14px', margin: 0, color: '#0f172a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingUp size={16} color="#10b981" />
                <span>Ranking de Produção Entregue pela Equipe</span>
              </h3>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setTopRankEnc(true)}
                  style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: topRankEnc ? '#10b981' : '#f1f5f9', color: topRankEnc ? '#fff' : '#475569' }}
                >
                  Top 10 Atividades
                </button>
                <button
                  onClick={() => setTopRankEnc(false)}
                  style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: !topRankEnc ? '#10b981' : '#f1f5f9', color: !topRankEnc ? '#fff' : '#475569' }}
                >
                  Ver Todas
                </button>
              </div>
            </div>

            {producaoEncarregadoExibicao.length > 0 ? (
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={producaoEncarregadoExibicao} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="atividade" type="category" width={140} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="quantidade_total" name="Volume Total" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                Nenhum histórico de produção disponível para esta seleção.
              </div>
            )}
          </div>

          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ fontSize: '14px', margin: '0 0 12px 0', color: '#0f172a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Briefcase size={16} color="#10b981" />
              <span>Obras & Locais de Atuação</span>
            </h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '8px' }}>Cód. Obra</th>
                    <th style={{ padding: '8px' }}>Obra / Local</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Dias Alocado</th>
                    <th style={{ padding: '8px' }}>Início da Atuação</th>
                    <th style={{ padding: '8px' }}>Último Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {dadosEncarregado.obrasAtuadas.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>
                        Nenhum registro de obra encontrado para este encarregado.
                      </td>
                    </tr>
                  ) : (
                    dadosEncarregado.obrasAtuadas.map((ob, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px', fontWeight: 'bold', color: '#64748b' }}>{ob.codigo_obra || `#${ob.id_obra}`}</td>
                        <td style={{ padding: '8px', fontWeight: 'bold', color: '#0f172a' }}>{ob.nome_obra}</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#10b981' }}>{ob.dias_trabalhados}</td>
                        <td style={{ padding: '8px', color: '#475569' }}>{ob.primeira_atuação ? new Date(ob.primeira_atuação).toLocaleDateString('pt-BR') : '-'}</td>
                        <td style={{ padding: '8px', color: '#475569' }}>{ob.ultima_atuação ? new Date(ob.ultima_atuação).toLocaleDateString('pt-BR') : '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}