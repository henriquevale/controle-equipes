import React from 'react';
import axios from 'axios';
import { Trash2, Shield, Edit3 } from 'lucide-react';

//const API_URL = 'http://localhost:3001/api';
const API_URL = 'https://controle-equipes.onrender.com/api'; 

export default function ListaVinculos({ listaUsuarios, recarregarUsuariosGlobal, API_URL, mostrarMensagemGlobal, dispararEdicaoGlobal }) {
  
  const deletarUsuario = async (id) => {
    if (parseInt(id) === 1) {
      alert("Segurança: O Administrador Master ID 1 não pode ser deletado!");
      return;
    }
    
    if (!window.confirm("Tem certeza que deseja excluir permanentemente este usuário e todos os seus vínculos?")) return;
    
    try {
      const res = await axios.delete(`${API_URL}/master/usuarios/${id}`);
      if (res.data.success) {
        mostrarMensagemGlobal('Usuário removido com sucesso!', 'sucesso');
        recarregarUsuariosGlobal();
      }
    } catch (err) {
      console.error(err);
      mostrarMensagemGlobal('Erro ao tentar remover o usuário.', 'erro');
    }
  };

  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px', width: '100%', boxSizing: 'border-box', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', marginBottom: '16px', width: '100%' }}>
        <Shield style={{ color: '#1e293b', width: '18px', height: '18px' }} />
        <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', margin: 0, textTransform: 'uppercase' }}>
          Gestores Ativos & Vínculos Estruturados
        </h3>
      </div>

      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#0f172a', color: '#fff', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 12px', borderRadius: '4px 0 0 0' }}>Nome</th>
              <th style={{ padding: '10px 12px' }}>Usuário</th>
              <th style={{ padding: '10px 12px', width: '100px' }}>Perfil / Cargo</th>
              <th style={{ padding: '10px 12px', width: '32%' }}>Obras Vinculadas</th>
              <th style={{ padding: '10px 12px', width: '38%' }}>Equipes / Funcionários</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', borderRadius: '0 4px 0 0', width: '90px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {listaUsuarios.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                  Nenhum usuário cadastrado no sistema.
                </td>
              </tr>
            ) : (
              listaUsuarios.map((user, index) => (
                <tr key={user.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: '#1e293b' }}>{user.nome}</td>
                  <td style={{ padding: '12px', color: '#475569' }}>{user.usuario}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      backgroundColor: user.cargo === 'MASTER' ? '#fef3c7' : '#e0f2fe',
                      color: user.cargo === 'MASTER' ? '#92400e' : '#0369a1',
                      padding: '3px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '9px'
                    }}>
                      {user.cargo}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: '#334155', lineHeight: '1.5' }}>
                    <div style={{ maxHeight: '120px', overflowY: 'auto', paddingRight: '4px' }}>{user.obras}</div>
                  </td>
                  <td style={{ padding: '12px', color: '#334155', lineHeight: '1.5' }}>
                    <div style={{ maxHeight: '120px', overflowY: 'auto', paddingRight: '4px' }}>{user.funcionarios}</div>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      <button 
                        onClick={() => dispararEdicaoGlobal(user)}
                        style={{ backgroundColor: '#fef3c7', color: '#d97706', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        title="Editar Usuário"
                      >
                        <Edit3 style={{ width: '13px', height: '13px' }} />
                      </button>

                      <button 
                        onClick={() => deletarUsuario(user.id)}
                        disabled={parseInt(user.id) === 1}
                        style={{
                          backgroundColor: parseInt(user.id) === 1 ? '#cbd5e1' : '#fee2e2',
                          color: parseInt(user.id) === 1 ? '#94a3b8' : '#991b1b',
                          border: 'none', padding: '6px', borderRadius: '4px', cursor: parseInt(user.id) === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center'
                        }}
                        title={parseInt(user.id) === 1 ? "Bloqueado para segurança" : "Excluir Usuário"}
                      >
                        <Trash2 style={{ width: '13px', height: '13px' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}