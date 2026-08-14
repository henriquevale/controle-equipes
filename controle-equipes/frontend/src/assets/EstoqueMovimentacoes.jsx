import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowRightLeft, CheckCircle2, Plus, Search, User, Truck, Building2, HardHat } from 'lucide-react';

export default function EstoqueMovimentacoes({ API_URL, mostrarMensagem, usuarioLogado }) {
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [bases, setBases] = useState([]);
  const [obras, setObras] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [termoBusca, setTermoBusca] = useState('');

  const [form, setForm] = useState({
    tipo_movimentacao: 'TRANSFERENCIA_SAIDA',
    origem_tipo: 'BASE',
    origem_id: '',
    destino_tipo: 'OBRA',
    destino_id: '',
    material_id: '',
    quantidade: '',
    observacao: ''
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const [resMovs, resMats, resBases, resObras, resForn] = await Promise.all([
        axios.get(`${API_URL}/master/movimentacoes`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/materiais`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/bases`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/obras`).catch(() => axios.get(`${API_URL}/master/obras-geral`)).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/fornecedores`).catch(() => ({ data: [] }))
      ]);

      setMovimentacoes(resMovs.data || []);
      setMateriais(resMats.data || []);
      setBases(resBases.data || []);
      setObras(resObras.data || []);
      setFornecedores(resForn.data || []);
    } catch (e) {
      console.error("Erro ao carregar dados do estoque:", e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.material_id || !form.quantidade || !form.destino_id) {
      return mostrarMensagem('Preencha os campos obrigatórios (Material, Quantidade e Destino).', 'erro');
    }

    const payload = {
      ...form,
      id_usuario: usuarioLogado?.id || usuarioLogado?.id_usuario || 1
    };

    try {
      await axios.post(`${API_URL}/master/movimentacoes`, payload);
      mostrarMensagem('Movimentação registrada com sucesso!', 'sucesso');
      setForm({
        tipo_movimentacao: 'TRANSFERENCIA_SAIDA',
        origem_tipo: 'BASE',
        origem_id: '',
        destino_tipo: 'OBRA',
        destino_id: '',
        material_id: '',
        quantidade: '',
        observacao: ''
      });
      carregarDados();
    } catch (e) {
      console.error("Erro ao criar movimentação:", e);
      mostrarMensagem('Erro ao registrar movimentação.', 'erro');
    }
  };

  // Identificador visual de Quem Enviou (Origem) e Quem Recebe (Destino)
  const getNomeEntidade = (tipo, id) => {
    if (!id && tipo !== 'FORNECEDOR') return '-';

    if (tipo === 'FORNECEDOR') {
      const f = fornecedores.find(x => Number(x.id) === Number(id));
      return f ? `🚚 Fornecedor: ${f.nome_fantasia || f.razao_social}` : `🚚 Fornecedor Direto`;
    }
    if (tipo === 'BASE') {
      const b = bases.find(x => Number(x.id) === Number(id));
      return b ? `🏢 Base: ${b.nome}` : `🏢 Base #${id}`;
    }
    if (tipo === 'OBRA') {
      const o = obras.find(x => Number(x.id) === Number(id));
      return o ? `🏗️ Obra: ${o.nome_obra || o.nome}` : `🏗️ Obra #${id}`;
    }
    return '-';
  };

  const movsFiltradas = movimentacoes.filter(m => {
    const matNome = String(m.material_nome || '').toLowerCase();
    const busca = termoBusca.toLowerCase();
    return matNome.includes(busca) || String(m.id).includes(busca);
  });

  const inputStyle = {
    width: '100%',
    height: '34px',
    padding: '0 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '11px',
    boxSizing: 'border-box',
    backgroundColor: '#fff'
  };

  const labelStyle = {
    fontSize: '10px',
    fontWeight: '700',
    color: '#475569',
    display: 'block',
    marginBottom: '4px',
    textTransform: 'uppercase'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* FORMULÁRIO DE LANÇAMENTO */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowRightLeft style={{ width: '18px', height: '18px', color: '#2563eb' }} />
          Lançamento de Movimentação de Estoque
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Material *</label>
              <select value={form.material_id} onChange={e => setForm({ ...form, material_id: e.target.value })} style={inputStyle}>
                <option value="">Selecione o Material...</option>
                {materiais.map(m => (
                  <option key={m.id} value={m.id}>{m.descricao} ({m.unidade_medida})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Quantidade *</label>
              <input type="number" step="0.01" placeholder="Ex: 50" value={form.quantidade} onChange={e => setForm({ ...form, quantidade: e.target.value })} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Tipo de Movimentação</label>
              <select value={form.tipo_movimentacao} onChange={e => setForm({ ...form, tipo_movimentacao: e.target.value })} style={inputStyle}>
                <option value="TRANSFERENCIA_SAIDA">Transferência (Saída)</option>
                <option value="TRANSFERENCIA_ENTRADA">Transferência (Entrada)</option>
                <option value="ENTRADA_FORNECEDOR">Entrada via Fornecedor</option>
                <option value="CONSUMO_RDO">Consumo via RDO</option>
                <option value="AJUSTE">Ajuste de Estoque</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            {/* ORIGEM (QUEM ENVIA / PEDE) */}
            <div>
              <label style={labelStyle}>Origem - Tipo (Quem Envia)</label>
              <select value={form.origem_tipo} onChange={e => setForm({ ...form, origem_tipo: e.target.value, origem_id: '' })} style={inputStyle}>
                <option value="BASE">Base / Depósito</option>
                <option value="OBRA">Obra / Gestor</option>
                <option value="FORNECEDOR">Fornecedor</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Origem - Local/Empresa</label>
              <select value={form.origem_id} onChange={e => setForm({ ...form, origem_id: e.target.value })} style={inputStyle}>
                <option value="">Selecione a Origem...</option>
                {form.origem_tipo === 'BASE' && bases.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
                {form.origem_tipo === 'OBRA' && obras.map(o => <option key={o.id} value={o.id}>{o.nome_obra || o.nome}</option>)}
                {form.origem_tipo === 'FORNECEDOR' && fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}</option>)}
              </select>
            </div>

            {/* DESTINO (QUEM RECEBE) */}
            <div>
              <label style={labelStyle}>Destino - Tipo (Quem Recebe) *</label>
              <select value={form.destino_tipo} onChange={e => setForm({ ...form, destino_tipo: e.target.value, destino_id: '' })} style={inputStyle}>
                <option value="OBRA">Obra / Gestor</option>
                <option value="BASE">Base / Depósito</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Destino - Local *</label>
              <select value={form.destino_id} onChange={e => setForm({ ...form, destino_id: e.target.value })} style={inputStyle}>
                <option value="">Selecione o Destino...</option>
                {form.destino_tipo === 'BASE' && bases.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
                {form.destino_tipo === 'OBRA' && obras.map(o => <option key={o.id} value={o.id}>{o.nome_obra || o.nome}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Observação / Informações Adicionais</label>
            <input type="text" placeholder="Ex: Material solicitado pelo Gestor X para a Obra Y" value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} style={inputStyle} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: '#64748b' }}>
              Registrado por: <strong>{usuarioLogado?.nome || 'Usuário do Sistema'}</strong>
            </span>

            <button type="submit" style={{ height: '34px', padding: '0 18px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus style={{ width: '14px', height: '14px' }} />
              Registrar Movimentação
            </button>
          </div>
        </form>
      </div>

      {/* TABELA DE MOVIMENTAÇÕES */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', color: '#334155', margin: 0 }}>
            Histórico de Movimentações ({movsFiltradas.length})
          </h3>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search style={{ position: 'absolute', left: '10px', width: '14px', height: '14px', color: '#94a3b8' }} />
            <input type="text" placeholder="Buscar por material ou ID..." value={termoBusca} onChange={e => setTermoBusca(e.target.value)} style={{ width: '220px', height: '32px', paddingLeft: '30px', paddingRight: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px' }} />
          </div>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '10px 12px' }}>ID / Material</th>
                <th style={{ padding: '10px 12px' }}>Qtd</th>
                <th style={{ padding: '10px 12px' }}>Tipo</th>
                <th style={{ padding: '10px 12px' }}>Origem (Quem Enviou)</th>
                <th style={{ padding: '10px 12px' }}>Destino (Quem Recebe)</th>
                <th style={{ padding: '10px 12px' }}>Registrado Por</th>
                <th style={{ padding: '10px 12px' }}>Data</th>
              </tr>
            </thead>
            <tbody>
              {movsFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                    Nenhuma movimentação cadastrada.
                  </td>
                </tr>
              ) : (
                movsFiltradas.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#0f172a' }}>
                      #{m.id} - {m.material_nome}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#2563eb' }}>
                      {m.quantidade} {m.unidade_medida}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '3px 8px', backgroundColor: '#e0f2fe', color: '#0369a1', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}>
                        {m.tipo_movimentacao}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>
                      {getNomeEntidade(m.origem_tipo, m.origem_id)}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#0f172a', fontWeight: 'bold' }}>
                      {getNomeEntidade(m.destino_tipo, m.destino_id)}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>
                      {m.usuario_nome || `Usuário #${m.id_usuario}`}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>
                      {m.data_movimentacao ? new Date(m.data_movimentacao).toLocaleDateString('pt-BR') : '-'}
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