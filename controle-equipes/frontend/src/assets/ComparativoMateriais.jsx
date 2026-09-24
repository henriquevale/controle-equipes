import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  BarChart3, 
  Search, 
  RefreshCw, 
  Building2, 
  HardHat, 
  Filter, 
  DollarSign,
  Package
} from 'lucide-react';

export default function ComparativoMateriais({ API_URL = 'http://localhost:3001/api', mostrarMensagem }) {
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const [bases, setBases] = useState([]);
  const [obras, setObras] = useState([]);
  const [baseObras, setBaseObras] = useState([]);
  const [baseSelecionada, setBaseSelecionada] = useState('');
  const [obraSelecionada, setObraSelecionada] = useState('');
  const [obrasFiltradas, setObrasFiltradas] = useState([]);

  const [materiais, setMateriais] = useState([]);
  const [categoriasDisponiveis, setCategoriasDisponiveis] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    carregarLocais();
  }, []);

  useEffect(() => {
    fetchComparativo();
  }, [baseSelecionada, obraSelecionada]);

  const carregarLocais = async () => {
    try {
      const resLocais = await axios.get(`${API_URL}/master/locais`).catch(() => ({ data: {} }));
      setBases(resLocais.data.bases || []);
      setObras(resLocais.data.obras || []);
      setBaseObras(resLocais.data.baseObras || []);
      setObrasFiltradas(resLocais.data.obras || []);
    } catch (e) {
      console.error("Erro ao carregar locais:", e);
    }
  };

  const handleBaseChange = (e) => {
    const baseId = e.target.value;
    setBaseSelecionada(baseId);
    setObraSelecionada('');

    if (!baseId) {
      setObrasFiltradas(obras);
      return;
    }

    const idsObrasDaBase = baseObras
      .filter(bo => String(bo.base_id) === String(baseId))
      .map(bo => Number(bo.obra_id));

    setObrasFiltradas(obras.filter(o => idsObrasDaBase.includes(Number(o.id))));
  };

  const fetchComparativo = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (obraSelecionada) {
        params.tipo_local = 'OBRA';
        params.id_local = obraSelecionada;
      } else if (baseSelecionada) {
        params.tipo_local = 'BASE';
        params.id_local = baseSelecionada;
      }

      if (dataInicio) params.data_inicio = dataInicio;
      if (dataFim) params.data_fim = dataFim;

      const response = await axios.get(`${API_URL}/master/materiais/comparativo`, { params });
      const dados = Array.isArray(response.data) ? response.data : [];
      setMateriais(dados);

      const cats = Array.from(new Set(dados.map(item => item.categoria || item.tipo).filter(Boolean)));
      setCategoriasDisponiveis(cats);
    } catch (error) {
      console.error('Erro ao carregar comparativo:', error);
      if (mostrarMensagem) mostrarMensagem('Erro ao carregar comparativo de materiais.', 'erro');
    } finally {
      setLoading(false);
    }
  }, [API_URL, baseSelecionada, obraSelecionada, dataInicio, dataFim, mostrarMensagem]);

  const materiaisFiltrados = materiais.filter((item) => {
    const nome = String(item.nome || item.descricao || '').toLowerCase();
    const codigo = String(item.codigo || '').toLowerCase();
    const termo = busca.toLowerCase();

    const atendeBusca = !termo || nome.includes(termo) || codigo.includes(termo);
    const categoriaItem = String(item.categoria || item.tipo || '');
    const atendeCategoria = filtroCategoria 
      ? categoriaItem.toUpperCase() === filtroCategoria.toUpperCase() 
      : true;

    return atendeBusca && atendeCategoria;
  });

  const inputStyle = {
    height: '36px',
    padding: '0 8px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '11px',
    backgroundColor: '#fff',
    width: '100%'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', fontFamily: 'sans-serif' }}>
      
      {/* PAINEL DE CONTROLE DE FILTROS */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 style={{ width: '18px', height: '18px', color: '#2563eb' }} />
              Comparativo: Faturamento Direto vs. Estoque Interno
            </h3>
            <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0 0' }}>
              Cruzamento de informações de materiais entre faturamento direto nas obras e volumes de estoque.
            </p>
          </div>

          <button 
            onClick={fetchComparativo}
            style={{
              height: '32px', padding: '0 12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1',
              borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#334155',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <RefreshCw style={{ width: '12px', height: '12px' }} />
            Atualizar
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
              <Building2 style={{ width: '12px', height: '12px' }} /> BASE
            </label>
            <select value={baseSelecionada} onChange={handleBaseChange} style={inputStyle}>
              <option value="">Todas as Bases</option>
              {bases.map(b => (
                <option key={`base-${b.id}`} value={b.id}>{b.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: baseSelecionada ? '#64748b' : '#cbd5e1', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
              <HardHat style={{ width: '12px', height: '12px' }} /> OBRA
            </label>
            <select 
              value={obraSelecionada} 
              onChange={e => setObraSelecionada(e.target.value)} 
              disabled={!baseSelecionada}
              style={{ ...inputStyle, backgroundColor: baseSelecionada ? '#fff' : '#f8fafc', cursor: baseSelecionada ? 'pointer' : 'not-allowed' }}
            >
              <option value="">
                {!baseSelecionada ? 'Selecione uma base primeiro' : obrasFiltradas.length === 0 ? 'Nenhuma obra' : 'Todas as Obras'}
              </option>
              {obrasFiltradas.map(o => (
                <option key={`obra-${o.id}`} value={o.id}>{o.nome_obra || o.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px', display: 'block' }}>BUSCAR MATERIAL</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search style={{ position: 'absolute', left: '8px', width: '12px', height: '12px', color: '#94a3b8' }} />
              <input type="text" placeholder="Código ou Descrição..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ ...inputStyle, paddingLeft: '26px' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px', display: 'block' }}>CATEGORIA</label>
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} style={inputStyle}>
              <option value="">Todas as Categorias</option>
              {categoriasDisponiveis.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <button
              onClick={fetchComparativo}
              style={{
                height: '36px', width: '100%', backgroundColor: '#2563eb', color: '#fff', border: 'none',
                borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: '6px'
              }}
            >
              <Filter style={{ width: '12px', height: '12px' }} /> Filtrar
            </button>
          </div>
        </div>
      </div>

      {/* TABELA COMPARATIVA */}
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
              <th style={{ padding: '10px 12px' }}>Código</th>
              <th style={{ padding: '10px 12px' }}>Descrição do Material</th>
              <th style={{ padding: '10px 12px' }}>Un. Estoque</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', backgroundColor: '#f0f9ff' }}>Qtd. Fat. Direto</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', backgroundColor: '#f0f9ff' }}>Total Fat. Direto (R$)</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', backgroundColor: '#f0fdf4' }}>Saldo Estoque</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', backgroundColor: '#f0fdf4' }}>Total Estoque (R$)</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Proporção Direct/Estoque</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Carregando comparativo...</td>
              </tr>
            ) : materiaisFiltrados.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                  Nenhum material registrado no comparativo.
                </td>
              </tr>
            ) : (
              materiaisFiltrados.map((mat) => {
                const codigoMat = mat.codigo || '-';
                const nomeMat = mat.nome || mat.descricao || 'Sem Descrição';
                const unEstoque = mat.unidade_estoque || 'UN';

                const qtdFatDireto = Number(mat.qtd_faturamento_direto || 0);
                const valorFatDireto = Number(mat.valor_faturamento_direto || 0);

                const saldoEstoque = Number(mat.saldo_estoque || 0);
                const valorEstoque = Number(mat.valor_estoque || 0);

                const totalGeral = qtdFatDireto + saldoEstoque;
                const percFatDireto = totalGeral > 0 ? ((qtdFatDireto / totalGeral) * 100).toFixed(0) : 0;
                const percEstoque = totalGeral > 0 ? ((saldoEstoque / totalGeral) * 100).toFixed(0) : 0;

                return (
                  <tr key={`mat-comp-${mat.id || mat.material_id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#334155' }}>
                      {codigoMat}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#0f172a' }}>
                      {nomeMat}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{unEstoque}</td>

                    {/* DADOS FATURAMENTO DIRETO */}
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', color: '#0369a1', backgroundColor: '#f8fafc' }}>
                      {qtdFatDireto.toLocaleString('pt-BR')} {unEstoque}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#0284c7', backgroundColor: '#f8fafc' }}>
                      R$ {valorFatDireto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* DADOS ESTOQUE */}
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', color: '#15803d', backgroundColor: '#fcfdfc' }}>
                      {saldoEstoque.toLocaleString('pt-BR')} {unEstoque}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#16a34a', backgroundColor: '#fcfdfc' }}>
                      R$ {valorEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* BARRAS PROPORCIONAIS DE BALANÇO */}
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                        <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#0284c7' }}>{percFatDireto}%</span>
                        <div style={{ width: '60px', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                          <div style={{ width: `${percFatDireto}%`, backgroundColor: '#0284c7' }} />
                          <div style={{ width: `${percEstoque}%`, backgroundColor: '#16a34a' }} />
                        </div>
                        <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#16a34a' }}>{percEstoque}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}