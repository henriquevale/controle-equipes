import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Car, Filter, RefreshCw, FileText, CheckCircle, AlertTriangle, Wrench, Search } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_URL = 'http://localhost:3001/api';

export default function RelatorioVeiculoUsados({ usuarioLogado }) {
  const ehAdminOuRH = ['MASTER', 'RH'].includes(usuarioLogado?.cargo?.toUpperCase());

  // Estados dos Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [idObra, setIdObra] = useState('');
  const [statusVeiculo, setStatusVeiculo] = useState('');
  const [idGestor, setIdGestor] = useState('');
  const [termoBusca, setTermoBusca] = useState('');

  // Listas de Opções
  const [listaObras, setListaObras] = useState([]);
  const [listaGestores, setListaGestores] = useState([]);

  // Resultados
  const [dadosRaw, setDadosRaw] = useState([]);
  const [resumoStatus, setResumoStatus] = useState({});
  const [carregando, setCarregando] = useState(false);

useEffect(() => {
  if (usuarioLogado?.id) {
    carregarFiltrosIniciais();
  }
}, [usuarioLogado]);

const carregarFiltrosIniciais = async () => {
  try {
    if (!usuarioLogado?.id) return;

    // Busca as obras ativas
    const resObras = await axios.get(`${API_URL}/gestor/obras-ativas`, {
      params: { 
        id: usuarioLogado.id, 
        cargo: usuarioLogado.cargo 
      }
    });
    setListaObras(Array.isArray(resObras.data) ? resObras.data : []);

    // Se for MASTER ou RH, busca a lista via rota correta /gestores
    if (ehAdminOuRH) {
      const resGestores = await axios.get(`${API_URL}/gestores`);
      setListaGestores(Array.isArray(resGestores.data) ? resGestores.data : []);
    }
  } catch (error) {
    console.error("Erro ao carregar dados dos filtros:", error);
  }
};

const buscarRelatorio = useCallback(async () => {
  setCarregando(true);
  try {
    const params = {
      data_inicio: dataInicio || undefined,
      data_fim: dataFim || undefined,
      id_obra: idObra || undefined,
      status_veiculo: statusVeiculo || undefined,
      // Se for Admin/RH envia o idGestor selecionado no filtro. Se for GESTOR, o backend vai ignorar e usar o id dele.
      id_gestor: ehAdminOuRH ? (idGestor || undefined) : undefined,
      id: usuarioLogado?.id,
      cargo: usuarioLogado?.cargo
    };

    const response = await axios.get(`${API_URL}/relatorios/veiculos-utilizados`, { params });
    
    setDadosRaw(response.data.detalhes || []);
    setResumoStatus(response.data.resumoStatus || {});
  } catch (error) {
    console.error("Erro ao gerar relatório:", error);
  } finally {
    setCarregando(false);
  }
}, [dataInicio, dataFim, idObra, statusVeiculo, idGestor, ehAdminOuRH, usuarioLogado]);

  useEffect(() => {
    buscarRelatorio();
  }, [buscarRelatorio]);

  // AGRUPAMENTO POR VEÍCULO
  const agruparPorVeiculo = () => {
    const mapa = {};

    dadosRaw.forEach(item => {
      const chave = item.placa || `VEICULO_${item.id_veiculo}` || 'SEM_PLACA';

      if (!mapa[chave]) {
        mapa[chave] = {
          placa: item.placa || 'Sem Placa',
          veiculo: `${item.marca || ''} ${item.modelo || ''}`.trim() || 'Não informado',
          total_apontamentos: 0,
          em_uso: 0,
          disponivel: 0,
          manutencao: 0,
          obras: new Set(),
          condutores: new Set(),
          ult_status: item.status_veiculo || 'N/A',
          ult_data: item.data_diario
        };
      }

      mapa[chave].total_apontamentos += 1;
      
      const st = (item.status_veiculo || '').toUpperCase();
      if (st === 'EM USO') mapa[chave].em_uso += 1;
      else if (st === 'DISPONÍVEL') mapa[chave].disponivel += 1;
      else if (st === 'EM MANUTENÇÃO') mapa[chave].manutencao += 1;

      if (item.nome_obra) mapa[chave].obras.add(item.nome_obra);
      if (item.nome_condutor || item.nome_funcionario) {
        mapa[chave].condutores.add(item.nome_condutor || item.nome_funcionario);
      }
    });

    return Object.values(mapa);
  };

  const listaAgrupada = agruparPorVeiculo();

  // FILTRAGEM LOCAL POR TERMO DE BUSCA (Placa, Modelo ou Condutor)
  const dadosFiltrados = listaAgrupada.filter(v => {
    if (!termoBusca) return true;
    const busca = termoBusca.toLowerCase();
    const buscaPlaca = (v.placa || '').toLowerCase();
    const buscaModelo = (v.veiculo || '').toLowerCase();
    const buscaCondutores = Array.from(v.condutores).join(' ').toLowerCase();

    return buscaPlaca.includes(busca) || buscaModelo.includes(busca) || buscaCondutores.includes(busca);
  });

  const exportarPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text("Relatório Consolidado por Veículo", 14, 15);

    const colunas = ["Placa", "Veículo / Modelo", "Total Uso", "Em Uso", "Disponível", "Manutenção", "Últ. Status", "Obras Atendidas", "Condutores"];
    const linhas = dadosFiltrados.map(item => [
      item.placa,
      item.veiculo,
      item.total_apontamentos,
      item.em_uso,
      item.disponivel,
      item.manutencao,
      item.ult_status,
      Array.from(item.obras).join(', ') || '-',
      Array.from(item.condutores).join(', ') || '-'
    ]);

    autoTable(doc, {
      startY: 22,
      head: [colunas],
      body: linhas,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 8 }
    });

    doc.save(`Relatorio_Consolidado_Veiculos_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div style={{ padding: '16px', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* CABEÇALHO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Car style={{ width: '18px', height: '18px', color: '#2563eb' }} />
          Relatório Consolidado de Veículos
        </h2>

        {dadosFiltrados.length > 0 && (
          <button 
            onClick={exportarPDF}
            style={{ height: '32px', padding: '0 12px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FileText style={{ width: '14px', height: '14px' }} />
            <span>Exportar PDF</span>
          </button>
        )}
      </div>

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', backgroundColor: '#fff', padding: '14px', borderRadius: '4px', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        
        {/* BUSCA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1', minWidth: '200px' }}>
          <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Pesquisar Veículo / Placa</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search style={{ position: 'absolute', left: '8px', width: '14px', height: '14px', color: '#94a3b8' }} />
            <input 
              type="text" 
              placeholder="Buscar por placa, modelo ou motorista..." 
              value={termoBusca} 
              onChange={e => setTermoBusca(e.target.value)}
              style={{ height: '32px', paddingLeft: '28px', paddingRight: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', color: '#1e293b', width: '100%' }}
            />
          </div>
        </div>

        {/* OBRA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1', minWidth: '180px' }}>
          <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Filtrar por Obra</label>
          <select value={idObra} onChange={e => setIdObra(e.target.value)} style={{ height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', color: '#1e293b', backgroundColor: '#fff' }}>
            <option value="">Todas as Obras</option>
            {listaObras.map(o => (
              <option key={o.id} value={o.id}>[{o.codigo_obra || o.id}] {o.nome_obra}</option>
            ))}
          </select>
        </div>

        {/* STATUS VEÍCULO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '140px' }}>
          <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Status Veículo</label>
          <select value={statusVeiculo} onChange={e => setStatusVeiculo(e.target.value)} style={{ height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', color: '#1e293b' }}>
            <option value="">Todos</option>
            <option value="EM USO">EM USO</option>
            <option value="DISPONÍVEL">DISPONÍVEL</option>
            <option value="EM MANUTENÇÃO">EM MANUTENÇÃO</option>
          </select>
        </div>

        {/* DATAS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '120px' }}>
          <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Data Início</label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={{ height: '32px', padding: '0 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '120px' }}>
          <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Data Fim</label>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={{ height: '32px', padding: '0 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }} />
        </div>

        {/* FILTRO GESTOR */}
        {ehAdminOuRH && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '160px' }}>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#1e40af', textTransform: 'uppercase' }}>Gestor</label>
            <select value={idGestor} onChange={e => setIdGestor(e.target.value)} style={{ height: '32px', padding: '0 8px', border: '1px solid #93c5fd', borderRadius: '4px', fontSize: '11px', backgroundColor: '#eff6ff' }}>
              <option value="">Todos</option>
              {listaGestores.map(g => (
                <option key={g.id} value={g.id}>{g.nome}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
          <button onClick={buscarRelatorio} disabled={carregando} style={{ height: '32px', padding: '0 12px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <RefreshCw style={{ width: '13px', height: '13px' }} />
            <span>{carregando ? '...' : 'Filtrar'}</span>
          </button>
          <button onClick={() => { setDataInicio(''); setDataFim(''); setIdObra(''); setStatusVeiculo(''); setIdGestor(''); setTermoBusca(''); }} style={{ height: '32px', padding: '0 12px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
            Limpar
          </button>
        </div>
      </div>

      {/* DASHBOARD KPI */}
      {!carregando && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#f1f5f9', padding: '8px', borderRadius: '4px' }}><Car style={{ width: '18px', color: '#475569' }} /></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>VEÍCULOS DISTINTOS</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>{dadosFiltrados.length}</span>
            </div>
          </div>

          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#fef9c3', padding: '8px', borderRadius: '4px' }}><AlertTriangle style={{ width: '18px', color: '#a16207' }} /></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', color: '#854d0e', fontWeight: 'bold' }}>APONT. EM USO</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#713f12' }}>{resumoStatus['EM USO'] || 0}</span>
            </div>
          </div>

          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#f0fdf4', padding: '8px', borderRadius: '4px' }}><CheckCircle style={{ width: '18px', color: '#16a34a' }} /></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', color: '#166534', fontWeight: 'bold' }}>DISPONÍVEIS</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#14532d' }}>{resumoStatus['DISPONÍVEL'] || 0}</span>
            </div>
          </div>

          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#fef2f2', padding: '8px', borderRadius: '4px' }}><Wrench style={{ width: '18px', color: '#dc2626' }} /></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', color: '#991b1b', fontWeight: 'bold' }}>EM MANUTENÇÃO</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#7f1d1d' }}>{resumoStatus['EM MANUTENÇÃO'] || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* TABELA CONSOLIDADA POR VEÍCULO */}
      {carregando ? (
        <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '24px', textAlign: 'center' }}>
          <p style={{ color: '#64748b', fontSize: '12px', fontStyle: 'italic', margin: 0 }}>Carregando dados dos veículos...</p>
        </div>
      ) : dadosFiltrados.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: '11px', padding: '24px', border: '1px dashed #cbd5e1', backgroundColor: '#fff', borderRadius: '4px', textAlign: 'center', margin: 0 }}>
          Nenhum registro de veículo encontrado.
        </p>
      ) : (
        <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', color: '#1e293b', fontSize: '11px' }}>
            RELAÇÃO CONSOLIDADA POR VEÍCULO ({dadosFiltrados.length})
          </div>

          <div style={{ overflowX: 'auto', padding: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: '#fff' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '10px', textTransform: 'uppercase', border: '1px solid #cbd5e1' }}>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1' }}>Placa</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1' }}>Veículo / Modelo</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>Total Registro</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>Em Uso</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>Disponível</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>Manutenção</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1' }}>Obras Atendidas</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1' }}>Motoristas / Responsáveis</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '12px', color: '#334155' }}>
                {dadosFiltrados.map((v, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#0f172a', fontFamily: 'monospace' }}>
                      {v.placa}
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#1e293b' }}>
                      {v.veiculo}
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold', backgroundColor: '#f1f5f9' }}>
                      {v.total_apontamentos}
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold', color: '#854d0e', backgroundColor: '#fef9c3' }}>
                      {v.em_uso}
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold', color: '#166534', backgroundColor: '#f0fdf4' }}>
                      {v.disponivel}
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold', color: '#991b1b', backgroundColor: '#fef2f2' }}>
                      {v.manutencao}
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#475569', fontSize: '11px' }}>
                      {Array.from(v.obras).join(', ') || '-'}
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#475569', fontSize: '11px' }}>
                      {Array.from(v.condutores).join(', ') || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}