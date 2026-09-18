import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Loader2, CreditCard, Filter, Calendar, 
  CheckCircle, Clock, Download, Building2, Tag
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ReferenceLine
} from 'recharts';

export default function RelatorioFaturasPF({ API_URL, mostrarMensagem }) {
  const [carregando, setCarregando] = useState(false);

  // Estados dos Filtros
  const [preset, setPreset] = useState('30d');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [banco, setBanco] = useState('');
  const [favorecido, setFavorecido] = useState('');
  const [solicitante, setSolicitante] = useState('');
  const [categoria, setCategoria] = useState('');
  const [conciliado, setConciliado] = useState('');

  // Estados de dados da API
  const [listaCategorias, setListaCategorias] = useState([]);
  const [dadosRelatorio, setDadosRelatorio] = useState(null);

  // Carrega opções de categorias no primeiro carregamento
  useEffect(() => {
    carregarCategorias();
  }, []);

  // Recarrega relatório ao alterar os filtros principais
  useEffect(() => {
    carregarRelatorio();
  }, [preset, banco, conciliado, categoria, dataInicio, dataFim]);

  const carregarCategorias = async () => {
    try {
      const res = await axios.get(`${API_URL}/categorias-financeiras`);
      setListaCategorias(res.data || []);
    } catch (err) {
      console.error("Erro ao carregar lista de categorias:", err);
    }
  };

  const carregarRelatorio = async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      
      // Se houver datas de início e fim, prioriza o intervalo customizado
      if (dataInicio && dataFim) {
        params.append('data_inicio', dataInicio);
        params.append('data_fim', dataFim);
      } else if (preset) {
        params.append('periodo_preset', preset);
      }

      if (banco) params.append('banco', banco);
      if (favorecido) params.append('favorecido', favorecido);
      if (solicitante) params.append('solicitante', solicitante);
      if (categoria) params.append('categoria', categoria);
      if (conciliado) params.append('conciliado', conciliado);

      const res = await axios.get(`${API_URL}/faturas-pessoa-fisica/relatorio?${params.toString()}`);
      setDadosRelatorio(res.data);
    } catch (err) {
      console.error("Erro ao carregar relatório de faturas:", err);
      if (mostrarMensagem) mostrarMensagem("Erro ao atualizar relatório de faturas PF.", "erro");
    } finally {
      setCarregando(false);
    }
  };

  const formatarMoeda = (valor) => {
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handlePresetChange = (novoPreset) => {
    setPreset(novoPreset);
    setDataInicio('');
    setDataFim('');
  };

  const handleDataInicioChange = (e) => {
    setDataInicio(e.target.value);
    setPreset(''); // Limpa o preset para permitir a busca por intervalo exato
  };

  const handleDataFimChange = (e) => {
    setDataFim(e.target.value);
    setPreset(''); // Limpa o preset para permitir a busca por intervalo exato
  };

  const handleDataManualSubmit = (e) => {
    if (e) e.preventDefault();
    setPreset('');
    carregarRelatorio();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'sans-serif' }}>
      
      {/* SEÇÃO DE FILTROS */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Cabeçalho Filtros */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter style={{ width: '18px', height: '18px', color: '#2563eb' }} />
            <h3 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>Filtros de Faturas Pessoa Física</h3>
          </div>
        </div>

        {/* Linha dos Selects e Inputs de Filtro */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          
          {/* Select de Período Pré-definido */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>Período Rápido</label>
            <select
              value={preset}
              onChange={(e) => handlePresetChange(e.target.value)}
              style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px' }}
            >
              <option value="">-- Personalizado --</option>
              <option value="7d">1 Semana</option>
              <option value="30d">30 Dias</option>
              <option value="6m">6 Meses</option>
              <option value="12m">12 Meses</option>
            </select>
          </div>

          {/* Filtro por Categoria */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>Categoria</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px' }}
            >
              <option value="">-- Todas as Categorias --</option>
              {listaCategorias.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.nome}</option>
              ))}
            </select>
          </div>

          {/* Filtro por Banco */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>Banco</label>
            <select
              value={banco}
              onChange={(e) => setBanco(e.target.value)}
              style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px' }}
            >
              <option value="">-- Todos os Bancos --</option>
              <option value="BB">Banco do Brasil (BB)</option>
              <option value="SANTANDER">Santander</option>
            </select>
          </div>

          {/* Filtro por Status Conciliação */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>Conciliação</label>
            <select
              value={conciliado}
              onChange={(e) => setConciliado(e.target.value)}
              style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px' }}
            >
              <option value="">-- Todos os Status --</option>
              <option value="CONCILIADO">Conciliado</option>
              <option value="PENDENTE">Pendente</option>
            </select>
          </div>

          {/* Filtro por Favorecido */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>Favorecido</label>
            <input
              type="text"
              placeholder="Buscar favorecido..."
              value={favorecido}
              onChange={(e) => setFavorecido(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && carregarRelatorio()}
              style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px', boxSizing: 'border-box' }}
            />
          </div>

          {/* Filtro por Solicitante */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>Solicitante</label>
            <input
              type="text"
              placeholder="Buscar solicitante..."
              value={solicitante}
              onChange={(e) => setSolicitante(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && carregarRelatorio()}
              style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px', boxSizing: 'border-box' }}
            />
          </div>

          {/* Intervalo Customizado de Data */}
          <div style={{ gridColumn: 'span 2', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>Data Início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={handleDataInicioChange}
                style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>Data Fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={handleDataFimChange}
                style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px', boxSizing: 'border-box' }}
              />
            </div>
            <button
              onClick={handleDataManualSubmit}
              disabled={!dataInicio || !dataFim}
              style={{ height: '36px', padding: '0 12px', borderRadius: '6px', backgroundColor: '#2563eb', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
            >
              Filtrar
            </button>
          </div>

        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      {carregando ? (
        <div style={{ textAlign: 'center', padding: '60px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <Loader2 className="animate-spin" style={{ width: '32px', height: '32px', margin: '0 auto', color: '#2563eb' }} />
          <p style={{ marginTop: '12px', color: '#64748b', fontSize: '13px' }}>Consolidando relatório de faturas...</p>
        </div>
      ) : dadosRelatorio ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* CARDS DINÂMICOS DA FATURA */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            
            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', borderLeft: '4px solid #2563eb' }}>
              <span style={{ fontSize: '11px', color: '#1e40af', fontWeight: 'bold' }}>TOTAL FATURADO</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#1d4ed8' }}>
                {formatarMoeda(dadosRelatorio.resumoFiltrado?.total_valor)}
              </p>
              <span style={{ fontSize: '10px', color: '#64748b' }}>{dadosRelatorio.resumoFiltrado?.total_registros || 0} faturas registradas</span>
            </div>

            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', borderLeft: '4px solid #16a34a' }}>
              <span style={{ fontSize: '11px', color: '#166534', fontWeight: 'bold' }}>VALOR CONCILIADO</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#15803d' }}>
                {formatarMoeda(dadosRelatorio.resumoFiltrado?.total_conciliado)}
              </p>
            </div>

            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', borderLeft: '4px solid #d97706' }}>
              <span style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold' }}>PENDENTE DE CONCILIAÇÃO</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#b45309' }}>
                {formatarMoeda(dadosRelatorio.resumoFiltrado?.total_pendente)}
              </p>
            </div>

            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', borderLeft: '4px solid #854d0e' }}>
              <span style={{ fontSize: '11px', color: '#854d0e', fontWeight: 'bold' }}>BANCO DO BRASIL (BB)</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#a16207' }}>
                {formatarMoeda(dadosRelatorio.resumoFiltrado?.total_bb)}
              </p>
            </div>

            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', borderLeft: '4px solid #991b1b' }}>
              <span style={{ fontSize: '11px', color: '#991b1b', fontWeight: 'bold' }}>SANTANDER</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#b91c1c' }}>
                {formatarMoeda(dadosRelatorio.resumoFiltrado?.total_santander)}
              </p>
            </div>

          </div>

          {/* GRÁFICO DE HISTÓRICO & MENSAL DE FATURAS */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', color: '#1e293b' }}>Evolução Mensal dos Gastos em Faturas</h4>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Média Mensal: <strong>{formatarMoeda(dadosRelatorio.mediaMensal?.faturas)}</strong>
                </span>
              </div>
            </div>

            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dadosRelatorio.dadosGrafico || []}>
                  <defs>
                    <linearGradient id="colorFaturas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes_formatado" style={{ fontSize: '11px' }} />
                  <YAxis style={{ fontSize: '11px' }} tickFormatter={(v) => `R$ ${v/1000}k`} />
                  <Tooltip formatter={(value) => formatarMoeda(value)} />
                  <Legend />
                  
                  <ReferenceLine 
                    y={dadosRelatorio.mediaMensal?.faturas} 
                    label={{ value: 'Média Mensal', fill: '#2563eb', fontSize: 10, position: 'top' }} 
                    stroke="#2563eb" 
                    strokeDasharray="3 3" 
                  />

                  <Area type="monotone" dataKey="total" name="Total Gastos Faturas" stroke="#2563eb" fillOpacity={1} fill="url(#colorFaturas)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TABELA DE GASTOS AGRUPADOS POR CATEGORIA */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tag size={16} style={{ color: '#2563eb' }} />
              Totais por Categoria no Período Selecionado
            </h4>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '10px' }}>Categoria</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Qtd Faturas</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Total BB</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Total Santander</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Total Geral</th>
                  </tr>
                </thead>
                <tbody>
                  {!dadosRelatorio.tabelaCategorias || dadosRelatorio.tabelaCategorias.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>Nenhuma categoria encontrada para os filtros aplicados.</td>
                    </tr>
                  ) : (
                    dadosRelatorio.tabelaCategorias.map((row, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px', fontWeight: 'bold', color: '#334155' }}>{row.categoria}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>{row.qtd_faturas}</td>
                        <td style={{ padding: '10px', textAlign: 'right', color: '#854d0e' }}>
                          {formatarMoeda(row.total_bb)}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', color: '#991b1b' }}>
                          {formatarMoeda(row.total_santander)}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#1e293b' }}>
                          {formatarMoeda(row.total_geral)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : null}

    </div>
  );
}