import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ListTodo, Plus, Search, Edit2, Trash2, Download } from 'lucide-react';

export default function CadastroAtividades({ API_URL, mostrarMensagem }) {
  const [atividades, setAtividades] = useState([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [editandoId, setEditandoId] = useState(null);

  const opcoesUnidades = [
    { value: 'UN', label: 'UN (Unidade)' },
    { value: 'KG', label: 'KG (Quilograma)' },
    { value: 'M', label: 'M (Metro)' },
    { value: 'M2', label: 'M² (Metro Quadrado)' },
    { value: 'L', label: 'L (Litro)' },
    { value: 'GL', label: 'GL (Galão)' },
    { value: 'BD', label: 'BD (Balde)' },
    { value: 'CX', label: 'CX (Caixa)' },
    { value: 'ROLO', label: 'ROLO (Rolo)' },
    { value: 'SACO', label: 'SACO (Saco)' },
    { value: 'PLACA', label: 'PLACA (Placa)' }
  ];

  const formInicial = {
    categoria: 'HORIZONTAL',
    descricao: '',
    unidade: 'UN'
  };

  const [form, setForm] = useState(formInicial);

  useEffect(() => {
    carregarAtividades();
  }, []);

  const carregarAtividades = async () => {
    try {
      const res = await axios.get(`${API_URL}/cadastro-atividades`);
      setAtividades(res.data || []);
    } catch (e) {
      console.error("Erro ao carregar atividades:", e);
      setAtividades([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.descricao) return mostrarMensagem('Informe a descrição da atividade.', 'erro');

    try {
      const payload = {
        categoria: form.categoria,
        descricao: form.descricao,
        unidade: form.unidade
      };

      if (editandoId) {
        await axios.put(`${API_URL}/cadastro-atividades/${editandoId}`, payload);
        mostrarMensagem('Atividade atualizada com sucesso!', 'sucesso');
      } else {
        await axios.post(`${API_URL}/cadastro-atividades`, payload);
        mostrarMensagem('Atividade cadastrada com sucesso!', 'sucesso');
      }

      setForm(formInicial);
      setEditandoId(null);
      carregarAtividades();
    } catch (e) {
      console.error("Erro ao salvar atividade:", e);
      mostrarMensagem('Erro ao salvar atividade.', 'erro');
    }
  };

  const handleEditar = (atv) => {
    setEditandoId(atv.id);
    setForm({
      categoria: atv.categoria || 'HORIZONTAL',
      descricao: atv.descricao || '',
      unidade: atv.unidade || 'UN'
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExcluir = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta atividade?')) return;
    try {
      await axios.delete(`${API_URL}/cadastro-atividades/${id}`);
      mostrarMensagem('Atividade excluída!', 'sucesso');
      carregarAtividades();
    } catch (e) {
      console.error("Erro ao excluir atividade:", e);
      mostrarMensagem('Erro ao excluir atividade.', 'erro');
    }
  };

  const handleDownloadCSV = () => {
    if (atividadesFiltradas.length === 0) {
      return mostrarMensagem('Nenhuma atividade para exportar.', 'erro');
    }

    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += 'CATEGORIA;DESCRICAO;UNIDADE\n';

    atividadesFiltradas.forEach((a) => {
      const linha = `"${a.categoria || ''}";"${a.descricao || ''}";"${a.unidade || ''}"`;
      csvContent += linha + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RELATORIO_ATIVIDADES_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const atividadesFiltradas = atividades.filter(a => {
    const termo = termoBusca.toLowerCase();
    const atendeBusca = a.descricao?.toLowerCase().includes(termo);
    const catNoBanco = a.categoria || a.tipo;
    const atendeCategoria = filtroCategoria ? catNoBanco === filtroCategoria : true;
    return atendeBusca && atendeCategoria;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', boxSizing: 'border-box' }}>
      
      {/* FORMULÁRIO DE CADASTRO / EDIÇÃO */}
      <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ListTodo style={{ width: '16px', height: '16px', color: '#2563eb' }} />
          {editandoId ? 'Editar Atividade' : 'Cadastrar Nova Atividade'}
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'end' }}>
            
            {/* CATEGORIA (HORIZONTAL OU VERTICAL) */}
            <div>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>CATEGORIA *</label>
              <select 
                value={form.categoria} 
                onChange={e => setForm({ ...form, categoria: e.target.value })}
                style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box', fontWeight: 'bold' }}
              >
                <option value="HORIZONTAL">HORIZONTAL</option>
                <option value="VERTICAL">VERTICAL</option>
              </select>
            </div>

            {/* DESCRIÇÃO DA ATIVIDADE */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>DESCRIÇÃO DA ATIVIDADE *</label>
              <input 
                type="text" 
                placeholder="Ex: PINTURA DE FAIXA DE EIXO CENTRAL" 
                value={form.descricao} 
                onChange={e => setForm({ ...form, descricao: e.target.value.toUpperCase() })}
                style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
              />
            </div>

            {/* UNIDADE */}
            <div>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>UNIDADE *</label>
              <select 
                value={form.unidade} 
                onChange={e => setForm({ ...form, unidade: e.target.value })}
                style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box', fontWeight: 'bold' }}
              >
                {opcoesUnidades.map(op => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
            </div>

          </div>

          {/* BOTÕES DE AÇÃO */}
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '8px' }}>
            {editandoId && (
              <button type="button" onClick={() => { setEditandoId(null); setForm(formInicial); }} style={{ height: '32px', padding: '0 16px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>
                Cancelar
              </button>
            )}
            <button type="submit" style={{ height: '32px', padding: '0 24px', backgroundColor: editandoId ? '#0284c7' : '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Plus style={{ width: '14px', height: '14px' }} />
              {editandoId ? 'Atualizar Atividade' : 'Salvar Atividade'}
            </button>
          </div>
        </form>
      </div>

      {/* LISTAGEM DE ATIVIDADES */}
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Atividades Cadastradas ({atividadesFiltradas.length})</h3>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%', maxWidth: '580px' }}>
            <div style={{ flex: '1 1 200px', position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search style={{ position: 'absolute', left: '8px', width: '14px', height: '14px', color: '#94a3b8' }} />
              <input 
                type="text" 
                placeholder="Pesquisar..." 
                value={termoBusca} 
                onChange={e => setTermoBusca(e.target.value)}
                style={{ width: '100%', height: '30px', paddingLeft: '28px', paddingRight: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
              />
            </div>

            <select 
              value={filtroCategoria} 
              onChange={e => setFiltroCategoria(e.target.value)}
              style={{ height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }}
            >
              <option value="">Todas as Categorias</option>
              <option value="HORIZONTAL">HORIZONTAL</option>
              <option value="VERTICAL">VERTICAL</option>
            </select>

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

        {/* TABELA DE REGISTROS */}
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '4px', width: '100%' }}>
          <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '8px 12px', width: '150px' }}>Categoria</th>
                <th style={{ padding: '8px 12px' }}>Descrição</th>
                <th style={{ padding: '8px 12px', width: '100px' }}>Unidade</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', width: '100px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {atividadesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>Nenhuma atividade encontrada.</td>
                </tr>
              ) : (
                atividadesFiltradas.map((atv) => {
                  const catExibicao = atv.categoria || atv.tipo || 'HORIZONTAL';
                  const unExibicao = atv.unidade || atv.unidade_medida || 'UN';

                  return (
                    <tr key={atv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ 
                          backgroundColor: catExibicao === 'HORIZONTAL' ? '#e0f2fe' : '#fef3c7', 
                          color: catExibicao === 'HORIZONTAL' ? '#0369a1' : '#b45309', 
                          padding: '2px 6px', 
                          borderRadius: '4px', 
                          fontSize: '10px', 
                          fontWeight: 'bold' 
                        }}>
                          {catExibicao}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{atv.descricao}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 'bold', color: '#16a34a' }}>{unExibicao}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <button onClick={() => handleEditar(atv)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', marginRight: '8px' }} title="Editar">
                          <Edit2 style={{ width: '14px', height: '14px' }} />
                        </button>
                        <button onClick={() => handleExcluir(atv.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }} title="Excluir">
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