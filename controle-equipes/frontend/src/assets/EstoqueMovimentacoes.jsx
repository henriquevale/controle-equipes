import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowRightLeft, Plus, Search, Filter, Download, Edit2, Trash2 } from 'lucide-react';

export default function EstoqueMovimentacoes({ API_URL, mostrarMensagem, usuarioLogado }) {
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [bases, setBases] = useState([]);
  const [obras, setObras] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [gestores, setGestores] = useState([]);
  const [fornecedorMateriaisRel, setFornecedorMateriaisRel] = useState([]);

  // Filtros do Histórico
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroTipoMov, setFiltroTipoMov] = useState('');
  const [filtroObraDestino, setFiltroObraDestino] = useState('');

  // Seleções para Cascata
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState('');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('');
  const [editandoId, setEditandoId] = useState(null);

  const estadoInicialForm = {
    quem_envia_id: '',
    material_id: '',
    quantidade: '',
    tipo_movimentacao: 'TRANSFERENCIA_SAIDA',
    quem_pede_id: '',
    origem_tipo: 'BASE',
    origem_id: '',
    destino_tipo: 'OBRA',
    destino_id: '',
    data_solicitada: '',
    observacao: ''
  };

  const [form, setForm] = useState(estadoInicialForm);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const [resMovs, resMats, resBases, resObras, resForn, resFornMats] = await Promise.all([
        axios.get(`${API_URL}/master/movimentacoes`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/materiais`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/bases`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/obras`).catch(() => axios.get(`${API_URL}/master/obras-geral`)).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/fornecedores`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/fornecedor-materiais`).catch(() => ({ data: [] }))
      ]);

      let gestoresData = [];
      try {
        const resGest = await axios.get(`${API_URL}/gestores`);
        gestoresData = resGest.data || [];
        if (!gestoresData.length) {
          const resUser = await axios.get(`${API_URL}/usuarios`);
          gestoresData = resUser.data || [];
        }
      } catch {
        const resUser = await axios.get(`${API_URL}/usuarios`).catch(() => ({ data: [] }));
        gestoresData = resUser.data || [];
      }

      setMovimentacoes(resMovs.data || []);
      setMateriais(resMats.data || []);
      setBases(resBases.data || []);
      setObras(resObras.data || []);
      setFornecedores(resForn.data || []);
      setGestores(gestoresData);
      setFornecedorMateriaisRel(resFornMats.data || []);

    } catch (e) {
      console.error("Erro ao carregar dados do estoque:", e);
    }
  };

  const materialPertenceAoFornecedor = (m, fornId) => {
    if (!fornId) return true;
    if (Array.isArray(m.fornecedores_ids)) {
      return m.fornecedores_ids.map(Number).includes(Number(fornId));
    }
    if (fornecedorMateriaisRel.length > 0) {
      return fornecedorMateriaisRel.some(
        rel => Number(rel.id_fornecedor) === Number(fornId) && Number(rel.id_material) === Number(m.id)
      );
    }
    return true;
  };

  const materiaisDoFornecedor = materiais.filter(m => 
    materialPertenceAoFornecedor(m, fornecedorSelecionado)
  );

  const tiposDisponiveis = Array.from(
    new Set(
      materiaisDoFornecedor
        .map(m => m.tipo ? String(m.tipo).toUpperCase().trim() : null)
        .filter(Boolean)
    )
  );

  const materiaisFiltrados = materiaisDoFornecedor.filter(m => {
    if (!categoriaSelecionada) return true;
    return String(m.tipo || '').toUpperCase().trim() === categoriaSelecionada.toUpperCase().trim();
  });

  const handleQuemEnviaChange = (e) => {
    const val = e.target.value;
    if (val === 'FORNECEDOR') {
      setForm(prev => ({
        ...prev,
        quem_envia_id: '',
        origem_tipo: 'FORNECEDOR',
        origem_id: fornecedorSelecionado || '',
        material_id: ''
      }));
    } else {
      setForm(prev => ({
        ...prev,
        quem_envia_id: val,
        origem_tipo: 'BASE',
        origem_id: '',
        material_id: ''
      }));
    }
  };

  const handleFornecedorChange = (e) => {
    const fornId = e.target.value;
    setFornecedorSelecionado(fornId);
    setCategoriaSelecionada('');
    setForm(prev => ({
      ...prev,
      material_id: '',
      origem_id: prev.origem_tipo === 'FORNECEDOR' ? fornId : prev.origem_id
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.material_id || !form.quantidade || !form.destino_id) {
      return mostrarMensagem('Preencha os campos obrigatórios (Material, Quantidade e Destino).', 'erro');
    }

    const payload = {
      ...form,
      quem_envia_id: form.quem_envia_id ? parseInt(form.quem_envia_id) : null,
      quem_pede_id: form.quem_pede_id ? parseInt(form.quem_pede_id) : null,
      id_usuario: usuarioLogado?.id || usuarioLogado?.id_usuario || 1
    };

    try {
      if (editandoId) {
        await axios.put(`${API_URL}/master/movimentacoes/${editandoId}`, payload);
        mostrarMensagem('Movimentação atualizada com sucesso!', 'sucesso');
      } else {
        await axios.post(`${API_URL}/master/movimentacoes`, payload);
        mostrarMensagem('Movimentação registrada com sucesso!', 'sucesso');
      }
      
      cancelarEdicao();
      carregarDados();
    } catch (e) {
      console.error("Erro ao salvar movimentação:", e);
      mostrarMensagem('Erro ao salvar movimentação.', 'erro');
    }
  };

  const handleEditar = (m) => {
    setEditandoId(m.id);
    
    let dataSolicitadaFormatada = '';
    if (m.data_solicitada) {
      dataSolicitadaFormatada = m.data_solicitada.split('T')[0];
    }

    setForm({
      quem_envia_id: m.quem_envia_id || '',
      material_id: m.material_id || '',
      quantidade: m.quantidade || '',
      tipo_movimentacao: m.tipo_movimentacao || 'TRANSFERENCIA_SAIDA',
      quem_pede_id: m.quem_pede_id || '',
      origem_tipo: m.origem_tipo || 'BASE',
      origem_id: m.origem_id || '',
      destino_tipo: m.destino_tipo || 'OBRA',
      destino_id: m.destino_id || '',
      data_solicitada: dataSolicitadaFormatada,
      observacao: m.observacao || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletar = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta movimentação?')) return;
    try {
      await axios.delete(`${API_URL}/master/movimentacoes/${id}`);
      mostrarMensagem('Movimentação excluída com sucesso!', 'sucesso');
      carregarDados();
    } catch (e) {
      console.error("Erro ao excluir movimentação:", e);
      mostrarMensagem('Erro ao excluir movimentação.', 'erro');
    }
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setForm(estadoInicialForm);
    setFornecedorSelecionado('');
    setCategoriaSelecionada('');
  };

  const getNomeEntidade = (tipo, id) => {
    if (!id && tipo !== 'FORNECEDOR') return '-';

    if (tipo === 'FORNECEDOR') {
      const f = fornecedores.find(x => Number(x.id) === Number(id));
      return f ? `Fornecedor: ${f.nome_fantasia || f.razao_social}` : `Fornecedor #${id}`;
    }
    if (tipo === 'BASE') {
      const b = bases.find(x => Number(x.id) === Number(id));
      return b ? `Base: ${b.nome}` : `Base #${id}`;
    }
    if (tipo === 'OBRA') {
      const o = obras.find(x => Number(x.id) === Number(id));
      return o ? `Obra: ${o.nome_obra || o.nome}` : `Obra #${id}`;
    }
    return '-';
  };

  const formatarData = (dataIso) => {
    if (!dataIso) return '-';
    const [data] = dataIso.split('T');
    const partes = data.split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : new Date(dataIso).toLocaleDateString('pt-BR');
  };

const movsFiltradas = movimentacoes.filter(m => {
    const matNome = String(m.material_nome || m.descricao || '').toLowerCase();
    const busca = termoBusca.toLowerCase();
    if (busca && !matNome.includes(busca)) {
      return false;
    }
    if (filtroTipoMov && m.tipo_movimentacao !== filtroTipoMov) return false;
    if (filtroObraDestino && String(m.destino_id) !== String(filtroObraDestino)) return false;

    // Filtra pela DATA DE SOLICITAÇÃO
    if (m.data_solicitada) {
      const dataSolicitada = m.data_solicitada.split('T')[0];
      if (filtroDataInicio && dataSolicitada < filtroDataInicio) return false;
      if (filtroDataFim && dataSolicitada > filtroDataFim) return false;
    } else if (filtroDataInicio || filtroDataFim) {
      // Oculta registros que não possuem data solicitada se houver filtro ativo
      return false;
    }

    return true;
  });

  const exportarCSV = () => {
    if (!movsFiltradas.length) {
      return mostrarMensagem('Nenhum dado para exportar.', 'erro');
    }

    const cabecalho = ['Material', 'Quantidade', 'Unidade', 'Tipo', 'Quem Envia', 'Origem', 'Quem Pede', 'Destino', 'Data Solicitada', 'Registrado Por', 'Data Lançamento'];
    const linhas = movsFiltradas.map(m => [
      `"${(m.material_nome || m.descricao || '').replace(/"/g, '""')}"`,
      m.quantidade,
      m.unidade_medida || 'UN',
      m.tipo_movimentacao,
      `"${m.quem_envia_nome || '-'}"`,
      `"${getNomeEntidade(m.origem_tipo, m.origem_id)}"`,
      `"${m.quem_pede_nome || '-'}"`,
      `"${getNomeEntidade(m.destino_tipo, m.destino_id)}"`,
      formatarData(m.data_solicitada),
      `"${m.usuario_nome || '-'}"`,
      formatarData(m.data_movimentacao)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [cabecalho.join(','), ...linhas.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `movimentacoes_estoque_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const inputStyle = {
    width: '100%', height: '36px', padding: '0 8px',
    border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px',
    boxSizing: 'border-box', backgroundColor: '#fff'
  };

  const labelStyle = {
    fontSize: '11px', fontWeight: '700', color: '#475569',
    display: 'block', marginBottom: '4px', textTransform: 'uppercase',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', boxSizing: 'border-box' }}>
      
      {/* FORMULÁRIO */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowRightLeft style={{ width: '18px', height: '18px', color: '#2563eb' }} />
          {editandoId ? 'Editar Movimentação de Estoque' : 'Lançamento de Movimentação de Estoque'}
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '10px' }}>
            
            <div>
              <label style={labelStyle}>1. Quem vai enviar</label>
              <select 
                value={form.origem_tipo === 'FORNECEDOR' ? 'FORNECEDOR' : form.quem_envia_id} 
                onChange={handleQuemEnviaChange} 
                style={inputStyle}
              >
                <option value="">Selecione...</option>
                <option value="FORNECEDOR" style={{ fontWeight: 'bold', color: '#2563eb' }}>
                  🚚 FORNECEDOR
                </option>
                {gestores.map(g => (
                  <option key={`envia-${g.id || g.id_usuario}`} value={g.id || g.id_usuario}>
                    {g.nome || g.nome_gestor || g.usuario}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>2. Origem - Local</label>
              <div style={{ display: 'flex', gap: '2px' }}>
                <select 
                  value={form.origem_tipo} 
                  onChange={e => setForm({ ...form, origem_tipo: e.target.value, origem_id: '', material_id: '' })} 
                  style={{ ...inputStyle, width: '45%', padding: '0 2px' }}
                  disabled={form.origem_tipo === 'FORNECEDOR'}
                >
                  <option value="BASE">Base</option>
                  <option value="OBRA">Obra</option>
                  <option value="FORNECEDOR">Forn.</option>
                </select>

                <select 
                  value={form.origem_id} 
                  onChange={e => setForm({ ...form, origem_id: e.target.value })} 
                  style={{ ...inputStyle, width: '55%', padding: '0 2px' }}
                  disabled={form.origem_tipo === 'FORNECEDOR'}
                >
                  <option value="">Selecione...</option>
                  {form.origem_tipo === 'BASE' && bases.map(b => <option key={`base-${b.id}`} value={b.id}>{b.nome}</option>)}
                  {form.origem_tipo === 'OBRA' && obras.map(o => <option key={`obra-${o.id}`} value={o.id}>{o.nome_obra || o.nome}</option>)}
                  {form.origem_tipo === 'FORNECEDOR' && fornecedores.map(f => <option key={`forn-origem-${f.id}`} value={f.id}>{f.nome_fantasia || f.razao_social}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>3. Fornecedor</label>
              <select value={fornecedorSelecionado} onChange={handleFornecedorChange} style={inputStyle}>
                <option value="">Todos os Fornecedores...</option>
                {fornecedores.map(f => (
                  <option key={`forn-lista-${f.id}`} value={f.id}>
                    {f.nome_fantasia || f.razao_social}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>4. Tipo Material</label>
              <select 
                value={categoriaSelecionada} 
                onChange={e => {
                  setCategoriaSelecionada(e.target.value);
                  setForm({ ...form, material_id: '' });
                }} 
                style={inputStyle}
              >
                <option value="">Todos os Tipos...</option>
                {tiposDisponiveis.map(t => (
                  <option key={`tipo-${t}`} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>5. Material *</label>
              <select value={form.material_id} onChange={e => setForm({ ...form, material_id: e.target.value })} style={inputStyle}>
                <option value="">
                  {materiaisFiltrados.length === 0 ? 'Nenhum material encontrado' : 'Selecione...'}
                </option>
                {materiaisFiltrados.map(m => (
                  <option key={`mat-${m.id}`} value={m.id}>
                    {m.descricao} ({m.unidade_medida || 'UN'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>6. Quantidade *</label>
              <input type="number" step="0.01" placeholder="Ex: 50" value={form.quantidade} onChange={e => setForm({ ...form, quantidade: e.target.value })} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>7. Tipo Movimentação</label>
              <select value={form.tipo_movimentacao} onChange={e => setForm({ ...form, tipo_movimentacao: e.target.value })} style={inputStyle}>
                <option value="TRANSFERENCIA_SAIDA">Transferência (Saída)</option>
                <option value="TRANSFERENCIA_ENTRADA">Transferência (Entrada)</option>
                <option value="ENTRADA_FORNECEDOR">Entrada Fornecedor</option>
                <option value="CONSUMO_RDO">Consumo via RDO</option>
                <option value="AJUSTE">Ajuste de Estoque</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>8. Quem vai pedir</label>
              <select value={form.quem_pede_id} onChange={e => setForm({ ...form, quem_pede_id: e.target.value })} style={inputStyle}>
                <option value="">Selecione...</option>
                {gestores.map(g => (
                  <option key={`pede-${g.id || g.id_usuario}`} value={g.id || g.id_usuario}>
                    {g.nome || g.nome_gestor || g.usuario}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>9. Destino - Tipo *</label>
              <select value={form.destino_tipo} onChange={e => setForm({ ...form, destino_tipo: e.target.value, destino_id: '' })} style={inputStyle}>
                <option value="OBRA">Obra / Gestor</option>
                <option value="BASE">Base / Depósito</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>10. Destino - Local *</label>
              <select value={form.destino_id} onChange={e => setForm({ ...form, destino_id: e.target.value })} style={inputStyle}>
                <option value="">Selecione...</option>
                {form.destino_tipo === 'BASE' && bases.map(b => <option key={`dest-base-${b.id}`} value={b.id}>{b.nome}</option>)}
                {form.destino_tipo === 'OBRA' && obras.map(o => <option key={`dest-obra-${o.id}`} value={o.id}>{o.nome_obra || o.nome}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>11. Data Solicitada</label>
              <input 
                type="date" 
                value={form.data_solicitada} 
                onChange={e => setForm({ ...form, data_solicitada: e.target.value })} 
                style={inputStyle} 
              />
            </div>

            <div style={{ gridColumn: 'span 4' }}>
              <label style={labelStyle}>12. Observação</label>
              <input type="text" placeholder="Observações adicionais..." value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} style={inputStyle} />
            </div>

          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Registrado por: <strong>{usuarioLogado?.nome || usuarioLogado?.usuario || 'Usuário Master'}</strong>
            </span>

            <div style={{ display: 'flex', gap: '8px' }}>
              {editandoId && (
                <button 
                  type="button" 
                  onClick={cancelarEdicao}
                  style={{ height: '36px', padding: '0 16px', backgroundColor: '#94a3b8', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                >
                  Cancelar
                </button>
              )}

              <button type="submit" style={{ height: '36px', padding: '0 20px', backgroundColor: editandoId ? '#eab308' : '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus style={{ width: '16px', height: '16px' }} />
                {editandoId ? 'Atualizar Movimentação' : 'Registrar Movimentação'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* HISTÓRICO DE MOVIMENTAÇÕES */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', color: '#334155', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter style={{ width: '14px', height: '14px', color: '#2563eb' }} />
            Histórico de Movimentações ({movsFiltradas.length})
          </h3>

          <button 
            onClick={exportarCSV}
            style={{ height: '32px', padding: '0 12px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download style={{ width: '14px', height: '14px' }} />
            Baixar CSV
          </button>
        </div>

        <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
      <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '2px' }}>DATA SOLICITAÇÃO INÍCIO</label>
            <input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} style={{ ...inputStyle, height: '32px' }} />
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '2px' }}>DATA SOLICITAÇÃO FIM</label>
            <input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} style={{ ...inputStyle, height: '32px' }} />
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '2px' }}>TIPO MOVIMENTAÇÃO</label>
            <select value={filtroTipoMov} onChange={e => setFiltroTipoMov(e.target.value)} style={{ ...inputStyle, height: '32px' }}>
              <option value="">Todas</option>
              <option value="TRANSFERENCIA_SAIDA">Transferência (Saída)</option>
              <option value="TRANSFERENCIA_ENTRADA">Transferência (Entrada)</option>
              <option value="ENTRADA_FORNECEDOR">Entrada Fornecedor</option>
              <option value="CONSUMO_RDO">Consumo via RDO</option>
              <option value="AJUSTE">Ajuste de Estoque</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '2px' }}>OBRA DESTINO</label>
            <select value={filtroObraDestino} onChange={e => setFiltroObraDestino(e.target.value)} style={{ ...inputStyle, height: '32px' }}>
              <option value="">Todas as Obras</option>
              {obras.map(o => (
                <option key={`filtro-obra-${o.id}`} value={o.id}>{o.nome_obra || o.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '2px' }}>BUSCAR MATERIAL</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search style={{ position: 'absolute', left: '8px', width: '14px', height: '14px', color: '#94a3b8' }} />
              <input type="text" placeholder="Nome do material..." value={termoBusca} onChange={e => setTermoBusca(e.target.value)} style={{ ...inputStyle, height: '32px', paddingLeft: '28px' }} />
            </div>
          </div>
        </div>

<div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px', minWidth: '800px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '10px 12px' }}>Material</th>
                <th style={{ padding: '10px 12px' }}>Qtd</th>
                <th style={{ padding: '10px 12px' }}>Tipo</th>
                <th style={{ padding: '10px 12px' }}>Quem Envia / Origem</th>
                <th style={{ padding: '10px 12px' }}>Quem Pede / Destino</th>
                <th style={{ padding: '10px 12px' }}>Observação</th>
                <th style={{ padding: '10px 12px' }}>Registrado Por</th>
                <th style={{ padding: '10px 12px' }}>Data Solicitada</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {movsFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                    Nenhuma movimentação encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                movsFiltradas.map((m) => (
                  <tr key={`mov-${m.id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#0f172a' }}>
                      {m.material_nome || m.descricao || `Material #${m.material_id}`}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#2563eb' }}>
                      {m.quantidade} {m.unidade_medida || ''}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '3px 8px', backgroundColor: '#e0f2fe', color: '#0369a1', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}>
                        {m.tipo_movimentacao}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>
                      <div>{m.quem_envia_nome ? <strong>{m.quem_envia_nome}</strong> : '-'}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>{getNomeEntidade(m.origem_tipo, m.origem_id)}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#0f172a' }}>
                      <div>{m.quem_pede_nome ? <strong>{m.quem_pede_nome}</strong> : '-'}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>{getNomeEntidade(m.destino_tipo, m.destino_id)}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.observacao || ''}>
                      {m.observacao || '-'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>
                      {m.usuario_nome || `Usuário #${m.id_usuario}`}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#d97706' }}>
                      {formatarData(m.data_solicitada)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                        <button
                          onClick={() => handleEditar(m)}
                          title="Editar"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#eab308', padding: '4px' }}
                        >
                          <Edit2 style={{ width: '14px', height: '14px' }} />
                        </button>
                        <button
                          onClick={() => handleDeletar(m.id)}
                          title="Excluir"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                        >
                          <Trash2 style={{ width: '14px', height: '14px' }} />
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