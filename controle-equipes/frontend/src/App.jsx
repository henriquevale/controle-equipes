import React, { useState, useEffect } from 'react';
import axios from 'axios'; 
import { LogOut, HardHat, UserPlus, CalendarX, BarChart3, Car } from 'lucide-react';
import DiarioEfetivo from './assets/DiarioEfetivo.jsx';
import DiarioObraTecnico from './assets/DiarioObraTecnico.jsx'; 
import HistoricoDiarios from './assets/HistoricoDiarios.jsx';
import HistoricoPresenca from './assets/HistoricoPresenca.jsx'; 
import ControleMaster from './assets/ControleMaster';
import CadastroObras from './assets/CadastroObras';
import ListaVinculos from './assets/ListaVinculos';
import RecursosHumanos from './assets/RecursosHumanos';
import HistoricoMateriais from './assets/HistoricoMateriais'; 
import CadastroFuncionario from './assets/CadastroFuncionario'; 
import RhIntegracao from './assets/RhIntegracao';
import DiasPendentes from './assets/DiasPendentes.jsx'; 
import ResumoStatusObra from './assets/ResumoStatusObra.jsx';
import CadastroVeiculo from './assets/CadastroVeiculo'; // 👈 NOVO: Importação do componente de veículos

// Em vez de: const API_URL = 'http://localhost:3001/api';
const API_URL = 'https://controle-equipes.onrender.com/api'; //i

export default function App() {
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [credenciais, setCredenciais] = useState({ usuario: '', senha: '' });
  const [erroLogin, setErroLogin] = useState('');
  const [abaAtiva, setAbaAtiva] = useState('EQUIPE'); 
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });
  
  const [listaObrasBanco, setListaObrasBanco] = useState([]);
  const [listaUsuarios, setListaUsuarios] = useState([]);
  const [listaFuncionarios, setListaFuncionarios] = useState([]);
  const [usuarioSendoEditado, setUsuarioSendoEditado] = useState(null);

  useEffect(() => {
    const usuarioSalvo = localStorage.getItem('usuario');
    if (usuarioSalvo) {
      try {
        setUsuarioLogado(JSON.parse(usuarioSalvo));
      } catch (e) {
        localStorage.removeItem('usuario');
      }
    }
  }, []);

  useEffect(() => {
    if (usuarioLogado?.id || usuarioLogado?.id_usuario) {
      carregarObrasBanco();
      
      if (usuarioLogado.cargo === 'MASTER') {
        carregarUsuariosMaster();
        carregarFuncionariosGeral(); 
      } else if (usuarioLogado.cargo === 'RH') {
        carregarFuncionariosGeral(); 
      }
    }
  }, [usuarioLogado?.id, usuarioLogado?.id_usuario, usuarioLogado?.cargo]); 

  const carregarUsuariosMaster = async () => {
    try {
      const res = await axios.get(`${API_URL}/master/usuarios`);
      setListaUsuarios(res.data || []);
    } catch (e) { 
      console.error("Erro ao carregar usuários master:", e);
      setListaUsuarios([]); 
    }
  };

  const carregarObrasBanco = async () => {
    const uid = usuarioLogado?.id || usuarioLogado?.id_usuario;
    if (!uid) return;
    try {
      const res = await axios.get(`${API_URL}/gestor/obras-ativas`, {
        params: { 
          id: uid, 
          cargo: usuarioLogado.cargo 
        }
      });
      setListaObrasBanco(res.data || []);
    } catch (e) { 
      console.error("Erro na requisição de obras:", e);
      setListaObrasBanco([]);
      mostrarMensagem('Erro de comunicação: Não foi possível carregar as obras.', 'erro');
    }
  };

  const carregarFuncionariosGeral = async () => {
    try {
      const res = await axios.get(`${API_URL}/funcionarios`); 
      setListaFuncionarios(res.data || []);
    } catch (e) { 
      console.error("Erro ao carregar funcionários gerais:", e);
      setListaFuncionarios([]); 
    }
  };

  const mostrarMensagem = (texto, tipo) => {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem({ texto: '', tipo: '' }), 4000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErroLogin('');

    if (!credenciais.usuario || !credenciais.senha) {
      return setErroLogin('Por favor, digite o usuário e a senha.');
    }

    try {
      const resposta = await axios.post(`${API_URL}/login`, {
        usuario: credenciais.usuario,
        senha: credenciais.senha
      });

      if (resposta.data.success) {
        localStorage.setItem('usuario', JSON.stringify(resposta.data.usuario));
        setUsuarioLogado(resposta.data.usuario);
        
        const cargo = resposta.data.usuario.cargo;
        if (cargo === 'RH') {
          setAbaAtiva('RH');
        } else if (cargo === 'MASTER') {
          setAbaAtiva('MASTER_CONTROLE');
        } else {
          setAbaAtiva('EQUIPE'); 
        }
      }
    } catch (err) {
      console.error("Erro ao logar:", err);
      const mensagemErro = err.response?.data?.error || "Erro ao tentar logar no servidor.";
      setErroLogin(mensagemErro);
    }
  };

  const handleLogout = () => { 
    localStorage.removeItem('usuario');
    setUsuarioLogado(null); 
    setListaObrasBanco([]);
    setListaUsuarios([]);
    setListaFuncionarios([]);
    setUsuarioSendoEditado(null);
    setCredenciais({ usuario: '', senha: '' }); 
    setAbaAtiva('EQUIPE');
  };

  if (!usuarioLogado) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', fontFamily: 'sans-serif' }}>
        <form onSubmit={handleLogin} style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '6px', width: '100%', maxWidth: '320px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', justifyContent: 'center' }}>
            <HardHat style={{ color: '#2563eb', width: '24px', height: '24px' }} />
            <h2 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase', margin: 0 }}>Acesso ao Sistema</h2>
          </div>
          {erroLogin && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '11px', padding: '8px', borderRadius: '4px', marginBottom: '12px', textAlign: 'center', fontWeight: 'bold' }}>{erroLogin}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input type="text" placeholder="Usuário" style={{ height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }} value={credenciais.usuario} onChange={e => setCredenciais({...credenciais, usuario: e.target.value})} />
            <input type="password" placeholder="Senha" style={{ height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }} value={credenciais.senha} onChange={e => setCredenciais({...credenciais, senha: e.target.value})} />
            <button type="submit" style={{ height: '34px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', fontSize: '11px', marginTop: '4px' }}>Entrar no Painel</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', width: '100vw', backgroundColor: '#f1f5f9', fontFamily: 'sans-serif', fontSize: '12px', color: '#1e293b', display: 'flex', flexDirection: 'column' }}>
      <header style={{ backgroundColor: '#0f172a', color: '#fff', height: '44px', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HardHat style={{ color: '#60a5fa', width: '16px', height: '16px' }} />
          <span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '11px' }}>Sistema Unificado de Engenharia</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ backgroundColor: '#1e293b', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', color: '#cbd5e1' }}>{usuarioLogado.nome} ({usuarioLogado.cargo})</span>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', fontSize: '10px' }}>
            <LogOut style={{ width: '14px', height: '14px' }} /> <span>Sair</span>
          </button>
        </div>
      </header>

      {/* MENUS / ABAS DE NAVEGAÇÃO */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', padding: '4px 16px', display: 'flex', gap: '6px', width: '100%', boxSizing: 'border-box', overflowX: 'auto' }}>
        {usuarioLogado.cargo === 'MASTER' && (
          <>
            <button onClick={() => setAbaAtiva('MASTER_CONTROLE')} style={{ height: '28px', padding: '0 12px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: abaAtiva === 'MASTER_CONTROLE' ? '#1e293b' : 'transparent', color: abaAtiva === 'MASTER_CONTROLE' ? '#fff' : '#475569', whiteSpace: 'nowrap' }}>Criar Usuários</button>
            <button onClick={() => setAbaAtiva('LISTA_VINCULOS')} style={{ height: '28px', padding: '0 12px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: abaAtiva === 'LISTA_VINCULOS' ? '#1e293b' : 'transparent', color: abaAtiva === 'LISTA_VINCULOS' ? '#fff' : '#475569', whiteSpace: 'nowrap' }}>Usuários Ativos e Vínculos</button>
            <button onClick={() => setAbaAtiva('CADASTRO_OBRAS')} style={{ height: '28px', padding: '0 12px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: abaAtiva === 'CADASTRO_OBRAS' ? '#1e293b' : 'transparent', color: abaAtiva === 'CADASTRO_OBRAS' ? '#fff' : '#475569', whiteSpace: 'nowrap' }}>Gerenciar Obras</button>
          </>
        )}
        {(usuarioLogado.cargo === 'RH' || usuarioLogado.cargo === 'MASTER') && (
          <>
            <button onClick={() => setAbaAtiva('RH')} style={{ height: '28px', padding: '0 12px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: abaAtiva === 'RH' ? '#1e293b' : 'transparent', color: abaAtiva === 'RH' ? '#fff' : '#475569', whiteSpace: 'nowrap' }}>Recursos Humanos</button>
            <button onClick={() => setAbaAtiva('RH_INTEGRACAO')} style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '28px', padding: '0 12px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: abaAtiva === 'RH_INTEGRACAO' ? '#1e293b' : 'transparent', color: abaAtiva === 'RH_INTEGRACAO' ? '#fff' : '#475569', whiteSpace: 'nowrap' }}>
              <span>⏳ RH - Integração</span>
            </button>
            <button onClick={() => setAbaAtiva('CADASTRO_FUNCIONARIO')} style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '28px', padding: '0 12px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: abaAtiva === 'CADASTRO_FUNCIONARIO' ? '#1e293b' : 'transparent', color: abaAtiva === 'CADASTRO_FUNCIONARIO' ? '#fff' : '#475569', whiteSpace: 'nowrap' }}>
              <UserPlus style={{ width: '12px', height: '12px' }} />
              <span>Cadastrar Funcionário</span>
            </button>
            
            {/* 🟢 ADICIONADO: Menu para cadastro de veículos visível para RH e MASTER */}
            <button onClick={() => setAbaAtiva('CADASTRO_VEICULO')} style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '28px', padding: '0 12px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: abaAtiva === 'CADASTRO_VEICULO' ? '#1e293b' : 'transparent', color: abaAtiva === 'CADASTRO_VEICULO' ? '#fff' : '#475569', whiteSpace: 'nowrap' }}>
              <Car style={{ width: '12px', height: '12px' }} />
              <span>Gerenciar Veículos</span>
            </button>
          </>
        )}
        {(usuarioLogado.cargo === 'MASTER' || usuarioLogado.cargo === 'GESTOR') && (
          <>
            <button onClick={() => setAbaAtiva('EQUIPE')} style={{ height: '28px', padding: '0 12px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: abaAtiva === 'EQUIPE' ? '#1e293b' : 'transparent', color: abaAtiva === 'EQUIPE' ? '#fff' : '#475569', whiteSpace: 'nowrap' }}>Agendamento de Obra</button>
            <button onClick={() => setAbaAtiva('DIARIO_TECNICO')} style={{ height: '28px', padding: '0 12px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: abaAtiva === 'DIARIO_TECNICO' ? '#1e293b' : 'transparent', color: abaAtiva === 'DIARIO_TECNICO' ? '#fff' : '#475569', whiteSpace: 'nowrap' }}>Diário de Obra</button>
            <button onClick={() => setAbaAtiva('HISTORICO_DIARIOS')} style={{ height: '28px', padding: '0 12px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: abaAtiva === 'HISTORICO_DIARIOS' ? '#1e293b' : 'transparent', color: abaAtiva === 'HISTORICO_DIARIOS' ? '#fff' : '#475569', whiteSpace: 'nowrap' }}>Histórico e Produção</button>
            
            <button onClick={() => setAbaAtiva('DIAS_PENDENTES')} style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '28px', padding: '0 12px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: abaAtiva === 'DIAS_PENDENTES' ? '#1e293b' : 'transparent', color: abaAtiva === 'DIAS_PENDENTES' ? '#fff' : '#475569', whiteSpace: 'nowrap' }}>
              <CalendarX style={{ width: '12px', height: '12px' }} />
              <span>Diários Pendentes</span>
            </button>
{/* COMENTADO TEMPORARIAMENTE PARA TRABALHAR MAIS PARA FRENTE
            <button onClick={() => setAbaAtiva('RESUMO_OBRAS')} style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '28px', padding: '0 12px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: abaAtiva === 'RESUMO_OBRAS' ? '#1e293b' : 'transparent', color: abaAtiva === 'RESUMO_OBRAS' ? '#fff' : '#475569', whiteSpace: 'nowrap' }}>
              <BarChart3 style={{ width: '12px', height: '12px' }} />
              <span>Indicadores da Obra</span>
            </button>
*/}
            <button onClick={() => setAbaAtiva('HISTORICO_MATERIAIS')} style={{ height: '28px', padding: '0 12px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: abaAtiva === 'HISTORICO_MATERIAIS' ? '#1e293b' : 'transparent', color: abaAtiva === 'HISTORICO_MATERIAIS' ? '#fff' : '#475569', whiteSpace: 'nowrap' }}>Histórico de Materiais</button>
            <button onClick={() => setAbaAtiva('PRESENCA')} style={{ height: '28px', padding: '0 12px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: abaAtiva === 'PRESENCA' ? '#1e293b' : 'transparent', color: abaAtiva === 'PRESENCA' ? '#fff' : '#475569', whiteSpace: 'nowrap' }}>Controle de Presença</button>
          </>
        )}
      </div>

      {mensagem.texto && (
        <div style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 50, padding: '12px', borderRadius: '4px', border: '1px solid', fontSize: '11px', backgroundColor: mensagem.tipo === 'sucesso' ? '#f0fdf4' : '#fef2f2', color: mensagem.tipo === 'sucesso' ? '#166534' : '#991b1b' }}>{mensagem.texto}</div>
      )}

      {/* CONTEÚDO PRINCIPAL DO PAINEL */}
      <main style={{ padding: '16px', flex: 1, width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        {abaAtiva === 'EQUIPE' && (usuarioLogado.cargo === 'MASTER' || usuarioLogado.cargo === 'GESTOR') && (
          <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}>
            <DiarioEfetivo obrasDisponiveis={listaObrasBanco} usuarioLogado={usuarioLogado} />
          </div>
        )}

        {abaAtiva === 'RH_INTEGRACAO' && (usuarioLogado.cargo === 'MASTER' || usuarioLogado.cargo === 'RH') && (
          <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}>
            <RhIntegracao API_URL={API_URL} mostrarMensagemGlobal={mostrarMensagem} recarregarFuncionariosGeral={carregarFuncionariosGeral} />
          </div>
        )}
        {abaAtiva === 'DIARIO_TECNICO' && (usuarioLogado.cargo === 'MASTER' || usuarioLogado.cargo === 'GESTOR') && (
          <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}>
            <DiarioObraTecnico obrasDisponiveis={listaObrasBanco} usuarioLogado={usuarioLogado} />
          </div>
        )}

        {abaAtiva === 'HISTORICO_DIARIOS' && (usuarioLogado.cargo === 'MASTER' || usuarioLogado.cargo === 'GESTOR') && (
          <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}>
            <HistoricoDiarios id={usuarioLogado.id} cargo={usuarioLogado.cargo} />
          </div>
        )}

        {abaAtiva === 'DIAS_PENDENTES' && (usuarioLogado.cargo === 'MASTER' || usuarioLogado.cargo === 'GESTOR') && (
          <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}>
            <DiasPendentes id={usuarioLogado.id} cargo={usuarioLogado.cargo} />
          </div>
        )}
{/* COMENTADO TEMPORARIAMENTE
        {abaAtiva === 'RESUMO_OBRAS' && (usuarioLogado.cargo === 'MASTER' || usuarioLogado.cargo === 'GESTOR') && (
          <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}>
            <ResumoStatusObra id={usuarioLogado.id} cargo={usuarioLogado.cargo} />
          </div>
        )}
*/}
        {/* 🟢 ADICIONADO: Bloco condicional para renderizar a tela de Veículos */}
        {abaAtiva === 'CADASTRO_VEICULO' && (usuarioLogado.cargo === 'MASTER' || usuarioLogado.cargo === 'RH') && (
          <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}>
            <CadastroVeiculo usuarioLogado={usuarioLogado} />
          </div>
        )}

        {abaAtiva === 'HISTORICO_MATERIAIS' && (usuarioLogado.cargo === 'MASTER' || usuarioLogado.cargo === 'GESTOR') && (
          <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}>
            <HistoricoMateriais id={usuarioLogado.id} cargo={usuarioLogado.cargo} />
          </div>
        )}

        {abaAtiva === 'PRESENCA' && (usuarioLogado.cargo === 'MASTER' || usuarioLogado.cargo === 'GESTOR') && (
          <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}>
            <HistoricoPresenca cargo={usuarioLogado.cargo} id={usuarioLogado.id} />
          </div>
        )}

        {abaAtiva === 'RH' && (usuarioLogado.cargo === 'MASTER' || usuarioLogado.cargo === 'RH') && (
          <RecursosHumanos 
            listaFuncionarios={listaFuncionarios}
            recarregarFuncionariosGlobal={carregarFuncionariosGeral}
            API_URL={API_URL}
            mostrarMensagemGlobal={mostrarMensagem}
          />
        )}

        {abaAtiva === 'CADASTRO_FUNCIONARIO' && (usuarioLogado.cargo === 'MASTER' || usuarioLogado.cargo === 'RH') && (
          <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}>
            <CadastroFuncionario 
              usuarioLogado={usuarioLogado} 
              recarregarFuncionariosGlobal={carregarFuncionariosGeral} 
            />
          </div>
        )}

        {abaAtiva === 'MASTER_CONTROLE' && usuarioLogado.cargo === 'MASTER' && (
          <ControleMaster 
            API_URL={API_URL} 
            recarregarUsuariosGlobal={carregarUsuariosMaster}
            usuarioParaEditar={usuarioSendoEditado}
            finalizarEdicaoGlobal={() => {
              setUsuarioSendoEditado(null);
              setAbaAtiva('LISTA_VINCULOS');
            }}
          />
        )}

        {abaAtiva === 'LISTA_VINCULOS' && usuarioLogado.cargo === 'MASTER' && (
          <ListaVinculos 
            listaUsuarios={listaUsuarios} 
            recarregarUsuariosGlobal={carregarUsuariosMaster}
            API_URL={API_URL}
            mostrarMensagemGlobal={mostrarMensagem}
            dispararEdicaoGlobal={(user) => {
              setUsuarioSendoEditado(user);
              setAbaAtiva('MASTER_CONTROLE');
            }}
          />
        )}
  
        {abaAtiva === 'CADASTRO_OBRAS' && usuarioLogado.cargo === 'MASTER' && (
          <CadastroObras 
            listaObrasGlobal={listaObrasBanco} 
            recarregarObrasGlobal={carregarObrasBanco} 
          />
        )}
      </main>
    </div>
  );
}