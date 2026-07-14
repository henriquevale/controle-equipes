import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Search, Eye, BarChart3, Package, Users } from 'lucide-react';
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
// const API_URL = 'https://controle-equipes.onrender.com/api';

// Recebe 'id' (da coluna ID da tabela usuario_sistema) e 'cargo'
export default function HistoricoMateriais({ id, cargo }) {
  const [idObra, setIdObra] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [obras, setObras] = useState([]);
  const [listaDiarios, setListaDiarios] = useState([]);
  const [diarioSelecionado, setDiarioSelecionado] = useState(null);
  const [loading, setLoading] = useState(false);

  // 🛠️ Busca amarrada ao ID único do usuário (Focada em trazer dados incluindo os materiais)
  const buscarHistoricoMateriais = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/gestor/historico-diarios`, {
        params: { 
          id: id,                  
          cargo: cargo,            
          id_obra: idObra || undefined, 
          data_inicio: dataInicio || undefined, 
          data_fim: dataFim || undefined 
        }
      });
      
      setListaDiarios(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Erro ao buscar histórico de materiais do banco:", err);
      setListaDiarios([]);
    } finally {
      setLoading(false);
    }
  }, [id, cargo, idObra, dataInicio, dataFim]);


  // Effect para carregar as obras do filtro
  useEffect(() => {
    const carregarObrasFiltro = async () => {
      try {
        const res = await axios.get(`${API_URL}/gestor/obras-ativas`, {
          params: { id, cargo }
        });
        setObras(res.data || []);
      } catch (e) {
        console.error("Erro ao carregar obras para filtro:", e);
      }
    };
    
    if (id) carregarObrasFiltro();
  }, [id, cargo]);

  // Gatilho inicial ao validar o ID
  useEffect(() => {
    if (id) {
      buscarHistoricoMateriais();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); 

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

          <button onClick={buscarHistoricoMateriais} style={{ height: '32px', padding: '0 16px', backgroundColor: '#ea580c', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Search style={{ width: '14px' }} /> Filtrar Materiais
          </button>
        </div>
      </div>

      {/* PAINEL DO GRÁFICO DE CONSUMO DE MATERIAIS */}
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

      {/* TABELA PRINCIPAL DE MATERIAIS */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', color: '#1e293b' }}>
          HISTÓRICO DE MATERIAIS UTILIZADOS POR APONTAMENTO (RDO)
        </div>
        <div style={{ padding: '12px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#475569' }}>DATA</th>
                <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#475569' }}>EQUIPE</th> 
                <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#475569' }}>RESPONSÁVEL</th>
                <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#475569' }}>CÓD. OBRA</th>
                <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#475569' }}>NOME DA OBRA</th>
                <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#475569' }}>MATERIAIS CONSUMIDOS (ITENS)</th>
                <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#475569', textAlign: 'center', width: '80px' }}>VER</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>Consultando dados de materiais aplicados...</td></tr>
              ) : listaDiarios.length === 0 ? (
                <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Nenhum lançamento de material localizado com as configurações atuais.</td></tr>
              ) : (
                listaDiarios.map((rdo, index) => (
                  <tr key={rdo.id || index} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#0f172a' }}>{formatarDataExibicao(rdo.data_diario)}</td>
                    
                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#475569' }}>
                      <span style={{ backgroundColor: '#f1f5f9', padding: '3px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                        {rdo.equipe || 'Geral'}
                      </span>
                    </td>

                    <td style={{ padding: '10px', color: '#334155', fontWeight: '500' }}>
                      {rdo.nome_gestor || rdo.gestor || 'Não informado'}
                    </td>

                    <td style={{ padding: '10px', color: '#475569', fontFamily: 'monospace' }}>{rdo.codigo_obra}</td>
                    <td style={{ padding: '10px', fontWeight: '500' }}>{rdo.nome_obra}</td>
                    
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE VISUALIZAÇÃO EXPANDIDA DE MATERIAIS */}
      {diarioSelecionado && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '6px', width: '100%', maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto', border: '1px solid #94a3b8' }}>
            <div style={{ padding: '12px 16px', backgroundColor: '#7c2d12', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}><Package style={{width: '14px'}}/> MATERIAIS DO RDO — {formatarDataExibicao(diarioSelecionado.data_diario)}</span>
              <button onClick={() => setDiarioSelecionado(null)} style={{ backgroundColor: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><strong>Obra Vinculada:</strong> [{diarioSelecionado.codigo_obra}] {diarioSelecionado.nome_obra}</div>
              <div><strong>Equipe Responsável:</strong> {diarioSelecionado.equipe || 'Geral'}</div>

              {/* SEÇÃO: COLABORADORES DA EQUIPE */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                <div style={{ backgroundColor: '#f1f5f9', color: '#334155', padding: '6px 10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users style={{ width: '14px', color: '#475569' }} /> Colaboradores na Equipe ({diarioSelecionado.total_efetivo || 0})
                </div>
                <div style={{ padding: '10px', backgroundColor: '#fff' }}>
                  {diarioSelecionado.nomes_efetivo ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {diarioSelecionado.nomes_efetivo.split(', ').map((nome, i) => (
                        <span key={i} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>
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
              <button onClick={() => setDiarioSelecionado(null)} style={{ padding: '6px 14px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Fechar Janela</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}