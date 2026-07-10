import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Calendar, Edit2, X, Check, FileText, Send, Inbox, Database, BarChart3, Clock, Milestone, Layers3 } from 'lucide-react';

export default function RhIntegracao({ API_URL, mostrarMensagemGlobal, recarregarFuncionariosGeral }) {
  const [listaIntegracoes, setListaIntegracoes] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [filtroEtapa, setFiltroEtapa] = useState('TODOS');

  // Estado para controlar qual funcionário está sendo editado na linha
  const [idFuncionarioEmEdicao, setIdFuncionarioEmEdicao] = useState(null);
  
  // ESTADO ISOLADO: Guarda temporariamente os dados digitados antes de salvar
  const [dadosEdicao, setDadosEdicao] = useState(null);

  const carregarEsteira = async () => {
    setCarregando(true);
    try {
      const res = await axios.get(`${API_URL}/rh/integracoes-pendentes`);
      setListaIntegracoes(res.data || []);
    } catch (e) {
      console.error("Erro ao carregar esteira de integração:", e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarEsteira();
  }, []);

  const formatarParaInput = (dataBanco) => {
    if (!dataBanco) return '';
    return dataBanco.split('T')[0];
  };

  // Ativa o modo de edição clonando os dados reais para o estado temporário
  const iniciarEdicao = (funcionario) => {
    setIdFuncionarioEmEdicao(funcionario.id);
    setDadosEdicao({ ...funcionario });
  };

  // Cancelar limpa os estados temporários sem mexer na lista principal
  const cancelarEdicao = () => {
    setIdFuncionarioEmEdicao(null);
    setDadosEdicao(null);
  };

  // ========================================================
  // REGRAS DE ALTERAÇÃO DE DATA COM VALIDAÇÃO CRONOLÓGICA (NO TEMP)
  // ========================================================
  const handleDataTabelaChange = (campo, valor) => {
    if (!valor) {
      setDadosEdicao(prev => ({ ...prev, [campo]: valor }));
      return;
    }

    // Compara puramente o texto 'YYYY-MM-DD' para evitar problemas com fuso horário
    const novaDataStr = valor; 
    const ordemEtapas = [
      'data_documentos_sst',
      'data_enviados',
      'data_recebidos',
      'data_postado_bex',
      'data_analise',
      'data_integracao_agendada',
      'data_integracao'
    ];

    const indexAtual = ordemEtapas.indexOf(campo);

    if (indexAtual > 0) {
      const campoAnterior = ordemEtapas[indexAtual - 1];
      const dataAnteriorRaw = dadosEdicao[campoAnterior];
      if (dataAnteriorRaw) {
        const dataAnteriorStr = formatarParaInput(dataAnteriorRaw);
        // Permite datas iguais! Só barra se a nova data for estritamente menor que a anterior
        if (novaDataStr < dataAnteriorStr) {
          alert(`Aviso: Esta data não pode ser inferior ao passo anterior (${dataAnteriorStr}).`);
          return;
        }
      }
    }

    if (indexAtual < ordemEtapas.length - 1) {
      const campoProximo = ordemEtapas[indexAtual + 1];
      const dataProximaRaw = dadosEdicao[campoProximo];
      if (dataProximaRaw) {
        const dataProximaStr = formatarParaInput(dataProximaRaw);
        // Permite datas iguais! Só barra se a nova data for estritamente maior que a próxima
        if (novaDataStr > dataProximaStr) {
          alert(`Aviso: Esta data não pode ser superior ao próximo passo já preenchido (${dataProximaStr}).`);
          return;
        }
      }
    }

    // Altera apenas no estado de rascunho temporário
    setDadosEdicao(prev => ({ ...prev, [campo]: valor }));
  };

  const salvarLinhaCronologia = async () => {
    if (!dadosEdicao) return;

    try {
      const res = await axios.put(`${API_URL}/rh/funcionarios/${dadosEdicao.id}/integracao`, {
        data_documentos_sst: dadosEdicao.data_documentos_sst,
        data_enviados: dadosEdicao.data_enviados,
        data_recebidos: dadosEdicao.data_recebidos,
        data_postado_bex: dadosEdicao.data_postado_bex,
        data_analise: dadosEdicao.data_analise,
        data_integracao_agendada: dadosEdicao.data_integracao_agendada,
        data_integracao: dadosEdicao.data_integracao
      });

      if (res.data.success) {
        if (mostrarMensagemGlobal) mostrarMensagemGlobal(res.data.message, 'sucesso');
        else alert(res.data.message);
        
        // Só agora que salvou com sucesso nós limpamos a edição e atualizamos os filtros!
        setIdFuncionarioEmEdicao(null);
        setDadosEdicao(null);
        carregarEsteira();
        if (recarregarFuncionariosGeral) recarregarFuncionariosGeral();
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar as alterações de cronologia.");
    }
  };

  // ========================================================
  // CONTADORES E FILTROS DO PAINEL SUPERIOR (Sempre baseados no Banco original)
  // ========================================================
  const contadores = {
    TODOS: listaIntegracoes.length,
    DOC_SST: listaIntegracoes.filter(f => !f.data_documentos_sst).length,
    ENVIADOS: listaIntegracoes.filter(f => f.data_documentos_sst && !f.data_enviados).length,
    RECEBIDOS: listaIntegracoes.filter(f => f.data_enviados && !f.data_recebidos).length,
    NA_BEX: listaIntegracoes.filter(f => f.data_recebidos && !f.data_postado_bex).length,
    ANALISE: listaIntegracoes.filter(f => f.data_postado_bex && !f.data_analise).length,
    AGENDADA: listaIntegracoes.filter(f => f.data_analise && !f.data_integracao_agendada).length,
    INTEGRACAO: listaIntegracoes.filter(f => f.data_integracao_agendada && !f.data_integracao).length,
  };

  const listaFiltrada = listaIntegracoes.filter(f => {
    if (filtroEtapa === 'TODOS') return true;
    if (filtroEtapa === 'DOC_SST') return !f.data_documentos_sst;
    if (filtroEtapa === 'ENVIADOS') return f.data_documentos_sst && !f.data_enviados;
    if (filtroEtapa === 'RECEBIDOS') return f.data_enviados && !f.data_recebidos;
    if (filtroEtapa === 'NA_BEX') return f.data_recebidos && !f.data_postado_bex;
    if (filtroEtapa === 'ANALISE') return f.data_postado_bex && !f.data_analise;
    if (filtroEtapa === 'AGENDADA') return f.data_analise && !f.data_integracao_agendada;
    if (filtroEtapa === 'INTEGRACAO') return f.data_integracao_agendada && !f.data_integracao;
    return true;
  });

  const estiloCardContador = (chave) => ({
    flex: '1 1 auto', minWidth: '105px', padding: '10px 14px', borderRadius: '8px',
    backgroundColor: filtroEtapa === chave ? '#2563eb' : '#fff',
    color: filtroEtapa === chave ? '#fff' : '#475569',
    border: filtroEtapa === chave ? '1px solid #2563eb' : '1px solid #e2e8f0',
    cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s ease',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'
  });

  const estiloInputTabela = (disabled, isCritico = false) => ({
    fontSize: '11px', padding: '3px 4px', borderRadius: '4px', width: '115px',
    border: isCritico ? '1px solid #93c5fd' : '1px solid #e2e8f0',
    backgroundColor: disabled ? '#f8fafc' : '#fff', 
    color: disabled ? '#64748b' : '#334155',
    cursor: disabled ? 'not-allowed' : 'auto',
    opacity: disabled ? 0.8 : 1, fontWeight: (isCritico && !disabled) ? 'bold' : 'normal'
  });

  if (carregando) return <div style={{ fontSize: '12px', padding: '10px' }}>Carregando esteira...</div>;

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px' }}>
        <Layers3 style={{ color: '#2563eb', width: '18px', height: '18px' }} />
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', color: '#1e293b' }}>
          Esteira de Integração de Funcionários (Acompanhamento Diário)
        </h3>
      </div>

      {/* Painel de Contadores de Monitoramento */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
        <div onClick={() => setFiltroEtapa('TODOS')} style={estiloCardContador('TODOS')}>
          <Layers3 size={14} /> <div style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase' }}>Todos</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{contadores.TODOS}</div>
        </div>
        <div onClick={() => setFiltroEtapa('DOC_SST')} style={estiloCardContador('DOC_SST')}>
          <FileText size={14} /> <div style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase' }}>1. Doc SST</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{contadores.DOC_SST}</div>
        </div>
        <div onClick={() => setFiltroEtapa('ENVIADOS')} style={estiloCardContador('ENVIADOS')}>
          <Send size={14} /> <div style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase' }}>2. Enviados</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{contadores.ENVIADOS}</div>
        </div>
        <div onClick={() => setFiltroEtapa('RECEBIDOS')} style={estiloCardContador('RECEBIDOS')}>
          <Inbox size={14} /> <div style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase' }}>3. Recebidos</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{contadores.RECEBIDOS}</div>
        </div>
        <div onClick={() => setFiltroEtapa('NA_BEX')} style={estiloCardContador('NA_BEX')}>
          <Database size={14} /> <div style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase' }}>4. Na BEX</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{contadores.NA_BEX}</div>
        </div>
        <div onClick={() => setFiltroEtapa('ANALISE')} style={estiloCardContador('ANALISE')}>
          <BarChart3 size={14} /> <div style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase' }}>5. Análise</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{contadores.ANALISE}</div>
        </div>
        <div onClick={() => setFiltroEtapa('AGENDADA')} style={estiloCardContador('AGENDADA')}>
          <Clock size={14} /> <div style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase' }}>6. Agendada</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{contadores.AGENDADA}</div>
        </div>
        <div onClick={() => setFiltroEtapa('INTEGRACAO')} style={estiloCardContador('INTEGRACAO')}>
          <Milestone size={14} /> <div style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase' }}>7. Integração</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{contadores.INTEGRACAO}</div>
        </div>
      </div>

      {/* Tabela Principal de Movimentação */}
      {listaFiltrada.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '12px', backgroundColor: '#f8fafc', borderRadius: '4px' }}>
          Nenhum funcionário parado nesta etapa da esteira.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', color: '#fff' }}>
                <th style={{ padding: '10px 8px', border: '1px solid #334155' }}>Funcionário / Matrícula</th>
                <th style={{ padding: '10px 8px', border: '1px solid #334155' }}>1. Doc SST</th>
                <th style={{ padding: '10px 8px', border: '1px solid #334155' }}>2. Enviados</th>
                <th style={{ padding: '10px 8px', border: '1px solid #334155' }}>3. Recebidos</th>
                <th style={{ padding: '10px 8px', border: '1px solid #334155' }}>4. Na BEX</th>
                <th style={{ padding: '10px 8px', border: '1px solid #334155' }}>5. Análise</th>
                <th style={{ padding: '10px 8px', border: '1px solid #334155' }}>6. Agendada</th>
                <th style={{ padding: '10px 8px', border: '1px solid #334155', backgroundColor: '#1e3a8a' }}>7. Integração</th>
                <th style={{ padding: '10px 8px', border: '1px solid #334155', textAlign: 'center' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map((func) => {
                const modoEdicaoAtivo = func.id === idFuncionarioEmEdicao;
                
                // Se estiver editando, lê do objeto temporário "dadosEdicao", senão puxa do item original "func"
                const itemExibido = modoEdicaoAtivo ? dadosEdicao : func;

                const disabled2 = !modoEdicaoAtivo || !itemExibido.data_documentos_sst;
                const disabled3 = !modoEdicaoAtivo || !itemExibido.data_enviados;
                const disabled4 = !modoEdicaoAtivo || !itemExibido.data_recebidos;
                const disabled5 = !modoEdicaoAtivo || !itemExibido.data_postado_bex;
                const disabled6 = !modoEdicaoAtivo || !itemExibido.data_analise;
                const disabled7 = !modoEdicaoAtivo || !itemExibido.data_integracao_agendada;

                return (
                  <tr key={func.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: modoEdicaoAtivo ? '#eff6ff' : '#fff' }}>
                    <td style={{ padding: '8px 6px', color: '#334155', fontWeight: 'bold', borderLeft: modoEdicaoAtivo ? '3px solid #2563eb' : 'none' }}>
                      {func.nome} <br />
                      <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'normal' }}>Matrícula: {func.matricula}</span>
                    </td>
                    
                    <td style={{ padding: '4px' }}><input type="date" disabled={!modoEdicaoAtivo} value={formatarParaInput(itemExibido.data_documentos_sst)} onChange={e => handleDataTabelaChange('data_documentos_sst', e.target.value)} style={estiloInputTabela(!modoEdicaoAtivo)} /></td>
                    <td style={{ padding: '4px' }}><input type="date" disabled={disabled2} value={formatarParaInput(itemExibido.data_enviados)} onChange={e => handleDataTabelaChange('data_enviados', e.target.value)} style={estiloInputTabela(disabled2)} /></td>
                    <td style={{ padding: '4px' }}><input type="date" disabled={disabled3} value={formatarParaInput(itemExibido.data_recebidos)} onChange={e => handleDataTabelaChange('data_recebidos', e.target.value)} style={estiloInputTabela(disabled3)} /></td>
                    <td style={{ padding: '4px' }}><input type="date" disabled={disabled4} value={formatarParaInput(itemExibido.data_postado_bex)} onChange={e => handleDataTabelaChange('data_postado_bex', e.target.value)} style={estiloInputTabela(disabled4)} /></td>
                    <td style={{ padding: '4px' }}><input type="date" disabled={disabled5} value={formatarParaInput(itemExibido.data_analise)} onChange={e => handleDataTabelaChange('data_analise', e.target.value)} style={estiloInputTabela(disabled5)} /></td>
                    <td style={{ padding: '4px' }}><input type="date" disabled={disabled6} value={formatarParaInput(itemExibido.data_integracao_agendada)} onChange={e => handleDataTabelaChange('data_integracao_agendada', e.target.value)} style={estiloInputTabela(disabled6)} /></td>
                    <td style={{ padding: '4px', backgroundColor: modoEdicaoAtivo ? '#dbeafe' : '#eff6ff' }}><input type="date" disabled={disabled7} value={formatarParaInput(itemExibido.data_integracao)} style={estiloInputTabela(disabled7, true)} onChange={e => handleDataTabelaChange('data_integracao', e.target.value)} /></td>

                    <td style={{ padding: '4px', textAlign: 'center' }}>
                      {!modoEdicaoAtivo ? (
                        <button 
                          onClick={() => iniciarEdicao(func)} 
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '10px' }}
                        >
                          <Edit2 size={11} /> Editar Cronologia
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button onClick={salvarLinhaCronologia} style={{ padding: '5px 8px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }} title="Salvar Alterações">
                            <Check size={14}/>
                          </button>
                          <button onClick={cancelarEdicao} style={{ padding: '5px 8px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }} title="Cancelar/Zerar">
                            <X size={14}/>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}