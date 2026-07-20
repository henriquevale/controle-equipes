import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Users, CheckCircle, XCircle, Calendar, Sun, Search, Download } from 'lucide-react';

export default function HistoricoPresenca({ id, cargo }) {
  const [dadosPresenca, setDadosPresenca] = useState([]);
  const [obras, setObras] = useState([]);
  const [carregando, setCarregando] = useState(false);
  
  // Estados para os Filtros de Obra, Data e Busca por Nome
  const [idObra, setIdObra] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [termoBusca, setTermoBusca] = useState('');

  const API_URL = 'https://controle-equipes.onrender.com/api'; 

  // 1. Carrega as obras vinculadas ao gestor/RH/Master
  useEffect(() => {
    const carregarObrasFiltro = async () => {
      try {
        const res = await axios.get(`${API_URL}/gestor/obras-ativas`, {
          params: { id, cargo }
        });
        setObras(res.data || []);
      } catch (e) {
        console.error("Erro ao carregar obras para filtro:", e);
      }
    };
    if (id) carregarObrasFiltro();
  }, [id, cargo]);

  // 2. Busca o consolidado de presenças
  const searchConsolidatedDice = useCallback(async () => {
    setCarregando(true);
    try {
      const response = await axios.get(`${API_URL}/gestor/historico-presenca`, {
        params: { 
          id: id,
          cargo: cargo,
          id_obra: idObra || undefined,
          data_inicio: dataInicio || undefined,
          data_fim: dataFim || undefined,
        }
      });
      setDadosPresenca(response.data || []);
    } catch (erro) {
      console.error("Erro ao buscar dados consolidado de presença:", erro);
    } finally {
      setCarregando(false);
    }
  }, [id, cargo, idObra, dataInicio, dataFim]);

  useEffect(() => {
    if (id) {
      searchConsolidatedDice();
    }
  }, [searchConsolidatedDice, id]);

  const parseTotal = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  };

  // 3. Filtragem local pelo nome do funcionário ou matrícula
  const dadosFiltrados = dadosPresenca.filter(p => {
    const busca = termoBusca.toLowerCase().trim();
    if (!busca) return true;
    const nome = (p.nome_funcionario || '').toLowerCase();
    const matricula = (p.matricula || '').toLowerCase();
    return nome.includes(busca) || matricula.includes(busca);
  });

  // 4. Balanço geral calculado sobre os dados filtrados
  const calcularBalançoGeral = () => {
    return dadosFiltrados.reduce((acc, p) => {
      acc.alocado += parseTotal(p.total_alocado);
      acc.integracao += parseTotal(p.total_integracao);
      acc.presente += parseTotal(p.total_presente);
      acc.faltou += parseTotal(p.total_faltou);
      acc.folga += parseTotal(p.total_folga);
      acc.ferias += parseTotal(p.total_ferias);
      acc.outros += parseTotal(p.total_outro || p.total_outros);
      return acc;
    }, { alocado: 0, integracao: 0, presente: 0, faltou: 0, folga: 0, ferias: 0, outros: 0 });
  };

  const totaisGerais = calcularBalançoGeral();

  // 5. Função para exportar/fazer download do CSV para Excel
  const exportarParaCSV = () => {
    if (dadosFiltrados.length === 0) return;

    const cabecalho = ["Matricula", "Funcionario", "Cargo", "Alocado", "Integracao", "Presente", "Faltou", "Folga", "Ferias", "Outros"];
    
    const linhas = dadosFiltrados.map(p => [
      `"${p.matricula || ''}"`,
      `"${p.nome_funcionario || ''}"`,
      `"${p.cargo || ''}"`,
      p.total_alocado || 0,
      p.total_integracao || 0,
      p.total_presente || 0,
      p.total_faltou || 0,
      p.total_folga || 0,
      p.total_ferias || 0,
      p.total_outro || p.total_outros || 0
    ]);

    const conteudoCSV = "\uFEFF" + [cabecalho.join(";"), ...linhas.map(e => e.join(";"))].join("\n");
    const blob = new Blob([conteudoCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Historico_Presenca_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: '16px', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
          📋 Controle de Presença e Efetivo Consolidados
        </h2>

        {/* Botão de Download */}
        <button 
          onClick={exportarParaCSV}
          disabled={dadosFiltrados.length === 0}
          style={{ 
            height: '32px', 
            padding: '0 12px', 
            backgroundColor: dadosFiltrados.length === 0 ? '#94a3b8' : '#16a34a', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '4px', 
            fontSize: '11px', 
            fontWeight: 'bold', 
            cursor: dadosFiltrados.length === 0 ? 'not-allowed' : 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px' 
          }}
        >
          <Download style={{ width: '14px', height: '14px' }} />
          <span>Exportar Relatório</span>
        </button>
      </div>
      
      {/* BLOCO DE FILTROS ALINHADOS */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', backgroundColor: '#fff', padding: '14px', borderRadius: '4px', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        
        {/* Campo de Busca por Nome ou Matrícula */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1', minWidth: '200px' }}>
          <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Pesquisar Colaborador</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search style={{ position: 'absolute', left: '8px', width: '14px', height: '14px', color: '#94a3b8' }} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou matrícula..." 
              value={termoBusca} 
              onChange={e => setTermoBusca(e.target.value)}
              style={{ height: '32px', paddingLeft: '28px', paddingRight: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', color: '#1e293b', width: '100%' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1', minWidth: '200px' }}>
          <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Filtrar por Obra</label>
          <select 
            value={idObra} 
            onChange={e => setIdObra(e.target.value)}
            style={{ height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', color: '#1e293b', backgroundColor: '#fff', width: '100%' }}
          >
            <option value="">
              {cargo === 'MASTER' || cargo === 'RH' ? 'Todas as Obras (Geral)' : 'Todas as Obras vinculadas'}
            </option>
            {obras.map(o => (
              <option key={o.id} value={o.id}>[{o.codigo_obra}] {o.nome_obra}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '130px' }}>
          <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Data Início</label>
          <input 
            type="date" 
            value={dataInicio} 
            onChange={e => setDataInicio(e.target.value)}
            style={{ height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', color: '#1e293b' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '130px' }}>
          <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Data Fim</label>
          <input 
            type="date" 
            value={dataFim} 
            onChange={e => setDataFim(e.target.value)}
            style={{ height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', color: '#1e293b' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button 
            onClick={() => { setIdObra(''); setDataInicio(''); setDataFim(''); setTermoBusca(''); }}
            style={{ height: '32px', padding: '0 16px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase' }}
          >
            Limpar
          </button>
        </div>
      </div>

      {/* DASHBOARD DE TOTAIS ACUMULADOS */}
      {!carregando && dadosFiltrados.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
          
          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#f1f5f9', padding: '8px', borderRadius: '4px' }}><Users style={{ width: '18px', color: '#475569' }} /></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>COLABORADORES</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>{dadosFiltrados.length}</span>
            </div>
          </div>

          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#e0f2fe', padding: '8px', borderRadius: '4px' }}><Calendar style={{ width: '18px', color: '#0369a1' }} /></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', color: '#0369a1', fontWeight: 'bold' }}>TOT. ALOCADOS</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#0c4a6e' }}>{totaisGerais.alocado}</span>
            </div>
          </div>

          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#f0fdf4', padding: '8px', borderRadius: '4px' }}><CheckCircle style={{ width: '18px', color: '#16a34a' }} /></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', color: '#166534', fontWeight: 'bold' }}>TOT. PRESENÇAS</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#14532d' }}>{totaisGerais.presente}</span>
            </div>
          </div>

          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#fef2f2', padding: '8px', borderRadius: '4px' }}><XCircle style={{ width: '18px', color: '#dc2626' }} /></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', color: '#991b1b', fontWeight: 'bold' }}>TOT. FALTAS</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#7f1d1d' }}>{totaisGerais.faltou}</span>
            </div>
          </div>

          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#fffbeb', padding: '8px', borderRadius: '4px' }}><Sun style={{ width: '18px', color: '#d97706' }} /></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', color: '#92400e', fontWeight: 'bold' }}>TOT. FOLGAS</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#78350f' }}>{totaisGerais.folga}</span>
            </div>
          </div>

          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#eff6ff', padding: '8px', borderRadius: '4px' }}><Users style={{ width: '18px', color: '#2563eb' }} /></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', color: '#1e40af', fontWeight: 'bold' }}>INTEGRAÇÕES</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e3a8a' }}>{totaisGerais.integracao}</span>
            </div>
          </div>

          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#f5f3ff', padding: '8px', borderRadius: '4px' }}><Calendar style={{ width: '18px', color: '#7c3aed' }} /></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', color: '#5b21b6', fontWeight: 'bold' }}>FÉRIAS / AFAST.</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#4c1d95' }}>{totaisGerais.ferias + totaisGerais.outros}</span>
            </div>
          </div>

        </div>
      )}

      {/* TABELA DE DADOS CONSOLIDADOS */}
      {carregando ? (
        <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '24px', textAlign: 'center' }}>
          <p style={{ color: '#64748b', fontSize: '12px', fontStyle: 'italic', margin: 0 }}>Buscando dados consolidados de efetivo no banco...</p>
        </div>
      ) : dadosFiltrados.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: '11px', padding: '24px', border: '1px dashed #cbd5e1', backgroundColor: '#fff', borderRadius: '4px', textAlign: 'center', margin: 0 }}>
          Nenhum registro de presença encontrado para os filtros selecionados.
        </p>
      ) : (
        <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', color: '#1e293b', fontSize: '11px' }}>
            RELAÇÃO CONSOLIDADA DE DIAS TRABALHADOS POR COLABORADOR ({dadosFiltrados.length})
          </div>
          
          <div style={{ overflowX: 'auto', padding: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: '#fff' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '10px', textTransform: 'uppercase', border: '1px solid #cbd5e1' }}>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1' }}>Matrícula</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1' }}>Funcionário</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1' }}>Cargo</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'center', width: '85px' }}>Alocado</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'center', width: '85px' }}>Integração</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'center', width: '85px' }}>Presente</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'center', width: '85px' }}>Faltou</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'center', width: '85px' }}>Folga</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'center', width: '85px' }}>Férias</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'center', width: '85px' }}>Outros</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '12px', color: '#334155' }}>
                {dadosFiltrados.map((p, index) => (
                  <tr key={`${p.id_funcionario}-${index}`} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#64748b', fontFamily: 'monospace' }}>{p.matricula || '-'}</td>
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#0f172a' }}>{p.nome_funcionario}</td>
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#475569' }}>{p.cargo || '-'}</td>
                    
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold', color: '#0284c7', backgroundColor: '#f0f9ff' }}>
                      {p.total_alocado || 0}
                    </td>

                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold', color: '#2563eb', backgroundColor: '#eff6ff' }}>
                      {p.total_integracao || 0}
                    </td>
                    
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold', color: '#16a34a', backgroundColor: '#f0fdf4' }}>
                      {p.total_presente || 0}
                    </td>
                    
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold', color: '#dc2626', backgroundColor: '#fef2f2' }}>
                      {p.total_faltou || 0}
                    </td>

                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold', color: '#d97706', backgroundColor: '#fffbeb' }}>
                      {p.total_folga || 0}
                    </td>
                    
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold', color: '#7c3aed', backgroundColor: '#f5f3ff' }}>
                      {p.total_ferias || 0}
                    </td>
                    
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold', color: '#4b5563', backgroundColor: '#f9fafb' }}>
                      {p.total_outro || p.total_outros || 0}
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