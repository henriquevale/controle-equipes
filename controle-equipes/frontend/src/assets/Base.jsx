import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Building2, Plus, Edit2, Trash2, Search, MapPin, CheckSquare, Square } from 'lucide-react';

export default function Bases({ API_URL, mostrarMensagem }) {
  const [bases, setBases] = useState([]);
  const [obras, setObras] = useState([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [editandoId, setEditandoId] = useState(null);

  const [form, setForm] = useState({
    nome: '',
    endereco: '',
    obras_ids: []
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const [resBases, resObras] = await Promise.all([
        axios.get(`${API_URL}/bases`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/obras`).catch(() => axios.get(`${API_URL}/master/obras-geral`)).catch(() => ({ data: [] }))
      ]);

      setBases(resBases.data || []);
      setObras(resObras.data || []);
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    }
  };

  const handleToggleObra = (obraId) => {
    setForm(prev => {
      const jaExiste = prev.obras_ids.includes(obraId);
      return {
        ...prev,
        obras_ids: jaExiste
          ? prev.obras_ids.filter(id => id !== obraId)
          : [...prev.obras_ids, obraId]
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return mostrarMensagem('Informe o nome da Base.', 'erro');

    try {
      if (editandoId) {
        await axios.put(`${API_URL}/bases/${editandoId}`, form);
        mostrarMensagem('Base atualizada com sucesso!', 'sucesso');
      } else {
        await axios.post(`${API_URL}/bases`, form);
        mostrarMensagem('Base criada com sucesso!', 'sucesso');
      }

      limparForm();
      carregarDados();
    } catch (e) {
      console.error("Erro ao salvar base:", e);
      mostrarMensagem('Erro ao salvar cadastro da Base.', 'erro');
    }
  };

  const handleEditar = (base) => {
    setEditandoId(base.id);
    setForm({
      nome: base.nome || '',
      endereco: base.endereco || '',
      obras_ids: base.obras_ids || []
    });
  };

  const handleExcluir = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta Base?')) return;
    try {
      await axios.delete(`${API_URL}/bases/${id}`);
      mostrarMensagem('Base excluída com sucesso!', 'sucesso');
      carregarDados();
    } catch (e) {
      console.error("Erro ao excluir base:", e);
      mostrarMensagem('Erro ao excluir registro.', 'erro');
    }
  };

  const limparForm = () => {
    setEditandoId(null);
    setForm({ nome: '', endereco: '', obras_ids: [] });
  };

  const basesFiltradas = bases.filter(b => 
    String(b.nome || '').toLowerCase().includes(termoBusca.toLowerCase()) ||
    String(b.endereco || '').toLowerCase().includes(termoBusca.toLowerCase())
  );

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
      
      {/* FORMULÁRIO DE CADASTRO */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Building2 style={{ width: '18px', height: '18px', color: '#2563eb' }} />
          {editandoId ? 'Editar Base / Depósito' : 'Cadastrar Nova Base / Depósito'}
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Nome da Base / Depósito *</label>
              <input 
                type="text" 
                placeholder="Ex: Base Central Guarulhos" 
                value={form.nome} 
                onChange={e => setForm({ ...form, nome: e.target.value })} 
                style={inputStyle} 
              />
            </div>

            <div>
              <label style={labelStyle}>Endereço Completo</label>
              <input 
                type="text" 
                placeholder="Ex: Av. Industrial, 1500 - Galpão 3" 
                value={form.endereco} 
                onChange={e => setForm({ ...form, endereco: e.target.value })} 
                style={inputStyle} 
              />
            </div>
          </div>

          {/* SELEÇÃO DE OBRAS ASSOCIADAS */}
          <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <label style={{ ...labelStyle, color: '#2563eb', marginBottom: '8px' }}>
              Obras Atendidas / Associadas a esta Base ({form.obras_ids.length} selecionadas)
            </label>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px', maxHeight: '150px', overflowY: 'auto', padding: '4px' }}>
              {obras.length === 0 ? (
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Nenhuma obra encontrada.</div>
              ) : (
                obras.map(obra => {
                  const estaMarcada = form.obras_ids.includes(obra.id);
                  const nomeObraExibir = obra.nome_obra || obra.nome || `Obra #${obra.id}`;

                  return (
                    <div 
                      key={obra.id} 
                      onClick={() => handleToggleObra(obra.id)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: '6px 10px', 
                        backgroundColor: estaMarcada ? '#eff6ff' : '#fff',
                        border: `1px solid ${estaMarcada ? '#93c5fd' : '#cbd5e1'}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        userSelect: 'none'
                      }}
                    >
                      {estaMarcada ? (
                        <CheckSquare style={{ width: '14px', height: '14px', color: '#2563eb' }} />
                      ) : (
                        <Square style={{ width: '14px', height: '14px', color: '#94a3b8' }} />
                      )}
                      <span style={{ fontWeight: estaMarcada ? 'bold' : 'normal', color: estaMarcada ? '#1e40af' : '#334155' }}>
                        {nomeObraExibir}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* BOTÕES */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            {editandoId && (
              <button type="button" onClick={limparForm} style={{ height: '34px', padding: '0 14px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>
                Cancelar
              </button>
            )}
            <button type="submit" style={{ height: '34px', padding: '0 18px', backgroundColor: editandoId ? '#0284c7' : '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus style={{ width: '14px', height: '14px' }} />
              {editandoId ? 'Atualizar Base' : 'Salvar Base'}
            </button>
          </div>
        </form>
      </div>

      {/* TABELA DE BASES */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', color: '#334155', margin: 0 }}>
            Bases Cadastradas ({basesFiltradas.length})
          </h3>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search style={{ position: 'absolute', left: '10px', width: '14px', height: '14px', color: '#94a3b8' }} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou endereço..." 
              value={termoBusca} 
              onChange={e => setTermoBusca(e.target.value)} 
              style={{ width: '220px', height: '32px', paddingLeft: '30px', paddingRight: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px' }} 
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '10px 12px' }}>Nome da Base</th>
                <th style={{ padding: '10px 12px' }}>Endereço</th>
                <th style={{ padding: '10px 12px' }}>Obras Atendidas</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {basesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                    Nenhuma base encontrada.
                  </td>
                </tr>
              ) : (
                basesFiltradas.map((b) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#0f172a' }}>
                      <Building2 style={{ width: '14px', height: '14px', color: '#0284c7', display: 'inline', marginRight: '6px' }} />
                      {b.nome}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>
                      {b.endereco ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin style={{ width: '12px', height: '12px', color: '#64748b' }} /> {b.endereco}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {b.obras_nomes && b.obras_nomes.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {b.obras_nomes.map((nomeObra, idx) => (
                            <span key={idx} style={{ padding: '2px 6px', backgroundColor: '#e0f2fe', color: '#0369a1', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                              {nomeObra}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Nenhuma obra vinculada</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button onClick={() => handleEditar(b)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', marginRight: '8px' }} title="Editar">
                        <Edit2 style={{ width: '14px', height: '14px' }} />
                      </button>
                      <button onClick={() => handleExcluir(b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }} title="Excluir">
                        <Trash2 style={{ width: '14px', height: '14px' }} />
                      </button>
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