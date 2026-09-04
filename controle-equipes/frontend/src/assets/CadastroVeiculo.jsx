import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Car, PlusCircle, Trash2, Pencil, CheckCircle, AlertTriangle, 
    Wrench, User, Filter, XCircle, ShieldCheck, Search, AlertCircle
} from 'lucide-react';

const API_URL = 'http://localhost:3001/api';

export default function CadastroVeiculo({ usuarioLogado }) {
    // Campos do formulário do veículo
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
    const [dataTopografia, setDataTopografia] = useState('');
    const [emitidoCrlv, setEmitidoCrlv] = useState('NÃO');

    // Listas e filtros
    const [listaVeiculos, setListaVeiculos] = useState([]);
    const [listaGestores, setListaGestores] = useState([]); 
    const [filtroStatus, setFiltroStatus] = useState('TODOS');
    const [filtroGestor, setFiltroGestor] = useState('TODOS'); 
    const [filtroCrlv, setFiltroCrlv] = useState('TODOS');
    const [filtroTopografiaAlerta, setFiltroTopografiaAlerta] = useState(false);
    const [pesquisaPlaca, setPesquisaPlaca] = useState(''); 
    const [loading, setLoading] = useState(false);
    const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });

    // Modal de Acompanhamento de Manutenções
    const [veiculoManutencaoModal, setVeiculoManutencaoModal] = useState(null);
    const [listaManutencoes, setListaManutencoes] = useState([]);
    const [listaItensDisponiveis, setListaItensDisponiveis] = useState([]);
    
    // Estrutura do item com custo e categoria individual: [{ id_item: '1', custo: '150.00', categoria: 'CORRETIVA' }]
    const [itensComCusto, setItensComCusto] = useState([]); 
    const [pesquisaItemManutencao, setPesquisaItemManutencao] = useState(''); 
    const [manutencaoData, setManutencaoData] = useState('');
    const [manutencaoObs, setManutencaoObs] = useState('');
    const [loadingManutencao, setLoadingManutencao] = useState(false);

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

    const handleSalvarFormulario = async (e) => {
        e.preventDefault();

        if (!placa.trim() || !marca.trim() || !modelo.trim() || !ano || !tipo.trim() || !titularidade.trim()) {
            exibirMensagem("Os campos Placa, Marca, Modelo, Ano, Tipo e Titularidade são obrigatórios!", "erro");
            return;
        }

        let statusCalculado = 'DISPONÍVEL';
        if (estaEmManutencao) {
            statusCalculado = 'EM MANUTENÇÃO';
        } else if (idGestor) {
            statusCalculado = 'EM USO';
        }

        const payload = {
            placa: placa.trim().toUpperCase(),
            marca: marca.trim(),
            modelo: modelo.trim(),
            ano: parseInt(ano),
            tipo: tipo.trim(),
            titularidade: titularidade.trim().toUpperCase(), 
            descricao: descricao.trim() || null,
            status: statusCalculado,
            id_gestor: idGestor ? parseInt(idGestor) : null,
            data_topografia: dataTopografia || null,
            emitido_crlv: emitidoCrlv
        };

        try {
            if (idEmEdicao) {
                const resposta = await axios.put(`${API_URL}/veiculos/${idEmEdicao}`, payload);
                if (resposta.status === 200) {
                    exibirMensagem("Dados do veículo atualizados com sucesso!", "sucesso");
                }
            } else {
                const resposta = await axios.post(`${API_URL}/veiculos`, payload);
                if (resposta.status === 200 || resposta.status === 201) {
                    exibirMensagem(`Veículo cadastrado com status: ${statusCalculado}`, "sucesso");
                }
            }

            limparFormulario();
            carregarDadosIniciais();
        } catch (err) {
            console.error("Erro ao salvar veículo:", err);
            if (err.response && err.response.data && err.response.data.error) {
                exibirMensagem(err.response.data.error, "erro");
            } else {
                exibirMensagem("Erro de comunicação com o servidor.", "erro");
            }
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
        setDataTopografia(veiculo.data_topografia ? veiculo.data_topografia.split('T')[0] : '');
        setEmitidoCrlv(veiculo.emitido_crlv || 'NÃO');

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const limparFormulario = () => {
        setIdEmEdicao(null);
        setPlaca(''); setMarca(''); setModelo(''); setAno(''); setTipo(''); 
        setTitularidade(''); setDescricao(''); setIdGestor(''); setEstaEmManutencao(false);
        setDataTopografia(''); setEmitidoCrlv('NÃO');
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

    const abrirModalManutencao = async (veiculo) => {
        setVeiculoManutencaoModal(veiculo);
        setLoadingManutencao(true);
        setPesquisaItemManutencao('');
        try {
            const [resManutencoes, resItens] = await Promise.all([
                axios.get(`${API_URL}/veiculos/${veiculo.id}/manutencoes`),
                axios.get(`${API_URL}/veiculos/itens-manutencao`)
            ]);
            setListaManutencoes(resManutencoes.data || []);
            setListaItensDisponiveis(resItens.data || []);
        } catch (err) {
            console.error("Erro ao carregar manutenções/itens:", err);
            exibirMensagem("Erro ao carregar histórico de manutenções.", "erro");
        } finally {
            setLoadingManutencao(false);
        }
    };

    const fecharModalManutencao = () => {
        setVeiculoManutencaoModal(null);
        setListaManutencoes([]);
        setItensComCusto([]);
        setPesquisaItemManutencao('');
        setManutencaoData('');
        setManutencaoObs('');
    };

    // Selecionar/deselecionar item definindo categoria 'CORRETIVA' como padrão
    const handleToggleItemSelection = (idItemStr) => {
        const existe = itensComCusto.find(item => item.id_item === idItemStr);
        if (existe) {
            setItensComCusto(itensComCusto.filter(item => item.id_item !== idItemStr));
        } else {
            setItensComCusto([...itensComCusto, { id_item: idItemStr, custo: '', categoria: 'CORRETIVA' }]);
        }
    };

    // Atualizar custo individual de um item
    const handleCustoItemChange = (idItemStr, valor) => {
        setItensComCusto(itensComCusto.map(item => {
            if (item.id_item === idItemStr) {
                return { ...item, custo: valor };
            }
            return item;
        }));
    };

    // Atualizar categoria individual do item (CORRETIVA, PREVENTIVA ou PREDITIVA)
    const handleCategoriaItemChange = (idItemStr, categoria) => {
        setItensComCusto(itensComCusto.map(item => {
            if (item.id_item === idItemStr) {
                return { ...item, categoria: categoria };
            }
            return item;
        }));
    };

    const handleSalvarManutencao = async (e) => {
        e.preventDefault();

        if (itensComCusto.length === 0 || !manutencaoData) {
            alert("Selecione pelo menos um item e defina a data da manutenção.");
            return;
        }

        try {
            // Mapeia os itens selecionados enviando ID, custo e a categoria escolhida
            const payloadItens = itensComCusto.map(i => ({
                id_item: parseInt(i.id_item, 10),
                custo: i.custo ? parseFloat(i.custo) : 0,
                categoria: i.categoria || 'CORRETIVA'
            }));

            const idsItens = itensComCusto.map(i => parseInt(i.id_item, 10));
            const custoTotal = itensComCusto.reduce((acc, item) => acc + (item.custo ? parseFloat(item.custo) : 0), 0);

            const payload = {
                id_veiculo: parseInt(veiculoManutencaoModal.id, 10),
                itens_manutencao: idsItens,
                itens_com_custo: payloadItens,
                data_manutencao: manutencaoData,
                descricao: manutencaoObs.trim() || null,
                custo: custoTotal,
                status: 'PENDENTE'
            };

            await axios.post(`${API_URL}/veiculos/manutencoes`, payload);

            setItensComCusto([]);
            setManutencaoData('');
            setManutencaoObs('');
            abrirModalManutencao(veiculoManutencaoModal);
            
        } catch (err) {
            const errorMsg = err.response?.data?.error || "Erro ao registrar manutenção.";
            console.error("Erro Backend 400:", err.response?.data);
            alert(`Erro: ${errorMsg}`);
        }
    };

    const handleExcluirManutencao = async (idManutencao) => {
        if (!window.confirm("Remover esta manutenção do histórico?")) return;
        try {
            await axios.delete(`${API_URL}/veiculos/manutencoes/${idManutencao}`);
            abrirModalManutencao(veiculoManutencaoModal);
        } catch (err) {
            console.error("Erro ao excluir manutenção:", err);
        }
    };

    const totalGastoManutencao = listaManutencoes.reduce((acc, item) => acc + Number(item.custo || 0), 0);
    const custoTotalNovosItens = itensComCusto.reduce((acc, i) => acc + (parseFloat(i.custo) || 0), 0);

    const veiculosTopografiaCritica = listaVeiculos.filter(v => v.dias_para_vencer_topografia !== null && v.dias_para_vencer_topografia <= 10);

    const itensManutencaoFiltrados = listaItensDisponiveis.filter(item => {
        const termo = pesquisaItemManutencao.toLowerCase();
        const nomeMatch = (item.nome || '').toLowerCase().includes(termo);
        const codMatch = (item.cod || '').toLowerCase().includes(termo);
        return nomeMatch || codMatch;
    });

    const veiculosFiltrados = listaVeiculos
        .filter(v => {
            const atendeStatus = filtroStatus === 'TODOS' || v.status?.toUpperCase() === filtroStatus;
            const atendeGestor = filtroGestor === 'TODOS' || 
                (filtroGestor === 'SEM_GESTOR' && !v.id_gestor) || 
                (v.id_gestor && v.id_gestor.toString() === filtroGestor);

            const atendeCrlv = filtroCrlv === 'TODOS' || (v.emitido_crlv || 'NÃO') === filtroCrlv;
            
            const atendeTopografiaAlert = !filtroTopografiaAlerta || (v.dias_para_vencer_topografia !== null && v.dias_para_vencer_topografia <= 10);

            const placaLimpa = pesquisaPlaca.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            const placaVeiculoLimpa = (v.placa || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

            return atendeStatus && atendeGestor && atendeCrlv && atendeTopografiaAlert && placaVeiculoLimpa.includes(placaLimpa);
        })
        .sort((a, b) => (a.placa || '').localeCompare((b.placa || '')));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'sans-serif', maxWidth: '100%', padding: '10px', boxSizing: 'border-box' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 'bold', color: '#1e293b' }}>
                    <Car style={{ color: '#2563eb', width: '20px', height: '20px' }} /> 
                    GESTÃO DE FROTA INTELIGENTE
                </div>

                {veiculosTopografiaCritica.length > 0 && (
                    <div 
                        onClick={() => setFiltroTopografiaAlerta(!filtroTopografiaAlerta)}
                        style={{ 
                            backgroundColor: filtroTopografiaAlerta ? '#fef2f2' : '#fef9c3', 
                            border: '1px solid', 
                            borderColor: filtroTopografiaAlerta ? '#fecaca' : '#fef08a', 
                            padding: '6px 12px', 
                            borderRadius: '6px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            color: filtroTopografiaAlerta ? '#991b1b' : '#854d0e'
                        }}
                    >
                        <AlertCircle style={{ width: '14px', height: '14px' }} />
                        <span>TACÓGRAFO: {veiculosTopografiaCritica.length} veículo(s) vencendo (&lt;= 10 dias)</span>
                        <span style={{ fontSize: '10px', textDecoration: 'underline', marginLeft: '4px' }}>
                            {filtroTopografiaAlerta ? '[ Ver Todos ]' : '[ Filtrar ]'}
                        </span>
                    </div>
                )}
            </div>

            {mensagem.texto && (
                <div style={{ padding: '10px', borderRadius: '4px', border: '1px solid', fontSize: '12px', fontWeight: '500', backgroundColor: mensagem.tipo === 'sucesso' ? '#f0fdf4' : '#fef2f2', color: mensagem.tipo === 'sucesso' ? '#166534' : '#991b1b', borderColor: mensagem.tipo === 'sucesso' ? '#bbf7d0' : '#fecaca' }}>
                    {mensagem.texto}
                </div>
            )}

            {/* Formulário de Cadastro e Edição Responsivo */}
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

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '10px' }}>
                            <input type="checkbox" id="manutencao" checked={estaEmManutencao} onChange={e => setEstaEmManutencao(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                            <label htmlFor="manutencao" style={{ fontWeight: 'bold', color: '#991b1b', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Wrench style={{ width: '12px' }} /> Definir status como MANUTENÇÃO
                            </label>
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

            {/* Painel de Filtros e Pesquisa */}
            <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '180px', flex: '1 1 180px' }}>
                            <div style={{ position: 'relative', width: '100%' }}>
                                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                                    <Search style={{ width: '14px', height: '14px', color: '#64748b' }} />
                                </span>
                                <input 
                                    type="text" 
                                    placeholder="Pesquisar placa..." 
                                    value={pesquisaPlaca} 
                                    onChange={e => setPesquisaPlaca(e.target.value)} 
                                    style={{ width: '100%', height: '32px', paddingLeft: '32px', paddingRight: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box', fontSize: '12px', textTransform: 'uppercase' }} 
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '200px', flex: '1 1 200px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>GESTOR:</span>
                            <select 
                                value={filtroGestor} 
                                onChange={e => setFiltroGestor(e.target.value)} 
                                style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', fontSize: '12px', color: '#334155' }}
                            >
                                <option value="TODOS">-- Todos os Gestores --</option>
                                <option value="SEM_GESTOR">Sem Gestor Vinculado (No Pátio)</option>
                                {listaGestores.map(gest => (
                                    <option key={gest.id_usuario} value={gest.id_usuario.toString()}>{gest.nome_gestor}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '140px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>CRLV:</span>
                            <select 
                                value={filtroCrlv} 
                                onChange={e => setFiltroCrlv(e.target.value)} 
                                style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', fontSize: '12px', color: '#334155' }}
                            >
                                <option value="TODOS">TODOS</option>
                                <option value="SIM">SIM (EMITIDO)</option>
                                <option value="NÃO">NÃO (PENDENTE)</option>
                            </select>
                        </div>

                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: '#334155', fontSize: '11px' }}>
                            <Filter style={{ width: '12px', height: '12px', color: '#64748b' }} />
                            <span>STATUS:</span>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {['TODOS', 'DISPONÍVEL', 'EM USO', 'EM MANUTENÇÃO'].map((statusItem, idx) => (
                                <button key={`filter-status-${idx}`} type="button" onClick={() => setFiltroStatus(statusItem)} style={{ height: '26px', padding: '0 10px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: filtroStatus === statusItem ? '#1e293b' : '#fff', color: filtroStatus === statusItem ? '#fff' : '#475569' }}>
                                    {statusItem}
                                </button>
                            ))}

                            <button 
                                type="button" 
                                onClick={() => setFiltroTopografiaAlerta(!filtroTopografiaAlerta)} 
                                style={{ 
                                    height: '26px', 
                                    padding: '0 10px', 
                                    fontSize: '10px', 
                                    fontWeight: 'bold', 
                                    borderRadius: '4px', 
                                    border: '1px solid',
                                    borderColor: filtroTopografiaAlerta ? '#ca8a04' : '#cbd5e1',
                                    cursor: 'pointer', 
                                    backgroundColor: filtroTopografiaAlerta ? '#fef08a' : '#fff', 
                                    color: filtroTopografiaAlerta ? '#854d0e' : '#475569',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                ⚠️ Topografia (&lt;=10d / Vencida)
                            </button>
                        </div>
                    </div>
                </div>
                
                {/* Tabela de Veículos */}
                <div style={{ padding: '16px', overflowX: 'auto' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', color: '#64748b', fontWeight: 'bold', padding: '20px' }}>Carregando frota...</div>
                    ) : veiculosFiltrados.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#64748b', fontStyle: 'italic', padding: '30px' }}>Nenhum veículo encontrado com os filtros selecionados.</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px', minWidth: '850px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#f1f5f9' }}>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold' }}>PLACA</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold' }}>MARCA / MODELO</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold' }}>ANO</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold' }}>TIPO</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold' }}>TITULARIDADE</th> 
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold' }}>GESTOR RESPONSÁVEL</th>
                                    <th style={{ padding: '10px', color: '#1d4ed8', fontWeight: 'bold' }}>DATA TACÓGRAFO</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold', textAlign: 'center' }}>CRLV</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold' }}>STATUS</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold', textAlign: 'center' }}>MANUTENÇÃO</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold', textAlign: 'center' }}>AÇÕES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {veiculosFiltrados.map((veiculo, index) => (
                                    <tr key={veiculo.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#fff' : '#f8fafc', borderLeft: idEmEdicao === veiculo.id ? '3px solid #3b82f6' : 'none' }}>
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
                                            <button 
                                                type="button" 
                                                onClick={() => abrirModalManutencao(veiculo)}
                                                style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', color: '#334155', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                            >
                                                <Wrench style={{ width: '11px', height: '11px', color: '#d97706' }} /> Ver/Add
                                            </button>
                                        </td>

                                        <td style={{ padding: '10px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                                <button type="button" onClick={() => iniciarEdicao(veiculo)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '4px' }} title="Editar dados do veículo">
                                                    <Pencil style={{ width: '13px', height: '13px' }} />
                                                </button>
                                                <button type="button" onClick={() => handleDeletar(veiculo.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} title="Excluir veículo">
                                                    <Trash2 style={{ width: '13px', height: '13px' }} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal de Manutenções com Custo e Tipo Individual por Item */}
            {veiculoManutencaoModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '12px' }}>
                    <div style={{ backgroundColor: '#fff', width: '100%', maxWidth: '720px', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        
                        {/* Cabeçalho */}
                        <div style={{ backgroundColor: '#0f172a', padding: '12px 16px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '12px' }}>
                                <Wrench style={{ color: '#f59e0b', width: '16px', height: '16px' }} />
                                <span>MANUTENÇÕES — PLACA: {veiculoManutencaoModal.placa} ({veiculoManutencaoModal.modelo})</span>
                            </div>
                            <button onClick={fecharModalManutencao} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}>
                                <XCircle style={{ width: '18px', height: '18px' }} />
                            </button>
                        </div>

                        <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            
                            {/* Formulário de Manutenção */}
                            <form onSubmit={handleSalvarManutencao} style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' }}>➕ Registrar Nova Manutenção</div>
                                
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569' }}>SELEÇÃO DE ITENS *</label>
                                        <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 'bold' }}>
                                            {itensComCusto.length} item(ns) selecionado(s)
                                        </span>
                                    </div>

                                    {/* Busca de Item */}
                                    <div style={{ position: 'relative', marginBottom: '6px' }}>
                                        <Search style={{ width: '12px', height: '12px', color: '#94a3b8', position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
                                        <input 
                                            type="text"
                                            placeholder="Buscar item pelo nome ou código..."
                                            value={pesquisaItemManutencao}
                                            onChange={e => setPesquisaItemManutencao(e.target.value)}
                                            style={{ width: '100%', height: '28px', paddingLeft: '26px', paddingRight: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
                                        />
                                    </div>

                                    {/* Lista de Seleção de Itens com Tipo e Custo */}
                                    <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', padding: '6px' }}>
                                        {itensManutencaoFiltrados.length === 0 ? (
                                            <div style={{ fontSize: '11px', color: '#94a3b8', padding: '4px', textAlign: 'center' }}>Nenhum item encontrado.</div>
                                        ) : (
                                            itensManutencaoFiltrados.map(item => {
                                                const itemIdStr = item.id.toString();
                                                const itemSelecionado = itensComCusto.find(i => i.id_item === itemIdStr);
                                                const isChecked = !!itemSelecionado;

                                                return (
                                                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '4px 6px', borderRadius: '3px', backgroundColor: isChecked ? '#eff6ff' : 'transparent', marginBottom: '2px', borderBottom: '1px border-bottom #f1f5f9' }}>
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', color: isChecked ? '#1e40af' : '#334155', flex: 1 }}>
                                                            <input 
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => handleToggleItemSelection(itemIdStr)}
                                                                style={{ cursor: 'pointer' }}
                                                            />
                                                            <span><strong>[{item.cod}]</strong> - {item.nome}</span>
                                                        </label>

                                                        {/* Seletor de Categoria e Campo de Custo individual */}
                                                        {isChecked && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <select
                                                                    value={itemSelecionado.categoria}
                                                                    onChange={(e) => handleCategoriaItemChange(itemIdStr, e.target.value)}
                                                                    style={{ height: '24px', padding: '0 4px', border: '1px solid #93c5fd', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#fff', color: '#1e3a8a' }}
                                                                >
                                                                    <option value="CORRETIVA">CORRETIVA</option>
                                                                    <option value="PREVENTIVA">PREVENTIVA</option>
                                                                    <option value="PREDITIVA">PREDITIVA</option>
                                                                </select>

                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>R$</span>
                                                                    <input 
                                                                        type="number"
                                                                        step="0.01"
                                                                        placeholder="0,00"
                                                                        value={itemSelecionado.custo}
                                                                        onChange={(e) => handleCustoItemChange(itemIdStr, e.target.value)}
                                                                        style={{ width: '75px', height: '24px', padding: '0 4px', border: '1px solid #93c5fd', borderRadius: '3px', fontSize: '10px', textAlign: 'right', fontWeight: 'bold' }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#475569', marginBottom: '3px' }}>DATA DA MANUTENÇÃO *</label>
                                        <input type="date" value={manutencaoData} onChange={e => setManutencaoData(e.target.value)} style={{ width: '100%', height: '30px', padding: '0 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#475569', marginBottom: '3px' }}>CUSTO TOTAL (CALCULADO)</label>
                                        <div style={{ height: '30px', display: 'flex', alignItems: 'center', padding: '0 8px', border: '1px solid #e2e8f0', backgroundColor: '#f1f5f9', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', color: '#1e3a8a' }}>
                                            R$ {custoTotalNovosItens.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#475569', marginBottom: '3px' }}>OBSERVAÇÃO / DETALHES</label>
                                    <input type="text" placeholder="Oficina, peças trocadas, etc." value={manutencaoObs} onChange={e => setManutencaoObs(e.target.value)} style={{ width: '100%', height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }} />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button type="submit" style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                        Adicionar Registro(s)
                                    </button>
                                </div>
                            </form>

                            {/* Totalizador */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '8px 12px', borderRadius: '6px', fontSize: '11px', flexWrap: 'wrap', gap: '6px' }}>
                                <span style={{ color: '#1e40af', fontWeight: 'bold' }}>Intervenções Registradas: {listaManutencoes.length}</span>
                                <span style={{ color: '#1e3a8a', fontWeight: 'bold', fontSize: '12px' }}>Total Geral: R$ {totalGastoManutencao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>

                            {/* Timeline de Histórico */}
                            <div>
                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>HISTÓRICO DE ACOMPANHAMENTO</div>
                                
                                {loadingManutencao ? (
                                    <div style={{ textAlign: 'center', padding: '12px', color: '#64748b', fontSize: '11px' }}>Carregando histórico...</div>
                                ) : listaManutencoes.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '11px', fontStyle: 'italic' }}>Nenhuma manutenção registrada para este veículo.</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {listaManutencoes.map((m) => (
                                            <div key={m.id} style={{ borderLeft: '3px solid #2563eb', backgroundColor: '#fff', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span>[{m.cod_item || 'S/C'}] {m.nome_item || m.tipo || 'Manutenção'}</span>
                                                        {m.categoria && (
                                                            <span style={{ fontSize: '9px', backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '3px', border: '1px solid #cbd5e1' }}>
                                                                {m.categoria}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ color: '#64748b', fontSize: '10px', marginTop: '2px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                                        <span>📅 Data: {formatarDataBR(m.data_manutencao)}</span>
                                                        <span style={{ fontWeight: 'bold', color: '#0f766e' }}>💵 Custo Item: R$ {Number(m.custo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                    {(m.descricao || m.observacao) && (
                                                        <div style={{ color: '#334155', fontSize: '10px', marginTop: '4px', fontStyle: 'italic' }}>
                                                            Obs: {m.descricao || m.observacao}
                                                        </div>
                                                    )}
                                                </div>
                                                <button onClick={() => handleExcluirManutencao(m.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} title="Excluir este registro">
                                                    <Trash2 style={{ width: '13px', height: '13px' }} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}