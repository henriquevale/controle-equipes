import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, CalendarDays, AlertTriangle } from 'lucide-react';

const API_URL = 'http://localhost:3001/api';
//const API_URL = 'https://controle-equipes.onrender.com/api';

export default function DiasPendentes({ id, cargo }) {
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [obraSelecionada, setObraSelecionada] = useState('');
    const [obrasDisponiveis, setObrasDisponiveis] = useState([]);
    const [diasAuditados, setDiasAuditados] = useState([]);
    const [loading, setLoading] = useState(false);
    const [buscaRealizada, setBuscaRealizada] = useState(false);

    // 1. CARREGA AS OBRAS ATIVAS DO GESTOR
    useEffect(() => {
        const carregarObrasDoGestor = async () => {
            try {
                const res = await axios.get(`${API_URL}/gestor/obras-ativas`, {
                    params: { id, cargo }
                });
                setObrasDisponiveis(res.data || []);
            } catch (e) {
                console.error("Erro ao carregar obras:", e);
            }
        };
        if (id) carregarObrasDoGestor();
    }, [id, cargo]);

    // Auxiliar: Gera todas as datas do calendário entre o início e o fim escolhidos
    const gerarIntervaloDeDatas = (inicio, fim) => {
        const lista = [];
        let dataAtual = new Date(inicio + 'T12:00:00');
        const dataLimite = new Date(fim + 'T12:00:00');

        while (dataAtual <= dataLimite) {
            const ano = dataAtual.getFullYear();
            const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
            const dia = String(dataAtual.getDate()).padStart(2, '0');
            const dataStr = `${ano}-${mes}-${dia}`;
            const isFimDeSemana = dataAtual.getDay() === 0 || dataAtual.getDay() === 6;

            lista.push({ dataStr, isFimDeSemana });
            dataAtual.setDate(dataAtual.getDate() + 1);
        }
        return lista;
    };

    const formatarDataExibicao = (dataEua) => {
        if (!dataEua) return '';
        const [ano, mes, dia] = dataEua.split('-');
        return `${dia}/${mes}/${ano}`;
    };

    // 2. EXECUTA A AUDITORIA CRUZANDO CALENDÁRIO COM DADOS DA API
    const handleBuscarAusencias = async (e) => {
        e.preventDefault();
        if (!obraSelecionada || !dataInicio || !dataFim) {
            alert("Preencha todos os campos.");
            return;
        }

        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/gestor/auditoria-ausencias`, {
                params: { id, cargo, id_obra: obraSelecionada, data_inicio: dataInicio, data_fim: dataFim }
            });
            
            const dadosBanco = res.data || [];
            const calendario = gerarIntervaloDeDatas(dataInicio, dataFim);
            const resultadoFinal = [];

            calendario.forEach(diaCal => {
                // Procura se o nosso Back-end enviou informações processadas para este dia
                const diaBanco = dadosBanco.find(d => d.data_diario === diaCal.dataStr);

                let tipoFiltro = 'VERMELHO'; // Padrão: Nenhuma equipe foi sequer escalada nesse dia
                let equipesAlocadasSemRdo = [];
                let equipesFechadasComSucesso = [];

                if (diaBanco) {
                    equipesAlocadasSemRdo = diaBanco.equipes_alocadas_sem_rdo || [];
                    equipesFechadasComSucesso = diaBanco.equipes_fechadas_com_sucesso || [];

                    // REGRA DAS CORES:
                    // 1. Se tem equipe pendente (Alocada), o dia fica obrigatoriamente AMARELO
                    if (equipesAlocadasSemRdo.length > 0) {
                        tipoFiltro = 'AMARELO';
                    } 
                    // 2. Se todas as equipes escaladas fecharam o RDO com sucesso, fica VERDE
                    else if (equipesFechadasComSucesso.length > 0) {
                        tipoFiltro = 'VERDE';
                    }
                }

                resultadoFinal.push({
                    ...diaCal,
                    tipoFiltro,
                    equipesAlocadasSemRdo,
                    equipesFechadasComSucesso
                });
            });

            setDiasAuditados(resultadoFinal);
            setBuscaRealizada(true);
        } catch (err) {
            console.error("Erro ao auditar ausências:", err);
            alert("Erro ao processar auditoria.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '80vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                <CalendarDays size={22} color="#475569" />
                <h2 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>Painel do Histórico e Auditoria de RDO</h2>
            </div>

            {/* FILTROS DE PESQUISA */}
            <form onSubmit={handleBuscarAusencias} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', backgroundColor: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '220px', flex: 1 }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>OBRA</label>
                    <select value={obraSelecionada} onChange={e => setObraSelecionada(e.target.value)} style={{ height: '34px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', padding: '0 8px' }}>
                        <option value="">-- Escolha uma Obra --</option>
                        {obrasDisponiveis.map(o => <option key={o.id} value={o.id}>{o.nome_obra}</option>)}
                    </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>INÍCIO</label>
                    <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={{ height: '32px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', padding: '0 6px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>FIM</label>
                    <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={{ height: '32px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', padding: '0 6px' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="submit" disabled={loading} style={{ height: '34px', padding: '0 16px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                        {loading ? 'Processando...' : 'Auditar Calendário'}
                    </button>
                </div>
            </form>

            {/* RENDERIZAÇÃO DOS CARDS DO CALENDÁRIO */}
            {buscaRealizada && (
                <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                        {diasAuditados.map((item) => {
                            // Agora a cor é aplicada para TODOS os dias baseado no tipoFiltro
                            let bgColor = '#f8fafc'; let borderColor = '#e2e8f0'; let textColor = '#64748b';

                            if (item.tipoFiltro === 'VERMELHO') {
                                bgColor = '#fef2f2'; borderColor = '#fecaca'; textColor = '#991b1b';
                            } else if (item.tipoFiltro === 'AMARELO') {
                                bgColor = '#fefce8'; borderColor = '#fef08a'; textColor = '#854d0e';
                            } else if (item.tipoFiltro === 'VERDE') {
                                bgColor = '#f0fdf4'; borderColor = '#bbf7d0'; textColor = '#166534';
                            }

                            return (
                                <div key={item.dataStr} style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}`, padding: '12px', borderRadius: '4px', color: textColor, display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 'bold', fontSize: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>📅 {formatarDataExibicao(item.dataStr)}</span>
                                        {/* Mantém o texto discreto informando que é Fim de Semana */}
                                        {item.isFimDeSemana && <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#94a3b8', backgroundColor: 'rgba(255,255,255,0.6)', padding: '2px 4px', borderRadius: '3px', border: '1px solid rgba(0,0,0,0.05)' }}>(FDS)</span>}
                                    </div>

                                    {/* O conteúdo interno agora renderiza normalmente para fds ou dias de semana */}
                                    {item.tipoFiltro === 'VERMELHO' ? (
                                        <div style={{ fontSize: '11px', fontWeight: 'normal', opacity: 0.8, color: '#ef4444' }}>❌ Sem escala e sem RDO</div>
                                    ) : item.tipoFiltro === 'AMARELO' ? (
                                        <div style={{ fontSize: '11px', fontWeight: 'normal' }}>
                                            <span style={{ color: '#d97706', fontWeight: 'bold' }}>⚠️ RDO Pendente nas Equipes:</span>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                                                {item.equipesAlocadasSemRdo.map(eq => (
                                                    <span key={eq} style={{ backgroundColor: '#fef9c3', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', border: '1px solid #fef08a', color: '#854d0e', fontWeight: 'bold' }}>
                                                        {eq}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '11px', fontWeight: 'normal' }}>
                                            <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✅ RDO Fechado (Presentes):</span>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                                                {item.equipesFechadasComSucesso.map(eq => (
                                                    <span key={eq} style={{ backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', border: '1px solid #bbf7d0', color: '#14532d', fontWeight: 'bold' }}>
                                                        {eq}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}