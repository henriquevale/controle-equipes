import React, { useState } from 'react';
import axios from 'axios';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export default function DashboardObra({ obrasDisponiveis = [], usuarioLogado, API_URL }) {
  const listaObras = Array.isArray(obrasDisponiveis) ? obrasDisponiveis : [];

  // Filtros Globais
  const [obraId, setObraId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Aba selecionada no Relatório de Faturamento/Compras (Seção 5)
  const [abaCompras, setAbaCompras] = useState('materiais');

  // Estados de Dados do Dashboard
  const [loading, setLoading] = useState(false);
  const [atividadesData, setAtividadesData] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [presenca, setPresenca] = useState({});
  const [rdosData, setRdosData] = useState({});
  const [veiculosData, setVeiculosData] = useState({ detalhes: [], resumoStatus: {}, totalVeiculosUtilizados: 0 });
  const [faturamento, setFaturamento] = useState([]);

  // Estados para as abas de Compras
  const [comprasMateriais, setComprasMateriais] = useState([]);
  const [comprasFornecedores, setComprasFornecedores] = useState([]);

  const handleBuscarDados = async () => {
    if (!obraId) {
      alert("Por favor, selecione uma obra.");
      return;
    }

    setLoading(true);
    const baseUrl = API_URL || 'http://localhost:3001/api';

    try {
      const [
        resAtividades,
        resMateriais,
        resPresenca,
        resRdos,
        resVeiculos,
        resFaturamento,
        resCompMat,
        resCompForn
      ] = await Promise.all([
        axios.get(`${baseUrl}/relatorios/atividades-executadas`, {
          params: { obra_id: obraId, data_inicio: dataInicio, data_fim: dataFim }
        }).catch(() => ({ data: [] })),

        axios.get(`${baseUrl}/relatorios/materiais-consumidos`, {
          params: { obra_id: obraId, data_inicio: dataInicio, data_fim: dataFim }
        }).catch(() => ({ data: [] })),

        axios.get(`${baseUrl}/relatorios/presenca-detalhada`, {
          params: { obra_id: obraId, data_inicio: dataInicio, data_fim: dataFim }
        }).catch(() => ({ data: {} })),

        axios.get(`${baseUrl}/relatorios/rdos-resumo`, {
          params: { obra_id: obraId, data_inicio: dataInicio, data_fim: dataFim }
        }).catch(() => ({ data: {} })),

        axios.get(`${baseUrl}/relatorios/veiculos-utilizados`, {
          params: { 
            obra_id: obraId, 
            data_inicio: dataInicio, 
            data_fim: dataFim,
            id: usuarioLogado?.id || usuarioLogado?.usuario_id,
            cargo: usuarioLogado?.cargo
          }
        }).catch(() => ({ data: { detalhes: [], resumoStatus: {}, totalVeiculosUtilizados: 0 } })),

        axios.get(`${baseUrl}/relatorios/faturamento-direto`, {
          params: {
            obra_id: obraId,
            usuario_id: usuarioLogado?.id || usuarioLogado?.usuario_id,
            cargo: usuarioLogado?.cargo,
            data_inicio: dataInicio,
            data_fim: dataFim
          }
        }).catch(() => ({ data: [] })),

        axios.get(`${baseUrl}/relatorios/compras-por-material`, {
          params: { obra_id: obraId, data_inicio: dataInicio, data_fim: dataFim }
        }).catch(() => ({ data: [] })),

        axios.get(`${baseUrl}/relatorios/compras-por-fornecedor`, {
          params: { obra_id: obraId, data_inicio: dataInicio, data_fim: dataFim }
        }).catch(() => ({ data: [] }))
      ]);

      setAtividadesData(Array.isArray(resAtividades.data) ? resAtividades.data : []);
      setMateriais(Array.isArray(resMateriais.data) ? resMateriais.data : []);
      setPresenca(resPresenca.data || {});
      setRdosData(resRdos.data || {});
      setVeiculosData(resVeiculos.data || { detalhes: [], resumoStatus: {}, totalVeiculosUtilizados: 0 });
      setFaturamento(Array.isArray(resFaturamento.data) ? resFaturamento.data : []);

      setComprasMateriais(Array.isArray(resCompMat.data) ? resCompMat.data : []);
      setComprasFornecedores(Array.isArray(resCompForn.data) ? resCompForn.data : []);

    } catch (error) {
      console.error("Erro ao carregar os dados do dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  // Cálculo de totais garantindo compatibilidade de nomes de atributos
  const totalFaturamento = faturamento.reduce((acc, item) => acc + (Number(item.valor_total || item.valor || 0)), 0);
  const totalVolumeMateriais = materiais.reduce((acc, item) => acc + (Number(item.quantidade) || 0), 0);
  const totalVolumeAtividades = atividadesData.reduce((acc, item) => acc + (Number(item.quantidade) || 0), 0);

  const totalGastoCompras = comprasFornecedores.reduce((acc, item) => acc + parseFloat(item.valor_total_gasto || 0), 0);
  const totalPedidosCompras = comprasFornecedores.reduce((acc, item) => acc + parseInt(item.total_pedidos || 0), 0);

  // Lógica para Agrupar Veículos
  const agruparVeiculos = (detalhes = []) => {
    const mapa = {};
    detalhes.forEach(item => {
      const chave = item.placa || `VEICULO_${item.id_veiculo}` || 'SEM_PLACA';
      if (!mapa[chave]) {
        mapa[chave] = {
          placa: item.placa || 'Sem Placa',
          veiculo: `${item.marca || ''} ${item.modelo || ''}`.trim() || 'Não informado',
          total_apontamentos: 0,
          em_uso: 0,
          disponivel: 0,
          manutencao: 0,
          condutores: new Set()
        };
      }
      mapa[chave].total_apontamentos += 1;
      const st = (item.status_veiculo || '').toUpperCase();
      if (st === 'EM USO') mapa[chave].em_uso += 1;
      else if (st === 'DISPONÍVEL') mapa[chave].disponivel += 1;
      else if (st === 'EM MANUTENÇÃO') mapa[chave].manutencao += 1;

      if (item.nome_condutor || item.nome_funcionario) {
        mapa[chave].condutores.add(item.nome_condutor || item.nome_funcionario);
      }
    });
    return Object.values(mapa);
  };

  const listaVeiculosAgrupada = agruparVeiculos(veiculosData.detalhes);

  const tabButtonStyle = (ativa) => ({
    padding: '8px 16px',
    fontWeight: 'bold',
    fontSize: '12px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    borderBottom: ativa ? '3px solid #0284c7' : '3px solid transparent',
    color: ativa ? '#0284c7' : '#64748b'
  });

  const calcularCapacidadeUso = (m) => {
    const qtdComprada = Number(m.quantidade_total_comprada) || 0;
    const unEstoque = m.unidade_medida || m.unidade_estoque || 'UN';
    const unConsumo = m.unidade_consumo || 'UN';
    const unAplicada = m.unidade_aplicada || 'M2';

    const fatorConsumo = Number(m.fator_conversao_consumo) || 1;
    const consBase = Number(m.consumo_base) || 0;
    const qtdAplicada = Number(m.quantidade_aplicada) || 0;

    const temConversaoEmbalagem = Boolean(fatorConsumo > 1 || m.tem_conversao);
    const temRendimentoArea = Boolean(consBase > 0 && qtdAplicada > 0 && m.tem_rendimento);

    if (temRendimentoArea) {
      const saldoEmUnidadeConsumo = temConversaoEmbalagem ? (qtdComprada * fatorConsumo) : qtdComprada;
      const rendimentoCalculado = (saldoEmUnidadeConsumo / consBase) * qtdAplicada;
      return `${rendimentoCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${unAplicada}`;
    } else if (temConversaoEmbalagem) {
      const totalUnidades = qtdComprada * fatorConsumo;
      return `${totalUnidades.toLocaleString('pt-BR')} ${unConsumo}`;
    } else {
      return `1 ${unEstoque} = 1 ${unConsumo}`;
    }
  };

  return (
    <div style={{ padding: '10px', fontFamily: 'sans-serif', backgroundColor: '#f8fafc' }}>
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background-color: #fff !important;
          }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ fontSize: '18px', margin: 0 }}>Dashboard de Acompanhamento da Obra</h2>
        <button
          onClick={() => window.print()}
          className="no-print"
          style={{
            padding: '8px 16px',
            backgroundColor: '#059669',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Baixar PDF / Imprimir
        </button>
      </div>

      {/* FILTROS */}
      <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', backgroundColor: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '12px' }}>Obra:</label>
          <select value={obraId} onChange={(e) => setObraId(e.target.value)} style={{ padding: '8px', width: '220px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
            <option value="">Selecione uma Obra</option>
            {listaObras.map((obra) => (
              <option key={obra.id || obra.id_obra} value={obra.id || obra.id_obra}>
                {obra.nome || obra.nome_obra}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '12px' }}>Data Início:</label>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={{ padding: '7px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '12px' }}>Data Fim:</label>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} style={{ padding: '7px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
        </div>

        <button onClick={handleBuscarDados} style={{ marginTop: '18px', padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
          {loading ? 'Carregando...' : 'Filtrar'}
        </button>
      </div>

      {/* 1. GRÁFICO DE ATIVIDADES */}
      <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '14px', margin: 0, color: '#1e293b', fontWeight: 'bold' }}>
          1. Balanço de Atividades Executadas vs. Média Geral das Obras
        </h3>

        {atividadesData.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
            Nenhuma produção registrada no período selecionado.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
              {atividadesData.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderRight: '1px solid #bbf7d0', paddingRight: '8px', minWidth: '100px' }}>
                  <span style={{ fontSize: '10px', color: '#15803d', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.atividade}>
                    {item.atividade}
                  </span>
                  <span style={{ fontSize: '16px', color: '#14532d', fontWeight: 'bold' }}>
                    {Number(item.quantidade).toLocaleString('pt-BR')}
                  </span>
                  <span style={{ fontSize: '10px', color: '#047857', fontWeight: '500' }}>
                    Média: {Number(item.mediaGeral || 0).toLocaleString('pt-BR')}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px', backgroundColor: '#bbf7d0', margin: '-12px -12px -12px 0', padding: '12px', borderRadius: '0 4px 4px 0', justifyContent: 'center' }}>
                <span style={{ fontSize: '10px', color: '#14532d', fontWeight: 'bold' }}>TOTAL PRODUZIDO</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#16a34a' }}>
                  {totalVolumeAtividades.toLocaleString('pt-BR')}
                </span>
              </div>
            </div>

            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={atividadesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="atividade" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="quantidade" name="Produção da Obra Selecionada" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="mediaGeral" name="Média Geral de Todas as Obras" stroke="#047857" strokeWidth={3} dot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      {/* 2. GRÁFICO DE MATERIAIS */}
      <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '14px', margin: 0, color: '#1e293b', fontWeight: 'bold' }}>
          2. Consumo Acumulado de Materiais vs. Média Geral das Obras
        </h3>
        
        {materiais.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
            Nenhum material consumido registrado no período selecionado.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', backgroundColor: '#fff7ed', padding: '12px', borderRadius: '4px', border: '1px solid #ffedd5' }}>
              {materiais.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderRight: '1px solid #ffedd5', paddingRight: '8px', minWidth: '100px' }}>
                  <span style={{ fontSize: '10px', color: '#c2410c', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.material}>
                    {item.material}
                  </span>
                  <span style={{ fontSize: '16px', color: '#7c2d12', fontWeight: 'bold' }}>
                    {Number(item.quantidade).toLocaleString('pt-BR')}
                  </span>
                  <span style={{ fontSize: '10px', color: '#d97706', fontWeight: '500' }}>
                    Média: {Number(item.mediaGeral || 0).toLocaleString('pt-BR')}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px', backgroundColor: '#ffedd5', margin: '-12px -12px -12px 0', padding: '12px', borderRadius: '0 4px 4px 0', justifyContent: 'center' }}>
                <span style={{ fontSize: '10px', color: '#7c2d12', fontWeight: 'bold' }}>VOLUME TOTAL</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#ea580c' }}>
                  {totalVolumeMateriais.toLocaleString('pt-BR')}
                </span>
              </div>
            </div>

            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={materiais}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="material" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="quantidade" name="Consumo da Obra Selecionada" fill="#ea580c" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="mediaGeral" name="Média Geral de Todas as Obras" stroke="#d97706" strokeWidth={3} dot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      {/* 3. SEÇÃO: PRESENÇA DE FUNCIONÁRIOS E EFETIVO */}
      <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ fontSize: '14px', margin: 0, color: '#1e293b', fontWeight: 'bold' }}>
            3. Total de Presença e Efetivo
          </h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#334155', fontWeight: 'bold' }}>
              Total de RDOs no Período: <span style={{ color: '#2563eb', fontSize: '13px' }}>{presenca.totalRdos || 0}</span>
            </div>
            <div style={{ backgroundColor: '#f0fdf4', padding: '6px 12px', borderRadius: '6px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#166534', fontWeight: 'bold' }}>Frequência Geral:</span>
              <span style={{ fontSize: '14px', color: '#15803d', fontWeight: 'bold' }}>
                {presenca.percentualFrequenciaGeral || 0}%
              </span>
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#475569' }}>
                <th style={{ padding: '8px' }}>Matrícula</th>
                <th style={{ padding: '8px' }}>Funcionário</th>
                <th style={{ padding: '8px' }}>Cargo</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Presente</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Faltou</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Outros (Folga/Férias/etc)</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>% Frequência (em rel. aos RDOs)</th>
              </tr>
            </thead>
            <tbody>
              {!presenca.relacaoPresenca || presenca.relacaoPresenca.length === 0 ? (
                <tr><td colSpan="7" style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}>Nenhum registro de presença encontrado.</td></tr>
              ) : (
                presenca.relacaoPresenca.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px', fontFamily: 'monospace', fontWeight: 'bold', color: '#64748b' }}>
                      {row.matricula || '-'}
                    </td>
                    <td style={{ padding: '8px', fontWeight: 'bold', color: '#0f172a' }}>
                      {row.colaborador}
                    </td>
                    <td style={{ padding: '8px', color: '#475569' }}>
                      {row.cargo || '-'}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', color: '#16a34a', fontWeight: 'bold' }}>
                      {row.presente}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', color: '#dc2626', fontWeight: 'bold' }}>
                      {row.faltou}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', color: '#d97706' }}>
                      {row.outros}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: row.percentualFrequencia >= 85 ? '#dcfce7' : row.percentualFrequencia >= 70 ? '#fef9c3' : '#fee2e2',
                        color: row.percentualFrequencia >= 85 ? '#15803d' : row.percentualFrequencia >= 70 ? '#a16207' : '#b91c1c'
                      }}>
                        {row.percentualFrequencia}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. SEÇÃO: RELATÓRIO DE RDOS E CONTROLE DE EQUIPES */}
      <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ fontSize: '14px', margin: 0, color: '#1e293b', fontWeight: 'bold' }}>
            4. Relatório de RDOs e Controle de Equipes
          </h3>
          <div style={{ backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#334155', fontWeight: 'bold' }}>
            Total Registrado no Filtro: <span style={{ color: '#2563eb', fontSize: '13px' }}>{rdosData.totalRegistros || 0}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
          {/* TABELA A: STATUS DO RDO */}
          <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '12px', margin: '0 0 10px 0', color: '#334155' }}>Status do RDO</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#64748b', textAlign: 'left' }}>
                  <th style={{ padding: '4px' }}>Status</th>
                  <th style={{ padding: '4px', textAlign: 'center' }}>Qtd</th>
                  <th style={{ padding: '4px', textAlign: 'right' }}>% Representação</th>
                </tr>
              </thead>
              <tbody>
                {!rdosData.porStatusRdo || rdosData.porStatusRdo.length === 0 ? (
                  <tr><td colSpan="3" style={{ padding: '8px', textAlign: 'center', color: '#94a3b8' }}>Sem dados</td></tr>
                ) : (
                  rdosData.porStatusRdo.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 4px', fontWeight: 'bold', color: item.status === 'FINALIZADO' ? '#16a34a' : '#d97706' }}>
                        {item.status}
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantidade}</td>
                      <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 'bold', color: '#2563eb' }}>{item.percentual}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* TABELA B: STATUS OPERACIONAL */}
          <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '12px', margin: '0 0 10px 0', color: '#334155' }}>Status Operacional</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#64748b', textAlign: 'left' }}>
                  <th style={{ padding: '4px' }}>Condição</th>
                  <th style={{ padding: '4px', textAlign: 'center' }}>Qtd</th>
                  <th style={{ padding: '4px', textAlign: 'right' }}>% Representação</th>
                </tr>
              </thead>
              <tbody>
                {!rdosData.porStatusOperacional || rdosData.porStatusOperacional.length === 0 ? (
                  <tr><td colSpan="3" style={{ padding: '8px', textAlign: 'center', color: '#94a3b8' }}>Sem dados</td></tr>
                ) : (
                  rdosData.porStatusOperacional.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 4px', fontWeight: 'bold', color: '#0f172a' }}>{item.status_operacional}</td>
                      <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantidade}</td>
                      <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 'bold', color: '#2563eb' }}>{item.percentual}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* TABELA C: RELAÇÃO DE REGISTROS POR DIA */}
        <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <h4 style={{ fontSize: '12px', margin: '0 0 10px 0', color: '#334155' }}>Relação de Diários Emitidos por Dia</h4>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#64748b', textAlign: 'left', position: 'sticky', top: 0, backgroundColor: '#f8fafc' }}>
                  <th style={{ padding: '4px' }}>Data</th>
                  <th style={{ padding: '4px', textAlign: 'center' }}>Qtd Diários</th>
                  <th style={{ padding: '4px', textAlign: 'right' }}>% em Relação ao Total do Filtro</th>
                </tr>
              </thead>
              <tbody>
                {!rdosData.relacaoPorDias || rdosData.relacaoPorDias.length === 0 ? (
                  <tr><td colSpan="3" style={{ padding: '8px', textAlign: 'center', color: '#94a3b8' }}>Nenhum diário registrado no período.</td></tr>
                ) : (
                  rdosData.relacaoPorDias.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 4px', fontWeight: 'bold', color: '#475569' }}>{item.data}</td>
                      <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantidade}</td>
                      <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 'bold', color: '#2563eb' }}>{item.percentual}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 5. RELATÓRIO DE FATURAMENTO DIRETO E COMPRAS DA OBRA */}
      <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ fontSize: '14px', margin: 0, color: '#1e293b', fontWeight: 'bold' }}>
            5. Relatório de Faturamento Direto e Compras da Obra
          </h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ backgroundColor: '#dbeafe', padding: '6px 12px', borderRadius: '6px', border: '1px solid #93c5fd', fontSize: '11px', color: '#1e40af', fontWeight: 'bold' }}>
              Volume Compras: R$ {totalGastoCompras.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ backgroundColor: '#dcfce7', padding: '6px 12px', borderRadius: '6px', border: '1px solid #86efac', fontSize: '11px', color: '#166534', fontWeight: 'bold' }}>
              Pedidos: {totalPedidosCompras}
            </div>
            <div style={{ backgroundColor: '#fef3c7', padding: '6px 12px', borderRadius: '6px', border: '1px solid #fde047', fontSize: '11px', color: '#92400e', fontWeight: 'bold' }}>
              Fat. Direto Total: R$ {totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS INTERNAS */}
        <div className="no-print" style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0' }}>
          <button onClick={() => setAbaCompras('materiais')} style={tabButtonStyle(abaCompras === 'materiais')}>
            Compras por Produto/Material
          </button>
          <button onClick={() => setAbaCompras('fornecedores')} style={tabButtonStyle(abaCompras === 'fornecedores')}>
            Compras por Fornecedor
          </button>
          <button onClick={() => setAbaCompras('faturamento')} style={tabButtonStyle(abaCompras === 'faturamento')}>
            Faturamento Direto
          </button>
        </div>

        {/* TABELA: MATERIAIS */}
        {abaCompras === 'materiais' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#475569' }}>
                  <th style={{ padding: '8px' }}>Produto / Material</th>
                  <th style={{ padding: '8px' }}>Tipo</th>
                  <th style={{ padding: '8px' }}>Qtd. Total Comprada</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Capacidade de Uso</th>
                  <th style={{ padding: '8px' }}>Preço Médio Un.</th>
                  <th style={{ padding: '8px' }}>Menor Preço</th>
                  <th style={{ padding: '8px' }}>Maior Preço</th>
                  <th style={{ padding: '8px' }}>Valor Total Gasto</th>
                  <th style={{ padding: '8px' }}>Última Compra</th>
                </tr>
              </thead>
              <tbody>
                {comprasMateriais.length === 0 ? (
                  <tr><td colSpan="9" style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>Nenhum registro encontrado.</td></tr>
                ) : (
                  comprasMateriais.map((m, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>
                        {m.material_nome} <span style={{ color: '#64748b', fontWeight: 'normal' }}>({m.unidade_medida || 'UN'})</span>
                      </td>
                      <td style={{ padding: '8px', color: '#475569' }}>{m.material_tipo || '-'}</td>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>{parseFloat(m.quantidade_total_comprada || 0).toLocaleString('pt-BR')}</td>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#475569' }}>
                        {calcularCapacidadeUso(m)}
                      </td>
                      <td style={{ padding: '8px' }}>R$ {parseFloat(m.preco_medio_unitario || 0).toFixed(2)}</td>
                      <td style={{ padding: '8px', color: '#16a34a', fontWeight: '500' }}>R$ {parseFloat(m.menor_preco_unitario || 0).toFixed(2)}</td>
                      <td style={{ padding: '8px', color: '#dc2626', fontWeight: '500' }}>R$ {parseFloat(m.maior_preco_unitario || 0).toFixed(2)}</td>
                      <td style={{ padding: '8px', fontWeight: 'bold', color: '#2563eb' }}>
                        R$ {parseFloat(m.valor_total_gasto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '8px', color: '#64748b' }}>{m.ultima_compra ? new Date(m.ultima_compra).toLocaleDateString('pt-BR') : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TABELA: FORNECEDORES */}
        {abaCompras === 'fornecedores' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#475569' }}>
                  <th style={{ padding: '8px' }}>Fornecedor</th>
                  <th style={{ padding: '8px' }}>CNPJ</th>
                  <th style={{ padding: '8px' }}>Nº de Pedidos</th>
                  <th style={{ padding: '8px' }}>Variedade de Produtos</th>
                  <th style={{ padding: '8px' }}>Valor Total (R$)</th>
                  <th style={{ padding: '8px' }}>% Participação</th>
                  <th style={{ padding: '8px' }}>Última Compra</th>
                </tr>
              </thead>
              <tbody>
                {comprasFornecedores.length === 0 ? (
                  <tr><td colSpan="7" style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>Nenhum registro encontrado.</td></tr>
                ) : (
                  comprasFornecedores.map((f, idx) => {
                    const valorGastoForn = parseFloat(f.valor_total_gasto || 0);
                    const pctTotal = totalGastoCompras > 0 ? ((valorGastoForn / totalGastoCompras) * 100).toFixed(1) : '0.0';

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px' }}>
                          <div style={{ fontWeight: 'bold' }}>{f.nome_fantasia || f.razao_social}</div>
                          {f.nome_fantasia && <div style={{ fontSize: '10px', color: '#64748b' }}>{f.razao_social}</div>}
                        </td>
                        <td style={{ padding: '8px', color: '#64748b' }}>{f.cnpj || '-'}</td>
                        <td style={{ padding: '8px', fontWeight: 'bold', color: '#0284c7' }}>{f.total_pedidos} pedidos</td>
                        <td style={{ padding: '8px' }}>{f.diversidade_produtos} itens diferentes</td>
                        <td style={{ padding: '8px', fontWeight: 'bold', color: '#16a34a' }}>
                          R$ {valorGastoForn.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '8px', fontWeight: 'bold' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '12px', backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                            {pctTotal}%
                          </span>
                        </td>
                        <td style={{ padding: '8px', color: '#64748b' }}>
                          {f.ultima_compra ? new Date(f.ultima_compra).toLocaleDateString('pt-BR') : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TABELA: FATURAMENTO DIRETO */}
        {abaCompras === 'faturamento' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#475569' }}>
                  <th style={{ padding: '8px' }}>Nota Fiscal</th>
                  <th style={{ padding: '8px' }}>Fornecedor</th>
                  <th style={{ padding: '8px' }}>Gestor Responsável</th>
                  <th style={{ padding: '8px' }}>Data Emissão</th>
                  <th style={{ padding: '8px' }}>Valor Total (R$)</th>
                  <th style={{ padding: '8px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {faturamento.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>Nenhum faturamento registrado para esta obra.</td></tr>
                ) : (
                  faturamento.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>
                        {row.numero_nota_fiscal || (row.numero_pedido_obra ? `Ped: ${row.numero_pedido_obra}` : `#${row.id}`)}
                      </td>
                      <td style={{ padding: '8px' }}>
                        {row.fornecedor_nome || '-'}
                      </td>
                      <td style={{ padding: '8px', color: '#475569' }}>
                        {row.gestor_nome || '-'}
                      </td>
                      <td style={{ padding: '8px', color: '#64748b' }}>
                        {row.data_emissao ? new Date(row.data_emissao).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td style={{ padding: '8px', fontWeight: 'bold', color: '#16a34a' }}>
                        R$ {Number(row.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '8px' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 'bold',
                          fontSize: '10px',
                          backgroundColor: row.status === 'APROVADO' || row.status === 'Concluído' || row.status === 'NF recebida e em estoque' ? '#dcfce7' : '#fef3c7',
                          color: row.status === 'APROVADO' || row.status === 'Concluído' || row.status === 'NF recebida e em estoque' ? '#166534' : '#92400e'
                        }}>
                          {row.status || 'PENDENTE'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. RELATÓRIO DE VEÍCULOS / FROTA ALOCADA */}
      <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ fontSize: '14px', margin: 0, color: '#1e293b', fontWeight: 'bold' }}>
            6. Relatório Consolidado de Veículos / Frota Alocada
          </h3>
          <div style={{ backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#334155', fontWeight: 'bold' }}>
            Apontamentos Totais: <span style={{ color: '#2563eb', fontSize: '13px' }}>{veiculosData.totalVeiculosUtilizados || 0}</span>
          </div>
        </div>

        {/* CARDS KPI DE VEÍCULOS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px' }}>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', display: 'block' }}>VEÍCULOS DISTINTOS</span>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>{listaVeiculosAgrupada.length}</span>
          </div>

          <div style={{ backgroundColor: '#fef9c3', border: '1px solid #fde047', borderRadius: '6px', padding: '10px' }}>
            <span style={{ fontSize: '10px', color: '#854d0e', fontWeight: 'bold', display: 'block' }}>EM USO</span>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#713f12' }}>{veiculosData.resumoStatus['EM USO'] || 0}</span>
          </div>

          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px' }}>
            <span style={{ fontSize: '10px', color: '#166534', fontWeight: 'bold', display: 'block' }}>DISPONÍVEIS</span>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#14532d' }}>{veiculosData.resumoStatus['DISPONÍVEL'] || 0}</span>
          </div>

          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px' }}>
            <span style={{ fontSize: '10px', color: '#991b1b', fontWeight: 'bold', display: 'block' }}>EM MANUTENÇÃO</span>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#7f1d1d' }}>{veiculosData.resumoStatus['EM MANUTENÇÃO'] || 0}</span>
          </div>
        </div>

        {/* TABELA DE VEÍCULOS */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#475569' }}>
                <th style={{ padding: '8px' }}>Placa</th>
                <th style={{ padding: '8px' }}>Veículo / Modelo</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Total Apontamentos</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Em Uso</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Disponível</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Manutenção</th>
                <th style={{ padding: '8px' }}>Motoristas / Responsáveis</th>
              </tr>
            </thead>
            <tbody>
              {listaVeiculosAgrupada.length === 0 ? (
                <tr><td colSpan="7" style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}>Nenhum veículo utilizado na obra neste período.</td></tr>
              ) : (
                listaVeiculosAgrupada.map((v, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px', fontFamily: 'monospace', fontWeight: 'bold', color: '#0f172a' }}>
                      {v.placa}
                    </td>
                    <td style={{ padding: '8px', fontWeight: 'bold', color: '#1e293b' }}>
                      {v.veiculo}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>
                      {v.total_apontamentos}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#854d0e', backgroundColor: '#fef9c3' }}>
                      {v.em_uso}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#166534', backgroundColor: '#f0fdf4' }}>
                      {v.disponivel}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#991b1b', backgroundColor: '#fef2f2' }}>
                      {v.manutencao}
                    </td>
                    <td style={{ padding: '8px', color: '#475569', fontSize: '11px' }}>
                      {Array.from(v.condutores).join(', ') || '-'}
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