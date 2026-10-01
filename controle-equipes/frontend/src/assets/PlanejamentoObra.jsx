import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Calendar, Plus, Search, Edit2, Trash2, 
  Building2, Check, Activity, X, UserCheck, PieChart
} from 'lucide-react';

export default function PlanejamentoObra({ API_URL, mostrarMensagem, obrasDisponiveis: obrasProps, usuarioLogado }) {
  const [planejamentos, setPlanejamentos] = useState([]);
  const [obrasDisponiveis, setObrasDisponiveis] = useState([]);
  const [catalogoAtividades, setCatalogoAtividades] = useState([]);
  const [gestoresDisponiveis, setGestoresDisponiveis] = useState([]);

  // Estados dos Filtros da Tabela Principal
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroObra, setFiltroObra] = useState('');
  const [filtroGestor, setFiltroGestor] = useState('');
  const [filtroStatusPrazo, setFiltroStatusPrazo] = useState('');

  const [editandoId, setEditandoId] = useState(null);

  const isMaster = String(usuarioLogado?.cargo || '').trim().toUpperCase() === 'MASTER';

  const initialForm = {
    obra_id: '',
    frente_trabalho: '',
    data_inicio: new Date().toISOString().slice(0, 10),
    data_fim: '',
    atividades: []
  };

  const [form, setForm] = useState(initialForm);

  // Atividade temporária para inclusão no formulário
  const [tempAtividade, setTempAtividade] = useState({
    atividade: '',
    unidade_medida: 'UN',
    quantidade_planejada: '',
    topicos: [],
    indexEdicaoItem: null
  });

  const [novoTopicoTexto, setNovoTopicoTexto] = useState('');

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const idUsuario = usuarioLogado?.id || usuarioLogado?.id_usuario;
      const cargoUpper = String(usuarioLogado?.cargo || '').trim().toUpperCase();

      const reqObras = (cargoUpper === 'MASTER' || cargoUpper === 'RH')
        ? axios.get(`${API_URL}/master/obras-geral`)
        : axios.get(`${API_URL}/gestor-obras`, {
            params: { usuario_id: idUsuario, cargo: cargoUpper }
          });

      // Alternativa usando masterRoutes e filtrando apenas os gestores
  const reqGestores = isMaster
    ? axios.get(`${API_URL}/master/usuarios`)
        .then(res => ({ data: (res.data || []).filter(u => String(u.cargo).toUpperCase() === 'GESTOR') }))
        .catch(() => ({ data: [] }))
    : Promise.resolve({ data: [] });

      const [resPlan, resObras, resCat, resGestores] = await Promise.all([
        axios.get(`${API_URL}/planejamento`, { params: { usuario_id: idUsuario, cargo: cargoUpper } }).catch(() => ({ data: [] })),
        reqObras.catch(() => ({ data: [] })),
        axios.get(`${API_URL}/cadastro-atividades`).catch(() => ({ data: [] })),
        reqGestores
      ]);

      const listaObrasFinal = (obrasProps && obrasProps.length > 0) ? obrasProps : (resObras.data || []);

      setPlanejamentos(resPlan.data || []);
      setObrasDisponiveis(listaObrasFinal);
      setCatalogoAtividades(resCat.data || []);
      setGestoresDisponiveis(resGestores.data || []);
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    }
  };

  const handleSelecionarDoCatalogo = (nomeAtividade) => {
    const itemEncontrado = catalogoAtividades.find(
      c => c.descricao === nomeAtividade || c.nome === nomeAtividade || c.atividade === nomeAtividade
    );
    
    setTempAtividade(prev => ({
      ...prev,
      atividade: nomeAtividade,
      unidade_medida: itemEncontrado ? (itemEncontrado.unidade || itemEncontrado.unidade_medida || 'UN') : 'UN'
    }));
  };

  const handleAdicionarTopico = () => {
    if (!novoTopicoTexto.trim()) return;
    setTempAtividade(prev => ({
      ...prev,
      topicos: [...prev.topicos, { descricao: novoTopicoTexto.trim(), concluido: false }]
    }));
    setNovoTopicoTexto('');
  };

  const handleRemoverTopicoTemp = (indexTopico) => {
    setTempAtividade(prev => ({
      ...prev,
      topicos: prev.topicos.filter((_, i) => i !== indexTopico)
    }));
  };

  const handleAdicionarOuAtualizarAtividade = () => {
    const ativNome = tempAtividade.atividade.trim();

    if (!ativNome || !tempAtividade.quantidade_planejada) {
      return mostrarMensagem ? mostrarMensagem('Informe a atividade e a quantidade planejada.', 'erro') : alert('Preencha os campos obrigatórios.');
    }

    const itemProcessado = {
      atividade: ativNome,
      unidade_medida: tempAtividade.unidade_medida || 'UN',
      quantidade_planejada: parseFloat(tempAtividade.quantidade_planejada) || 0,
      topicos: tempAtividade.topicos
    };

    let novasAtividades = [...form.atividades];

    if (tempAtividade.indexEdicaoItem !== null) {
      novasAtividades[tempAtividade.indexEdicaoItem] = itemProcessado;
    } else {
      novasAtividades.push(itemProcessado);
    }

    setForm({ ...form, atividades: novasAtividades });
    setTempAtividade({ atividade: '', unidade_medida: 'UN', quantidade_planejada: '', topicos: [], indexEdicaoItem: null });
  };

  const handleIniciarEdicaoAtividade = (index) => {
    const item = form.atividades[index];
    setTempAtividade({
      atividade: item.atividade || '',
      unidade_medida: item.unidade_medida || 'UN',
      quantidade_planejada: item.quantidade_planejada || '',
      topicos: item.topicos || [],
      indexEdicaoItem: index
    });
  };

  const handleRemoverAtividade = (index) => {
    const novas = form.atividades.filter((_, i) => i !== index);
    setForm({ ...form, atividades: novas });
    if (tempAtividade.indexEdicaoItem === index) {
      setTempAtividade({ atividade: '', unidade_medida: 'UN', quantidade_planejada: '', topicos: [], indexEdicaoItem: null });
    }
  };

  const handleToggleTopicoNaTabela = async (planId, topicoIndex, topicoId) => {
    setPlanejamentos(prev => prev.map(p => {
      if (p.id === planId) {
        const novosTopicos = [...(p.topicos || [])];
        if (novosTopicos[topicoIndex]) {
          novosTopicos[topicoIndex] = {
            ...novosTopicos[topicoIndex],
            concluido: !novosTopicos[topicoIndex].concluido
          };
        }
        return { ...p, topicos: novosTopicos };
      }
      return p;
    }));

    if (topicoId) {
      try {
        await axios.patch(`${API_URL}/planejamento/topico/${topicoId}/toggle`);
      } catch (e) {
        console.error("Erro ao alternar status do tópico:", e);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.obra_id) return mostrarMensagem ? mostrarMensagem('Selecione a Obra.', 'erro') : alert('Selecione a Obra.');
    if (form.atividades.length === 0) return mostrarMensagem ? mostrarMensagem('Adicione pelo menos uma atividade.', 'erro') : alert('Adicione pelo menos uma atividade.');

    const payload = {
      obra_id: form.obra_id,
      id_gestor: usuarioLogado?.id || usuarioLogado?.id_usuario,
      frente_trabalho: form.frente_trabalho || 'Geral',
      data_inicio: form.data_inicio,
      data_fim: form.data_fim,
      atividades: form.atividades
    };

    try {
      if (editandoId) {
        await axios.put(`${API_URL}/planejamento/${editandoId}`, payload);
        if (mostrarMensagem) mostrarMensagem('Planejamento atualizado com sucesso!', 'sucesso');
      } else {
        await axios.post(`${API_URL}/planejamento/salvar-lote`, payload);
        if (mostrarMensagem) mostrarMensagem('Planejamento cadastrado com sucesso!', 'sucesso');
      }

      limparForm();
      carregarDados();
    } catch (e) {
      console.error("Erro ao salvar planejamento:", e);
      if (mostrarMensagem) mostrarMensagem('Erro ao salvar planejamento.', 'erro');
    }
  };

  const handleEditar = (plan) => {
    setEditandoId(plan.id);
    setForm({
      obra_id: plan.obra_id || '',
      frente_trabalho: plan.frente_trabalho || '',
      data_inicio: plan.data_inicio ? plan.data_inicio.slice(0, 10) : '',
      data_fim: plan.data_fim ? plan.data_fim.slice(0, 10) : '',
      atividades: Array.isArray(plan.atividades) ? plan.atividades : [{
        atividade: plan.atividade || '',
        unidade_medida: plan.unidade_medida || 'UN',
        quantidade_planejada: plan.quantidade_planejada || 0,
        topicos: plan.topicos || []
      }]
    });
  };

  const handleExcluir = async (plan) => {
    if (!window.confirm(`Deseja excluir o planejamento da atividade "${plan.atividade}"?`)) return;

    try {
      await axios.delete(`${API_URL}/planejamento/${plan.id}`);
      if (mostrarMensagem) mostrarMensagem('Registro excluído com sucesso!', 'sucesso');
      carregarDados();
    } catch (e) {
      console.error("Erro ao excluir registro:", e);
    }
  };

  const limparForm = () => {
    setEditandoId(null);
    setForm(initialForm);
    setTempAtividade({ atividade: '', unidade_medida: 'UN', quantidade_planejada: '', topicos: [], indexEdicaoItem: null });
    setNovoTopicoTexto('');
  };

  const calcularAnaliseDesempenho = (item) => {
    const qtdPlan = parseFloat(item.quantidade_planejada) || 0;
    const qtdExec = parseFloat(item.quantidade_executada) || 0;
    
    const percentualExecutado = qtdPlan > 0 ? Number(((qtdExec / qtdPlan) * 100).toFixed(1)) : 0;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const dtFim = item.data_fim ? new Date(item.data_fim) : null;
    if (dtFim) dtFim.setHours(0, 0, 0, 0);

    let statusPrazo = { texto: 'No Prazo', cor: '#0369a1', bg: '#e0f2fe' };

    if (percentualExecutado >= 100) {
      statusPrazo = { texto: 'Concluído no Prazo', cor: '#15803d', bg: '#dcfce7' };
    } else if (dtFim && hoje > dtFim) {
      statusPrazo = { texto: 'Atrasado (Fora do Prazo)', cor: '#b91c1c', bg: '#fee2e2' };
    }

    return { percentualExecutado, statusPrazo };
  };

  // Filtro Dinâmico da Tabela (Obra, Gestor, Status, Busca)[cite: 6]
  const planejamentosFiltrados = planejamentos.filter(p => {
    const { statusPrazo } = calcularAnaliseDesempenho(p);

    const atendeObra = !filtroObra || String(p.obra_id) === String(filtroObra);
    const atendeGestor = !filtroGestor || String(p.id_gestor) === String(filtroGestor);
    const atendeStatus = !filtroStatusPrazo || statusPrazo.texto === filtroStatusPrazo;

    const atendeBusca = 
      String(p.frente_trabalho || '').toLowerCase().includes(termoBusca.toLowerCase()) ||
      String(p.atividade || '').toLowerCase().includes(termoBusca.toLowerCase());

    return atendeObra && atendeGestor && atendeStatus && atendeBusca;
  });

  // Cálculo da Consolidação Geral das Porcentagens dos itens filtrados
  const resumoMetasGeral = React.useMemo(() => {
    if (planejamentosFiltrados.length === 0) {
      return { totalPlanejado: 0, totalExecutado: 0, percentualPonderado: 0, mediaSimples: 0, concluidos: 0 };
    }

    let totPlan = 0;
    let totExec = 0;
    let somaPercentuais = 0;
    let concluidos = 0;

    planejamentosFiltrados.forEach(p => {
      const qPlan = parseFloat(p.quantidade_planejada) || 0;
      const qExec = parseFloat(p.quantidade_executada) || 0;
      const perc = qPlan > 0 ? (qExec / qPlan) * 100 : 0;

      totPlan += qPlan;
      totExec += qExec;
      somaPercentuais += perc;

      if (perc >= 100) concluidos++;
    });

    const percentualPonderado = totPlan > 0 ? Number(((totExec / totPlan) * 100).toFixed(1)) : 0;
    const mediaSimples = Number((somaPercentuais / planejamentosFiltrados.length).toFixed(1));

    return {
      totalPlanejado: totPlan,
      totalExecutado: totExec,
      percentualPonderado,
      mediaSimples,
      concluidos,
      total: planejamentosFiltrados.length
    };
  }, [planejamentosFiltrados]);

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
          <Activity style={{ width: '18px', height: '18px', color: '#2563eb' }} />
          {editandoId ? 'Editar Planejamento' : 'Novo Planejamento de Atividades'}
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          <div style={sectionCardStyle}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 style={{ width: '14px', height: '14px' }} />
              1. Identificação da Obra e Período
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Obra *</label>
                <select value={form.obra_id} onChange={e => setForm({ ...form, obra_id: e.target.value })} style={inputStyle}>
                  <option value="">-- Selecione a Obra --</option>
                  {obrasDisponiveis.map(o => (
                    <option key={o.id} value={o.id}>{o.nome_obra || o.nome || `Obra #${o.id}`}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Frente de Trabalho / Setor</label>
                <input 
                  type="text" 
                  placeholder="Ex: Trecho 01" 
                  value={form.frente_trabalho} 
                  onChange={e => setForm({ ...form, frente_trabalho: e.target.value })} 
                  style={inputStyle} 
                />
              </div>

              <div>
                <label style={labelStyle}>Data Inicial</label>
                <input type="date" value={form.data_inicio} onChange={e => setForm({ ...form, data_inicio: e.target.value })} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Data Final (Prazo Limite)</label>
                <input type="date" value={form.data_fim} onChange={e => setForm({ ...form, data_fim: e.target.value })} style={inputStyle} />
              </div>
            </div>
          </div>

          <div style={sectionCardStyle}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar style={{ width: '14px', height: '14px' }} />
              2. Cadastro da Atividade e Tópicos / Locais
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', alignItems: 'flex-end' }}>
              <div>
                <label style={labelStyle}>Atividade / Serviço *</label>
                <select 
                  value={tempAtividade.atividade} 
                  onChange={e => handleSelecionarDoCatalogo(e.target.value)} 
                  style={inputStyle}
                >
                  <option value="">-- Selecione a Atividade --</option>
                  {catalogoAtividades.map(cat => {
                    const nome = cat.descricao || cat.nome || cat.atividade;
                    return (
                      <option key={cat.id} value={nome}>
                        {nome}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Unidade</label>
                <input 
                  type="text" 
                  readOnly 
                  value={tempAtividade.unidade_medida} 
                  style={{ ...inputStyle, textAlign: 'center', backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b', fontWeight: 'bold' }} 
                />
              </div>

              <div>
                <label style={labelStyle}>Qtd. Planejada *</label>
                <input 
                  type="number" 
                  step="any"
                  placeholder="Ex: 145" 
                  value={tempAtividade.quantidade_planejada} 
                  onChange={e => setTempAtividade({ ...tempAtividade, quantidade_planejada: e.target.value })} 
                  style={{ ...inputStyle, textAlign: 'right' }} 
                />
              </div>

              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  type="button" 
                  onClick={handleAdicionarOuAtualizarAtividade}
                  style={{ 
                    height: '34px', 
                    padding: '0 12px', 
                    backgroundColor: tempAtividade.indexEdicaoItem !== null ? '#16a34a' : '#0284c7', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '6px', 
                    fontWeight: 'bold', 
                    cursor: 'pointer', 
                    fontSize: '11px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px' 
                  }}
                >
                  {tempAtividade.indexEdicaoItem !== null ? <Check style={{ width: '14px', height: '14px' }} /> : <Plus style={{ width: '14px', height: '14px' }} />}
                  {tempAtividade.indexEdicaoItem !== null ? 'Atualizar Atividade' : 'Add Atividade'}
                </button>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', marginTop: '6px' }}>
              <label style={labelStyle}>Adicionar Tópicos / Locais / Detalhes (Opcional)</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input 
                  type="text" 
                  placeholder="Ex: Tirar no km 100" 
                  value={novoTopicoTexto} 
                  onChange={e => setNovoTopicoTexto(e.target.value)} 
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdicionarTopico(); } }}
                  style={{ ...inputStyle, flex: 1 }} 
                />
                <button 
                  type="button" 
                  onClick={handleAdicionarTopico}
                  style={{ height: '34px', padding: '0 12px', backgroundColor: '#475569', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}
                >
                  + Tópico
                </button>
              </div>

              {tempAtividade.topicos.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {tempAtividade.topicos.map((top, tIdx) => (
                    <span key={tIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#e2e8f0', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', color: '#334155' }}>
                      • {top.descricao}
                      <button type="button" onClick={() => handleRemoverTopicoTemp(tIdx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 0 }}>
                        <X style={{ width: '12px', height: '12px' }} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {form.atividades.length > 0 && (
              <div style={{ marginTop: '12px', overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '10px 12px' }}>Atividade / Serviço</th>
                      <th style={{ padding: '10px 12px' }}>Tópicos Cadastrados</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Unidade</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Qtd. Planejada</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.atividades.map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#0f172a' }}>
                          {it.atividade}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#475569' }}>
                          {it.topicos && it.topicos.length > 0 ? (
                            <ul style={{ margin: 0, paddingLeft: '16px' }}>
                              {it.topicos.map((t, i) => (
                                <li key={i}>{t.descricao}</li>
                              ))}
                            </ul>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>Sem tópicos</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b', fontWeight: 'bold' }}>
                          {it.unidade_medida}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', color: '#0f172a' }}>
                          {parseFloat(it.quantidade_planejada).toLocaleString('pt-BR')}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button 
                            type="button" 
                            onClick={() => handleIniciarEdicaoAtividade(idx)} 
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', marginRight: '8px' }}
                          >
                            <Edit2 style={{ width: '14px', height: '14px' }} />
                          </button>
                          <button 
                            type="button" 
                            onClick={() => handleRemoverAtividade(idx)} 
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}
                          >
                            <Trash2 style={{ width: '14px', height: '14px' }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            {editandoId && (
              <button type="button" onClick={limparForm} style={{ height: '34px', padding: '0 14px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>
                Cancelar Edição
              </button>
            )}
            <button type="submit" style={{ height: '34px', padding: '0 18px', backgroundColor: editandoId ? '#0284c7' : '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus style={{ width: '14px', height: '14px' }} />
              {editandoId ? 'Atualizar Planejamento' : 'Salvar Planejamento'}
            </button>
          </div>
        </form>
      </div>

      {/* PAINEL DE RESUMO GERAL DAS PORCENTAGENS */}
      <div style={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '8px', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <PieChart style={{ width: '14px', height: '14px' }} />
            Progresso Físico Geral (Volume)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '4px', color: resumoMetasGeral.percentualPonderado >= 100 ? '#4ade80' : '#38bdf8' }}>
            {resumoMetasGeral.percentualPonderado}%
          </div>
          <div style={{ backgroundColor: '#334155', height: '6px', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(resumoMetasGeral.percentualPonderado, 100)}%`, backgroundColor: resumoMetasGeral.percentualPonderado >= 100 ? '#4ade80' : '#38bdf8', height: '100%' }} />
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>
            Média de Avanço das Atividades
          </div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', marginTop: '4px', color: '#f8fafc' }}>
            {resumoMetasGeral.mediaSimples}%
          </div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>Média aritmética das %</div>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>
            Metas Concluídas
          </div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', marginTop: '4px', color: '#4ade80' }}>
            {resumoMetasGeral.concluidos} <span style={{ fontSize: '12px', color: '#94a3b8' }}>/ {resumoMetasGeral.total}</span>
          </div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>Itens atingindo 100%</div>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>
            Volume Total Executado / Plan.
          </div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '4px', color: '#f8fafc' }}>
            {resumoMetasGeral.totalExecutado.toLocaleString('pt-BR')} / {resumoMetasGeral.totalPlanejado.toLocaleString('pt-BR')}
          </div>
        </div>
      </div>

      {/* PAINEL DA TABELA DE REGISTROS */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', color: '#334155', margin: 0 }}>
            Planejamentos Registrados ({planejamentosFiltrados.length})
          </h3>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={{ height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px', backgroundColor: '#fff' }}>
              <option value="">-- Todas as Obras --</option>
              {obrasDisponiveis.map(o => (
                <option key={o.id} value={o.id}>{o.nome_obra || o.nome || `Obra #${o.id}`}</option>
              ))}
            </select>

            {/* FILTRO DE GESTOR (Disponível apenas para Usuários MASTER) */}
            {isMaster && (
              <select value={filtroGestor} onChange={e => setFiltroGestor(e.target.value)} style={{ height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px', backgroundColor: '#fff', borderColor: '#2563eb' }}>
                <option value="">-- Todos os Gestores --</option>
                {gestoresDisponiveis.map(g => (
                  <option key={g.id} value={g.id}>{g.nome}</option>
                ))}
              </select>
            )}

            <select 
              value={filtroStatusPrazo} 
              onChange={e => setFiltroStatusPrazo(e.target.value)} 
              style={{ height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px', backgroundColor: '#fff' }}
            >
              <option value="">-- Todos os Prazos --</option>
              <option value="No Prazo">No Prazo</option>
              <option value="Concluído no Prazo">Concluído no Prazo</option>
              <option value="Atrasado (Fora do Prazo)">Atrasado (Fora do Prazo)</option>
</select>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search style={{ position: 'absolute', left: '10px', width: '14px', height: '14px', color: '#94a3b8' }} />
              <input 
                type="text" 
                placeholder="Buscar atividade..." 
                value={termoBusca} 
                onChange={e => setTermoBusca(e.target.value)} 
                style={{ width: '180px', height: '32px', paddingLeft: '30px', paddingRight: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px' }} 
              />
            </div>
          </div>
        </div>

        {/* TABELA PRINCIPAL CALCULADA */}
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '10px 12px' }}>Obra / Frente</th>
                <th style={{ padding: '10px 12px' }}>Atividade / Tópicos (Apoio)</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Prazo Final</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Executado / Planejado</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '150px' }}>Progresso Real (%)</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status Prazo</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {planejamentosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                    Nenhum planejamento encontrado.
                  </td>
                </tr>
              ) : (
                planejamentosFiltrados.map((p) => {
                  const obraObj = obrasDisponiveis.find(o => String(o.id) === String(p.obra_id));
                  const { percentualExecutado, statusPrazo } = calcularAnaliseDesempenho(p);

                  const qtdPlan = parseFloat(p.quantidade_planejada) || 0;
                  const qtdExec = parseFloat(p.quantidade_executada) || 0;
                  const topicosLista = p.topicos || [];

                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 'bold' }}>{obraObj ? (obraObj.nome_obra || obraObj.nome) : `Obra #${p.obra_id}`}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>{p.frente_trabalho || 'Geral'}</div>
                      </td>
                      
                      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}>
                          {p.atividade}
                        </div>

                        {topicosLista.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' }}>
                            {topicosLista.map((top, tIdx) => (
                              <label key={top.id || tIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', color: top.concluido ? '#94a3b8' : '#334155', textDecoration: top.concluido ? 'line-through' : 'none' }}>
                                <input 
                                  type="checkbox" 
                                  checked={!!top.concluido} 
                                  onChange={() => handleToggleTopicoNaTabela(p.id, tIdx, top.id)}
                                  style={{ cursor: 'pointer' }}
                                />
                                {top.descricao}
                              </label>
                            ))}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#475569', verticalAlign: 'top' }}>
                        {p.data_fim ? new Date(p.data_fim).toLocaleDateString('pt-BR') : '-'}
                      </td>

                      <td style={{ padding: '10px 12px', textAlign: 'right', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 'bold', color: '#0f172a' }}>
                          {qtdExec.toLocaleString('pt-BR')} / {qtdPlan.toLocaleString('pt-BR')}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>{p.unidade_medida}</div>
                      </td>

                      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: percentualExecutado >= 100 ? '#16a34a' : '#2563eb' }}>
                            {percentualExecutado}%
                          </span>
                          <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${Math.min(percentualExecutado, 100)}%`, 
                              backgroundColor: percentualExecutado >= 100 ? '#16a34a' : '#2563eb', 
                              height: '100%' 
                            }} />
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px', textAlign: 'center', verticalAlign: 'top' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          backgroundColor: statusPrazo.bg,
                          color: statusPrazo.cor
                        }}>
                          {statusPrazo.texto}
                        </span>
                      </td>

                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                        <button onClick={() => handleEditar(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', marginRight: '8px' }} title="Editar">
                          <Edit2 style={{ width: '14px', height: '14px' }} />
                        </button>
                        <button onClick={() => handleExcluir(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }} title="Excluir">
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