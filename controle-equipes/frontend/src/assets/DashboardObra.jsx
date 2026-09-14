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

  // Estados de Dados do Dashboard
  const [loading, setLoading] = useState(false);
  const [atividadesData, setAtividadesData] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [presenca, setPresenca] = useState({});
  const [rdosData, setRdosData] = useState({}); // Estado do RDO adicionado
  const [veiculos, setVeiculos] = useState([]);
  const [faturamento, setFaturamento] = useState([]);

  const handleBuscarDados = async () => {
    if (!obraId) {
      alert("Por favor, selecione uma obra.");
      return;
    }

    setLoading(true);
    const baseUrl = API_URL || 'http://localhost:3001/api';

    try {
      const [resAtividades, resMateriais, resPresenca, resRdos, resVeiculos, resFaturamento] = await Promise.all([
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

        axios.get(`${baseUrl}/relatorios/veiculos`, {
          params: { obra_id: obraId, data_inicio: dataInicio, data_fim: dataFim }
        }).catch(() => ({ data: [] })),

        axios.get(`${baseUrl}/relatorios/faturamento-direto`, {
          params: { obra_id: obraId, data_inicio: dataInicio, data_fim: dataFim }
        }).catch(() => ({ data: [] }))
      ]);

      setAtividadesData(Array.isArray(resAtividades.data) ? resAtividades.data : []);
      setMateriais(Array.isArray(resMateriais.data) ? resMateriais.data : []);
      setPresenca(resPresenca.data || {});
      setRdosData(resRdos.data || {});
      setVeiculos(Array.isArray(resVeiculos.data) ? resVeiculos.data : []);
      setFaturamento(Array.isArray(resFaturamento.data) ? resFaturamento.data : []);
    } catch (error) {
      console.error("Erro ao carregar os dados do dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalFaturamento = faturamento.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
  const totalVolumeMateriais = materiais.reduce((acc, item) => acc + (Number(item.quantidade) || 0), 0);
  const totalVolumeAtividades = atividadesData.reduce((acc, item) => acc + (Number(item.quantidade) || 0), 0);

  return (
    <div style={{ padding: '10px', fontFamily: 'sans-serif', backgroundColor: '#f8fafc' }}>
      <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Dashboard de Acompanhamento da Obra</h2>

      {/* FILTROS */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '15px',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: '15px',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '1px solid #e2e8f0'
      }}>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '12px' }}>Obra:</label>
          <select 
            value={obraId} 
            onChange={(e) => setObraId(e.target.value)}
            style={{ padding: '8px', width: '220px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
          >
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
          <input 
            type="date" 
            value={dataInicio} 
            onChange={(e) => setDataInicio(e.target.value)} 
            style={{ padding: '7px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '12px' }}>Data Fim:</label>
          <input 
            type="date" 
            value={dataFim} 
            onChange={(e) => setDataFim(e.target.value)} 
            style={{ padding: '7px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
          />
        </div>

        <button 
          onClick={handleBuscarDados}
          style={{
            marginTop: '18px',
            padding: '8px 16px',
            backgroundColor: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          {loading ? 'Carregando...' : 'Filtrar'}
        </button>
      </div>

      {/* 1. GRÁFICO DE ATIVIDADES */}
      <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '14px', margin: 0, color: '#1e293b' }}>
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
        <h3 style={{ fontSize: '14px', margin: 0, color: '#1e293b' }}>2. Consumo Acumulado de Materiais vs. Média Geral das Obras</h3>
        
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

      {/* 5. TABELA DE VEÍCULOS */}
      <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>5. Veículos / Frota Alocada</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#f1f5f9' }}>
              <th style={{ padding: '8px' }}>Veículo / Placa</th>
              <th style={{ padding: '8px' }}>Modelo</th>
              <th style={{ padding: '8px' }}>Horas / Km Rodados</th>
              <th style={{ padding: '8px' }}>Status</th>
              <th style={{ padding: '8px' }}>Custo Manutenção (R$)</th>
            </tr>
          </thead>
          <tbody>
            {veiculos.length === 0 ? (
              <tr><td colSpan="5" style={{ padding: '10px', textAlign: 'center' }}>Nenhum veículo encontrado.</td></tr>
            ) : (
              veiculos.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px' }}>{row.placa}</td>
                  <td style={{ padding: '8px' }}>{row.modelo}</td>
                  <td style={{ padding: '8px' }}>{row.uso_acumulado}</td>
                  <td style={{ padding: '8px' }}>{row.status}</td>
                  <td style={{ padding: '8px' }}>R$ {Number(row.custo_manutencao || 0).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 6. TABELA DE FATURAMENTO DIRETO */}
      <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ fontSize: '14px', margin: 0 }}>6. Faturamento Direto na Obra</h3>
          <h4 style={{ fontSize: '14px', margin: 0, color: '#16a34a' }}>Total: R$ {totalFaturamento.toFixed(2)}</h4>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#f1f5f9' }}>
              <th style={{ padding: '8px' }}>Nº Pedido / NF</th>
              <th style={{ padding: '8px' }}>Fornecedor</th>
              <th style={{ padding: '8px' }}>Data</th>
              <th style={{ padding: '8px' }}>Valor (R$)</th>
              <th style={{ padding: '8px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {faturamento.length === 0 ? (
              <tr><td colSpan="5" style={{ padding: '10px', textAlign: 'center' }}>Nenhum faturamento registrado.</td></tr>
            ) : (
              faturamento.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px' }}>{row.numero_pedido}</td>
                  <td style={{ padding: '8px' }}>{row.fornecedor}</td>
                  <td style={{ padding: '8px' }}>{row.data}</td>
                  <td style={{ padding: '8px' }}>R$ {Number(row.valor || 0).toFixed(2)}</td>
                  <td style={{ padding: '8px' }}>{row.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}