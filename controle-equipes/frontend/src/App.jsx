import React, { useState, useEffect } from 'react';
import axios from 'axios'; 
import { LogOut, HardHat, UserPlus, CalendarX, Car, Package, Truck, FileText, Boxes, BarChart3, TrendingUp, Building2 } from 'lucide-react';
// Imports dos Componentes Existentes
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
import CadastroVeiculo from './assets/CadastroVeiculo';
import CadastroMateriais from './assets/CadastroMateriais';
import CadastroFornecedores from './assets/CadastroFornecedores';
import FaturamentoDireto from './assets/FaturamentoDireto.jsx'; 
import Base from './assets/Base.jsx'; 
import EstoqueMovimentacoes from './assets/EstoqueMovimentacoes.jsx';

const API_URL = 'http://localhost:3001/api';

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

  // CONFIGURAÇÃO DOS MENUS
  const menuItens = [
    { id: 'MASTER_CONTROLE', label: 'Criar Usuários', cargos: ['MASTER'] },
    { id: 'LISTA_VINCULOS', label: 'Usuários Ativos e Vínculos', cargos: ['MASTER'] },
    { id: 'CADASTRO_OBRAS', label: 'Gerenciar Obra', cargos: ['MASTER'] },
    { id: 'RH', label: 'Recursos Humanos', cargos: ['MASTER', 'RH'] },
    { id: 'RH_INTEGRACAO', label: 'RH - Integração', cargos: ['MASTER', 'RH'] },
    { id: 'CADASTRO_FUNCIONARIO', label: 'Cadastrar Funcionário', icon: UserPlus, cargos: ['MASTER', 'RH'] },
    { id: 'CADASTRO_VEICULO', label: 'Gerenciar Veículos', icon: Car, cargos: ['MASTER', 'RH'] },
    { id: 'EQUIPE', label: 'Agendamento de Obra', cargos: ['MASTER', 'GESTOR'] },
    { id: 'DIARIO_TECNICO', label: 'Diário de Obra', cargos: ['MASTER', 'GESTOR'] },
    { id: 'HISTORICO_DIARIOS', label: 'Histórico de Produção', cargos: ['MASTER', 'GESTOR'] },
    { id: 'HISTORICO_MATERIAIS', label: 'Histórico de Materiais', cargos: ['MASTER', 'GESTOR'] },
    { id: 'PRESENCA', label: 'Controle de Presença', cargos: ['MASTER', 'GESTOR', 'RH'] },
    { id: 'DIAS_PENDENTES', label: 'Diários Pendentes', icon: CalendarX, cargos: ['MASTER', 'GESTOR'] },
    
    // ABAS EXCLUSIVAS PARA O CARGO MASTER
    { id: 'CADASTRO_MATERIAIS', label: 'Cadastrar Materiais', icon: Package, cargos: ['MASTER'] },
    { id: 'CADASTRO_FORNECEDORES', label: 'Cadastrar Fornecedores', icon: Truck, cargos: ['MASTER'] },
    { id: 'FATURAMENTO_DIRETO', label: 'Faturamento Direto', icon: FileText, cargos: ['MASTER'] },
    
    
    { id: 'BASE', label: 'Gerenciar Bases', icon: Building2, cargos: ['MASTER'] },
    
    { id: 'ESTOQUE', label: 'Estoque', icon: Boxes, cargos: ['MASTER'] },
    { id: 'ESTOQUE_MOVIMENTACOES', label: 'Movimentações', icon: TrendingUp, cargos: ['MASTER'] },
    { id: 'RELATORIO_COMPRAS', label: 'Relatório de Compras', icon: BarChart3, cargos: ['MASTER'] },
    { id: 'RELATORIO_MOVIMENTACAO', label: 'Relatório de Movimentação', icon: TrendingUp, cargos: ['MASTER'] },
  ];

  // Função para definir a aba inicial dinâmica de acordo com o cargo
  const definirAbaInicial = (cargo) => {
    const cargoNormalizado = cargo?.toString().trim().toUpperCase();
    
    if (cargoNormalizado === 'GESTOR') {
      return 'EQUIPE';
    } else if (cargoNormalizado === 'MASTER') {
      return 'MASTER_CONTROLE';
    } else {
      return 'RH';
    }
  };

  useEffect(() => {
    const usuarioSalvo = localStorage.getItem('usuario');
    if (usuarioSalvo) {
      try {
        const user = JSON.parse(usuarioSalvo);
        setUsuarioLogado(user);
        setAbaAtiva(definirAbaInicial(user.cargo));
      } catch (e) {
        localStorage.removeItem('usuario');
      }
    }
  }, []);

  useEffect(() => {
    const uid = usuarioLogado?.id || usuarioLogado?.id_usuario;
    if (uid) {
      carregarObrasBanco();
      const cargoNormalizado = usuarioLogado?.cargo?.toString().trim().toUpperCase();

      if (cargoNormalizado === 'MASTER') {
        carregarUsuariosMaster();
        carregarFuncionariosGeral(); 
      } else if (cargoNormalizado === 'RH') {
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
        params: { id: uid, cargo: usuarioLogado.cargo }
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
      setListaFuncionarios(Array.isArray(res.data) ? res.data : res.data?.funcionarios || []);
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
        const usuario = resposta.data.usuario;
        localStorage.setItem('usuario', JSON.stringify(usuario));
        setUsuarioLogado(usuario);
        setAbaAtiva(definirAbaInicial(usuario.cargo));
      }
    } catch (err) {
      console.error("Erro ao logar:", err);
      setErroLogin(err.response?.data?.error || "Erro ao tentar logar no servidor.");
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
    setAbaAtiva('RH');
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

  const menusPermitidos = menuItens.filter(item => item.cargos.includes(usuarioLogado.cargo));

  return (
    <div style={{ minHeight: '100vh', width: '100vw', backgroundColor: '#f1f5f9', fontFamily: 'sans-serif', fontSize: '12px', color: '#1e293b', display: 'flex', flexDirection: 'column' }}>
      
      {/* CABEÇALHO */}
      <header style={{ backgroundColor: '#0f172a', color: '#fff', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box', flexWrap: 'wrap', gap: '8px' }}>
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

      {/* RENDERIZAÇÃO DAS ABAS */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', padding: '8px 16px', display: 'flex', flexWrap: 'wrap', gap: '6px', width: '100%', boxSizing: 'border-box' }}>
        {menusPermitidos.map((menu) => {
          const Icone = menu.icon;
          const ativo = abaAtiva === menu.id;
          return (
            <button
              key={menu.id}
              onClick={() => setAbaAtiva(menu.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                height: '28px',
                padding: '0 12px',
                fontSize: '10px',
                fontWeight: 'bold',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: ativo ? '#1e293b' : 'transparent',
                color: ativo ? '#fff' : '#475569',
                whiteSpace: 'nowrap'
              }}
            >
              {Icone && <Icone style={{ width: '12px', height: '12px' }} />}
              <span>{menu.label}</span>
            </button>
          );
        })}
      </div>
        
      {mensagem.texto && (
        <div style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 50, padding: '12px', borderRadius: '4px', border: '1px solid', fontSize: '11px', backgroundColor: mensagem.tipo === 'sucesso' ? '#f0fdf4' : '#fef2f2', color: mensagem.tipo === 'sucesso' ? '#166534' : '#991b1b' }}>{mensagem.texto}</div>
      )}

      {/* CONTEÚDO DA ABA SELECIONADA */}
      <main style={{ padding: '16px', flex: 1, width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}>
          
          {abaAtiva === 'MASTER_CONTROLE' && (
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

          {abaAtiva === 'LISTA_VINCULOS' && (
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

          {abaAtiva === 'CADASTRO_OBRAS' && <CadastroObras listaObrasGlobal={listaObrasBanco} recarregarObrasGlobal={carregarObrasBanco} />}
          {abaAtiva === 'RH' && <RecursosHumanos listaFuncionarios={listaFuncionarios} recarregarFuncionariosGlobal={carregarFuncionariosGeral} API_URL={API_URL} mostrarMensagemGlobal={mostrarMensagem} />}
          {abaAtiva === 'RH_INTEGRACAO' && <RhIntegracao API_URL={API_URL} mostrarMensagemGlobal={mostrarMensagem} recarregarFuncionariosGeral={carregarFuncionariosGeral} />}
          {abaAtiva === 'CADASTRO_FUNCIONARIO' && <CadastroFuncionario usuarioLogado={usuarioLogado} recarregarFuncionariosGlobal={carregarFuncionariosGeral} />}
          {abaAtiva === 'CADASTRO_VEICULO' && <CadastroVeiculo usuarioLogado={usuarioLogado} />}
          {abaAtiva === 'EQUIPE' && <DiarioEfetivo obrasDisponiveis={listaObrasBanco} usuarioLogado={usuarioLogado} />}
          {abaAtiva === 'DIARIO_TECNICO' && <DiarioObraTecnico obrasDisponiveis={listaObrasBanco} usuarioLogado={usuarioLogado} />}
          {abaAtiva === 'HISTORICO_DIARIOS' && <HistoricoDiarios id={usuarioLogado.id} cargo={usuarioLogado.cargo} />}
          {abaAtiva === 'HISTORICO_MATERIAIS' && <HistoricoMateriais id={usuarioLogado.id} cargo={usuarioLogado.cargo} />}
          {abaAtiva === 'PRESENCA' && <HistoricoPresenca cargo={usuarioLogado.cargo} id={usuarioLogado.id} />}
          {abaAtiva === 'DIAS_PENDENTES' && <DiasPendentes id={usuarioLogado.id} cargo={usuarioLogado.cargo} />}

          {/* ABAS EXCLUSIVAS MASTER */}
          {abaAtiva === 'CADASTRO_MATERIAIS' && usuarioLogado.cargo === 'MASTER' && (
            <CadastroMateriais API_URL={API_URL} mostrarMensagem={mostrarMensagem} />
          )}
          {abaAtiva === 'CADASTRO_FORNECEDORES' && usuarioLogado.cargo === 'MASTER' && (
            <CadastroFornecedores API_URL={API_URL} mostrarMensagem={mostrarMensagem} />
          )}
          
          {/* COMPONENTE CONECTADO */}
          {abaAtiva === 'FATURAMENTO_DIRETO' && usuarioLogado.cargo === 'MASTER' && (
            <FaturamentoDireto API_URL={API_URL} mostrarMensagem={mostrarMensagem} />
          )}

          {abaAtiva === 'BASE' && usuarioLogado.cargo === 'MASTER' && (
            <Base API_URL={API_URL} mostrarMensagem={mostrarMensagem} />
          )}

          {abaAtiva === 'ESTOQUE_MOVIMENTACOES' && usuarioLogado.cargo === 'MASTER' && (
              <EstoqueMovimentacoes 
                API_URL={API_URL} 
                mostrarMensagem={mostrarMensagem} 
                usuarioLogado={usuarioLogado} 
              />
            )}

          {abaAtiva === 'ESTOQUE' && usuarioLogado.cargo === 'MASTER' && (
                        <div>Relatório de Compras em desenvolvimento...</div>

          )}

          {abaAtiva === 'RELATORIO_COMPRAS' && usuarioLogado.cargo === 'MASTER' && (
            <div>Relatório de Compras em desenvolvimento...</div>
          )}
          {abaAtiva === 'RELATORIO_MOVIMENTACAO' && usuarioLogado.cargo === 'MASTER' && (
            <div>Relatório de Movimentação em desenvolvimento...</div>
          )}

        </div>
      </main>
    </div>
  );
}