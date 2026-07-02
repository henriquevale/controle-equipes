import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, Edit3, UserPlus, Users, RefreshCw, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export default function RecursosHumanos({ listaFuncionarios, recarregarFuncionariosGlobal, API_URL, mostrarMensagemGlobal }) {
  const [funcionarioEmEdicao, setFuncionarioEmEdicao] = useState(null);
  const [formData, setFormData] = useState({ nome: '', matricula: '', cargo: '', ativo: 'ATIVO' });
  
  // Estado para controlar o filtro selecionado ('TODOS', 'ATIVO', 'INATIVO', 'INTEGRAÇÃO PENDENTE')
  const [filtroStatus, setFiltroStatus] = useState('TODOS');

  useEffect(() => {
    if (funcionarioEmEdicao) {
      setFormData({
        nome: funcionarioEmEdicao.nome || '',
        matricula: funcionarioEmEdicao.matricula || '',
        cargo: funcionarioEmEdicao.cargo || '',
        ativo: funcionarioEmEdicao.ativo || 'ATIVO'
      });
    } else {
      setFormData({ nome: '', matricula: '', cargo: '', ativo: 'ATIVO' });
    }
  }, [funcionarioEmEdicao]);

  // CÁLCULO DOS TOTAIS (Garante tratamento caso a lista não esteja inicializada como array)
  const safeLista = Array.isArray(listaFuncionarios) ? listaFuncionarios : [];
  const totalGeral = safeLista.length;
  const totalAtivos = safeLista.filter(f => f.ativo === 'ATIVO').length;
  const totalInativos = safeLista.filter(f => f.ativo === 'INATIVO').length;
  const totalPendentes = safeLista.filter(f => f.ativo === 'INTEGRAÇÃO PENDENTE').length;

  // BLINDAGEM: Filtra os funcionários garantindo comparações limpas de string
  const funcionariosFiltrados = safeLista.filter(func => {
    if (filtroStatus === 'TODOS') return true;
    return String(func.ativo).trim().toUpperCase() === String(filtroStatus).trim().toUpperCase();
  });

  const lidarComEnvio = async (e) => {
    e.preventDefault();
    if (!formData.nome || !formData.matricula || !formData.cargo || !formData.ativo) {
      mostrarMensagemGlobal('Por favor, preencha todos os campos!', 'erro');
      return;
    }

    try {
      if (funcionarioEmEdicao) {
        // CORRIGIDO: Alterado de axiosOriginal para axios
        await axios.put(`${API_URL}/rh/funcionarios/${funcionarioEmEdicao.id}`, formData);
        mostrarMensagemGlobal('Funcionário atualizado com sucesso!', 'sucesso');
        setFuncionarioEmEdicao(null);
      }
      
      setFormData({ nome: '', matricula: '', cargo: '', ativo: 'ATIVO' });
      recarregarFuncionariosGlobal();
    } catch (err) {
      console.group("❌ DETALHES DO ERRO NA API (RH)");
      console.error("Erro bruto do Javascript:", err);
      console.error("Status do Erro:", err.response?.status);
      console.error("URL afetada:", err.config?.url);
      console.error("Resposta interna:", err.response?.data);
      console.groupEnd();

      mostrarMensagemGlobal(err.response?.data?.error || 'Erro ao processar requisição dos funcionários.', 'erro');
    }
  };

  const deletarFuncionario = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir permanentemente este funcionário? Isso pode afetar os vínculos ativos.")) return;
    
    try {
      // CORRIGIDO: Alterado de axiosOriginal para axios
      await axios.delete(`${API_URL}/rh/funcionarios/${id}`);
      mostrarMensagemGlobal('Funcionário removido com sucesso!', 'sucesso');
      if (funcionarioEmEdicao?.id === id) setFuncionarioEmEdicao(null);
      recarregarFuncionariosGlobal();
    } catch (err) {
      console.error("Erro ao deletar colaborador:", err);
      mostrarMensagemGlobal('Erro ao tentar remover o funcionário do banco de dados.', 'erro');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', boxSizing: 'border-box' }}>
      
      {/* 📊 SEÇÃO DE CARDS MÉTRICOS COM FILTRO EMBUTIDO */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', width: '100%' }}>
        
        {/* Card Todos */}
        <div 
          onClick={() => setFiltroStatus('TODOS')}
          style={{ 
            backgroundColor: '#fff', border: `2px solid ${filtroStatus === 'TODOS' ? '#1e293b' : '#e2e8f0'}`, 
            borderRadius: '4px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
            cursor: 'pointer', transition: 'all 0.2s', boxShadow: filtroStatus === 'TODOS' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Todos</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e293b', marginTop: '4px' }}>{totalGeral}</div>
          </div>
          <Users style={{ width: '28px', height: '28px', color: '#94a3b8' }} />
        </div>

        {/* Card Ativos */}
        <div 
          onClick={() => setFiltroStatus('ATIVO')}
          style={{ 
            backgroundColor: '#fff', border: `2px solid ${filtroStatus === 'ATIVO' ? '#15803d' : '#e2e8f0'}`, 
            borderRadius: '4px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
            cursor: 'pointer', transition: 'all 0.2s', boxShadow: filtroStatus === 'ATIVO' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#16a34a', textTransform: 'uppercase' }}>Ativos</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#15803d', marginTop: '4px' }}>{totalAtivos}</div>
          </div>
          <CheckCircle2 style={{ width: '28px', height: '28px', color: '#bbf7d0' }} />
        </div>

        {/* Card Inativos */}
        <div 
          onClick={() => setFiltroStatus('INATIVO')}
          style={{ 
            backgroundColor: '#fff', border: `2px solid ${filtroStatus === 'INATIVO' ? '#b91c1c' : '#e2e8f0'}`, 
            borderRadius: '4px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
            cursor: 'pointer', transition: 'all 0.2s', boxShadow: filtroStatus === 'INATIVO' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#dc2626', textTransform: 'uppercase' }}>Inativos</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#b91c1c', marginTop: '4px' }}>{totalInativos}</div>
          </div>
          <XCircle style={{ width: '28px', height: '28px', color: '#fecdd3' }} />
        </div>

        {/* Card Integração Pendente */}
        <div 
          onClick={() => setFiltroStatus('INTEGRAÇÃO PENDENTE')}
          style={{ 
            backgroundColor: '#fff', border: `2px solid ${filtroStatus === 'INTEGRAÇÃO PENDENTE' ? '#b45309' : '#e2e8f0'}`, 
            borderRadius: '4px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
            cursor: 'pointer', transition: 'all 0.2s', boxShadow: filtroStatus === 'INTEGRAÇÃO PENDENTE' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#d97706', textTransform: 'uppercase' }}>Int. Pendente</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#b45309', marginTop: '4px' }}>{totalPendentes}</div>
          </div>
          <AlertCircle style={{ width: '28px', height: '28px', color: '#fef3c7' }} />
        </div>

      </div>

      {/* 1. FORMULÁRIO EXIBIDO APENAS EM MODO DE EDIÇÃO */}
      {funcionarioEmEdicao && (
        <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            <RefreshCw style={{ width: '16px', height: '16px', color: '#d97706' }} />
            <span>Alterar Dados de: {funcionarioEmEdicao.nome}</span>
          </div>

          <form onSubmit={lidarComEnvio} style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Nome Completo *</label>
                <input type="text" style={{ height: '28px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Matrícula *</label>
                <input type="text" style={{ height: '28px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} value={formData.matricula} onChange={e => setFormData({...formData, matricula: e.target.value})} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Cargo / Função *</label>
                <input type="text" style={{ height: '28px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} value={formData.cargo} onChange={e => setFormData({...formData, cargo: e.target.value})} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Status do Colaborador *</label>
                <select 
                  style={{ height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', fontSize: '11px' }} 
                  value={formData.ativo} 
                  onChange={e => setFormData({...formData, ativo: e.target.value})}
                >
                  <option value="ATIVO">ATIVO</option>
                  <option value="INATIVO">INATIVO</option>
                  <option value="INTEGRAÇÃO PENDENTE">INTEGRAÇÃO PENDENTE</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button type="button" onClick={() => setFuncionarioEmEdicao(null)} style={{ height: '32px', padding: '0 16px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                Cancelar Edição
              </button>
              <button type="submit" style={{ height: '32px', padding: '0 20px', backgroundColor: '#d97706', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                Salvar Alterações
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. TABELA DE FUNCIONÁRIOS */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            <Users style={{ width: '16px', height: '16px', color: '#1e293b' }} />
            <span>Funcionários ({filtroStatus === 'TODOS' ? 'Todos' : filtroStatus})</span>
          </div>
          
          {filtroStatus !== 'TODOS' && (
            <button 
              onClick={() => setFiltroStatus('TODOS')}
              style={{ fontSize: '10px', padding: '2px 8px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', color: '#475569', fontWeight: 'bold' }}
            >
              Limpar Filtro [X]
            </button>
          )}
        </div>
        
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', color: '#fff', textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 12px', borderRadius: '4px 0 0 0' }}>Nome do Colaborador</th>
                <th style={{ padding: '10px 12px' }}>Matrícula</th>
                <th style={{ padding: '10px 12px' }}>Cargo / Função</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', borderRadius: '0 4px 0 0', width: '100px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {funcionariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                    Nenhum funcionário com o status "{filtroStatus}" localizado.
                  </td>
                </tr>
              ) : (
                funcionariosFiltrados.map((func, index) => {
                  let statusBg = '#dcfce7'; 
                  let statusColor = '#15803d';
                  
                  const ehPendente = func.ativo === 'INTEGRAÇÃO PENDENTE';

                  if (func.ativo === 'INATIVO') {
                    statusBg = '#fee2e2'; 
                    statusColor = '#b91c1c';
                  } else if (ehPendente) {
                    statusBg = '#fef3c7'; 
                    statusColor = '#b45309';
                  }

                  return (
                    <tr key={func.id || index} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#1e293b' }}>{func.nome}</td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>{func.matricula}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ backgroundColor: '#f1f5f9', color: '#334155', padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }}>
                          {func.cargo}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ backgroundColor: statusBg, color: statusColor, padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', fontSize: '10px', display: 'inline-block' }}>
                          {func.ativo || 'ATIVO'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button 
                            onClick={() => !ehPendente && setFuncionarioEmEdicao(func)}
                            disabled={ehPendente}
                            style={{ 
                              backgroundColor: ehPendente ? '#f1f5f9' : '#fef3c7', 
                              color: ehPendente ? '#94a3b8' : '#d97706', 
                              border: 'none', 
                              padding: '6px', 
                              borderRadius: '4px', 
                              cursor: ehPendente ? 'not-allowed' : 'pointer', 
                              display: 'flex', 
                              alignItems: 'center',
                              opacity: ehPendente ? 0.6 : 1 
                            }}
                            title={ehPendente ? "Não é possível editar funcionários em integração pendente" : "Editar Funcionário"}
                          >
                            <Edit3 style={{ width: '13px', height: '13px' }} />
                          </button>
                          <button 
                            onClick={() => deletarFuncionario(func.id)}
                            style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            title="Excluir Funcionário"
                          >
                            <Trash2 style={{ width: '13px', height: '13px' }} />
                          </button>
                        </div>
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