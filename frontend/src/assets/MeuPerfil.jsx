import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Save, Eye, EyeOff, Lock, Mail, Phone, ShieldCheck } from 'lucide-react';

const API_DEFAULT = 'http://localhost:3001/api';

export default function MeuPerfil({ usuarioLogado, API_URL = API_DEFAULT }) {
  const [perfil, setPerfil] = useState({ nome: '', email: '', telefone: '', senhaAtual: '', novaSenha: '' });
  
  // Estados para alternar a visibilidade das senhas
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);

  useEffect(() => {
    if (usuarioLogado?.id) {
      axios.get(`${API_URL}/auth/perfil/${usuarioLogado.id}`)
        .then(res => setPerfil(prev => ({ ...prev, ...res.data, senhaAtual: '', novaSenha: '' })))
        .catch(err => console.error("Erro ao carregar perfil:", err));
    }
  }, [usuarioLogado, API_URL]);

  const salvarPerfil = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/auth/perfil/${usuarioLogado.id}`, perfil);
      alert("Perfil atualizado com sucesso!");
      setPerfil(prev => ({ ...prev, senhaAtual: '', novaSenha: '' }));
    } catch (err) {
      alert(err.response?.data?.error || "Erro ao atualizar perfil.");
    }
  };

  // Estilos reutilizáveis para os inputs
  const inputContainerStyle = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px 10px 38px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box'
  };

  const iconLeftStyle = {
    position: 'absolute',
    left: '12px',
    color: '#94a3b8',
    pointerEvents: 'none'
  };

  const eyeButtonStyle = {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#64748b',
    display: 'flex',
    alignItems: 'center',
    padding: 0
  };

  const labelStyle = {
    fontSize: '13px',
    fontWeight: '600',
    color: '#334155',
    marginBottom: '4px',
    display: 'block'
  };

  return (
    <div style={{ 
      backgroundColor: '#ffffff', 
      borderRadius: '12px', 
      padding: '28px', 
      maxWidth: '480px', 
      margin: '30px auto',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      fontFamily: 'sans-serif'
    }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
        <div style={{ backgroundColor: '#eff6ff', padding: '8px', borderRadius: '8px', display: 'flex' }}>
          <User style={{ color: '#2563eb' }} size={22} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '600' }}>Meu Perfil</h3>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Atualize suas informações pessoais e senha</p>
        </div>
      </div>

      <form onSubmit={salvarPerfil} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Campo Nome */}
        <div>
          <label style={labelStyle}>Nome Completo</label>
          <div style={inputContainerStyle}>
            <User size={18} style={iconLeftStyle} />
            <input 
              type="text" 
              style={inputStyle}
              value={perfil.nome} 
              onChange={e => setPerfil({...perfil, nome: e.target.value})} 
              placeholder="Seu nome completo"
              required 
            />
          </div>
        </div>

        {/* Campo E-mail */}
        <div>
          <label style={labelStyle}>E-mail</label>
          <div style={inputContainerStyle}>
            <Mail size={18} style={iconLeftStyle} />
            <input 
              type="email" 
              style={inputStyle}
              value={perfil.email || ''} 
              onChange={e => setPerfil({...perfil, email: e.target.value})} 
              placeholder="seuemail@exemplo.com"
            />
          </div>
        </div>

        {/* Campo Telefone */}
        <div>
          <label style={labelStyle}>Telefone</label>
          <div style={inputContainerStyle}>
            <Phone size={18} style={iconLeftStyle} />
            <input 
              type="text" 
              style={inputStyle}
              value={perfil.telefone || ''} 
              onChange={e => setPerfil({...perfil, telefone: e.target.value})} 
              placeholder="(00) 00000-0000"
            />
          </div>
        </div>

        {/* Divisor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0 4px 0' }}>
          <ShieldCheck size={16} style={{ color: '#64748b' }} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>Alterar Senha</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div>
        </div>

        {/* Senha Atual */}
        <div>
          <label style={labelStyle}>Senha Atual</label>
          <div style={inputContainerStyle}>
            <Lock size={18} style={iconLeftStyle} />
            <input 
              type={mostrarSenhaAtual ? "text" : "password"} 
              style={{ ...inputStyle, paddingRight: '38px' }}
              value={perfil.senhaAtual} 
              onChange={e => setPerfil({...perfil, senhaAtual: e.target.value})} 
              placeholder="Sua senha atual"
            />
            <button 
              type="button" 
              style={eyeButtonStyle} 
              onClick={() => setMostrarSenhaAtual(!mostrarSenhaAtual)}
              title={mostrarSenhaAtual ? "Ocultar senha" : "Ver senha"}
            >
              {mostrarSenhaAtual ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Nova Senha */}
        <div>
          <label style={labelStyle}>Nova Senha</label>
          <div style={inputContainerStyle}>
            <Lock size={18} style={iconLeftStyle} />
            <input 
              type={mostrarNovaSenha ? "text" : "password"} 
              style={{ ...inputStyle, paddingRight: '38px' }}
              value={perfil.novaSenha} 
              onChange={e => setPerfil({...perfil, novaSenha: e.target.value})} 
              placeholder="Digite a nova senha"
            />
            <button 
              type="button" 
              style={eyeButtonStyle} 
              onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)}
              title={mostrarNovaSenha ? "Ocultar senha" : "Ver senha"}
            >
              {mostrarNovaSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Botão de Envio */}
        <button 
          type="submit" 
          style={{ 
            marginTop: '8px', 
            padding: '12px', 
            backgroundColor: '#2563eb', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '8px', 
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            gap: '8px',
            transition: 'background-color 0.2s ease',
            boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
          }}
        >
          <Save size={18} /> Salvar Alterações
        </button>
      </form>
    </div>
  );
}