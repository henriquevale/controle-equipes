import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Car, PlusCircle, Trash2, Pencil, CheckCircle, AlertTriangle, Wrench, User, Filter, XCircle } from 'lucide-react';

const API_URL = 'http://localhost:3001/api';

export default function CadastroVeiculo({ usuarioLogado }) {
    const [idEmEdicao, setIdEmEdicao] = useState(null);
    const [placa, setPlaca] = useState('');
    const [marca, setMarca] = useState('');
    const [modelo, setModelo] = useState('');
    const [ano, setAno] = useState('');
    const [tipo, setTipo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [idFuncionario, setIdFuncionario] = useState('');
    const [estaEmManutencao, setEstaEmManutencao] = useState(false);

    const [listaVeiculos, setListaVeiculos] = useState([]);
    const [listaFuncionarios, setListaFuncionarios] = useState([]);
    const [filtroStatus, setFiltroStatus] = useState('TODOS');
    const [loading, setLoading] = useState(false);
    const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });

    const carregarDadosIniciais = async () => {
        setLoading(true);
        try {
            const [resVeiculos, resFuncionarios] = await Promise.all([
                axios.get(`${API_URL}/veiculos`),
                axios.get(`${API_URL}/funcionarios`)
            ]);
            setListaVeiculos(resVeiculos.data || []);
            setListaFuncionarios(resFuncionarios.data || []);
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

    const handleSalvarFormulario = async (e) => {
        e.preventDefault();

        if (!placa.trim() || !marca.trim() || !modelo.trim() || !ano || !tipo.trim()) {
            exibirMensagem("Os campos Placa, Marca, Modelo, Ano e Tipo são obrigatórios!", "erro");
            return;
        }

        // Lógica: Manutenção define o status, independente de ter funcionário ou não
        let statusCalculado = 'DISPONÍVEL';
        if (estaEmManutencao) {
            statusCalculado = 'EM MANUTENÇÃO';
        } else if (idFuncionario) {
            statusCalculado = 'EM USO';
        }

        const payload = {
            placa: placa.trim().toUpperCase(),
            marca: marca.trim(),
            modelo: modelo.trim(),
            ano: parseInt(ano),
            tipo: tipo.trim(),
            descricao: descricao.trim() || null,
            status: statusCalculado,
            id_funcionario: idFuncionario ? parseInt(idFuncionario) : null // Sempre envia se selecionado
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
        setDescricao(veiculo.descricao || '');
        setIdFuncionario(veiculo.id_funcionario || '');
        setEstaEmManutencao(veiculo.status === 'EM MANUTENÇÃO');

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const limparFormulario = () => {
        setIdEmEdicao(null);
        setPlaca(''); setMarca(''); setModelo(''); setAno(''); setTipo(''); setDescricao(''); setIdFuncionario(''); setEstaEmManutencao(false);
    };

    const handleDeletar = async (idVeiculo) => {
        if (!window.confirm("Deseja realmente excluir este veículo da frota?")) return;
        try {
            await axios.delete(`${API_URL}/veiculos/${idVeiculo}`);
            exibirMensagem("Veículo removido.", "sucesso");
            if(idEmEdicao === idVeiculo) limparFormulario();
            carregarDadosIniciais();
        } catch (err) {
            console.error("Erro ao deletar:", err);
            exibirMensagem("Erro ao remover veículo.", "erro");
        }
    };

    const obterNomeFuncionario = (idFunc) => {
        if (!idFunc) return 'Nenhum (Pátio)';
        const funcionario = listaFuncionarios.find(f => f.id === idFunc);
        return funcionario ? funcionario.nome : `ID: #${idFunc}`;
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
            <span style={{ backgroundColor: bg, color: text, padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {icone} {statusTxt}
            </span>
        );
    };

    const veiculosFiltrados = listaVeiculos.filter(v => {
        if (filtroStatus === 'TODOS') return true;
        return v.status?.toUpperCase() === filtroStatus;
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'sans-serif' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 'bold', color: '#1e293b' }}>
                <Car style={{ color: '#2563eb', width: '20px', height: '20px' }} /> 
                GESTÃO DE FROTA INTELIGENTE
            </div>

            {mensagem.texto && (
                <div style={{ padding: '10px', borderRadius: '4px', border: '1px solid', fontSize: '12px', fontWeight: '500', backgroundColor: mensagem.tipo === 'sucesso' ? '#f0fdf4' : '#fef2f2', color: mensagem.tipo === 'sucesso' ? '#166534' : '#991b1b', borderColor: mensagem.tipo === 'sucesso' ? '#bbf7d0' : '#fecaca' }}>
                    {mensagem.texto}
                </div>
            )}

            <div style={{ backgroundColor: idEmEdicao ? '#f0f7ff' : '#fff', border: idEmEdicao ? '1px solid #3b82f6' : '1px solid #cbd5e1', borderRadius: '4px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontWeight: 'bold', color: idEmEdicao ? '#1d4ed8' : '#475569', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', textTransform: 'uppercase', fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{idEmEdicao ? `⚠️ Editando Veículo Código #${idEmEdicao}` : 'Adicionar Novo Veículo (Campos com * são obrigatórios)'}</span>
                </div>
                
                <form onSubmit={handleSalvarFormulario} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ width: '120px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>PLACA *</label>
                            <input type="text" placeholder="ABC-1234" maxLength={10} value={placa} onChange={e => setPlaca(e.target.value)} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box', textTransform: 'uppercase' }} />
                        </div>

                        <div style={{ width: '150px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>MARCA *</label>
                            <input type="text" placeholder="Ex: Volkswagen" value={marca} onChange={e => setMarca(e.target.value)} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                        </div>

                        <div style={{ width: '150px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>MODELO *</label>
                            <input type="text" placeholder="Ex: Gol 1.0" value={modelo} onChange={e => setModelo(e.target.value)} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                        </div>

                        <div style={{ width: '90px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>ANO *</label>
                            <input type="number" placeholder="2026" value={ano} onChange={e => setAno(e.target.value)} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                        </div>

                        <div style={{ flex: '1', minWidth: '150px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>TIPO / CATEGORIA *</label>
                            <input type="text" placeholder="Ex: Caçamba, Passeio, Van" value={tipo} onChange={e => setTipo(e.target.value)} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <div style={{ flex: '1', minWidth: '220px' }}>
                            {/* AJUSTADO: Não fica mais 'disabled' quando em manutenção */}
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>FUNCIONÁRIO RESPONSÁVEL</label>
                            <select value={idFuncionario} onChange={e => setIdFuncionario(e.target.value)} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', boxSizing: 'border-box' }}>
                                <option value="">-- Sem funcionário vinculado --</option>
                                {listaFuncionarios.map(func => (
                                    <option key={func.id} value={func.id}>{func.nome}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                            {/* AJUSTADO: Não apaga mais o ID do funcionário ao ser clicado */}
                            <input type="checkbox" id="manutencao" checked={estaEmManutencao} onChange={e => setEstaEmManutencao(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                            <label htmlFor="manutencao" style={{ fontWeight: 'bold', color: '#991b1b', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Wrench style={{ width: '12px' }} /> Definir status como MANUTENÇÃO
                            </label>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: '#475569' }}>DESCRIÇÃO / OBSERVAÇÕES</label>
                        <input type="text" placeholder="Observação opcional sobre o estado geral do veículo..." value={descricao} onChange={e => setDescricao(e.target.value)} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
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

            {/* TABELA */}
            <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: '#334155' }}>
                        <span>FILTRAR VISUALIZAÇÃO:</span>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {['TODOS', 'DISPONÍVEL', 'EM USO', 'EM MANUTENÇÃO'].map(statusItem => (
                            <button key={statusItem} type="button" onClick={() => setFiltroStatus(statusItem)} style={{ height: '26px', padding: '0 10px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: filtroStatus === statusItem ? '#1e293b' : '#fff', color: filtroStatus === statusItem ? '#fff' : '#475569' }}>
                                {statusItem}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div style={{ padding: '16px', overflowX: 'auto' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', color: '#64748b', fontWeight: 'bold', padding: '20px' }}>Carregando frota...</div>
                    ) : veiculosFiltrados.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#64748b', fontStyle: 'italic', padding: '30px' }}>Nenhum veículo encontrado.</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#f1f5f9' }}>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold', width: '50px' }}>ID</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold', width: '90px' }}>PLACA</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold', width: '130px' }}>MARCA / MODELO</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold', width: '50px' }}>ANO</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold', width: '90px' }}>TIPO</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold', width: '140px' }}>MOTORISTA RESPONSÁVEL</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold' }}>OBSERVAÇÃO</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold', width: '130px' }}>STATUS ATUAL</th>
                                    <th style={{ padding: '10px', color: '#475569', fontWeight: 'bold', width: '80px', textAlign: 'center' }}>AÇÕES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {veiculosFiltrados.map((veiculo, index) => (
                                    <tr key={veiculo.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#fff' : '#f8fafc', borderLeft: idEmEdicao === veiculo.id ? '3px solid #3b82f6' : 'none' }}>
                                        <td style={{ padding: '10px', fontWeight: 'bold', color: '#64748b' }}>#{veiculo.id}</td>
                                        <td style={{ padding: '10px', fontWeight: 'bold', color: '#1e293b' }}>{veiculo.placa}</td>
                                        <td style={{ padding: '10px', fontWeight: '500', color: '#334155' }}>{veiculo.marca} {veiculo.modelo}</td>
                                        <td style={{ padding: '10px', color: '#475569' }}>{veiculo.ano}</td>
                                        <td style={{ padding: '10px', color: '#475569' }}>{veiculo.tipo}</td>
                                        <td style={{ padding: '10px', fontWeight: '500', color: '#1e293b' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {veiculo.id_funcionario && <User style={{ width: '11px', height: '11px', color: '#2563eb' }} />}
                                                {obterNomeFuncionario(veiculo.id_funcionario)}
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px', color: '#64748b', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={veiculo.descricao}>
                                            {veiculo.descricao || '---'}
                                        </td>
                                        <td style={{ padding: '10px' }}>{getBadgeStatus(veiculo.status)}</td>
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

        </div>
    );
}