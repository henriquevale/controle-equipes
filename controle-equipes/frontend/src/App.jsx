import { useState, useEffect } from 'react';
import axios from 'axios'; 
import { 
  LogOut, HardHat, UserPlus, CalendarX, Car, Package, Truck, 
  FileText, Boxes, BarChart3, TrendingUp, Building2, Shield, 
  Users, FolderKanban, ChevronDown, ChevronRight, Menu, X,Wrench, ClipboardList
} from 'lucide-react';

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
import EstoqueSaldos from './assets/EstoqueSaldos.jsx';
import RelatorioMovimentacao from './assets/RelatorioMovimentacoes.jsx';
import RelatorioCompras from './assets/RelatorioCompras.jsx';
import RelatorioVeiculoUsados from './assets/RelatorioVeiculoUsados.jsx';
import CadastroItensManutencao from './assets/CadastroItensManutencao';
import RelatorioManutencaoVeiculos from './assets/RelatorioManutencaoVeiculos.jsx';

const API_URL = 'http://localhost:3001/api';

export default function App() {
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [credenciais, setCredenciais] = useState({ usuario: '', senha: '' });
  const [erroLogin, setErroLogin] = useState('');
  const [abaAtiva, setAbaAtiva] = useState('EQUIPE'); 
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });
  
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarAberto, setSidebarAberto] = useState(window.innerWidth >= 768);

  const [gruposAbertos, setGruposAbertos] = useState({
    ADMIN: false,
    OBRAS: false,
    MATERIAIS: false,
    FROTAS: false,
    RH: false
  });
  
  const [listaObrasBanco, setListaObrasBanco] = useState([]);
  const [listaUsuarios, setListaUsuarios] = useState([]);
  const [listaFuncionarios, setListaFuncionarios] = useState([]);
  const [usuarioSendoEditado, setUsuarioSendoEditado] = useState(null);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarAberto(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

const estruturaMenu = [
    {
      idGrupo: 'ADMIN',
      titulo: 'Administração',
      icone: Shield,
      itens: [
        { id: 'MASTER_CONTROLE', label: 'Criar Usuários', icon: UserPlus, cargos: ['MASTER'] },
        { id: 'LISTA_VINCULOS', label: 'Usuários Ativos e Vínculos', icon: Users, cargos: ['MASTER'] },
        { id: 'CADASTRO_OBRAS', label: 'Gerenciar Obras', icon: FolderKanban, cargos: ['MASTER'] },
      ]
    },
    {
      idGrupo: 'OBRAS',
      titulo: 'Campo & Produção',
      icone: HardHat,
      itens: [
        { id: 'EQUIPE', label: 'Agendamento de Obra', icon: CalendarX, cargos: ['MASTER', 'GESTOR'] },
        { id: 'DIARIO_TECNICO', label: 'Diário de Obra', icon: ClipboardList, cargos: ['MASTER', 'GESTOR'] },
        { id: 'HISTORICO_DIARIOS', label: 'Histórico de Produção', icon: BarChart3, cargos: ['ENGENHARIA', 'MASTER', 'GESTOR'] },
        { id: 'DIAS_PENDENTES', label: 'Diários Pendentes', icon: CalendarX, cargos: ['ENGENHARIA', 'MASTER', 'GESTOR'] },
        { id: 'HISTORICO_MATERIAIS', label: 'Histórico de Materiais', icon: TrendingUp, cargos: ['ENGENHARIA', 'MASTER', 'GESTOR'] },
      ]
    },
    {
      idGrupo: 'MATERIAIS',
      titulo: 'Materiais & Estoque',
      icone: Boxes,
      itens: [
        { id: 'FATURAMENTO_DIRETO', label: 'Faturamento Direto', icon: FileText, cargos: ['ENGENHARIA', 'MASTER'] },
        { id: 'CADASTRO_MATERIAIS', label: 'Cadastrar Materiais', icon: Package, cargos: ['ENGENHARIA', 'MASTER'] },
        { id: 'CADASTRO_FORNECEDORES', label: 'Cadastrar Fornecedores', icon: Truck, cargos: ['ENGENHARIA', 'MASTER'] },
        { id: 'BASE', label: 'Gerenciar Bases', icon: Building2, cargos: ['ENGENHARIA', 'MASTER'] },
        { id: 'ESTOQUE', label: 'Estoque Saldos', icon: Boxes, cargos: ['ENGENHARIA', 'MASTER'] },
        { id: 'ESTOQUE_MOVIMENTACOES', label: 'Movimentações Estoque', icon: TrendingUp, cargos: ['MASTER'] },
        { id: 'RELATORIO_COMPRAS', label: 'Relatório de Compras', icon: BarChart3, cargos: ['MASTER'] },
        { id: 'RELATORIO_MOVIMENTACAO', label: 'Relatório Movimentação', icon: TrendingUp, cargos: ['MASTER'] },
      ]
    },
    {
      idGrupo: 'FROTAS',
      titulo: 'Frota & Logística',
      icone: Car,
      itens: [
        { id: 'CADASTRO_VEICULO', label: 'Gerenciar Veículos', icon: Car, cargos: ['MASTER', 'RH'] },
        { id: 'CADASTRO_ITENS_MANUTENCAO', label: 'Itens de Manutenção', icon: Wrench, cargos: ['MASTER', 'RH'] },
        { id: 'RELATORIO_VEICULOS', label: 'Relatório de Veículos', icon: FileText, cargos: ['MASTER', 'RH', 'GESTOR', 'ENGENHARIA'] },
        { id: 'RELATORIO_MANUTENCAO_VEICULOS', label: 'Relatório de Manutenção de Veículos', icon: FileText, cargos: ['MASTER', 'RH', 'GESTOR', 'ENGENHARIA'] },
      ]
    },
    {
      idGrupo: 'RH',
      titulo: 'Recursos Humanos',
      icone: Users,
      itens: [
        { id: 'RH', label: 'Gestão RH', icon: Users, cargos: ['MASTER', 'RH'] },
        { id: 'RH_INTEGRACAO', label: 'RH - Integração', icon: Users, cargos: ['MASTER', 'RH'] },
        { id: 'CADASTRO_FUNCIONARIO', label: 'Cadastrar Funcionário', icon: UserPlus, cargos: ['MASTER', 'RH'] },
        { id: 'PRESENCA', label: 'Controle de Presença', icon: CalendarX, cargos: ['MASTER', 'RH'] },
      ]
    }
  ];

  const toggleGrupo = (idGrupo) => {
    setGruposAbertos(prev => ({ ...prev, [idGrupo]: !prev[idGrupo] }));
  };

  const definirAbaInicial = (cargo) => {
    const cargoNormalizado = cargo?.toString().trim().toUpperCase();
    if (cargoNormalizado === 'ENGENHARIA') return 'FATURAMENTO_DIRETO';
    if (cargoNormalizado === 'GESTOR') return 'EQUIPE';
    if (cargoNormalizado === 'MASTER') return 'MASTER_CONTROLE';
    return 'RH';
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
      setListaObrasBanco([]);
      mostrarMensagem('Erro ao carregar obras.', 'erro');
    }
  };

  const carregarFuncionariosGeral = async () => {
    try {
      const res = await axios.get(`${API_URL}/funcionarios`); 
      setListaFuncionarios(Array.isArray(res.data) ? res.data : res.data?.funcionarios || []);
    } catch (e) { 
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
      setErroLogin(err.response?.data?.error || "Erro ao tentar logar.");
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', fontFamily: 'sans-serif', padding: '16px', boxSizing: 'border-box' }}>
        <form onSubmit={handleLogin} style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '100%', maxWidth: '360px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', justifyContent: 'center' }}>
            <HardHat style={{ color: '#2563eb', width: '28px', height: '28px' }} />
            <h2 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase', margin: 0, textAlign: 'center' }}>Acesso ao Sistema</h2>
          </div>
          {erroLogin && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '12px', padding: '10px', borderRadius: '6px', marginBottom: '14px', textAlign: 'center', fontWeight: 'bold' }}>{erroLogin}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input type="text" placeholder="Usuário" style={{ height: '38px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} value={credenciais.usuario} onChange={e => setCredenciais({...credenciais, usuario: e.target.value})} />
            <input type="password" placeholder="Senha" style={{ height: '38px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} value={credenciais.senha} onChange={e => setCredenciais({...credenciais, senha: e.target.value})} />
            <button type="submit" style={{ height: '40px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', fontSize: '12px', marginTop: '6px' }}>Entrar no Painel</button>
          </div>
        </form>
      </div>
    );
  }

  const cargoUser = usuarioLogado.cargo;

  return (
    <div style={{ height: '100vh', width: '100%', backgroundColor: '#f8fafc', fontFamily: 'sans-serif', fontSize: '12px', color: '#1e293b', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      
      {/* CABEÇALHO */}
      <header style={{ backgroundColor: '#0f172a', color: '#fff', height: '50px', padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box', zIndex: 40, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={() => setSidebarAberto(!sidebarAberto)} 
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '6px', borderRadius: '4px', backgroundColor: '#1e293b' }}
          >
            {sidebarAberto ? <X style={{ width: '18px', height: '18px' }} /> : <Menu style={{ width: '18px', height: '18px' }} />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <HardHat style={{ color: '#60a5fa', width: '20px', height: '20px', flexShrink: 0 }} />
            <span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: isMobile ? '10px' : '12px', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
              {isMobile ? 'Sistema Engenharia' : 'Sistema Unificado de Engenharia'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ backgroundColor: '#1e293b', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', color: '#cbd5e1', border: '1px solid #334155', maxWidth: isMobile ? '100px' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {usuarioLogado.nome} {!isMobile && <strong style={{ color: '#60a5fa' }}>({usuarioLogado.cargo})</strong>}
          </span>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', fontSize: '11px' }}>
            <LogOut style={{ width: '15px', height: '15px' }} /> <span>{!isMobile && 'Sair'}</span>
          </button>
        </div>
      </header>

      {/* ÁREA PRINCIPAL DA APLICAÇÃO */}
      <div style={{ display: 'flex', flex: 1, width: '100%', height: 'calc(100vh - 50px)', overflow: 'hidden', position: 'relative' }}>
        
        {/* MÁSCARA ESCURA PARA MOBILE */}
        {isMobile && sidebarAberto && (
          <div 
            onClick={() => setSidebarAberto(false)} 
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 45 }}
          />
        )}

        {/* SIDEBAR COMPLETA ATÉ O FIM DA TELA */}
        <aside 
          style={{ 
            position: isMobile ? 'absolute' : 'relative',
            top: 0,
            left: 0,
            bottom: 0,
            zIndex: isMobile ? 50 : 10,
            width: sidebarAberto ? '250px' : '0px', 
            minWidth: sidebarAberto ? '250px' : '0px',
            transform: isMobile ? (sidebarAberto ? 'translateX(0)' : 'translateX(-100%)') : 'none',
            transition: 'all 0.2s ease-in-out', 
            backgroundColor: '#0f172a', 
            borderRight: sidebarAberto ? '1px solid #1e293b' : 'none', 
            display: 'flex', 
            flexDirection: 'column', 
            overflowY: 'auto', 
            overflowX: 'hidden',
            boxSizing: 'border-box',
            height: '100%',
            flexShrink: 0
          }}
        >
          <div style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {estruturaMenu.map(grupo => {
              const itensPermitidos = grupo.itens.filter(item => item.cargos.includes(cargoUser));
              if (itensPermitidos.length === 0) return null;

              const IconeGrupo = grupo.icone;
              const estaAberto = gruposAbertos[grupo.idGrupo];

              return (
                <div key={grupo.idGrupo} style={{ marginBottom: '2px' }}>
                  <button
                    onClick={() => toggleGrupo(grupo.idGrupo)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'space-between',
                      padding: '9px 10px',
                      backgroundColor: estaAberto ? '#1e293b' : 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: estaAberto ? '#60a5fa' : '#cbd5e1',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      letterSpacing: '0.3px',
                      transition: 'background-color 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <IconeGrupo style={{ width: '15px', height: '15px', color: estaAberto ? '#60a5fa' : '#94a3b8' }} />
                      <span>{grupo.titulo}</span>
                    </div>
                    {estaAberto ? <ChevronDown style={{ width: '14px', height: '14px' }} /> : <ChevronRight style={{ width: '14px', height: '14px' }} />}
                  </button>

                  {estaAberto && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px', paddingLeft: '8px' }}>
                      {itensPermitidos.map(item => {
                        const IconeItem = item.icon;
                        const ativo = abaAtiva === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setAbaAtiva(item.id);
                              if (isMobile) setSidebarAberto(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '7px 10px',
                              fontSize: '11px',
                              fontWeight: ativo ? 'bold' : 'normal',
                              borderRadius: '4px',
                              border: 'none',
                              cursor: 'pointer',
                              backgroundColor: ativo ? '#2563eb' : 'transparent',
                              color: ativo ? '#fff' : '#94a3b8',
                              textAlign: 'left',
                              width: '100%',
                              transition: 'background-color 0.15s'
                            }}
                          >
                            <IconeItem style={{ width: '13px', height: '13px', color: ativo ? '#fff' : '#64748b', flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* CONTEÚDO DA PÁGINA */}
        <main style={{ flex: 1, padding: isMobile ? '8px' : '16px', overflowY: 'auto', boxSizing: 'border-box', height: '100%', width: '100%' }}>
          
          {mensagem.texto && (
            <div style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: '6px', border: '1px solid', fontSize: '12px', fontWeight: 'bold', backgroundColor: mensagem.tipo === 'sucesso' ? '#f0fdf4' : '#fef2f2', color: mensagem.tipo === 'sucesso' ? '#166534' : '#991b1b' }}>
              {mensagem.texto}
            </div>
          )}

          <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', padding: isMobile ? '10px' : '16px', borderRadius: '8px', width: '100%', boxSizing: 'border-box', minHeight: '100%', overflowX: 'auto' }}>
            
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
            {abaAtiva === 'CADASTRO_ITENS_MANUTENCAO' && <CadastroItensManutencao />}
            {abaAtiva === 'EQUIPE' && <DiarioEfetivo obrasDisponiveis={listaObrasBanco} usuarioLogado={usuarioLogado} />}
            {abaAtiva === 'DIARIO_TECNICO' && <DiarioObraTecnico obrasDisponiveis={listaObrasBanco} usuarioLogado={usuarioLogado} />}
            
            {abaAtiva === 'HISTORICO_DIARIOS' && <HistoricoDiarios id={usuarioLogado.id} cargo={usuarioLogado.cargo} obrasDisponiveis={listaObrasBanco} usuarioLogado={usuarioLogado} />}
            {abaAtiva === 'HISTORICO_MATERIAIS' && <HistoricoMateriais id={usuarioLogado.id} cargo={usuarioLogado.cargo} obrasDisponiveis={listaObrasBanco} usuarioLogado={usuarioLogado} />}
            {abaAtiva === 'PRESENCA' && <HistoricoPresenca cargo={usuarioLogado.cargo} id={usuarioLogado.id} obrasDisponiveis={listaObrasBanco} usuarioLogado={usuarioLogado} />}
            {abaAtiva === 'DIAS_PENDENTES' && <DiasPendentes id={usuarioLogado.id} cargo={usuarioLogado.cargo} obrasDisponiveis={listaObrasBanco} usuarioLogado={usuarioLogado} />}

            {abaAtiva === 'CADASTRO_MATERIAIS' && ['MASTER', 'ENGENHARIA'].includes(usuarioLogado.cargo) && (
              <CadastroMateriais API_URL={API_URL} mostrarMensagem={mostrarMensagem} usuarioLogado={usuarioLogado} />
            )}
            {abaAtiva === 'CADASTRO_FORNECEDORES' && ['MASTER', 'ENGENHARIA'].includes(usuarioLogado.cargo) && (
              <CadastroFornecedores API_URL={API_URL} mostrarMensagem={mostrarMensagem} usuarioLogado={usuarioLogado} />
            )}
            
            {abaAtiva === 'FATURAMENTO_DIRETO' && ['MASTER', 'ENGENHARIA'].includes(usuarioLogado.cargo) && (
              <FaturamentoDireto API_URL={API_URL} mostrarMensagem={mostrarMensagem} obrasDisponiveis={listaObrasBanco} usuarioLogado={usuarioLogado} />
            )}

            {abaAtiva === 'BASE' && ['MASTER', 'ENGENHARIA'].includes(usuarioLogado.cargo) && (
              <Base API_URL={API_URL} mostrarMensagem={mostrarMensagem} obrasDisponiveis={listaObrasBanco} usuarioLogado={usuarioLogado} />
            )}

            {abaAtiva === 'ESTOQUE' && ['MASTER', 'ENGENHARIA'].includes(usuarioLogado.cargo) && (
              <EstoqueSaldos API_URL={API_URL} mostrarMensagem={mostrarMensagem} obrasDisponiveis={listaObrasBanco} usuarioLogado={usuarioLogado} />
            )}

            {abaAtiva === 'ESTOQUE_MOVIMENTACOES' && usuarioLogado.cargo === 'MASTER' && (
              <EstoqueMovimentacoes API_URL={API_URL} mostrarMensagem={mostrarMensagem} usuarioLogado={usuarioLogado} />
            )}
            {abaAtiva === 'RELATORIO_COMPRAS' && usuarioLogado.cargo === 'MASTER' && (
              <RelatorioCompras API_URL={API_URL} mostrarMensagem={mostrarMensagem} />
            )}
            {abaAtiva === 'RELATORIO_MOVIMENTACAO' && usuarioLogado.cargo === 'MASTER' && (
              <RelatorioMovimentacao API_URL={API_URL} mostrarMensagem={mostrarMensagem} />
            )}
            {abaAtiva === 'RELATORIO_VEICULOS' && (<RelatorioVeiculoUsados usuarioLogado={usuarioLogado} />
          )}
          {abaAtiva === 'RELATORIO_MANUTENCAO_VEICULOS' && (<RelatorioManutencaoVeiculos usuarioLogado={usuarioLogado} />
          )}
          </div>
        </main>
      </div>
    </div>
  );
}