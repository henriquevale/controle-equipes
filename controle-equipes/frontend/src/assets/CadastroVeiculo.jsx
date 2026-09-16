import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Car, PlusCircle, Trash2, Pencil, CheckCircle, AlertTriangle, 
    Wrench, User, Filter, XCircle, ShieldCheck, Search, AlertCircle,
    Download, Eye, Droplet, X, Clock
} from 'lucide-react';

//const API_URL = 'http://localhost:3001/api';
const API_URL = 'https://api-controle-impacto.duckdns.org/api';

export default function CadastroVeiculo({ onNavegarManutencao }) {
    // Campos do formulário
    const [idEmEdicao, setIdEmEdicao] = useState(null);
    const [placa, setPlaca] = useState('');
    const [marca, setMarca] = useState('');
    const [modelo, setModelo] = useState('');
    const [ano, setAno] = useState('');
    const [tipo, setTipo] = useState('');
    const [titularidade, setTitularidade] = useState(''); 
    const [descricao, setDescricao] = useState('');
    const [idGestor, setIdGestor] = useState(''); 
    const [estaEmManutencao, setEstaEmManutencao] = useState(false);
    const [estaEmManutencaoCompressor, setEstaEmManutencaoCompressor] = useState(false);
    const [dataTopografia, setDataTopografia] = useState('');
    const [emitidoCrlv, setEmitidoCrlv] = useState('NÃO');

    // Campos de KM
    const [kmAtual, setKmAtual] = useState('');
    const [kmTrocaOleo, setKmTrocaOleo] = useState('');

    // Listas e Filtros
    const [listaVeiculos, setListaVeiculos] = useState([]);
    const [listaGestores, setListaGestores] = useState([]); 
    const [filtroStatus, setFiltroStatus] = useState('TODOS');
    const [filtroGestor, setFiltroGestor] = useState('TODOS'); 
    const [filtroTitularidade, setFiltroTitularidade] = useState('TODOS');
    const [filtroCrlv, setFiltroCrlv] = useState('TODOS');
    const [filtroOleo, setFiltroOleo] = useState('TODOS');
    const [filtroTacografo, setFiltroTacografo] = useState('TODOS'); 
    const [pesquisaPlaca, setPesquisaPlaca] = useState(''); 
    const [loading, setLoading] = useState(false);
    const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });

    // Modal de Visualização (Olho)
    const [veiculoDetalhe, setVeiculoDetalhe] = useState(null);
    const [historicoManutencoes, setHistoricoManutencoes] = useState([]);
    const [loadingHistorico, setLoadingHistorico] = useState(false);

    const carregarDadosIniciais = async () => {
        setLoading(true);
        try {
            const [resVeiculos, resGestores] = await Promise.all([
                axios.get(`${API_URL}/veiculos`),
                axios.get(`${API_URL}/rh/gestores-disponiveis`)
            ]);
            setListaVeiculos(resVeiculos.data || []);
            setListaGestores(resGestores.data || []);
        } catch (err) {
            console.error("Erro ao sincronizar dados:", err);
            exibirMensagem("Erro ao carregar dados do servidor.", "erro");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarDadosIniciais();
    }, []);

    const exibirMensagem = (texto, tipo) => {
        setMensagem({ texto, tipo });
        setTimeout(() => setMensagem({ texto: '', tipo: '' }), 4000);
    };

    const formatarDataBR = (dataString) => {
        if (!dataString) return '---';
        const partes = dataString.split('T')[0].split('-');
        if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
        return dataString;
    };

    const getOleoStatusInfo = (atual, troca) => {
        if (atual === null || atual === undefined || troca === null || troca === undefined || troca <= 0) {
            return { estado: 'INDETERMINADO', label: '---', corBg: '#f1f5f9', corTexto: '#64748b' };
        }

        const kmAtualNum = Number(atual);
        const kmTrocaNum = Number(troca);
        const kmRestantes = kmTrocaNum - kmAtualNum;

        if (kmRestantes <= 0) {
            return { 
                estado: 'VENCIDO', 
                label: `🚨 ULTRAPASSOU (${Math.abs(kmRestantes)} km)`, 
                corBg: '#fef2f2', 
                corTexto: '#991b1b',
                border: '#fecaca'
            };
        }

        const limiteAlerta20 = kmTrocaNum * 0.20;
        if (kmRestantes <= limiteAlerta20) {
            return { 
                estado: 'PROXIMO', 
                label: `⚠️ TROCA PRÓXIMA (${kmRestantes} km restantes)`, 
                corBg: '#fef9c3', 
                corTexto: '#854d0e',
                border: '#fef08a'
            };
        }

        return { 
            estado: 'OK', 
            label: `OK (${kmRestantes} km restantes)`, 
            corBg: '#dcfce7', 
            corTexto: '#166534',
            border: '#bbf7d0'
        };
    };

    const handleSalvarFormulario = async (e) => {
        e.preventDefault();

        if (!placa.trim() || !marca.trim() || !modelo.trim() || !ano || !tipo.trim() || !titularidade.trim()) {
            exibirMensagem("Os campos Placa, Marca, Modelo, Ano, Tipo e Titularidade são obrigatórios!", "erro");
            return;
        }

        let statusCalculado = 'DISPONÍVEL';
        if (estaEmManutencaoCompressor) {
            statusCalculado = 'MANUTENÇÃO COMPRESSOR';
        } else if (estaEmManutencao) {
            statusCalculado = 'EM MANUTENÇÃO';
        } else if (idGestor) {
            statusCalculado = 'EM USO';
        }

                const payload = {
            placa: placa.trim().toUpperCase(),
            marca: marca.trim(),
            modelo: modelo.trim(),
            ano: parseInt(ano, 10),
            tipo: tipo.trim(),
            titularidade: titularidade.trim().toUpperCase(), 
            descricao: descricao.trim() || null,
            status: statusCalculado,
            id_gestor: idGestor ? parseInt(idGestor, 10) : null,
            data_topografia: dataTopografia || null,
            emitido_crlv: emitidoCrlv,
            // Validação robusta para evitar enviar NaN no JSON[cite: 2]
            km_atual: kmAtual !== '' && !isNaN(Number(kmAtual)) ? Number(kmAtual) : null,
            km_troca_oleo: kmTrocaOleo !== '' && !isNaN(Number(kmTrocaOleo)) ? Number(kmTrocaOleo) : null
        };
        try {
            if (idEmEdicao) {
                await axios.put(`${API_URL}/veiculos/${idEmEdicao}`, payload);
                exibirMensagem("Dados do veículo atualizados com sucesso!", "sucesso");
            } else {
                await axios.post(`${API_URL}/veiculos`, payload);
                exibirMensagem(`Veículo cadastrado com status: ${statusCalculado}`, "sucesso");
            }

            limparFormulario();
            carregarDadosIniciais();
        } catch (err) {
            console.error("Erro ao salvar veículo:", err);
            exibirMensagem(err.response?.data?.error || "Erro de comunicação com o servidor.", "erro");
        }
    };

    const iniciarEdicao = (veiculo) => {
        setIdEmEdicao(veiculo.id);
        setPlaca(veiculo.placa);
        setMarca(veiculo.marca || '');
        setModelo(veiculo.modelo || '');
        setAno(veiculo.ano || '');
        setTipo(veiculo.tipo || '');
        setTitularidade(veiculo.titularidade || ''); 
        setDescricao(veiculo.descricao || '');
        setIdGestor(veiculo.id_gestor || '');
        setEstaEmManutencao(veiculo.status === 'EM MANUTENÇÃO');
        setEstaEmManutencaoCompressor(veiculo.status === 'MANUTENÇÃO COMPRESSOR');
        setDataTopografia(veiculo.data_topografia ? veiculo.data_topografia.split('T')[0] : '');
        setEmitidoCrlv(veiculo.emitido_crlv || 'NÃO');
        setKmAtual(veiculo.km_atual !== null && veiculo.km_atual !== undefined ? veiculo.km_atual : '');
        setKmTrocaOleo(veiculo.km_troca_oleo !== null && veiculo.km_troca_oleo !== undefined ? veiculo.km_troca_oleo : '');

        // ROLAR ATÉ O TOPO AO EDITAR
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const limparFormulario = () => {
        setIdEmEdicao(null);
        setPlaca(''); setMarca(''); setModelo(''); setAno(''); setTipo(''); 
        setTitularidade(''); setDescricao(''); setIdGestor(''); 
        setEstaEmManutencao(false);
        setEstaEmManutencaoCompressor(false);
        setDataTopografia(''); setEmitidoCrlv('NÃO'); setKmAtual(''); setKmTrocaOleo('');
    };

    const handleDeletar = async (idVeiculo) => {
        if (!window.confirm("Deseja realmente excluir este veículo da frota?")) return;
        try {
            await axios.delete(`${API_URL}/veiculos/${idVeiculo}`);
            exibirMensagem("Veículo removido.", "sucesso");
            if (idEmEdicao === idVeiculo) limparFormulario();
            carregarDadosIniciais();
        } catch (err) {
            console.error("Erro ao deletar:", err);
            exibirMensagem("Erro ao remover veículo.", "erro");
        }
    };

    const handleAbrirDetalhes = async (veiculo) => {
        setVeiculoDetalhe(veiculo);
        setLoadingHistorico(true);
        try {
            const res = await axios.get(`${API_URL}/veiculos/manutencoes/todas`);
            const historicoFiltrado = (res.data || []).filter(m => m.id_veiculo === veiculo.id || m.placa_veiculo === veiculo.placa);
            setHistoricoManutencoes(historicoFiltrado);
        } catch (err) {
            console.error("Erro ao carregar histórico de manutenções:", err);
            setHistoricoManutencoes([]);
        } finally {
            setLoadingHistorico(false);
        }
    };

    const fecharModalDetalhes = () => {
        setVeiculoDetalhe(null);
        setHistoricoManutencoes([]);
    };

    const obterNomeGestor = (idGest) => {
        if (!idGest) return 'Nenhum (Pátio)';
        const gestor = listaGestores.find(g => g.id_usuario === idGest);
        return gestor ? gestor.nome_gestor : `ID: #${idGest}`;
    };

    const getBadgeStatus = (statusTxt) => {
        const st = statusTxt ? statusTxt.toUpperCase() : '';
        let bg = '#dcfce7', text = '#166534', icone = <CheckCircle style={{ width: '12px', height: '12px' }} />;
        
        if (st === 'EM MANUTENÇÃO') { 
            bg = '#fef2f2'; text = '#991b1b'; icone = <Wrench style={{ width: '12px', height: '12px' }} />; 
        } else if (st === 'MANUTENÇÃO COMPRESSOR') { 
            bg = '#fff7ed'; text = '#c2410c'; icone = <Wrench style={{ width: '12px', height: '12px' }} />;
        } else if (st === 'EM USO') { 
            bg = '#fef9c3'; text = '#713f12'; icone = <AlertTriangle style={{ width: '12px', height: '12px' }} />; 
        }

        return (
            <span style={{ backgroundColor: bg, color: text, padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                {icone} {statusTxt}
            </span>
        );
    };

    const renderBadgeTopografia = (dataTop, diasRestantes) => {
        if (!dataTop) return <span style={{ color: '#94a3b8' }}>N/A</span>;
        const dataFormatada = formatarDataBR(dataTop);

        if (diasRestantes === null || diasRestantes === undefined) return <span>{dataFormatada}</span>;

        if (diasRestantes < 0) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontWeight: 'bold' }}>{dataFormatada}</span>
                    <span style={{ backgroundColor: '#fef2f2', color: '#991b1b', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '9px', width: 'fit-content', border: '1px solid #fecaca' }}>
                        🚨 VENCIDO ({Math.abs(diasRestantes)}d)
                    </span>
                </div>
            );
        }

        if (diasRestantes <= 10) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontWeight: 'bold' }}>{dataFormatada}</span>
                    <span style={{ backgroundColor: '#fef9c3', color: '#854d0e', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '9px', width: 'fit-content', border: '1px solid #fef08a' }}>
                        ⚠️ VENCE EM {diasRestantes} DIAS
                    </span>
                </div>
            );
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span>{dataFormatada}</span>
                <span style={{ color: '#166534', fontSize: '9px' }}>ok ({diasRestantes}d)</span>
            </div>
        );
    };

    const veiculosFiltrados = listaVeiculos
        .filter(v => {
            const atendeStatus = filtroStatus === 'TODOS' || v.status?.toUpperCase() === filtroStatus;
            const atendeGestor = filtroGestor === 'TODOS' || 
                (filtroGestor === 'SEM_GESTOR' && !v.id_gestor) || 
                (v.id_gestor && v.id_gestor.toString() === filtroGestor);

            const atendeTitularidade = filtroTitularidade === 'TODOS' || v.titularidade?.toUpperCase() === filtroTitularidade;
            const atendeCrlv = filtroCrlv === 'TODOS' || (v.emitido_crlv || 'NÃO') === filtroCrlv;

            let atendeTacografo = true;
            const diasTac = v.dias_para_vencer_topografia;
            if (filtroTacografo === 'VENCENDO') {
                atendeTacografo = diasTac !== null && diasTac !== undefined && diasTac <= 10 && diasTac >= 0;
            } else if (filtroTacografo === 'VENCIDO') {
                atendeTacografo = diasTac !== null && diasTac !== undefined && diasTac < 0;
            } else if (filtroTacografo === 'OK') {
                atendeTacografo = diasTac !== null && diasTac !== undefined && diasTac > 10;
            }

            const oleoInfo = getOleoStatusInfo(v.km_atual, v.km_troca_oleo);
            let atendeOleo = true;
            if (filtroOleo === 'PROXIMO') atendeOleo = oleoInfo.estado === 'PROXIMO';
            else if (filtroOleo === 'VENCIDO') atendeOleo = oleoInfo.estado === 'VENCIDO';
            else if (filtroOleo === 'OK') atendeOleo = oleoInfo.estado === 'OK';

            const placaLimpa = pesquisaPlaca.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            const placaVeiculoLimpa = (v.placa || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

            return atendeStatus && atendeGestor && atendeTitularidade && atendeCrlv && atendeTacografo && atendeOleo && placaVeiculoLimpa.includes(placaLimpa);
        })
        .sort((a, b) => (a.placa || '').localeCompare((b.placa || '')));

    const handleDownloadCSV = () => {
        if (veiculosFiltrados.length === 0) {
            alert("Nenhum veículo filtrado para exportar.");
            return;
        }

        const headers = ["Placa", "Marca", "Modelo", "Ano", "Tipo", "Titularidade", "Gestor Responsavel", "KM Atual", "KM Troca Oleo", "Status Oleo", "Data Tacografo", "CRLV", "Status Veiculo"];
        
        const rows = veiculosFiltrados.map(v => {
            const oleoInfo = getOleoStatusInfo(v.km_atual, v.km_troca_oleo);
            return [
                `"${v.placa}"`,
                `"${v.marca || ''}"`,
                `"${v.modelo || ''}"`,
                v.ano || '',
                `"${v.tipo || ''}"`,
                `"${v.titularidade || ''}"`,
                `"${obterNomeGestor(v.id_gestor)}"`,
                v.km_atual || 0,
                v.km_troca_oleo || 0,
                `"${oleoInfo.estado}"`,
                `"${formatarDataBR(v.data_topografia)}"`,
                `"${v.emitido_crlv || 'NÃO'}"`,
                `"${v.status || ''}"`
            ];
        });

        const csvContent = [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");
        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Relatorio_Frota_Veiculos_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const estiloInputFiltro = {
        height: '32px',
        padding: '0 8px',
        border: '1px solid #cbd5e1',
        borderRadius: '4px',
        fontSize: '11px',
        backgroundColor: '#fff',
        width: '100%',
        boxSizing: 'border-box'
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'sans-serif', maxWidth: '100%', padding: '10px', boxSizing: 'border-box' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 'bold', color: '#1e293b' }}>
                    <Car style={{ color: '#2563eb', width: '20px', height: '20px' }} /> 
                    GESTÃO DE FROTA INTELIGENTE
                </div>
            </div>

            {mensagem.texto && (
                <div style={{ padding: '10px', borderRadius: '4px', border: '1px solid', fontSize: '12px', fontWeight: '500', backgroundColor: mensagem.tipo === 'sucesso' ? '#f0fdf4' : '#fef2f2', color: mensagem.tipo === 'sucesso' ? '#166534' : '#991b1b', borderColor: mensagem.tipo === 'sucesso' ? '#bbf7d0' : '#fecaca' }}>
                    {mensagem.texto}
                </div>
            )}

            {/* Form de Veículo */}
            <div style={{ backgroundColor: idEmEdicao ? '#f0f7ff' : '#fff', border: idEmEdicao ? '1px solid #3b82f6' : '1px solid #cbd5e1', borderRadius: '6px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontWeight: 'bold', color: idEmEdicao ? '#1d4ed8' : '#475569', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', textTransform: 'uppercase', fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{idEmEdicao ? `⚠️ Editando Veículo Código #${idEmEdicao}` : 'Adicionar Novo Veículo (Campos com * são obrigatórios)'}</span>
                </div>
                
                <form onSubmit={handleSalvarFormulario} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                        <div>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569', fontSize: '11px' }}>PLACA *</label>
                            <input type="text" placeholder="ABC-1234" maxLength={10} value={placa} onChange={e => setPlaca(e.target.value)} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box', textTransform: 'uppercase' }} />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569', fontSize: '11px' }}>MARCA *</label>
                            <input type="text" placeholder="Ex: Volkswagen" value={marca} onChange={e => setMarca(e.target.value)} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569', fontSize: '11px' }}>MODELO *</label>
                            <input type="text" placeholder="Ex: Gol 1.0" value={modelo} onChange={e => setModelo(e.target.value)} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569', fontSize: '11px' }}>ANO *</label>
                            <input type="number" placeholder="2026" value={ano} onChange={e => setAno(e.target.value)} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569', fontSize: '11px' }}>TIPO / CATEGORIA *</label>
                            <input type="text" placeholder="Ex: Caçamba" value={tipo} onChange={e => setTipo(e.target.value)} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569', fontSize: '11px' }}>TITULARIDADE *</label>
                            <select value={titularidade} onChange={e => setTitularidade(e.target.value)} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', boxSizing: 'border-box', fontWeight: '500' }}>
                                <option value="">-- Selecione --</option>
                                <option value="IMPACTO">IMPACTO</option>
                                <option value="TRANSLOCAR">TRANSLOCAR</option>
                                <option value="RAJA">RAJA</option>
                                <option value="ENIO">ENIO</option>
                                <option value="LUCIANA">LUCIANA</option>
                                <option value="TINPAV">TINPAV</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#166534', fontSize: '11px' }}>KM ATUAL</label>
                            <input type="number" placeholder="Ex: 85000" value={kmAtual} onChange={e => setKmAtual(e.target.value)} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#c2410c', fontSize: '11px' }}>KM TROCA DE ÓLEO</label>
                            <input type="number" placeholder="Ex: 90000" value={kmTrocaOleo} onChange={e => setKmTrocaOleo(e.target.value)} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#2563eb', fontSize: '11px' }}>DATA TACÓGRAFO</label>
                            <input type="date" value={dataTopografia} onChange={e => setDataTopografia(e.target.value)} style={{ width: '100%', height: '32px', padding: '0 6px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569', fontSize: '11px' }}>EMITIDO CRLV</label>
                            <select value={emitidoCrlv} onChange={e => setEmitidoCrlv(e.target.value)} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', boxSizing: 'border-box' }}>
                                <option value="NÃO">NÃO</option>
                                <option value="SIM">SIM</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <div style={{ flex: '1 1 220px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569', fontSize: '11px' }}>GESTOR RESPONSÁVEL</label>
                            <select value={idGestor} onChange={e => setIdGestor(e.target.value)} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', boxSizing: 'border-box' }}>
                                <option value="">-- Sem gestor vinculado --</option>
                                {listaGestores.map(gest => (
                                    <option key={gest.id_usuario} value={gest.id_usuario}>{gest.nome_gestor}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingTop: '10px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input 
                                    type="checkbox" 
                                    id="manutencao" 
                                    checked={estaEmManutencao} 
                                    onChange={e => {
                                        setEstaEmManutencao(e.target.checked);
                                        if (e.target.checked) setEstaEmManutencaoCompressor(false);
                                    }} 
                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }} 
                                />
                                <label htmlFor="manutencao" style={{ fontWeight: 'bold', color: '#991b1b', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Wrench style={{ width: '12px' }} /> Definir status como MANUTENÇÃO
                                </label>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input 
                                    type="checkbox" 
                                    id="manutencaoCompressor" 
                                    checked={estaEmManutencaoCompressor} 
                                    onChange={e => {
                                        setEstaEmManutencaoCompressor(e.target.checked);
                                        if (e.target.checked) setEstaEmManutencao(false);
                                    }} 
                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }} 
                                />
                                <label htmlFor="manutencaoCompressor" style={{ fontWeight: 'bold', color: '#c2410c', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Wrench style={{ width: '12px' }} /> Definir status como MANUTENÇÃO COMPRESSOR
                                </label>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569', fontSize: '11px' }}>DESCRIÇÃO / OBSERVAÇÕES</label>
                        <input type="text" placeholder="Observação opcional..." value={descricao} onChange={e => setDescricao(e.target.value)} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                        {idEmEdicao && (
                            <button type="button" onClick={limparFormulario} style={{ height: '34px', padding: '0 15px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <XCircle style={{ width: '14px' }} /> Cancelar
                            </button>
                        )}
                        <button type="submit" style={{ height: '34px', padding: '0 20px', backgroundColor: idEmEdicao ? '#16a34a' : '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <PlusCircle style={{ width: '14px' }} /> {idEmEdicao ? 'Salvar Alterações' : 'Cadastrar Veículo'}
                        </button>
                    </div>
                </form>
            </div>

            {/* BARRA DE FILTROS EM DUAS LINHAS E RESPONSIVA */}
            <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', fontSize: '11px', color: '#475569' }}>
                        <Filter style={{ width: '14px' }} /> FILTROS DE PESQUISA
                    </div>
                    <button
                        type="button"
                        onClick={handleDownloadCSV}
                        style={{
                            backgroundColor: '#16a34a',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '6px 12px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <Download style={{ width: '14px', height: '14px' }} /> Exportar Excel
                    </button>
                </div>

                {/* PRIMEIRA LINHA DE FILTROS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                    <input 
                        type="text" 
                        placeholder="🔍 Buscar por placa..." 
                        value={pesquisaPlaca} 
                        onChange={e => setPesquisaPlaca(e.target.value)} 
                        style={estiloInputFiltro} 
                    />

                    <select value={filtroTacografo} onChange={e => setFiltroTacografo(e.target.value)} style={{ ...estiloInputFiltro, fontWeight: 'bold', color: '#1d4ed8' }}>
                        <option value="TODOS">⏱️ Tacógrafo: Todos</option>
                        <option value="VENCENDO">⚠️ Vencendo (&lt;= 10 dias)</option>
                        <option value="VENCIDO">🚨 Vencido</option>
                        <option value="OK">✅ OK (&gt; 10 dias)</option>
                    </select>

                    <select value={filtroOleo} onChange={e => setFiltroOleo(e.target.value)} style={{ ...estiloInputFiltro, fontWeight: 'bold', color: '#c2410c' }}>
                        <option value="TODOS">⛽ Óleo: Todos</option>
                        <option value="OK">✅ Óleo OK</option>
                        <option value="PROXIMO">⚠️ Troca Próxima (&lt; 20%)</option>
                        <option value="VENCIDO">🚨 Ultrapassado / Vencido</option>
                    </select>

                    <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={estiloInputFiltro}>
                        <option value="TODOS">Status: Todos</option>
                        <option value="DISPONÍVEL">DISPONÍVEL</option>
                        <option value="EM USO">EM USO</option>
                        <option value="EM MANUTENÇÃO">EM MANUTENÇÃO</option>
                        <option value="MANUTENÇÃO COMPRESSOR">MANUTENÇÃO COMPRESSOR</option>
                    </select>
                </div>

                {/* SEGUNDA LINHA DE FILTROS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                    <select value={filtroTitularidade} onChange={e => setFiltroTitularidade(e.target.value)} style={estiloInputFiltro}>
                        <option value="TODOS">Titularidade: Todas</option>
                        <option value="IMPACTO">IMPACTO</option>
                        <option value="TRANSLOCAR">TRANSLOCAR</option>
                        <option value="RAJA">RAJA</option>
                        <option value="ENIO">ENIO</option>
                        <option value="LUCIANA">LUCIANA</option>
                        <option value="TINPAV">TINPAV</option>
                    </select>

                    <select value={filtroGestor} onChange={e => setFiltroGestor(e.target.value)} style={estiloInputFiltro}>
                        <option value="TODOS">Gestor: Todos</option>
                        <option value="SEM_GESTOR">-- Pátio (Sem Gestor) --</option>
                        {listaGestores.map(g => (
                            <option key={g.id_usuario} value={g.id_usuario}>{g.nome_gestor}</option>
                        ))}
                    </select>

                    <select value={filtroCrlv} onChange={e => setFiltroCrlv(e.target.value)} style={estiloInputFiltro}>
                        <option value="TODOS">CRLV: Todos</option>
                        <option value="SIM">CRLV: SIM</option>
                        <option value="NÃO">CRLV: NÃO</option>
                    </select>
                </div>
            </div>

            {/* Tabela de Veículos */}
            <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ padding: '16px', overflowX: 'auto' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', color: '#64748b', fontWeight: 'bold', padding: '20px' }}>Carregando frota...</div>
                    ) : veiculosFiltrados.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#64748b', fontStyle: 'italic', padding: '30px' }}>Nenhum veículo encontrado com os filtros selecionados.</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px', minWidth: '950px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#f1f5f9' }}>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold' }}>PLACA</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold' }}>MARCA / MODELO</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold' }}>ANO</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold' }}>TIPO</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold' }}>TITULARIDADE</th> 
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold' }}>GESTOR RESPONSÁVEL</th>
                                    <th style={{ padding: '10px', color: '#c2410c', fontWeight: 'bold' }}>TROCA DE ÓLEO</th>
                                    <th style={{ padding: '10px', color: '#1d4ed8', fontWeight: 'bold' }}>DATA TACÓGRAFO</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold', textAlign: 'center' }}>CRLV</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold' }}>STATUS</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold', textAlign: 'center' }}>AÇÕES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {veiculosFiltrados.map((veiculo, index) => {
                                    const oleoInfo = getOleoStatusInfo(veiculo.km_atual, veiculo.km_troca_oleo);

                                    return (
                                        <tr key={veiculo.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                            <td style={{ padding: '10px', fontWeight: 'bold', color: '#1e293b' }}>{veiculo.placa}</td>
                                            <td style={{ padding: '10px', fontWeight: '500', color: '#334155' }}>{veiculo.marca} {veiculo.modelo}</td>
                                            <td style={{ padding: '10px', color: '#475569' }}>{veiculo.ano}</td>
                                            <td style={{ padding: '10px', color: '#475569' }}>{veiculo.tipo}</td>
                                            <td style={{ padding: '10px', fontWeight: 'bold', color: veiculo.titularidade === 'IMPACTO' ? '#1e3a8a' : '#0f766e' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                    <ShieldCheck style={{ width: '12px', height: '12px', color: '#475569' }} />
                                                    {veiculo.titularidade || '---'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px', fontWeight: '500', color: '#1e293b' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    {veiculo.id_gestor && <User style={{ width: '11px', height: '11px', color: '#2563eb' }} />}
                                                    {obterNomeGestor(veiculo.id_gestor)}
                                                </div>
                                            </td>

                                            <td style={{ padding: '10px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span style={{ fontSize: '10px', color: '#475569' }}>
                                                        Km: <strong>{veiculo.km_atual ? Number(veiculo.km_atual).toLocaleString() : '---'}</strong> / Troca: <strong>{veiculo.km_troca_oleo ? Number(veiculo.km_troca_oleo).toLocaleString() : '---'}</strong>
                                                    </span>
                                                    {oleoInfo.estado !== 'INDETERMINADO' && (
                                                        <span style={{ backgroundColor: oleoInfo.corBg, color: oleoInfo.corTexto, padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '9px', width: 'fit-content', border: `1px solid ${oleoInfo.border}` }}>
                                                            {oleoInfo.label}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td style={{ padding: '10px' }}>
                                                {renderBadgeTopografia(veiculo.data_topografia, veiculo.dias_para_vencer_topografia)}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'center' }}>
                                                <span style={{
                                                    backgroundColor: veiculo.emitido_crlv === 'SIM' ? '#dcfce7' : '#fef2f2',
                                                    color: veiculo.emitido_crlv === 'SIM' ? '#15803d' : '#991b1b',
                                                    border: `1px solid ${veiculo.emitido_crlv === 'SIM' ? '#bbf7d0' : '#fecaca'}`,
                                                    padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '10px'
                                                }}>
                                                    {veiculo.emitido_crlv || 'NÃO'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px' }}>{getBadgeStatus(veiculo.status)}</td>
                                            <td style={{ padding: '10px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => handleAbrirDetalhes(veiculo)} 
                                                        style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', padding: '4px' }}
                                                        title="Ver Detalhes e Histórico de Manutenções"
                                                    >
                                                        <Eye style={{ width: '15px', height: '15px' }} />
                                                    </button>
                                                    <button type="button" onClick={() => iniciarEdicao(veiculo)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '4px' }} title="Editar Veículo">
                                                        <Pencil style={{ width: '13px', height: '13px' }} />
                                                    </button>
                                                    <button type="button" onClick={() => handleDeletar(veiculo.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} title="Excluir Veículo">
                                                        <Trash2 style={{ width: '13px', height: '13px' }} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* MODAL DE DETALHES DO VEÍCULO E MANUTENÇÃO */}
            {veiculoDetalhe && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '10px' }}>
                    <div style={{ backgroundColor: '#fff', borderRadius: '8px', maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>
                                <Car style={{ color: '#2563eb' }} />
                                <span>Detalhes do Veículo: [{veiculoDetalhe.placa}] {veiculoDetalhe.marca} {veiculoDetalhe.modelo}</span>
                            </div>
                            <button onClick={fecharModalDetalhes} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                                <X style={{ width: '20px', height: '20px' }} />
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', marginBottom: '20px', fontSize: '12px' }}>
                            <div><strong>Ano:</strong> {veiculoDetalhe.ano}</div>
                            <div><strong>Tipo:</strong> {veiculoDetalhe.tipo}</div>
                            <div><strong>Titularidade:</strong> {veiculoDetalhe.titularidade}</div>
                            <div><strong>Gestor:</strong> {obterNomeGestor(veiculoDetalhe.id_gestor)}</div>
                            <div><strong>KM Atual:</strong> {veiculoDetalhe.km_atual ? Number(veiculoDetalhe.km_atual).toLocaleString() : '---'}</div>
                            <div><strong>KM Troca Óleo:</strong> {veiculoDetalhe.km_troca_oleo ? Number(veiculoDetalhe.km_troca_oleo).toLocaleString() : '---'}</div>
                            <div><strong>Data Tacógrafo:</strong> {formatarDataBR(veiculoDetalhe.data_topografia)}</div>
                            <div><strong>CRLV Emitido:</strong> {veiculoDetalhe.emitido_crlv || 'NÃO'}</div>
                            <div><strong>Status:</strong> {veiculoDetalhe.status}</div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Wrench style={{ color: '#d97706', width: '16px' }} /> Histórico de Manutenções do Veículo
                                </span>
                                {onNavegarManutencao && (
                                    <button 
                                        onClick={() => { fecharModalDetalhes(); onNavegarManutencao(veiculoDetalhe.id); }}
                                        style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                                    >
                                        + Lançar Nova Manutenção
                                    </button>
                                )}
                            </div>

                            {loadingHistorico ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Carregando manutenções...</div>
                            ) : historicoManutencoes.length === 0 ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', backgroundColor: '#f1f5f9', borderRadius: '6px', fontSize: '12px' }}>
                                    Nenhuma manutenção registrada para este veículo.
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                                            <th style={{ padding: '8px' }}>Data</th>
                                            <th style={{ padding: '8px' }}>NF/OS</th>
                                            <th style={{ padding: '8px' }}>Item / Peça</th>
                                            <th style={{ padding: '8px' }}>Tipo Categoria</th>
                                            <th style={{ padding: '8px' }}>Custo (R$)</th>
                                            <th style={{ padding: '8px' }}>Obs</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historicoManutencoes.map((m, idx) => (
                                            <tr key={m.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '8px' }}>{formatarDataBR(m.data_manutencao)}</td>
                                                <td style={{ padding: '8px' }}>{m.numero_nf || '---'}</td>
                                                <td style={{ padding: '8px', fontWeight: 'bold' }}>{m.nome_item || 'Item Geral'}</td>
                                                <td style={{ padding: '8px' }}>
                                                    <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#e2e8f0', fontSize: '10px', fontWeight: 'bold' }}>
                                                        {m.categoria || 'CORRETIVA'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '8px', color: '#166534', fontWeight: 'bold' }}>
                                                    R$ {Number(m.custo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td style={{ padding: '8px', color: '#64748b' }}>{m.descricao || '---'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <button onClick={fecharModalDetalhes} style={{ backgroundColor: '#64748b', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}