import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, Search, RefreshCw, Eye, X, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export default function EstoqueSaldos({ API_URL, mostrarMensagem }) {
  const [saldos, setSaldos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  // Estados do Modal de Extrato
  const [materialSelecionado, setMaterialSelecionado] = useState(null);
  const [historicoMaterial, setHistoricoMaterial] = useState([]);
  const [carregandoModal, setCarregandoModal] = useState(false);

  useEffect(() => {
    carregarEstoque();
  }, []);

  const carregarEstoque = async () => {
    setCarregando(true);
    try {
      const res = await axios.get(`${API_URL}/master/estoque/saldos`);
      setSaldos(res.data || []);
    } catch (e) {
      console.error("Erro ao carregar estoque:", e);
      mostrarMensagem('Erro ao atualizar saldos de estoque.', 'erro');
    } finally {
      setCarregando(false);
    }
  };

  const abrirModalExtrato = async (material) => {
    setMaterialSelecionado(material);
    setCarregandoModal(true);
    try {
      const res = await axios.get(`${API_URL}/master/movimentacoes`);
      const movsDoMaterial = (res.data || []).filter(
        m => Number(m.material_id) === Number(material.material_id)
      );
      setHistoricoMaterial(movsDoMaterial);
    } catch (e) {
      console.error("Erro ao buscar histórico do material:", e);
    } finally {
      setCarregandoModal(false);
    }
  };

  const fecharModal = () => {
    setMaterialSelecionado(null);
    setHistoricoMaterial([]);
  };

  const tiposDisponiveis = Array.from(new Set(saldos.map(s => s.material_tipo).filter(Boolean)));

  const saldosFiltrados = saldos.filter(item => {
    const nome = String(item.material_nome || '').toLowerCase();
    const busca = termoBusca.toLowerCase();
    if (busca && !nome.includes(busca)) return false;
    if (filtroTipo && String(item.material_tipo).toUpperCase() !== filtroTipo.toUpperCase()) return false;
    return true;
  });

  const inputStyle = {
    height: '36px', padding: '0 8px', border: '1px solid #cbd5e1',
    borderRadius: '6px', fontSize: '11px', backgroundColor: '#fff', width: '100%'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      
      {/* FILTROS E AÇÕES */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Package style={{ width: '16px', height: '16px', color: '#2563eb' }} />
            Posição de Estoque dos Materiais
          </h3>

          <button 
            onClick={carregarEstoque}
            style={{ height: '32px', padding: '0 12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw style={{ width: '12px', height: '12px' }} />
            Atualizar
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>BUSCAR MATERIAL</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search style={{ position: 'absolute', left: '8px', width: '12px', height: '12px', color: '#94a3b8' }} />
              <input 
                type="text" 
                placeholder="Nome do material..." 
                value={termoBusca} 
                onChange={e => setTermoBusca(e.target.value)} 
                style={{ ...inputStyle, paddingLeft: '26px' }} 
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>CATEGORIA</label>
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={inputStyle}>
              <option value="">Todas</option>
              {tiposDisponiveis.map(t => (
                <option key={`cat-${t}`} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* TABELA DE POSIÇÃO DE ESTOQUE */}
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
              <th style={{ padding: '10px 12px' }}>Material</th>
              <th style={{ padding: '10px 12px' }}>Categoria</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Qtd. Inicial</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Movimentações</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Saldo Total</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Carregando dados do estoque...</td>
              </tr>
            ) : saldosFiltrados.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Nenhum material encontrado.</td>
              </tr>
            ) : (
              saldosFiltrados.map((item) => (
                <tr key={`mat-saldo-${item.material_id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#0f172a' }}>
                    {item.material_nome}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>
                    {item.material_tipo || '-'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>
                    {Number(item.saldo_cadastrado || 0).toLocaleString('pt-BR')} {item.unidade_medida || 'UN'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', color: item.total_movimentado >= 0 ? '#16a34a' : '#dc2626' }}>
                    {item.total_movimentado > 0 ? `+${item.total_movimentado}` : item.total_movimentado} {item.unidade_medida || 'UN'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', fontSize: '12px', color: '#2563eb' }}>
                    {Number(item.saldo_total || 0).toLocaleString('pt-BR')} {item.unidade_medida || 'UN'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <button
                      onClick={() => abrirModalExtrato(item)}
                      title="Ver Movimentações do Material"
                      style={{ padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#f8fafc', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Eye style={{ width: '12px', height: '12px', color: '#2563eb' }} />
                      Extrato
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE EXTRATO DE MOVIMENTAÇÃO */}
      {materialSelecionado && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '90%', maxWidth: '700px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            
            <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>
                  Extrato do Material: {materialSelecionado.material_nome}
                </h3>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Saldo Atual: <strong>{materialSelecionado.saldo_total} {materialSelecionado.unidade_medida}</strong>
                </span>
              </div>
              <button onClick={fecharModal} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px' }}>
                <X style={{ width: '18px', height: '18px', color: '#64748b' }} />
              </button>
            </div>

            <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
              {carregandoModal ? (
                <p style={{ textAlign: 'center', fontSize: '12px', color: '#64748b' }}>Buscando movimentações...</p>
              ) : historicoMaterial.length === 0 ? (
                <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>Nenhuma movimentação registrada para este material até o momento.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '8px' }}>Tipo</th>
                      <th style={{ padding: '8px' }}>Qtd</th>
                      <th style={{ padding: '8px' }}>Origem / Destino</th>
                      <th style={{ padding: '8px' }}>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoMaterial.map((m) => {
                      const ehEntrada = ['ENTRADA_FORNECEDOR', 'TRANSFERENCIA_ENTRADA', 'AJUSTE'].includes(m.tipo_movimentacao);
                      return (
                        <tr key={`modal-mov-${m.id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {ehEntrada ? (
                              <ArrowDownLeft style={{ width: '14px', height: '14px', color: '#16a34a' }} />
                            ) : (
                              <ArrowUpRight style={{ width: '14px', height: '14px', color: '#dc2626' }} />
                            )}
                            <span style={{ fontWeight: 'bold', color: ehEntrada ? '#16a34a' : '#dc2626' }}>
                              {m.tipo_movimentacao}
                            </span>
                          </td>
                          <td style={{ padding: '8px', fontWeight: 'bold' }}>
                            {m.quantidade} {m.unidade_medida || 'UN'}
                          </td>
                          <td style={{ padding: '8px', color: '#475569' }}>
                            {m.origem_tipo} #{m.origem_id || '-'} → {m.destino_tipo} #{m.destino_id || '-'}
                          </td>
                          <td style={{ padding: '8px', color: '#64748b' }}>
                            {m.data_movimentacao ? m.data_movimentacao.split('T')[0] : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', textAlign: 'right', backgroundColor: '#f8fafc' }}>
              <button onClick={fecharModal} style={{ padding: '6px 16px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}