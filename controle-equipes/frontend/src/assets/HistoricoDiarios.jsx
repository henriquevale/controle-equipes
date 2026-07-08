import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Search, Eye, BarChart3, Users } from 'lucide-react'; // Adicionado o ícone Users
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

// Em vez de: const API_URL = 'http://localhost:3001/api';
const API_URL = 'https://controle-equipes.onrender.com'; //i

// Recebe 'id' (da coluna ID da tabela usuario_sistema) e 'cargo'
export default function HistoricoDiarios({ id, cargo }) {
  const [idObra, setIdObra] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [obras, setObras] = useState([]);
  const [listaDiarios, setListaDiarios] = useState([]);
  const [diarioSelecionado, setDiarioSelecionado] = useState(null);
  const [loading, setLoading] = useState(false);

  // 🛠️ Busca amarrada ao ID único do usuário
  // 1️⃣ FUNÇÃO DO HISTÓRICO (Resolve o Erro 400 da linha 47)
  const buscarHistorico = useCallback(async () => {
    if (!id) return; // 'id' numérico vindo do App.jsx

    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/gestor/historico-diarios`, {
        // Dentro de buscarHistorico no HistoricoDiarios.jsx:
        params: { 
          id: id,                  // O número (17) que veio da prop 'id'
          cargo: cargo,            // O cargo ("GESTOR")
          id_obra: idObra || undefined, 
          data_inicio: dataInicio || undefined, 
          data_fim: dataFim || undefined 
        }
      });
      
      setListaDiarios(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Erro ao buscar histórico do banco:", err);
      setListaDiarios([]);
    } finally {
      setLoading(false);
    }
  }, [id, cargo, idObra, dataInicio, dataFim]);


  // 2️⃣ EFFECT DAS OBRAS DO FILTRO (Resolve o Erro 404 da linha 65)
  useEffect(() => {
    const carregarObrasFiltro = async () => {
      try {
        // 🔍 CORRIGIDO: Apontando para a rota real e existente do back-end
        const res = await axios.get(`${API_URL}/gestor/obras-ativas`, {
          params: { 
            id: id,     // 🔍 CORRIGIDO: Enviando como 'id'
            cargo: cargo 
          }
        });
        setObras(res.data || []);
      } catch (e) {
        console.error("Erro ao carregar obras para filtro:", e);
      }
    };
    
    if (id) carregarObrasFiltro();
  }, [id, cargo]);

  // CORRIGIDO: Carrega as obras usando a variável correta 'id'
  useEffect(() => {
    const carregarObras = async () => {
      if (!id) return; // Corrigido aqui de id_usuario para id
      try {
        const res = await axios.get(`${API_URL}/gestor/obras-ativas`, { 
          params: { id: id, cargo } // Passa o id correto para a API
        });
        setObras(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Erro ao inicializar obras:", err);
      }
    };

    carregarObras();
  }, [id, cargo]);

  // Gatilho inicial ao validar o ID
  useEffect(() => {
    if (id) {
      buscarHistorico();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); 

  const formatarDataExibicao = (dataRaw) => {
    if (!dataRaw) return '--/--/----';
    const dataLimpa = dataRaw.includes('T') ? dataRaw.split('T')[0] : dataRaw;
    const [ano, mes, dia] = dataLimpa.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const processarDadosAtividades = () => {
    const totaisAtividades = {};
    let somaGeral = 0;

    listaDiarios.forEach(rdo => {
      if (rdo.servicos_resumo) {
        const lines = rdo.servicos_resumo.split(/[\n,]+/);
        lines.forEach(linha => {
          if (!linha.trim()) return;
          const textoLimpo = inlineTexto => inlineTexto.replace(/^[•\-*]\s*/, '').trim();
          const formatado = textoLimpo(linha);
          const indiceDoisPontos = formatado.lastIndexOf(':');
          
          if (indiceDoisPontos !== -1) {
            const nomeAtividade = formatado.substring(0, indiceDoisPontos).trim().toUpperCase();
            const valorTexto = formatado.substring(indiceDoisPontos + 1).trim();
            const qtd = parseFloat(valorTexto.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;

            if (nomeAtividade && qtd > 0) {
              totaisAtividades[nomeAtividade] = (totaisAtividades[nomeAtividade] || 0) + qtd;
              somaGeral += qtd;
            }
          }
        });
      }
    });

    const labels = Object.keys(totaisAtividades);
    const totalGeralBackend = listaDiarios.reduce((sum, rdo) => sum + (parseFloat(rdo.total_quantidade_produzida) || 0), 0);
    return {
      dicionarioItens: totaisAtividades,
      totalGeral: totalGeralBackend || somaGeral,
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

  const { chartData, dicionarioItens, totalGeral } = processarDadosAtividades();

  const opcoesGrafico = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, title: { display: false } },
    scales: { y: { beginAtZero: true } }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      
      {/* SEÇÃO DE FILTROS */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>FILTRAR POR OBRA VINCULADA</label>
            <select value={idObra} onChange={e => setIdObra(e.target.value)} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff' }}>
              <option value="">-- Todas as Minhas Obras --</option>
              {obras.map(o => <option key={o.id} value={o.id}>[{o.codigo_obra || 'ID: '+o.id}] {o.nome_obra}</option>)}
            </select>
          </div>

          <div style={{ width: '140px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>DATA INICIAL</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
          </div>

          <div style={{ width: '140px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>DATA FINAL</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
          </div>

          <button onClick={buscarHistorico} style={{ height: '32px', padding: '0 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Search style={{ width: '14px' }} /> Filtrar
          </button>
        </div>
      </div>

      {/* PAINEL DO GRÁFICO */}
      {listaDiarios.length > 0 && chartData.labels.length > 0 ? (
        <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#1e293b' }}>
            <BarChart3 style={{ width: '16px', color: '#10b981' }} /> BALANÇO DE PRODUÇÃO DO PERÍODO
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
            {Object.entries(dicionarioItens).map(([atividade, total]) => (
              <div key={atividade} style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderRight: '1px solid #cbd5e1', paddingRight: '8px', minWidth: '100px' }}>
                <span style={{ fontSize: '10px', color: '#475569', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={atividade}>{atividade}</span>
                <span style={{ fontSize: '16px', color: '#0f172a', fontWeight: 'bold' }}>{total.toLocaleString('pt-BR')}</span>
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '4px', backgroundColor: '#e2e8f0', margin: '-12px -12px -12px 0', padding: '12px', borderRadius: '0 4px 4px 0', justifyContent: 'center' }}>
              <span style={{ fontSize: '10px', color: '#1e293b', fontWeight: 'bold' }}>TOTAL GERAL</span>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#2563eb' }}>{totalGeral.toLocaleString('pt-BR')}</span>
            </div>
          </div>

          <div style={{ height: '240px', position: 'relative', marginTop: '8px' }}>
            <Bar data={chartData} options={opcoesGrafico} />
          </div>
        </div>
      ) : listaDiarios.length > 0 && (
        <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
          Diários encontrados, mas nenhuma quantidade de atividade foi registrada para gerar o gráfico.
        </div>
      )}

      {/* TABELA PRINCIPAL */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', color: '#1e293b' }}>
          RELAÇÃO DE DIÁRIOS DE OBRA EMITIDOS (RDO)
        </div>
        <div style={{ padding: '12px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
  <thead>
    <tr style={{ backgroundColor: '#f1f5f9' }}>
      <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#475569' }}>DATA</th>
      <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#475569' }}>EQUIPE</th> 
      <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#475569' }}>CÓD. OBRA</th>
      <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#475569' }}>NOME DA OBRA</th>
      <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#475569', textAlign: 'center' }}>EFETIVO ATIVO</th>
      <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#475569' }}>ATIVIDADES RELATADAS</th>
      <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#475569', textAlign: 'center', width: '80px' }}>VER</th>
    </tr>
  </thead>
  <tbody>
    {loading ? (
      <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>Buscando registros no banco de dados...</td></tr>
    ) : listaDiarios.length === 0 ? (
      <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Nenhum RDO encontrado para este gestor ou filtros aplicados.</td></tr>
    ) : (
      listaDiarios.map((rdo, index) => (
        <tr key={rdo.id || index} style={{ borderBottom: '1px solid #e2e8f0' }}>
          <td style={{ padding: '10px', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#0f172a' }}>{formatarDataExibicao(rdo.data_diario)}</td>
          
          <td style={{ padding: '10px', fontWeight: 'bold', color: '#475569' }}>
            <span style={{ backgroundColor: '#f1f5f9', padding: '3px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
              {rdo.equipe || 'Geral'}
            </span>
          </td>

          <td style={{ padding: '10px', color: '#475569', fontFamily: 'monospace' }}>{rdo.codigo_obra}</td>
          <td style={{ padding: '10px', fontWeight: '500' }}>{rdo.nome_obra}</td>
          <td style={{ padding: '10px', textAlign: 'center' }}>
            <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{rdo.total_efetivo || 0} Colaboradores</span>
          </td>
          <td style={{ padding: '10px', color: '#334155', fontSize: '11px' }}>
            {rdo.servicos_resumo ? <div style={{ whiteSpace: 'pre-line' }}>{rdo.servicos_resumo}</div> : <span style={{ color: '#94a3b8' }}>Sem produção registrada</span>}
          </td>
          <td style={{ padding: '10px', textAlign: 'center' }}>
            <button onClick={() => setDiarioSelecionado(rdo)} style={{ border: '1px solid #cbd5e1', backgroundColor: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Eye style={{ width: '14px', color: '#2563eb' }} /> Detalhes
            </button>
          </td>
        </tr>
      ))
    )}
  </tbody>
</table>
        </div>
      </div>

      {/* MODAL DE DETALHES FORMATEDO IGUAL À IMAGEM */}
      {diarioSelecionado && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '6px', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #94a3b8', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            
            {/* Cabeçalho do Modal */}
            <div style={{ padding: '12px 16px', backgroundColor: '#0f172a', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', fontSize: '13px' }}>RDO DETALHADO — {formatarDataExibicao(diarioSelecionado.data_diario)}</span>
              <button onClick={() => setDiarioSelecionado(null)} style={{ backgroundColor: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>✕</button>
            </div>
            
            {/* Conteúdo Interno Organizado */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px', backgroundColor: '#ffffff' }}>
              
              {/* Informações Superiores Desvinculadas de Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', color: '#1e293b' }}>
                <div><strong>Obra Vinculada:</strong> <span style={{ color: '#2563eb', fontWeight: 'bold' }}>[{diarioSelecionado.codigo_obra || '100'}]</span> {diarioSelecionado.nome_obra}</div>
                <div><strong>Equipe Responsável:</strong> <span style={{ fontWeight: 'bold' }}>{diarioSelecionado.equipe || 'A'}</span></div>
              </div>

              {/* CARD 1: Colaboradores na Equipe */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#f0f4f8', padding: '10px 14px', fontWeight: 'bold', color: '#1e293b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users style={{ width: '15px', height: '15px', color: '#475569' }} /> Colaboradores na Equipe ({diarioSelecionado.total_efetivo || 0})
                </div>
                <div style={{ padding: '16px', backgroundColor: '#fff' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {diarioSelecionado.nomes_efetivo ? (
                      diarioSelecionado.nomes_efetivo.split(/[\n,]+/).map((nome, i) => {
                        if (!nome.trim()) return null;
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', color: '#334155' }}>
                            👤 {nome.trim().toUpperCase()}
                          </div>
                        );
                      })
                    ) : (
                      <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Nenhum colaborador mapeado para este diário.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* CARD 2: Listagem de Materiais e Insumos / Atividades */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#fef3c7', padding: '10px 14px', fontWeight: 'bold', color: '#92400e', fontSize: '13px' }}>
                  Listagem do Serviço (Resumo do RDO):
                </div>
                <div style={{ padding: '16px', backgroundColor: '#fff', fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>
                  {/* Se o seu RDO lida com materiais no resumo ou estiver vazio */}
                  {diarioSelecionado.servicos_resumo ? (
                    <div style={{ whiteSpace: 'pre-line' }}>{diarioSelecionado.servicos_resumo}</div>
                  ) : (
                    <span style={{ color: '#b45309' }}>Nenhum insumo ou tacha mapeada para este diário.</span>
                  )}
                </div>
              </div>

              {/* CARD 3: Observações Gerais do RDO */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#f0f4f8', padding: '10px 14px', fontWeight: 'bold', color: '#1e293b', fontSize: '13px' }}>
                  Observações Gerais do RDO:
                </div>
                <div style={{ padding: '16px', backgroundColor: '#fff', fontSize: '13px' }}>
                  {diarioSelecionado.observacoes ? (
                    <p style={{ margin: 0, color: '#334155', lineHeight: '1.5' }}>{diarioSelecionado.observacoes}</p>
                  ) : (
                    <span style={{ fontStyle: 'italic', color: '#64748b' }}>Sem observações registradas.</span>
                  )}
                </div>
              </div>

            </div>

            {/* Rodapé do Modal */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setDiarioSelecionado(null)} style={{ padding: '6px 14px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}