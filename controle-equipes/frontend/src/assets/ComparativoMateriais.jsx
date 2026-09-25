import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  BarChart3, 
  Search, 
  RefreshCw, 
  Building2, 
  HardHat
} from 'lucide-react';

const DEFAULT_API_URL = 'http://localhost:3001/api';
//const DEFAULT_API_URL = 'https://api-controle-impacto.duckdns.org/api';

export default function ComparativoMateriais({ API_URL = DEFAULT_API_URL, mostrarMensagem }) {
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const [bases, setBases] = useState([]);
  const [obras, setObras] = useState([]);
  const [baseSelecionada, setBaseSelecionada] = useState('');
  const [obraSelecionada, setObraSelecionada] = useState('');

  const [materiais, setMateriais] = useState([]);
  const [categoriasDisponiveis, setCategoriasDisponiveis] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    carregarLocais();
  }, []);

  const carregarLocais = async () => {
    try {
      const resLocais = await axios.get(`${API_URL}/master/locais`).catch(() => ({ data: {} }));
      setBases(resLocais.data.bases || []);
      setObras(resLocais.data.obras || []);
    } catch (e) {
      console.error("Erro ao carregar locais:", e);
    }
  };

  const handleBaseChange = (e) => {
    const val = e.target.value;
    setBaseSelecionada(val);
    if (val) {
      setObraSelecionada('');
    }
  };

  const handleObraChange = (e) => {
    const val = e.target.value;
    setObraSelecionada(val);
    if (val) {
      setBaseSelecionada('');
    }
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

      const urlDestino = `${API_URL}/materiais/comparativo`;
      const response = await axios.get(urlDestino, { params });
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

  useEffect(() => {
    fetchComparativo();
  }, [baseSelecionada, obraSelecionada, dataInicio, dataFim]);

  const materiaisFiltrados = materiais.filter((item) => {
    const qtdApontada = Number(item.qtd_apontada || 0);
    const qtdFatFinalizado = Number(item.qtd_fat_direto_finalizado || 0);
    const qtdFatPendente = Number(item.qtd_fat_direto_pendente || 0);
    const saldoEstoque = Number(item.saldo_estoque || 0);

    // Oculta itens cujas quantidades em todas as frentes sejam zero
    if (qtdApontada === 0 && qtdFatFinalizado === 0 && qtdFatPendente === 0 && saldoEstoque === 0) {
      return false;
    }

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
              Comparativo: Faturamento Direto vs. Estoque vs. Apontamentos
            </h3>
            <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0 0' }}>
              Cruzamento de informações de faturamento direto (finalizados e pendentes), saldos de estoque e relatórios diários de apontamento.
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
              <Building2 style={{ width: '12px', height: '12px' }} /> BASE
            </label>
            <select 
              value={baseSelecionada} 
              onChange={handleBaseChange} 
              disabled={Boolean(obraSelecionada)}
              style={{
                ...inputStyle,
                backgroundColor: obraSelecionada ? '#f1f5f9' : '#fff',
                cursor: obraSelecionada ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="">Todas as Bases</option>
              {bases.map(b => (
                <option key={`base-${b.id}`} value={b.id}>{b.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
              <HardHat style={{ width: '12px', height: '12px' }} /> OBRA
            </label>
            <select 
              value={obraSelecionada} 
              onChange={handleObraChange} 
              disabled={Boolean(baseSelecionada)}
              style={{
                ...inputStyle,
                backgroundColor: baseSelecionada ? '#f1f5f9' : '#fff',
                cursor: baseSelecionada ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="">Todas as Obras</option>
              {obras.map(o => (
                <option key={`obra-${o.id}`} value={o.id}>{o.nome_obra || o.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px', display: 'block' }}>DATA INÍCIO</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px', display: 'block' }}>DATA FIM</label>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px', display: 'block' }}>BUSCAR MATERIAL</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search style={{ position: 'absolute', left: '8px', width: '12px', height: '12px', color: '#94a3b8' }} />
              <input type="text" placeholder="Nome ou Descrição..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ ...inputStyle, paddingLeft: '26px' }} />
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
        </div>
      </div>

      {/* TABELA COMPARATIVA */}
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
              <th style={{ padding: '10px 12px' }}>Descrição do Material</th>
              <th style={{ padding: '10px 12px' }}>Un. Estoque</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', backgroundColor: '#fff7ed', color: '#c2410c' }}>QTD APONTADA</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', backgroundColor: '#f0f9ff', color: '#0369a1' }}>FAT. DIRETO FINALIZADO</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', backgroundColor: '#fefce8', color: '#a16207' }}>FAT. DIRETO PENDENTE</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', backgroundColor: '#f0fdf4', color: '#15803d' }}>QTD ESTOQUE</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Carregando comparativo...</td>
              </tr>
            ) : materiaisFiltrados.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                  Nenhum material com movimentação encontrado.
                </td>
              </tr>
            ) : (
              materiaisFiltrados.map((mat) => {
                const nomeMat = mat.nome || mat.descricao || 'Sem Descrição';
                const unEstoque = mat.unidade_estoque || 'UN';

                const qtdApontada = Number(mat.qtd_apontada || 0);
                const qtdFatFinalizado = Number(mat.qtd_fat_direto_finalizado || 0);
                const qtdFatPendente = Number(mat.qtd_fat_direto_pendente || 0);
                const saldoEstoque = Number(mat.saldo_estoque || 0);

                return (
                  <tr key={`mat-comp-${mat.id || mat.material_id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#0f172a' }}>
                      {nomeMat}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{unEstoque}</td>

                    {/* QTD APONTADA (Laranja) */}
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', color: '#ea580c', backgroundColor: '#fff7ed' }}>
                      {qtdApontada.toLocaleString('pt-BR')} {unEstoque}
                    </td>

                    {/* FAT. DIRETO FINALIZADO (Azul) */}
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', color: '#0284c7', backgroundColor: '#f0f9ff' }}>
                      {qtdFatFinalizado.toLocaleString('pt-BR')} {unEstoque}
                    </td>

                    {/* FAT. DIRETO PENDENTE (Amarelo) */}
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', color: '#ca8a04', backgroundColor: '#fefce8' }}>
                      {qtdFatPendente.toLocaleString('pt-BR')} {unEstoque}
                    </td>

                    {/* QTD ESTOQUE (Verde) */}
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', color: '#16a34a', backgroundColor: '#f0fdf4' }}>
                      {saldoEstoque.toLocaleString('pt-BR')} {unEstoque}
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