import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
// Adicionado o ícone "Download" na importação
import { Trash2, Edit3, UserPlus, Users, RefreshCw, CheckCircle2, XCircle, AlertCircle, Search, Download } from 'lucide-react';


//const API_URL = 'http://localhost:3001/api';
const API_URL = 'https://controle-equipes.onrender.com/api'; 

export default function RecursosHumanos({ listaFuncionarios, recarregarFuncionariosGlobal, API_URL, mostrarMensagemGlobal }) {
  const [funcionarioEmEdicao, setFuncionarioEmEdicao] = useState(null);
  
  // Referência para rolar até o formulário de edição
  const scrollFormRef = useRef(null);
  
  // 1. AJUSTADO: Adicionado 'observacoes' ao estado inicial do formulário
  const [formData, setFormData] = useState({ nome: '', matricula: '', cargo: '', ativo: 'ATIVO', observacoes: '' });
  
  // Estado para controlar o filtro selecionado ('TODOS', 'ATIVO', 'INATIVO', 'INTEGRAÇÃO PENDENTE')
  const [filtroStatus, setFiltroStatus] = useState('TODOS');

  // 2. NOVO: Estado para armazenar o termo de busca por nome
  const [termoPesquisa, setTermoPesquisa] = useState('');

  // 3. AJUSTADO: Sincronização do formulário ao entrar ou sair do modo de edição
  useEffect(() => {
    if (funcionarioEmEdicao) {
      setFormData({
        nome: funcionarioEmEdicao.nome || '',
        matricula: funcionarioEmEdicao.matricula || '',
        cargo: funcionarioEmEdicao.cargo || '',
        ativo: funcionarioEmEdicao.ativo || 'ATIVO',
        observacoes: funcionarioEmEdicao.observacoes || '' // Incluído na edição
      });

      // Rola a página suavemente até o formulário de edição
      setTimeout(() => {
        scrollFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      setFormData({ nome: '', matricula: '', cargo: '', ativo: 'ATIVO', observacoes: '' });
    }
  }, [funcionarioEmEdicao]);

  // CÁLCULO DOS TOTAIS (Garante tratamento caso a lista não esteja inicializada como array)
  const safeLista = Array.isArray(listaFuncionarios) ? listaFuncionarios : [];
  const totalGeral = safeLista.length;
  const totalAtivos = safeLista.filter(f => f.ativo === 'ATIVO').length;
  const totalInativos = safeLista.filter(f => f.ativo === 'INATIVO').length;
  const totalPendentes = safeLista.filter(f => f.ativo === 'INTEGRAÇÃO PENDENTE').length;

  // 4. AJUSTADO: Filtro combinado (Status + Pesquisa de Nome Dinâmica)
  const funcionariosFiltrados = safeLista.filter(func => {
    // Validação por Status
    const atendeStatus = filtroStatus === 'TODOS' || 
      String(func.ativo).trim().toUpperCase() === String(filtroStatus).trim().toUpperCase();
    
    // Validação por Termo de Busca (Nome)
    const atendeNome = String(func.nome || '').toLowerCase().includes(termoPesquisa.toLowerCase());

    return atendeStatus && atendeNome;
  });

  // FUNÇÃO NOVA: Exportar dados filtrados para CSV
  const exportarParaCSV = () => {
    if (funcionariosFiltrados.length === 0) {
      mostrarMensagemGlobal('Não há dados para exportar com os filtros atuais.', 'erro');
      return;
    }

    // Cabeçalho do arquivo CSV
    const cabecalho = ['Nome', 'Matrícula', 'Cargo/Função', 'Status', 'Observações'];
    
    // Mapeamento das linhas
    const linhas = funcionariosFiltrados.map(f => [
      `"${(f.nome || '').replace(/"/g, '""')}"`,
      `"${(f.matricula || '').replace(/"/g, '""')}"`,
      `"${(f.cargo || '').replace(/"/g, '""')}"`,
      `"${(f.ativo || 'ATIVO').replace(/"/g, '""')}"`,
      `"${(f.observacoes || '').replace(/"/g, '""')}"`
    ]);

    // Une o cabeçalho e as linhas usando ponto e vírgula (padrão Excel em português)
    const conteudoCSV = [cabecalho.join(';'), ...linhas.map(l => l.join(';'))].join('\n');

    // Blob com UTF-8 BOM para garantir acentuação correta no Excel brasileiro
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), conteudoCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Criação dinâmica do elemento de download
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `funcionarios_${filtroStatus.toLowerCase().replace(' ', '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    mostrarMensagemGlobal('Download concluído com sucesso!', 'sucesso');
  };

  const lidarComEnvio = async (e) => {
    e.preventDefault();
    if (!formData.nome || !formData.matricula || !formData.cargo || !formData.ativo) {
      mostrarMensagemGlobal('Por favor, preencha todos os campos obrigatórios!', 'erro');
      return;
    }

    try {
      if (funcionarioEmEdicao) {
        await axios.put(`${API_URL}/rh/funcionarios/${funcionarioEmEdicao.id}`, formData);
        mostrarMensagemGlobal('Funcionário atualizado com sucesso!', 'sucesso');
        setFuncionarioEmEdicao(null);
      }
      
      setFormData({ nome: '', matricula: '', cargo: '', ativo: 'ATIVO', observacoes: '' });
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
        <div 
          ref={scrollFormRef} 
          style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px', width: '100%', boxSizing: 'border-box' }}
        >
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

            {/* 5. NOVO: Campo de Observações adicionado ao Formulário */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Observações</label>
              <textarea 
                style={{ minHeight: '60px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontFamily: 'inherit', fontSize: '11px', resize: 'vertical' }} 
                value={formData.observacoes} 
                onChange={e => setFormData({...formData, observacoes: e.target.value})}
                placeholder="Insira anotações sobre histórico, restrições ou observações médicas do colaborador..."
              />
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
        
        {/* 6. AJUSTADO: Seção de cabeçalho da tabela com Barra de Pesquisa de Nome Integrada e Botão de Download */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '12px', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            <Users style={{ width: '16px', height: '16px', color: '#1e293b' }} />
            <span>Funcionários ({filtroStatus === 'TODOS' ? 'Todos' : filtroStatus})</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            {/* Campo de Pesquisa */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search style={{ width: '14px', height: '14px', color: '#94a3b8', position: 'absolute', left: '8px' }} />
              <input 
                type="text" 
                placeholder="Pesquisar por nome..." 
                value={termoPesquisa}
                onChange={e => setTermoPesquisa(e.target.value)}
                style={{ height: '28px', padding: '0 8px 0 28px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', width: '180px' }}
              />
              {termoPesquisa && (
                <button 
                  onClick={() => setTermoPesquisa('')} 
                  style={{ position: 'absolute', right: '8px', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}
                >
                  ✕
                </button>
              )}
            </div>
            
            {/* BOTÃO NOVO: Exportar para CSV */}
            <button
              onClick={exportarParaCSV}
              style={{
                height: '28px',
                padding: '0 10px',
                backgroundColor: '#1e293b',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 'bold',
                transition: 'background-color 0.2s'
              }}
              title="Exportar dados filtrados para Excel/CSV"
            >
              <Download style={{ width: '14px', height: '14px' }} />
              <span>Exportar</span>
            </button>
            
            {filtroStatus !== 'TODOS' && (
              <button 
                onClick={() => setFiltroStatus('TODOS')}
                style={{ fontSize: '10px', height: '28px', padding: '0 8px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', color: '#475569', fontWeight: 'bold' }}
              >
                Limpar Filtro [X]
              </button>
            )}
          </div>
        </div>
        
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', color: '#fff', textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 12px', borderRadius: '4px 0 0 0' }}>Nome do Colaborador</th>
                <th style={{ padding: '10px 12px' }}>Matrícula</th>
                <th style={{ padding: '10px 12px' }}>Cargo / Função</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                {/* 7. NOVO: Cabeçalho da Coluna Observações */}
                <th style={{ padding: '10px 12px' }}>Observações</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', borderRadius: '0 4px 0 0', width: '100px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {funcionariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                    Nenhum funcionário localizado com os critérios informados.
                  </td>
                </tr>
              ) : (
                funcionariosFiltrados.map((func, index) => {
                  console.log("Funcionário:", func);
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
                      {/* 8. AJUSTADO: Exibe a observação de forma legível (e o texto completo ao passar o mouse por cima) */}
                      <td 
                        style={{ 
                          padding: '10px 12px', 
                          color: '#475569', 
                          maxWidth: '250px', 
                          whiteSpace: 'normal', // Ajustado para quebrar a linha se a observação for longa
                          wordBreak: 'break-word' 
                        }} 
                        title={func.observacoes || ''}
                      >
                        {func.observacoes ? (
                          <strong>{func.observacoes}</strong>
                        ) : (
                          <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>Nenhuma</span>
                        )}
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