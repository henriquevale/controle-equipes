import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  FileText, Filter, ArrowDownLeft, ArrowUpRight, ArrowRightLeft, 
  Download, Calendar, RefreshCw, CheckCircle, Clock 
} from 'lucide-react';


const API_URL = 'http://localhost:3001/api';

export default function RelatorioMovimentacoes({ API_URL, mostrarMensagem }) {
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [carregando, setCarregando] = useState(false);

  // Estados dos Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [tipoMovimentacao, setTipoMovimentacao] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [origemTipo, setOrigemTipo] = useState('');
  const [destinoTipo, setDestinoTipo] = useState('');

  useEffect(() => {
    carregarMateriais();
    carregarRelatorio();
  }, []);

  const carregarMateriais = async () => {
    try {
      const res = await axios.get(`${API_URL}/master/materiais`);
      setMateriais(res.data || []);
    } catch (e) {
      console.error("Erro ao carregar materiais para o filtro:", e);
    }
  };

  const carregarRelatorio = async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (dataInicio) params.append('data_inicio', dataInicio);
      if (dataFim) params.append('data_fim', dataFim);
      if (tipoMovimentacao) params.append('tipo_movimentacao', tipoMovimentacao);
      if (materialId) params.append('material_id', materialId);
      if (origemTipo) params.append('origem_tipo', origemTipo);
      if (destinoTipo) params.append('destino_tipo', destinoTipo);

      const res = await axios.get(`${API_URL}/master/relatorios/movimentacoes?${params.toString()}`);
      setMovimentacoes(res.data || []);
    } catch (e) {
      console.error("Erro ao gerar relatório:", e);
      mostrarMensagem('Erro ao carregar relatório de movimentações.', 'erro');
    } finally {
      setCarregando(false);
    }
  };

  const limparFiltros = () => {
    setDataInicio('');
    setDataFim('');
    setTipoMovimentacao('');
    setMaterialId('');
    setOrigemTipo('');
    setDestinoTipo('');
  };

  // Cálculo de Métricas do Período Filtrado
  const totalEntradas = movimentacoes
    .filter(m => ['ENTRADA_FORNECEDOR', 'TRANSFERENCIA_ENTRADA', 'AJUSTE'].includes(m.tipo_movimentacao))
    .reduce((acc, curr) => acc + Number(curr.quantidade), 0);

  const totalSaidas = movimentacoes
    .filter(m => ['TRANSFERENCIA_SAIDA', 'CONSUMO_RDO'].includes(m.tipo_movimentacao))
    .reduce((acc, curr) => acc + Number(curr.quantidade), 0);

  const totalConfirmadas = movimentacoes.filter(m => m.status === 'CONFIRMADO').length;

  const inputStyle = {
    height: '34px', padding: '0 8px', border: '1px solid #cbd5e1',
    borderRadius: '6px', fontSize: '11px', backgroundColor: '#fff', width: '100%'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      
      {/* PAINEL DE FILTROS */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter style={{ width: '16px', height: '16px', color: '#2563eb' }} />
            Filtros do Relatório
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={limparFiltros}
              style={{ height: '32px', padding: '0 12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#475569' }}
            >
              Limpar
            </button>
            <button 
              onClick={carregarRelatorio}
              style={{ height: '32px', padding: '0 14px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw style={{ width: '12px', height: '12px' }} />
              Filtrar Relatório
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>DATA INÍCIO</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>DATA FIM</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>TIPO MOVIMENTAÇÃO</label>
            <select value={tipoMovimentacao} onChange={e => setTipoMovimentacao(e.target.value)} style={inputStyle}>
              <option value="">Todas</option>
              <option value="ENTRADA_FORNECEDOR">ENTRADA_FORNECEDOR</option>
              <option value="TRANSFERENCIA_SAIDA">TRANSFERENCIA_SAIDA</option>
              <option value="TRANSFERENCIA_ENTRADA">TRANSFERENCIA_ENTRADA</option>
              <option value="CONSUMO_RDO">CONSUMO_RDO</option>
              <option value="AJUSTE">AJUSTE</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>MATERIAL</label>
            <select value={materialId} onChange={e => setMaterialId(e.target.value)} style={inputStyle}>
              <option value="">Todos os Materiais</option>
              {materiais.map(m => (
                <option key={`m-opt-${m.id}`} value={m.id}>{m.descricao}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>TIPO ORIGEM</label>
            <select value={origemTipo} onChange={e => setOrigemTipo(e.target.value)} style={inputStyle}>
              <option value="">Qualquer Origem</option>
              <option value="FORNECEDOR">FORNECEDOR</option>
              <option value="BASE">BASE</option>
              <option value="OBRA">OBRA</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>TIPO DESTINO</label>
            <select value={destinoTipo} onChange={e => setDestinoTipo(e.target.value)} style={inputStyle}>
              <option value="">Qualquer Destino</option>
              <option value="BASE">BASE</option>
              <option value="OBRA">OBRA</option>
            </select>
          </div>
        </div>
      </div>

      {/* CARDS COM MÉTRICAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '8px' }}>
            <ArrowDownLeft style={{ width: '20px', height: '20px', color: '#16a34a' }} />
          </div>
          <div>
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>TOTAL ENTRADAS</span>
            <h4 style={{ fontSize: '16px', fontWeight: 'bold', color: '#16a34a', margin: 0 }}>+{totalEntradas.toFixed(2)}</h4>
          </div>
        </div>

        <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#fef2f2', padding: '10px', borderRadius: '8px' }}>
            <ArrowUpRight style={{ width: '20px', height: '20px', color: '#dc2626' }} />
          </div>
          <div>
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>TOTAL SAÍDAS / CONSUMO</span>
            <h4 style={{ fontSize: '16px', fontWeight: 'bold', color: '#dc2626', margin: 0 }}>-{totalSaidas.toFixed(2)}</h4>
          </div>
        </div>

        <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#eff6ff', padding: '10px', borderRadius: '8px' }}>
            <CheckCircle style={{ width: '20px', height: '20px', color: '#2563eb' }} />
          </div>
          <div>
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>MOVIMENTAÇÕES CONFIRMADAS</span>
            <h4 style={{ fontSize: '16px', fontWeight: 'bold', color: '#2563eb', margin: 0 }}>{totalConfirmadas} de {movimentacoes.length}</h4>
          </div>
        </div>
      </div>

      {/* TABELA DO RELATÓRIO */}
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
              <th style={{ padding: '10px 12px' }}>Data</th>
              <th style={{ padding: '10px 12px' }}>Tipo</th>
              <th style={{ padding: '10px 12px' }}>Material</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Qtd.</th>
              <th style={{ padding: '10px 12px' }}>Origem</th>
              <th style={{ padding: '10px 12px' }}>Destino</th>
              <th style={{ padding: '10px 12px' }}>Status</th>
              <th style={{ padding: '10px 12px' }}>Observação</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Gerando relatório...</td>
              </tr>
            ) : movimentacoes.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Nenhuma movimentação atende aos filtros selecionados.</td>
              </tr>
            ) : (
              movimentacoes.map((item) => {
                const ehEntrada = ['ENTRADA_FORNECEDOR', 'TRANSFERENCIA_ENTRADA', 'AJUSTE'].includes(item.tipo_movimentacao);
                return (
                  <tr key={`rel-mov-${item.id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', color: '#334155', fontWeight: 'bold' }}>
                      {item.data_movimentacao ? new Date(item.data_movimentacao).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontWeight: 'bold', color: ehEntrada ? '#16a34a' : '#dc2626' }}>
                        {item.tipo_movimentacao}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#0f172a' }}>
                      {item.material_nome}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', color: ehEntrada ? '#16a34a' : '#dc2626' }}>
                      {ehEntrada ? `+${item.quantidade}` : `-${item.quantidade}`} {item.unidade_medida || 'UN'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>
                      {item.origem_nome ? `${item.origem_tipo} (${item.origem_nome})` : item.origem_tipo || '-'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>
                      {item.destino_nome ? `${item.destino_tipo} (${item.destino_nome})` : item.destino_tipo || '-'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ 
                        padding: '3px 8px', 
                        borderRadius: '12px', 
                        fontSize: '9px', 
                        fontWeight: 'bold',
                        backgroundColor: item.status === 'CONFIRMADO' ? '#dcfce7' : '#fef3c7',
                        color: item.status === 'CONFIRMADO' ? '#15803d' : '#b45309'
                      }}>
                        {item.status || 'PENDENTE'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.observacao || '-'}
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