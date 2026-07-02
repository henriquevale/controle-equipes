import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, RefreshCw } from 'lucide-react';

export default function ControleMaster({ recarregarUsuariosGlobal, usuarioParaEditar, finalizarEdicaoGlobal, API_URL = 'http://localhost:3001/api' }) {
  const [formData, setFormData] = useState({
    nome: '',
    usuario: '',
    senha: '',
    cargo: 'GESTOR',
    ids_obras: [],
    ids_funcionarios: []
  });

  // Estados para guardar apenas o que está realmente disponível
  const [obrasDisponiveis, setObrasDisponiveis] = useState([]);
  const [funcionariosDisponiveis, setFuncionariosDisponiveis] = useState([]);

  // Bate no backend para buscar as listas filtradas de forma inteligente
  useEffect(() => {
    const carregarDisponiveis = async () => {
      try {
        const paramId = usuarioParaEditar ? usuarioParaEditar.id : '';
        
        // 💡 Ajustado para bater nas rotas cirúrgicas do seu Back-end!
        const [resObras, resFuncs] = await Promise.all([
          axios.get(`${API_URL}/master/obras-todas?id_editando=${paramId}`),
          axios.get(`${API_URL}/master/funcionarios-disponiveis?id_usuario_editando=${paramId}`)
        ]);
        
        setObrasDisponiveis(resObras.data || []);
        setFuncionariosDisponiveis(resFuncs.data || []);
      } catch (error) {
        console.error("Erro ao carregar listas filtradas:", error);
      }
    };
    
    carregarDisponiveis();
  }, [usuarioParaEditar, API_URL]);

  // Monitora a mudança do usuário para edição e injeta os dados
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

  // Regra de segurança: se mudar o cargo, limpa os vínculos
  useEffect(() => {
    if (formData.cargo !== 'GESTOR') {
      setFormData(prev => ({
        ...prev,
        ids_obras: [],
        ids_funcionarios: []
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
    if (!formData.nome || !formData.usuario || formData.cargo === '') {
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
      
      // Recarrega as listas disponíveis após salvar para manter os dados frescos na tela
      const [resObras, resFuncs] = await Promise.all([
        axios.get(`${API_URL}/master/obras-todas`),
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
    <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '16px', fontWeight: 'bold', textTransform: 'uppercase' }}>
        {usuarioParaEditar ? <RefreshCw style={{ width: '16px', height: '16px', color: '#d97706' }} /> : <UserPlus style={{ width: '16px', height: '16px', color: '#2563eb' }} />}
        <span>{usuarioParaEditar ? `Editando Usuário: ${usuarioParaEditar.nome}` : 'Cadastrar Novo Usuário (Master / Gestor / RH)'}</span>
      </div>

      <form onSubmit={salvarFormulario} style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
        <div style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', display: 'grid', gap: '12px', width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Nome Completo *</label>
            <input type="text" style={{ height: '28px', padding: '0 6px', border: '1px solid #cbd5e1', borderRadius: '4px' }} value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Usuário de Acesso *</label>
            <input type="text" style={{ height: '28px', padding: '0 6px', border: '1px solid #cbd5e1', borderRadius: '4px' }} value={formData.usuario} onChange={e => setFormData({...formData, usuario: e.target.value})} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', fontWeight: 'bold' }}>{usuarioParaEditar ? 'Nova Senha (Deixe em branco para manter)' : 'Senha de Acesso *'}</label>
            <input type="password" style={{ height: '28px', padding: '0 6px', border: '1px solid #cbd5e1', borderRadius: '4px' }} value={formData.senha} onChange={e => setFormData({...formData, senha: e.target.value})} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Perfil do Sistema *</label>
            <select style={{ height: '30px', padding: '0 4px', border: '1px solid #cbd5e1', borderRadius: '4px' }} value={formData.cargo} onChange={e => setFormData({...formData, cargo: e.target.value})}>
              <option value="GESTOR">GESTOR (Acesso Restrito a Obras/Equipes)</option>
              <option value="RH">RH (Recursos Humanos Global)</option>
              <option value="MASTER">MASTER (Administrador Total)</option>
            </select>
          </div>
        </div>

        {formData.cargo === 'GESTOR' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '16px', marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px', width: '100%' }}>
            {/* VINCULAR OBRAS */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '6px', color: '#1e293b' }}>Selecione as Obras Permitidas:</div>
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', height: '250px', overflowY: 'auto', padding: '8px', backgroundColor: '#f8fafc' }}>
                {obrasDisponiveis.map(obra => (
                  <label key={obra.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                    <input type="checkbox" checked={formData.ids_obras.includes(obra.id)} onChange={() => handleCheckboxObra(obra.id)} />
                    <span style={{ fontSize: '12px', color: '#334155' }}>[{obra.codigo_obra}] {obra.nome_obra}</span>
                  </label>
                ))}
                {obrasDisponiveis.length === 0 && (
                  <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '20px' }}>Nenhuma obra disponível para vínculo.</div>
                )}
              </div>
            </div>

            {/* VINCULAR COLABORADORES */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '6px', color: '#1e293b' }}>Selecione a Equipe do Gestor:</div>
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', height: '250px', overflowY: 'auto', padding: '8px', backgroundColor: '#f8fafc' }}>
                {funcionariosDisponiveis.map(func => (
                  <label key={func.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                    <input type="checkbox" checked={formData.ids_funcionarios.includes(func.id)} onChange={() => handleCheckboxFuncionario(func.id)} />
                    <span style={{ fontSize: '12px', color: '#334155' }}>{func.nome} ({func.cargo})</span>
                  </label>
                ))}
                {funcionariosDisponiveis.length === 0 && (
                  <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '20px' }}>Nenhum funcionário disponível para vínculo.</div>
                )}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
          {usuarioParaEditar && (
            <button type="button" onClick={finalizarEdicaoGlobal} style={{ height: '32px', padding: '0 16px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
              Cancelar Edição
            </button>
          )}
          <button type="submit" style={{ height: '32px', padding: '0 20px', backgroundColor: usuarioParaEditar ? '#d97706' : '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
            {usuarioParaEditar ? 'Salvar Alterações' : 'Concluir Cadastro'}
          </button>
        </div>
      </form>
    </div>
  );
}