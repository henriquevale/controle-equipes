import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { 
  BarChart3, 
  Users, 
  Filter, 
  Download, 
  Layers, 
  Package, 
  X
} from 'lucide-react';
import { Chart as ChartComponent } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  BarController,
  LineController,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  PointElement, 
  LineElement, 
  BarController,
  LineController,
  Title, 
  Tooltip, 
  Legend
);

const API_URL = 'http://localhost:3001/api';

const ABAS = [
  { key: 'ATIVIDADES', label: 'Produção por atividade', icon: Layers },
  { key: 'MATERIAIS', label: 'Consumo de materiais', icon: Package }
];

export default function HistoricoDiarios({ id, cargo }) {
  const [abaAtiva, setAbaAtiva] = useState('ATIVIDADES');
  
  const [obrasSelecionadas, setObrasSelecionadas] = useState([]);
  const [isOpenObras, setIsOpenObras] = useState(false);
  
  const [tiposSelecionados, setTiposSelecionados] = useState([]);
  const [isOpenTipos, setIsOpenTipos] = useState(false);
  
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [statusFiltro, setStatusFiltro] = useState(''); 
  const [statusOperacionalFiltro, setStatusOperacionalFiltro] = useState(''); 
  const [idGestorFiltro, setIdGestorFiltro] = useState(''); 

  const [tiposDisponiveis, setTiposDisponiveis] = useState([]);
  const [obras, setObras] = useState([]);
  const [gestores, setGestores] = useState([]); 
  const [listaDiarios, setListaDiarios] = useState([]);
  const [mapaMedias, setMapaMedias] = useState({});
  const [loading, setLoading] = useState(false);

  const [diarioSelecionado, setDiarioSelecionado] = useState(null);
  const [modalExcluir, setModalExcluir] = useState(null);
  const [processandoAcao, setProcessandoAcao] = useState(false);

  const cargoUpper = cargo ? String(cargo).toUpperCase() : '';
  const isMaster = cargoUpper === 'MASTER' || cargoUpper === 'ADMIN' || cargoUpper === 'RH';

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

  const buscarHistorico = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const endpoint = abaAtiva === 'ATIVIDADES' 
        ? `${API_URL}/gestor/historico-diarios`
        : `${API_URL}/gestor/historico-materiais`;

      const res = await axios.get(endpoint, {
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
      
      const lista = Array.isArray(res.data) ? res.data : (res.data.lista || res.data.diarios || res.data.dados || []);
      setListaDiarios(lista);
      setMapaMedias(res.data?.media_outras_obras && typeof res.data.media_outras_obras === 'object' ? res.data.media_outras_obras : {});
    } catch (err) {
      console.error("Erro ao buscar histórico do banco:", err);
      setListaDiarios([]);
      setMapaMedias({});
    } finally {
      setLoading(false);
    }
  }, [id, cargo, abaAtiva, obrasSelecionadas, tiposSelecionados, dataInicio, dataFim, statusFiltro, statusOperacionalFiltro, idGestorFiltro]);

  useEffect(() => {
    buscarHistorico();
  }, [buscarHistorico]);

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

  // --- PARSER DE DADOS PARA EXTRAIR NOME E QUANTIDADE ---
  const extrairItemEQuantidade = (linha) => {
    if (!linha || !linha.trim()) return null;
    const formatado = linha.replace(/^[•\-*]\s*/, '').trim();
    
    let descricao = formatado;
    let quantidade = 0;

    if (formatado.includes(':')) {
      const parts = formatado.split(':');
      descricao = parts[0].trim();
      quantidade = parseFloat(parts[1].replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    } else if (/\(([^)]+)\)/.test(formatado)) {
      const match = formatado.match(/(.*?)\(([^)]+)\)/);
      if (match) {
        descricao = match[1].trim();
        quantidade = parseFloat(match[2].replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
      }
    } else {
      quantidade = 1;
    }

    return { descricao: descricao || 'Item', quantidade };
  };

  // --- CONVERSÃO E EXTRAÇÃO DE ATIVIDADES ---
  const atividadesExtraidas = useMemo(() => {
    return listaDiarios.flatMap(rdo => {
      if (rdo.atividades && Array.isArray(rdo.atividades)) {
        return rdo.atividades.map(a => ({
          descricao: a.descricao || a.nome || a.atividade || 'Atividade sem nome',
          quantidade: parseFloat(a.quantidade || a.qtd || 0) || 0,
          unidade: a.unidade || 'UN',
          rdo
        }));
      }
      if (!rdo.servicos_resumo) return [];
      
      return rdo.servicos_resumo.split(/[\n,]+/).map(linha => {
        const item = extrairItemEQuantidade(linha);
        return item ? { ...item, unidade: 'UN', rdo } : null;
      }).filter(Boolean);
    });
  }, [listaDiarios]);

  // --- CONVERSÃO E EXTRAÇÃO DE MATERIAIS ---
  const materiaisExtraidos = useMemo(() => {
    return listaDiarios.flatMap(rdo => {
      const mat = rdo.materiais || rdo.materiais_resumo || rdo.insumos || rdo.insumos_resumo;
      if (!mat) return [];

      if (Array.isArray(mat)) {
        return mat.map(m => ({
          descricao: m.descricao || m.nome || m.material || 'Material sem nome',
          quantidade: parseFloat(m.quantidade || m.qtd || 0) || 0,
          unidade: m.unidade || m.und || 'UN',
          rdo
        }));
      }

      if (typeof mat === 'string') {
        return mat.split(/[\n,]+/).map(linha => {
          const item = extrairItemEQuantidade(linha);
          return item ? { ...item, unidade: 'UN', rdo } : null;
        }).filter(Boolean);
      }

      return [];
    });
  }, [listaDiarios]);

  const handleExportarPlanilha = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    
    if (abaAtiva === 'ATIVIDADES') {
      csvContent += "Data;Obra;Equipe;Status RDO;Status Operacional;Atividades (Qtd)\n";
      listaDiarios.forEach(rdo => {
        const servicos = (rdo.servicos_resumo || 'Sem registro').replace(/\n/g, ' | ').replace(/;/g, ',');
        csvContent += `"${formatarDataExibicao(rdo.data_diario)}";"${rdo.nome_obra || ''}";"${rdo.equipe || ''}";"${rdo.status_rdo || 'PENDENTE'}";"${rdo.status_operacional || 'NORMAL'}";"${servicos}"\n`;
      });
    } else {
      csvContent += "Data;Obra;Equipe;Material;Quantidade;Unidade;Status RDO\n";
      materiaisExtraidos.forEach(m => {
        csvContent += `"${formatarDataExibicao(m.rdo.data_diario)}";"${m.rdo.nome_obra || ''}";"${m.rdo.equipe || ''}";"${m.descricao}";"${m.quantidade}";"${m.unidade || 'UN'}";"${m.rdo.status_rdo || ''}"\n`;
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

  // --- MONTAGEM DO GRÁFICO DE ATIVIDADES ---
  const processarDadosAtividadesGrafico = () => {
    const totaisAtividades = {};
    let somaGeral = 0;

    atividadesExtraidas.forEach(a => {
      const nome = String(a.descricao || 'OUTROS').toUpperCase();
      totaisAtividades[nome] = (totaisAtividades[nome] || 0) + (Number(a.quantidade) || 0);
      somaGeral += (Number(a.quantidade) || 0);
    });

    const labels = Object.keys(totaisAtividades);
    const mediaValores = labels.map(label => mapaMedias[label] || 0);

    return {
      dicionarioItens: totaisAtividades,
      totalGeral: somaGeral,
      chartData: {
        labels: labels,
        datasets: [
          {
            type: 'bar',
            label: 'Quantidade Total Produzida',
            data: Object.values(totaisAtividades),
            backgroundColor: '#10b981', 
            borderRadius: 4,
          },
          {
            type: 'line',
            label: 'Média Outras Obras (Por Atividade)',
            data: mediaValores,
            borderColor: '#f59e0b',
            backgroundColor: '#f59e0b',
            borderWidth: 2,
            pointRadius: 4,
            tension: 0.1,
            fill: false
          }
        ]
      }
    };
  };

  // --- MONTAGEM DO GRÁFICO DE MATERIAIS ---
  const processarDadosMateriaisGrafico = () => {
    const totaisMateriais = {};
    let somaGeral = 0;

    materiaisExtraidos.forEach(m => {
      const nome = String(m.descricao || 'OUTROS').toUpperCase();
      totaisMateriais[nome] = (totaisMateriais[nome] || 0) + (Number(m.quantidade) || 0);
      somaGeral += (Number(m.quantidade) || 0);
    });

    const labels = Object.keys(totaisMateriais);
    const mediaValores = labels.map(label => mapaMedias[label] || 0);

    return {
      dicionarioMateriais: totaisMateriais,
      totalGeralMateriais: somaGeral,
      chartDataMateriais: {
        labels: labels,
        datasets: [
          {
            type: 'bar',
            label: 'Quantidade Total Consumida',
            data: Object.values(totaisMateriais),
            backgroundColor: '#3b82f6', 
            borderRadius: 4,
          },
          {
            type: 'line',
            label: 'Média Outras Obras (Por Material)',
            data: mediaValores,
            borderColor: '#f59e0b',
            backgroundColor: '#f59e0b',
            borderWidth: 2,
            pointRadius: 4,
            tension: 0.1,
            fill: false
          }
        ]
      }
    };
  };

  const { chartData, dicionarioItens, totalGeral } = processarDadosAtividadesGrafico();
  const { chartDataMateriais, dicionarioMateriais, totalGeralMateriais } = processarDadosMateriaisGrafico();

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

  const renderizarBadgeStatusRdo = (statusRdo) => {
    const isFinalizado = String(statusRdo).toUpperCase().trim() === 'FINALIZADO';
    return (
      <span style={{
        padding: '3px 8px',
        borderRadius: '4px',
        fontWeight: 'bold',
        fontSize: '10px',
        backgroundColor: isFinalizado ? '#dcfce7' : '#fef9c3',
        color: isFinalizado ? '#15803d' : '#854d0e',
        border: isFinalizado ? '1px solid #86efac' : '1px solid #fef08a'
      }}>
        {isFinalizado ? '✓ CONCLUÍDO' : '⏳ PENDENTE'}
      </span>
    );
  };

  const renderizarBadgeStatusOperacional = (statusOp) => {
    const st = statusOp ? String(statusOp).toUpperCase().trim() : 'NORMAL';

    if (st.includes('NORMAL')) return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc' }}>✓ NORMAL</span>;
    if (st.includes('CHUVA') || st.includes('CHOVEU')) return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#e0e7ff', color: '#3730a3', border: '1px solid #a5b4fc' }}>🌧️ CHUVA</span>;
    if (st.includes('MATERIAL')) return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>⚠️ SEM MATERIAL</span>;
    if (st.includes('EQUIPAMENTO')) return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa' }}>⚙️ SEM EQUIPAMENTO</span>;
    if (st.includes('APOIO')) return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #86efac' }}>🤝 APOIO</span>;
    if (st.includes('SEM ATIVIDADE')) return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#f3f4f6', color: '#4b5563', border: '1px solid #d1d5db' }}>⏸️ SEM ATIVIDADE</span>;
    if (st.includes('FOLGA') || st.includes('FDS')) return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde047' }}>🏖️ FOLGA / FDS</span>;

    return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}>{st}</span>;
  };

  return (
    <div style={{ padding: '16px', fontFamily: 'sans-serif', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#f8fafc', minHeight: '100vh', boxSizing: 'border-box' }}>
      
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

      {/* FILTROS DE HISTÓRICO */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
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

        <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '12px', paddingTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleExportarPlanilha}
            disabled={listaDiarios.length === 0}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '11px',
              fontWeight: '600',
              cursor: listaDiarios.length === 0 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              borderRadius: '4px',
              opacity: listaDiarios.length === 0 ? 0.5 : 1
            }}
            title="Baixar dados filtrados em formato CSV"
          >
            <Download style={{ width: '13px', height: '13px' }} /> Exportar Planilha (CSV)
          </button>
        </div>
      </div>

      {/* --- ABA ATIVIDADES --- */}
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
                  <div style={{ position: 'relative', width: '100%', minHeight: '320px' }}>
                    <ChartComponent 
                      type='bar'
                      data={chartData} 
                      options={{ 
                        responsive: true, 
                        maintainAspectRatio: false, 
                        plugins: { 
                          legend: { display: true, position: 'top' } 
                        } 
                      }} 
                    />
                  </div>
                </div>
              )}

              <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0f172a' }}>Listagem Detalhada dos Diários de Obra</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', color: '#334155', textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 8px', border: '1px solid #cbd5e1' }}>DATA / OBRA</th>
                        <th style={{ padding: '10px 8px', border: '1px solid #cbd5e1' }}>EQUIPE</th>
                        <th style={{ padding: '10px 8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>STATUS RDO</th>
                        <th style={{ padding: '10px 8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>STATUS OPERACIONAL</th>
                        <th style={{ padding: '10px 8px', border: '1px solid #cbd5e1' }}>ATIVIDADES E QUANTIDADES</th>
                        <th style={{ padding: '10px 8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listaDiarios.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: '#94a3b8' }}>Nenhum diário registrado no período.</td></tr>
                      ) : (
                        listaDiarios.map((rdo, i) => (
                          <tr key={`rdo-${i}`} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                            <td style={{ padding: '8px' }}>
                              <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{formatarDataExibicao(rdo.data_diario)}</div>
                              <div style={{ fontSize: '10px', color: '#2563eb', fontWeight: 'bold' }}>[{rdo.codigo_obra || 'OBRA'}] {rdo.nome_obra}</div>
                            </td>
                            <td style={{ padding: '8px' }}>
                              <div style={{ fontWeight: 'bold', color: '#334155' }}>{rdo.equipe || 'Geral'}</div>
                              <div style={{ fontSize: '9px', color: '#64748b' }}>Gestor: {rdo.nome_gestor || '—'}</div>
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              {renderizarBadgeStatusRdo(rdo.status_rdo)}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              {renderizarBadgeStatusOperacional(rdo.status_operacional)}
                            </td>
                            <td style={{ padding: '8px' }}>
                              {rdo.servicos_resumo ? (
                                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '6px 8px', color: '#166534', fontWeight: '500', whiteSpace: 'pre-line' }}>
                                  {rdo.servicos_resumo}
                                </div>
                              ) : (
                                <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sem atividades lançadas</span>
                              )}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>
                              <button onClick={() => setDiarioSelecionado(rdo)} style={{ border: '1px solid #cbd5e1', backgroundColor: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '10px' }}>
                                Abrir RDO
                              </button>
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

      {/* --- ABA MATERIAIS --- */}
      {abaAtiva === 'MATERIAIS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loading ? (
            <div style={{ backgroundColor: '#fff', padding: '20px', textAlign: 'center', fontWeight: 'bold', color: '#64748b', borderRadius: '6px', border: '1px solid #cbd5e1' }}>Carregando consumo de materiais...</div>
          ) : (
            <>
              {chartDataMateriais.labels.length > 0 && (
                <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#1e293b', marginBottom: '12px' }}>
                    <BarChart3 style={{ width: '16px', color: '#3b82f6' }} /> CONSOLIDADO DE CONSUMO DE MATERIAIS NO PERÍODO
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '4px', marginBottom: '12px' }}>
                    {Object.entries(dicionarioMateriais).map(([material, total]) => (
                      <div key={material} style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderRight: '1px solid #cbd5e1', paddingRight: '8px' }}>
                        <span style={{ fontSize: '10px', color: '#475569', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{material}</span>
                        <span style={{ fontSize: '15px', color: '#0f172a', fontWeight: 'bold' }}>{total.toLocaleString('pt-BR')}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', backgroundColor: '#e2e8f0', padding: '8px', borderRadius: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#1e293b', fontWeight: 'bold' }}>TOTAL GERAL</span>
                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#2563eb' }}>{totalGeralMateriais.toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                  <div style={{ position: 'relative', width: '100%', minHeight: '320px' }}>
                    <ChartComponent 
                      type='bar'
                      data={chartDataMateriais} 
                      options={{ 
                        responsive: true, 
                        maintainAspectRatio: false, 
                        plugins: { 
                          legend: { display: true, position: 'top' } 
                        } 
                      }} 
                    />
                  </div>
                </div>
              )}

              <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0f172a' }}>Listagem detalhada de materiais</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', color: '#334155', textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 8px', border: '1px solid #cbd5e1' }}>DATA</th>
                        <th style={{ padding: '10px 8px', border: '1px solid #cbd5e1' }}>OBRA</th>
                        <th style={{ padding: '10px 8px', border: '1px solid #cbd5e1' }}>EQUIPE</th>
                        <th style={{ padding: '10px 8px', border: '1px solid #cbd5e1' }}>MATERIAL / INSUMO</th>
                        <th style={{ padding: '10px 8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>QTD</th>
                        <th style={{ padding: '10px 8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materiaisExtraidos.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: '#94a3b8' }}>Nenhum material registrado no período.</td></tr>
                      ) : (
                        materiaisExtraidos.map((m, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                            <td style={{ padding: '8px', fontWeight: 'bold' }}>{formatarDataExibicao(m.rdo.data_diario)}</td>
                            <td style={{ padding: '8px' }}>{m.rdo.nome_obra}</td>
                            <td style={{ padding: '8px' }}>{m.rdo.equipe || 'Geral'}</td>
                            <td style={{ padding: '8px', fontWeight: 'bold' }}>{m.descricao}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{m.quantidade} {m.unidade || 'UN'}</td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>
                              <button onClick={() => setDiarioSelecionado(m.rdo)} style={{ border: '1px solid #cbd5e1', backgroundColor: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '10px' }}>
                                Abrir RDO
                              </button>
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
              <div><strong>Status do RDO:</strong> {renderizarBadgeStatusRdo(diarioSelecionado.status_rdo)}</div>
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

      {/* MODAL EXCLUIR */}
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

    </div>
  );
}