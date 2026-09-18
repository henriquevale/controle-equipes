import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
    CreditCard, 
    Search, 
    Trash2, 
    Filter, 
    Send, 
    ChevronDown,
    X,
    Pencil,
    RotateCcw,
    Download,
    CheckCircle,
    Clock
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

export default function FaturasPessoaFisica() {
    const formRef = useRef(null);

    const [editandoId, setEditandoId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [listaFaturas, setListaFaturas] = useState([]);
    
    // Categorias vindas da API
    const [listaCategorias, setListaCategorias] = useState([]);

    // Campos do Formulário
    const [dataFatura, setDataFatura] = useState('');
    const [banco, setBanco] = useState('BB');
    const [favorecido, setFavorecido] = useState('');
    const [categoriaId, setCategoriaId] = useState('');
    const [valor, setValor] = useState('');
    const [solicitante, setSolicitante] = useState('');
    const [descricaoCompra, setDescricaoCompra] = useState('');
    const [numeroNf, setNumeroNf] = useState('');
    const [conciliadoEm, setConciliadoEm] = useState('');

    // Filtros
    const [filtroDataInicio, setFiltroDataInicio] = useState('');
    const [filtroDataFim, setFiltroDataFim] = useState('');
    const [filtroBanco, setFiltroBanco] = useState('');
    const [filtroCategoria, setFiltroCategoria] = useState('');
    const [filtroFavorecido, setFiltroFavorecido] = useState('');
    const [filtroSolicitante, setFiltroSolicitante] = useState('');
    const [filtroStatusConciliacao, setFiltroStatusConciliacao] = useState('');

    const opcoesBancos = [
        { value: 'BB', label: 'BANCO DO BRASIL (BB)' },
        { value: 'SANTANDER', label: 'SANTANDER' }
    ];

    useEffect(() => {
        carregarFaturas();
        carregarCategorias();
    }, []);

    const carregarFaturas = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/faturas-pessoa-fisica`);
            setListaFaturas(res.data || []);
        } catch (err) {
            console.error("Erro ao carregar faturas:", err);
        } finally {
            setLoading(false);
        }
    };

    const carregarCategorias = async () => {
        try {
            const res = await axios.get(`${API_URL}/categorias-financeiras`);
            setListaCategorias(res.data || []);
        } catch (err) {
            console.error("Erro ao carregar categorias:", err);
        }
    };

    const resetFormulario = () => {
        setEditandoId(null);
        setDataFatura('');
        setBanco('BB');
        setFavorecido('');
        setCategoriaId('');
        setValor('');
        setSolicitante('');
        setDescricaoCompra('');
        setNumeroNf('');
        setConciliadoEm('');
    };

    const handleIniciarEdicao = (item) => {
        setEditandoId(item.id);
        setDataFatura(item.data_fatura ? item.data_fatura.split('T')[0] : '');
        setBanco(item.banco || 'BB');
        setFavorecido(item.favorecido || '');
        setCategoriaId(item.categoria_id ? String(item.categoria_id) : '');
        setValor(item.valor ? String(item.valor) : '');
        setSolicitante(item.solicitante || '');
        setDescricaoCompra(item.descricao_compra || '');
        setNumeroNf(item.numero_nf || '');
        setConciliadoEm(item.conciliado_em ? item.conciliado_em.split('T')[0] : '');

        if (formRef.current) {
            formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleSalvarFatura = async (e) => {
        e.preventDefault();
        if (!dataFatura) return alert("Informe a data da fatura.");
        if (!banco) return alert("Selecione o banco.");
        if (!favorecido.trim()) return alert("Informe o favorecido.");
        if (!valor || parseFloat(valor) <= 0) return alert("Informe um valor válido.");
        if (!solicitante.trim()) return alert("Informe o solicitante.");

        const payload = {
            data_fatura: dataFatura,
            banco,
            favorecido: favorecido.trim(),
            categoria_id: categoriaId || null,
            valor: parseFloat(valor),
            solicitante: solicitante.trim(),
            descricao_compra: descricaoCompra.trim() || null,
            numero_nf: numeroNf.trim() || null,
            conciliado_em: conciliadoEm || null
        };

        try {
            if (editandoId) {
                await axios.put(`${API_URL}/faturas-pessoa-fisica/${editandoId}`, payload);
            } else {
                await axios.post(`${API_URL}/faturas-pessoa-fisica`, payload);
            }

            resetFormulario();
            carregarFaturas();
        } catch (err) {
            alert(err.response?.data?.error || "Erro ao salvar fatura.");
        }
    };

    const handleExcluirFatura = async (id) => {
        if (!window.confirm("Deseja remover este registro de fatura?")) return;
        try {
            await axios.delete(`${API_URL}/faturas-pessoa-fisica/${id}`);
            carregarFaturas();
        } catch (err) {
            console.error("Erro ao excluir fatura:", err);
        }
    };

    const formatarDataBR = (dataString) => {
        if (!dataString) return '---';
        const partes = dataString.split('T')[0].split('-');
        return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : dataString;
    };

    const faturasFiltradas = listaFaturas.filter(item => {
        const dataItem = item.data_fatura ? item.data_fatura.split('T')[0] : '';
        if (filtroDataInicio && dataItem < filtroDataInicio) return false;
        if (filtroDataFim && dataItem > filtroDataFim) return false;

        if (filtroBanco && item.banco !== filtroBanco) return false;

        if (filtroCategoria && String(item.categoria_id) !== String(filtroCategoria)) return false;

        if (filtroFavorecido) {
            const fav = (item.favorecido || '').toLowerCase();
            if (!fav.includes(filtroFavorecido.toLowerCase())) return false;
        }

        if (filtroSolicitante) {
            const sol = (item.solicitante || '').toLowerCase();
            if (!sol.includes(filtroSolicitante.toLowerCase())) return false;
        }

        if (filtroStatusConciliacao === 'CONCILIADO' && !item.conciliado_em) return false;
        if (filtroStatusConciliacao === 'PENDENTE' && item.conciliado_em) return false;

        return true;
    });

    const totalValorFiltrado = faturasFiltradas.reduce((acc, item) => {
        return acc + (parseFloat(item.valor) || 0);
    }, 0);

    const handleDownloadCSV = () => {
        if (faturasFiltradas.length === 0) {
            alert("Nenhum dado disponível para download.");
            return;
        }

        const headers = ["Data", "Banco", "Favorecido", "Categoria", "Valor (R$)", "Solicitante", "Descrição da Compra", "NF", "Conciliado Em"];

        const rows = faturasFiltradas.map(item => [
            `"${formatarDataBR(item.data_fatura)}"`,
            `"${item.banco}"`,
            `"${(item.favorecido || '').replace(/"/g, '""')}"`,
            `"${(item.categoria_nome || '---').replace(/"/g, '""')}"`,
            `"${Number(item.valor || 0).toFixed(2).replace('.', ',')}"`,
            `"${(item.solicitante || '').replace(/"/g, '""')}"`,
            `"${(item.descricao_compra || '').replace(/"/g, '""')}"`,
            `"${item.numero_nf || ''}"`,
            `"${formatarDataBR(item.conciliado_em)}"`
        ]);

        const csvContent = [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");

        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Faturas_PF_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Arial, sans-serif', padding: '15px', backgroundColor: '#f8fafc', maxWidth: '100%', boxSizing: 'border-box' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b', fontSize: '18px', fontWeight: 'bold' }}>
                <CreditCard style={{ color: '#2563eb' }} />
                <span>Gestão e Lançamento de Faturas (Conta Física)</span>
            </div>

            {/* FORMULÁRIO DE CADASTRO / EDIÇÃO */}
            <form 
                ref={formRef} 
                onSubmit={handleSalvarFatura} 
                style={{ 
                    backgroundColor: '#ffffff', 
                    border: editandoId ? '2px solid #2563eb' : '1px solid #e2e8f0', 
                    borderRadius: '8px', 
                    padding: '20px', 
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
            >
                {editandoId && (
                    <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '8px 12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 'bold' }}>
                            📝 Editando Registro de Fatura #{editandoId}
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

                {/* GRELHA DO FORMULÁRIO - ALTAMENTE RESPONSIVA */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                            DATA *
                        </label>
                        <input 
                            type="date" 
                            value={dataFatura} 
                            onChange={e => setDataFatura(e.target.value)} 
                            style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }} 
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                            BANCO *
                        </label>
                        <SearchableSelect 
                            options={opcoesBancos}
                            value={banco}
                            onChange={(val) => setBanco(val)}
                            placeholder="Selecione o banco..."
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                            FAVORECIDO *
                        </label>
                        <input 
                            type="text" 
                            placeholder="Nome do favorecido/fornecedor" 
                            value={favorecido} 
                            onChange={e => setFavorecido(e.target.value)} 
                            style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }} 
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                            CATEGORIA
                        </label>
                        <SearchableSelect 
                            options={listaCategorias}
                            value={categoriaId}
                            onChange={(val) => setCategoriaId(val)}
                            placeholder="Selecione a categoria..."
                            labelKey="nome"
                            valueKey="id"
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                            VALOR (R$) *
                        </label>
                        <input 
                            type="number" 
                            step="0.01" 
                            placeholder="0,00" 
                            value={valor} 
                            onChange={e => setValor(e.target.value)} 
                            style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }} 
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                            SOLICITANTE *
                        </label>
                        <input 
                            type="text" 
                            placeholder="Nome do solicitante" 
                            value={solicitante} 
                            onChange={e => setSolicitante(e.target.value)} 
                            style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }} 
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                            NÚMERO DA NF
                        </label>
                        <input 
                            type="text" 
                            placeholder="Ex: NF-5521" 
                            value={numeroNf} 
                            onChange={e => setNumeroNf(e.target.value)} 
                            style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }} 
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                            CONCILIADO EM
                        </label>
                        <input 
                            type="date" 
                            value={conciliadoEm} 
                            onChange={e => setConciliadoEm(e.target.value)} 
                            style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }} 
                        />
                    </div>
                </div>

                {/* LINHA FINAL DO FORMULÁRIO COM A DESCRIÇÃO E O BOTÃO AJUSTADO */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', alignItems: 'end' }}>
                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                            DESCRIÇÃO DA COMPRA
                        </label>
                        <input 
                            type="text" 
                            placeholder="Detalhamento do que foi comprado..." 
                            value={descricaoCompra} 
                            onChange={e => setDescricaoCompra(e.target.value)} 
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
                            padding: '0 20px',
                            fontWeight: 'bold', 
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justify: 'center', 
                            gap: '8px',
                            transition: 'background-color 0.2s ease',
                            width: '100%'
                        }}
                    >
                        <Send size={16} /> {editandoId ? 'Atualizar Fatura' : 'Cadastrar Fatura'}
                    </button>
                </div>
            </form>

            {/* PAINEL DE FILTROS */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Filter size={15} /> Filtros de Pesquisa
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
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
                        <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>BANCO</label>
                        <select 
                            value={filtroBanco} 
                            onChange={e => setFiltroBanco(e.target.value)}
                            style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0 6px', fontSize: '11px' }}
                        >
                            <option value="">TODOS</option>
                            <option value="BB">BB</option>
                            <option value="SANTANDER">SANTANDER</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>CATEGORIA</label>
                        <select 
                            value={filtroCategoria} 
                            onChange={e => setFiltroCategoria(e.target.value)}
                            style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0 6px', fontSize: '11px' }}
                        >
                            <option value="">TODAS</option>
                            {listaCategorias.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.nome}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>FAVORECIDO</label>
                        <input 
                            type="text" 
                            placeholder="Buscar favorecido" 
                            value={filtroFavorecido} 
                            onChange={e => setFiltroFavorecido(e.target.value)} 
                            style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0 8px', fontSize: '11px', boxSizing: 'border-box' }} 
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>SOLICITANTE</label>
                        <input 
                            type="text" 
                            placeholder="Buscar solicitante" 
                            value={filtroSolicitante} 
                            onChange={e => setFiltroSolicitante(e.target.value)} 
                            style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0 8px', fontSize: '11px', boxSizing: 'border-box' }} 
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>CONCILIAÇÃO</label>
                        <select 
                            value={filtroStatusConciliacao} 
                            onChange={e => setFiltroStatusConciliacao(e.target.value)}
                            style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0 6px', fontSize: '11px' }}
                        >
                            <option value="">TODOS</option>
                            <option value="CONCILIADO">CONCILIADO</option>
                            <option value="PENDENTE">PENDENTE</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* TABELA DE LISTAGEM */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', overflowX: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155' }}>
                        Faturas Encontradas ({faturasFiltradas.length})
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
                    >
                        <Download size={14} /> Exportar Excel
                    </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px', minWidth: '800px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1', color: '#475569' }}>
                                <th style={{ padding: '10px' }}>Data</th>
                                <th style={{ padding: '10px' }}>Banco</th>
                                <th style={{ padding: '10px' }}>Favorecido</th>
                                <th style={{ padding: '10px' }}>Categoria</th>

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
                                        TOTAL FILTRO: R$ {totalValorFiltrado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <div>Valor (R$)</div>
                                </th>

                                <th style={{ padding: '10px' }}>Solicitante</th>
                                <th style={{ padding: '10px' }}>Descrição da Compra</th>
                                <th style={{ padding: '10px' }}>NF</th>
                                <th style={{ padding: '10px' }}>Conciliado Em</th>
                                <th style={{ padding: '10px', textAlign: 'center' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="10" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Carregando faturas...</td>
                                </tr>
                            ) : faturasFiltradas.length === 0 ? (
                                <tr>
                                    <td colSpan="10" style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>Nenhuma fatura encontrada com os filtros informados.</td>
                                </tr>
                            ) : (
                                faturasFiltradas.map((item, index) => (
                                    <tr key={item.id || index} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: editandoId === item.id ? '#eff6ff' : 'transparent' }}>
                                        <td style={{ padding: '10px' }}>{formatarDataBR(item.data_fatura)}</td>
                                        <td style={{ padding: '10px' }}>
                                            <span style={{ 
                                                padding: '2px 6px', 
                                                borderRadius: '4px', 
                                                fontSize: '10px', 
                                                fontWeight: 'bold',
                                                backgroundColor: item.banco === 'BB' ? '#fef08a' : '#fee2e2',
                                                color: item.banco === 'BB' ? '#854d0e' : '#991b1b'
                                            }}>
                                                {item.banco}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px', fontWeight: 'bold' }}>{item.favorecido}</td>
                                        
                                        <td style={{ padding: '10px' }}>
                                            <span style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#475569', fontSize: '11px' }}>
                                                {item.categoria_nome || '---'}
                                            </span>
                                        </td>

                                        <td style={{ padding: '10px', fontWeight: 'bold', color: '#15803d', textAlign: 'right' }}>
                                            R$ {Number(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td style={{ padding: '10px' }}>{item.solicitante}</td>
                                        <td style={{ padding: '10px', color: '#64748b' }}>{item.descricao_compra || '---'}</td>
                                        <td style={{ padding: '10px' }}>
                                            {item.numero_nf ? (
                                                <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                                                    {item.numero_nf}
                                                </span>
                                            ) : '---'}
                                        </td>
                                        <td style={{ padding: '10px' }}>
                                            {item.conciliado_em ? (
                                                <span style={{ color: '#16a34a', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <CheckCircle size={14} /> {formatarDataBR(item.conciliado_em)}
                                                </span>
                                            ) : (
                                                <span style={{ color: '#d97706', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <Clock size={14} /> Pendente
                                                </span>
                                            )}
                                        </td>
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
                                                    onClick={() => handleExcluirFatura(item.id)} 
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
        </div>
    );
}