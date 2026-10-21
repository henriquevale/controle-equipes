import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { 
  Filter, ArrowDownLeft, ArrowUpRight, 
  RefreshCw, CheckCircle, Search, Download 
} from 'lucide-react';

export default function RelatorioMovimentacoes({ API_URL, mostrarMensagem, usuarioLogado }) {
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [gestores, setGestores] = useState([]);
  const [bases, setBases] = useState([]);
  const [obras, setObras] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [carregando, setCarregando] = useState(false);

  // Estados dos Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  
  // Quem vai enviar (Gestor)
  const [enviadoPor, setEnviadoPor] = useState('');

  // Origem
  const [origemTipo, setOrigemTipo] = useState('');
  const [origemId, setOrigemId] = useState('');

  // Tipo Movimentação
  const [tipoMovimentacao, setTipoMovimentacao] = useState('');

  // Quem vai pedir (Gestor)
  const [gestorId, setGestorId] = useState('');

  // Destino
  const [destinoTipo, setDestinoTipo] = useState('');
  const [destinoId, setDestinoId] = useState('');

  // Material (Pesquisável)
  const [materialBusca, setMaterialBusca] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [mostrarDropdownMaterial, setMostrarDropdownMaterial] = useState(false);

  // Identificação e Permissões do Usuário Logado
  const usuarioId = usuarioLogado?.id || usuarioLogado?.id_usuario || localStorage.getItem('usuario_id');
  const cargoUsuario = String(usuarioLogado?.cargo || localStorage.getItem('usuario_cargo') || '').toUpperCase();
  const ehAcessoGlobal = ['MASTER', 'RH', 'ENGENHARIA'].includes(cargoUsuario);

  useEffect(() => {
    carregarMateriais();
    carregarGestores();
    carregarListasLocais();
    carregarRelatorio();
  }, [usuarioId, cargoUsuario]);

  const carregarMateriais = async () => {
    try {
      const res = await axios.get(`${API_URL}/materiais`);
      setMateriais(res.data || []);
    } catch (e) {
      console.error("Erro ao carregar materiais:", e);
    }
  };

  const carregarGestores = async () => {
    try {
      const res = await axios.get(`${API_URL}/usuarios`);
      const lista = (res.data || []).filter(u =>
        String(u.cargo || '').toUpperCase().includes('GESTOR')
      );
      setGestores(lista);
    } catch (e) {
      console.error("Erro ao carregar gestores:", e.response?.status, e.message);
    }
  };

  const carregarListasLocais = async () => {
    try {
      const [resBases, resObras, resForn] = await Promise.all([
        axios.get(`${API_URL}/bases`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/master/obras-todas`).catch(() => axios.get(`${API_URL}/master/obras-geral`)).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/fornecedores`).catch(() => ({ data: [] }))
      ]);

      setBases(resBases.data || []);
      setObras(resObras.data || []);
      setFornecedores(resForn.data || []);
    } catch (e) {
      console.error("Erro ao carregar locações e listas auxiliares:", e);
    }
  };

  const carregarRelatorio = async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();

      // Passa a identificação de quem está logado para aplicar a regra de acesso
      if (usuarioId) params.append('usuario_id', usuarioId);
      if (cargoUsuario) params.append('cargo', cargoUsuario);

      if (dataInicio) params.append('data_inicio', dataInicio);
      if (dataFim) params.append('data_fim', dataFim);
      if (enviadoPor) params.append('enviado_por', enviadoPor);
      if (origemTipo) params.append('origem_tipo', origemTipo);
      if (origemId) params.append('origem_id', origemId);
      if (tipoMovimentacao) params.append('tipo_movimentacao', tipoMovimentacao);
      if (gestorId) params.append('gestor_id', gestorId);
      if (destinoTipo) params.append('destino_tipo', destinoTipo);
      if (destinoId) params.append('destino_id', destinoId);
      if (materialId) params.append('material_id', materialId);

      // Trava de segurança no Front-End para o Gestor:
      // Se o Gestor escolher no filtro "Quem enviou" AND "Quem pediu" com IDs diferentes do dele, já bloqueia na hora.
      if (!ehAcessoGlobal && usuarioId) {
        const idLogado = Number(usuarioId);
        const enviouOutro = enviadoPor && Number(enviadoPor) !== idLogado;
        const pediuOutro = gestorId && Number(gestorId) !== idLogado;

        if (enviouOutro && pediuOutro) {
          setMovimentacoes([]);
          setCarregando(false);
          return;
        }
      }

      const res = await axios.get(`${API_URL}/master/relatorios/movimentacoes?${params.toString()}`);
      setMovimentacoes(res.data || []);
    } catch (e) {
      console.error("Erro ao gerar relatório:", e);
      if (mostrarMensagem) mostrarMensagem('Erro ao carregar relatório de movimentações.', 'erro');
    } finally {
      setCarregando(false);
    }
  };

  const exportarParaExcel = () => {
    if (movimentacoes.length === 0) {
      if (mostrarMensagem) mostrarMensagem('Não há dados para exportar.', 'erro');
      return;
    }

    const dadosExcel = movimentacoes.map(item => {
      const ehEntrada = ['ENTRADA_FORNECEDOR', 'TRANSFERENCIA_ENTRADA', 'AJUSTE'].includes(item.tipo_movimentacao);
      const dataFormatada = item.data_solicitada ? new Date(item.data_solicitada).toLocaleDateString('pt-BR') : '-';

      return {
        'Data': dataFormatada,
        'Tipo': item.tipo_movimentacao || '-',
        'Material': item.material_nome || '-',
        'Quantidade': ehEntrada ? Number(item.quantidade) : -Number(item.quantidade),
        'Unidade': item.unidade_medida || 'UN',
        'Origem': item.origem_nome ? `${item.origem_tipo} (${item.origem_nome})` : item.origem_tipo || '-',
        'Quem Enviou (Gestor)': item.enviado_por_nome || '-',
        'Quem Pediu (Gestor)': item.gestor_nome || '-',
        'Destino': item.destino_nome ? `${item.destino_tipo} (${item.destino_nome})` : item.destino_tipo || '-',
        'Observação': item.observacao || '-',
        'Status': item.status || 'PENDENTE'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dadosExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Movimentações");

    const fitToColumn = Object.keys(dadosExcel[0] || {}).map(key => ({
      wch: Math.max(key.length, 15)
    }));
    worksheet['!cols'] = fitToColumn;

    XLSX.writeFile(workbook, `Relatorio_Movimentacoes_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const limparFiltros = () => {
    setDataInicio('');
    setDataFim('');
    setEnviadoPor('');
    setOrigemTipo('');
    setOrigemId('');
    setTipoMovimentacao('');
    setGestorId('');
    setDestinoTipo('');
    setDestinoId('');
    setMaterialId('');
    setMaterialBusca('');
  };

  // Métricas
  const totalEntradas = movimentacoes
    .filter(m => ['ENTRADA_FORNECEDOR', 'TRANSFERENCIA_ENTRADA', 'AJUSTE'].includes(m.tipo_movimentacao))
    .reduce((acc, curr) => acc + Number(curr.quantidade), 0);

  const totalSaidas = movimentacoes
    .filter(m => ['TRANSFERENCIA_SAIDA', 'CONSUMO_RDO'].includes(m.tipo_movimentacao))
    .reduce((acc, curr) => acc + Number(curr.quantidade), 0);

  const totalConfirmadas = movimentacoes.filter(m => m.status === 'CONFIRMADO' || m.status === 'CONCLUIDO').length;

  const inputStyle = {
    height: '34px', padding: '0 8px', border: '1px solid #cbd5e1',
    borderRadius: '6px', fontSize: '11px', backgroundColor: '#fff', width: '100%'
  };

  const materiaisFiltrados = materiais.filter(m => 
    m.descricao?.toLowerCase().includes(materialBusca.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      
      {/* PAINEL DE FILTROS */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter style={{ width: '16px', height: '16px', color: '#2563eb' }} />
            Filtros do Relatório
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={limparFiltros}
              style={{ height: '32px', padding: '0 12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#475569' }}
            >
              Limpar
            </button>
            <button 
              onClick={carregarRelatorio}
              style={{ height: '32px', padding: '0 14px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw style={{ width: '12px', height: '12px' }} />
              Filtrar Relatório
            </button>
            <button 
              onClick={exportarParaExcel}
              style={{ height: '32px', padding: '0 14px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download style={{ width: '12px', height: '12px' }} />
              Exportar Excel
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
          
          {/* DATAS */}
          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>DATA INÍCIO</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>DATA FIM</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={inputStyle} />
          </div>

          {/* 1. QUEM VAI ENVIAR (GESTOR) */}
          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>1. QUEM VAI ENVIAR (GESTOR)</label>
            <select value={enviadoPor} onChange={e => setEnviadoPor(e.target.value)} style={inputStyle}>
              <option value="">Selecione o gestor...</option>
              {gestores.map(g => (
                <option key={`env-${g.id}`} value={g.id}>{g.nome}</option>
              ))}
            </select>
          </div>

          {/* 2. ORIGEM - LOCAL */}
          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>2. ORIGEM - LOCAL</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <select 
                value={origemTipo} 
                onChange={e => {
                  setOrigemTipo(e.target.value);
                  setOrigemId('');
                }} 
                style={inputStyle}
              >
                <option value="">Selecione...</option>
                <option value="BASE">Base</option>
                <option value="OBRA">Obra</option>
                <option value="FORNECEDOR">Fornecedor</option>
              </select>

              {origemTipo === 'BASE' && (
                <select value={origemId} onChange={e => setOrigemId(e.target.value)} style={inputStyle}>
                  <option value="">Selecione a Base...</option>
                  {bases.map(b => <option key={`obase-${b.id}`} value={b.id}>{b.nome}</option>)}
                </select>
              )}

              {origemTipo === 'OBRA' && (
                <select value={origemId} onChange={e => setOrigemId(e.target.value)} style={inputStyle}>
                  <option value="">Selecione a Obra...</option>
                  {obras.map(o => <option key={`oobra-${o.id}`} value={o.id}>{o.nome_obra || o.nome}</option>)}
                </select>
              )}

              {origemTipo === 'FORNECEDOR' && (
                <select value={origemId} onChange={e => setOrigemId(e.target.value)} style={inputStyle}>
                  <option value="">Selecione o Fornecedor...</option>
                  {fornecedores.map(f => <option key={`oforn-${f.id}`} value={f.id}>{f.nome_fantasia || f.razao_social}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* 7. TIPO MOVIMENTAÇÃO */}
          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>7. TIPO MOVIMENTAÇÃO</label>
            <select value={tipoMovimentacao} onChange={e => setTipoMovimentacao(e.target.value)} style={inputStyle}>
              <option value="">Todas</option>
              <option value="ENTRADA_FORNECEDOR">Entrada (Fornecedor)</option>
              <option value="TRANSFERENCIA_SAIDA">Transferência (Saída)</option>
              <option value="TRANSFERENCIA_ENTRADA">Transferência (Entrada)</option>
              <option value="CONSUMO_RDO">Consumo RDO</option>
              <option value="AJUSTE">Ajuste</option>
            </select>
          </div>

          {/* 8. QUEM VAI PEDIR (GESTOR) */}
          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>8. QUEM VAI PEDIR (GESTOR)</label>
            <select value={gestorId} onChange={e => setGestorId(e.target.value)} style={inputStyle}>
              <option value="">Selecione o gestor...</option>
              {gestores.map(g => (
                <option key={`gestor-${g.id}`} value={g.id}>{g.nome}</option>
              ))}
            </select>
          </div>

          {/* 9. DESTINO */}
          <div>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>9. DESTINO *</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <select 
                value={destinoTipo} 
                onChange={e => {
                  setDestinoTipo(e.target.value);
                  setDestinoId('');
                }} 
                style={inputStyle}
              >
                <option value="">Selecione...</option>
                <option value="BASE">Base</option>
                <option value="OBRA">Obra</option>
              </select>

              {destinoTipo === 'BASE' && (
                <select value={destinoId} onChange={e => setDestinoId(e.target.value)} style={inputStyle}>
                  <option value="">Selecione a Base...</option>
                  {bases.map(b => <option key={`dbase-${b.id}`} value={b.id}>{b.nome}</option>)}
                </select>
              )}

              {destinoTipo === 'OBRA' && (
                <select value={destinoId} onChange={e => setDestinoId(e.target.value)} style={inputStyle}>
                  <option value="">Selecione a Obra...</option>
                  {obras.map(o => <option key={`dobra-${o.id}`} value={o.id}>{o.nome_obra || o.nome}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* MATERIAL COM BUSCA AUTOCOMPLETE */}
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>MATERIAL</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder="Pesquisar material..."
                value={materialBusca}
                onFocus={() => setMostrarDropdownMaterial(true)}
                onChange={e => {
                  setMaterialBusca(e.target.value);
                  setMaterialId('');
                  setMostrarDropdownMaterial(true);
                }} 
                style={inputStyle} 
              />
              <Search style={{ position: 'absolute', right: '8px', width: '12px', height: '12px', color: '#94a3b8' }} />
            </div>

            {mostrarDropdownMaterial && (
              <div 
                style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  maxHeight: '160px', overflowY: 'auto', backgroundColor: '#fff',
                  border: '1px solid #cbd5e1', borderRadius: '6px', zIndex: 10,
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginTop: '2px'
                }}
              >
                <div 
                  onClick={() => {
                    setMaterialId('');
                    setMaterialBusca('');
                    setMostrarDropdownMaterial(false);
                  }}
                  style={{ padding: '6px 10px', fontSize: '11px', cursor: 'pointer', color: '#64748b', borderBottom: '1px solid #f1f5f9' }}
                >
                  <em>Todos os Materiais</em>
                </div>
                {materiaisFiltrados.length === 0 ? (
                  <div style={{ padding: '6px 10px', fontSize: '11px', color: '#94a3b8' }}>Nenhum material encontrado</div>
                ) : (
                  materiaisFiltrados.map(m => (
                    <div 
                      key={`mat-item-${m.id}`}
                      onClick={() => {
                        setMaterialId(m.id);
                        setMaterialBusca(m.descricao);
                        setMostrarDropdownMaterial(false);
                      }}
                      style={{ padding: '6px 10px', fontSize: '11px', cursor: 'pointer', borderBottom: '1px solid #f8fafc' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                    >
                      {m.descricao}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* CARDS COM MÉTRICAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '8px' }}>
            <ArrowDownLeft style={{ width: '20px', height: '20px', color: '#16a34a' }} />
          </div>
          <div>
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>TOTAL ENTRADAS</span>
            <h4 style={{ fontSize: '16px', fontWeight: 'bold', color: '#16a34a', margin: 0 }}>+{totalEntradas.toFixed(2)}</h4>
          </div>
        </div>

        <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#fef2f2', padding: '10px', borderRadius: '8px' }}>
            <ArrowUpRight style={{ width: '20px', height: '20px', color: '#dc2626' }} />
          </div>
          <div>
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>TOTAL SAÍDAS / CONSUMO</span>
            <h4 style={{ fontSize: '16px', fontWeight: 'bold', color: '#dc2626', margin: 0 }}>-{totalSaidas.toFixed(2)}</h4>
          </div>
        </div>

        <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#eff6ff', padding: '10px', borderRadius: '8px' }}>
            <CheckCircle style={{ width: '20px', height: '20px', color: '#2563eb' }} />
          </div>
          <div>
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>MOVIMENTAÇÕES CONFIRMADAS</span>
            <h4 style={{ fontSize: '16px', fontWeight: 'bold', color: '#2563eb', margin: 0 }}>{totalConfirmadas} de {movimentacoes.length}</h4>
          </div>
        </div>
      </div>

      {/* TABELA DO RELATÓRIO */}
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
              <th style={{ padding: '10px 12px' }}>Data</th>
              <th style={{ padding: '10px 12px' }}>Tipo</th>
              <th style={{ padding: '10px 12px' }}>Material</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Qtd.</th>
              <th style={{ padding: '10px 12px' }}>Origem</th>
              <th style={{ padding: '10px 12px' }}>Quem Enviou (Gestor)</th>
              <th style={{ padding: '10px 12px' }}>Quem Pediu (Gestor)</th>
              <th style={{ padding: '10px 12px' }}>Destino</th>
              <th style={{ padding: '10px 12px' }}>Observação</th>
              <th style={{ padding: '10px 12px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan="10" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Gerando relatório...</td>
              </tr>
            ) : movimentacoes.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Nenhuma movimentação atende aos filtros selecionados.</td>
              </tr>
            ) : (
              movimentacoes.map((item) => {
                const ehEntrada = ['ENTRADA_FORNECEDOR', 'TRANSFERENCIA_ENTRADA', 'AJUSTE'].includes(item.tipo_movimentacao);
                return (
                  <tr key={`rel-mov-${item.id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', color: '#334155', fontWeight: 'bold' }}>
                      {item.data_solicitada ? new Date(item.data_solicitada).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontWeight: 'bold', color: ehEntrada ? '#16a34a' : '#dc2626' }}>
                        {item.tipo_movimentacao}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#0f172a' }}>
                      {item.material_nome}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', color: ehEntrada ? '#16a34a' : '#dc2626' }}>
                      {ehEntrada ? `+${item.quantidade}` : `-${item.quantidade}`} {item.unidade_medida || 'UN'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>
                      {item.origem_nome ? `${item.origem_tipo} (${item.origem_nome})` : item.origem_tipo || '-'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>
                      {item.enviado_por_nome || '-'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569', fontWeight: '500' }}>
                      {item.gestor_nome || '-'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>
                      {item.destino_nome ? `${item.destino_tipo} (${item.destino_nome})` : item.destino_tipo || '-'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.observacao || ''}>
                      {item.observacao || '-'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ 
                        padding: '3px 8px', 
                        borderRadius: '12px', 
                        fontSize: '9px', 
                        fontWeight: 'bold',
                        backgroundColor: (item.status === 'CONFIRMADO' || item.status === 'CONCLUIDO') ? '#dcfce7' : '#fef3c7',
                        color: (item.status === 'CONFIRMADO' || item.status === 'CONCLUIDO') ? '#15803d' : '#b45309'
                      }}>
                        {item.status || 'PENDENTE'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}