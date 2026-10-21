import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { 
  BarChart3, 
  Users, 
  Filter, 
  Download, 
  Trash2, 
  Layers, 
  Package, 
  X, 
  Image as ImageIcon 
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const API_URL = 'http://localhost:3001/api';

const ABAS = [
  { key: 'ATIVIDADES', label: 'Produção por atividade', icon: Layers },
  { key: 'MATERIAIS', label: 'Consumo de materiais', icon: Package }
];

export default function HistoricoDiarios({ id, cargo }) {
  // --- ESTADOS DE NAVEGAÇÃO E FILTROS ---
  const [abaAtiva, setAbaAtiva] = useState('ATIVIDADES');
  
  // MULTI-SELEÇÃO DE OBRAS E TIPOS
  const [obrasSelecionadas, setObrasSelecionadas] = useState([]);
  const [isOpenObras, setIsOpenObras] = useState(false);
  
  const [tiposSelecionados, setTiposSelecionados] = useState([]);
  const [isOpenTipos, setIsOpenTipos] = useState(false);
  
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [statusFiltro, setStatusFiltro] = useState(''); 
  const [statusOperacionalFiltro, setStatusOperacionalFiltro] = useState(''); 
  const [idGestorFiltro, setIdGestorFiltro] = useState(''); 

  // --- ESTADOS DE DADOS ---
  const [tiposDisponiveis, setTiposDisponiveis] = useState([]);
  const [obras, setObras] = useState([]);
  const [gestores, setGestores] = useState([]); 
  const [listaDiarios, setListaDiarios] = useState([]);
  const [loading, setLoading] = useState(false);

  // --- ESTADOS DE MODAIS ---
  const [diarioSelecionado, setDiarioSelecionado] = useState(null);
  const [modalExcluir, setModalExcluir] = useState(null);
  const [fotosModal, setFotosModal] = useState(null);
  const [imagemZoom, setImagemZoom] = useState(null);
  const [processandoAcao, setProcessandoAcao] = useState(false);

  const cargoUpper = cargo ? String(cargo).toUpperCase() : '';
  const isMaster = cargoUpper === 'MASTER' || cargoUpper === 'ADMIN' || cargoUpper === 'RH';

  // --- REQUISIÇÕES DE SUPORTE ---
  useEffect(() => {
    const carregarTiposObra = async () => {
      if (!id) return;
      try {
        const res = await axios.get(`${API_URL}/gestor/tipos-obra`, { params: { id, cargo } });
        setTiposDisponiveis(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error("Erro ao carregar tipos de obra:", e);
      }
    };
    carregarTiposObra();
  }, [id, cargo]);

  useEffect(() => {
    const carregarObrasFiltro = async () => {
      if (!id) return;
      try {
        const res = await axios.get(`${API_URL}/gestor/obras-ativas`, {
          params: { 
            id, 
            cargo,
            tipo_obra: tiposSelecionados.length > 0 ? tiposSelecionados.join(',') : undefined
          }
        });
        setObras(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error("Erro ao carregar obras para filtro:", e);
      }
    };
    carregarObrasFiltro();
  }, [id, cargo, tiposSelecionados]);

  useEffect(() => {
    if (isMaster) {
      axios.get(`${API_URL}/gestores`)
        .then(res => setGestores(res.data || []))
        .catch(e => console.error("Erro ao carregar gestores:", e));
    }
  }, [isMaster]);

  // --- BUSCA HISTÓRICO ---
  const buscarHistorico = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/gestor/historico-diarios`, {
        params: { 
          id,                  
          cargo,            
          id_obra: obrasSelecionadas.length > 0 ? obrasSelecionadas.join(',') : undefined, 
          tipo_obra: tiposSelecionados.length > 0 ? tiposSelecionados.join(',') : undefined, 
          data_inicio: dataInicio || undefined, 
          data_fim: dataFim || undefined,
          status_rdo: statusFiltro || undefined,
          status_operacional: statusOperacionalFiltro || undefined,
          id_gestor_filtro: idGestorFiltro || undefined,
          id_gestor: idGestorFiltro || undefined
        }
      });
      
      const lista = Array.isArray(res.data) ? res.data : (res.data.diarios || res.data.dados || []);
      setListaDiarios(lista);
    } catch (err) {
      console.error("Erro ao buscar histórico do banco:", err);
      setListaDiarios([]);
    } finally {
      setLoading(false);
    }
  }, [id, cargo, obrasSelecionadas, tiposSelecionados, dataInicio, dataFim, statusFiltro, statusOperacionalFiltro, idGestorFiltro]);

  useEffect(() => {
    buscarHistorico();
  }, [buscarHistorico]);

  // --- EXCLUSÃO DE RDO ---
  const handleExcluirRdo = async () => {
    if (!modalExcluir) return;
    try {
      setProcessandoAcao(true);
      await axios.delete(`${API_URL}/gestor/diarios/${modalExcluir.id}`, { data: { id_usuario: id } });
      setModalExcluir(null);
      setDiarioSelecionado(null);
      buscarHistorico();
    } catch (e) {
      alert("Erro ao excluir RDO: " + (e.response?.data?.message || e.message));
    } finally {
      setProcessandoAcao(false);
    }
  };

  // --- PROCESSAMENTO DE DADOS (ATIVIDADES E MATERIAIS) ---
  const atividadesExtraidas = useMemo(() => {
    return listaDiarios.flatMap(rdo => {
      if (rdo.atividades && Array.isArray(rdo.atividades)) {
        return rdo.atividades.map(a => ({ ...a, rdo }));
      }
      if (!rdo.servicos_resumo) return [];
      
      return rdo.servicos_resumo.split(/[\n,]+/).map(linha => {
        if (!linha.trim()) return null;
        const formatado = linha.replace(/^[•\-*]\s*/, '').trim();
        const idx = formatado.lastIndexOf(':');
        if (idx === -1) return null;
        const descricao = formatado.substring(0, idx).trim();
        const qtdTexto = formatado.substring(idx + 1).trim();
        const quantidade = parseFloat(qtdTexto.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        return { descricao, quantidade, unidade: 'UN', rdo };
      }).filter(Boolean);
    });
  }, [listaDiarios]);

  const materiaisExtraidos = useMemo(() => {
    return listaDiarios.flatMap(rdo => {
      if (rdo.materiais && Array.isArray(rdo.materiais)) {
        return rdo.materiais.map(m => ({ ...m, rdo }));
      }
      return [];
    });
  }, [listaDiarios]);

  // --- EXPORTAÇÃO DE PLANILHA CSV ---
  const handleExportarPlanilha = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (abaAtiva === 'ATIVIDADES') {
      csvContent += "Data;Obra;Equipe;Atividade;Quantidade;Unidade;Status RDO\n";
      atividadesExtraidas.forEach(a => {
        csvContent += `${formatarDataExibicao(a.rdo.data_diario)};${a.rdo.nome_obra || ''};${a.rdo.equipe || ''};${a.descricao};${a.quantidade};${a.unidade || 'UN'};${a.rdo.status_rdo || ''}\n`;
      });
    } else {
      csvContent += "Data;Obra;Equipe;Material;Quantidade;Unidade;Status RDO\n";
      materiaisExtraidos.forEach(m => {
        csvContent += `${formatarDataExibicao(m.rdo.data_diario)};${m.rdo.nome_obra || ''};${m.rdo.equipe || ''};${m.descricao};${m.quantidade};${m.unidade || 'UN'};${m.rdo.status_rdo || ''}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `historico_${abaAtiva.toLowerCase()}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- CONSTRUÇÃO DO GRÁFICO DA ABA ATIVIDADES ---
  const processarDadosAtividadesGrafico = () => {
    const totaisAtividades = {};
    let somaGeral = 0;

    atividadesExtraidas.forEach(a => {
      const nome = a.descricao.toUpperCase();
      totaisAtividades[nome] = (totaisAtividades[nome] || 0) + a.quantidade;
      somaGeral += a.quantidade;
    });

    const labels = Object.keys(totaisAtividades);
    return {
      dicionarioItens: totaisAtividades,
      totalGeral: somaGeral,
      chartData: {
        labels: labels,
        datasets: [{
          label: 'Quantidade Total Produzida',
          data: Object.values(totaisAtividades),
          backgroundColor: '#10b981', 
          borderRadius: 4,
        }]
      }
    };
  };

  const { chartData, dicionarioItens, totalGeral } = processarDadosAtividadesGrafico();

  const handleToggleTipo = (tipo) => {
    setTiposSelecionados(prev => prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]);
  };

  const handleToggleObra = (obraId) => {
    setObrasSelecionadas(prev => prev.includes(String(obraId)) ? prev.filter(id => id !== String(obraId)) : [...prev, String(obraId)]);
  };

  const formatarDataExibicao = (dataRaw) => {
    if (!dataRaw) return '--/--/----';
    const dataLimpa = dataRaw.includes('T') ? dataRaw.split('T')[0] : dataRaw;
    const [ano, mes, dia] = dataLimpa.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const renderizarBadgeStatusOperacional = (statusOp) => {
    const st = statusOp ? String(statusOp).toUpperCase().trim() : 'NORMAL';

    if (st.includes('NORMAL')) {
      return (
        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc' }}>
          ✓ NORMAL
        </span>
      );
    }
    if (st.includes('CHUVA') || st.includes('CHOVEU')) {
      return (
        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#e0e7ff', color: '#3730a3', border: '1px solid #a5b4fc' }}>
          🌧️ CHUVA
        </span>
      );
    }
    if (st.includes('MATERIAL')) {
      return (
        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
          ⚠️ SEM MATERIAL
        </span>
      );
    }
    if (st.includes('EQUIPAMENTO')) {
      return (
        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa' }}>
          ⚙️ SEM EQUIPAMENTO
        </span>
      );
    }
    if (st.includes('APOIO')) {
      return (
        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #86efac' }}>
          🤝 APOIO
        </span>
      );
    }
    if (st.includes('SEM ATIVIDADE')) {
      return (
        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#f3f4f6', color: '#4b5563', border: '1px solid #d1d5db' }}>
          ⏸️ SEM ATIVIDADE
        </span>
      );
    }
    if (st.includes('FOLGA') || st.includes('FDS')) {
      return (
        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde047' }}>
          🏖️ FOLGA / FDS
        </span>
      );
    }

    return (
      <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}>
        {st}
      </span>
    );
  };

  return (
    <div style={{ padding: '16px', fontFamily: 'sans-serif', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#f8fafc', minHeight: '100vh', boxSizing: 'border-box' }}>
      
      {/* CABEÇALHO COM TÍTULO E BOTÃO EXPORTAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: '#fff', padding: '16px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Histórico de Produção e Materiais</h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '12px' }}>
            Acompanhe o volume acumulado de atividades executadas e o consumo de insumos na obra.
          </p>
        </div>
        <button 
          onClick={handleExportarPlanilha} 
          disabled={listaDiarios.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', opacity: listaDiarios.length === 0 ? 0.6 : 1 }}
        >
          <Download style={{ width: '15px' }} /> Baixar Planilha
        </button>
      </div>

      {/* ABAS DE NAVEGAÇÃO */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #cbd5e1' }}>
        {ABAS.map(aba => {
          const IconeAba = aba.icon;
          const ativa = abaAtiva === aba.key;
          return (
            <button
              key={aba.key}
              onClick={() => setAbaAtiva(aba.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                border: 'none',
                borderBottom: ativa ? '3px solid #2563eb' : '3px solid transparent',
                backgroundColor: ativa ? '#fff' : 'transparent',
                color: ativa ? '#2563eb' : '#64748b',
                fontWeight: ativa ? 'bold' : 'normal',
                cursor: 'pointer',
                borderRadius: '4px 4px 0 0'
              }}
            >
              <IconeAba style={{ width: '16px' }} />
              {aba.label}
            </button>
          );
        })}
      </div>

      {/* SEÇÃO DE FILTROS */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: '#1e293b', marginBottom: '12px' }}>
          <Filter style={{ width: '16px', color: '#2563eb' }} /> FILTROS DE HISTÓRICO
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          {isMaster && (
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#334155', fontSize: '11px' }}>GESTOR / ENCARREGADO</label>
              <select value={idGestorFiltro} onChange={e => setIdGestorFiltro(e.target.value)} style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff' }}>
                <option value="">-- Todos os Gestores --</option>
                {gestores.map(g => (
                  <option key={g.id_usuario || g.id} value={g.id_usuario || g.id}>
                    {g.nome_gestor || g.nome || g.nome_usuario || `Gestor ${g.id_usuario || g.id}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* MULTI-SELECT TIPO DE OBRA */}
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#334155', fontSize: '11px' }}>
              TIPO DE OBRA ({tiposSelecionados.length > 0 ? `${tiposSelecionados.length} sel.` : 'TODOS'})
            </label>
            <button
              type="button"
              onClick={() => { setIsOpenTipos(!isOpenTipos); setIsOpenObras(false); }}
              style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tiposSelecionados.length === 0 ? '-- Todos os Tipos --' : tiposSelecionados.join(', ')}
              </span>
              <span>{isOpenTipos ? '▲' : '▼'}</span>
            </button>
            {isOpenTipos && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: '4px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', maxHeight: '180px', overflowY: 'auto', padding: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                <div onClick={() => setTiposSelecionados([])} style={{ padding: '4px 8px', color: '#2563eb', fontWeight: 'bold', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                  {tiposSelecionados.length > 0 ? 'Limpar seleção' : 'Todos os Tipos'}
                </div>
                {tiposDisponiveis.map(tipo => (
                  <label key={tipo} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={tiposSelecionados.includes(tipo)} onChange={() => handleToggleTipo(tipo)} />
                    {tipo}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* MULTI-SELECT OBRA VINCULADA */}
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#334155', fontSize: '11px' }}>
              OBRA VINCULADA ({obrasSelecionadas.length > 0 ? `${obrasSelecionadas.length} sel.` : 'TODAS'})
            </label>
            <button
              type="button"
              onClick={() => { setIsOpenObras(!isOpenObras); setIsOpenTipos(false); }}
              style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {obrasSelecionadas.length === 0 
                  ? '-- Todas as Obras --' 
                  : obras
                      .filter(o => obrasSelecionadas.includes(String(o.id)))
                      .map(o => o.nome_obra)
                      .join(', ')}
              </span>
              <span>{isOpenObras ? '▲' : '▼'}</span>
            </button>
            {isOpenObras && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: '4px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', maxHeight: '180px', overflowY: 'auto', padding: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                <div onClick={() => setObrasSelecionadas([])} style={{ padding: '4px 8px', color: '#2563eb', fontWeight: 'bold', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                  {obrasSelecionadas.length > 0 ? 'Limpar seleção' : 'Todas as Obras'}
                </div>
                {obras.map(o => {
                  const checked = obrasSelecionadas.includes(String(o.id));
                  return (
                    <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', cursor: 'pointer', backgroundColor: checked ? '#eff6ff' : 'transparent', borderRadius: '4px' }}>
                      <input type="checkbox" checked={checked} onChange={() => handleToggleObra(o.id)} />
                      {o.nome_obra}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#334155', fontSize: '11px' }}>STATUS DO RDO</label>
            <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)} style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff' }}>
              <option value="">-- Todos --</option>
              <option value="FINALIZADO">CONCLUÍDO</option>
              <option value="PENDENTE">PENDENTE</option>
            </select>
          </div>

          {/* FILTRO DE STATUS OPERACIONAL ATUALIZADO */}
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#334155', fontSize: '11px' }}>STATUS OPERACIONAL</label>
            <select value={statusOperacionalFiltro} onChange={e => setStatusOperacionalFiltro(e.target.value)} style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff' }}>
              <option value="">-- Todos os Status --</option>
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

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#334155', fontSize: '11px' }}>DATA INICIAL</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#334155', fontSize: '11px' }}>DATA FINAL</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff' }} />
          </div>
        </div>
      </div>

      {/* --- CONTEÚDO DA ABA: PRODUÇÃO POR ATIVIDADE --- */}
      {abaAtiva === 'ATIVIDADES' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loading ? (
            <div style={{ backgroundColor: '#fff', padding: '20px', textAlign: 'center', fontWeight: 'bold', color: '#64748b', borderRadius: '6px', border: '1px solid #cbd5e1' }}>Carregando dados de produção...</div>
          ) : (
            <>
              {chartData.labels.length > 0 && (
                <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#1e293b', marginBottom: '12px' }}>
                    <BarChart3 style={{ width: '16px', color: '#10b981' }} /> CONSOLIDADO DE PRODUÇÃO NO PERÍODO
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '4px', marginBottom: '12px' }}>
                    {Object.entries(dicionarioItens).map(([atividade, total]) => (
                      <div key={atividade} style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderRight: '1px solid #cbd5e1', paddingRight: '8px' }}>
                        <span style={{ fontSize: '10px', color: '#475569', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{atividade}</span>
                        <span style={{ fontSize: '15px', color: '#0f172a', fontWeight: 'bold' }}>{total.toLocaleString('pt-BR')}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', backgroundColor: '#e2e8f0', padding: '8px', borderRadius: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#1e293b', fontWeight: 'bold' }}>TOTAL GERAL</span>
                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#2563eb' }}>{totalGeral.toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                  <div style={{ height: '220px' }}>
                    <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                  </div>
                </div>
              )}

              <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0f172a' }}>Listagem detalhada das atividades</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9' }}>
                        <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>DATA</th>
                        <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>OBRA</th>
                        <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>EQUIPE</th>
                        <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>ATIVIDADE</th>
                        <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>QTD</th>
                        <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atividadesExtraidas.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: '#94a3b8' }}>Nenhuma atividade registrada no período.</td></tr>
                      ) : (
                        atividadesExtraidas.map((a, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '8px', fontWeight: 'bold' }}>{formatarDataExibicao(a.rdo.data_diario)}</td>
                            <td style={{ padding: '8px' }}>{a.rdo.nome_obra}</td>
                            <td style={{ padding: '8px' }}>{a.rdo.equipe || 'Geral'}</td>
                            <td style={{ padding: '8px', fontWeight: 'bold' }}>{a.descricao}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#16a34a' }}>{a.quantidade} {a.unidade || 'UN'}</td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                {a.fotos && a.fotos.length > 0 && (
                                  <button onClick={() => setFotosModal(a)} style={{ border: '1px solid #cbd5e1', backgroundColor: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <ImageIcon style={{ width: '13px' }} /> Fotos ({a.fotos.length})
                                  </button>
                                )}
                                <button onClick={() => setDiarioSelecionado(a.rdo)} style={{ border: '1px solid #cbd5e1', backgroundColor: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                                  Abrir RDO
                                </button>
                              </div>
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
        </div>
      )}

      {/* --- CONTEÚDO DA ABA: CONSUMO DE MATERIAIS --- */}
      {abaAtiva === 'MATERIAIS' && (
        <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0f172a' }}>Listagem detalhada de materiais</h3>
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>Carregando consumo de materiais...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9' }}>
                    <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>DATA</th>
                    <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>OBRA</th>
                    <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>EQUIPE</th>
                    <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>MATERIAL / INSUMO</th>
                    <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>QTD</th>
                    <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {materiaisExtraidos.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: '#94a3b8' }}>Nenhum material registrado no período.</td></tr>
                  ) : (
                    materiaisExtraidos.map((m, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px', fontWeight: 'bold' }}>{formatarDataExibicao(m.rdo.data_diario)}</td>
                        <td style={{ padding: '8px' }}>{m.rdo.nome_obra}</td>
                        <td style={{ padding: '8px' }}>{m.rdo.equipe || 'Geral'}</td>
                        <td style={{ padding: '8px', fontWeight: 'bold' }}>{m.descricao}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{m.quantidade} {m.unidade || 'UN'}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>
                          <button onClick={() => setDiarioSelecionado(m.rdo)} style={{ border: '1px solid #cbd5e1', backgroundColor: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                            Abrir RDO
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
      )}

      {/* MODAL DETALHES DO RDO */}
      {diarioSelecionado && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '12px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '6px', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #94a3b8' }}>
            <div style={{ padding: '12px 16px', backgroundColor: '#0f172a', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0 }}>
              <span style={{ fontWeight: 'bold' }}>RDO DETALHADO — {formatarDataExibicao(diarioSelecionado.data_diario)}</span>
              <button onClick={() => setDiarioSelecionado(null)} style={{ backgroundColor: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}><X style={{ width: '18px' }} /></button>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div><strong>Obra Vinculada:</strong> {diarioSelecionado.nome_obra}</div>
              <div><strong>Equipe Responsável:</strong> {diarioSelecionado.equipe || 'Geral'}</div>
              <div><strong>Gestor Responsável:</strong> {diarioSelecionado.nome_gestor || 'Não informado'}</div>
              <div><strong>Status Operacional:</strong> {renderizarBadgeStatusOperacional(diarioSelecionado.status_operacional)}</div>
              
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><Users style={{ width: '15px' }} /> Efetivo Presente ({diarioSelecionado.total_efetivo || 0})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {diarioSelecionado.nomes_efetivo ? diarioSelecionado.nomes_efetivo.split(/[\n,]+/).map((n, i) => (
                    <span key={i} style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>👤 {n.trim().toUpperCase()}</span>
                  )) : <span style={{ color: '#94a3b8' }}>Nenhum colaborador listado.</span>}
                </div>
              </div>

              <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', backgroundColor: '#fffbe3' }}>
                <div style={{ fontWeight: 'bold', color: '#b45309', marginBottom: '6px' }}>Resumo dos Serviços:</div>
                <div style={{ whiteSpace: 'pre-line' }}>{diarioSelecionado.servicos_resumo || 'Sem registros.'}</div>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>Observações:</div>
                <div>{diarioSelecionado.observacoes || 'Sem observações.'}</div>
              </div>
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {isMaster && (
                <button onClick={() => setModalExcluir(diarioSelecionado)} style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Excluir RDO
                </button>
              )}
              <button onClick={() => setDiarioSelecionado(null)} style={{ padding: '6px 16px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {modalExcluir && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 210, padding: '12px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '6px', width: '100%', maxWidth: '400px', padding: '16px', border: '1px solid #cbd5e1' }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#991b1b' }}>Excluir o Diário nº {modalExcluir.id}?</h3>
            <p style={{ color: '#334155', fontSize: '12px', margin: '0 0 16px 0' }}>
              Tem certeza de que deseja excluir o diário da obra <strong>{modalExcluir.nome_obra}</strong> do dia <strong>{formatarDataExibicao(modalExcluir.data_diario)}</strong>? Esta ação não poderá ser desfeita.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setModalExcluir(null)} style={{ padding: '6px 12px', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleExcluirRdo} disabled={processandoAcao} style={{ padding: '6px 12px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE FOTOS DA ATIVIDADE */}
      {fotosModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '12px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '6px', width: '100%', maxWidth: '600px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '14px' }}>Fotos — {fotosModal.descricao}</h3>
              <button onClick={() => setFotosModal(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><X style={{ width: '18px' }} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '8px' }}>
              {fotosModal.fotos.map((f, idx) => (
                <img 
                  key={idx} 
                  src={f.url || f} 
                  alt="Foto atividade" 
                  onClick={() => setImagemZoom(f.url || f)} 
                  style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid #cbd5e1' }} 
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ZOOM DA FOTO */}
      {imagemZoom && (
        <div onClick={() => setImagemZoom(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, cursor: 'pointer' }}>
          <img src={imagemZoom} alt="Zoom" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '4px' }} />
        </div>
      )}

    </div>
  );
}