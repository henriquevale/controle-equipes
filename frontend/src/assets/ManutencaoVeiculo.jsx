import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
    Wrench, 
    Search, 
    Trash2, 
    Plus, 
    Filter, 
    Send, 
    Calculator,
    ChevronDown,
    X,
    Pencil,
    RotateCcw,
    Download
} from 'lucide-react';

const API_URL = 'http://localhost:3001/api';

function SearchableSelect({ options, value, onChange, placeholder, labelKey = 'label', valueKey = 'value' }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef(null);

    const selectedOption = options.find(opt => String(opt[valueKey]) === String(value));

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt =>
        String(opt[labelKey]).toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    height: '38px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '0 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    backgroundColor: '#fff',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: selectedOption ? '#0f172a' : '#94a3b8'
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedOption ? selectedOption[labelKey] : placeholder}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {value && (
                        <X 
                            size={14} 
                            style={{ color: '#94a3b8' }} 
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange('');
                            }} 
                        />
                    )}
                    <ChevronDown size={16} style={{ color: '#64748b' }} />
                </div>
            </div>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    backgroundColor: '#fff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    marginTop: '4px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    maxHeight: '220px',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{ padding: '6px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Search size={14} style={{ color: '#94a3b8' }} />
                        <input 
                            type="text"
                            placeholder="Digitar para buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                            style={{ width: '100%', border: 'none', outline: 'none', fontSize: '12px', padding: '4px 0' }}
                        />
                    </div>

                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {filteredOptions.length === 0 ? (
                            <div style={{ padding: '8px 12px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                                Nenhum resultado encontrado.
                            </div>
                        ) : (
                            filteredOptions.map((opt) => (
                                <div
                                    key={opt[valueKey]}
                                    onClick={() => {
                                        onChange(opt[valueKey]);
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }}
                                    style={{
                                        padding: '8px 12px',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        backgroundColor: String(opt[valueKey]) === String(value) ? '#eff6ff' : 'transparent',
                                        color: String(opt[valueKey]) === String(value) ? '#2563eb' : '#334155',
                                        fontWeight: String(opt[valueKey]) === String(value) ? 'bold' : 'normal',
                                        borderBottom: '1px solid #f8fafc'
                                    }}
                                >
                                    {opt[labelKey]}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ManutencaoVeiculo({ veiculoIdInicial = '' }) {
    const formRef = useRef(null);

    const [veiculos, setVeiculos] = useState([]);
    const [listaItensDisponiveis, setListaItensDisponiveis] = useState([]);
    
    const [editandoId, setEditandoId] = useState(null);

    const [idVeiculoSelecionado, setIdVeiculoSelecionado] = useState(veiculoIdInicial);
    const [manutencaoData, setManutencaoData] = useState('');
    const [numeroNotaFiscal, setNumeroNotaFiscal] = useState('');
    const [manutencaoObs, setManutencaoObs] = useState('');
    const [valorTotalNota, setValorTotalNota] = useState('');

    const [itensLinhas, setItensLinhas] = useState([
        { id_item: '', tipo: 'CORRETIVA', custo: '', quantidade: 1 }
    ]);

    const [listaManutencoes, setListaManutencoes] = useState([]);
    const [loading, setLoading] = useState(false);

    const [filtroDataInicio, setFiltroDataInicio] = useState('');
    const [filtroDataFim, setFiltroDataFim] = useState('');
    const [filtroPlaca, setFiltroPlaca] = useState('');
    const [filtroManutencao, setFiltroManutencao] = useState('');
    const [filtroNF, setFiltroNF] = useState('');

    useEffect(() => {
        carregarDadosIniciais();
        carregarTodasManutencoes();
    }, []);

    const carregarDadosIniciais = async () => {
        try {
            const [resVeiculos, resItens] = await Promise.all([
                axios.get(`${API_URL}/veiculos`),
                axios.get(`${API_URL}/veiculos/itens-manutencao`)
            ]);
            setVeiculos(resVeiculos.data || []);
            setListaItensDisponiveis(resItens.data || []);
        } catch (err) {
            console.error("Erro ao carregar veículos/itens:", err);
        }
    };

    const carregarTodasManutencoes = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/veiculos/manutencoes/todas`);
            setListaManutencoes(res.data || []);
        } catch (err) {
            console.error("Erro ao carregar histórico:", err);
        } finally {
            setLoading(false);
        }
    };

    const opcoesVeiculos = veiculos.map(v => ({
        value: v.id,
        label: `[${v.placa}] ${v.marca} ${v.modelo}`
    }));

    const opcoesItens = listaItensDisponiveis.map(item => ({
        value: item.id,
        label: `[${item.cod}] ${item.nome}`
    }));

    const handleAddLinhaItem = () => {
        setItensLinhas([
            ...itensLinhas, 
            { id_item: '', tipo: 'CORRETIVA', custo: '', quantidade: 1 }
        ]);
    };

    const handleRemoveLinhaItem = (index) => {
        if (itensLinhas.length === 1) return;
        setItensLinhas(itensLinhas.filter((_, i) => i !== index));
    };

    const handleChangeLinha = (index, field, value) => {
        const novasLinhas = [...itensLinhas];
        novasLinhas[index][field] = value;
        setItensLinhas(novasLinhas);
    };

    const handleRatearValorNota = () => {
        const total = parseFloat(valorTotalNota);
        if (isNaN(total) || total <= 0) return alert("Informe um valor total válido para rateio.");
        if (itensLinhas.length === 0) return;

        const rateado = (total / itensLinhas.length).toFixed(2);
        const atualizadas = itensLinhas.map(item => ({ ...item, custo: rateado }));
        setItensLinhas(atualizadas);
    };

    const resetFormulario = () => {
        setEditandoId(null);
        setItensLinhas([{ id_item: '', tipo: 'CORRETIVA', custo: '', quantidade: 1 }]);
        setManutencaoData('');
        setNumeroNotaFiscal('');
        setValorTotalNota('');
        setManutencaoObs('');
    };

    const handleIniciarEdicao = (item) => {
        setEditandoId(item.id);
        setIdVeiculoSelecionado(item.id_veiculo);
        setManutencaoData(item.data_manutencao ? item.data_manutencao.split('T')[0] : '');
        setNumeroNotaFiscal(item.numero_nf || '');
        setManutencaoObs(item.descricao || '');

        setItensLinhas([{
            id_item: item.id_item_manutencao || '',
            tipo: item.categoria || 'CORRETIVA',
            custo: item.custo !== null ? String(item.custo) : '',
            quantidade: item.quantidade || 1
        }]);

        if (formRef.current) {
            formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleSalvarManutencao = async (e) => {
        e.preventDefault();
        if (!idVeiculoSelecionado) return alert("Selecione um veículo.");
        if (!manutencaoData) return alert("Informe a data da manutenção.");

        const itensValidos = itensLinhas.filter(i => i.id_item !== '');
        if (itensValidos.length === 0) return alert("Adicione pelo menos um material/item.");

        try {
            if (editandoId) {
                const primeiroItem = itensValidos[0];
                const payload = {
                    id_veiculo: parseInt(idVeiculoSelecionado, 10),
                    id_item_manutencao: parseInt(primeiroItem.id_item, 10),
                    categoria: primeiroItem.tipo,
                    numero_nf: numeroNotaFiscal.trim() || null,
                    quantidade: parseInt(primeiroItem.quantidade, 10) || 1,
                    descricao: manutencaoObs.trim() || null,
                    custo: primeiroItem.custo ? parseFloat(primeiroItem.custo) : 0,
                    data_manutencao: manutencaoData
                };

                await axios.put(`${API_URL}/veiculos/manutencoes/${editandoId}`, payload);
            } else {
                const payloadItens = itensValidos.map(i => ({
                    id_item: parseInt(i.id_item, 10),
                    custo: i.custo ? parseFloat(i.custo) : 0,
                    quantidade: parseInt(i.quantidade, 10) || 1,
                    categoria: i.tipo
                }));

                const payload = {
                    id_veiculo: parseInt(idVeiculoSelecionado, 10),
                    data_manutencao: manutencaoData,
                    numero_nf: numeroNotaFiscal.trim() || null,
                    descricao: manutencaoObs.trim() || null,
                    itens_com_custo: payloadItens
                };

                await axios.post(`${API_URL}/veiculos/manutencoes`, payload);
            }
            
            resetFormulario();
            carregarTodasManutencoes();
        } catch (err) {
            alert(err.response?.data?.error || "Erro ao salvar manutenção.");
        }
    };

    const handleExcluirManutencao = async (id) => {
        if (!window.confirm("Remover este registro de manutenção?")) return;
        try {
            await axios.delete(`${API_URL}/veiculos/manutencoes/${id}`);
            carregarTodasManutencoes();
        } catch (err) {
            console.error("Erro ao excluir registro:", err);
        }
    };

    const formatarDataBR = (dataString) => {
        if (!dataString) return '---';
        const partes = dataString.split('T')[0].split('-');
        return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : dataString;
    };

    const manutencoesFiltradas = listaManutencoes.filter(item => {
        const dataItem = item.data_manutencao ? item.data_manutencao.split('T')[0] : '';
        if (filtroDataInicio && dataItem < filtroDataInicio) return false;
        if (filtroDataFim && dataItem > filtroDataFim) return false;

        if (filtroPlaca) {
            const placa = (item.placa_veiculo || '').toLowerCase();
            if (!placa.includes(filtroPlaca.toLowerCase())) return false;
        }

        if (filtroManutencao) {
            const nomeItem = (item.nome_item || '').toLowerCase();
            const desc = (item.descricao || '').toLowerCase();
            const busca = filtroManutencao.toLowerCase();
            if (!nomeItem.includes(busca) && !desc.includes(busca)) return false;
        }

        if (filtroNF) {
            const nf = (item.numero_nf || '').toLowerCase();
            if (!nf.includes(filtroNF.toLowerCase())) return false;
        }

        return true;
    });

    const totalCustoFiltrado = manutencoesFiltradas.reduce((acc, item) => {
        return acc + (parseFloat(item.custo) || 0);
    }, 0);

    const handleDownloadCSV = () => {
        if (manutencoesFiltradas.length === 0) {
            alert("Nenhum dado disponível para download.");
            return;
        }

        const headers = ["Data", "Placa/Veículo", "NF/OS", "Item/Peça", "Tipo", "Quantidade", "Custo (R$)", "Observação"];
        
        const rows = manutencoesFiltradas.map(item => [
            `"${formatarDataBR(item.data_manutencao)}"`,
            `"${item.placa_veiculo || 'N/A'}"`,
            `"${item.numero_nf || ''}"`,
            `"${item.nome_item || 'Item Geral'}"`,
            `"${item.categoria || 'CORRETIVA'}"`,
            item.quantidade || 1,
            `"${Number(item.custo || 0).toFixed(2).replace('.', ',')}"`,
            `"${(item.descricao || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");
        
        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Relatorio_Manutencoes_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Arial, sans-serif', padding: '20px', backgroundColor: '#f8fafc' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b', fontSize: '18px', fontWeight: 'bold' }}>
                <Wrench style={{ color: '#2563eb' }} />
                <span>Lançamento e Gestão de Manutenção de Veículos</span>
            </div>

            {/* FORMULÁRIO DE LANÇAMENTO / EDIÇÃO */}
            <form 
                ref={formRef} 
                onSubmit={handleSalvarManutencao} 
                style={{ 
                    backgroundColor: '#ffffff', 
                    border: editandoId ? '2px solid #2563eb' : '1px solid #e2e8f0', 
                    borderRadius: '8px', 
                    padding: '20px', 
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    transition: 'border 0.2s'
                }}
            >
                {editandoId && (
                    <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '8px 12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 'bold' }}>
                            📝 Editando Registro de Manutenção #{editandoId}
                        </span>
                        <button 
                            type="button" 
                            onClick={resetFormulario}
                            style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                            <RotateCcw size={14} /> Cancelar Edição
                        </button>
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                            1. SELECIONE O VEÍCULO *
                        </label>
                        <SearchableSelect 
                            options={opcoesVeiculos}
                            value={idVeiculoSelecionado}
                            onChange={(val) => setIdVeiculoSelecionado(val)}
                            placeholder="Buscar placa ou veículo..."
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                            2. DATA DA MANUTENÇÃO *
                        </label>
                        <input 
                            type="date" 
                            value={manutencaoData} 
                            onChange={e => setManutencaoData(e.target.value)} 
                            style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }} 
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                            3. NOTA FISCAL / OS
                        </label>
                        <input 
                            type="text" 
                            placeholder="Ex: NF-10492" 
                            value={numeroNotaFiscal} 
                            onChange={e => setNumeroNotaFiscal(e.target.value)} 
                            style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }} 
                        />
                    </div>
                </div>

                <div style={{ border: '2px dashed #ea580c', borderRadius: '8px', padding: '16px', backgroundColor: '#fff7ed', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#c2410c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            📦 Lista de Materiais / Peças
                        </span>
                        
                        {!editandoId && (
                            <button 
                                type="button" 
                                onClick={handleAddLinhaItem}
                                style={{ backgroundColor: '#ea580c', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <Plus size={14} /> Adicionar Item
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {itensLinhas.map((linha, index) => (
                            <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'center', backgroundColor: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #fed7aa' }}>
                                <div>
                                    <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>MATERIAL / SERVIÇO *</label>
                                    <SearchableSelect 
                                        options={opcoesItens}
                                        value={linha.id_item}
                                        onChange={(val) => handleChangeLinha(index, 'id_item', val)}
                                        placeholder="Buscar item pelo nome/código..."
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>TIPO</label>
                                    <select 
                                        value={linha.tipo} 
                                        onChange={e => handleChangeLinha(index, 'tipo', e.target.value)}
                                        style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px' }}
                                    >
                                        <option value="CORRETIVA">CORRETIVA</option>
                                        <option value="PREVENTIVA">PREVENTIVA</option>
                                        <option value="PREDITIVA">PREDITIVA</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>QTD *</label>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        value={linha.quantidade} 
                                        onChange={e => handleChangeLinha(index, 'quantidade', e.target.value)}
                                        style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px', boxSizing: 'border-box' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>VALOR (R$)</label>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        placeholder="0,00" 
                                        value={linha.custo} 
                                        onChange={e => handleChangeLinha(index, 'custo', e.target.value)}
                                        style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px', boxSizing: 'border-box' }}
                                    />
                                </div>

                                <div style={{ paddingTop: '14px' }}>
                                    <button 
                                        type="button" 
                                        onClick={() => handleRemoveLinhaItem(index)}
                                        disabled={itensLinhas.length === 1}
                                        style={{ background: 'none', border: 'none', color: itensLinhas.length === 1 ? '#cbd5e1' : '#ef4444', cursor: itensLinhas.length === 1 ? 'not-allowed' : 'pointer' }}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {!editandoId && (
                        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input 
                                type="number" 
                                placeholder="Valor Total da NF para ratear" 
                                value={valorTotalNota} 
                                onChange={e => setValorTotalNota(e.target.value)}
                                style={{ height: '32px', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0 8px', fontSize: '12px', width: '200px' }}
                            />
                            <button 
                                type="button" 
                                onClick={handleRatearValorNota}
                                style={{ backgroundColor: '#475569', color: '#fff', border: 'none', borderRadius: '4px', padding: '0 10px', height: '32px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <Calculator size={13} /> Ratear Valor entre Itens
                            </button>
                        </div>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px', alignItems: 'end' }}>
                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                            OBSERVAÇÃO
                        </label>
                        <input 
                            type="text" 
                            placeholder="Observações adicionais..." 
                            value={manutencaoObs} 
                            onChange={e => setManutencaoObs(e.target.value)}
                            style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                    </div>

                    <button 
                        type="submit" 
                        style={{ 
                            backgroundColor: editandoId ? '#16a34a' : '#2563eb', 
                            color: '#ffffff', 
                            border: 'none', 
                            borderRadius: '6px', 
                            height: '38px', 
                            fontWeight: 'bold', 
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justify: 'center', 
                            gap: '8px' 
                        }}
                    >
                        <Send size={16} /> {editandoId ? 'Atualizar Manutenção' : 'Registrar Manutenção(ões)'}
                    </button>
                </div>
            </form>

            {/* PAINEL DE FILTROS */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Filter size={15} /> Filtros de Pesquisa
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                    <div>
                        <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>DATA INÍCIO</label>
                        <input 
                            type="date" 
                            value={filtroDataInicio} 
                            onChange={e => setFiltroDataInicio(e.target.value)} 
                            style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0 6px', fontSize: '11px', boxSizing: 'border-box' }} 
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>DATA FIM</label>
                        <input 
                            type="date" 
                            value={filtroDataFim} 
                            onChange={e => setFiltroDataFim(e.target.value)} 
                            style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0 6px', fontSize: '11px', boxSizing: 'border-box' }} 
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>BUSCAR PLACA</label>
                        <input 
                            type="text" 
                            placeholder="Ex: ABC-1234" 
                            value={filtroPlaca} 
                            onChange={e => setFiltroPlaca(e.target.value)} 
                            style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0 8px', fontSize: '11px', boxSizing: 'border-box' }} 
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>MANUTENÇÃO / ITEM</label>
                        <input 
                            type="text" 
                            placeholder="Nome do item ou desc." 
                            value={filtroManutencao} 
                            onChange={e => setFiltroManutencao(e.target.value)} 
                            style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0 8px', fontSize: '11px', boxSizing: 'border-box' }} 
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>Nº NOTA FISCAL</label>
                        <input 
                            type="text" 
                            placeholder="Nº da NF" 
                            value={filtroNF} 
                            onChange={e => setFiltroNF(e.target.value)} 
                            style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0 8px', fontSize: '11px', boxSizing: 'border-box' }} 
                        />
                    </div>
                </div>
            </div>

            {/* TABELA - APENAS O TOTAL ACIMA DA COLUNA CUSTO */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', overflowX: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155' }}>
                        Registros de Manutenção Encontrados ({manutencoesFiltradas.length})
                    </div>

                    <button
                        type="button"
                        onClick={handleDownloadCSV}
                        style={{
                            backgroundColor: '#16a34a',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                        title="Exportar registros filtrados para Excel"
                    >
                        <Download size={14} /> Exportar Excel
                    </button>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1', color: '#475569' }}>
                            <th style={{ padding: '10px' }}>Data</th>
                            <th style={{ padding: '10px' }}>Placa / Veículo</th>
                            <th style={{ padding: '10px' }}>NF / OS</th>
                            <th style={{ padding: '10px' }}>Item / Peça</th>
                            <th style={{ padding: '10px' }}>Tipo</th>
                            <th style={{ padding: '10px' }}>Qtd</th>
                            
                            {/* TOTAL MANTIDO SOMENTE EM CIMA DO TÍTULO DA COLUNA CUSTO */}
                            <th style={{ padding: '10px', textAlign: 'right', minWidth: '130px' }}>
                                <div style={{ 
                                    fontSize: '10px', 
                                    color: '#2563eb', 
                                    backgroundColor: '#eff6ff', 
                                    border: '1px solid #bfdbfe', 
                                    borderRadius: '4px', 
                                    padding: '2px 6px', 
                                    marginBottom: '4px',
                                    whiteSpace: 'nowrap'
                                }}>
                                    TOTAL FILTRO: R$ {totalCustoFiltrado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div>Custo (R$)</div>
                            </th>

                            <th style={{ padding: '10px' }}>Observação</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="9" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Carregando histórico...</td>
                            </tr>
                        ) : manutencoesFiltradas.length === 0 ? (
                            <tr>
                                <td colSpan="9" style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>Nenhum registro encontrado com os filtros selecionados.</td>
                            </tr>
                        ) : (
                            manutencoesFiltradas.map((item, index) => (
                                <tr key={item.id || index} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: editandoId === item.id ? '#eff6ff' : 'transparent' }}>
                                    <td style={{ padding: '10px' }}>{formatarDataBR(item.data_manutencao)}</td>
                                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{item.placa_veiculo || 'N/A'}</td>
                                    <td style={{ padding: '10px' }}>
                                        {item.numero_nf ? (
                                            <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                                                {item.numero_nf}
                                            </span>
                                        ) : '---'}
                                    </td>
                                    <td style={{ padding: '10px' }}>{item.nome_item || 'Item Geral'}</td>
                                    <td style={{ padding: '10px' }}>
                                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#e2e8f0', color: '#334155', fontWeight: 'bold' }}>
                                            {item.categoria || 'CORRETIVA'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px' }}>{item.quantidade || 1}</td>
                                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#15803d', textAlign: 'right' }}>
                                        R$ {Number(item.custo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td style={{ padding: '10px', color: '#64748b' }}>{item.descricao || '---'}</td>
                                    <td style={{ padding: '10px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                            <button 
                                                onClick={() => handleIniciarEdicao(item)} 
                                                style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer' }}
                                                title="Editar Registro"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleExcluirManutencao(item.id)} 
                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                                title="Excluir Registro"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
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