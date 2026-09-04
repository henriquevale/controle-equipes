import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts';
import { FileText, Wrench, RefreshCw, AlertCircle, DollarSign, Search, Filter } from 'lucide-react';

const API_URL = 'http://localhost:3001/api';

export default function RelatorioManutencaoVeiculos() {
    const [dadosRelatorio, setDadosRelatorio] = useState([]);
    const [totaisGerais, setTotaisGerais] = useState({ corretiva: 0, preventiva: 0, preditiva: 0, total: 0 });
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');

    // Filtros do Relatório
    const [modoVisualizacao, setModoVisualizacao] = useState('TODOS'); // 'TODOS' ou 'SEM_VEICULOS'
    const [pesquisaPlaca, setPesquisaPlaca] = useState('');

    const carregarEProcessarDados = async () => {
        setLoading(true);
        setErro('');
        try {
            const resVeiculos = await axios.get(`${API_URL}/veiculos`);
            const veiculos = resVeiculos.data || [];

            const promessasManutencoes = veiculos.map(v => 
                axios.get(`${API_URL}/veiculos/${v.id}/manutencoes`)
                    .then(res => ({ idVeiculo: v.id, placa: v.placa, modelo: v.modelo, manutencoes: res.data || [] }))
                    .catch(() => ({ idVeiculo: v.id, placa: v.placa, modelo: v.modelo, manutencoes: [] }))
            );

            const resultados = await Promise.all(promessasManutencoes);

            let gCorretiva = 0;
            let gPreventiva = 0;
            let gPreditiva = 0;

            const relatorioFormatado = resultados.map(v => {
                let corretiva = 0;
                let preventiva = 0;
                let preditiva = 0;

                v.manutencoes.forEach(m => {
                    const custo = parseFloat(m.custo) || 0;
                    const cat = (m.categoria || 'CORRETIVA').toUpperCase();

                    if (cat === 'PREVENTIVA') {
                        preventiva += custo;
                    } else if (cat === 'PREDITIVA') {
                        preditiva += custo;
                    } else {
                        corretiva += custo;
                    }
                });

                gCorretiva += corretiva;
                gPreventiva += preventiva;
                gPreditiva += preditiva;

                const totalVeiculo = corretiva + preventiva + preditiva;

                return {
                    placa: v.placa,
                    modelo: v.modelo,
                    veiculoLabel: `${v.placa} - ${v.modelo}`,
                    CORRETIVA: corretiva,
                    PREVENTIVA: preventiva,
                    PREDITIVA: preditiva,
                    TOTAL: totalVeiculo
                };
            });

            setDadosRelatorio(relatorioFormatado);
            setTotaisGerais({
                corretiva: gCorretiva,
                preventiva: gPreventiva,
                preditiva: gPreditiva,
                total: gCorretiva + gPreventiva + gPreditiva
            });

        } catch (err) {
            console.error("Erro ao gerar relatório:", err);
            setErro("Falha ao carregar os dados de manutenção.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarEProcessarDados();
    }, []);

    const formatarMoeda = (valor) => {
        return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // Aplica o filtro da pesquisa por placa
    const dadosFiltrados = dadosRelatorio.filter(v => {
        const termoBusca = pesquisaPlaca.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const placaLimpa = (v.placa || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        return placaLimpa.includes(termoBusca);
    });

    // Recalcula totais com base na pesquisa por placa
    const totaisFiltrados = dadosFiltrados.reduce((acc, v) => ({
        corretiva: acc.corretiva + v.CORRETIVA,
        preventiva: acc.preventiva + v.PREVENTIVA,
        preditiva: acc.preditiva + v.PREDITIVA,
        total: acc.total + v.TOTAL
    }), { corretiva: 0, preventiva: 0, preditiva: 0, total: 0 });

    // Estrutura de dados para o modo "Sem veículos" (Consolidado por tipo de manutenção)
    const dadosGraficoCategoria = [
        { categoria: 'CORRETIVA', valor: totaisFiltrados.corretiva, fill: '#ef4444' },
        { categoria: 'PREVENTIVA', valor: totaisFiltrados.preventiva, fill: '#3b82f6' },
        { categoria: 'PREDITIVA', valor: totaisFiltrados.preditiva, fill: '#10b981' }
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'sans-serif', maxWidth: '100%', padding: '10px', boxSizing: 'border-box' }}>
            
            {/* Cabeçalho */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 'bold', color: '#1e293b' }}>
                    <FileText style={{ color: '#2563eb', width: '20px', height: '20px' }} /> 
                    RELATÓRIO DE CUSTOS DE MANUTENÇÃO POR CATEGORIA
                </div>
                <button 
                    onClick={carregarEProcessarDados} 
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#475569' }}
                >
                    <RefreshCw style={{ width: '12px', height: '12px' }} /> Atualizar Dados
                </button>
            </div>

            {erro && (
                <div style={{ padding: '10px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle style={{ width: '14px' }} /> {erro}
                </div>
            )}

            {/* Cards de Resumo Geral */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderLeft: '4px solid #ef4444', borderRadius: '6px', padding: '12px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block' }}>MANUTENÇÃO CORRETIVA</span>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#991b1b', marginTop: '4px', display: 'block' }}>{formatarMoeda(totaisFiltrados.corretiva)}</span>
                </div>
                <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderLeft: '4px solid #3b82f6', borderRadius: '6px', padding: '12px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block' }}>MANUTENÇÃO PREVENTIVA</span>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e40af', marginTop: '4px', display: 'block' }}>{formatarMoeda(totaisFiltrados.preventiva)}</span>
                </div>
                <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderLeft: '4px solid #10b981', borderRadius: '6px', padding: '12px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block' }}>MANUTENÇÃO PREDITIVA</span>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#065f46', marginTop: '4px', display: 'block' }}>{formatarMoeda(totaisFiltrados.preditiva)}</span>
                </div>
                <div style={{ backgroundColor: '#1e293b', borderRadius: '6px', padding: '12px', color: '#fff' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#94a3b8', display: 'block' }}>CUSTO TOTAL EXIBIDO</span>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#38bdf8', marginTop: '4px', display: 'block' }}>{formatarMoeda(totaisFiltrados.total)}</span>
                </div>
            </div>

            {/* Painel de Filtros */}
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Filter style={{ width: '12px', height: '12px' }} /> Visualização do Gráfico:
                    </span>
                    
                    <button 
                        type="button" 
                        onClick={() => setModoVisualizacao('TODOS')} 
                        style={{ height: '30px', padding: '0 12px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: modoVisualizacao === 'TODOS' ? '#1e293b' : '#fff', color: modoVisualizacao === 'TODOS' ? '#fff' : '#475569' }}
                    >
                        Todos os Veículos
                    </button>

                    <button 
                        type="button" 
                        onClick={() => setModoVisualizacao('SEM_VEICULOS')} 
                        style={{ height: '30px', padding: '0 12px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: modoVisualizacao === 'SEM_VEICULOS' ? '#1e293b' : '#fff', color: modoVisualizacao === 'SEM_VEICULOS' ? '#fff' : '#475569' }}
                    >
                        Sem Veículos (Somente Categorias)
                    </button>
                </div>

                <div style={{ position: 'relative', minWidth: '200px' }}>
                    <Search style={{ width: '14px', height: '14px', color: '#64748b', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input 
                        type="text" 
                        placeholder="Pesquisar por placa..." 
                        value={pesquisaPlaca} 
                        onChange={e => setPesquisaPlaca(e.target.value)} 
                        style={{ width: '100%', height: '30px', paddingLeft: '32px', paddingRight: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box', fontSize: '11px', textTransform: 'uppercase' }} 
                    />
                </div>
            </div>

            {/* Gráfico Comparativo */}
            <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Wrench style={{ width: '14px', color: '#2563eb' }} />
                    {modoVisualizacao === 'TODOS' ? 'COMPARATIVO DE CUSTOS POR VEÍCULO E CATEGORIA' : 'CUSTO TOTAL CONSOLIDADO POR TIPO DE MANUTENÇÃO'}
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '12px' }}>Carregando gráfico...</div>
                ) : modoVisualizacao === 'TODOS' ? (
                    <div style={{ width: '100%', height: '350px' }}>
                        <ResponsiveContainer>
                            <BarChart data={dadosFiltrados} margin={{ top: 10, right: 20, left: 20, bottom: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="placa" angle={-45} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
                                <YAxis tickFormatter={(val) => `R$ ${val}`} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(value) => formatarMoeda(Number(value))} />
                                <Legend verticalAlign="top" height={36} />
                                <Bar dataKey="CORRETIVA" fill="#ef4444" name="Corretiva" stackId="a" />
                                <Bar dataKey="PREVENTIVA" fill="#3b82f6" name="Preventiva" stackId="a" />
                                <Bar dataKey="PREDITIVA" fill="#10b981" name="Preditiva" stackId="a" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div style={{ width: '100%', height: '350px' }}>
                        <ResponsiveContainer>
                            <BarChart data={dadosGraficoCategoria} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="categoria" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                                <YAxis tickFormatter={(val) => `R$ ${val}`} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(value) => formatarMoeda(Number(value))} />
                                <Bar dataKey="valor" name="Custo Total (R$)">
                                    {dadosGraficoCategoria.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Tabela de Detalhamento por Veículo */}
            <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <DollarSign style={{ width: '14px', color: '#16a34a' }} />
                    DETALHAMENTO CONSOLIDADO DE VALORES
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px', minWidth: '600px' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                            <th style={{ padding: '10px', color: '#475569' }}>VEÍCULO</th>
                            <th style={{ padding: '10px', color: '#dc2626', textAlign: 'right' }}>CORRETIVA</th>
                            <th style={{ padding: '10px', color: '#2563eb', textAlign: 'right' }}>PREVENTIVA</th>
                            <th style={{ padding: '10px', color: '#059669', textAlign: 'right' }}>PREDITIVA</th>
                            <th style={{ padding: '10px', color: '#1e293b', textAlign: 'right', fontWeight: 'bold' }}>TOTAL ACUMULADO</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dadosFiltrados.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                                    Nenhum veículo encontrado com a placa informada.
                                </td>
                            </tr>
                        ) : (
                            dadosFiltrados.map((row, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#334155' }}>
                                        {row.placa} <span style={{ fontWeight: 'normal', color: '#64748b' }}>({row.modelo})</span>
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'right', color: row.CORRETIVA > 0 ? '#b91c1c' : '#94a3b8' }}>
                                        {formatarMoeda(row.CORRETIVA)}
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'right', color: row.PREVENTIVA > 0 ? '#1d4ed8' : '#94a3b8' }}>
                                        {formatarMoeda(row.PREVENTIVA)}
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'right', color: row.PREDITIVA > 0 ? '#047857' : '#94a3b8' }}>
                                        {formatarMoeda(row.PREDITIVA)}
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#0f172a' }}>
                                        {formatarMoeda(row.TOTAL)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

        </div>
    );
}