import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Truck, Plus, Search, Edit2, Trash2, Download, CheckSquare, Square, Filter } from 'lucide-react';

export default function CadastroFornecedores({ API_URL, mostrarMensagem }) {
  const [fornecedores, setFornecedores] = useState([]);
  const [materiaisDisponiveis, setMateriaisDisponiveis] = useState([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroTipoMaterial, setFiltroTipoMaterial] = useState('');
  const [editandoId, setEditandoId] = useState(null);

  const [form, setForm] = useState({
    nome_fantasia: '',
    razao_social: '',
    cnpj: '',
    telefone: '',
    telefone2: '',
    email: '',
    observacao: '',
    ids_materiais: [] // Lista de IDs dos materiais selecionados
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const [resForn, resMat] = await Promise.all([
        axios.get(`${API_URL}/fornecedores`),
        axios.get(`${API_URL}/materiais`)
      ]);
      setFornecedores(resForn.data || []);
      setMateriaisDisponiveis(resMat.data || []);
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    }
  };

  // Extrai os tipos únicos de materiais disponíveis para alimentar o filtro
  const tiposMateriaisUnicos = Array.from(
    new Set(materiaisDisponiveis.map(m => m.tipo || m.categoria).filter(Boolean))
  );

  // MARCAR / DESMARCAR MATERIAL QUE O FORNECEDOR VENDE
  const toggleMaterial = (idMaterial) => {
    setForm(prev => {
      const jaSelecionado = prev.ids_materiais.includes(idMaterial);
      const novaLista = jaSelecionado
        ? prev.ids_materiais.filter(id => id !== idMaterial)
        : [...prev.ids_materiais, idMaterial];
      return { ...prev, ids_materiais: novaLista };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome_fantasia) return mostrarMensagem('Informe o Nome Fantasia do fornecedor.', 'erro');

    try {
      if (editandoId) {
        await axios.put(`${API_URL}/fornecedores/${editandoId}`, form);
        mostrarMensagem('Fornecedor atualizado com sucesso!', 'sucesso');
      } else {
        await axios.post(`${API_URL}/fornecedores`, form);
        mostrarMensagem('Fornecedor cadastrado com sucesso!', 'sucesso');
      }

      limparForm();
      carregarDados();
    } catch (e) {
      console.error("Erro ao salvar fornecedor:", e);
      mostrarMensagem('Erro ao salvar fornecedor.', 'erro');
    }
  };

  const handleEditar = (forn) => {
    setEditandoId(forn.id);
    setForm({
      nome_fantasia: forn.nome_fantasia || '',
      razao_social: forn.razao_social || '',
      cnpj: forn.cnpj || '',
      telefone: forn.telefone || '',
      telefone2: forn.telefone2 || '',
      email: forn.email || '',
      observacao: forn.observacao || '',
      ids_materiais: forn.ids_materiais || []
    });
  };

  const handleExcluir = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este fornecedor?')) return;
    try {
      await axios.delete(`${API_URL}/fornecedores/${id}`);
      mostrarMensagem('Fornecedor excluído!', 'sucesso');
      carregarDados();
    } catch (e) {
      console.error("Erro ao excluir fornecedor:", e);
      mostrarMensagem('Erro ao excluir fornecedor.', 'erro');
    }
  };

  const limparForm = () => {
    setEditandoId(null);
    setFiltroTipoMaterial('');
    setForm({
      nome_fantasia: '',
      razao_social: '',
      cnpj: '',
      telefone: '',
      telefone2: '',
      email: '',
      observacao: '',
      ids_materiais: []
    });
  };

  // EXPORTAR LISTA DE FORNECEDORES PARA CSV
  const handleDownloadCSV = () => {
    if (fornecedoresFiltrados.length === 0) {
      return mostrarMensagem('Nenhum fornecedor para exportar.', 'erro');
    }

    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += 'NOME_FANTASIA;RAZAO_SOCIAL;CNPJ;TELEFONE_1;TELEFONE_2;EMAIL;OBSERVACAO;QTD_MATERIAIS_VENDIDOS\n';

    fornecedoresFiltrados.forEach((f) => {
      const linha = `"${f.nome_fantasia || ''}";"${f.razao_social || ''}";"${f.cnpj || ''}";"${f.telefone || ''}";"${f.telefone2 || ''}";"${f.email || ''}";"${f.observacao || ''}";"${f.ids_materiais?.length || 0}"`;
      csvContent += linha + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RELATORIO_FORNECEDORES_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fornecedoresFiltrados = fornecedores.filter(f => 
    f.nome_fantasia?.toLowerCase().includes(termoBusca.toLowerCase()) ||
    f.cnpj?.includes(termoBusca)
  );

  // Filtragem dinâmica de materiais por categoria/tipo
  const materiaisExibidos = materiaisDisponiveis.filter(mat => {
    if (!filtroTipoMaterial) return true;
    const tipoMat = mat.tipo || mat.categoria;
    return tipoMat === filtroTipoMaterial;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* FORMULÁRIO DE CADASTRO / EDIÇÃO */}
      <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Truck style={{ width: '16px', height: '16px', color: '#2563eb' }} />
          {editandoId ? 'Editar Fornecedor' : 'Cadastrar Novo Fornecedor'}
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* DADOS DO FORNECEDOR */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>NOME FANTASIA *</label>
              <input 
                type="text" 
                placeholder="Ex: TINTAS SILVA" 
                value={form.nome_fantasia} 
                onChange={e => setForm({ ...form, nome_fantasia: e.target.value.toUpperCase() })}
                style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>RAZÃO SOCIAL</label>
              <input 
                type="text" 
                placeholder="Ex: SILVA COMERCIO DE TINTAS LTDA" 
                value={form.razao_social} 
                onChange={e => setForm({ ...form, razao_social: e.target.value.toUpperCase() })}
                style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>CNPJ</label>
              <input 
                type="text" 
                placeholder="00.000.000/0000-00" 
                value={form.cnpj} 
                onChange={e => setForm({ ...form, cnpj: e.target.value })}
                style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>TELEFONE 1</label>
              <input 
                type="text" 
                placeholder="(00) 00000-0000" 
                value={form.telefone} 
                onChange={e => setForm({ ...form, telefone: e.target.value })}
                style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>TELEFONE 2 / WHATSAPP</label>
              <input 
                type="text" 
                placeholder="(00) 00000-0000" 
                value={form.telefone2} 
                onChange={e => setForm({ ...form, telefone2: e.target.value })}
                style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>E-MAIL</label>
              <input 
                type="email" 
                placeholder="vendas@fornecedor.com" 
                value={form.email} 
                onChange={e => setForm({ ...form, email: e.target.value })}
                style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* CAMPO DE OBSERVAÇÃO */}
          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>OBSERVAÇÕES</label>
            <textarea 
              rows="2"
              placeholder="Informações adicionais, faturamento, prazos de entrega..."
              value={form.observacao}
              onChange={e => setForm({ ...form, observacao: e.target.value })}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </div>

          {/* SELEÇÃO DE MATERIAIS COM FILTRO POR TIPO */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>
                SELECIONE OS MATERIAIS QUE ESTE FORNECEDOR VENDE ({form.ids_materiais.length} Selecionados):
              </label>

              {/* FILTRO DE TIPO DE MATERIAL */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Filter style={{ width: '12px', height: '12px', color: '#64748b' }} />
                <select 
                  value={filtroTipoMaterial} 
                  onChange={e => setFiltroTipoMaterial(e.target.value)}
                  style={{ height: '26px', padding: '0 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '10px', backgroundColor: '#fff' }}
                >
                  <option value="">-- Todos os Tipos --</option>
                  {tiposMateriaisUnicos.map((tipo, idx) => (
                    <option key={idx} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '6px', maxHeight: '130px', overflowY: 'auto', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#f8fafc' }}>
              {materiaisExibidos.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '10px', gridColumn: '1 / -1', textAlign: 'center', padding: '8px' }}>Nenhum material encontrado com este filtro.</div>
              ) : (
                materiaisExibidos.map(mat => {
                  const marcado = form.ids_materiais.includes(mat.id);
                  return (
                    <div 
                      key={mat.id} 
                      onClick={() => toggleMaterial(mat.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', borderRadius: '4px', backgroundColor: marcado ? '#e0f2fe' : '#fff', border: marcado ? '1px solid #0284c7' : '1px solid #e2e8f0', cursor: 'pointer', fontSize: '10px', fontWeight: marcado ? 'bold' : 'normal', color: marcado ? '#0369a1' : '#334155' }}
                    >
                      {marcado ? <CheckSquare style={{ width: '12px', height: '12px', color: '#0284c7' }} /> : <Square style={{ width: '12px', height: '12px', color: '#94a3b8' }} />}
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{mat.descricao}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* BOTOES DE AÇÃO */}
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '4px' }}>
            {editandoId && (
              <button type="button" onClick={limparForm} style={{ height: '32px', padding: '0 12px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>
                Cancelar
              </button>
            )}
            <button type="submit" style={{ height: '32px', padding: '0 16px', backgroundColor: editandoId ? '#0284c7' : '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Plus style={{ width: '14px', height: '14px' }} />
              {editandoId ? 'Atualizar Fornecedor' : 'Salvar Fornecedor'}
            </button>
          </div>
        </form>
      </div>

      {/* LISTAGEM DE FORNECEDORES */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Fornecedores Cadastrados ({fornecedoresFiltrados.length})</h3>

          {/* BARRA DE BUSCA E DOWNLOAD */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%', maxWidth: '380px' }}>
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search style={{ position: 'absolute', left: '8px', width: '14px', height: '14px', color: '#94a3b8' }} />
              <input 
                type="text" 
                placeholder="Buscar fornecedor ou CNPJ..." 
                value={termoBusca} 
                onChange={e => setTermoBusca(e.target.value)}
                style={{ width: '100%', height: '30px', paddingLeft: '28px', paddingRight: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
              />
            </div>

            <button 
              type="button" 
              onClick={handleDownloadCSV}
              style={{ height: '30px', padding: '0 10px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Download style={{ width: '14px', height: '14px' }} />
              Baixar
            </button>
          </div>
        </div>

        {/* TABELA DE FORNECEDORES */}
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '8px 12px' }}>Nome Fantasia</th>
                <th style={{ padding: '8px 12px' }}>CNPJ</th>
                <th style={{ padding: '8px 12px' }}>Contatos</th>
                <th style={{ padding: '8px 12px' }}>Observações</th>
                <th style={{ padding: '8px 12px' }}>Materiais Fornecidos</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {fornecedoresFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>Nenhum fornecedor encontrado.</td>
                </tr>
              ) : (
                fornecedoresFiltrados.map((forn) => {
                  const materiaisDoForn = materiaisDisponiveis.filter(m => forn.ids_materiais?.includes(m.id));

                  return (
                    <tr key={forn.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>
                        {forn.nome_fantasia}
                        {forn.razao_social && <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 'normal' }}>{forn.razao_social}</div>}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#475569' }}>{forn.cnpj || '-'}</td>
                      <td style={{ padding: '8px 12px', color: '#475569' }}>
                        <div>Tel 1: {forn.telefone || '-'}</div>
                        {forn.telefone2 && <div>Tel 2: {forn.telefone2}</div>}
                        <div style={{ fontSize: '9px', color: '#64748b' }}>{forn.email || ''}</div>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#64748b', maxWidth: '150px' }}>
                        <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={forn.observacao}>
                          {forn.observacao || '-'}
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '200px' }}>
                          {materiaisDoForn.length > 0 ? (
                            materiaisDoForn.map(m => (
                              <span key={m.id} style={{ backgroundColor: '#f1f5f9', color: '#334155', padding: '1px 5px', borderRadius: '3px', fontSize: '9px', border: '1px solid #cbd5e1' }}>
                                {m.descricao}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '10px' }}>Nenhum material</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <button onClick={() => handleEditar(forn)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', marginRight: '8px' }} title="Editar">
                          <Edit2 style={{ width: '14px', height: '14px' }} />
                        </button>
                        <button onClick={() => handleExcluir(forn.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }} title="Excluir">
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