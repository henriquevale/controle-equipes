import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, Plus, Search, Edit2, Trash2, Download } from 'lucide-react';

export default function CadastroMateriais({ API_URL, mostrarMensagem }) {
  const [materiais, setMateriais] = useState([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [editandoId, setEditandoId] = useState(null);

  const [form, setForm] = useState({
    codigo: '',
    descricao: '',
    unidade_medida: 'UN',
    tipo: 'HORIZONTAL'
  });

  useEffect(() => {
    carregarMateriais();
  }, []);

  const carregarMateriais = async () => {
    try {
      const res = await axios.get(`${API_URL}/materiais`);
      setMateriais(res.data || []);
    } catch (e) {
      console.error("Erro ao carregar materiais:", e);
      setMateriais([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.descricao) return mostrarMensagem('Informe a descrição do material.', 'erro');

    try {
      if (editandoId) {
        await axios.put(`${API_URL}/materiais/${editandoId}`, form);
        mostrarMensagem('Material atualizado com sucesso!', 'sucesso');
      } else {
        await axios.post(`${API_URL}/materiais`, form);
        mostrarMensagem('Material cadastrado com sucesso!', 'sucesso');
      }

      setForm({ codigo: '', descricao: '', unidade_medida: 'UN', tipo: 'HORIZONTAL' });
      setEditandoId(null);
      carregarMateriais();
    } catch (e) {
      console.error("Erro ao salvar material:", e);
      mostrarMensagem('Erro ao salvar material.', 'erro');
    }
  };

  const handleEditar = (mat) => {
    setEditandoId(mat.id);
    setForm({
      codigo: mat.codigo || '',
      descricao: mat.descricao || '',
      unidade_medida: mat.unidade_medida || 'UN',
      tipo: mat.tipo || 'HORIZONTAL'
    });
  };

  const handleExcluir = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este material?')) return;
    try {
      await axios.delete(`${API_URL}/materiais/${id}`);
      mostrarMensagem('Material excluído!', 'sucesso');
      carregarMateriais();
    } catch (e) {
      console.error("Erro ao excluir material:", e);
      mostrarMensagem('Erro ao excluir material.', 'erro');
    }
  };

  // FUNÇÃO DE DOWNLOAD DA LISTA (CSV)
  const handleDownloadCSV = () => {
    if (materiaisFiltrados.length === 0) {
      return mostrarMensagem('Nenhum material para exportar.', 'erro');
    }

    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += 'CODIGO;DESCRICAO;UNIDADE_MEDIDA;TIPO\n';

    materiaisFiltrados.forEach((m) => {
      const linha = `"${m.codigo || ''}";"${m.descricao || ''}";"${m.unidade_medida || ''}";"${m.tipo || ''}"`;
      csvContent += linha + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RELATORIO_MATERIAIS_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const materiaisFiltrados = materiais.filter(m => {
    const termo = termoBusca.toLowerCase();
    const atendeBusca = m.descricao?.toLowerCase().includes(termo) || m.codigo?.toLowerCase().includes(termo);
    const atendeTipo = filtroTipo ? m.tipo === filtroTipo : true;
    return atendeBusca && atendeTipo;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* FORMULÁRIO DE CADASTRO / EDIÇÃO */}
      <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Package style={{ width: '16px', height: '16px', color: '#2563eb' }} />
          {editandoId ? 'Editar Material' : 'Cadastrar Novo Material'}
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', alignItems: 'end' }}>
          
          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>CÓDIGO</label>
            <input 
              type="text" 
              placeholder="Ex: MAT-001" 
              value={form.codigo} 
              onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
              style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>DESCRIÇÃO DO MATERIAL</label>
            <input 
              type="text" 
              placeholder="Ex: Tinta Monocomponente Amarela" 
              value={form.descricao} 
              onChange={e => setForm({ ...form, descricao: e.target.value.toUpperCase() })}
              style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>UNIDADE DE MEDIDA</label>
            <select 
              value={form.unidade_medida} 
              onChange={e => setForm({ ...form, unidade_medida: e.target.value })}
              style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
            >
              <option value="UN">UN (Unidade)</option>
              <option value="KG">KG (Quilograma)</option>
              <option value="M">M (Metro)</option>
              <option value="M2">M² (Metro Quadrado)</option>
              <option value="L">L (Litro)</option>
              <option value="GL">GL (Galão)</option>
              <option value="BD">BD (Balde)</option>
              <option value="CX">CX (Caixa)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>TIPO / CATEGORIA</label>
            <select 
              value={form.tipo} 
              onChange={e => setForm({ ...form, tipo: e.target.value })}
              style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
            >
              <option value="HORIZONTAL">HORIZONTAL</option>
              <option value="VERTICAL">VERTICAL</option>
              <option value="DISPOSITIVOS">DISPOSITIVOS DE SEGURANÇA</option>
              <option value="INSUMOS">INSUMOS / DIVERSOS</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="submit" style={{ height: '32px', flex: 1, backgroundColor: editandoId ? '#0284c7' : '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <Plus style={{ width: '14px', height: '14px' }} />
              {editandoId ? 'Atualizar' : 'Salvar'}
            </button>
            {editandoId && (
              <button type="button" onClick={() => { setEditandoId(null); setForm({ codigo: '', descricao: '', unidade_medida: 'UN', tipo: 'HORIZONTAL' }); }} style={{ height: '32px', padding: '0 10px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* LISTAGEM DE MATERIAIS COM FILTROS */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Materiais Cadastrados ({materiaisFiltrados.length})</h3>

          {/* BARRA DE FILTROS E BOTÃO DE DOWNLOAD */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%', maxWidth: '580px' }}>
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search style={{ position: 'absolute', left: '8px', width: '14px', height: '14px', color: '#94a3b8' }} />
              <input 
                type="text" 
                placeholder="Pesquisar por código ou descrição..." 
                value={termoBusca} 
                onChange={e => setTermoBusca(e.target.value)}
                style={{ width: '100%', height: '30px', paddingLeft: '28px', paddingRight: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
              />
            </div>

            <select 
              value={filtroTipo} 
              onChange={e => setFiltroTipo(e.target.value)}
              style={{ height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }}
            >
              <option value="">Todos os Tipos</option>
              <option value="HORIZONTAL">HORIZONTAL</option>
              <option value="VERTICAL">VERTICAL</option>
              <option value="DISPOSITIVOS">DISPOSITIVOS</option>
              <option value="INSUMOS">INSUMOS</option>
            </select>

            {/* BOTÃO DE DOWNLOAD */}
            <button 
              type="button" 
              onClick={handleDownloadCSV}
              style={{ height: '30px', padding: '0 10px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Baixar lista em CSV"
            >
              <Download style={{ width: '14px', height: '14px' }} />
              Baixar
            </button>
          </div>
        </div>

        {/* TABELA DE RESULTADOS */}
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '8px 12px' }}>Código</th>
                <th style={{ padding: '8px 12px' }}>Descrição</th>
                <th style={{ padding: '8px 12px' }}>Unidade</th>
                <th style={{ padding: '8px 12px' }}>Tipo</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {materiaisFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>Nenhum material encontrado.</td>
                </tr>
              ) : (
                materiaisFiltrados.map((mat) => (
                  <tr key={mat.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 'bold', color: '#2563eb' }}>{mat.codigo || '-'}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{mat.descricao}</td>
                    <td style={{ padding: '8px 12px' }}>{mat.unidade_medida}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                        {mat.tipo || 'HORIZONTAL'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <button onClick={() => handleEditar(mat)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', marginRight: '8px' }} title="Editar">
                        <Edit2 style={{ width: '14px', height: '14px' }} />
                      </button>
                      <button onClick={() => handleExcluir(mat.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }} title="Excluir">
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