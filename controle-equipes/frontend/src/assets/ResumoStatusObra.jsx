import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, CloudRain, AlertCircle, CheckCircle, BarChart3, HelpCircle } from 'lucide-react';

// Em vez de: const API_URL = 'http://localhost:3001/api';
const API_URL = 'https://meu-projeto-api.onrender.com/api'; i

export default function ResumoStatusObra({ id, cargo }) {
    const [obraSelecionada, setObraSelecionada] = useState('');
    const [obrasDisponiveis, setObrasDisponiveis] = useState([]);
    const [loading, setLoading] = useState(false);
    const [tabelaDiarios, setTabelaDiarios] = useState([]);

    const [resumoCards, setResumoCards] = useState({
        total_diarios: 0,
        dias_chuva: 0,
        sem_material: 0,
        dias_normais: 0,
        outros: 0
    });

    // 1. Carrega as obras ativas com base no gestor logado
    useEffect(() => {
        const carregarObrasDoGestor = async () => {
            try {
                const res = await axios.get(`${API_URL}/gestor/obras-ativas`, {
                    params: { id, cargo }
                });
                setObrasDisponiveis(res.data || []);
            } catch (e) {
                console.error("Erro ao carregar obras para o resumo:", e);
            }
        };
        if (id) carregarObrasDoGestor();
    }, [id, cargo]);

    // 2. Carrega as métricas e a tabela consolidada
    useEffect(() => {
        const carregarDadosDaObra = async () => {
            if (!obraSelecionada) {
                setResumoCards({ total_diarios: 0, dias_chuva: 0, sem_material: 0, dias_normais: 0, outros: 0 });
                setTabelaDiarios([]);
                return;
            }

            setLoading(true);
            try {
                // CORREÇÃO AQUI: Enviando id e cargo que o back-end exige para validação
                const res = await axios.get(`${API_URL}/gestor/status-diarios-consolidado`, {
                    params: { 
                        id: id,
                        cargo: cargo,
                        id_obra: obraSelecionada 
                    }
                });
                
                if (res.data) {
                    setResumoCards(res.data.indicadores || { total_diarios: 0, dias_chuva: 0, sem_material: 0, dias_normais: 0, outros: 0 });
                    setTabelaDiarios(res.data.listaDiarios || []);
                }
            } catch (err) {
                console.error("Erro ao buscar indicadores consolidado:", err);
            } finally {
                setLoading(false);
            }
        };

        carregarDadosDaObra();
    }, [obraSelecionada, id, cargo]); // Adicionado id e cargo nas dependências seguras do efeito

    const formatarData = (dataRaw) => {
        if (!dataRaw) return '--/--/----';
        const dataLimpa = dataRaw.includes('T') ? dataRaw.split('T')[0] : dataRaw;
        const partes = dataLimpa.split('-');
        if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
        return dataRaw;
    };

    // Estilização dinâmica atualizada com as condições reais da diario_obra
    const getBadgeStyle = (status) => {
        const st = status ? status.trim().toUpperCase() : '';
        let bg = '#e2e8f0', text = '#334155';
        
        if (st === 'CHOVEU') { bg = '#eff6ff'; text = '#2563eb'; }
        else if (st === 'SEM MATERIAL') { bg = '#fef2f2'; text = '#dc2626'; }
        else if (st === 'NORMAL') { bg = '#f0fdf4'; text = '#16a34a'; }

        return {
            backgroundColor: bg,
            color: text,
            padding: '4px 8px',
            borderRadius: '4px',
            fontWeight: 'bold',
            fontSize: '10px',
            display: 'inline-block',
            border: `1px solid ${st === 'NORMAL' ? '#bbf7d0' : st === 'CHOVEU' ? '#bfdbfe' : st === 'SEM MATERIAL' ? '#fecaca' : '#cbd5e1'}`
        };
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>
                <BarChart3 style={{ color: '#2563eb' }} /> HISTÓRICO E INDICADORES DE STATUS DA OBRA
            </div>

            {/* FILTRO */}
            <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#475569' }}>SELECIONE A OBRA PARA ANÁLISE</label>
                <select
                    value={obraSelecionada}
                    onChange={e => setObraSelecionada(e.target.value)}
                    style={{ width: '100%', maxWidth: '500px', height: '34px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff' }}
                >
                    <option value="">-- Escolha uma Obra para puxar os dados --</option>
                    {obrasDisponiveis.map(ob => (
                        <option key={ob.id} value={ob.id}>[{ob.codigo_obra || 'ID: ' + ob.id}] {ob.nome_obra || ob.nome}</option>
                    ))}
                </select>
            </div>

            {loading && <div style={{ color: '#2563eb', fontWeight: 'bold' }}>🔄 Buscando dados e gerando relatórios...</div>}

            {/* GRID DE CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ backgroundColor: '#eff6ff', padding: '10px', borderRadius: '6px' }}><FileText style={{ color: '#2563eb' }} /></div>
                    <div>
                        <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>TOTAL DE RDOs</div>
                        <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e293b' }}>{resumoCards.total_diarios}</div>
                    </div>
                </div>

                <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ backgroundColor: '#eff6ff', padding: '10px', borderRadius: '6px' }}><CloudRain style={{ color: '#2563eb' }} /></div>
                    <div>
                        <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>DIAS DE CHUVA</div>
                        <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e3a8a' }}>{resumoCards.dias_chuva}</div>
                    </div>
                </div>

                <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ backgroundColor: '#fef2f2', padding: '10px', borderRadius: '6px' }}><AlertCircle style={{ color: '#dc2626' }} /></div>
                    <div>
                        <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>SEM MATERIAL</div>
                        <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#7f1d1d' }}>{resumoCards.sem_material}</div>
                    </div>
                </div>

                <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '6px' }}><CheckCircle style={{ color: '#16a34a' }} /></div>
                    <div>
                        <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>PRODUÇÃO NORMAL</div>
                        <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#14532d' }}>{resumoCards.dias_normais}</div>
                    </div>
                </div>

                <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px' }}><HelpCircle style={{ color: '#64748b' }} /></div>
                    <div>
                        <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>OUTROS STATUS</div>
                        <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#334155' }}>{resumoCards.outros}</div>
                    </div>
                </div>
            </div>

            {/* SEÇÃO DA TABELA DETALHADA */}
            {obraSelecionada && !loading && (
                <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginTop: '10px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', color: '#334155', fontSize: '13px' }}>
                        📋 DETALHAMENTO DE DIÁRIOS LANÇADOS POR EQUIPE
                    </div>
                    <div style={{ padding: '16px', overflowX: 'auto' }}>
                        {tabelaDiarios.length === 0 ? (
                            <p style={{ color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>Nenhum diário de obra foi registrado para este projeto ainda.</p>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#f1f5f9' }}>
                                        <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold' }}>ID RDO</th>
                                        <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold' }}>DATA DO DIÁRIO</th>
                                        <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold' }}>EQUIPE</th>
                                        <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold' }}>STATUS CONDIÇÃO</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tabelaDiarios.map((diario, index) => (
                                        <tr key={diario.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#64748b' }}>#{diario.id}</td>
                                            <td style={{ padding: '10px', fontWeight: '500' }}>{formatarData(diario.data_diario)}</td>
                                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#475569' }}>{diario.equipe || '-'}</td>
                                            <td style={{ padding: '10px' }}>
                                                {/* CORREÇÃO AQUI: Mapeado para status_condicao que vem do back-end corrigido */}
                                                <span style={getBadgeStyle(diario.status_condicao)}>
                                                    {diario.status_condicao || 'NÃO INFORMADO'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {!obraSelecionada && (
                <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#64748b', fontStyle: 'italic' }}>
                    Selecione uma das obras listadas acima para carregar os indicadores e a tabela de registros.
                </div>
            )}
        </div>
    );
}