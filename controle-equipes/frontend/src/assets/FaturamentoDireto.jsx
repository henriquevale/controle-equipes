import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  FileText, Plus, Search, Edit2, Trash2, Download, Filter, 
  Building2, Truck, User, Calendar, DollarSign, MessageSquare, Eye, X, Package, AlertCircle, CheckCircle2, Link, Paperclip, Send
} from 'lucide-react';

// ✅ Ajuste a assinatura do componente:
export default function FaturamentoDireto({ API_URL, mostrarMensagem, obrasDisponiveis: obrasProps, usuarioLogado }) {
  const [faturamentos, setFaturamentos] = useState([]);
  const [obrasDisponiveis, setObrasDisponiveis] = useState([]);
  const [fornecedoresDisponiveis, setFornecedoresDisponiveis] = useState([]);
  const [gestoresDisponiveis, setGestoresDisponiveis] = useState([]);
  const [materiaisDisponiveis, setMateriaisDisponiveis] = useState([]);
  const [fornecedorMateriais, setFornecedorMateriais] = useState([]);

  // Estados de Filtro
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroObra, setFiltroObra] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  const [editandoId, setEditandoId] = useState(null);
  const [itemModal, setItemModal] = useState(null);

  const listaStatus = [
    'Solicitado',
    'Em orçamento',
    'Aguardando aprovação',
    'Aprovado(Pedido gerado)',
    'Comprado',
    'NF recebida',
    'Recebido em estoque',
    'Transferido para obra',
    'Concluído',
    'Cancelado'
  ];

  const initialForm = {
    obra_id: '',
    numero_pedido_concessionaria: '',
    numero_pedido_interno: '',
    boletim_medicao: '',
    fornecedor_id: '',
    numero_nota_fiscal: '',
    data_nota_fiscal: '',
    valor_nota_fiscal: '',
    data_envio: '',
    status: 'Solicitado',
    motivo_cancelamento: '',
    id_gestor: '',
    url_email: '',
    arquivos_nf: [],
    observacao: '',
    data_solicitacao: new Date().toISOString().slice(0, 10),
    itens: []
  };

  const [form, setForm] = useState(initialForm);

  // Item temporário
  const [tempItem, setTempItem] = useState({ material_id: '', quantidade: '', valor_unitario: '' });

  useEffect(() => {
    carregarDados();
  }, []);

const carregarDados = async () => {
    try {
      // 1. Identifica ID e Cargo do usuário logado
      const idUsuario = usuarioLogado?.id || usuarioLogado?.id_usuario;
      const cargoUpper = String(usuarioLogado?.cargo || '').trim().toUpperCase();

      // 2. Define a requisição de obras dinamicamente:
      // MASTER e RH usam a rota geral; os demais perfis (ENGENHARIA, GESTOR) 
      // usam a rota com filtro de vínculo no banco.
      const reqObras = (cargoUpper === 'MASTER' || cargoUpper === 'RH')
        ? axios.get(`${API_URL}/master/obras-geral`)
        : axios.get(`${API_URL}/gestor/obras-ativas`, {
            params: {
              id: idUsuario,
              cargo: cargoUpper,
              incluirInativas: 'true' // Altere para 'false' se quiser listar apenas obras ativas
            }
          });

      // 3. Executa todas as buscas em paralelo
      const [resFat, resObras, resForn, resUser, resMat, resFornMat] = await Promise.all([
        axios.get(`${API_URL}/faturamento-direto`).catch(() => ({ data: [] })),
        reqObras.catch(() => ({ data: [] })),
        axios.get(`${API_URL}/fornecedores`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/master/usuarios`).catch(() => axios.get(`${API_URL}/usuarios`)).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/materiais`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/fornecedor-materiais`).catch(() => ({ data: [] }))
      ]);

      // 4. Se a propriedade obrasDisponiveis veio via Props e possui itens, 
      // você pode dar preferência a ela, caso contrário usa a busca dinâmica:
      const listaObrasFinal = (obrasProps && obrasProps.length > 0)
        ? obrasProps
        : (resObras.data || []);

      setFaturamentos(resFat.data || []);
      setObrasDisponiveis(listaObrasFinal);
      setFornecedoresDisponiveis(resForn.data || []);
      setMateriaisDisponiveis(resMat.data || []);
      setFornecedorMateriais(resFornMat.data || []);

      const todosUsuarios = resUser.data || [];
      const gestores = todosUsuarios.filter(u => String(u.cargo || '').trim().toUpperCase().includes('GESTOR'));
      setGestoresDisponiveis(gestores.length > 0 ? gestores : todosUsuarios);

    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    }
  };

  const materiaisDoFornecedor = form.fornecedor_id
    ? materiaisDisponiveis.filter(m => 
        fornecedorMateriais.some(fm => String(fm.id_fornecedor) === String(form.fornecedor_id) && String(fm.id_material) === String(m.id))
      )
    : [];

  const handleFornecedorChange = (fornecedorId) => {
    setForm(prev => ({
      ...prev,
      fornecedor_id: fornecedorId,
      itens: prev.fornecedor_id !== fornecedorId ? [] : prev.itens
    }));
    setTempItem({ material_id: '', quantidade: '', valor_unitario: '' });
  };

  const handleStatusChange = (novoStatus) => {
    setForm(prev => ({
      ...prev,
      status: novoStatus,
      data_envio: novoStatus === 'Concluído' 
        ? (prev.data_envio || new Date().toISOString().slice(0, 10)) 
        : ''
    }));
  };

  // Cálculo seguro tratando conversões para número
  const totalSomaItens = form.itens.reduce((acc, it) => {
    const qtd = parseFloat(it.quantidade) || 0;
    const vlr = parseFloat(it.valor_unitario) || 0;
    return acc + (qtd * vlr);
  }, 0);

  const valorNF = parseFloat(form.valor_nota_fiscal) || 0;
  const diferencaValorNF = valorNF - totalSomaItens;

  const handleAdicionarItem = () => {
    if (!form.fornecedor_id) {
      return mostrarMensagem('Selecione primeiro o Fornecedor para habilitar os materiais.', 'erro');
    }
    if (!tempItem.material_id || !tempItem.quantidade) {
      return mostrarMensagem('Selecione o material e informe a quantidade.', 'erro');
    }

    const materialObj = materiaisDisponiveis.find(m => String(m.id) === String(tempItem.material_id));
    const novoItem = {
      ...tempItem,
      nome_material: materialObj ? (materialObj.descricao || materialObj.nome) : `Material #${tempItem.material_id}`,
      quantidade: parseFloat(tempItem.quantidade) || 0,
      valor_unitario: parseFloat(tempItem.valor_unitario) || 0
    };

    const novosItens = [...form.itens, novoItem];
    const valorTotalItens = novosItens.reduce((acc, it) => acc + (it.quantidade * it.valor_unitario), 0);

    setForm({
      ...form,
      itens: novosItens,
      valor_nota_fiscal: form.valor_nota_fiscal ? form.valor_nota_fiscal : (valorTotalItens > 0 ? valorTotalItens.toFixed(2) : '')
    });

    setTempItem({ material_id: '', quantidade: '', valor_unitario: '' });
  };

  const handleRemoverItem = (index) => {
    const novosItens = form.itens.filter((_, i) => i !== index);
    setForm({ ...form, itens: novosItens });
  };

  const handleFilesChange = (e) => {
    const files = Array.from(e.target.files);
    setForm(prev => ({
      ...prev,
      arquivos_nf: [...prev.arquivos_nf, ...files]
    }));
  };

  const handleRemoverArquivo = (index) => {
    setForm(prev => ({
      ...prev,
      arquivos_nf: prev.arquivos_nf.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.obra_id) return mostrarMensagem('Selecione/Informe a Obra.', 'erro');
    if (!form.boletim_medicao.trim()) return mostrarMensagem('Informe o Boletim de Medição.', 'erro');
    if (!form.fornecedor_id) return mostrarMensagem('Selecione/Informe o Fornecedor.', 'erro');
    if (!form.id_gestor) return mostrarMensagem('Selecione o Gestor.', 'erro');
    if (!form.data_solicitacao) return mostrarMensagem('Informe a Data do Pedido.', 'erro');
    if (!form.status) return mostrarMensagem('Selecione o Status.', 'erro');
    if (form.status === 'Cancelado' && !form.motivo_cancelamento.trim()) {
      return mostrarMensagem('Para o status Cancelado, informe o motivo.', 'erro');
    }

  // Substitua o payload do handleSubmit por:
    // ✅ Ajuste no payload:
    const payload = {
      obra_id: form.obra_id,
      numero_pedido_obra: form.numero_pedido_concessionaria,
      boletim_medicao: form.boletim_medicao,
      fornecedor_id: form.fornecedor_id,
      numero_nota_fiscal: form.numero_nota_fiscal,
      data_nota_fiscal: form.data_nota_fiscal || null,
      valor_nota_fiscal: form.valor_nota_fiscal,
      status: form.status,
      id_gestor: form.id_gestor,
      data_solicitacao: form.data_solicitacao,
      observacao: form.observacao,
      data_envio: form.data_envio || null,
      url_email: form.url_email,
      itens: form.itens,
      id_usuario: usuarioLogado?.id || usuarioLogado?.id_usuario,
      cargo: usuarioLogado?.cargo || 'ENGENHARIA'
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
    const formatarDataInput = (data) => {
      if (!data) return '';
      try {
        const d = new Date(data);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().slice(0, 10);
      } catch (e) {
        return '';
      }
    };

    setEditandoId(fat.id);
    setForm({
      obra_id: fat.obra_id || '',
      numero_pedido_concessionaria: fat.numero_pedido_obra || fat.numero_pedido_concessionaria || '',
      numero_pedido_interno: fat.numero_pedido_interno || '',
      boletim_medicao: fat.boletim_medicao ? String(fat.boletim_medicao).replace(/\s+/g, '').toUpperCase() : '',
      fornecedor_id: fat.fornecedor_id || '',
      numero_nota_fiscal: fat.numero_nota_fiscal || '',
      data_nota_fiscal: formatarDataInput(fat.data_nota_fiscal),
      valor_nota_fiscal: fat.valor_nota_fiscal || '',
      data_envio: formatarDataInput(fat.data_envio),
      status: fat.status || 'Solicitado',
      motivo_cancelamento: fat.motivo_cancelamento || '',
      id_gestor: fat.id_gestor || fat.gestor || fat.gestor_id || '',
      url_email: fat.url_email || '',
      arquivos_nf: [],
      observacao: fat.observacao || '',
      data_solicitacao: formatarDataInput(fat.data_solicitacao) || new Date().toISOString().slice(0, 10),
      itens: Array.isArray(fat.itens) ? fat.itens : []
    });
  };

const handleExcluir = async (fat) => {
  // Pega o ID independente se no banco está como 'id', 'id_faturamento' ou '_id'
  const idParaExcluir = typeof fat === 'object' ? (fat.id || fat.id_faturamento || fat._id) : fat;

  if (!idParaExcluir) {
    return mostrarMensagem('ID do registro não encontrado para exclusão.', 'erro');
  }

  if (!window.confirm(`Tem certeza que deseja excluir o registro #${idParaExcluir}?`)) return;

  try {
    // CERTIFIQUE-SE de que esta rota coincide com o seu backend
    await axios.delete(`${API_URL}/faturamento-direto/${idParaExcluir}`);
    mostrarMensagem('Registro excluído com sucesso!', 'sucesso');
    carregarDados();
  } catch (e) {
    console.error("Erro ao excluir registro:", e);
    if (e.response && e.response.status === 404) {
      mostrarMensagem('Rota de exclusão não encontrada no servidor (Erro 404). Verifique a URL da API no Backend.', 'erro');
    } else {
      mostrarMensagem('Erro ao excluir registro.', 'erro');
    }
  }
};

  const limparForm = () => {
    setEditandoId(null);
    setForm(initialForm);
    setTempItem({ material_id: '', quantidade: '', valor_unitario: '' });
  };

  const handleDownloadModal = (item) => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(item, null, 2))}`;
    const link = document.createElement('a');
    link.href = jsonString;
    link.download = `Pedido_Faturamento_${item.id}.json`;
    link.click();
  };

  const handleDownloadCSV = () => {
    if (faturamentosFiltrados.length === 0) {
      return mostrarMensagem('Nenhum registro para exportar.', 'erro');
    }

    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += 'ID;OBRA_ID;PEDIDO_CONCESSIONARIA;PEDIDO_INTERNO;BOLETIM_MEDICAO;FORNECEDOR_ID;NUMERO_NF;DATA_NF;VALOR_NF;DATA_ENVIO;STATUS;MOTIVO_CANCELAMENTO;ID_GESTOR;URL_EMAIL;DATA_SOLICITACAO;OBSERVACAO\n';

    faturamentosFiltrados.forEach((f) => {
      const idGestor = f.id_gestor || f.gestor || f.gestor_id;
      const linha = `"${f.id}";"${f.obra_id}";"${f.numero_pedido_concessionaria || ''}";"${f.numero_pedido_interno || ''}";"${f.boletim_medicao || ''}";"${f.fornecedor_id}";"${f.numero_nota_fiscal || ''}";"${f.data_nota_fiscal || ''}";"${f.valor_nota_fiscal || 0}";"${f.data_envio || ''}";"${f.status}";"${f.motivo_cancelamento || ''}";"${idGestor || ''}";"${f.url_email || ''}";"${f.data_solicitacao || ''}";"${(f.observacao || '').replace(/"/g, '""')}"`;
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
    const atendeObra = !filtroObra || String(fat.obra_id) === String(filtroObra);

    let atendeData = true;
    const dataFat = fat.data_solicitacao ? fat.data_solicitacao.slice(0, 10) : '';

    if (filtroDataInicio && dataFat && dataFat < filtroDataInicio) atendeData = false;
    if (filtroDataFim && dataFat && dataFat > filtroDataFim) atendeData = false;

    const atendeBusca = 
      String(fat.numero_pedido_concessionaria || fat.numero_pedido_obra || '').toLowerCase().includes(termoBusca.toLowerCase()) ||
      String(fat.numero_pedido_interno || '').toLowerCase().includes(termoBusca.toLowerCase()) ||
      String(fat.numero_nota_fiscal || '').toLowerCase().includes(termoBusca.toLowerCase()) ||
      String(fat.boletim_medicao || '').toLowerCase().includes(termoBusca.toLowerCase()) ||
      String(nomeGestor).toLowerCase().includes(termoBusca.toLowerCase()) ||
      String(fat.observacao || '').toLowerCase().includes(termoBusca.toLowerCase());

    return atendeStatus && atendeObra && atendeData && atendeBusca;
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
          
          {/* SEÇÃO 1: PEDIDO, MEDIÇÃO E STATUS */}
          <div style={sectionCardStyle}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar style={{ width: '14px', height: '14px' }} />
              1. Pedido, Medição e Status
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Boletim Medição *</label>
                <input 
                  type="text" 
                  placeholder="Ex: BM05" 
                  value={form.boletim_medicao} 
                  onChange={e => setForm({ ...form, boletim_medicao: e.target.value.replace(/\s+/g, '').toUpperCase() })}
                  style={{ ...inputStyle, fontWeight: 'bold' }}
                />
              </div>

              <div>
                <label style={labelStyle}>Data do Pedido *</label>
                <input type="date" value={form.data_solicitacao} onChange={e => setForm({ ...form, data_solicitacao: e.target.value })} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Nº Pedido (Concessionária)</label>
                <input type="number" placeholder="Ex: 101" value={form.numero_pedido_concessionaria} onChange={e => setForm({ ...form, numero_pedido_concessionaria: e.target.value })} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Nº Pedido (Interno)</label>
                <input type="text" placeholder="Ex: PED-2024-01" value={form.numero_pedido_interno} onChange={e => setForm({ ...form, numero_pedido_interno: e.target.value })} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Status *</label>
                <select value={form.status} onChange={e => handleStatusChange(e.target.value)} style={{ ...inputStyle, fontWeight: 'bold' }}>
                  {listaStatus.map((st, idx) => (
                    <option key={idx} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              {form.status === 'Cancelado' && (
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ ...labelStyle, color: '#dc2626' }}>Motivo do Cancelamento *</label>
                  <input 
                    type="text" 
                    placeholder="Informe o motivo do cancelamento..." 
                    value={form.motivo_cancelamento} 
                    onChange={e => setForm({ ...form, motivo_cancelamento: e.target.value })} 
                    style={{ ...inputStyle, borderColor: '#fca5a5', backgroundColor: '#fef2f2' }} 
                  />
                </div>
              )}
            </div>
          </div>

          {/* SEÇÃO 2: ENVOLVIDOS & RESPONSÁVEIS */}
          <div style={sectionCardStyle}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 style={{ width: '14px', height: '14px' }} />
              2. Envolvidos & Responsáveis
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Obra *</label>
                {obrasDisponiveis.length > 0 ? (
                  <select value={form.obra_id} onChange={e => setForm({ ...form, obra_id: e.target.value })} style={inputStyle}>
                    <option value="">-- Selecione a Obra --</option>
                    {obrasDisponiveis.map(o => (
                      <option key={o.id} value={o.id}>{o.nome_obra || o.nome || `Obra #${o.id}`}</option>
                    ))}
                  </select>
                ) : (
                  <input type="text" placeholder="ID da Obra" value={form.obra_id} onChange={e => setForm({ ...form, obra_id: e.target.value })} style={inputStyle} />
                )}
              </div>

              <div>
                <label style={labelStyle}>Fornecedor *</label>
                {fornecedoresDisponiveis.length > 0 ? (
                  <select value={form.fornecedor_id} onChange={e => handleFornecedorChange(e.target.value)} style={inputStyle}>
                    <option value="">-- Selecione o Fornecedor --</option>
                    {fornecedoresDisponiveis.map(f => (
                      <option key={f.id} value={f.id}>{f.nome_fantasia || `Fornecedor #${f.id}`}</option>
                    ))}
                  </select>
                ) : (
                  <input type="text" placeholder="ID do Fornecedor" value={form.fornecedor_id} onChange={e => handleFornecedorChange(e.target.value)} style={inputStyle} />
                )}
              </div>

              <div>
                <label style={labelStyle}>Gestor *</label>
                <select value={form.id_gestor} onChange={e => setForm({ ...form, id_gestor: e.target.value })} style={inputStyle}>
                  <option value="">-- Selecione o Gestor --</option>
                  {gestoresDisponiveis.map(g => (
                    <option key={g.id} value={g.id}>{g.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SEÇÃO 3: ITENS DO PEDIDO */}
          <div style={sectionCardStyle}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Package style={{ width: '14px', height: '14px' }} />
              3. Itens do Pedido (Materiais do Fornecedor Selecionado)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', alignItems: 'flex-end' }}>
              <div>
                <label style={labelStyle}>Material / Insumo</label>
                <select 
                  value={tempItem.material_id} 
                  onChange={e => setTempItem({ ...tempItem, material_id: e.target.value })} 
                  disabled={!form.fornecedor_id}
                  style={{ 
                    ...inputStyle, 
                    backgroundColor: !form.fornecedor_id ? '#f1f5f9' : '#fff',
                    cursor: !form.fornecedor_id ? 'not-allowed' : 'default'
                  }}
                >
                  <option value="">
                    {!form.fornecedor_id 
                      ? '-- Selecione um Fornecedor Primeiro --' 
                      : materiaisDoFornecedor.length === 0 
                      ? 'Nenhum material associado a este fornecedor' 
                      : '-- Selecione o Material --'}
                  </option>
                  {materiaisDoFornecedor.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.descricao || m.nome} ({m.unidade_medida || 'UN'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Quantidade</label>
                <input 
                  type="number" 
                  step="0.01" 
                  placeholder="0.00" 
                  value={tempItem.quantidade} 
                  disabled={!form.fornecedor_id}
                  onChange={e => setTempItem({ ...tempItem, quantidade: e.target.value })} 
                  style={{ 
                    ...inputStyle, 
                    backgroundColor: !form.fornecedor_id ? '#f1f5f9' : '#fff',
                    cursor: !form.fornecedor_id ? 'not-allowed' : 'default'
                  }} 
                />
              </div>

              <div>
                <label style={labelStyle}>Valor Unitário (R$)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  placeholder="0.00" 
                  value={tempItem.valor_unitario} 
                  disabled={!form.fornecedor_id}
                  onChange={e => setTempItem({ ...tempItem, valor_unitario: e.target.value })} 
                  style={{ 
                    ...inputStyle, 
                    backgroundColor: !form.fornecedor_id ? '#f1f5f9' : '#fff',
                    cursor: !form.fornecedor_id ? 'not-allowed' : 'default'
                  }} 
                />
              </div>

              <button 
                type="button" 
                onClick={handleAdicionarItem}
                disabled={!form.fornecedor_id}
                style={{ 
                  height: '34px', 
                  padding: '0 12px', 
                  backgroundColor: !form.fornecedor_id ? '#94a3b8' : '#0284c7', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '6px', 
                  fontWeight: 'bold', 
                  cursor: !form.fornecedor_id ? 'not-allowed' : 'pointer', 
                  fontSize: '11px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px' 
                }}
              >
                <Plus style={{ width: '14px', height: '14px' }} /> Add
              </button>
            </div>

            {form.itens.length > 0 && (
              <div style={{ marginTop: '8px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px' }}>Material</th>
                      <th style={{ padding: '6px 8px' }}>Qtd.</th>
                      <th style={{ padding: '6px 8px' }}>Vlr. Unit.</th>
                      <th style={{ padding: '6px 8px' }}>Subtotal</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center' }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.itens.map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 8px' }}>{it.nome_material}</td>
                        <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{it.quantidade}</td>
                        <td style={{ padding: '6px 8px' }}>R$ {parseFloat(it.valor_unitario || 0).toFixed(2)}</td>
                        <td style={{ padding: '6px 8px', fontWeight: 'bold', color: '#16a34a' }}>
                          R$ {((parseFloat(it.quantidade) || 0) * (parseFloat(it.valor_unitario) || 0)).toFixed(2)}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <button type="button" onClick={() => handleRemoverItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>
                            <Trash2 style={{ width: '12px', height: '12px' }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 'bold' }}>
                      <td colSpan="3" style={{ padding: '8px', textAlign: 'right', color: '#334155' }}>Soma dos Itens:</td>
                      <td style={{ padding: '8px', color: '#0284c7', fontSize: '12px' }}>
                        R$ {totalSomaItens.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* SEÇÃO 4: DADOS FISCAIS */}
          <div style={sectionCardStyle}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <DollarSign style={{ width: '14px', height: '14px' }} />
              4. Dados Fiscais
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Nº Nota Fiscal</label>
                <input type="text" placeholder="Ex: NF-12948" value={form.numero_nota_fiscal} onChange={e => setForm({ ...form, numero_nota_fiscal: e.target.value })} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Data da NF</label>
                <input type="date" value={form.data_nota_fiscal} onChange={e => setForm({ ...form, data_nota_fiscal: e.target.value })} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Valor Nota Fiscal (R$)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  placeholder="0.00" 
                  value={form.valor_nota_fiscal} 
                  onChange={e => setForm({ ...form, valor_nota_fiscal: e.target.value })} 
                  style={{ ...inputStyle, fontWeight: 'bold' }} 
                />
              </div>

              <div>
                <label style={{ ...labelStyle, color: form.status === 'Concluído' ? '#16a34a' : '#94a3b8' }}>
                  Data de Envio {form.status === 'Concluído' ? '*' : '(Disponível se Concluído)'}
                </label>
                <input 
                  type="date" 
                  value={form.data_envio} 
                  disabled={form.status !== 'Concluído'}
                  onChange={e => setForm({ ...form, data_envio: e.target.value })} 
                  style={{ 
                    ...inputStyle, 
                    backgroundColor: form.status !== 'Concluído' ? '#f1f5f9' : '#fff',
                    borderColor: form.status === 'Concluído' ? '#22c55e' : '#cbd5e1',
                    cursor: form.status !== 'Concluído' ? 'not-allowed' : 'default',
                    fontWeight: form.status === 'Concluído' ? 'bold' : 'normal'
                  }} 
                />
              </div>
            </div>

            {/* PAINEL DE VALIDAÇÃO DE CONCILIAÇÃO DA NF X ITENS */}
            <div style={{ 
              padding: '10px 12px', 
              borderRadius: '6px', 
              fontSize: '11px', 
              display: 'flex', 
              alignItems: 'center', 
              justify: 'space-between', 
              backgroundColor: Math.abs(diferencaValorNF) < 0.01 && valorNF > 0 ? '#f0fdf4' : diferencaValorNF !== 0 && valorNF > 0 ? '#fef2f2' : '#f8fafc',
              border: `1px solid ${Math.abs(diferencaValorNF) < 0.01 && valorNF > 0 ? '#bbf7d0' : diferencaValorNF !== 0 && valorNF > 0 ? '#fecaca' : '#e2e8f0'}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {Math.abs(diferencaValorNF) < 0.01 && valorNF > 0 ? (
                  <CheckCircle2 style={{ width: '16px', height: '16px', color: '#16a34a' }} />
                ) : (
                  <AlertCircle style={{ width: '16px', height: '16px', color: diferencaValorNF !== 0 && valorNF > 0 ? '#dc2626' : '#64748b' }} />
                )}
                <div>
                  <div style={{ fontWeight: 'bold', color: Math.abs(diferencaValorNF) < 0.01 && valorNF > 0 ? '#15803d' : diferencaValorNF !== 0 && valorNF > 0 ? '#991b1b' : '#334155' }}>
                    Soma dos Itens: R$ {totalSomaItens.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>
                    {valorNF === 0 
                      ? 'Informe o Valor da Nota Fiscal para comparar com os itens.' 
                      : Math.abs(diferencaValorNF) < 0.01 
                      ? 'Valores Bateram! A soma dos itens confere perfeitamente com o valor da Nota Fiscal.' 
                      : `Divergência de R$ ${Math.abs(diferencaValorNF).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} em relação ao Valor da NF.`}
                  </div>
                </div>
              </div>

              {form.itens.length > 0 && Math.abs(diferencaValorNF) >= 0.01 && (
                <button 
                  type="button" 
                  onClick={() => setForm({ ...form, valor_nota_fiscal: totalSomaItens.toFixed(2) })}
                  style={{ height: '26px', padding: '0 10px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '10px', cursor: 'pointer' }}
                >
                  Igualar Valor NF com Itens
                </button>
              )}
            </div>
          </div>

          {/* SEÇÃO 5: URL, ARQUIVOS & OBSERVAÇÕES */}
          <div style={sectionCardStyle}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Link style={{ width: '14px', height: '14px' }} />
              5. URL, Arquivos Anexos & Observações
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <div>
                <label style={labelStyle}>URL / Link do E-mail</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Link style={{ position: 'absolute', left: '8px', width: '12px', height: '12px', color: '#94a3b8' }} />
                  <input 
                    type="url" 
                    placeholder="https://outlook.office.com/..." 
                    value={form.url_email} 
                    onChange={e => setForm({ ...form, url_email: e.target.value })} 
                    style={{ ...inputStyle, paddingLeft: '26px' }} 
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>*NÃO USAR AINDA* -Anexar Arquivos (Múltiplos)</label>
                <input 
                  type="file" 
                  multiple
                  accept="application/pdf,image/*"
                  onChange={handleFilesChange}
                  style={{ ...inputStyle, padding: '4px' }}
                />

                {form.arquivos_nf.length > 0 && (
                  <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {form.arquivos_nf.map((file, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '10px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Paperclip style={{ width: '12px', height: '12px', color: '#0284c7' }} />
                          {file.name}
                        </span>
                        <button type="button" onClick={() => handleRemoverArquivo(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>
                          <X style={{ width: '12px', height: '12px' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Observação / Anotações Gerais</label>
              <textarea
                rows="2"
                placeholder="Insira detalhes adicionais..."
                value={form.observacao}
                onChange={e => setForm({ ...form, observacao: e.target.value })}
                style={{ ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
          </div>

          {/* BOTÕES DE AÇÃO */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            {editandoId && (
              <button type="button" onClick={limparForm} style={{ height: '34px', padding: '0 14px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>
                Cancelar Edição
              </button>
            )}
            <button type="submit" style={{ height: '34px', padding: '0 18px', backgroundColor: editandoId ? '#0284c7' : '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
            <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={{ height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px', backgroundColor: '#fff' }}>
              <option value="">-- Todas as Obras --</option>
              {obrasDisponiveis.map(o => (
                <option key={o.id} value={o.id}>{o.nome_obra || o.nome || `Obra #${o.id}`}</option>
              ))}
            </select>

            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px', backgroundColor: '#fff' }}>
              <option value="">-- Todos os Status --</option>
              {listaStatus.map((st, idx) => (
                <option key={idx} value={st}>{st}</option>
              ))}
            </select>

            <input type="date" title="Data Inicial" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} style={{ height: '32px', padding: '0 6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px' }} />
            <span style={{ fontSize: '10px', color: '#64748b' }}>até</span>
            <input type="date" title="Data Final" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} style={{ height: '32px', padding: '0 6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px' }} />

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search style={{ position: 'absolute', left: '10px', width: '14px', height: '14px', color: '#94a3b8' }} />
              <input type="text" placeholder="Buscar pedido, NF, gestor..." value={termoBusca} onChange={e => setTermoBusca(e.target.value)} style={{ width: '180px', height: '32px', paddingLeft: '30px', paddingRight: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px' }} />
            </div>

            <button type="button" onClick={handleDownloadCSV} style={{ height: '32px', padding: '0 12px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Download style={{ width: '14px', height: '14px' }} /> Exportar
            </button>
          </div>
        </div>

        {/* TABELA DE DADOS */}
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '10px 12px' }}>Obra / Fornecedor</th>
                <th style={{ padding: '10px 12px' }}>Nº Pedidos / BM</th>
                <th style={{ padding: '10px 12px' }}>Nº NF</th>
                <th style={{ padding: '10px 12px' }}>Data NF / Envio</th>
                <th style={{ padding: '10px 12px' }}>Valor (R$)</th>
                <th style={{ padding: '10px 12px' }}>Gestor / Status</th>
                <th style={{ padding: '10px 12px' }}>Observação</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {faturamentosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
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
                        <div style={{ fontWeight: 'bold' }}>{obraObj ? (obraObj.nome_obra || obraObj.nome) : `Obra ID: ${fat.obra_id}`}</div>
                        <div style={{ fontSize: '10px', color: '#0369a1', marginTop: '2px' }}>{fornObj ? fornObj.nome_fantasia : `Forn. ID: ${fat.fornecedor_id}`}</div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div>Ped. Concess: <span style={{ fontWeight: 'bold' }}>{fat.numero_pedido_concessionaria || fat.numero_pedido_obra || '-'}</span></div>
                        <div>Ped. Interno: <span style={{ fontWeight: 'bold', color: '#475569' }}>{fat.numero_pedido_interno || '-'}</span></div>
                        <div style={{ fontSize: '10px', color: '#0284c7', fontWeight: 'bold' }}>BM: {fat.boletim_medicao || '-'}</div>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>{fat.numero_nota_fiscal || '-'}</td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>
                        <div>NF: {fat.data_nota_fiscal ? new Date(fat.data_nota_fiscal).toLocaleDateString('pt-BR') : '-'}</div>
                        {fat.data_envio && (
                          <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 'bold' }}>
                            Envio: {new Date(fat.data_envio).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#16a34a' }}>
                        {fat.valor_nota_fiscal ? `R$ ${parseFloat(fat.valor_nota_fiscal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#334155' }}>{nomeGestorExibir}</div>
                        <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '9px', fontWeight: 'bold', display: 'inline-block', backgroundColor: fat.status === 'Concluído' ? '#dcfce7' : fat.status === 'Cancelado' ? '#fef2f2' : fat.status === 'Solicitado' ? '#fef9c3' : '#e0f2fe', color: fat.status === 'Concluído' ? '#15803d' : fat.status === 'Cancelado' ? '#991b1b' : fat.status === 'Solicitado' ? '#a16207' : '#0369a1' }}>
                          {fat.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', maxWidth: '180px' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{fat.observacao || '-'}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => setItemModal(fat)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0284c7', marginRight: '8px' }} title="Ver Detalhes do Pedido">
                          <Eye style={{ width: '14px', height: '14px' }} />
                        </button>
                        <button onClick={() => handleEditar(fat)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', marginRight: '8px' }} title="Editar">
                          <Edit2 style={{ width: '14px', height: '14px' }} />
                        </button>
                        <button 
                          onClick={() => handleExcluir(fat)} 
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }} 
                          title="Excluir"
                        >
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

      {/* MODAL DE DETALHES DO PEDIDO */}
      {itemModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
                  Detalhes do Pedido / Faturamento Direto #{itemModal.id}
                </h3>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Data Solicitada: {itemModal.data_solicitacao ? new Date(itemModal.data_solicitacao).toLocaleDateString('pt-BR') : '-'}</span>
              </div>
              <button onClick={() => setItemModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '11px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div><strong>Obra:</strong> {obrasDisponiveis.find(o => String(o.id) === String(itemModal.obra_id))?.nome_obra || itemModal.obra_id}</div>
              <div><strong>Fornecedor:</strong> {fornecedoresDisponiveis.find(f => String(f.id) === String(itemModal.fornecedor_id))?.nome_fantasia || itemModal.fornecedor_id}</div>
              <div><strong>Boletim Medição:</strong> {itemModal.boletim_medicao || '-'}</div>
              <div><strong>Nº Pedido (Concessionária):</strong> {itemModal.numero_pedido_concessionaria || itemModal.numero_pedido_obra || '-'}</div>
              <div><strong>Nº Pedido (Interno):</strong> {itemModal.numero_pedido_interno || '-'}</div>
              <div><strong>Status:</strong> <span style={{ fontWeight: 'bold', color: itemModal.status === 'Cancelado' ? '#dc2626' : '#2563eb' }}>{itemModal.status}</span></div>
              {itemModal.status === 'Cancelado' && (
                <div style={{ gridColumn: 'span 2', color: '#dc2626' }}><strong>Motivo do Cancelamento:</strong> {itemModal.motivo_cancelamento || '-'}</div>
              )}
              <div><strong>Gestor Responsável:</strong> {gestoresDisponiveis.find(g => String(g.id) === String(itemModal.id_gestor))?.nome || itemModal.id_gestor || '-'}</div>
              <div>
                <strong>Link do E-mail:</strong> {itemModal.url_email ? (
                  <a href={itemModal.url_email} target="_blank" rel="noopener noreferrer" style={{ color: '#0284c7', textDecoration: 'underline', marginLeft: '4px' }}>Abrir E-mail</a>
                ) : '-'}
              </div>
              <div><strong>Nº Nota Fiscal:</strong> {itemModal.numero_nota_fiscal || '-'}</div>
              <div><strong>Data da NF:</strong> {itemModal.data_nota_fiscal ? new Date(itemModal.data_nota_fiscal).toLocaleDateString('pt-BR') : '-'}</div>
              <div><strong>Data de Envio:</strong> {itemModal.data_envio ? new Date(itemModal.data_envio).toLocaleDateString('pt-BR') : '-'}</div>
              <div><strong>Valor NF:</strong> R$ {parseFloat(itemModal.valor_nota_fiscal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>

            <div>
              <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Package style={{ width: '14px', height: '14px', color: '#0284c7' }} />
                Itens Associados ao Pedido
              </h4>

              {itemModal.itens && itemModal.itens.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '1px solid #e2e8f0' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Material</th>
                      <th style={{ padding: '8px' }}>Qtd.</th>
                      <th style={{ padding: '8px' }}>Vlr. Unit.</th>
                      <th style={{ padding: '8px' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemModal.itens.map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px' }}>{it.nome_material || `Material #${it.material_id}`}</td>
                        <td style={{ padding: '8px', fontWeight: 'bold' }}>{it.quantidade}</td>
                        <td style={{ padding: '8px' }}>R$ {parseFloat(it.valor_unitario || 0).toFixed(2)}</td>
                        <td style={{ padding: '8px', fontWeight: 'bold', color: '#16a34a' }}>
                          R$ {(parseFloat(it.quantidade || 0) * parseFloat(it.valor_unitario || 0)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', padding: '12px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                  Nenhum item individual cadastrado para este pedido.
                </div>
              )}
            </div>

            {itemModal.observacao && (
              <div style={{ fontSize: '11px', color: '#475569', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                <strong>Observações:</strong>
                <p style={{ margin: '4px 0 0 0', backgroundColor: '#f8fafc', padding: '8px', borderRadius: '6px' }}>{itemModal.observacao}</p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <button 
                type="button"
                onClick={() => handleDownloadModal(itemModal)} 
                style={{ height: '32px', padding: '0 12px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Download style={{ width: '14px', height: '14px' }} /> Baixar Dados do Modal
              </button>

              <button onClick={() => setItemModal(null)} style={{ height: '32px', padding: '0 16px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}