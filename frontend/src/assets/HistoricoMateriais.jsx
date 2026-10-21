import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Eye, BarChart3, Package, Users, Filter } from 'lucide-react';
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
//const API_URL = 'https://api-controle-impacto.duckdns.org/api';

export default function HistoricoMateriais({ id, cargo }) {
  const [idObra, setIdObra] = useState('');
  const [tiposSelecionados, setTiposSelecionados] = useState([]);
  const [isOpenTipos, setIsOpenTipos] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [statusRdo, setStatusRdo] = useState('');
  const [statusOperacionalFiltro, setStatusOperacionalFiltro] = useState('');
  const [idGestorFiltro, setIdGestorFiltro] = useState('');
  
  const [tiposDisponiveis, setTiposDisponiveis] = useState([]);
  const [obras, setObras] = useState([]);
  const [gestores, setGestores] = useState([]);
  const [listaDiarios, setListaDiarios] = useState([]);
  const [diarioSelecionado, setDiarioSelecionado] = useState(null);
  const [loading, setLoading] = useState(false);

  const cargoUpper = cargo ? String(cargo).toUpperCase() : '';
  const isMaster = cargoUpper === 'MASTER' || cargoUpper === 'ADMIN' || cargoUpper === 'RH';

  // 1️⃣ CARREGAR TIPOS DE OBRA DINÂMICOS CONTEXTUALIZADOS AO PERFIL
  useEffect(() => {
    const carregarTiposObra = async () => {
      if (!id) return;
      try {
        const res = await axios.get(`${API_URL}/gestor/tipos-obra`, {
          params: { id, cargo }
        });
        setTiposDisponiveis(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error("Erro ao carregar tipos de obra:", e);
      }
    };

    carregarTiposObra();
  }, [id, cargo]);

  // 2️⃣ EFFECT PARA OBRAS DO FILTRO
  useEffect(() => {
    const carregarObrasFiltro = async () => {
      if (!id) return;
      try {
        const res = await axios.get(`${API_URL}/gestor/obras-ativas`, {
          params: { 
            id: id, 
            cargo: cargo,
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

  // 3️⃣ EFFECT PARA CARREGAR GESTORES (SOMENTE PERFIL MASTER/ADMIN/RH)
  useEffect(() => {
    const carregarGestores = async () => {
      try {
        const res = await axios.get(`${API_URL}/gestores`);
        setGestores(res.data || []);
      } catch (e) {
        console.error("Erro ao carregar gestores para filtro:", e);
      }
    };

    if (isMaster) {
      carregarGestores();
    }
  }, [isMaster]);

  // 4️⃣ FUNÇÃO PRINCIPAL DE BUSCA DO HISTÓRICO DE MATERIAIS
  const buscarHistoricoMateriais = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/gestor/historico-diarios`, {
        params: { 
          id: id,                  
          cargo: cargo,            
          id_obra: idObra || undefined, 
          tipo_obra: tiposSelecionados.length > 0 ? tiposSelecionados.join(',') : undefined,
          data_inicio: dataInicio || undefined, 
          data_fim: dataFim || undefined,
          status_rdo: statusRdo || undefined,
          status_operacional: statusOperacionalFiltro || undefined,
          id_gestor_filtro: idGestorFiltro || undefined,
          id_gestor: idGestorFiltro || undefined
        }
      });
      
      const lista = Array.isArray(res.data) ? res.data : (res.data.diarios || res.data.dados || []);
      setListaDiarios(lista);
    } catch (err) {
      console.error("Erro ao buscar histórico de materiais do banco:", err);
      setListaDiarios([]);
    } finally {
      setLoading(false);
    }
  }, [id, cargo, idObra, tiposSelecionados, dataInicio, dataFim, statusRdo, statusOperacionalFiltro, idGestorFiltro]);

  // DISPARO AUTOMÁTICO DA BUSCA AO MONTAR E SEMPRE QUE OS FILTROS MUDAREM
  useEffect(() => {
    buscarHistoricoMateriais();
  }, [buscarHistoricoMateriais]);

  // MARCAR/DESMARCAR ITEM NO CHECKBOX
  const handleToggleTipo = (tipo) => {
    setTiposSelecionados(prev => 
      prev.includes(tipo) 
        ? prev.filter(t => t !== tipo) 
        : [...prev, tipo]
    );
  };

  const formatarDataExibicao = (dataRaw) => {
    if (!dataRaw) return '--/--/----';
    const dataLimpa = dataRaw.includes('T') ? dataRaw.split('T')[0] : dataRaw;
    const [ano, mes, dia] = dataLimpa.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  // 🔄 PROCESSAMENTO EXCLUSIVO PARA MATERIAIS APONTADOS
  const processarDadosMateriais = () => {
    const totaisMateriais = {};
    let somaGeralMateriais = 0;

    listaDiarios.forEach(rdo => {
      const campoMateriais = rdo.materiais_resumo || rdo.servicos_resumo_materials; 
      
      if (campoMateriais) {
        const lines = campoMateriais.split(/[\n,]+/);
        lines.forEach(linha => {
          if (!linha.trim()) return;
          const textoLimpo = inlineTexto => inlineTexto.replace(/^[•\-*]\s*/, '').trim();
          const formatado = textoLimpo(linha);
          const indiceDoisPontos = formatado.lastIndexOf(':');
          
          if (indiceDoisPontos !== -1) {
            const nomeMaterial = formatado.substring(0, indiceDoisPontos).trim().toUpperCase();
            const valorTexto = formatado.substring(indiceDoisPontos + 1).trim();
            const qtd = parseFloat(valorTexto.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;

            if (nomeMaterial && qtd > 0) {
              totaisMateriais[nomeMaterial] = (totaisMateriais[nomeMaterial] || 0) + qtd;
              somaGeralMateriais += qtd;
            }
          }
        });
      }
    });

    const labels = Object.keys(totaisMateriais);
    return {
      dicionarioItens: totaisMateriais,
      totalGeral: somaGeralMateriais,
      chartData: {
        labels: labels,
        datasets: [{
          label: 'Quantidade Total Consumida/Utilizada',
          data: Object.values(totaisMateriais),
          backgroundColor: '#ea580c', 
          borderRadius: 4,
        }]
      }
    };
  };

  const { chartData, dicionarioItens, totalGeral } = processarDadosMateriais();

  const opcoesGrafico = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, title: { display: false } },
    scales: { y: { beginAtZero: true } }
  };

  const renderizarBadgeStatus = (status) => {
    const isFinalizado = String(status).toUpperCase() === 'FINALIZADO';
    return (
      <span style={{
        padding: '3px 10px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 'bold',
        display: 'inline-block',
        backgroundColor: isFinalizado ? '#f0fdf4' : '#fffbeb',
        color: isFinalizado ? '#059669' : '#d97706',
        border: `1px solid ${isFinalizado ? '#4ade80' : '#fcd34d'}`
      }}>
        {status || 'PENDENTE'}
      </span>
    );
  };

  const renderizarBadgeStatusOperacional = (statusOp) => {
    const st = statusOp ? String(statusOp).toUpperCase().trim() : 'NORMAL';

    if (st === 'NORMAL') {
      return (
        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc' }}>
          NORMAL
        </span>
      );
    }
    if (st.includes('CHOVEU') || st.includes('CHUVA')) {
      return (
        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#e0e7ff', color: '#3730a3', border: '1px solid #a5b4fc' }}>
          🌧️ {st}
        </span>
      );
    }
    if (st.includes('MATERIAL') || st.includes('INSUMO')) {
      return (
        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
          ⚠️ {st}
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
    <div style={{ padding: '20px', fontFamily: 'sans-serif', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#f8fafc', minHeight: '100vh', boxSizing: 'border-box' }}>
      
      {/* SEÇÃO DE FILTROS RESPONSIVA */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: '#1e293b', marginBottom: '12px', fontSize: '12px' }}>
          <Filter style={{ width: '14px', height: '14px', color: '#ea580c' }} /> FILTROS DE MATERIAIS
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', alignItems: 'flex-start' }}>
          
          {/* Gestor / Encarregado */}
          {isMaster && (
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>
                GESTOR / ENCARREGADO
              </label>
              <select 
                value={idGestorFiltro} 
                onChange={e => setIdGestorFiltro(e.target.value)} 
                style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', color: '#334155', fontSize: '12px' }}
              >
                <option value="">-- Todos os Gestores --</option>
                {gestores.map(g => (
                  <option key={g.id_usuario || g.id} value={g.id_usuario || g.id}>
                    {g.nome_gestor || g.nome || g.nome_usuario}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* FILTRO TIPO DE OBRA */}
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>
              TIPO DE OBRA ({tiposSelecionados.length > 0 ? `${tiposSelecionados.length} sel.` : 'TODOS'})
            </label>
            
            <button
              type="button"
              onClick={() => setIsOpenTipos(!isOpenTipos)}
              style={{
                width: '100%',
                height: '32px',
                padding: '0 8px',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                backgroundColor: '#fff',
                color: '#334155',
                fontSize: '12px',
                textAlign: 'left',
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center',
                cursor: 'pointer'
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tiposSelecionados.length === 0 
                  ? '-- Todos os Tipos --' 
                  : tiposSelecionados.join(', ')}
              </span>
              <span style={{ fontSize: '10px', color: '#64748b' }}>{isOpenTipos ? '▲' : '▼'}</span>
            </button>

            {isOpenTipos && (
              <div 
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  marginTop: '4px',
                  backgroundColor: '#fff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  padding: '6px'
                }}
              >
                <div 
                  onClick={() => setTiposSelecionados([])}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    color: '#ea580c',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f1f5f9',
                    marginBottom: '4px'
                  }}
                >
                  {tiposSelecionados.length > 0 ? 'Limpar seleção' : 'Todos os Tipos'}
                </div>

                {tiposDisponiveis.map(tipo => {
                  const checked = tiposSelecionados.includes(tipo);
                  return (
                    <label
                      key={tipo}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 8px',
                        fontSize: '12px',
                        color: '#334155',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        backgroundColor: checked ? '#fff7ed' : 'transparent'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleTipo(tipo)}
                        style={{ cursor: 'pointer', accentColor: '#ea580c' }}
                      />
                      {tipo}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Obra Vinculada */}
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>
              OBRA VINCULADA
            </label>
            <select 
              value={idObra} 
              onChange={e => setIdObra(e.target.value)} 
              style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', color: '#334155', fontSize: '12px' }}
            >
              <option value="">-- Todas as Obras --</option>
              {obras.map(o => <option key={o.id} value={o.id}>[{o.codigo_obra || 'ID: '+o.id}] {o.nome_obra}</option>)}
            </select>
          </div>

          {/* Status do RDO */}
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>
              STATUS DO RDO
            </label>
            <select 
              value={statusRdo} 
              onChange={e => setStatusRdo(e.target.value)} 
              style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', color: '#334155', fontSize: '12px' }}
            >
              <option value="">-- Todos --</option>
              <option value="PENDENTE">PENDENTE</option>
              <option value="FINALIZADO">FINALIZADO</option>
            </select>
          </div>

          {/* STATUS OPERACIONAL */}
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>
              STATUS OPERACIONAL
            </label>
            <select 
              value={statusOperacionalFiltro} 
              onChange={e => setStatusOperacionalFiltro(e.target.value)} 
              style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', color: '#334155', fontSize: '12px' }}
            >
              <option value="">-- Todos os Status --</option>
              <option value="NORMAL">NORMAL</option>
              <option value="CHOVEU">CHOVEU / CHUVA</option>
              <option value="MATERIAL">SEM INSUMO / MATERIAL</option>
              <option value="OUTROS">OUTROS</option>
            </select>
          </div>

          {/* Data Inicial */}
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>
              DATA INICIAL
            </label>
            <input 
              type="date" 
              value={dataInicio} 
              onChange={e => setDataInicio(e.target.value)} 
              style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#334155', fontSize: '12px' }} 
            />
          </div>

          {/* Data Final */}
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>
              DATA FINAL
            </label>
            <input 
              type="date" 
              value={dataFim} 
              onChange={e => setDataFim(e.target.value)} 
              style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#334155', fontSize: '12px' }} 
            />
          </div>

        </div>
      </div>

      {/* GRÁFICO */}
      {listaDiarios.length > 0 && chartData.labels.length > 0 ? (
        <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#1e293b' }}>
            <BarChart3 style={{ width: '16px', color: '#ea580c' }} /> CONSUMO ACUMULADO DE MATERIAIS NO PERÍODO
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', backgroundColor: '#fff7ed', padding: '12px', borderRadius: '4px', border: '1px solid #ffedd5' }}>
            {Object.entries(dicionarioItens).map(([material, total]) => (
              <div key={material} style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderRight: '1px solid #ffedd5', paddingRight: '8px', minWidth: '100px' }}>
                <span style={{ fontSize: '10px', color: '#c2410c', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={material}>{material}</span>
                <span style={{ fontSize: '16px', color: '#7c2d12', fontWeight: 'bold' }}>{total.toLocaleString('pt-BR')}</span>
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '4px', backgroundColor: '#ffedd5', margin: '-12px -12px -12px 0', padding: '12px', borderRadius: '0 4px 4px 0', justifyContent: 'center' }}>
              <span style={{ fontSize: '10px', color: '#7c2d12', fontWeight: 'bold' }}>VOLUME TOTAL</span>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#ea580c' }}>{totalGeral.toLocaleString('pt-BR')}</span>
            </div>
          </div>

          <div style={{ height: '240px', position: 'relative', marginTop: '8px' }}>
            <Bar data={chartData} options={opcoesGrafico} />
          </div>
        </div>
      ) : listaDiarios.length > 0 && (
        <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
          Registros encontrados, mas nenhum material quantificado foi detectado para plotagem do gráfico.
        </div>
      )}

      {/* TABELA E CARDS DE HISTÓRICO */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', color: '#1e293b' }}>
          HISTÓRICO DE MATERIAIS UTILIZADOS POR APONTAMENTO (RDO)
        </div>
        
        <div style={{ padding: '12px' }}>
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>Consultando dados de materiais aplicados...</div>
          ) : listaDiarios.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Nenhum lançamento de material localizado com as configurações atuais.</div>
          ) : (
            <>
              {/* CARDS MOBILE */}
              <div className="mobile-cards-view" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {listaDiarios.map((rdo, index) => (
                  <div key={rdo.id || index} style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '12px', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#0f172a' }}>{formatarDataExibicao(rdo.data_diario)}</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {renderizarBadgeStatusOperacional(rdo.status_operacional)}
                        {renderizarBadgeStatus(rdo.status_rdo)}
                      </div>
                    </div>
                    
                    <div style={{ fontSize: '12px', color: '#334155' }}>
                      <strong>Obra:</strong> {rdo.nome_obra}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                      <div>
                        <strong>Equipe:</strong>{' '}
                        <span style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                          {rdo.equipe || 'GERAL'}
                        </span>
                      </div>
                      <div>
                        <span style={{ backgroundColor: '#fff7ed', color: '#ea580c', border: '1px solid #ffedd5', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                          {rdo.total_efetivo || 0} { (rdo.total_efetivo || 0) === 1 ? 'Colaborador' : 'Colaboradores'}
                        </span>
                      </div>
                    </div>

                    {(rdo.materiais_resumo || rdo.servicos_resumo_materials) && (
                      <div style={{ fontSize: '11px', color: '#ea580c', backgroundColor: '#fff7ed', border: '1px solid #ffedd5', padding: '8px', borderRadius: '4px', whiteSpace: 'pre-line', fontWeight: '500' }}>
                        {rdo.materiais_resumo || rdo.servicos_resumo_materials}
                      </div>
                    )}

                    <button 
                      onClick={() => setDiarioSelecionado(rdo)} 
                      style={{ marginTop: '4px', width: '100%', height: '32px', border: '1px solid #cbd5e1', backgroundColor: '#fff', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 'bold', color: '#ea580c' }}
                    >
                      <Eye style={{ width: '14px' }} /> Detalhes
                    </button>
                  </div>
                ))}
              </div>

              {/* TABELA DESKTOP */}
              <div className="desktop-table-view" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9' }}>
                      <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#475569' }}>DATA</th>
                      <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#475569' }}>EQUIPE</th>
                      <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#475569', textAlign: 'center' }}>STATUS RDO</th>
                      <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#475569', textAlign: 'center' }}>STATUS OPERACIONAL</th>
                      <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#475569' }}>NOME DA OBRA</th>
                      <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#475569', textAlign: 'center' }}>EFETIVO ATIVO</th>
                      <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#475569' }}>MATERIAIS RELATADOS</th>
                      <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#475569', textAlign: 'center', width: '80px' }}>VER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaDiarios.map((rdo, index) => {
                      const totalEfetivo = rdo.total_efetivo || 0;
                      return (
                        <tr key={rdo.id || index} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '10px', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#0f172a' }}>
                            {formatarDataExibicao(rdo.data_diario)}
                          </td>
                          <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              color: '#334155',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontWeight: 'bold',
                              fontSize: '11px',
                              display: 'inline-block'
                            }}>
                              {rdo.equipe || 'GERAL'}
                            </span>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {renderizarBadgeStatus(rdo.status_rdo)}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {renderizarBadgeStatusOperacional(rdo.status_operacional)}
                          </td>
                          <td style={{ padding: '10px', fontWeight: '500' }}>
                            {rdo.nome_obra}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{
                              backgroundColor: '#fff7ed',
                              color: '#ea580c',
                              border: '1px solid #ffedd5',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontWeight: 'bold',
                              fontSize: '11px',
                              display: 'inline-block'
                            }}>
                              {totalEfetivo} {totalEfetivo === 1 ? 'Colaborador' : 'Colaboradores'}
                            </span>
                          </td>
                          <td style={{ padding: '10px', color: '#ea580c', fontSize: '11px', fontWeight: '500' }}>
                            {rdo.materiais_resumo || rdo.servicos_resumo_materials ? (
                              <div style={{ whiteSpace: 'pre-line', lineHeight: '1.4' }}>
                                {rdo.materiais_resumo || rdo.servicos_resumo_materials}
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>Sem materiais descritos</span>
                            )}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <button onClick={() => setDiarioSelecionado(rdo)} style={{ border: '1px solid #cbd5e1', backgroundColor: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Eye style={{ width: '14px', color: '#ea580c' }} /> Detalhes
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* MODAL DE VISUALIZAÇÃO */}
      {diarioSelecionado && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '6px', width: '100%', maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto', border: '1px solid #94a3b8' }}>
            <div style={{ padding: '12px 16px', backgroundColor: '#7c2d12', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}><Package style={{width: '14px'}}/> MATERIAIS DO RDO — {formatarDataExibicao(diarioSelecionado.data_diario)}</span>
              <button onClick={() => setDiarioSelecionado(null)} style={{ backgroundColor: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><strong>Obra Vinculada:</strong> {diarioSelecionado.nome_obra}</div>
                {renderizarBadgeStatus(diarioSelecionado.status_rdo)}
              </div>

              <div><strong>Responsável/Gestor:</strong> {diarioSelecionado.nome_gestor || diarioSelecionado.gestor || 'Não informado'}</div>
              <div><strong>Equipe Responsável:</strong> {diarioSelecionado.equipe || 'Geral'}</div>
              <div><strong>Status Operacional:</strong> {renderizarBadgeStatusOperacional(diarioSelecionado.status_operacional)}</div>

              {/* COLABORADORES DA EQUIPE */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                <div style={{ backgroundColor: '#f1f5f9', color: '#334155', padding: '6px 10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users style={{ width: '14px', color: '#ea580c' }} /> Colaboradores na Equipe ({diarioSelecionado.total_efetivo || 0})
                </div>
                <div style={{ padding: '10px', backgroundColor: '#fff' }}>
                  {diarioSelecionado.nomes_efetivo ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {diarioSelecionado.nomes_efetivo.split(', ').map((nome, i) => (
                        <span key={i} style={{ backgroundColor: '#fff7ed', border: '1px solid #ffedd5', color: '#c2410c', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>
                          👤 {nome}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Nenhum funcionário alocado nesta equipe para esta data.</span>
                  )}
                </div>
              </div>
              
              <div style={{ border: '1px solid #ffedd5', borderRadius: '4px' }}>
                <div style={{ backgroundColor: '#ffedd5', color: '#7c2d12', padding: '6px 10px', fontWeight: 'bold' }}>Listagem de Materiais e Insumos Aplicados</div>
                <div style={{ padding: '10px', whiteSpace: 'pre-line', lineHeight: '1.6', fontWeight: '500', color: '#431407' }}>
                  {diarioSelecionado.materiais_resumo || diarioSelecionado.servicos_resumo_materials || "Nenhum insumo ou tacha mapeada para este diário."}
                </div>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '10px', backgroundColor: '#fafafa' }}>
                <strong>Observações Gerais do RDO:</strong>
                <p style={{ margin: '4px 0 0 0', fontStyle: 'italic', color: '#475569' }}>{diarioSelecionado.observacoes || "Sem observações registradas."}</p>
              </div>
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setDiarioSelecionado(null)} style={{ padding: '6px 14px', backgroundColor: '#ea580c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Fechar Janela</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-table-view {
            display: none !important;
          }
          .mobile-cards-view {
            display: flex !important;
          }
        }
        @media (min-width: 769px) {
          .desktop-table-view {
            display: block !important;
          }
          .mobile-cards-view {
            display: none !important;
          }
        }
      `}</style>

    </div>
  );
}