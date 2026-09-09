import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, Search, RefreshCw, Eye, X, ArrowUpRight, ArrowDownLeft, Building2, HardHat, CheckSquare } from 'lucide-react';

export default function EstoqueSaldos({ API_URL, mostrarMensagem }) {
  const [saldos, setSaldos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');
  
  // Armazena um Array de categorias selecionadas
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState([]);
  const [mostrarDropdownCategorias, setMostrarDropdownCategorias] = useState(false);

  // Estados dos filtros de Base, Obra e Fornecedores
  const [bases, setBases] = useState([]);
  const [obras, setObras] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [baseObras, setBaseObras] = useState([]);
  const [baseSelecionada, setBaseSelecionada] = useState('');
  const [obraSelecionada, setObraSelecionada] = useState('');
  const [obrasFiltradas, setObrasFiltradas] = useState([]);

  // Estados do Modal de Extrato
  const [materialSelecionado, setMaterialSelecionado] = useState(null);
  const [historicoMaterial, setHistoricoMaterial] = useState([]);
  const [carregandoModal, setCarregandoModal] = useState(false);

  useEffect(() => {
    carregarLocais();
  }, []);

  // Recarrega o estoque sempre que alterar a Base ou a Obra
  useEffect(() => {
    carregarEstoque();
  }, [baseSelecionada, obraSelecionada]);

  // Carrega Bases, Obras, Fornecedores e o vínculo (base_obras)
  const carregarLocais = async () => {
    try {
      const [resLocais, resForn] = await Promise.all([
        axios.get(`${API_URL}/master/locais`).catch(() => ({ data: {} })),
        axios.get(`${API_URL}/fornecedores`).catch(() => ({ data: [] }))
      ]);

      const basesDados = resLocais.data.bases || [];
      const obrasDados = resLocais.data.obras || [];
      const vinculosDados = resLocais.data.baseObras || [];

      setBases(basesDados);
      setObras(obrasDados);
      setBaseObras(vinculosDados);
      setObrasFiltradas(obrasDados);
      setFornecedores(resForn.data || []);
    } catch (e) {
      console.error("Erro ao carregar locais:", e);
    }
  };

  const getNomeEntidade = (tipo, id) => {
    if (!id && tipo !== 'FORNECEDOR') return '-';
    
    const tipoUpper = String(tipo || '').toUpperCase();
    const idNum = Number(id);

    if (tipoUpper === 'FORNECEDOR') {
      const f = fornecedores.find(x => Number(x.id) === idNum);
      return f ? `${f.nome_fantasia || f.razao_social}` : `Fornecedor #${id}`;
    }
    if (tipoUpper === 'BASE') {
      const b = bases.find(x => Number(x.id) === idNum);
      return b ? `Base: ${b.nome}` : `Base #${id}`;
    }
    if (tipoUpper === 'OBRA') {
      const o = obras.find(x => Number(x.id) === idNum);
      return o ? `Obra: ${o.nome_obra || o.nome}` : `Obra #${id}`;
    }
    return '-';
  };

  const handleBaseChange = (e) => {
    const baseId = e.target.value;
    setBaseSelecionada(baseId);
    setObraSelecionada('');

    if (!baseId) {
      setObrasFiltradas(obras);
      return;
    }

    const idsObrasDaBase = baseObras
      .filter(bo => String(bo.base_id) === String(baseId))
      .map(bo => Number(bo.obra_id));

    const obrasDaBase = obras.filter(o => idsObrasDaBase.includes(Number(o.id)));
    setObrasFiltradas(obrasDaBase);
  };

  const carregarEstoque = async () => {
    setCarregando(true);
    try {
      const params = {};
      if (obraSelecionada) {
        params.tipo_local = 'OBRA';
        params.id_local = obraSelecionada;
      } else if (baseSelecionada) {
        params.tipo_local = 'BASE';
        params.id_local = baseSelecionada;
      }

      const res = await axios.get(`${API_URL}/master/estoque/saldos`, { params });
      setSaldos(res.data || []);
    } catch (e) {
      console.error("Erro ao carregar estoque:", e);
      if (mostrarMensagem) mostrarMensagem('Erro ao atualizar saldos de estoque.', 'erro');
    } finally {
      setCarregando(false);
    }
  };

  // Lógica de alternar checkboxes de categorias
  const toggleCategoria = (categoria) => {
    setCategoriasSelecionadas(prev => 
      prev.includes(categoria) 
        ? prev.filter(c => c !== categoria)
        : [...prev, categoria]
    );
  };

  const abrirModalExtrato = async (material) => {
    setMaterialSelecionado(material);
    setCarregandoModal(true);
    try {
      const params = { material_id: material.material_id };
      
      if (obraSelecionada) {
        params.tipo_local = 'OBRA';
        params.id_local = obraSelecionada;
      } else if (baseSelecionada) {
        params.tipo_local = 'BASE';
        params.id_local = baseSelecionada;
      }

      const res = await axios.get(`${API_URL}/master/movimentacoes`, { params });
      let movs = res.data || [];

      movs = movs.filter(m => Number(m.material_id) === Number(material.material_id));

      setHistoricoMaterial(movs);
    } catch (e) {
      console.error("Erro ao buscar histórico do material:", e);
    } finally {
      setCarregandoModal(false);
    }
  };

  const fecharModal = () => {
    setMaterialSelecionado(null);
    setHistoricoMaterial([]);
  };

  const tiposDisponiveis = Array.from(
    new Set(saldos.map(s => s.tipo || s.material_tipo).filter(Boolean))
  );

  const saldosFiltrados = saldos.filter(item => {
    const nome = String(item.nome || item.material_nome || item.descricao || '').toLowerCase();
    const busca = termoBusca.toLowerCase();
    const categoria = String(item.tipo || item.material_tipo || '');
    const saldo = Number(item.saldo_atual || item.saldo_total || 0);

    if (saldo === 0) return false;
    if (busca && !nome.includes(busca)) return false;

    if (categoriasSelecionadas.length > 0) {
      const matchesCategory = categoriasSelecionadas.some(
        cat => cat.toUpperCase() === categoria.toUpperCase()
      );
      if (!matchesCategory) return false;
    }

    return true;
  });

  const saldoExtratoConcluido = historicoMaterial
    .filter(m => String(m.status).toUpperCase() === 'CONCLUIDO')
    .reduce((acc, m) => {
      const qtd = Number(m.quantidade || 0);
      const ehEntrada = ['ENTRADA_FORNECEDOR', 'TRANSFERENCIA_ENTRADA', 'AJUSTE'].includes(m.tipo_movimentacao);
      return ehEntrada ? acc + qtd : acc - qtd;
    }, 0);

  const inputStyle = {
    height: '36px', padding: '0 8px', border: '1px solid #cbd5e1',
    borderRadius: '6px', fontSize: '11px', backgroundColor: '#fff', width: '100%'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      
      {/* FILTROS E AÇÕES */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Package style={{ width: '16px', height: '16px', color: '#2563eb' }} />
            Posição de Estoque dos Materiais
          </h3>

          <button 
            onClick={carregarEstoque}
            style={{ height: '32px', padding: '0 12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw style={{ width: '12px', height: '12px' }} />
            Atualizar
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
          
          {/* FILTRO 1: BASE */}
          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Building2 style={{ width: '12px', height: '12px' }} /> BASE
            </label>
            <select value={baseSelecionada} onChange={handleBaseChange} style={inputStyle}>
              <option value="">Todas as Bases</option>
              {bases.map(b => (
                <option key={`base-${b.id}`} value={b.id}>{b.nome}</option>
              ))}
            </select>
          </div>

          {/* FILTRO 2: OBRA */}
          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: baseSelecionada ? '#64748b' : '#cbd5e1', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <HardHat style={{ width: '12px', height: '12px' }} /> OBRA
            </label>
            <select 
              value={obraSelecionada} 
              onChange={e => setObraSelecionada(e.target.value)} 
              disabled={!baseSelecionada}
              style={{
                ...inputStyle,
                backgroundColor: baseSelecionada ? '#fff' : '#f8fafc',
                cursor: baseSelecionada ? 'pointer' : 'not-allowed'
              }}
            >
              <option value="">
                {!baseSelecionada 
                  ? 'Selecione uma base primeiro' 
                  : obrasFiltradas.length === 0 
                    ? 'Nenhuma obra nesta base' 
                    : 'Todas as Obras da Base'}
              </option>
              {obrasFiltradas.map(o => (
                <option key={`obra-${o.id}`} value={o.id}>
                  {o.codigo_obra ? `[${o.codigo_obra}] ` : ''}{o.nome_obra || o.nome}
                </option>
              ))}
            </select>
          </div>

          {/* FILTRO 3: BUSCAR MATERIAL */}
          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>BUSCAR MATERIAL</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search style={{ position: 'absolute', left: '8px', width: '12px', height: '12px', color: '#94a3b8' }} />
              <input 
                type="text" 
                placeholder="Nome do material..." 
                value={termoBusca} 
                onChange={e => setTermoBusca(e.target.value)} 
                style={{ ...inputStyle, paddingLeft: '26px' }} 
              />
            </div>
          </div>

          {/* FILTRO 4: CATEGORIAS */}
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckSquare style={{ width: '12px', height: '12px' }} /> CATEGORIAS
            </label>
            <button
              type="button"
              onClick={() => setMostrarDropdownCategorias(!mostrarDropdownCategorias)}
              style={{
                ...inputStyle,
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center',
                overflow: 'hidden',
                whiteSpace: 'nowrap'
              }}
            >
              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {categoriasSelecionadas.length === 0
                  ? 'Todas as categorias'
                  : `${categoriasSelecionadas.length} selecionada(s)`}
              </span>
              <span style={{ fontSize: '9px', color: '#64748b' }}>▼</span>
            </button>

            {mostrarDropdownCategorias && (
              <div 
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: '#fff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  zIndex: 50,
                  maxHeight: '160px',
                  overflowY: 'auto',
                  padding: '6px',
                  marginTop: '4px'
                }}
              >
                {tiposDisponiveis.length === 0 ? (
                  <div style={{ fontSize: '11px', color: '#94a3b8', padding: '4px' }}>Nenhuma categoria</div>
                ) : (
                  tiposDisponiveis.map(t => (
                    <label 
                      key={`cat-cb-${t}`} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        fontSize: '11px', 
                        padding: '4px 6px', 
                        cursor: 'pointer',
                        borderRadius: '4px',
                        userSelect: 'none'
                      }}
                    >
                      <input 
                        type="checkbox" 
                        checked={categoriasSelecionadas.includes(t)} 
                        onChange={() => toggleCategoria(t)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>{t}</span>
                    </label>
                  ))
                )}
                {categoriasSelecionadas.length > 0 && (
                  <button
                    onClick={() => setCategoriasSelecionadas([])}
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      padding: '4px',
                      fontSize: '10px',
                      border: 'none',
                      backgroundColor: '#f1f5f9',
                      color: '#dc2626',
                      fontWeight: 'bold',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Limpar Seleções
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* TABELA DE POSIÇÃO DE ESTOQUE */}
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
              <th style={{ padding: '10px 12px' }}>Material</th>
              <th style={{ padding: '10px 12px' }}>Categoria</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Saldo Atual</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Saldo p/ RDO</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Capacidade de Uso</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Carregando dados do estoque...</td>
              </tr>
            ) : saldosFiltrados.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Nenhum material encontrado.</td>
              </tr>
            ) : (
              saldosFiltrados.map((item) => {
                const nomeMaterial = item.nome || item.material_nome || item.descricao || 'Sem descrição';
                const tipoMaterial = item.tipo || item.material_tipo || '-';
                const saldoAtual = Number(item.saldo_atual || item.saldo_total || 0);

                // Unidades
                const unEstoque = item.unidade_estoque || item.unidade_medida || 'UN';
                const unConsumo = item.unidade_consumo || 'UN';
                const unAplicada = item.unidade_aplicada || 'M2';

                // Parâmetros de Cálculo
                const fatorConsumo = Number(item.fator_conversao_consumo) || 1;
                const consBase = Number(item.consumo_base) || 0;
                const qtdAplicada = Number(item.quantidade_aplicada) || 0;

                // Flags de validação
                const temConversaoEmbalagem = Boolean(fatorConsumo > 1 || item.tem_conversao);
                const temRendimentoArea = Boolean(consBase > 0 && qtdAplicada > 0 && item.tem_rendimento);

                let saldoRDOTexto = '';
                let capacidadeUsoTexto = '';

                // REGRAS DE EXIBIÇÃO DA TABELA
                if (temRendimentoArea) {
                  // CASO TINTA:
                  // Saldo p/ RDO: mantém em baldes (ex: 2 BD)
                  saldoRDOTexto = `${saldoAtual.toLocaleString('pt-BR')} ${unEstoque}`;

                  // Capacidade de Uso: Área total calculada (ex: 30 M2)
                  const saldoEmUnidadeConsumo = temConversaoEmbalagem ? (saldoAtual * fatorConsumo) : saldoAtual;
                  const rendimentoCalculado = (saldoEmUnidadeConsumo / consBase) * qtdAplicada;
                  capacidadeUsoTexto = `${rendimentoCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${unAplicada}`;

                } else if (temConversaoEmbalagem) {
                  // CASO TACHÃO / CAIXA:
                  // Saldo p/ RDO: Total de unidades dentro das caixas (ex: 1.200 UN)
                  const totalUnidades = saldoAtual * fatorConsumo;
                  saldoRDOTexto = `${totalUnidades.toLocaleString('pt-BR')} ${unConsumo}`;

                  // Capacidade de Uso: Total disponível para uso (ex: 1.200 UN)
                  capacidadeUsoTexto = `${totalUnidades.toLocaleString('pt-BR')} ${unConsumo}`;

                } else {
                  // CASO MICROESFERA / MATERIAL DIRETO:
                  // Saldo p/ RDO: Direto na unidade (ex: 6 UN)
                  saldoRDOTexto = `${saldoAtual.toLocaleString('pt-BR')} ${unConsumo}`;

                  // Capacidade de Uso: Relação 1 para 1 (ex: 1 UN = 1 UN ou 1 SACO = 1 UN)
                  capacidadeUsoTexto = `1 ${unEstoque} = 1 ${unConsumo}`;
                }

                return (
                  <tr key={`mat-saldo-${item.material_id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#0f172a' }}>
                      {nomeMaterial}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>
                      {tipoMaterial}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', fontSize: '12px', color: '#2563eb' }}>
                      {saldoAtual.toLocaleString('pt-BR')} {unEstoque}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', fontSize: '12px', color: (temConversaoEmbalagem || temRendimentoArea) ? '#059669' : '#334155' }}>
                      {saldoRDOTexto}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 'bold', color: '#475569' }}>
                      {capacidadeUsoTexto}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button
                        onClick={() => abrirModalExtrato(item)}
                        title="Ver Movimentações do Material"
                        style={{ padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#f8fafc', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Eye style={{ width: '12px', height: '12px', color: '#2563eb' }} />
                        Extrato
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE EXTRATO DE MOVIMENTAÇÃO */}
      {materialSelecionado && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '90%', maxWidth: '750px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            
            <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>
                  Extrato do Material: {materialSelecionado.nome || materialSelecionado.material_nome || materialSelecionado.descricao}
                </h3>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Saldo Concluído: <strong>{saldoExtratoConcluido.toLocaleString('pt-BR')} {materialSelecionado.unidade_medida || 'UN'}</strong>
                </span>
              </div>
              <button onClick={fecharModal} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px' }}>
                <X style={{ width: '18px', height: '18px', color: '#64748b' }} />
              </button>
            </div>

            <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
              {carregandoModal ? (
                <p style={{ textAlign: 'center', fontSize: '12px', color: '#64748b' }}>Buscando movimentações...</p>
              ) : historicoMaterial.length === 0 ? (
                <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>Nenhuma movimentação registrada para este local/material.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '8px' }}>Tipo</th>
                      <th style={{ padding: '8px' }}>Qtd</th>
                      <th style={{ padding: '8px' }}>Status</th>
                      <th style={{ padding: '8px' }}>Origem / Destino</th>
                      <th style={{ padding: '8px' }}>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoMaterial.map((m) => {
                      const ehEntrada = ['ENTRADA_FORNECEDOR', 'TRANSFERENCIA_ENTRADA', 'AJUSTE'].includes(m.tipo_movimentacao);
                      const isConcluido = String(m.status).toUpperCase() === 'CONCLUIDO';

                      return (
                        <tr 
                          key={`modal-mov-${m.id}`} 
                          style={{ 
                            borderBottom: '1px solid #f1f5f9',
                            opacity: isConcluido ? 1 : 0.6 
                          }}
                        >
                          <td style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {ehEntrada ? (
                              <ArrowDownLeft style={{ width: '14px', height: '14px', color: '#16a34a' }} />
                            ) : (
                              <ArrowUpRight style={{ width: '14px', height: '14px', color: '#dc2626' }} />
                            )}
                            <span style={{ fontWeight: 'bold', color: ehEntrada ? '#16a34a' : '#dc2626' }}>
                              {m.tipo_movimentacao}
                            </span>
                          </td>
                          <td style={{ padding: '8px', fontWeight: 'bold' }}>
                            {m.quantidade} {m.unidade_medida || 'UN'}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '9px',
                              fontWeight: 'bold',
                              backgroundColor: isConcluido ? '#dcfce7' : '#fef3c7',
                              color: isConcluido ? '#15803d' : '#b45309'
                            }}>
                              {m.status || 'PENDENTE'}
                            </span>
                          </td>

                          <td style={{ padding: '8px', color: '#475569' }}>
                            {getNomeEntidade(m.origem_tipo, m.origem_id)} → {getNomeEntidade(m.destino_tipo, m.destino_id)}
                          </td>

                          <td style={{ padding: '8px', color: '#64748b' }}>
                            {m.data_movimentacao ? m.data_movimentacao.split('T')[0] : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', textAlign: 'right', backgroundColor: '#f8fafc' }}>
              <button onClick={fecharModal} style={{ padding: '6px 16px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}