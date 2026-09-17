import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Loader2, BarChart3, TrendingUp, TrendingDown, DollarSign, 
  Filter, Calendar, Building2, HardHat, RefreshCw 
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ReferenceLine 
} from 'recharts';

export default function RelatorioCustos({ API_URL, mostrarMensagem }) {
  const [carregando, setCarregando] = useState(false);
  
  // Listas de Opções dos Filtros
  const [categorias, setCategorias] = useState([]);
  const [obras, setObras] = useState([]);
  const [centrosCusto, setCentrosCusto] = useState([]);

  // Estados dos Filtros
  const [preset, setPreset] = useState('30d'); // Default: 30 dias
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [tipoDestino, setTipoDestino] = useState(''); // 'OBRA' ou 'CENTRO_CUSTO'
  const [destinoId, setDestinoId] = useState('');

  // Estado com os dados do Relatório
  const [dadosRelatorio, setDadosRelatorio] = useState(null);

  // Carrega opções dos Filtros (Categorias, Obras, Centros)
  useEffect(() => {
    carregarFiltrosIniciais();
  }, []);

  // Recarrega relatório quando altera filtros de atalho ou filtros dropdown
// Atualiza o useEffect para disparar a busca quando datas manuais mudarem também
useEffect(() => {
  carregarRelatorio();
}, [preset, categoriaId, tipoDestino, destinoId, dataInicio, dataFim]);

  const carregarFiltrosIniciais = async () => {
    try {
      // Carrega Centros e Obras
      const resDestinos = await axios.get(`${API_URL}/financeiro/centros-custo-obras`);
      setCentrosCusto(resDestinos.data.centrosCusto || []);
      setObras(resDestinos.data.obras || []);

      // Carrega Categorias (pode adaptar para sua rota de busca de categorias)
      const resCat = await axios.get(`${API_URL}/categorias-financeiras`);
      setCategorias(resCat.data || []);
    } catch (err) {
      console.error("Erro ao carregar filtros:", err);
    }
  };

  const carregarRelatorio = async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      
      if (preset) params.append('periodo_preset', preset);
      if (dataInicio && dataFim && !preset) {
        params.append('data_inicio', dataInicio);
        params.append('data_fim', dataFim);
      }
      if (categoriaId) params.append('categoria_id', categoriaId);
      if (tipoDestino) params.append('tipo_destino', tipoDestino);
      if (destinoId) params.append('destino_id', destinoId);

      const res = await axios.get(`${API_URL}/financeiro/relatorio-geral?${params.toString()}`);
      setDadosRelatorio(res.data);
    } catch (err) {
      console.error("Erro ao carregar relatório:", err);
      if (mostrarMensagem) mostrarMensagem("Erro ao atualizar relatório financeiro.", "erro");
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

  const handleDataManualSubmit = (e) => {
    e.preventDefault();
    setPreset(''); // Limpa o preset para dar prioridade à data customizada
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
            <h3 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>Filtros de Análise Financeira</h3>
          </div>

          {/* Atalhos de Período (Req. 6) */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: '7d', label: '1 Semana' },
              { id: '30d', label: '30 Dias' },
              { id: '6m', label: '6 Meses' },
              { id: '12m', label: '12 Meses' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handlePresetChange(p.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: preset === p.id ? '#2563eb' : '#cbd5e1',
                  backgroundColor: preset === p.id ? '#eff6ff' : '#fff',
                  color: preset === p.id ? '#1d4ed8' : '#475569',
                  fontWeight: preset === p.id ? 'bold' : 'normal',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Linha dos Selects e Datas Customizadas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          
          {/* Filtro por Categoria (Req. 3) */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>Categoria</label>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px' }}
            >
              <option value="">-- Todas as Categorias --</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          {/* Filtro Obra / Centro Custo (Req. 4) */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>Destino (Obra / Centro)</label>
            <select
              value={tipoDestino ? `${tipoDestino}:${destinoId}` : ''}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  setTipoDestino('');
                  setDestinoId('');
                } else {
                  const [tipo, id] = val.split(':');
                  setTipoDestino(tipo);
                  setDestinoId(id);
                }
              }}
              style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px' }}
            >
              <option value="">-- Todos os Destinos --</option>
              <optgroup label="Obras">
                {obras.map((o) => (
                  <option key={`OBRA:${o.id}`} value={`OBRA:${o.id}`}>🏗️ {o.nome}</option>
                ))}
              </optgroup>
              <optgroup label="Centros de Custo">
                {centrosCusto.map((c) => (
                  <option key={`CENTRO_CUSTO:${c.id}`} value={`CENTRO_CUSTO:${c.id}`}>🏢 {c.nome}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Filtro Intervalo Customizado de Data (Req. 2) */}
          <div style={{ gridColumn: 'span 2', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>Data Início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>Data Fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px' }}
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
          <p style={{ marginTop: '12px', color: '#64748b', fontSize: '13px' }}>Consolidando dados financeiros...</p>
        </div>
      ) : dadosRelatorio ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
{/* CARDS DINÂMICOS QUE REAGEM AOS FILTROS */}
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
  
  <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', borderLeft: '4px solid #16a34a' }}>
    <span style={{ fontSize: '11px', color: '#166534', fontWeight: 'bold' }}>RECEITAS FILTRADAS</span>
    <p style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#15803d' }}>
      {formatarMoeda(dadosRelatorio.resumoFiltrado?.total_receitas)}
    </p>
  </div>

  <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', borderLeft: '4px solid #dc2626' }}>
    <span style={{ fontSize: '11px', color: '#991b1b', fontWeight: 'bold' }}>DESPESAS FILTRADAS</span>
    <p style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#b91c1c' }}>
      {formatarMoeda(dadosRelatorio.resumoFiltrado?.total_despesas)}
    </p>
  </div>

  <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', borderLeft: '4px solid #2563eb' }}>
    <span style={{ fontSize: '11px', color: '#1e40af', fontWeight: 'bold' }}>BALANÇO LÍQUIDO</span>
    <p style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#1d4ed8' }}>
      {formatarMoeda(dadosRelatorio.resumoFiltrado?.resultado_liquido)}
    </p>
  </div>

</div>
{/* GRÁFICO DE HISTÓRICO & MÉDIA DE DESPESAS */}
<div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
    <div>
      <h4 style={{ margin: 0, fontSize: '14px', color: '#1e293b' }}>Evolução Financeira</h4>
      <span style={{ fontSize: '11px', color: '#64748b' }}>
        Média Mensal de Despesas: <strong>{formatarMoeda(dadosRelatorio.mediaMensal?.despesas)}</strong>
      </span>
    </div>
  </div>

  <div style={{ width: '100%', height: 300 }}>
    <ResponsiveContainer width="100%" height="100%">
      {/* CORREÇÃO AQUI: trocado dadosGrafico12Meses por dadosGrafico */}
      <AreaChart data={dadosRelatorio.dadosGrafico || []}>
        <defs>
          <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="mes_formatado" style={{ fontSize: '11px' }} />
        <YAxis style={{ fontSize: '11px' }} tickFormatter={(v) => `R$ ${v/1000}k`} />
        <Tooltip formatter={(value) => formatarMoeda(value)} />
        <Legend />
        
        {/* CORREÇÃO AQUI: trocado media12Meses por mediaMensal */}
        <ReferenceLine 
          y={dadosRelatorio.mediaMensal?.despesas} 
          label={{ value: 'Média Despesas', fill: '#dc2626', fontSize: 10, position: 'top' }} 
          stroke="#dc2626" 
          strokeDasharray="3 3" 
        />

        <Area type="monotone" dataKey="receitas" name="Receitas" stroke="#22c55e" fillOpacity={1} fill="url(#colorReceitas)" />
        <Area type="monotone" dataKey="despesas" name="Despesas" stroke="#ef4444" fillOpacity={1} fill="url(#colorDespesas)" />
      </AreaChart>
    </ResponsiveContainer>
  </div>
</div>
          {/* TABELA DE CATEGORIAS DO PERÍODO SELECIONADO */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#1e293b' }}>
              Totais por Categoria no Período Selecionado
            </h4>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '10px' }}>Categoria</th>
                    <th style={{ padding: '10px' }}>Tipo</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Qtd Lançamentos</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Total Categoria</th>
                  </tr>
                </thead>
                <tbody>
                  {!dadosRelatorio.tabelaCategorias || dadosRelatorio.tabelaCategorias.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>Nenhum lançamento encontrado para os filtros aplicados.</td>
                    </tr>
                  ) : (
                    dadosRelatorio.tabelaCategorias.map((row, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px', fontWeight: 'bold', color: '#334155' }}>{row.categoria}</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            backgroundColor: row.tipo === 'RECEITA' ? '#dcfce7' : '#fee2e2',
                            color: row.tipo === 'RECEITA' ? '#15803d' : '#b91c1c'
                          }}>
                            {row.tipo}
                          </span>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>{row.qtd_lancamentos}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>
                          {formatarMoeda(row.valor_total_categoria)}
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