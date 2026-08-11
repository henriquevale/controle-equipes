import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  FileText, Plus, Search, Edit2, Trash2, Download, Filter, 
  Building2, Truck, User, Calendar, DollarSign, MessageSquare 
} from 'lucide-react';

export default function FaturamentoDireto({ API_URL, mostrarMensagem }) {
  const [faturamentos, setFaturamentos] = useState([]);
  const [obrasDisponiveis, setObrasDisponiveis] = useState([]);
  const [fornecedoresDisponiveis, setFornecedoresDisponiveis] = useState([]);
  const [gestoresDisponiveis, setGestoresDisponiveis] = useState([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [editandoId, setEditandoId] = useState(null);

  const listaStatus = [
    'Solicitado',
    'Em orçamento',
    'Aguardando aprovação',
    'Aprovado(Pedido gerado)',
    'Comprado',
    'NF recebida',
    'Recebido em estoque',
    'Transferido para obra',
    'Concluído'
  ];

  const initialForm = {
    obra_id: '',
    numero_pedido_obra: '',
    boletim_medicao: '',
    fornecedor_id: '',
    numero_nota_fiscal: '',
    data_nota_fiscal: '',
    valor_nota_fiscal: '',
    status: 'Solicitado',
    id_gestor: '',
    observacao: '',
    data_solicitacao: new Date().toISOString().slice(0, 10)
  };

  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const [resFat, resObras, resForn, resUser] = await Promise.all([
        axios.get(`${API_URL}/faturamento-direto`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/obras`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/fornecedores`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/usuarios`).catch(() => ({ data: [] }))
      ]);

      setFaturamentos(resFat.data || []);
      setObrasDisponiveis(resObras.data || []);
      setFornecedoresDisponiveis(resForn.data || []);

      const todosUsuarios = resUser.data || [];

      // Filtra por cargo GESTOR
      const gestores = todosUsuarios.filter(u => {
        const cargo = String(u.cargo || '').trim().toUpperCase();
        return cargo === 'GESTOR';
      });

      // Se nenhum usuário tiver cargo 'GESTOR', carrega todos para testes
      if (gestores.length === 0 && todosUsuarios.length > 0) {
        setGestoresDisponiveis(todosUsuarios);
      } else {
        setGestoresDisponiveis(gestores);
      }

    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.obra_id) return mostrarMensagem('Selecione/Informe a Obra.', 'erro');
    if (!form.boletim_medicao.trim()) return mostrarMensagem('Informe o Boletim de Medição.', 'erro');
    if (!form.fornecedor_id) return mostrarMensagem('Selecione/Informe o Fornecedor.', 'erro');
    if (!form.id_gestor) return mostrarMensagem('Selecione o Gestor.', 'erro');
    if (!form.data_solicitacao) return mostrarMensagem('Informe a Data do Pedido.', 'erro');
    if (!form.status) return mostrarMensagem('Selecione o Status.', 'erro');

    const payload = {
      ...form,
      boletim_medicao: form.boletim_medicao.replace(/\s+/g, '').toUpperCase()
    };

    try {
      if (editandoId) {
        await axios.put(`${API_URL}/faturamento-direto/${editandoId}`, payload);
        mostrarMensagem('Faturamento atualizado com sucesso!', 'sucesso');
      } else {
        await axios.post(`${API_URL}/faturamento-direto`, payload);
        mostrarMensagem('Faturamento cadastrado com sucesso!', 'sucesso');
      }

      limparForm();
      carregarDados();
    } catch (e) {
      console.error("Erro ao salvar faturamento:", e);
      mostrarMensagem('Erro ao salvar registro de faturamento.', 'erro');
    }
  };

  const handleEditar = (fat) => {
    setEditandoId(fat.id);
    setForm({
      obra_id: fat.obra_id || '',
      numero_pedido_obra: fat.numero_pedido_obra || '',
      boletim_medicao: fat.boletim_medicao ? String(fat.boletim_medicao).replace(/\s+/g, '').toUpperCase() : '',
      fornecedor_id: fat.fornecedor_id || '',
      numero_nota_fiscal: fat.numero_nota_fiscal || '',
      data_nota_fiscal: fat.data_nota_fiscal ? fat.data_nota_fiscal.slice(0, 10) : '',
      valor_nota_fiscal: fat.valor_nota_fiscal || '',
      status: fat.status || 'Solicitado',
      id_gestor: fat.id_gestor || fat.gestor || fat.gestor_id || '',
      observacao: fat.observacao || '',
      data_solicitacao: fat.data_solicitacao ? fat.data_solicitacao.slice(0, 10) : ''
    });
  };

  const handleExcluir = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro?')) return;
    try {
      await axios.delete(`${API_URL}/faturamento-direto/${id}`);
      mostrarMensagem('Registro excluído!', 'sucesso');
      carregarDados();
    } catch (e) {
      console.error("Erro ao excluir registro:", e);
      mostrarMensagem('Erro ao excluir registro.', 'erro');
    }
  };

  const limparForm = () => {
    setEditandoId(null);
    setForm(initialForm);
  };

  const handleDownloadCSV = () => {
    if (faturamentosFiltrados.length === 0) {
      return mostrarMensagem('Nenhum registro para exportar.', 'erro');
    }

    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += 'ID;OBRA_ID;PEDIDO_OBRA;BOLETIM_MEDICAO;FORNECEDOR_ID;NUMERO_NF;DATA_NF;VALOR_NF;STATUS;ID_GESTOR;GESTOR_NOME;DATA_SOLICITACAO;OBSERVACAO\n';

    faturamentosFiltrados.forEach((f) => {
      const idGestor = f.id_gestor || f.gestor || f.gestor_id;
      const gestorObj = gestoresDisponiveis.find(g => String(g.id) === String(idGestor));
      const nomeGestor = f.gestor_nome || (gestorObj ? gestorObj.nome : '');

      const linha = `"${f.id}";"${f.obra_id}";"${f.numero_pedido_obra || ''}";"${f.boletim_medicao || ''}";"${f.fornecedor_id}";"${f.numero_nota_fiscal || ''}";"${f.data_nota_fiscal || ''}";"${f.valor_nota_fiscal || 0}";"${f.status}";"${idGestor || ''}";"${nomeGestor}";"${f.data_solicitacao || ''}";"${(f.observacao || '').replace(/"/g, '""')}"`;
      csvContent += linha + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `FATURAMENTO_DIRETO_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const faturamentosFiltrados = faturamentos.filter(fat => {
    const idGestor = fat.id_gestor || fat.gestor || fat.gestor_id;
    const gestorObj = gestoresDisponiveis.find(g => String(g.id) === String(idGestor));
    const nomeGestor = fat.gestor_nome || (gestorObj ? gestorObj.nome : '');

    const atendeStatus = !filtroStatus || fat.status === filtroStatus;
    const atendeBusca = 
      String(fat.numero_pedido_obra || '').toLowerCase().includes(termoBusca.toLowerCase()) ||
      String(fat.numero_nota_fiscal || '').toLowerCase().includes(termoBusca.toLowerCase()) ||
      String(fat.boletim_medicao || '').toLowerCase().includes(termoBusca.toLowerCase()) ||
      String(nomeGestor).toLowerCase().includes(termoBusca.toLowerCase()) ||
      String(fat.observacao || '').toLowerCase().includes(termoBusca.toLowerCase()) ||
      String(fat.obra_id || '').includes(termoBusca) ||
      String(fat.fornecedor_id || '').includes(termoBusca);

    return atendeStatus && atendeBusca;
  });

  const inputStyle = {
    width: '100%',
    height: '34px',
    padding: '0 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '11px',
    boxSizing: 'border-box',
    backgroundColor: '#fff',
    outline: 'none'
  };

  const labelStyle = {
    fontSize: '10px',
    fontWeight: '700',
    color: '#475569',
    display: 'block',
    marginBottom: '4px',
    textTransform: 'uppercase'
  };

  const sectionCardStyle = {
    backgroundColor: '#f8fafc',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* PAINEL DO FORMULÁRIO */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText style={{ width: '18px', height: '18px', color: '#2563eb' }} />
          {editandoId ? 'Editar Registro de Faturamento' : 'Novo Faturamento Direto'}
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* SEÇÃO 1: OBRA, FORNECEDOR E GESTOR */}
          <div style={sectionCardStyle}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 style={{ width: '14px', height: '14px' }} />
              1. Envolvidos & Responsáveis
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Obra *</label>
                {obrasDisponiveis.length > 0 ? (
                  <select
                    value={form.obra_id}
                    onChange={e => setForm({ ...form, obra_id: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">-- Selecione a Obra --</option>
                    {obrasDisponiveis.map(o => (
                      <option key={o.id} value={o.id}>{o.nome || o.nome_obra || `Obra #${o.id}`}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    placeholder="ID da Obra" 
                    value={form.obra_id} 
                    onChange={e => setForm({ ...form, obra_id: e.target.value })}
                    style={inputStyle}
                  />
                )}
              </div>

              <div>
                <label style={labelStyle}>Fornecedor *</label>
                {fornecedoresDisponiveis.length > 0 ? (
                  <select
                    value={form.fornecedor_id}
                    onChange={e => setForm({ ...form, fornecedor_id: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">-- Selecione o Fornecedor --</option>
                    {fornecedoresDisponiveis.map(f => (
                      <option key={f.id} value={f.id}>{f.nome_fantasia || `Fornecedor #${f.id}`}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    placeholder="ID do Fornecedor" 
                    value={form.fornecedor_id} 
                    onChange={e => setForm({ ...form, fornecedor_id: e.target.value })}
                    style={inputStyle}
                  />
                )}
              </div>

              <div>
                <label style={labelStyle}>Gestor *</label>
                <select
                  value={form.id_gestor}
                  onChange={e => setForm({ ...form, id_gestor: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">-- Selecione o Gestor --</option>
                  {gestoresDisponiveis.map(g => (
                    <option key={g.id} value={g.id}>{g.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: MEDIÇÃO, PEDIDO E STATUS */}
          <div style={sectionCardStyle}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar style={{ width: '14px', height: '14px' }} />
              2. Pedido, Medição e Status
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Boletim Medição * (MAIÚSCULO/SEM ESPAÇO)</label>
                <input 
                  type="text" 
                  placeholder="Ex: BM05" 
                  value={form.boletim_medicao} 
                  onChange={e => setForm({ 
                    ...form, 
                    boletim_medicao: e.target.value.replace(/\s+/g, '').toUpperCase() 
                  })}
                  style={{ ...inputStyle, fontWeight: 'bold', letterSpacing: '0.5px' }}
                />
              </div>

              <div>
                <label style={labelStyle}>Data do Pedido *</label>
                <input 
                  type="date" 
                  value={form.data_solicitacao} 
                  onChange={e => setForm({ ...form, data_solicitacao: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Nº Pedido Obra</label>
                <input 
                  type="number" 
                  placeholder="Ex: 101" 
                  value={form.numero_pedido_obra} 
                  onChange={e => setForm({ ...form, numero_pedido_obra: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Status *</label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  style={{ ...inputStyle, fontWeight: 'bold' }}
                >
                  {listaStatus.map((st, idx) => (
                    <option key={idx} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SEÇÃO 3: NOTA FISCAL & OBSERVAÇÃO */}
          <div style={sectionCardStyle}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <DollarSign style={{ width: '14px', height: '14px' }} />
              3. Dados Fiscais & Observações
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Nº Nota Fiscal</label>
                <input 
                  type="text" 
                  placeholder="Ex: NF-12948" 
                  value={form.numero_nota_fiscal} 
                  onChange={e => setForm({ ...form, numero_nota_fiscal: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Data da NF</label>
                <input 
                  type="date" 
                  value={form.data_nota_fiscal} 
                  onChange={e => setForm({ ...form, data_nota_fiscal: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Valor Nota Fiscal (R$)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  placeholder="0.00" 
                  value={form.valor_nota_fiscal} 
                  onChange={e => setForm({ ...form, valor_nota_fiscal: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: '4px' }}>
              <label style={labelStyle}>Observação / Anotações Gerais</label>
              <textarea
                rows="2"
                placeholder="Insira detalhes adicionais, justificativas ou notas sobre este faturamento..."
                value={form.observacao}
                onChange={e => setForm({ ...form, observacao: e.target.value })}
                style={{ 
                  ...inputStyle, 
                  height: 'auto', 
                  padding: '8px 10px', 
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>
          </div>

          {/* BOTÕES DE AÇÃO */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            {editandoId && (
              <button 
                type="button" 
                onClick={limparForm} 
                style={{ height: '34px', padding: '0 14px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}
              >
                Cancelar Edição
              </button>
            )}
            <button 
              type="submit" 
              style={{ height: '34px', padding: '0 18px', backgroundColor: editandoId ? '#0284c7' : '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus style={{ width: '14px', height: '14px' }} />
              {editandoId ? 'Atualizar Faturamento' : 'Salvar Faturamento'}
            </button>
          </div>
        </form>
      </div>

      {/* PAINEL DA TABELA DE REGISTROS */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', color: '#334155', margin: 0 }}>
            Registros Encontrados ({faturamentosFiltrados.length})
          </h3>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Filter style={{ width: '12px', height: '12px', color: '#64748b' }} />
              <select
                value={filtroStatus}
                onChange={e => setFiltroStatus(e.target.value)}
                style={{ height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px', backgroundColor: '#fff' }}
              >
                <option value="">-- Todos os Status --</option>
                {listaStatus.map((st, idx) => (
                  <option key={idx} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search style={{ position: 'absolute', left: '10px', width: '14px', height: '14px', color: '#94a3b8' }} />
              <input 
                type="text" 
                placeholder="Buscar pedido, NF, gestor..." 
                value={termoBusca} 
                onChange={e => setTermoBusca(e.target.value)}
                style={{ width: '200px', height: '32px', paddingLeft: '30px', paddingRight: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px', boxSizing: 'border-box' }}
              />
            </div>

            <button 
              type="button" 
              onClick={handleDownloadCSV}
              style={{ height: '32px', padding: '0 12px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Download style={{ width: '14px', height: '14px' }} />
              Exportar
            </button>
          </div>
        </div>

        {/* TABELA DE DADOS */}
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '10px 12px' }}>ID / Data Pedido</th>
                <th style={{ padding: '10px 12px' }}>Obra / Fornecedor</th>
                <th style={{ padding: '10px 12px' }}>Nº Pedido / BM</th>
                <th style={{ padding: '10px 12px' }}>Nº NF / Data NF / Valor</th>
                <th style={{ padding: '10px 12px' }}>Gestor / Status</th>
                <th style={{ padding: '10px 12px' }}>Observação</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {faturamentosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                    Nenhum registro de faturamento encontrado.
                  </td>
                </tr>
              ) : (
                faturamentosFiltrados.map((fat) => {
                  const obraObj = obrasDisponiveis.find(o => String(o.id) === String(fat.obra_id));
                  const fornObj = fornecedoresDisponiveis.find(f => String(f.id) === String(fat.fornecedor_id));
                  
                  const idGestorRegistro = fat.id_gestor || fat.gestor || fat.gestor_id;
                  const gestorObj = gestoresDisponiveis.find(g => String(g.id) === String(idGestorRegistro));
                  
                  const nomeGestorExibir = fat.gestor_nome || (gestorObj ? gestorObj.nome : (idGestorRegistro ? `ID: ${idGestorRegistro}` : '-'));

                  return (
                    <tr key={fat.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 'bold' }}>#{fat.id}</div>
                        <div style={{ fontSize: '9px', color: '#64748b' }}>
                          {fat.data_solicitacao ? new Date(fat.data_solicitacao).toLocaleDateString('pt-BR') : '-'}
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Building2 style={{ width: '12px', height: '12px', color: '#64748b' }} />
                          {obraObj ? (obraObj.nome || obraObj.nome_obra) : `Obra ID: ${fat.obra_id}`}
                        </div>
                        <div style={{ fontSize: '10px', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Truck style={{ width: '12px', height: '12px', color: '#0369a1' }} />
                          {fornObj ? fornObj.nome_fantasia : `Forn. ID: ${fat.fornecedor_id}`}
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <div>Ped: <span style={{ fontWeight: 'bold' }}>{fat.numero_pedido_obra || '-'}</span></div>
                        <div style={{ fontSize: '10px', color: '#0284c7', fontWeight: 'bold' }}>
                          BM: {fat.boletim_medicao || '-'}
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <div>NF: <span style={{ fontWeight: 'bold' }}>{fat.numero_nota_fiscal || '-'}</span></div>
                        <div style={{ fontSize: '9px', color: '#64748b' }}>
                          Data: {fat.data_nota_fiscal ? new Date(fat.data_nota_fiscal).toLocaleDateString('pt-BR') : '-'}
                        </div>
                        <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 'bold', marginTop: '2px' }}>
                          {fat.valor_nota_fiscal ? `R$ ${parseFloat(fat.valor_nota_fiscal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                          <User style={{ width: '11px', height: '11px', color: '#64748b' }} />
                          {nomeGestorExibir}
                        </div>
                        <span style={{ 
                          padding: '2px 8px', 
                          borderRadius: '12px', 
                          fontSize: '9px', 
                          fontWeight: 'bold',
                          display: 'inline-block',
                          backgroundColor: fat.status === 'Concluído' ? '#dcfce7' : fat.status === 'Solicitado' ? '#fef9c3' : '#e0f2fe',
                          color: fat.status === 'Concluído' ? '#15803d' : fat.status === 'Solicitado' ? '#a16207' : '#0369a1'
                        }}>
                          {fat.status}
                        </span>
                      </td>

                      <td style={{ padding: '10px 12px', maxWidth: '180px' }}>
                        {fat.observacao ? (
                          <div style={{ fontSize: '10px', color: '#475569', display: 'flex', alignItems: 'flex-start', gap: '4px' }} title={fat.observacao}>
                            <MessageSquare style={{ width: '12px', height: '12px', color: '#94a3b8', flexShrink: 0, marginTop: '2px' }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {fat.observacao}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: '#cbd5e1', fontSize: '10px' }}>-</span>
                        )}
                      </td>

                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <button onClick={() => handleEditar(fat)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', marginRight: '8px' }} title="Editar">
                          <Edit2 style={{ width: '14px', height: '14px' }} />
                        </button>
                        <button onClick={() => handleExcluir(fat.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }} title="Excluir">
                          <Trash2 style={{ width: '14px', height: '14px' }} />
                        </button>
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