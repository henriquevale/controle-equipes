import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Loader2, Filter, DollarSign, TrendingUp, TrendingDown, 
  CreditCard, PieChart, ShieldAlert, CheckCircle2, FileText 
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend 
} from 'recharts';

export default function DashboardGeral({ API_URL, mostrarMensagem }) {
  const [carregando, setCarregando] = useState(false);

  // Filtros
  const [preset, setPreset] = useState('30d');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [obraId, setObraId] = useState('');

  // Opções dos selects
  const [categorias, setCategorias] = useState([]);
  const [obras, setObras] = useState([]);

  // Dados unificados
  const [dados, setDados] = useState(null);

  useEffect(() => {
    carregarFiltros();

    // Recarrega o dashboard ao retornar a esta aba/janela do navegador
    const handleFocus = () => carregarDashboard();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  useEffect(() => {
    carregarDashboard();
  }, [preset, categoriaId, obraId, dataInicio, dataFim]);

  const carregarFiltros = async () => {
    try {
      const [resCat, resObras] = await Promise.all([
        axios.get(`${API_URL}/categorias-financeiras`),
        axios.get(`${API_URL}/faturas-pessoa-fisica-obras`)
      ]);
      setCategorias(resCat.data || []);
      setObras(resObras.data || []);
    } catch (err) {
      console.error("Erro ao carregar filtros do dashboard:", err);
    }
  };

  const carregarDashboard = async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (dataInicio && dataFim) {
        params.append('data_inicio', dataInicio);
        params.append('data_fim', dataFim);
      } else if (preset) {
        params.append('periodo_preset', preset);
      }

      if (categoriaId) params.append('categoria_id', categoriaId);
      if (obraId) params.append('obra_id', obraId);

      // Adiciona parâmetro com timestamp _t para evitar cache do navegador/proxy
      params.append('_t', Date.now().toString());

      const res = await axios.get(`${API_URL}/financeiro/dashboard-geral?${params.toString()}`);
      setDados(res.data);
    } catch (err) {
      console.error("Erro ao carregar dashboard geral:", err);
      if (mostrarMensagem) mostrarMensagem("Erro ao carregar dashboard geral.", "erro");
    } finally {
      setCarregando(false);
    }
  };

  // Formata o valor monetário. O segundo parâmetro 'forcarNegativo' força o sinal '-' para saídas
  const formatarMoeda = (valor, forcarNegativo = false) => {
    let num = Number(valor || 0);
    if (forcarNegativo && num > 0) num = -num;

    const formatado = Math.abs(num).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (num < 0) return `- ${formatado}`;
    return formatado;
  };

  // Cor baseada no valor: > 0 verde, < 0 vermelho, 0 preto
  const obterCorValor = (valor, forcarNegativo = false) => {
    let num = Number(valor || 0);
    if (forcarNegativo && num > 0) num = -num;

    if (num > 0) return '#16a34a'; // Verde
    if (num < 0) return '#dc2626'; // Vermelho
    return '#0f172a';             // Preto
  };

  // Cálculos para o Rodapé da Tabela
  const totaisTabela = React.useMemo(() => {
    if (!dados?.tabelaCategorias) return { qtdCustos: 0, totalCusto: 0, qtdPF: 0, totalPF: 0, qtdTotal: 0, totalGeral: 0 };

    return dados.tabelaCategorias.reduce((acc, item) => {
      const qCusto = Number(item.qtdCustos || 0);
      const isSaida = item.tipo !== 'RECEITA';
      
      const tCustoRaw = Number(item.totalCusto || 0);
      const tCusto = isSaida && tCustoRaw > 0 ? -tCustoRaw : tCustoRaw;

      const qPF = Number(item.qtdPF || 0);
      const tPFRaw = Number(item.totalPF || 0);
      const tPF = tPFRaw > 0 ? -tPFRaw : tPFRaw;

      acc.qtdCustos += qCusto;
      acc.totalCusto += tCusto;
      acc.qtdPF += qPF;
      acc.totalPF += tPF;
      acc.qtdTotal += (qCusto + qPF);
      acc.totalGeral += (tCusto + tPF);

      return acc;
    }, { qtdCustos: 0, totalCusto: 0, qtdPF: 0, totalPF: 0, qtdTotal: 0, totalGeral: 0 });
  }, [dados?.tabelaCategorias]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'sans-serif' }}>
      
      {/* PAINEL DE FILTROS */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
          <Filter style={{ width: '18px', height: '18px', color: '#2563eb' }} />
          <h3 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>Filtros do Dashboard Consolidado</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>Período Rápido</label>
            <select value={preset} onChange={(e) => { setPreset(e.target.value); setDataInicio(''); setDataFim(''); }} style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px' }}>
              <option value="">-- Personalizado --</option>
              <option value="7d">1 Semana</option>
              <option value="30d">30 Dias</option>
              <option value="6m">6 Meses</option>
              <option value="12m">12 Meses</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>Categoria</label>
            <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px' }}>
              <option value="">-- Todas as Categorias --</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>Obra</label>
            <select value={obraId} onChange={(e) => setObraId(e.target.value)} style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px' }}>
              <option value="">-- Todas as Obras --</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>{o.nome_obra || o.nome}</option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: 'span 2', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>Data Início</label>
              <input type="date" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); setPreset(''); }} style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>Data Fim</label>
              <input type="date" value={dataFim} onChange={(e) => { setDataFim(e.target.value); setPreset(''); }} style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px' }} />
            </div>
            <button onClick={() => { setPreset(''); carregarDashboard(); }} disabled={!dataInicio || !dataFim} style={{ height: '36px', padding: '0 12px', borderRadius: '6px', backgroundColor: '#2563eb', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
              Filtrar
            </button>
          </div>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      {carregando ? (
        <div style={{ textAlign: 'center', padding: '60px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <Loader2 className="animate-spin" style={{ width: '32px', height: '32px', margin: '0 auto', color: '#2563eb' }} />
          <p style={{ marginTop: '12px', color: '#64748b', fontSize: '13px' }}>Unificando dados do sistema...</p>
        </div>
      ) : dados ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* CARDS TOTALIZADORES */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            
            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', borderLeft: '4px solid #16a34a' }}>
              <span style={{ fontSize: '11px', color: '#166534', fontWeight: 'bold' }}>RECEITAS TOTAIS</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: obterCorValor(dados.resumoGeral?.total_receitas) }}>
                {formatarMoeda(dados.resumoGeral?.total_receitas)}
              </p>
            </div>

            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', borderLeft: '4px solid #dc2626' }}>
              <span style={{ fontSize: '11px', color: '#991b1b', fontWeight: 'bold' }}>DESPESAS OPERACIONAIS</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: obterCorValor(dados.resumoGeral?.total_despesas, true) }}>
                {formatarMoeda(dados.resumoGeral?.total_despesas, true)}
              </p>
            </div>

            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', borderLeft: '4px solid #d97706' }}>
              <span style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold' }}>TOTAL FATURAS PF</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: obterCorValor(dados.resumoGeral?.total_faturas, true) }}>
                {formatarMoeda(dados.resumoGeral?.total_faturas, true)}
              </p>
              <span style={{ fontSize: '10px', color: '#64748b' }}>
                Pendentes: {formatarMoeda(dados.resumoGeral?.faturas_pendentes, true)}
              </span>
            </div>

            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', borderLeft: '4px solid #e11d48' }}>
              <span style={{ fontSize: '11px', color: '#9f1239', fontWeight: 'bold' }}>FATURAMENTO DIRETO (F.D)</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: obterCorValor(dados.resumoGeral?.total_fd, true) }}>
                {formatarMoeda(dados.resumoGeral?.total_fd, true)}
              </p>
            </div>

            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', borderLeft: '4px solid #9333ea' }}>
              <span style={{ fontSize: '11px', color: '#6b21a8', fontWeight: 'bold' }}>TOTAL SAÍDAS GERAIS</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: obterCorValor(dados.resumoGeral?.total_saidas, true) }}>
                {formatarMoeda(dados.resumoGeral?.total_saidas, true)}
              </p>
            </div>

            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', borderLeft: `4px solid ${dados.resumoGeral?.saldo_geral >= 0 ? '#2563eb' : '#ef4444'}` }}>
              <span style={{ fontSize: '11px', color: '#1e40af', fontWeight: 'bold' }}>SALDO CONSOLIDADO</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: obterCorValor(dados.resumoGeral?.saldo_geral) }}>
                {formatarMoeda(dados.resumoGeral?.saldo_geral)}
              </p>
            </div>

          </div>

          {/* GRÁFICO CONSOLIDADO */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#1e293b' }}>
              Evolução Unificada: Receitas vs. Despesas vs. Faturas PF vs. Faturamento Direto
            </h4>

            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dados.dadosGrafico || []}>
                  <defs>
                    <linearGradient id="gradReceitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gradDespesas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gradFaturas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gradFD" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes_formatado" style={{ fontSize: '11px' }} />
                  <YAxis style={{ fontSize: '11px' }} tickFormatter={(v) => `R$ ${v/1000}k`} />
                  
                  <Tooltip formatter={(value, name) => {
                    const isSaida = name !== 'Receitas';
                    return formatarMoeda(value, isSaida);
                  }} />
                  <Legend />

                  <Area type="monotone" dataKey="receitas" name="Receitas" stroke="#22c55e" fillOpacity={1} fill="url(#gradReceitas)" />
                  <Area type="monotone" dataKey="despesas" name="Despesas Operacionais" stroke="#ef4444" fillOpacity={1} fill="url(#gradDespesas)" />
                  <Area type="monotone" dataKey="faturas" name="Faturas Pessoa Física" stroke="#f59e0b" fillOpacity={1} fill="url(#gradFaturas)" />
                  <Area type="monotone" dataKey="faturamentos_diretos" name="Faturamento Direto" stroke="#0284c7" fillOpacity={1} fill="url(#gradFD)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TABELA DE CATEGORIAS DETALHADA */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#1e293b', fontWeight: 'bold' }}>
              Consolidado por Categoria
            </h4>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '10px 12px' }}>Categoria</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Tipo</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Qtd Custos</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Custos / FD</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Qtd PF</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total PF</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Qtd Total</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Geral</th>
                  </tr>
                </thead>
                <tbody>
                  {dados?.tabelaCategorias && dados.tabelaCategorias.length > 0 ? (
                    dados.tabelaCategorias.map((item, index) => {
                      const isSaida = item.tipo !== 'RECEITA';
                      const qtdTot = (item.qtdCustos || 0) + (item.qtdPF || 0);
                      
                      const valCustoAjustado = isSaida && Number(item.totalCusto || 0) > 0 ? -Number(item.totalCusto) : Number(item.totalCusto || 0);
                      const valPFAjustado = Number(item.totalPF || 0) > 0 ? -Number(item.totalPF) : Number(item.totalPF || 0);
                      const valTot = valCustoAjustado + valPFAjustado;

                      return (
                        <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: '500', color: '#1e293b' }}>
                            {item.categoria}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span style={{ 
                              fontSize: '11px', 
                              padding: '2px 8px', 
                              borderRadius: '12px', 
                              fontWeight: 'bold',
                              backgroundColor: item.tipo === 'RECEITA' ? '#dcfce7' : '#fee2e2',
                              color: item.tipo === 'RECEITA' ? '#15803d' : '#b91c1c'
                            }}>
                              {item.tipo}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>
                            {item.qtdCustos}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '500', color: obterCorValor(item.totalCusto, isSaida) }}>
                            {formatarMoeda(item.totalCusto, isSaida)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>
                            {item.qtdPF}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '500', color: obterCorValor(item.totalPF, true) }}>
                            {formatarMoeda(item.totalPF, true)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 'bold', color: '#334155' }}>
                            {qtdTot}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', color: obterCorValor(valTot) }}>
                            {formatarMoeda(valTot)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="8" style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>
                        Nenhum dado encontrado para o período selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
                {/* RODAPÉ DA TABELA */}
                {dados?.tabelaCategorias && dados.tabelaCategorias.length > 0 && (
                  <tfoot>
                    <tr style={{ backgroundColor: '#f1f5f9', borderTop: '2px solid #cbd5e1', fontWeight: 'bold', color: '#0f172a' }}>
                      <td colSpan="2" style={{ padding: '12px' }}>TOTAL GERAL</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{totaisTabela.qtdCustos}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: obterCorValor(totaisTabela.totalCusto) }}>
                        {formatarMoeda(totaisTabela.totalCusto)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{totaisTabela.qtdPF}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: obterCorValor(totaisTabela.totalPF) }}>
                        {formatarMoeda(totaisTabela.totalPF)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', color: '#1e293b' }}>{totaisTabela.qtdTotal}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: obterCorValor(totaisTabela.totalGeral) }}>
                        {formatarMoeda(totaisTabela.totalGeral)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

        </div>
      ) : null}

    </div>
  );
}