import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Trash2, Edit3, Users, RefreshCw, CheckCircle2, XCircle, AlertCircle, Search, Download, Eye, X, ArrowUpDown } from 'lucide-react';

const API_URL = 'http://localhost:3001/api';
//const API_URL = 'https://api-controle-impacto.duckdns.org/api';
  
export default function RecursosHumanos({ listaFuncionarios, recarregarFuncionariosGlobal, API_URL, mostrarMensagemGlobal }) {
  const [funcionarioEmEdicao, setFuncionarioEmEdicao] = useState(null);
  const [funcionarioDetalhar, setFuncionarioDetalhar] = useState(null);
  const [listaGestores, setListaGestores] = useState([]);
  
  const scrollFormRef = useRef(null);

  const formatarDataParaInput = (d) => {
    if (!d) return '';
    if (typeof d === 'string' && d.includes('T')) return d.split('T')[0];
    return String(d).substring(0, 10);
  };

  const [formData, setFormData] = useState({
    nome: '',
    matricula: '',
    cargo: '',
    id_usuario_gestor: '',
    ativo: 'ATIVO',
    cpf: '',
    telefone: '',
    tam_calca: '',
    tam_camisa: '',
    tam_calcado: '',
    data_admissao: '',
    data_demissao: '',
    data_postagem_aso_pasta: '',
    data_documentos_rh_completos: '',
    observacoes: ''
  });

  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [filtroGestor, setFiltroGestor] = useState('TODOS');
  const [termoPesquisa, setTermoPesquisa] = useState('');
  // NOVO: Estado para controlar a ordenação
  const [ordem, setOrdem] = useState('ALFABETICA_ASC');

  useEffect(() => {
    const carregarGestores = async () => {
      try {
        const res = await axios.get(`${API_URL}/rh/gestores-disponiveis`);
        setListaGestores(res.data || []);
      } catch (err) {
        console.error("Erro ao carregar gestores:", err);
      }
    };
    carregarGestores();
  }, [API_URL]);

  useEffect(() => {
    if (funcionarioEmEdicao) {
      setFormData({
        nome: funcionarioEmEdicao.nome || '',
        matricula: funcionarioEmEdicao.matricula || '',
        cargo: funcionarioEmEdicao.cargo || '',
        id_usuario_gestor: funcionarioEmEdicao.id_usuario_gestor || '',
        ativo: funcionarioEmEdicao.ativo || 'ATIVO',
        cpf: funcionarioEmEdicao.cpf || '',
        telefone: funcionarioEmEdicao.telefone || '',
        tam_calca: funcionarioEmEdicao.tam_calca || '',
        tam_camisa: funcionarioEmEdicao.tam_camisa || '',
        tam_calcado: funcionarioEmEdicao.tam_calcado || '',
        data_admissao: formatarDataParaInput(funcionarioEmEdicao.data_admissao),
        data_demissao: formatarDataParaInput(funcionarioEmEdicao.data_demissao),
        data_postagem_aso_pasta: formatarDataParaInput(funcionarioEmEdicao.data_postagem_aso_pasta),
        data_documentos_rh_completos: formatarDataParaInput(funcionarioEmEdicao.data_documentos_rh_completos),
        observacoes: funcionarioEmEdicao.observacoes || ''
      });

      setTimeout(() => {
        scrollFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      setFormData({
        nome: '', matricula: '', cargo: '', id_usuario_gestor: '', ativo: 'ATIVO',
        cpf: '', telefone: '', tam_calca: '', tam_camisa: '', tam_calcado: '',
        data_admissao: '', data_demissao: '', data_postagem_aso_pasta: '',
        data_documentos_rh_completos: '', observacoes: ''
      });
    }
  }, [funcionarioEmEdicao]);

  const safeLista = Array.isArray(listaFuncionarios) ? listaFuncionarios : [];
  const totalGeral = safeLista.length;
  const totalAtivos = safeLista.filter(f => f.ativo === 'ATIVO').length;
  const totalInativos = safeLista.filter(f => f.ativo === 'INATIVO').length;
  const totalPendentes = safeLista.filter(f => f.ativo === 'INTEGRAÇÃO PENDENTE').length;

  // Lógica de filtragem tripla (Status, Gestor e Nome)
  const funcionariosFiltrados = safeLista.filter(func => {
    const atendeStatus = filtroStatus === 'TODOS' || 
      String(func.ativo).trim().toUpperCase() === String(filtroStatus).trim().toUpperCase();
    
    const gestorNomeAtual = (func.gestor || func.nome_gestor || 'SEM GESTOR').trim().toUpperCase();
    const atendeGestor = filtroGestor === 'TODOS' || gestorNomeAtual === filtroGestor.trim().toUpperCase();

    const atendeNome = String(func.nome || '').toLowerCase().includes(termoPesquisa.toLowerCase());
    
    return atendeStatus && atendeGestor && atendeNome;
  });

  // NOVO: Lógica de Ordenação
  const funcionariosOrdenados = [...funcionariosFiltrados].sort((a, b) => {
    if (ordem === 'ALFABETICA_ASC') {
      return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
    }
    if (ordem === 'ALFABETICA_DESC') {
      return (b.nome || '').localeCompare(a.nome || '', 'pt-BR');
    }
    if (ordem === 'ULTIMOS_ATUALIZADOS') {
      // Utiliza a coluna 'atualizado_em' (com fallback para criada_em/created_at se nulo)
      const dataA = new Date(a.atualizado_em || a.criado_em || a.created_at || 0);
      const dataB = new Date(b.atualizado_em || b.criado_em || b.created_at || 0);
      return dataB - dataA;
    }
    return 0;
  });

  const exportarParaCSV = () => {
    if (funcionariosOrdenados.length === 0) {
      mostrarMensagemGlobal('Não há dados para exportar com os filtros atuais.', 'erro');
      return;
    }

    const cabecalho = ['Nome', 'Matrícula', 'Cargo/Função', 'Gestor', 'Status', 'CPF', 'Telefone', 'Admissão', 'Demissão', 'Observações'];
    const linhas = funcionariosOrdenados.map(f => [
      `"${(f.nome || '').replace(/"/g, '""')}"`,
      `"${(f.matricula || '').replace(/"/g, '""')}"`,
      `"${(f.cargo || '').replace(/"/g, '""')}"`,
      `"${(f.gestor || f.nome_gestor || '').replace(/"/g, '""')}"`,
      `"${(f.ativo || 'ATIVO').replace(/"/g, '""')}"`,
      `"${(f.cpf || '').replace(/"/g, '""')}"`,
      `"${(f.telefone || '').replace(/"/g, '""')}"`,
      `"${f.data_admissao ? formatarDataParaInput(f.data_admissao) : ''}"`,
      `"${f.data_demissao ? formatarDataParaInput(f.data_demissao) : ''}"`,
      `"${(f.observacoes || '').replace(/"/g, '""')}"`
    ]);

    const conteudoCSV = [cabecalho.join(';'), ...linhas.map(l => l.join(';'))].join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), conteudoCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
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
      mostrarMensagemGlobal('Por favor, preencha todos os campos obrigatórios (*)!', 'erro');
      return;
    }

    try {
      if (funcionarioEmEdicao) {
        await axios.put(`${API_URL}/rh/funcionarios/${funcionarioEmEdicao.id}`, formData);
        mostrarMensagemGlobal('Funcionário atualizado com sucesso!', 'sucesso');
        setFuncionarioEmEdicao(null);
      }
      
      recarregarFuncionariosGlobal();
    } catch (err) {
      console.error("Erro na API (RH):", err);
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

  const formatarDataBR = (d) => {
    if (!d) return '-';
    const dataApenas = String(d).split('T')[0];
    const partes = dataApenas.split('-');
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
    return d;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', boxSizing: 'border-box' }}>
      
      {/* SEÇÃO DE CARDS MÉTRICOS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', width: '100%' }}>
        <div onClick={() => setFiltroStatus('TODOS')} style={{ backgroundColor: '#fff', border: `2px solid ${filtroStatus === 'TODOS' ? '#1e293b' : '#e2e8f0'}`, borderRadius: '4px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s', boxShadow: filtroStatus === 'TODOS' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Todos</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e293b', marginTop: '4px' }}>{totalGeral}</div>
          </div>
          <Users style={{ width: '28px', height: '28px', color: '#94a3b8' }} />
        </div>

        <div onClick={() => setFiltroStatus('ATIVO')} style={{ backgroundColor: '#fff', border: `2px solid ${filtroStatus === 'ATIVO' ? '#15803d' : '#e2e8f0'}`, borderRadius: '4px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s', boxShadow: filtroStatus === 'ATIVO' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#16a34a', textTransform: 'uppercase' }}>Ativos</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#15803d', marginTop: '4px' }}>{totalAtivos}</div>
          </div>
          <CheckCircle2 style={{ width: '28px', height: '28px', color: '#bbf7d0' }} />
        </div>

        <div onClick={() => setFiltroStatus('INATIVO')} style={{ backgroundColor: '#fff', border: `2px solid ${filtroStatus === 'INATIVO' ? '#b91c1c' : '#e2e8f0'}`, borderRadius: '4px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s', boxShadow: filtroStatus === 'INATIVO' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#dc2626', textTransform: 'uppercase' }}>Inativos</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#b91c1c', marginTop: '4px' }}>{totalInativos}</div>
          </div>
          <XCircle style={{ width: '28px', height: '28px', color: '#fecdd3' }} />
        </div>

        <div onClick={() => setFiltroStatus('INTEGRAÇÃO PENDENTE')} style={{ backgroundColor: '#fff', border: `2px solid ${filtroStatus === 'INTEGRAÇÃO PENDENTE' ? '#b45309' : '#e2e8f0'}`, borderRadius: '4px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s', boxShadow: filtroStatus === 'INTEGRAÇÃO PENDENTE' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#d97706', textTransform: 'uppercase' }}>Int. Pendente</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#b45309', marginTop: '4px' }}>{totalPendentes}</div>
          </div>
          <AlertCircle style={{ width: '28px', height: '28px', color: '#fef3c7' }} />
        </div>
      </div>

      {/* FORMULÁRIO COMPLETO DE EDIÇÃO */}
      {funcionarioEmEdicao && (
        <div ref={scrollFormRef} style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            <RefreshCw style={{ width: '16px', height: '16px', color: '#d97706' }} />
            <span>Editar Cadastro de: {funcionarioEmEdicao.nome}</span>
          </div>

          <form onSubmit={lidarComEnvio} style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Nome Completo *</label>
                <input type="text" style={{ height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }} value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Matrícula *</label>
                <input type="text" style={{ height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }} value={formData.matricula} onChange={e => setFormData({...formData, matricula: e.target.value})} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Cargo / Função *</label>
                <input type="text" style={{ height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }} value={formData.cargo} onChange={e => setFormData({...formData, cargo: e.target.value})} required />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Gestor Direto</label>
                <select 
                  style={{ height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', fontSize: '11px' }} 
                  value={formData.id_usuario_gestor} 
                  onChange={e => setFormData({...formData, id_usuario_gestor: e.target.value})}
                >
                  <option value="">Sem Gestor / Nenhum</option>
                  {listaGestores.map(g => (
                    <option key={g.id_usuario} value={g.id_usuario}>
                      {g.nome_gestor}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Status *</label>
                <select style={{ height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', fontSize: '11px' }} value={formData.ativo} onChange={e => setFormData({...formData, ativo: e.target.value})}>
                  <option value="ATIVO">ATIVO</option>
                  <option value="INATIVO">INATIVO</option>
                  <option value="INTEGRAÇÃO PENDENTE">INTEGRAÇÃO PENDENTE</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold' }}>CPF</label>
                <input type="text" placeholder="000.000.000-00" style={{ height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }} value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Telefone / Celular</label>
                <input type="text" placeholder="(00) 00000-0000" style={{ height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }} value={formData.telefone} onChange={e => setFormData({...formData, telefone: e.target.value})} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Tamanho Calça</label>
                <input type="text" style={{ height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }} value={formData.tam_calca} onChange={e => setFormData({...formData, tam_calca: e.target.value})} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Tamanho Camisa</label>
                <input type="text" style={{ height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }} value={formData.tam_camisa} onChange={e => setFormData({...formData, tam_camisa: e.target.value})} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Tamanho Calçado</label>
                <input type="number" style={{ height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }} value={formData.tam_calcado} onChange={e => setFormData({...formData, tam_calcado: e.target.value})} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Data de Admissão</label>
                <input type="date" style={{ height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }} value={formData.data_admissao} onChange={e => setFormData({...formData, data_admissao: e.target.value})} />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: formData.ativo === 'INATIVO' ? '#b91c1c' : '#94a3b8' }}>
                  Data de Demissão {formData.ativo !== 'INATIVO' && '(Apenas se Inativo)'}
                </label>
                <input 
                  type="date" 
                  disabled={formData.ativo !== 'INATIVO'} 
                  style={{ 
                    height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px',
                    backgroundColor: formData.ativo === 'INATIVO' ? '#fff' : '#f1f5f9',
                    cursor: formData.ativo === 'INATIVO' ? 'text' : 'not-allowed'
                  }} 
                  value={formData.ativo === 'INATIVO' ? formData.data_demissao : ''} 
                  onChange={e => setFormData({...formData, data_demissao: e.target.value})} 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Postagem ASO / Pasta</label>
                <input type="date" style={{ height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }} value={formData.data_postagem_aso_pasta} onChange={e => setFormData({...formData, data_postagem_aso_pasta: e.target.value})} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Docs. RH Completos</label>
                <input type="date" style={{ height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }} value={formData.data_documentos_rh_completos} onChange={e => setFormData({...formData, data_documentos_rh_completos: e.target.value})} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Observações</label>
              <textarea style={{ minHeight: '60px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontFamily: 'inherit', fontSize: '11px', resize: 'vertical' }} value={formData.observacoes} onChange={e => setFormData({...formData, observacoes: e.target.value})} placeholder="Insira observações ou notas adicionais..." />
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

      {/* TABELA DE FUNCIONÁRIOS */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px', width: '100%', boxSizing: 'border-box' }}>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '12px', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            <Users style={{ width: '16px', height: '16px', color: '#1e293b' }} />
            <span>Funcionários ({filtroStatus === 'TODOS' ? 'Todos' : filtroStatus})</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
            
            {/* FILTRO POR GESTOR */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>Gestor:</span>
              <select 
                value={filtroGestor} 
                onChange={e => setFiltroGestor(e.target.value)}
                style={{ height: '28px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', backgroundColor: '#fff' }}
              >
                <option value="TODOS">Todos os Gestores</option>
                {listaGestores.map(g => (
                  <option key={g.id_usuario} value={g.nome_gestor}>
                    {g.nome_gestor}
                  </option>
                ))}
              </select>
            </div>

            {/* NOVO: FILTRO DE ORDENAÇÃO */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowUpDown style={{ width: '13px', height: '13px', color: '#64748b' }} />
              <select 
                value={ordem} 
                onChange={e => setOrdem(e.target.value)}
                style={{ height: '28px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', backgroundColor: '#fff', fontWeight: 'bold', color: '#334155' }}
              >
                <option value="ALFABETICA_ASC">Ordem Alfabética (A-Z)</option>
                <option value="ALFABETICA_DESC">Ordem Alfabética (Z-A)</option>
                <option value="ULTIMOS_ATUALIZADOS">Atualizado por Último</option>
              </select>
            </div>

            {/* CAMPO DE PESQUISA POR NOME */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search style={{ width: '14px', height: '14px', color: '#94a3b8', position: 'absolute', left: '8px' }} />
              <input type="text" placeholder="Pesquisar por nome..." value={termoPesquisa} onChange={e => setTermoPesquisa(e.target.value)} style={{ height: '28px', padding: '0 8px 0 28px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', width: '180px' }} />
              {termoPesquisa && (
                <button onClick={() => setTermoPesquisa('')} style={{ position: 'absolute', right: '8px', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>✕</button>
              )}
            </div>
            
            <button onClick={exportarParaCSV} style={{ height: '28px', padding: '0 10px', backgroundColor: '#1e293b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 'bold' }} title="Exportar dados filtrados para Excel/CSV">
              <Download style={{ width: '14px', height: '14px' }} />
              <span>Exportar</span>
            </button>
            
            {(filtroStatus !== 'TODOS' || filtroGestor !== 'TODOS' || termoPesquisa || ordem !== 'ALFABETICA_ASC') && (
              <button 
                onClick={() => { setFiltroStatus('TODOS'); setFiltroGestor('TODOS'); setTermoPesquisa(''); setOrdem('ALFABETICA_ASC'); }} 
                style={{ fontSize: '10px', height: '28px', padding: '0 8px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', color: '#475569', fontWeight: 'bold' }}
              >
                Limpar Filtros [X]
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
                <th style={{ padding: '10px 12px' }}>Gestor</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px' }}>Observações</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', borderRadius: '0 4px 0 0', width: '120px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {funcionariosOrdenados.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                    Nenhum funcionário localizado com os critérios informados.
                  </td>
                </tr>
              ) : (
                funcionariosOrdenados.map((func, index) => {
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

                  const gestorAtual = func.gestor || func.nome_gestor || '-';

                  return (
                    <tr key={func.id || index} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#1e293b' }}>{func.nome}</td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>{func.matricula}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ backgroundColor: '#f1f5f9', color: '#334155', padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }}>
                          {func.cargo}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#334155', fontWeight: '500' }}>
                        {gestorAtual}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ backgroundColor: statusBg, color: statusColor, padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', fontSize: '10px', display: 'inline-block' }}>
                          {func.ativo || 'ATIVO'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#475569', maxWidth: '200px', whiteSpace: 'normal', wordBreak: 'break-word' }} title={func.observacoes || ''}>
                        {func.observacoes ? (
                          <strong>{func.observacoes}</strong>
                        ) : (
                          <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>Nenhuma</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          
                          <button 
                            onClick={() => setFuncionarioDetalhar(func)}
                            style={{ backgroundColor: '#e0f2fe', color: '#0369a1', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            title="Ver Detalhes do Funcionário"
                          >
                            <Eye style={{ width: '13px', height: '13px' }} />
                          </button>

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

      {/* JANELA MODAL DE DETALHES COMPLETO */}
      {funcionarioDetalhar && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', maxWidth: '650px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', border: '1px solid #cbd5e1' }}>
            
            <div style={{ padding: '16px 20px', backgroundColor: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '8px 8px 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Users style={{ width: '20px', height: '20px', color: '#38bdf8' }} />
                <span style={{ fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase' }}>Ficha Cadastral do Colaborador</span>
              </div>
              <button onClick={() => setFuncionarioDetalhar(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '12px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: 'bold' }}>{funcionarioDetalhar.nome}</h3>
                  <p style={{ margin: '2px 0 0 0', color: '#64748b' }}>Matrícula: <strong>{funcionarioDetalhar.matricula}</strong> | Cargo: <strong>{funcionarioDetalhar.cargo}</strong></p>
                </div>
                <span style={{ backgroundColor: funcionarioDetalhar.ativo === 'ATIVO' ? '#dcfce7' : funcionarioDetalhar.ativo === 'INATIVO' ? '#fee2e2' : '#fef3c7', color: funcionarioDetalhar.ativo === 'ATIVO' ? '#15803d' : funcionarioDetalhar.ativo === 'INATIVO' ? '#b91c1c' : '#b45309', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold', fontSize: '11px' }}>
                  {funcionarioDetalhar.ativo || 'ATIVO'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                <div><strong>Gestor Vinculado:</strong> {funcionarioDetalhar.gestor || funcionarioDetalhar.nome_gestor || 'Nenhum'}</div>
                <div><strong>CPF:</strong> {funcionarioDetalhar.cpf || '-'}</div>
                <div><strong>Telefone:</strong> {funcionarioDetalhar.telefone || '-'}</div>
                <div><strong>Tamanho Calça:</strong> {funcionarioDetalhar.tam_calca || '-'}</div>
                <div><strong>Tamanho Camisa:</strong> {funcionarioDetalhar.tam_camisa || '-'}</div>
                <div><strong>Tamanho Calçado:</strong> {funcionarioDetalhar.tam_calcado || '-'}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                <div><strong>Data Admissão:</strong> {formatarDataBR(funcionarioDetalhar.data_admissao)}</div>
                <div><strong style={{ color: funcionarioDetalhar.data_demissao ? '#b91c1c' : '#334155' }}>Data Demissão:</strong> {formatarDataBR(funcionarioDetalhar.data_demissao)}</div>
                <div><strong>Postagem ASO / Pasta:</strong> {formatarDataBR(funcionarioDetalhar.data_postagem_aso_pasta)}</div>
                <div><strong>Docs RH Completos:</strong> {formatarDataBR(funcionarioDetalhar.data_documentos_rh_completos)}</div>
              </div>

              <div style={{ backgroundColor: '#fffbebf', padding: '12px', borderRadius: '6px', border: '1px solid #fef3c7' }}>
                <strong style={{ color: '#b45309', display: 'block', marginBottom: '4px' }}>Observações:</strong>
                <p style={{ margin: 0, color: '#334155', whiteSpace: 'pre-wrap' }}>
                  {funcionarioDetalhar.observacoes || 'Nenhuma observação registrada.'}
                </p>
              </div>

            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc', borderRadius: '0 0 8px 8px' }}>
              <button onClick={() => setFuncionarioDetalhar(null)} style={{ padding: '6px 16px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}