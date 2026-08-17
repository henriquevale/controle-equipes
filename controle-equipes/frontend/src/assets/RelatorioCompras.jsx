import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ShoppingBag, Truck, Building2, Filter, 
  DollarSign, Package, ArrowUpDown
} from 'lucide-react';

export default function RelatorioCompras({ API_URL, mostrarMensagem }) {
  // Aba ativa: 'materiais' | 'fornecedores' | 'obras'
  const [abaAtiva, setAbaAtiva] = useState('materiais'); 
  
  // Listas de dados dos relatórios
  const [dadosMateriais, setDadosMateriais] = useState([]);
  const [dadosFornecedores, setDadosFornecedores] = useState([]);
  const [dadosObras, setDadosObras] = useState([]);

  // Listas auxiliares para selects dos filtros
  const [fornecedoresLista, setFornecedoresLista] = useState([]);
  const [materiaisLista, setMateriaisLista] = useState([]);
  const [obrasLista, setObrasLista] = useState([]);

  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [filtroFornecedor, setFiltroFornecedor] = useState('');
  const [filtroMaterial, setFiltroMaterial] = useState('');
  const [filtroObra, setFiltroObra] = useState('');
  const [ordenacao, setOrdenacao] = useState('maior_gasto');

  useEffect(() => {
    carregarFiltrosAuxiliares();
  }, []);

  useEffect(() => {
    carregarRelatorios();
  }, [abaAtiva, ordenacao]); // Recarrega ao trocar de aba ou mudar ordenação

  const carregarFiltrosAuxiliares = async () => {
    try {
      const [resForn, resMat, resObras] = await Promise.all([
        axios.get(`${API_URL}/fornecedores`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/materiais`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/obras`).catch(() => ({ data: [] }))
      ]);
      setFornecedoresLista(resForn.data || []);
      setMateriaisLista(resMat.data || []);
      setObrasLista(resObras.data || []);
    } catch (e) {
      console.error("Erro ao carregar filtros auxiliares:", e);
    }
  };

  const carregarRelatorios = async () => {
    try {
      const paramsBase = {
        data_inicio: dataInicio,
        data_fim: dataFim,
        ordenacao
      };

      if (abaAtiva === 'materiais') {
        const resMat = await axios.get(`${API_URL}/relatorios/compras-por-material`, {
          params: { ...paramsBase, fornecedor_id: filtroFornecedor, obra_id: filtroObra }
        });
        setDadosMateriais(resMat.data || []);
      } else if (abaAtiva === 'fornecedores') {
        const resForn = await axios.get(`${API_URL}/relatorios/compras-por-fornecedor`, {
          params: { ...paramsBase, material_id: filtroMaterial, obra_id: filtroObra }
        });
        setDadosFornecedores(resForn.data || []);
      } else if (abaAtiva === 'obras') {
        const resObra = await axios.get(`${API_URL}/relatorios/compras-por-obra`, {
          params: { ...paramsBase, fornecedor_id: filtroFornecedor, material_id: filtroMaterial }
        });
        setDadosObras(resObra.data || []);
      }
    } catch (e) {
      console.error("Erro ao carregar relatório:", e);
      if (mostrarMensagem) mostrarMensagem("Erro ao carregar relatório de compras.", "erro");
    }
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    carregarRelatorios();
  };

  // Cálculo dos cards de resumo
  const totalGastoAtual = (
    abaAtiva === 'materiais' ? dadosMateriais :
    abaAtiva === 'fornecedores' ? dadosFornecedores : dadosObras
  ).reduce((acc, item) => acc + parseFloat(item.valor_total_gasto || 0), 0);

  const totalPedidosAtual = (
    abaAtiva === 'materiais' ? dadosMateriais :
    abaAtiva === 'fornecedores' ? dadosFornecedores : dadosObras
  ).reduce((acc, item) => acc + parseInt(item.total_pedidos || 0), 0);

  const inputStyle = {
    height: '32px',
    padding: '0 8px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '11px',
    backgroundColor: '#fff',
    outline: 'none'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* METRICAS DE CABEÇALHO */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#dbeafe', padding: '10px', borderRadius: '8px', color: '#2563eb' }}>
            <DollarSign style={{ width: '20px', height: '20px' }} />
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Volume Total de Compras</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>
              R$ {totalGastoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#dcfce7', padding: '10px', borderRadius: '8px', color: '#16a34a' }}>
            <ShoppingBag style={{ width: '20px', height: '20px' }} />
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Pedidos Registrados</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>{totalPedidosAtual} pedidos</div>
          </div>
        </div>

        <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#f3e8ff', padding: '10px', borderRadius: '8px', color: '#9333ea' }}>
            <Building2 style={{ width: '20px', height: '20px' }} />
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Registros em Exibição</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>
              {abaAtiva === 'materiais' ? `${dadosMateriais.length} itens` :
               abaAtiva === 'fornecedores' ? `${dadosFornecedores.length} fornecedores` : `${dadosObras.length} obras`}
            </div>
          </div>
        </div>
      </div>

      {/* PAINEL DE FILTROS & ORDENAÇÃO */}
      <form onSubmit={handleFiltrar} style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '4px' }}>DATA INÍCIO</label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '4px' }}>DATA FIM</label>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={inputStyle} />
        </div>

        {abaAtiva !== 'fornecedores' && (
          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '4px' }}>FORNECEDOR</label>
            <select value={filtroFornecedor} onChange={e => setFiltroFornecedor(e.target.value)} style={inputStyle}>
              <option value="">-- Todos os Fornecedores --</option>
              {fornecedoresLista.map(f => (
                <option key={f.id} value={f.id}>{f.nome_fantasia}</option>
              ))}
            </select>
          </div>
        )}

        {abaAtiva !== 'materiais' && (
          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '4px' }}>MATERIAL</label>
            <select value={filtroMaterial} onChange={e => setFiltroMaterial(e.target.value)} style={inputStyle}>
              <option value="">-- Todos os Materiais --</option>
              {materiaisLista.map(m => (
                <option key={m.id} value={m.id}>{m.descricao}</option>
              ))}
            </select>
          </div>
        )}

        {abaAtiva !== 'obras' && (
          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '4px' }}>OBRA</label>
            <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={inputStyle}>
              <option value="">-- Todas as Obras --</option>
              {obrasLista.map(o => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#0284c7', display: 'block', marginBottom: '4px' }}>ORDENAR POR</label>
          <select value={ordenacao} onChange={e => setOrdenacao(e.target.value)} style={{ ...inputStyle, borderColor: '#0284c7', fontWeight: 'bold' }}>
            <option value="maior_gasto">Maior Gasto (R$)</option>
            <option value="menor_gasto">Menor Gasto (R$)</option>
            <option value="maior_qtd">{abaAtiva === 'materiais' ? 'Maior Qtd Comprada' : 'Maior Nº de Pedidos'}</option>
            <option value="menor_qtd">{abaAtiva === 'materiais' ? 'Menor Qtd Comprada' : 'Menor Nº de Pedidos'}</option>
            <option value="ultima_compra">Última Compra (Recente)</option>
            <option value="primeira_compra">Primeira Compra (Antiga)</option>
          </select>
        </div>

        <button type="submit" style={{ height: '32px', padding: '0 12px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Filter style={{ width: '12px', height: '12px' }} /> Filtrar
        </button>
      </form>

      {/* ABAS */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0' }}>
        <button 
          onClick={() => setAbaAtiva('materiais')} 
          style={{ 
            padding: '8px 16px', fontWeight: 'bold', fontSize: '12px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: abaAtiva === 'materiais' ? '3px solid #0284c7' : 'none',
            color: abaAtiva === 'materiais' ? '#0284c7' : '#64748b'
          }}
        >
          <Package style={{ width: '14px', height: '14px', display: 'inline', marginRight: '6px' }} />
          Compras por Produto/Material
        </button>

        <button 
          onClick={() => setAbaAtiva('fornecedores')} 
          style={{ 
            padding: '8px 16px', fontWeight: 'bold', fontSize: '12px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: abaAtiva === 'fornecedores' ? '3px solid #0284c7' : 'none',
            color: abaAtiva === 'fornecedores' ? '#0284c7' : '#64748b'
          }}
        >
          <Truck style={{ width: '14px', height: '14px', display: 'inline', marginRight: '6px' }} />
          Compras por Fornecedor
        </button>

        <button 
          onClick={() => setAbaAtiva('obras')} 
          style={{ 
            padding: '8px 16px', fontWeight: 'bold', fontSize: '12px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: abaAtiva === 'obras' ? '3px solid #0284c7' : 'none',
            color: abaAtiva === 'obras' ? '#0284c7' : '#64748b'
          }}
        >
          <Building2 style={{ width: '14px', height: '14px', display: 'inline', marginRight: '6px' }} />
          Compras por Obra (Demandantes)
        </button>
      </div>

      {/* TABELA DE RESULTADOS */}
      <div style={{ overflowX: 'auto', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
        
        {/* TABELA 1: MATERIAIS */}
        {abaAtiva === 'materiais' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '10px' }}>Produto / Material</th>
                <th style={{ padding: '10px' }}>Qtd. Total Comprada</th>
                <th style={{ padding: '10px' }}>Frequência (Nº Pedidos)</th>
                <th style={{ padding: '10px' }}>Preço Médio Un.</th>
                <th style={{ padding: '10px' }}>Menor / Maior Preço</th>
                <th style={{ padding: '10px' }}>Total Gasto (R$)</th>
                <th style={{ padding: '10px' }}>Última Compra</th>
              </tr>
            </thead>
            <tbody>
              {dadosMateriais.length === 0 ? (
                <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Nenhum dado encontrado para os filtros selecionados.</td></tr>
              ) : (
                dadosMateriais.map((m) => (
                  <tr key={m.material_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{m.material_nome} ({m.unidade_medida})</td>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{parseFloat(m.quantidade_total_comprada || 0).toLocaleString('pt-BR')}</td>
                    <td style={{ padding: '10px', color: '#0284c7' }}>{m.total_pedidos} compras</td>
                    <td style={{ padding: '10px' }}>R$ {parseFloat(m.preco_medio_unitario || 0).toFixed(2)}</td>
                    <td style={{ padding: '10px', fontSize: '10px', color: '#64748b' }}>
                      R$ {parseFloat(m.menor_preco_unitario || 0).toFixed(2)} / R$ {parseFloat(m.maior_preco_unitario || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#16a34a' }}>
                      R$ {parseFloat(m.valor_total_gasto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px' }}>{m.ultima_compra ? new Date(m.ultima_compra).toLocaleDateString('pt-BR') : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* TABELA 2: FORNECEDORES */}
        {abaAtiva === 'fornecedores' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '10px' }}>Fornecedor</th>
                <th style={{ padding: '10px' }}>CNPJ</th>
                <th style={{ padding: '10px' }}>Nº de Pedidos</th>
                <th style={{ padding: '10px' }}>Diversidade de Produtos</th>
                <th style={{ padding: '10px' }}>Volume Total (R$)</th>
                <th style={{ padding: '10px' }}>Período Compras</th>
              </tr>
            </thead>
            <tbody>
              {dadosFornecedores.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Nenhum dado encontrado para os filtros selecionados.</td></tr>
              ) : (
                dadosFornecedores.map((f) => (
                  <tr key={f.fornecedor_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontWeight: 'bold' }}>{f.nome_fantasia}</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>{f.razao_social}</div>
                    </td>
                    <td style={{ padding: '10px' }}>{f.cnpj || '-'}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#0284c7' }}>{f.total_pedidos} pedidos</td>
                    <td style={{ padding: '10px' }}>{f.diversidade_produtos} itens diferentes</td>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#16a34a' }}>
                      R$ {parseFloat(f.valor_total_gasto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px', fontSize: '10px', color: '#64748b' }}>
                      {f.primeira_compra ? new Date(f.primeira_compra).toLocaleDateString('pt-BR') : '-'} até {f.ultima_compra ? new Date(f.ultima_compra).toLocaleDateString('pt-BR') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* TABELA 3: OBRAS */}
        {abaAtiva === 'obras' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '10px' }}>Nome da Obra</th>
                <th style={{ padding: '10px' }}>Total de Pedidos</th>
                <th style={{ padding: '10px' }}>Variedade de Produtos</th>
                <th style={{ padding: '10px' }}>Total Consumido (R$)</th>
                <th style={{ padding: '10px' }}>Primeira Solicitacao</th>
                <th style={{ padding: '10px' }}>Última Solicitacao</th>
              </tr>
            </thead>
            <tbody>
              {dadosObras.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Nenhum dado encontrado para os filtros selecionados.</td></tr>
              ) : (
                dadosObras.map((o) => (
                  <tr key={o.obra_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#1e293b' }}>{o.obra_nome}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#0284c7' }}>{o.total_pedidos} pedidos</td>
                    <td style={{ padding: '10px' }}>{o.diversidade_produtos} materiais diferentes</td>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#16a34a' }}>
                      R$ {parseFloat(o.valor_total_gasto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px', color: '#64748b' }}>{o.primeira_compra ? new Date(o.primeira_compra).toLocaleDateString('pt-BR') : '-'}</td>
                    <td style={{ padding: '10px', color: '#64748b' }}>{o.ultima_compra ? new Date(o.ultima_compra).toLocaleDateString('pt-BR') : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

      </div>
    </div>
  );
}