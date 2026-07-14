import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Users, CheckCircle, XCircle, Calendar, ShieldAlert, Sun } from 'lucide-react'; // Adicionado ícone Sun para folga

export default function HistoricoPresenca({ id, cargo }) {
  const [dadosPresenca, setDadosPresenca] = useState([]);
  const [obras, setObras] = useState([]);
  const [carregando, setCarregando] = useState(false);
  
  // Estados para os Filtros de Obra e Data
  const [idObra, setIdObra] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  //const API_URL = 'http://localhost:3001/api';
const API_URL = 'https://controle-equipes.onrender.com/api'; 

  // 1. Carrega as obras vinculadas ao gestor para alimentar o select do filtro
  useEffect(() => {
    const carregarObrasFiltro = async () => {
      try {
        // 🔍 CORRIGIDO: Removida a rota fantasma e usando a rota unificada /gestor/obras-ativas
        const res = await axios.get(`${API_URL}/gestor/obras-ativas`, {
          // 🔍 CORRIGIDO: Passando 'id' (que veio da prop) para bater com o seu novo Back-end
          params: { 
            id: id, 
            cargo: cargo 
          }
        });
        setObras(res.data || []);
      } catch (e) {
        console.error("Erro ao carregar obras para filtro:", e);
      }
    };
    
    // 💡 Usa a prop 'id' para disparar o carregamento
    if (id) carregarObrasFiltro();
  }, [id, cargo]);

  // 2. Busca o consolidado de presenças aplicando os filtros alinhados com o backend
  const searchConsolidatedDice = useCallback(async () => {
    setCarregando(true);
    try {
      //const response = await axios.get('http://localhost:3001/api/gestor/historico-presenca',
      const response = await axios.get(`${API_URL}/gestor/historico-presenca`, {
        params: { 
          id: id,      // ID do Gestor logado obrigatoriamente
          cargo: cargo,                // Cargo para filtro se necessário
          id_obra: idObra || undefined, // Evita enviar string vazia para o backend
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

  // Recarrega os dados automaticamente quando o componente monta ou qualquer filtro muda
  useEffect(() => {
    if (id) {
      searchConsolidatedDice();
    }
  }, [searchConsolidatedDice, id]);

  const parseTotal = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  };

  // LÓGICA COMPLEMENTAR: Calcula o balanço geral do período para os cards do topo
  const calcularBalançoGeral = () => {
    return dadosPresenca.reduce((acc, p) => {
      acc.alocado += parseTotal(p.total_alocado); // 🌟 Somando total de Alocados
      acc.integracao += parseTotal(p.total_integracao);
      acc.presente += parseTotal(p.total_presente);
      acc.faltou += parseTotal(p.total_faltou);
      acc.folga += parseTotal(p.total_folga); // Adicionado folga na soma
      acc.ferias += parseTotal(p.total_ferias);
      acc.outros += parseTotal(p.total_outro || p.total_outros);
      return acc;
    }, { alocado: 0, integracao: 0, presente: 0, faltou: 0, folga: 0, ferias: 0, outros: 0 });
  };

  const totaisGerais = calcularBalançoGeral();

  return (
    <div style={{ padding: '16px', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      <h2 style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
        📋 Controle de Presença e Efetivo Consolidados
      </h2>
      
      {/* BLOCO DE FILTROS ALINHADOS */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', backgroundColor: '#fff', padding: '14px', borderRadius: '4px', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1', minWidth: '200px' }}>
          <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Filtrar por Obra</label>
          <select 
            value={idObra} 
            onChange={e => setIdObra(e.target.value)}
            style={{ height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', color: '#1e293b', backgroundColor: '#fff', width: '100%' }}
          >
            <option value="">Todas as Obras vinculadas</option>
            {obras.map(o => (
              <option key={o.id} value={o.id}>[{o.codigo_obra}] {o.nome_obra}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '140px' }}>
          <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>Data Início</label>
          <input 
            type="date" 
            value={dataInicio} 
            onChange={e => setDataInicio(e.target.value)}
            style={{ height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', color: '#1e293b' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '140px' }}>
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
            onClick={() => { setIdObra(''); setDataInicio(''); setDataFim(''); }}
            style={{ height: '32px', padding: '0 16px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', display: 'flex', alignItems: 'center' }}
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* DASHBOARD DE TOTAIS ACUMULADOS NO PERÍODO */}
      {!carregando && dadosPresenca.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
          
          <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#f1f5f9', padding: '8px', borderRadius: '4px' }}><Users style={{ width: '18px', color: '#475569' }} /></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>COLABORADORES</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>{dadosPresenca.length}</span>
            </div>
          </div>

          {/* 🌟 NOVO CARD: Total de Alocados no Dashboard (Estilo Ciano/Azul Turquesa) */}
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

          {/* Total de Folgas no Dashboard */}
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
        <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <p style={{ color: '#64748b', fontSize: '12px', fontStyle: 'italic', margin: 0 }}>Buscando dados consolidados de efetivo no banco...</p>
        </div>
      ) : dadosPresenca.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: '11px', padding: '24px', border: '1px dashed #cbd5e1', backgroundColor: '#fff', borderRadius: '4px', textAlign: 'center', margin: 0 }}>
          Nenhum registro de presença encontrado para os filtros selecionados.
        </p>
      ) : (
        <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', color: '#1e293b', fontSize: '11px' }}>
            RELAÇÃO CONSOLIDADA DE DIAS TRABALHADOS POR COLABORADOR
          </div>
          
          <div style={{ overflowX: 'auto', padding: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: '#fff' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '10px', textTransform: 'uppercase', border: '1px solid #cbd5e1' }}>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1' }}>Matrícula</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1' }}>Funcionário</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1' }}>Cargo</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'center', width: '85px' }}>Alocado</th> {/* 🌟 Nova coluna TH de Alocados */}
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'center', width: '85px' }}>Integração</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'center', width: '85px' }}>Presente</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'center', width: '85px' }}>Faltou</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'center', width: '85px' }}>Folga</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'center', width: '85px' }}>Férias</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'center', width: '85px' }}>Outros</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '12px', color: '#334155' }}>
                {dadosPresenca.map((p, index) => (
                  <tr key={`${p.id_funcionario}-${index}`} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#64748b', fontFamily: 'monospace' }}>{p.matricula || '-'}</td>
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#0f172a' }}>{p.nome_funcionario}</td>
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#475569' }}>{p.cargo || '-'}</td>
                    
                    {/* 🌟 Alocado (Azul Claro / Céu) */}
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold', color: '#0284c7', backgroundColor: '#f0f9ff' }}>
                      {p.total_alocado || 0}
                    </td>

                    {/* Integração (Azul) */}
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold', color: '#2563eb', backgroundColor: '#eff6ff' }}>
                      {p.total_integracao || 0}
                    </td>
                    
                    {/* Presente (Verde) */}
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold', color: '#16a34a', backgroundColor: '#f0fdf4' }}>
                      {p.total_presente || 0}
                    </td>
                    
                    {/* Faltou (Vermelho) */}
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold', color: '#dc2626', backgroundColor: '#fef2f2' }}>
                      {p.total_faltou || 0}
                    </td>

                    {/* Folga (Laranja/Amber) */}
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold', color: '#d97706', backgroundColor: '#fffbeb' }}>
                      {p.total_folga || 0}
                    </td>
                    
                    {/* Férias (Roxo) */}
                    <td style={{ padding: '10px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold', color: '#7c3aed', backgroundColor: '#f5f3ff' }}>
                      {p.total_ferias || 0}
                    </td>
                    
                    {/* Outros (Cinza) */}
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