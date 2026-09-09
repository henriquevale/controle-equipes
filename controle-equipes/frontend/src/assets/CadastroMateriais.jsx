import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, Plus, Search, Edit2, Trash2, Download, CheckSquare, Square } from 'lucide-react';

export default function CadastroMateriais({ API_URL, mostrarMensagem }) {
  const [materiais, setMateriais] = useState([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
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
    codigo: '',
    descricao: '',
    unidade_medida: 'M',  // UNIDADE BASE DE CONSUMO/USO (Ex: Metro)
    tipo: 'HORIZONTAL',    // TIPO / CATEGORIA

    // CONDICIONAL 1: Embalagem de Entrada / Compra vs Estoque
    tem_conversao: false,
    valor_capacidade: 1,
    unidade_embalagem: 'ROLO',

    // CONDICIONAL 2: Rendimento / Capacidade de Aplicação (Placa / Metro)
    tem_rendimento: false,
    quantidade_aplicada: 1,
    unidade_aplicada: 'PLACA',
    consumo_base: 1 // Qtd da unidade_medida gasta por aplicação
  };

  const [form, setForm] = useState(formInicial);

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
      const payload = {
        codigo: form.codigo,
        descricao: form.descricao,
        tipo: form.tipo,
        unidade_medida: form.unidade_medida,
        
        // Dados de Embalagem/Entrada
        unidade_estoque: form.tem_conversao ? form.unidade_embalagem : form.unidade_medida,
        unidade_consumo: form.unidade_medida,
        unidade_orcamento: form.unidade_medida,
        fator_conversao_consumo: form.tem_conversao ? (parseFloat(form.valor_capacidade) || 1) : 1,
        tem_conversao: form.tem_conversao ? 1 : 0,

        // Dados de Rendimento / Capacidade (Placa/Metro)
        tem_rendimento: form.tem_rendimento ? 1 : 0,
        unidade_aplicada: form.tem_rendimento ? form.unidade_aplicada : form.unidade_medida,
        quantidade_aplicada: form.tem_rendimento ? (parseFloat(form.quantidade_aplicada) || 1) : 1,
        consumo_base: form.tem_rendimento ? (parseFloat(form.consumo_base) || 1) : 1
      };

      if (editandoId) {
        await axios.put(`${API_URL}/materiais/${editandoId}`, payload);
        mostrarMensagem('Material atualizado com sucesso!', 'sucesso');
      } else {
        await axios.post(`${API_URL}/materiais`, payload);
        mostrarMensagem('Material cadastrado com sucesso!', 'sucesso');
      }

      setForm(formInicial);
      setEditandoId(null);
      carregarMateriais();
    } catch (e) {
      console.error("Erro ao salvar material:", e);
      mostrarMensagem('Erro ao salvar material.', 'erro');
    }
  };

  const handleEditar = (mat) => {
    setEditandoId(mat.id);
    const possuiConversao = Boolean(mat.tem_conversao || (mat.fator_conversao_consumo && mat.fator_conversao_consumo > 1));
    const possuiRendimento = Boolean(mat.tem_rendimento);

    setForm({
      codigo: mat.codigo || '',
      descricao: mat.descricao || '',
      unidade_medida: mat.unidade_medida || mat.unidade_consumo || 'M',
      tipo: mat.tipo || 'HORIZONTAL',
      
      tem_conversao: possuiConversao,
      valor_capacidade: mat.fator_conversao_consumo || 1,
      unidade_embalagem: mat.unidade_estoque || 'ROLO',

      tem_rendimento: possuiRendimento,
      quantidade_aplicada: mat.quantidade_aplicada || 1,
      unidade_aplicada: mat.unidade_aplicada || 'PLACA',
      consumo_base: mat.consumo_base || 1
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const handleDownloadCSV = () => {
    if (materiaisFiltrados.length === 0) {
      return mostrarMensagem('Nenhum material para exportar.', 'erro');
    }

    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += 'CODIGO;DESCRICAO;TIPO;UNIDADE_RDO;EMBALAGEM_ENTRADA;RENDIMENTO_CAPACIDADE\n';

    materiaisFiltrados.forEach((m) => {
      const temConv = Boolean(m.tem_conversao || (m.fator_conversao_consumo && m.fator_conversao_consumo > 1));
      const temRend = Boolean(m.tem_rendimento);
      const unMedida = m.unidade_medida || m.unidade_consumo || 'M';
      const unEstoque = m.unidade_estoque || unMedida;
      const fator = m.fator_conversao_consumo || 1;

      const embStr = temConv ? `${fator} ${unMedida} / ${unEstoque}` : `1 ${unMedida}`;
      const rendStr = temRend ? `${m.quantidade_aplicada} ${m.unidade_aplicada} = ${m.consumo_base} ${unMedida}` : '-';

      const linha = `"${m.codigo || ''}";"${m.descricao || ''}";"${m.tipo || ''}";"${unMedida}";"${embStr}";"${rendStr}"`;
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', boxSizing: 'border-box' }}>
      
      {/* FORMULÁRIO DE CADASTRO / EDIÇÃO */}
      <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Package style={{ width: '16px', height: '16px', color: '#2563eb' }} />
          {editandoId ? 'Editar Material' : 'Cadastrar Novo Material'}
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* CAMPOS PRINCIPAIS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'end' }}>
            
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

            <div>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>DESCRIÇÃO DO MATERIAL *</label>
              <input 
                type="text" 
                placeholder="Ex: Película Refletiva ABNT III" 
                value={form.descricao} 
                onChange={e => setForm({ ...form, descricao: e.target.value.toUpperCase() })}
                style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>UNIDADE USO / RDO *</label>
              <select 
                value={form.unidade_medida} 
                onChange={e => setForm({ ...form, unidade_medida: e.target.value })}
                style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box', fontWeight: 'bold' }}
              >
                {opcoesUnidades.map(op => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
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

          </div>

          {/* CHECKBOX 1: COMPRA / EMBALAGEM vs USO */}
          <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>
              <input 
                type="checkbox" 
                checked={form.tem_conversao} 
                onChange={e => setForm({ ...form, tem_conversao: e.target.checked })}
                style={{ display: 'none' }}
              />
              {form.tem_conversao ? (
                <CheckSquare style={{ width: '18px', height: '18px', color: '#2563eb' }} />
              ) : (
                <Square style={{ width: '18px', height: '18px', color: '#94a3b8' }} />
              )}
              <span>A embalagem de compra/estoque é diferente da unidade de consumo (Ex: Comprado em ROLO, usado em METRO)?</span>
            </label>

            {form.tem_conversao && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'end', marginTop: '4px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1' }}>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#1e293b', display: 'block', marginBottom: '4px' }}>QUANTIDADE CONVERTIDA</label>
                  <input 
                    type="number" 
                    step="0.0001"
                    placeholder="Ex: 50" 
                    value={form.valor_capacidade} 
                    onChange={e => setForm({ ...form, valor_capacidade: e.target.value })}
                    style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #2563eb', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box', backgroundColor: '#eff6ff', fontWeight: 'bold' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#1e293b', display: 'block', marginBottom: '4px' }}>UNIDADE DE EMBALAGEM / ENTRADA</label>
                  <select 
                    value={form.unidade_embalagem} 
                    onChange={e => setForm({ ...form, unidade_embalagem: e.target.value })}
                    style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #2563eb', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box', backgroundColor: '#eff6ff', fontWeight: 'bold' }}
                  >
                    {opcoesUnidades.map(op => (
                      <option key={`emb-${op.value}`} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ fontSize: '10px', color: '#0369a1', backgroundColor: '#e0f2fe', padding: '6px 10px', borderRadius: '4px', lineHeight: '1.3' }}>
                  <strong>Regra de Entrada:</strong> 1 {form.unidade_embalagem} equivale a <strong>{form.valor_capacidade || 1} {form.unidade_medida}</strong> no estoque.
                </div>
              </div>
            )}
          </div>

          {/* CHECKBOX 2: CAPACIDADE DE USO / RENDIMENTO APLICADO */}
<div style={{ backgroundColor: '#f0fdf4', padding: '10px 12px', borderRadius: '6px', border: '1px solid #bbf7d0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#166534' }}>
    <input 
      type="checkbox" 
      checked={form.tem_rendimento} 
      onChange={e => setForm({ ...form, tem_rendimento: e.target.checked })}
      style={{ display: 'none' }}
    />
    {form.tem_rendimento ? (
      <CheckSquare style={{ width: '18px', height: '18px', color: '#16a34a' }} />
    ) : (
      <Square style={{ width: '18px', height: '18px', color: '#86efac' }} />
    )}
    <span>Este material possui uma capacidade de rendimento por aplicação (Ex: Placa por Metro / Metro por Peça)?</span>
  </label>

  {form.tem_rendimento && (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'end', marginTop: '4px', paddingTop: '8px', borderTop: '1px dashed #86efac' }}>
      
      {/* 1º CAMPO: CONSUMO BASE */}
      <div>
        <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#14532d', display: 'block', marginBottom: '4px' }}>
          CONSUMO BASE ({form.unidade_medida})
        </label>
        <input 
          type="number" 
          step="0.0001"
          placeholder="Ex: 2.5" 
          value={form.consumo_base} 
          onChange={e => setForm({ ...form, consumo_base: e.target.value })}
          style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #16a34a', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box', backgroundColor: '#ffffff', fontWeight: 'bold' }}
        />
      </div>

      {/* 2º CAMPO: UNIDADE APLICADA */}
      <div>
        <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#14532d', display: 'block', marginBottom: '4px' }}>
          UNIDADE APLICADA / ESTRUTURA
        </label>
        <select 
          value={form.unidade_aplicada} 
          onChange={e => setForm({ ...form, unidade_aplicada: e.target.value })}
          style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #16a34a', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box', backgroundColor: '#ffffff', fontWeight: 'bold' }}
        >
          {opcoesUnidades.map(op => (
            <option key={`rend-${op.value}`} value={op.value}>{op.label}</option>
          ))}
        </select>
      </div>

      {/* 3º CAMPO: QTD APLICADA / RENDIMENTO */}
      <div>
        <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#14532d', display: 'block', marginBottom: '4px' }}>
          QTD APLICADA / RENDIMENTO
        </label>
        <input 
          type="number" 
          step="0.0001"
          placeholder="Ex: 1" 
          value={form.quantidade_aplicada} 
          onChange={e => setForm({ ...form, quantidade_aplicada: e.target.value })}
          style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #16a34a', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box', backgroundColor: '#ffffff', fontWeight: 'bold' }}
        />
      </div>

      {/* TEXTO DE AJUDA COM A ORDEM INVERTIDA */}
      <div style={{ fontSize: '10px', color: '#14532d', backgroundColor: '#dcfce7', padding: '6px 10px', borderRadius: '4px', lineHeight: '1.3' }}>
        <strong>Regra de Produção:</strong> Consome-se <strong>{form.consumo_base || 1} {form.unidade_medida}</strong> para produzir/render <strong>{form.quantidade_aplicada || 1} {form.unidade_aplicada}</strong>.
      </div>
    </div>
  )}
</div>

          {/* BOTÕES DE AÇÃO */}
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {editandoId && (
              <button type="button" onClick={() => { setEditandoId(null); setForm(formInicial); }} style={{ height: '32px', padding: '0 16px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>
                Cancelar
              </button>
            )}
            <button type="submit" style={{ height: '32px', padding: '0 24px', backgroundColor: editandoId ? '#0284c7' : '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Plus style={{ width: '14px', height: '14px' }} />
              {editandoId ? 'Atualizar Material' : 'Salvar Material'}
            </button>
          </div>
        </form>
      </div>

      {/* LISTAGEM DE MATERIAIS */}
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Materiais Cadastrados ({materiaisFiltrados.length})</h3>

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

        {/* TABELA COM A COLUNA TIPO DE VOLTA */}
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '4px', width: '100%' }}>
          <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '8px 12px' }}>Código</th>
                <th style={{ padding: '8px 12px' }}>Descrição</th>
                <th style={{ padding: '8px 12px' }}>Tipo / Categoria</th>
                <th style={{ padding: '8px 12px' }}>Unidade RDO</th>
                <th style={{ padding: '8px 12px' }}>Embalagem Entrada</th>
                <th style={{ padding: '8px 12px' }}>Capacidade / Rendimento</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {materiaisFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>Nenhum material encontrado.</td>
                </tr>
              ) : (
                materiaisFiltrados.map((mat) => {
                  const temConv = Boolean(mat.tem_conversao || (mat.fator_conversao_consumo && mat.fator_conversao_consumo > 1));
                  const temRend = Boolean(mat.tem_rendimento);
                  const unMedida = mat.unidade_medida || mat.unidade_consumo || 'M';
                  const unEstoque = mat.unidade_estoque || unMedida;

                  return (
                    <tr key={mat.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 'bold', color: '#2563eb' }}>{mat.codigo || '-'}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{mat.descricao}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                          {mat.tipo || 'HORIZONTAL'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 'bold', color: '#16a34a' }}>{unMedida}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {temConv ? (
                          <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                            {mat.fator_conversao_consumo} {unMedida} / {unEstoque}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>1 {unMedida}</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 'bold', color: '#15803d' }}>
                        {temRend ? `${mat.quantidade_aplicada} ${mat.unidade_aplicada} = ${mat.consumo_base} ${unMedida}` : '-'}
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