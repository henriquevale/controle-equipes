import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, RefreshCw } from 'lucide-react';

  const API_URL = 'http://localhost:3001/api';
  //const API_URL = 'https://api-controle-impacto.duckdns.org/api';

export default function ControleMaster({ recarregarUsuariosGlobal, usuarioParaEditar, finalizarEdicaoGlobal, API_URL = 'http://localhost:3001/api' }) {
  const [formData, setFormData] = useState({
    nome: '',
    usuario: '',
    senha: '',
    cargo: 'GESTOR',
    ids_obras: [],
    ids_funcionarios: []
  });

  // Estados para guardar as listas filtradas disponíveis
  const [obrasDisponiveis, setObrasDisponiveis] = useState([]);
  const [funcionariosDisponiveis, setFuncionariosDisponiveis] = useState([]);

  // Bate no backend para buscar as listas filtradas considerando o perfil/cargo
  useEffect(() => {
    const carregarDisponiveis = async () => {
      try {
        const paramId = usuarioParaEditar ? usuarioParaEditar.id : '';
        
        const [resObras, resFuncs] = await Promise.all([
          axios.get(`${API_URL}/master/obras-todas?id_editando=${paramId}&cargo=${formData.cargo}`),
          axios.get(`${API_URL}/master/funcionarios-disponiveis?id_usuario_editando=${paramId}`)
        ]);
        
        setObrasDisponiveis(resObras.data || []);
        setFuncionariosDisponiveis(resFuncs.data || []);
      } catch (error) {
        console.error("Erro ao carregar listas filtradas:", error);
      }
    };
    
    carregarDisponiveis();
  }, [usuarioParaEditar, formData.cargo, API_URL]);

  // Monitora a mudança do usuário selecionado para edição e preenche o formulário
  useEffect(() => {
    if (usuarioParaEditar) {
      setFormData({
        nome: usuarioParaEditar.nome || '',
        usuario: usuarioParaEditar.usuario || '',
        senha: '', 
        cargo: usuarioParaEditar.cargo || 'GESTOR',
        ids_obras: usuarioParaEditar.id_obras ? usuarioParaEditar.id_obras.split(',').map(Number) : [],
        ids_funcionarios: usuarioParaEditar.id_funcionarios ? usuarioParaEditar.id_funcionarios.split(',').map(Number) : []
      });
    } else {
      setFormData({
        nome: '',
        usuario: '',
        senha: '',
        cargo: 'GESTOR',
        ids_obras: [],
        ids_funcionarios: []
      });
    }
  }, [usuarioParaEditar]);

  // Limpeza de seleções conforme o perfil selecionado
  useEffect(() => {
    if (formData.cargo === 'RH' || formData.cargo === 'MASTER') {
      setFormData(prev => ({
        ...prev,
        ids_obras: [],
        ids_funcionarios: []
      }));
    } else if (formData.cargo === 'ENGENHARIA') {
      setFormData(prev => ({
        ...prev,
        ids_funcionarios: [] // Engenheiros possuem foco nas obras e não em equipes de funcionários
      }));
    }
  }, [formData.cargo]);

  const handleCheckboxObra = (id) => {
    setFormData(prev => {
      const jaExiste = prev.ids_obras.includes(id);
      return {
        ...prev,
        ids_obras: jaExiste ? prev.ids_obras.filter(o => o !== id) : [...prev.ids_obras, id]
      };
    });
  };

  const handleCheckboxFuncionario = (id) => {
    setFormData(prev => {
      const jaExiste = prev.ids_funcionarios.includes(id);
      return {
        ...prev,
        ids_funcionarios: jaExiste ? prev.ids_funcionarios.filter(f => f !== id) : [...prev.ids_funcionarios, id]
      };
    });
  };

  const salvarFormulario = async (e) => {
    e.preventDefault();
    if (!formData.nome || !formData.usuario || !formData.cargo) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    try {
      if (usuarioParaEditar) {
        await axios.put(`${API_URL}/master/usuarios/${usuarioParaEditar.id}`, formData);
        alert("Usuário atualizado com sucesso!");
        finalizarEdicaoGlobal();
      } else {
        if (!formData.senha) {
          alert("A senha é obrigatória para novos usuários.");
          return;
        }
        await axios.post(`${API_URL}/master/usuarios`, formData);
        alert("Novo usuário cadastrado com sucesso!");
      }

      setFormData({ nome: '', usuario: '', senha: '', cargo: 'GESTOR', ids_obras: [], ids_funcionarios: [] });
      recarregarUsuariosGlobal();
      
      // Recarrega as listas após a gravação
      const [resObras, resFuncs] = await Promise.all([
        axios.get(`${API_URL}/master/obras-todas?cargo=${formData.cargo}`),
        axios.get(`${API_URL}/master/funcionarios-disponiveis`)
      ]);
      setObrasDisponiveis(resObras.data || []);
      setFuncionariosDisponiveis(resFuncs.data || []);
      
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Erro ao salvar alterações do usuário.");
    }
  };

  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px', width: '100%', boxSizing: 'border-box' }}>
      
      {/* TÍTULO / CABEÇALHO */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '13px' }}>
        {usuarioParaEditar ? <RefreshCw style={{ width: '18px', height: '18px', color: '#d97706', flexShrink: 0 }} /> : <UserPlus style={{ width: '18px', height: '18px', color: '#2563eb', flexShrink: 0 }} />}
        <span style={{ color: '#0f172a', wordBreak: 'break-word' }}>
          {usuarioParaEditar ? `Editando Usuário: ${usuarioParaEditar.nome}` : 'Cadastrar Novo Usuário (Master / Gestor / Engenharia / RH)'}
        </span>
      </div>

      <form onSubmit={salvarFormulario} style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
        
        {/* CAMPOS PRINCIPAIS - GRID RESPONSIVO PARA MOBILE */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', width: '100%' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>Nome Completo *</label>
            <input type="text" style={{ height: '34px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>Usuário de Acesso *</label>
            <input type="text" style={{ height: '34px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} value={formData.usuario} onChange={e => setFormData({...formData, usuario: e.target.value})} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>
              {usuarioParaEditar ? 'Nova Senha (Opcional)' : 'Senha de Acesso *'}
            </label>
            <input type="password" style={{ height: '34px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} value={formData.senha} onChange={e => setFormData({...formData, senha: e.target.value})} placeholder={usuarioParaEditar ? "Manter atual" : ""} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>Perfil do Sistema *</label>
            <select style={{ height: '34px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff' }} value={formData.cargo} onChange={e => setFormData({...formData, cargo: e.target.value})}>
              <option value="GESTOR">GESTOR (Obras Restritas e Equipe)</option>
              <option value="ENGENHARIA">ENGENHARIA (Supervisão de Obras e Faturamento)</option>
              <option value="RH">RH (Recursos Humanos Global)</option>
              <option value="MASTER">MASTER (Administrador Total)</option>
            </select>
          </div>

        </div>

        {/* VÍNCULOS CONDICIONAIS PARA GESTOR OU ENGENHARIA */}
        {['GESTOR', 'ENGENHARIA'].includes(formData.cargo) && (
          <div style={{ display: 'grid', gridTemplateColumns: formData.cargo === 'ENGENHARIA' ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '14px', width: '100%' }}>
            
            {/* SELEÇÃO DE OBRAS / RODOVIAS */}
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '6px', color: '#1e293b' }}>
                {formData.cargo === 'ENGENHARIA' 
                  ? 'Selecione as Obras/Rodovias para Supervisão da Engenharia:' 
                  : 'Selecione as Obras Permitidas para o Gestor:'}
              </div>
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', height: '220px', overflowY: 'auto', padding: '8px', backgroundColor: '#f8fafc', boxSizing: 'border-box' }}>
                {obrasDisponiveis.map(obra => (
                  <label key={obra.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', cursor: 'pointer', borderBottom: '1px solid #e2e8f0', fontSize: '12px', color: '#334155' }}>
                    <input type="checkbox" style={{ width: '16px', height: '16px', cursor: 'pointer' }} checked={formData.ids_obras.includes(obra.id)} onChange={() => handleCheckboxObra(obra.id)} />
                    <span style={{ wordBreak: 'break-word' }}>[{obra.codigo_obra}] {obra.nome_obra}</span>
                  </label>
                ))}
                {obrasDisponiveis.length === 0 && (
                  <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '30px' }}>Nenhuma obra disponível para vínculo.</div>
                )}
              </div>
            </div>

            {/* SELEÇÃO DE EQUIPE (APENAS PARA GESTOR) */}
            {formData.cargo === 'GESTOR' && (
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '6px', color: '#1e293b' }}>Selecione a Equipe do Gestor:</div>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', height: '220px', overflowY: 'auto', padding: '8px', backgroundColor: '#f8fafc', boxSizing: 'border-box' }}>
                  {funcionariosDisponiveis.map(func => (
                    <label key={func.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', cursor: 'pointer', borderBottom: '1px solid #e2e8f0', fontSize: '12px', color: '#334155' }}>
                      <input type="checkbox" style={{ width: '16px', height: '16px', cursor: 'pointer' }} checked={formData.ids_funcionarios.includes(func.id)} onChange={() => handleCheckboxFuncionario(func.id)} />
                      <span style={{ wordBreak: 'break-word' }}>{func.nome} ({func.cargo})</span>
                    </label>
                  ))}
                  {funcionariosDisponiveis.length === 0 && (
                    <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '30px' }}>Nenhum funcionário disponível para vínculo.</div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}

        {/* BOTÕES DE AÇÃO RESPONSIVOS */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px', flexWrap: 'wrap' }}>
          {usuarioParaEditar && (
            <button type="button" onClick={finalizarEdicaoGlobal} style={{ height: '36px', padding: '0 16px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', flex: '1 1 auto', maxWidth: '200px' }}>
              Cancelar Edição
            </button>
          )}
          <button type="submit" style={{ height: '36px', padding: '0 20px', backgroundColor: usuarioParaEditar ? '#d97706' : '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', flex: '1 1 auto', maxWidth: '200px' }}>
            {usuarioParaEditar ? 'Salvar Alterações' : 'Concluir Cadastro'}
          </button>
        </div>

      </form>
    </div>
  );
}