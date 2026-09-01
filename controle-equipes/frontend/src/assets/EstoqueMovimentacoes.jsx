import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowRightLeft, Plus, Search, Filter, Download, Edit2, Trash2, CheckSquare, Square, X } from 'lucide-react';

export default function EstoqueMovimentacoes({ API_URL, mostrarMensagem, usuarioLogado }) {
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [bases, setBases] = useState([]);
  const [obras, setObras] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [gestores, setGestores] = useState([]);
  const [fornecedorMateriaisRel, setFornecedorMateriaisRel] = useState([]);

  // Filtros da Tabela
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroTipoMov, setFiltroTipoMov] = useState('');
  const [filtroObraDestino, setFiltroObraDestino] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  const [editandoId, setEditandoId] = useState(null);

  // Estado Base dos Campos Amarelos e Globais
  const estadoInicialForm = {
    quem_envia_id: '',
    tipo_movimentacao: 'TRANSFERENCIA_SAIDA',
    quem_pede_id: '',
    origem_tipo: 'BASE',
    origem_id: '',
    destino_tipo: 'OBRA',
    destino_id: '',
    data_solicitada: '',
    observacao: '',
    status: 'CONCLUIDO'
  };

  // Estado Inicial para o Quadrado Laranja (Itens Dinâmicos)
  const itemInicial = {
    fornecedor_id: '',
    categoria: '',
    material_id: '',
    quantidade: ''
  };

  const [form, setForm] = useState(estadoInicialForm);
  const [itens, setItens] = useState([itemInicial]);

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

  // Alternar Status no Checkbox da Tabela
  const toggleStatusConcluido = async (mov) => {
    const isConcluido = mov.status === 'CONCLUIDO' || mov.status === 'CONFIRMADO';
    const novoStatus = isConcluido ? 'PENDENTE' : 'CONCLUIDO';

    let dataFormatada = mov.data_solicitada;
    if (dataFormatada && typeof dataFormatada === 'string') {
      dataFormatada = dataFormatada.split('T')[0];
    }

    const payload = {
      ...mov,
      data_solicitada: dataFormatada || null,
      status: novoStatus
    };

    try {
      await axios.put(`${API_URL}/master/movimentacoes/${mov.id}`, payload);
      mostrarMensagem(`Status alterado para ${novoStatus}!`, 'sucesso');
      carregarDados();
    } catch (e) {
      console.error("Erro ao alterar status:", e.response?.data || e.message);
      mostrarMensagem('Erro ao alterar status no servidor.', 'erro');
    }
  };

  // Funções dos Itens (Quadrado Laranja)
  const adicionarItem = () => setItens([...itens, { ...itemInicial }]);

  const removerItem = (index) => {
    if (itens.length === 1) return;
    setItens(itens.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const novosItens = [...itens];
    novosItens[index][field] = value;
    if (field === 'fornecedor_id') {
      novosItens[index].categoria = '';
      novosItens[index].material_id = '';
    } else if (field === 'categoria') {
      novosItens[index].material_id = '';
    }
    setItens(novosItens);
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

  const getMateriaisFiltradosItem = (item) => {
    return materiais.filter(m => {
      const pertenceFornecedor = materialPertenceAoFornecedor(m, item.fornecedor_id);
      const bateCategoria = !item.categoria || String(m.tipo || '').toUpperCase().trim() === item.categoria.toUpperCase().trim();
      return pertenceFornecedor && bateCategoria;
    });
  };

  const getTiposDisponiveisItem = (fornId) => {
    const matsForn = materiais.filter(m => materialPertenceAoFornecedor(m, fornId));
    return Array.from(
      new Set(
        matsForn
          .map(m => m.tipo ? String(m.tipo).toUpperCase().trim() : null)
          .filter(Boolean)
      )
    );
  };

  const handleQuemEnviaChange = (e) => {
    const val = e.target.value;
    if (val === 'FORNECEDOR') {
      setForm(prev => ({ ...prev, quem_envia_id: '', origem_tipo: 'FORNECEDOR', origem_id: '' }));
    } else {
      setForm(prev => ({ ...prev, quem_envia_id: val, origem_tipo: 'BASE', origem_id: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    for (let i = 0; i < itens.length; i++) {
      if (!itens[i].material_id || !itens[i].quantidade) {
        return mostrarMensagem(`Preencha o Material e a Quantidade no Item ${i + 1}.`, 'erro');
      }
    }

    if (!form.destino_id) {
      return mostrarMensagem('Selecione o Destino Local.', 'erro');
    }

    try {
      if (editandoId) {
        const payload = {
          ...form,
          material_id: itens[0].material_id,
          quantidade: itens[0].quantidade,
          origem_id: form.origem_tipo === 'FORNECEDOR' ? itens[0].fornecedor_id : form.origem_id,
          quem_envia_id: form.quem_envia_id ? parseInt(form.quem_envia_id) : null,
          quem_pede_id: form.quem_pede_id ? parseInt(form.quem_pede_id) : null,
          id_usuario: usuarioLogado?.id || usuarioLogado?.id_usuario || 1,
          status: form.status
        };
        await axios.put(`${API_URL}/master/movimentacoes/${editandoId}`, payload);
        mostrarMensagem('Movimentação atualizada com sucesso!', 'sucesso');
      } else {
        const requisicoes = itens.map(item => {
          const payload = {
            ...form,
            material_id: item.material_id,
            quantidade: item.quantidade,
            origem_id: form.origem_tipo === 'FORNECEDOR' ? item.fornecedor_id : form.origem_id,
            quem_envia_id: form.quem_envia_id ? parseInt(form.quem_envia_id) : null,
            quem_pede_id: form.quem_pede_id ? parseInt(form.quem_pede_id) : null,
            id_usuario: usuarioLogado?.id || usuarioLogado?.id_usuario || 1,
            status: 'CONCLUIDO'
          };
          return axios.post(`${API_URL}/master/movimentacoes`, payload);
        });

        await Promise.all(requisicoes);
        mostrarMensagem(`${itens.length} Movimentação(ões) registrada(s) com sucesso!`, 'sucesso');
      }

      cancelarEdicao();
      carregarDados();
    } catch (e) {
      console.error("Erro ao salvar:", e);
      mostrarMensagem('Erro ao salvar movimentações.', 'erro');
    }
  };

  const handleEditar = (m) => {
    setEditandoId(m.id);
    const dataSolicitadaFormatada = m.data_solicitada ? m.data_solicitada.split('T')[0] : '';
    const matObj = materiais.find(x => Number(x.id) === Number(m.material_id));

    setForm({
      quem_envia_id: m.quem_envia_id || '',
      tipo_movimentacao: m.tipo_movimentacao || 'TRANSFERENCIA_SAIDA',
      quem_pede_id: m.quem_pede_id || m.id_gestor || '',
      origem_tipo: m.origem_tipo || 'BASE',
      origem_id: m.origem_id || '',
      destino_tipo: m.destino_tipo || 'OBRA',
      destino_id: m.destino_id || '',
      data_solicitada: dataSolicitadaFormatada,
      observacao: m.observacao || '',
      status: m.status || 'PENDENTE'
    });

    setItens([{
      fornecedor_id: m.origem_tipo === 'FORNECEDOR' ? m.origem_id : '',
      categoria: matObj?.tipo ? String(matObj.tipo).toUpperCase().trim() : '',
      material_id: m.material_id || '',
      quantidade: m.quantidade || ''
    }]);

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
    setItens([{ ...itemInicial }]);
  };

  const getNomeEntidade = (tipo, id) => {
    if (!id && tipo !== 'FORNECEDOR') return '-';
    if (tipo === 'FORNECEDOR') {
      const f = fornecedores.find(x => Number(x.id) === Number(id));
      return f ? `${f.nome_fantasia || f.razao_social}` : `Fornecedor #${id}`;
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

  // Filtragem da Lista para Renderização do GET
  const movsFiltradas = movimentacoes.filter(m => {
    const matNome = String(m.material_nome || m.descricao || '').toLowerCase();
    const busca = termoBusca.toLowerCase();
    if (busca && !matNome.includes(busca)) return false;
    if (filtroTipoMov && m.tipo_movimentacao !== filtroTipoMov) return false;
    if (filtroObraDestino && String(m.destino_id) !== String(filtroObraDestino)) return false;

    const statusAtual = m.status || (m.faturamento_id ? 'PENDENTE' : 'CONCLUIDO');
    if (filtroStatus && statusAtual !== filtroStatus) return false;

    if (m.data_solicitada) {
      const dataSolicitada = m.data_solicitada.split('T')[0];
      if (filtroDataInicio && dataSolicitada < filtroDataInicio) return false;
      if (filtroDataFim && dataSolicitada > filtroDataFim) return false;
    } else if (filtroDataInicio || filtroDataFim) {
      return false;
    }

    return true;
  });

  const exportarCSV = () => {
    if (!movsFiltradas.length) return mostrarMensagem('Nenhum dado para exportar.', 'erro');

    const cabecalho = ['Material', 'Tipo Material', 'Fornecedor', 'Quantidade', 'Unidade', 'Tipo Movimentação', 'Quem Envia', 'Origem', 'Quem Pede (Gestor)', 'Destino', 'Data Solicitada', 'Observação', 'Status'];
    const linhas = movsFiltradas.map(m => {
      const matObj = materiais.find(x => Number(x.id) === Number(m.material_id));
      const tipoMaterial = matObj?.tipo || m.material_tipo || '-';
      let fornecedorNome = '-';
      if (m.origem_tipo === 'FORNECEDOR' && m.origem_id) {
        const forn = fornecedores.find(f => Number(f.id) === Number(m.origem_id));
        fornecedorNome = forn ? (forn.nome_fantasia || forn.razao_social) : `Fornecedor #${m.origem_id}`;
      }
      return [
        `"${(m.material_nome || m.descricao || '').replace(/"/g, '""')}"`,
        `"${tipoMaterial.replace(/"/g, '""')}"`,
        `"${fornecedorNome.replace(/"/g, '""')}"`,
        m.quantidade,
        m.unidade_medida || 'UN',
        m.tipo_movimentacao,
        `"${m.quem_envia_nome || '-'}"`,
        `"${getNomeEntidade(m.origem_tipo, m.origem_id)}"`,
        `"${m.quem_pede_nome || '-'}"`,
        `"${getNomeEntidade(m.destino_tipo, m.destino_id)}"`,
        formatarData(m.data_solicitada),
        `"${(m.observacao || '-').replace(/"/g, '""')}"`,
        m.status || 'CONCLUIDO'
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [cabecalho.join(','), ...linhas.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `movimentacoes_${new Date().toISOString().slice(0, 10)}.csv`);
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
    display: 'block', marginBottom: '4px', textTransform: 'uppercase'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      
      {/* FORMULÁRIO DE LANÇAMENTO */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowRightLeft style={{ width: '18px', height: '18px', color: '#2563eb' }} />
          {editandoId ? 'Editar Movimentação de Estoque' : 'Lançamento de Movimentação de Estoque'}
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '10px' }}>
            
            {/* 1. QUEM VAI ENVIAR */}
            <div>
              <label style={labelStyle}>1. Quem vai enviar</label>
              <select value={form.origem_tipo === 'FORNECEDOR' ? 'FORNECEDOR' : form.quem_envia_id} onChange={handleQuemEnviaChange} style={inputStyle}>
                <option value="">Selecione...</option>
                <option value="FORNECEDOR" style={{ fontWeight: 'bold', color: '#2563eb' }}>🚚 FORNECEDOR</option>
                {gestores.map(g => (
                  <option key={`envia-${g.id || g.id_usuario}`} value={g.id || g.id_usuario}>
                    {g.nome || g.nome_gestor || g.usuario}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. ORIGEM LOCAL */}
            <div>
              <label style={labelStyle}>2. Origem - Local</label>
              <div style={{ display: 'flex', gap: '2px' }}>
                <select 
                  value={form.origem_tipo} 
                  onChange={e => setForm({ ...form, origem_tipo: e.target.value, origem_id: '' })} 
                  style={{ ...inputStyle, width: '45%' }}
                  disabled={form.origem_tipo === 'FORNECEDOR'}
                >
                  <option value="BASE">Base</option>
                  <option value="OBRA">Obra</option>
                  <option value="FORNECEDOR">Forn.</option>
                </select>

                <select 
                  value={form.origem_id} 
                  onChange={e => setForm({ ...form, origem_id: e.target.value })} 
                  style={{ ...inputStyle, width: '55%' }}
                  disabled={form.origem_tipo === 'FORNECEDOR'}
                >
                  <option value="">Selecione...</option>
                  {form.origem_tipo === 'BASE' && bases.map(b => <option key={`base-${b.id}`} value={b.id}>{b.nome}</option>)}
                  {form.origem_tipo === 'OBRA' && obras.map(o => <option key={`obra-${o.id}`} value={o.id}>{o.nome_obra || o.nome}</option>)}
                </select>
              </div>
            </div>

            {/* 7. TIPO MOVIMENTAÇÃO */}
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

            {/* 8. QUEM VAI PEDIR */}
            <div>
              <label style={labelStyle}>8. Quem vai pedir (Gestor)</label>
              <select value={form.quem_pede_id} onChange={e => setForm({ ...form, quem_pede_id: e.target.value })} style={inputStyle}>
                <option value="">Selecione o gestor...</option>
                {gestores.map(g => (
                  <option key={`pede-${g.id || g.id_usuario}`} value={g.id || g.id_usuario}>
                    {g.nome || g.nome_gestor || g.usuario}
                  </option>
                ))}
              </select>
            </div>

            {/* 9 & 10. DESTINO */}
            <div>
              <label style={labelStyle}>9. Destino *</label>
              <div style={{ display: 'flex', gap: '2px' }}>
                <select value={form.destino_tipo} onChange={e => setForm({ ...form, destino_tipo: e.target.value, destino_id: '' })} style={{ ...inputStyle, width: '45%' }}>
                  <option value="OBRA">Obra</option>
                  <option value="BASE">Base</option>
                </select>

                <select value={form.destino_id} onChange={e => setForm({ ...form, destino_id: e.target.value })} style={{ ...inputStyle, width: '55%' }}>
                  <option value="">Selecione...</option>
                  {form.destino_tipo === 'BASE' && bases.map(b => <option key={`dest-b-${b.id}`} value={b.id}>{b.nome}</option>)}
                  {form.destino_tipo === 'OBRA' && obras.map(o => <option key={`dest-o-${o.id}`} value={o.id}>{o.nome_obra || o.nome}</option>)}
                </select>
              </div>
            </div>

          </div>

          {/* QUADRADO LARANJA - MATERIAIS MÚLTIPLOS */}
          <div style={{ border: '2px dashed #f97316', padding: '12px', borderRadius: '8px', backgroundColor: '#fff7ed', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#c2410c' }}>
                📦 Lista de Materiais a Movimentar (Múltiplos Itens)
              </span>
              {!editandoId && (
                <button 
                  type="button" 
                  onClick={adicionarItem}
                  style={{ padding: '4px 10px', backgroundColor: '#ea580c', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus style={{ width: '14px', height: '14px' }} /> Adicionar Item
                </button>
              )}
            </div>

            {itens.map((item, index) => {
              const materiaisFiltrados = getMateriaisFiltradosItem(item);
              const tiposDisponiveis = getTiposDisponiveisItem(item.fornecedor_id);

              return (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.5fr 0.8fr auto', gap: '8px', alignItems: 'end', backgroundColor: '#ffffff', padding: '8px', borderRadius: '6px', border: '1px solid #ffedd5' }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '10px' }}>3. Fornecedor</label>
                    <select value={item.fornecedor_id} onChange={e => handleItemChange(index, 'fornecedor_id', e.target.value)} style={inputStyle}>
                      <option value="">Todos os Fornecedores...</option>
                      {fornecedores.map(f => (
                        <option key={`f-${f.id}`} value={f.id}>{f.nome_fantasia || f.razao_social}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ ...labelStyle, fontSize: '10px' }}>4. Tipo Material</label>
                    <select value={item.categoria} onChange={e => handleItemChange(index, 'categoria', e.target.value)} style={inputStyle}>
                      <option value="">Todos os Tipos...</option>
                      {tiposDisponiveis.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ ...labelStyle, fontSize: '10px' }}>5. Material *</label>
                    <select value={item.material_id} onChange={e => handleItemChange(index, 'material_id', e.target.value)} style={inputStyle}>
                      <option value="">{materiaisFiltrados.length === 0 ? 'Nenhum material' : 'Selecione...'}</option>
                      {materiaisFiltrados.map(m => (
                        <option key={`mat-${m.id}`} value={m.id}>{m.descricao} ({m.unidade_medida || 'UN'})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ ...labelStyle, fontSize: '10px' }}>6. Quantidade *</label>
                    <input type="number" step="0.01" placeholder="Ex: 50" value={item.quantidade} onChange={e => handleItemChange(index, 'quantidade', e.target.value)} style={inputStyle} />
                  </div>

                  {itens.length > 1 && !editandoId && (
                    <button 
                      type="button" 
                      onClick={() => removerItem(index)}
                      style={{ height: '36px', width: '36px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X style={{ width: '16px', height: '16px' }} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 3.8fr', gap: '10px' }}>
            <div>
              <label style={labelStyle}>11. Data Solicitada</label>
              <input type="date" value={form.data_solicitada} onChange={e => setForm({ ...form, data_solicitada: e.target.value })} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>12. Observação</label>
              <input type="text" placeholder="Observações adicionais..." value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Registrado por: <strong>{usuarioLogado?.nome || usuarioLogado?.usuario || 'Usuário Master'}</strong>
            </span>

            <div style={{ display: 'flex', gap: '8px' }}>
              {editandoId && (
                <button type="button" onClick={cancelarEdicao} style={{ height: '36px', padding: '0 16px', backgroundColor: '#94a3b8', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                  Cancelar
                </button>
              )}

              <button type="submit" style={{ height: '36px', padding: '0 20px', backgroundColor: editandoId ? '#eab308' : '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus style={{ width: '16px', height: '16px' }} />
                {editandoId ? 'Atualizar Movimentação' : 'Registrar Movimentação(ões)'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* SEÇÃO GET - HISTÓRICO E TABELA DE MOVIMENTAÇÕES */}
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

        {/* PAINEL DE FILTROS */}
        <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px', display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '2px' }}>DATA INÍCIO</label>
            <input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} style={{ ...inputStyle, height: '32px' }} />
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '2px' }}>DATA FIM</label>
            <input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} style={{ ...inputStyle, height: '32px' }} />
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '2px' }}>STATUS</label>
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ ...inputStyle, height: '32px' }}>
              <option value="">Todos os Status</option>
              <option value="PENDENTE">Pendente</option>
              <option value="CONCLUIDO">Concluído</option>
            </select>
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

        {/* TABELA COM CHECKBOX E RESULTADOS DO GET */}
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px', minWidth: '1080px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '40px' }}>Concluir</th>
                <th style={{ padding: '10px 12px' }}>Material / Tipo</th>
                <th style={{ padding: '10px 12px' }}>Fornecedor</th>
                <th style={{ padding: '10px 12px' }}>Qtd</th>
                <th style={{ padding: '10px 12px' }}>Tipo Mov.</th>
                <th style={{ padding: '10px 12px' }}>Quem Envia / Origem</th>
                <th style={{ padding: '10px 12px' }}>Quem Pede (Gestor)</th>
                <th style={{ padding: '10px 12px' }}>Data Solicitada</th>
                <th style={{ padding: '10px 12px' }}>Observação</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {movsFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                    Nenhuma movimentação encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                movsFiltradas.map((m) => {
                  const matObj = materiais.find(x => Number(x.id) === Number(m.material_id));
                  const tipoMaterial = matObj?.tipo || m.material_tipo || '-';

                  let fornecedorNome = '-';
                  if (m.origem_tipo === 'FORNECEDOR' && m.origem_id) {
                    const forn = fornecedores.find(f => Number(f.id) === Number(m.origem_id));
                    fornecedorNome = forn ? (forn.nome_fantasia || forn.razao_social) : `Fornecedor #${m.origem_id}`;
                  }

                  let quemPedeIdValido = m.quem_pede_id || m.id_gestor;
                  let quemPedeNome = m.quem_pede_nome || '-';
                  if (quemPedeIdValido) {
                    const gestorPede = gestores.find(g => Number(g.id || g.id_usuario) === Number(quemPedeIdValido));
                    if (gestorPede) {
                      quemPedeNome = gestorPede.nome || gestorPede.nome_gestor || gestorPede.usuario;
                    }
                  }

                  const statusFinal = m.status || (m.faturamento_id ? 'PENDENTE' : 'CONCLUIDO');
                  const isConcluido = statusFinal === 'CONCLUIDO';

                  return (
                    <tr key={`mov-${m.id}`} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isConcluido ? '#f0fdf4' : 'transparent' }}>
                      
                      {/* LOGICA DO CHECK / STATUS */}
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button
                          onClick={() => toggleStatusConcluido(m)}
                          title={isConcluido ? "Marcar como Pendente" : "Marcar como Concluído"}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: isConcluido ? '#16a34a' : '#94a3b8' }}
                        >
                          {isConcluido ? <CheckSquare style={{ width: '18px', height: '18px' }} /> : <Square style={{ width: '18px', height: '18px' }} />}
                        </button>
                      </td>

                      <td style={{ padding: '10px 12px', color: '#0f172a' }}>
                        <div style={{ fontWeight: 'bold' }}>{m.material_nome || m.descricao || `Material #${m.material_id}`}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>Tipo: {tipoMaterial}</div>
                      </td>

                      <td style={{ padding: '10px 12px', color: '#475569' }}>
                        {fornecedorNome}
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
                        <div><strong>{quemPedeNome}</strong></div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>{getNomeEntidade(m.destino_tipo, m.destino_id)}</div>
                      </td>

                      <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#d97706' }}>
                        {formatarData(m.data_solicitada)}
                      </td>

                      <td style={{ padding: '10px 12px', color: '#64748b', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.observacao}>
                        {m.observacao || '-'}
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}