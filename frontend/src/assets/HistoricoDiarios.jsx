import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  BarChart3, Users, Filter, Download, Layers, Package, X, Search,
  UserCheck, TrendingUp, ArrowUpRight, ArrowDownRight, Minus,
  ChevronDown, ChevronUp, RotateCcw, ClipboardList, CalendarDays, HardHat
} from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, BarController, LineController, Title, Tooltip, Legend, Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  BarController, LineController, Title, Tooltip, Legend, Filler
);

const API_URL = 'http://localhost:3001/api';
//const API_URL = 'https://api-controle-impacto.duckdns.org/api';

const LINHAS_POR_PAGINA = 20;
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const OPCOES_STATUS_OPERACIONAL = [
  'Normal', 'Choveu', 'Sem Material', 'Sem Equipamento',
  'Apoio', 'Sem Atividade', 'Folga/FDS', 'Outros'
];

const ABAS = [
  { key: 'RDO', label: 'Dashboard', icon: BarChart3 },
  { key: 'ATIVIDADES', label: 'Atividades', icon: Layers },
  { key: 'MATERIAIS', label: 'Materiais', icon: Package }
];

// ---------------------------------------------------------------
// TEMA E ESTILOS
// ---------------------------------------------------------------
const C = {
  verde: '#10b981', verdeEscuro: '#059669', verdeClaro: '#ecfdf5',
  laranja: '#f59e0b', vermelho: '#dc2626',
  texto: '#0f172a', textoSuave: '#64748b', textoMudo: '#94a3b8',
  borda: '#e2e8f0', bordaForte: '#cbd5e1', fundo: '#f8fafc', branco: '#fff'
};

const S = {
  pagina: { padding: 12, fontFamily: 'system-ui, sans-serif', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 12, backgroundColor: C.fundo, minHeight: '100vh', boxSizing: 'border-box', color: C.texto },
  card: { backgroundColor: C.branco, border: `1px solid ${C.borda}`, borderRadius: 8, padding: 12 },
  cardTitulo: { display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12, color: '#1e293b', textTransform: 'uppercase', letterSpacing: 0.3 },
  label: { display: 'block', fontWeight: 700, marginBottom: 3, color: '#475569', fontSize: 10, textTransform: 'uppercase' },
  campo: { width: '100%', height: 32, padding: '0 8px', border: `1px solid ${C.bordaForte}`, borderRadius: 6, backgroundColor: C.branco, boxSizing: 'border-box', fontSize: 12 },
  th: { padding: '10px 8px', border: `1px solid ${C.bordaForte}`, fontSize: 10, textTransform: 'uppercase', color: '#475569', backgroundColor: '#f1f5f9', whiteSpace: 'nowrap' },
  td: { padding: '8px', borderBottom: `1px solid #e2e8f0`, verticalAlign: 'middle' },
  btnGhost: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 11, fontWeight: 600, color: C.textoSuave, backgroundColor: C.branco, border: `1px solid ${C.bordaForte}`, borderRadius: 6, cursor: 'pointer' },
  btnMini: { border: `1px solid ${C.bordaForte}`, backgroundColor: C.branco, padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: 10 },
  vazio: { padding: 20, textAlign: 'center', color: C.textoMudo },
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }
};

// ---------------------------------------------------------------
// HELPERS PUROS
// ---------------------------------------------------------------
const soData = (raw) => (raw ? String(raw).split('T')[0] : '');

const formatarDataExibicao = (raw) => {
  const d = soData(raw);
  if (!d) return '--/--/----';
  const [ano, mes, dia] = d.split('-');
  return `${dia}/${mes}/${ano}`;
};

const fmt = (n, casas = 2) =>
  Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: casas });

const media = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

const paraNumero = (txt) => parseFloat(String(txt).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;

const extrairItemEQuantidade = (linha) => {
  if (!linha || !linha.trim()) return null;
  const formatado = linha.replace(/^[•\-*]\s*/, '').trim();
  let descricao = formatado;
  let quantidade = 1;

  if (formatado.includes(':')) {
    const [d, q] = formatado.split(':');
    descricao = d.trim();
    quantidade = paraNumero(q);
  } else {
    const match = formatado.match(/(.*?)\(([^)]+)\)/);
    if (match) {
      descricao = match[1].trim();
      quantidade = paraNumero(match[2]);
    }
  }
  return { descricao: descricao || 'Item', quantidade };
};

const inferirUnidade = (nome) => {
  const n = (nome || '').toLowerCase();
  if (['pintura', 'termoplástico', 'termoplastico', 'fresagem', 'm²', 'm2'].some(t => n.includes(t))) return 'm²';
  return 'un';
};

// Remove unidades entre parênteses, acentos e espaços extras para garantir a correspondência entre a API e as legendas
const normalizarNomeAtividade = (nome) => {
  if (!nome) return '';
  return String(nome)
    .replace(/\s*\([^)]*\)/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
};

// ---------------------------------------------------------------
// SUBCOMPONENTES VISUAIS
// ---------------------------------------------------------------
function Campo({ label, children }) {
  return (
    <div>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  );
}

function CampoBusca({ label, placeholder, value, onChange, Icone }) {
  return (
    <Campo label={label}>
      <div style={{ position: 'relative' }}>
        <input type="text" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} style={{ ...S.campo, paddingLeft: 26 }} />
        <Icone style={{ width: 13, position: 'absolute', left: 8, top: 9, color: C.textoMudo }} />
      </div>
    </Campo>
  );
}

function MultiSelect({ label, options, selected, onToggle, onClear }) {
  const [aberto, setAberto] = useState(false);
  const resumo = selected.length === 0
    ? 'Todos'
    : options.filter(o => selected.includes(o.value)).map(o => o.label).join(', ');

  return (
    <div style={{ position: 'relative' }}>
      <label style={S.label}>{label}{selected.length > 0 ? ` (${selected.length})` : ''}</label>
      <button type="button" onClick={() => setAberto(!aberto)} style={{ ...S.campo, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resumo}</span>
        {aberto ? <ChevronUp style={{ width: 14 }} /> : <ChevronDown style={{ width: 14 }} />}
      </button>
      {aberto && (
        <>
          <div onClick={() => setAberto(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4, backgroundColor: C.branco, border: `1px solid ${C.bordaForte}`, borderRadius: 6, maxHeight: 200, overflowY: 'auto', padding: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            <div onClick={onClear} style={{ padding: '4px 8px', color: C.verde, fontWeight: 700, cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
              {selected.length > 0 ? 'Limpar seleção' : 'Todos'}
            </div>
            {options.map(o => (
              <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', cursor: 'pointer', backgroundColor: selected.includes(o.value) ? C.verdeClaro : 'transparent', borderRadius: 4 }}>
                <input type="checkbox" checked={selected.includes(o.value)} onChange={() => onToggle(o.value)} />
                {o.label}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ titulo, valor, sufixo, Icone, cor = C.verde }) {
  return (
    <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: `${cor}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icone style={{ width: 16, color: cor }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: C.textoSuave, fontWeight: 600, textTransform: 'uppercase' }}>{titulo}</div>
        <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>
          {valor} {sufixo && <span style={{ fontSize: 11, color: cor, fontWeight: 600 }}>{sufixo}</span>}
        </div>
      </div>
    </div>
  );
}

function Card({ titulo, Icone, cor = C.verde, acao, children }) {
  return (
    <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={S.cardTitulo}>{Icone && <Icone style={{ width: 15, color: cor }} />} {titulo}</div>
        {acao}
      </div>
      {children}
    </div>
  );
}

function Toggle({ opcoes, valor, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2, backgroundColor: '#f1f5f9', padding: 2, borderRadius: 6 }}>
      {opcoes.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} style={{
          border: 'none', padding: '3px 8px', fontSize: 10, borderRadius: 4, fontWeight: 700, cursor: 'pointer',
          backgroundColor: valor === o.value ? C.branco : 'transparent',
          color: valor === o.value ? C.texto : C.textoSuave,
          boxShadow: valor === o.value ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function VerMais({ total, visiveis, onMais }) {
  if (total <= visiveis) return null;
  return (
    <div style={{ textAlign: 'center', paddingTop: 8 }}>
      <button type="button" onClick={onMais} style={S.btnGhost}>
        Mostrar mais ({total - visiveis} restantes)
      </button>
    </div>
  );
}

const ESTILO_BADGE = { padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block' };

function BadgeStatusRdo({ status }) {
  const ok = String(status).toUpperCase().trim() === 'FINALIZADO';
  return (
    <span style={{ ...ESTILO_BADGE, backgroundColor: ok ? '#dcfce7' : '#fef9c3', color: ok ? '#15803d' : '#854d0e', border: `1px solid ${ok ? '#86efac' : '#fef08a'}` }}>
      {ok ? '✓ CONCLUÍDO' : '⏳ PENDENTE'}
    </span>
  );
}

const MAPA_STATUS_OP = [
  { chaves: ['NORMAL'], texto: '✓ NORMAL', bg: '#e0f2fe', cor: '#0369a1', borda: '#7dd3fc' },
  { chaves: ['CHUVA', 'CHOVEU'], texto: '🌧️ CHUVA', bg: '#e0e7ff', cor: '#3730a3', borda: '#a5b4fc' },
  { chaves: ['MATERIAL'], texto: '⚠️ SEM MATERIAL', bg: '#fee2e2', cor: '#991b1b', borda: '#fca5a5' },
  { chaves: ['EQUIPAMENTO'], texto: '⚙️ SEM EQUIPAMENTO', bg: '#ffedd5', cor: '#c2410c', borda: '#fed7aa' },
  { chaves: ['APOIO'], texto: '🤝 APOIO', bg: '#f0fdf4', cor: '#15803d', borda: '#86efac' },
  { chaves: ['SEM ATIVIDADE'], texto: '⏸️ SEM ATIVIDADE', bg: '#f3f4f6', cor: '#4b5563', borda: '#d1d5db' },
  { chaves: ['FOLGA', 'FDS'], texto: '🏖️ FOLGA / FDS', bg: '#fef3c7', cor: '#b45309', borda: '#fde047' }
];

function BadgeStatusOp({ status }) {
  const st = status ? String(status).toUpperCase().trim() : 'NORMAL';
  const cfg = MAPA_STATUS_OP.find(c => c.chaves.some(k => st.includes(k)));
  if (!cfg) return <span style={{ ...ESTILO_BADGE, backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}>{st}</span>;
  return <span style={{ ...ESTILO_BADGE, backgroundColor: cfg.bg, color: cfg.cor, border: `1px solid ${cfg.borda}` }}>{cfg.texto}</span>;
}

function Variacao({ perc }) {
  if (perc === null) return <span style={{ color: C.textoMudo }}>—</span>;
  const cor = perc > 0 ? '#16a34a' : perc < 0 ? C.vermelho : C.textoSuave;
  const Icone = perc > 0 ? ArrowUpRight : perc < 0 ? ArrowDownRight : Minus;
  return (
    <span style={{ color: cor, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <Icone style={{ width: 13 }} /> {perc > 0 ? '+' : ''}{perc.toFixed(1)}%
    </span>
  );
}

// ---------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------
export default function HistoricoDiarios({ id, cargo }) {
  const [abaAtiva, setAbaAtiva] = useState('RDO');
  const [filtrosAbertos, setFiltrosAbertos] = useState(true);

  // Filtros
  const [obrasSelecionadas, setObrasSelecionadas] = useState([]);
  const [tiposSelecionados, setTiposSelecionados] = useState([]);
  const [statusOperacionalSelecionados, setStatusOperacionalSelecionados] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [idGestorFiltro, setIdGestorFiltro] = useState('');
  const [buscaEquipe, setBuscaEquipe] = useState('');
  const [buscaFuncionario, setBuscaFuncionario] = useState('');
  const [buscaAtividade, setBuscaAtividade] = useState('');
  const [buscaMaterial, setBuscaMaterial] = useState('');

  // Exibição
  const [limiteTopAtividades, setLimiteTopAtividades] = useState(10);
  const [visEvolucao, setVisEvolucao] = useState('diaria');
  const [atividadeEvolucao, setAtividadeEvolucao] = useState('');
  const [linhasVisiveis, setLinhasVisiveis] = useState(LINHAS_POR_PAGINA);
  const [mostrarTodasAtividades, setMostrarTodasAtividades] = useState(false);

  // Dados
  const [tiposDisponiveis, setTiposDisponiveis] = useState([]);
  const [obras, setObras] = useState([]);
  const [gestores, setGestores] = useState([]);
  const [listaDiarios, setListaDiarios] = useState([]);
  const [mapaMedias, setMapaMedias] = useState({});
  const [loading, setLoading] = useState(false);

  const [diarioSelecionado, setDiarioSelecionado] = useState(null);
  const [modalExcluir, setModalExcluir] = useState(null);
  const [processandoAcao, setProcessandoAcao] = useState(false);

  const cargoUpper = cargo ? String(cargo).toUpperCase() : '';
  const isMaster = ['MASTER', 'ADMIN', 'RH'].includes(cargoUpper);

  useEffect(() => { setLinhasVisiveis(LINHAS_POR_PAGINA); }, [abaAtiva]);

  // --- CARREGAMENTO ---
  useEffect(() => {
    if (!id) return;
    axios.get(`${API_URL}/gestor/tipos-obra`, { params: { id, cargo } })
      .then(res => setTiposDisponiveis(Array.isArray(res.data) ? res.data : []))
      .catch(e => console.error('Erro ao carregar tipos de obra:', e));
  }, [id, cargo]);

  useEffect(() => {
    if (!id) return;
    axios.get(`${API_URL}/gestor/obras-ativas`, {
      params: { id, cargo, tipo_obra: tiposSelecionados.length > 0 ? tiposSelecionados.join(',') : undefined }
    })
      .then(res => setObras(Array.isArray(res.data) ? res.data : []))
      .catch(e => console.error('Erro ao carregar obras para filtro:', e));
  }, [id, cargo, tiposSelecionados]);

  useEffect(() => {
    if (!isMaster) return;
    axios.get(`${API_URL}/gestores`)
      .then(res => setGestores(res.data || []))
      .catch(e => console.error('Erro ao carregar gestores:', e));
  }, [isMaster]);

  const buscarHistorico = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const endpoint = abaAtiva === 'MATERIAIS'
        ? `${API_URL}/gestor/historico-materiais`
        : `${API_URL}/gestor/historico-diarios`;

      const res = await axios.get(endpoint, {
        params: {
          id,
          cargo,
          id_obra: obrasSelecionadas.length > 0 ? obrasSelecionadas.join(',') : undefined,
          tipo_obra: tiposSelecionados.length > 0 ? tiposSelecionados.join(',') : undefined,
          data_inicio: dataInicio || undefined,
          data_fim: dataFim || undefined,
          status_rdo: statusFiltro || undefined,
          status_operacional: statusOperacionalSelecionados.length > 0 ? statusOperacionalSelecionados.join(',') : undefined,
          id_gestor_filtro: idGestorFiltro || undefined,
          id_gestor: idGestorFiltro || undefined
        }
      });

      const lista = Array.isArray(res.data) ? res.data : (res.data.lista || res.data.diarios || res.data.dados || []);
      setListaDiarios(lista);
      setMapaMedias(res.data?.media_outras_obras && typeof res.data.media_outras_obras === 'object' ? res.data.media_outras_obras : {});
    } catch (err) {
      console.error('Erro ao buscar histórico do banco:', err);
      setListaDiarios([]);
      setMapaMedias({});
    } finally {
      setLoading(false);
    }
  }, [id, cargo, abaAtiva, obrasSelecionadas, tiposSelecionados, dataInicio, dataFim, statusFiltro, statusOperacionalSelecionados, idGestorFiltro]);

  useEffect(() => { buscarHistorico(); }, [buscarHistorico]);

  // --- EXCLUSÃO DE RDO ---
  const handleExcluirRdo = async (e) => {
    if (e) e.preventDefault();
    if (!modalExcluir) return;

    const rdoAlvo = modalExcluir.rdo ? modalExcluir.rdo : modalExcluir;
    const targetId = rdoAlvo.id_diario || rdoAlvo.id;
    const dataFormatada = soData(rdoAlvo.data_diario);

    try {
      setProcessandoAcao(true);
      if (targetId) {
        await axios.delete(`${API_URL}/gestor/diarios/${targetId}`, { data: { id_usuario: id } });
      } else {
        if (!rdoAlvo.equipe || !rdoAlvo.id_obra || !dataFormatada) {
          alert('Erro: Parâmetros insuficientes para excluir o RDO.');
          return;
        }
        await axios.delete(`${API_URL}/gestor/equipe`, {
          params: { nome_equipe: rdoAlvo.equipe, id_obra: rdoAlvo.id_obra, data_diario: dataFormatada }
        });
      }
      setModalExcluir(null);
      setDiarioSelecionado(null);
      await buscarHistorico();
    } catch (err) {
      console.error('Erro ao excluir RDO:', err);
      alert('Erro ao excluir RDO: ' + (err.response?.data?.error || err.response?.data?.message || err.message));
    } finally {
      setProcessandoAcao(false);
    }
  };

  // --- FILTROS: TOGGLES ---
  const alternar = (setter) => (valor) =>
    setter(prev => (prev.includes(valor) ? prev.filter(v => v !== valor) : [...prev, valor]));

  const filtrosAtivos = [
    obrasSelecionadas.length, tiposSelecionados.length, statusOperacionalSelecionados.length,
    dataInicio, dataFim, statusFiltro, idGestorFiltro, buscaEquipe, buscaFuncionario
  ].filter(Boolean).length;

  const limparFiltros = () => {
    setObrasSelecionadas([]); setTiposSelecionados([]); setStatusOperacionalSelecionados([]);
    setDataInicio(''); setDataFim(''); setStatusFiltro(''); setIdGestorFiltro('');
    setBuscaEquipe(''); setBuscaFuncionario('');
  };

  // --- MEMOS DE DADOS ---
  const diariosFiltrados = useMemo(() => {
    const eq = buscaEquipe.trim().toLowerCase();
    const fn = buscaFuncionario.trim().toLowerCase();
    return listaDiarios.filter(rdo =>
      (!eq || (rdo.equipe || '').toLowerCase().includes(eq)) &&
      (!fn || (rdo.nomes_efetivo || '').toLowerCase().includes(fn))
    );
  }, [listaDiarios, buscaEquipe, buscaFuncionario]);

  const atividadesExtraidas = useMemo(() => {
    const lista = diariosFiltrados.flatMap(rdo => {
      if (Array.isArray(rdo.atividades)) {
        return rdo.atividades.map(a => {
          const desc = a.descricao || a.nome || a.atividade || 'Atividade sem nome';
          return { descricao: desc, quantidade: parseFloat(a.quantidade || a.qtd || 0) || 0, unidade: a.unidade || inferirUnidade(desc), rdo };
        });
      }
      if (!rdo.servicos_resumo) return [];
      return rdo.servicos_resumo.split(/[\n,]+/).map(linha => {
        const item = extrairItemEQuantidade(linha);
        return item ? { ...item, unidade: inferirUnidade(item.descricao), rdo } : null;
      }).filter(Boolean);
    });

    const termo = buscaAtividade.trim().toLowerCase();
    return termo ? lista.filter(i => i.descricao.toLowerCase().includes(termo)) : lista;
  }, [diariosFiltrados, buscaAtividade]);

  const materiaisExtraidos = useMemo(() => {
    const lista = diariosFiltrados.flatMap(rdo => {
      const mat = rdo.materiais || rdo.materiais_resumo || rdo.insumos || rdo.insumos_resumo;
      if (!mat) return [];
      if (Array.isArray(mat)) {
        return mat.map(m => ({
          descricao: m.descricao || m.nome || m.material || 'Material sem nome',
          quantidade: parseFloat(m.quantidade || m.qtd || 0) || 0,
          unidade: m.unidade || m.und || 'UN',
          rdo
        }));
      }
      if (typeof mat === 'string') {
        return mat.split(/[\n,]+/).map(linha => {
          const item = extrairItemEQuantidade(linha);
          return item ? { ...item, unidade: 'UN', rdo } : null;
        }).filter(Boolean);
      }
      return [];
    });

    const termo = buscaMaterial.trim().toLowerCase();
    return termo ? lista.filter(i => i.descricao.toLowerCase().includes(termo)) : lista;
  }, [diariosFiltrados, buscaMaterial]);

  // Consolidação por atividade
  const atividadesOrdenadas = useMemo(() => {
    const mapa = {};
    atividadesExtraidas.forEach(item => {
      const nome = item.descricao.trim();
      const qtd = Number(item.quantidade) || 0;
      const dia = soData(item.rdo.data_diario);
      if (!mapa[nome]) mapa[nome] = { nome, total: 0, unidade: item.unidade || inferirUnidade(nome), dias: new Set(), registros: 0 };
      mapa[nome].total += qtd;
      mapa[nome].registros += 1;
      if (dia) mapa[nome].dias.add(dia);
    });
    return Object.values(mapa)
      .map(a => ({ ...a, diasTrabalhados: a.dias.size, mediaDia: a.dias.size ? a.total / a.dias.size : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [atividadesExtraidas]);

  const resumoGeral = useMemo(() => {
    const dias = new Set(diariosFiltrados.map(r => soData(r.data_diario)).filter(Boolean));
    const efetivos = diariosFiltrados.map(r => Number(r.total_efetivo) || 0);
    return {
      totalRdos: diariosFiltrados.length,
      diasComRegistro: dias.size,
      efetivoMedio: media(efetivos),
      totalAtividades: atividadesOrdenadas.length
    };
  }, [diariosFiltrados, atividadesOrdenadas]);

  const atividadeEfetiva = atividadeEvolucao || atividadesOrdenadas[0]?.nome || 'TODAS';
  const unidadeEvolucao = atividadeEfetiva === 'TODAS' ? '' : (atividadesOrdenadas.find(a => a.nome === atividadeEfetiva)?.unidade || '');

  const serieEvolucao = useMemo(() => {
    const diaria = {};
    const mensal = {};
    atividadesExtraidas.forEach(item => {
      if (atividadeEfetiva !== 'TODAS' && item.descricao.trim() !== atividadeEfetiva) return;
      const dia = soData(item.rdo.data_diario);
      if (!dia) return;
      const qtd = Number(item.quantidade) || 0;
      diaria[dia] = (diaria[dia] || 0) + qtd;
      const mes = dia.substring(0, 7);
      mensal[mes] = (mensal[mes] || 0) + qtd;
    });
    return { diaria, mensal };
  }, [atividadesExtraidas, atividadeEfetiva]);

  // --- GRÁFICOS ---
  const chartRankingData = useMemo(() => {
    const lista = atividadesOrdenadas.slice(0, limiteTopAtividades);
    return {
      lista,
      data: {
        labels: lista.map(i => i.nome),
        datasets: [{ label: 'Produção Total', data: lista.map(i => i.total), backgroundColor: C.verde, hoverBackgroundColor: C.verdeEscuro, borderRadius: 4, barThickness: 16 }]
      }
    };
  }, [atividadesOrdenadas, limiteTopAtividades]);

  const chartRankingOptions = useMemo(() => ({
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => `${fmt(ctx.raw)} ${chartRankingData.lista[ctx.dataIndex]?.unidade || ''}` } }
    },
    scales: {
      x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
      y: { grid: { display: false }, ticks: { font: { size: 11 } } }
    }
  }), [chartRankingData]);

  const mediaEvolucao = useMemo(() => {
    const mapa = visEvolucao === 'diaria' ? serieEvolucao.diaria : serieEvolucao.mensal;
    return media(Object.values(mapa));
  }, [serieEvolucao, visEvolucao]);

  const chartEvolucaoData = useMemo(() => {
    const isDiario = visEvolucao === 'diaria';
    const mapa = isDiario ? serieEvolucao.diaria : serieEvolucao.mensal;
    const chaves = Object.keys(mapa).sort();
    const valores = chaves.map(k => mapa[k]);

    const labels = chaves.map(chave => {
      const [a, m, d] = chave.split('-');
      return isDiario ? `${d}/${m}` : `${MESES[parseInt(m, 10) - 1]}/${a.slice(-2)}`;
    });

    return {
      labels,
      datasets: [
        {
          label: isDiario ? 'Produção diária' : 'Produção mensal',
          data: valores,
          borderColor: C.verde, backgroundColor: 'rgba(16,185,129,0.1)',
          borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0.3, fill: true
        },
        {
          label: `Média (${fmt(mediaEvolucao)} ${unidadeEvolucao})`,
          data: valores.map(() => mediaEvolucao),
          borderColor: C.laranja, borderDash: [6, 6], borderWidth: 1.5,
          pointRadius: 0, pointHoverRadius: 0, fill: false
        }
      ]
    };
  }, [serieEvolucao, visEvolucao, mediaEvolucao, unidadeEvolucao]);

  const chartEvolucaoOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label.split(' (')[0]}: ${fmt(ctx.raw)} ${unidadeEvolucao}` } }
    },
    scales: {
      x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
      y: { grid: { color: '#f1f5f9' }, beginAtZero: true, ticks: { font: { size: 10 } } }
    }
  }), [unidadeEvolucao]);

  // GRÁFICO COMPARATIVO COM NORMALIZAÇÃO DE CHAVES
  const chartComparativoData = useMemo(() => {
    const lista = atividadesOrdenadas.slice(0, 8);

    // Mapeia todas as chaves recebidas da API para formato normalizado
    const mapaMediasNormalizado = {};
    Object.keys(mapaMedias).forEach(key => {
      mapaMediasNormalizado[normalizarNomeAtividade(key)] = Number(mapaMedias[key]) || 0;
    });

    return {
      lista,
      data: {
        labels: lista.map(i => i.nome),
        datasets: [
          { 
            label: 'Obra atual', 
            data: lista.map(i => i.total), 
            backgroundColor: C.verde, 
            borderRadius: 4 
          },
          { 
            label: 'Média outras obras', 
            data: lista.map(i => {
              const chaveNorm = normalizarNomeAtividade(i.nome);
              // Tenta localizar pela chave normalizada ou pela maiúscula exata
              return mapaMediasNormalizado[chaveNorm] ?? (mapaMedias[i.nome.toUpperCase()] || 0);
            }), 
            backgroundColor: C.laranja, 
            borderRadius: 4 
          }
        ]
      }
    };
  }, [atividadesOrdenadas, mapaMedias]);

  const temMediaOutrasObras = Object.keys(mapaMedias).length > 0;

  const chartComparativoOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 10 } } },
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.raw)} ${chartComparativoData.lista[ctx.dataIndex]?.unidade || ''}` } }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { grid: { color: '#f1f5f9' }, beginAtZero: true, ticks: { font: { size: 10 } } }
    }
  }), [chartComparativoData]);

  // --- EXPORTAR CSV ---
  const handleExportarPlanilha = () => {
    const linhas = [];
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    if (abaAtiva === 'RDO') {
      linhas.push('Data;Obra;Equipe;Funcionarios;Status RDO;Status Operacional;Atividades (Qtd)');
      diariosFiltrados.forEach(rdo => {
        linhas.push([
          formatarDataExibicao(rdo.data_diario), rdo.nome_obra, rdo.equipe,
          (rdo.nomes_efetivo || '').replace(/;/g, ','), rdo.status_rdo || 'PENDENTE',
          rdo.status_operacional || 'NORMAL', (rdo.servicos_resumo || 'Sem registro').replace(/\n/g, ' | ').replace(/;/g, ',')
        ].map(q).join(';'));
      });
    } else {
      const itens = abaAtiva === 'ATIVIDADES' ? atividadesExtraidas : materiaisExtraidos;
      linhas.push(`Data;Obra;Equipe;${abaAtiva === 'ATIVIDADES' ? 'Atividade' : 'Material'};Quantidade;Unidade;Status RDO`);
      itens.forEach(i => {
        linhas.push([
          formatarDataExibicao(i.rdo.data_diario), i.rdo.nome_obra, i.rdo.equipe,
          i.descricao, i.quantidade, i.unidade || 'UN', i.rdo.status_rdo
        ].map(q).join(';'));
      });
    }

    const blob = new Blob(['\uFEFF' + linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historico_${abaAtiva.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ---------------------------------------------------------------
  // BLOCOS DE RENDER
  // ---------------------------------------------------------------
  const renderFiltros = () => (
    <div style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setFiltrosAbertos(!filtrosAbertos)} style={{ ...S.cardTitulo, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <Filter style={{ width: 15, color: C.verde }} /> Filtros
          {filtrosAtivos > 0 && (
            <span style={{ backgroundColor: C.verde, color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10 }}>{filtrosAtivos}</span>
          )}
          {filtrosAbertos ? <ChevronUp style={{ width: 14 }} /> : <ChevronDown style={{ width: 14 }} />}
        </button>
        <div style={{ display: 'flex', gap: 6 }}>
          {filtrosAtivos > 0 && (
            <button type="button" onClick={limparFiltros} style={S.btnGhost}><RotateCcw style={{ width: 12 }} /> Limpar</button>
          )}
          <button type="button" onClick={handleExportarPlanilha} disabled={diariosFiltrados.length === 0}
            style={{ ...S.btnGhost, opacity: diariosFiltrados.length === 0 ? 0.5 : 1, cursor: diariosFiltrados.length === 0 ? 'not-allowed' : 'pointer' }}>
            <Download style={{ width: 12 }} /> CSV
          </button>
        </div>
      </div>

      {filtrosAbertos && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 10 }}>
          {isMaster && (
            <Campo label="Gestor / Encarregado">
              <select value={idGestorFiltro} onChange={e => setIdGestorFiltro(e.target.value)} style={S.campo}>
                <option value="">Todos</option>
                {gestores.map(g => (
                  <option key={g.id_usuario || g.id} value={g.id_usuario || g.id}>
                    {g.nome_gestor || g.nome || g.nome_usuario || `Gestor ${g.id_usuario || g.id}`}
                  </option>
                ))}
              </select>
            </Campo>
          )}

          <MultiSelect label="Tipo de obra" options={tiposDisponiveis.map(t => ({ value: t, label: t }))}
            selected={tiposSelecionados} onToggle={alternar(setTiposSelecionados)} onClear={() => setTiposSelecionados([])} />

          <MultiSelect label="Obra" options={obras.map(o => ({ value: String(o.id), label: o.nome_obra }))}
            selected={obrasSelecionadas} onToggle={alternar(setObrasSelecionadas)} onClear={() => setObrasSelecionadas([])} />

          <Campo label="Status do RDO">
            <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)} style={S.campo}>
              <option value="">Todos</option>
              <option value="FINALIZADO">Concluído</option>
              <option value="PENDENTE">Pendente</option>
            </select>
          </Campo>

          <MultiSelect label="Status operacional" options={OPCOES_STATUS_OPERACIONAL.map(o => ({ value: o, label: o }))}
            selected={statusOperacionalSelecionados} onToggle={alternar(setStatusOperacionalSelecionados)} onClear={() => setStatusOperacionalSelecionados([])} />

          <CampoBusca label="Equipe" placeholder="Nome da equipe..." value={buscaEquipe} onChange={setBuscaEquipe} Icone={Search} />
          <CampoBusca label="Funcionário" placeholder="Nome do colaborador..." value={buscaFuncionario} onChange={setBuscaFuncionario} Icone={UserCheck} />

          <Campo label="Data inicial">
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={S.campo} />
          </Campo>
          <Campo label="Data final">
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={S.campo} />
          </Campo>
        </div>
      )}
    </div>
  );

  const renderKpis = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
      <Kpi titulo="RDOs no período" valor={fmt(resumoGeral.totalRdos, 0)} Icone={ClipboardList} />
      <Kpi titulo="Dias com registro" valor={fmt(resumoGeral.diasComRegistro, 0)} Icone={CalendarDays} cor="#6366f1" />
      <Kpi titulo="Efetivo médio / RDO" valor={fmt(resumoGeral.efetivoMedio, 1)} sufixo="pessoas" Icone={HardHat} cor={C.laranja} />
      <Kpi titulo="Atividades distintas" valor={fmt(resumoGeral.totalAtividades, 0)} Icone={Layers} cor="#0ea5e9" />
    </div>
  );

  const renderTabelaResumoAtividades = () => {
    const lista = mostrarTodasAtividades ? atividadesOrdenadas : atividadesOrdenadas.slice(0, 8);
    const maximo = atividadesOrdenadas[0]?.total || 1;

    // Normaliza o mapa para a tabela
    const mapaMediasNormalizado = {};
    Object.keys(mapaMedias).forEach(key => {
      mapaMediasNormalizado[normalizarNomeAtividade(key)] = Number(mapaMedias[key]) || 0;
    });

    return (
      <Card titulo="Desempenho por atividade" Icone={Layers}
        acao={atividadesOrdenadas.length > 8 && (
          <button type="button" style={S.btnGhost} onClick={() => setMostrarTodasAtividades(!mostrarTodasAtividades)}>
            {mostrarTodasAtividades ? 'Mostrar menos' : `Ver todas (${atividadesOrdenadas.length})`}
          </button>
        )}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr>
                <th style={S.th}>Atividade</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Total</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Dias</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Média / dia</th>
                {temMediaOutrasObras && <th style={{ ...S.th, textAlign: 'right' }}>Média outras obras</th>}
                {temMediaOutrasObras && <th style={{ ...S.th, textAlign: 'center' }}>vs. média</th>}
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={6} style={S.vazio}>Nenhum registro encontrado.</td></tr>
              ) : lista.map(item => {
                const chaveNorm = normalizarNomeAtividade(item.nome);
                const mediaOutras = mapaMediasNormalizado[chaveNorm] ?? (mapaMedias[item.nome.toUpperCase()] || 0);
                const perc = mediaOutras > 0 ? ((item.total - mediaOutras) / mediaOutras) * 100 : null;
                return (
                  <tr key={item.nome}>
                    <td style={{ ...S.td, minWidth: 180 }}>
                      <div style={{ fontWeight: 700 }}>{item.nome}</div>
                      <div style={{ height: 4, borderRadius: 2, backgroundColor: '#f1f5f9', marginTop: 4 }}>
                        <div style={{ height: 4, borderRadius: 2, backgroundColor: C.verde, width: `${Math.max(2, (item.total / maximo) * 100)}%` }} />
                      </div>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: C.verdeEscuro, whiteSpace: 'nowrap' }}>{fmt(item.total)} {item.unidade}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: C.textoSuave }}>{item.diasTrabalhados}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(item.mediaDia)} {item.unidade}</td>
                    {temMediaOutrasObras && (
                      <td style={{ ...S.td, textAlign: 'right', color: '#d97706' }}>{mediaOutras > 0 ? fmt(mediaOutras) : '—'}</td>
                    )}
                    {temMediaOutrasObras && (
                      <td style={{ ...S.td, textAlign: 'center', fontSize: 11 }}><Variacao perc={perc} /></td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    );
  };

  const renderTabelaRdos = () => {
    const visiveis = diariosFiltrados.slice(0, linhasVisiveis);
    return (
      <div style={S.card}>
        <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 12, fontSize: 13 }}>
          Listagem Detalhada dos Diários de Obra
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr>
                <th style={S.th}>DATA / OBRA</th>
                <th style={S.th}>EQUIPE</th>
                <th style={{ ...S.th, textAlign: 'center' }}>STATUS RDO</th>
                <th style={{ ...S.th, textAlign: 'center' }}>STATUS OPERACIONAL</th>
                <th style={S.th}>ATIVIDADES E QUANTIDADES</th>
                <th style={{ ...S.th, textAlign: 'right' }}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 ? (
                <tr><td colSpan={6} style={S.vazio}>Nenhum diário registrado no período.</td></tr>
              ) : visiveis.map((rdo, i) => (
                <tr key={`rdo-${rdo.id_diario || rdo.id || i}`} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <td style={S.td}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{formatarDataExibicao(rdo.data_diario)}</div>
                    <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 700, marginTop: 2 }}>
                      [{rdo.codigo_obra || 'OBRA'}] {rdo.nome_obra}
                    </div>
                  </td>
                  <td style={S.td}>
                    <div style={{ fontWeight: 700, color: '#334155' }}>{rdo.equipe || 'Geral'}</div>
                    <div style={{ fontSize: 10, color: C.textoSuave, marginTop: 2 }}>
                      Gestor: {rdo.nome_gestor || '—'}
                    </div>
                  </td>
                  <td style={{ ...S.td, textAlign: 'center' }}>
                    <BadgeStatusRdo status={rdo.status_rdo} />
                  </td>
                  <td style={{ ...S.td, textAlign: 'center' }}>
                    <BadgeStatusOp status={rdo.status_operacional} />
                  </td>
                  <td style={S.td}>
                    {rdo.servicos_resumo ? (
                      <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '6px 10px', color: '#166534', fontWeight: 600, fontSize: 11, whiteSpace: 'pre-line' }}>
                        {rdo.servicos_resumo}
                      </div>
                    ) : (
                      <span style={{ color: C.textoMudo, fontStyle: 'italic' }}>Sem atividades lançadas</span>
                    )}
                  </td>
                  <td style={{ ...S.td, textAlign: 'right' }}>
                    <button onClick={() => setDiarioSelecionado(rdo)} style={S.btnMini}>
                      Abrir RDO
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <VerMais total={diariosFiltrados.length} visiveis={linhasVisiveis} onMais={() => setLinhasVisiveis(v => v + LINHAS_POR_PAGINA)} />
      </div>
    );
  };

  const renderDashboard = () => (
    <>
      {renderKpis()}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 12 }}>
        <Card titulo="Ranking de produção" Icone={BarChart3}
          acao={
            <select value={limiteTopAtividades} onChange={e => setLimiteTopAtividades(Number(e.target.value))} style={{ ...S.campo, width: 'auto', height: 26, fontSize: 11 }}>
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={999}>Todas</option>
            </select>
          }>
          {chartRankingData.data.labels.length > 0 ? (
            <div style={{ position: 'relative', height: Math.max(220, chartRankingData.data.labels.length * 30) }}>
              <Bar data={chartRankingData.data} options={chartRankingOptions} />
            </div>
          ) : <div style={S.vazio}>Sem dados para o ranking.</div>}
        </Card>

        <Card titulo="Evolução da produção" Icone={TrendingUp}
          acao={
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={atividadeEvolucao} onChange={e => setAtividadeEvolucao(e.target.value)} style={{ ...S.campo, width: 'auto', maxWidth: 170, height: 26, fontSize: 11 }}>
                <option value="">Líder: {atividadesOrdenadas[0]?.nome || '—'}</option>
                <option value="TODAS">Todas (soma geral)</option>
                {atividadesOrdenadas.map(a => <option key={a.nome} value={a.nome}>{a.nome}</option>)}
              </select>
              <Toggle valor={visEvolucao} onChange={setVisEvolucao} opcoes={[{ value: 'diaria', label: 'Diária' }, { value: 'mensal', label: 'Mensal' }]} />
            </div>
          }>
          {chartEvolucaoData.labels.length > 0 ? (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: C.textoSuave }}>
                <span style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', borderRadius: 4, padding: '2px 8px', fontWeight: 700 }}>
                  Média {visEvolucao === 'diaria' ? 'por dia' : 'por mês'}: {fmt(mediaEvolucao)} {unidadeEvolucao}
                </span>
                {atividadeEfetiva === 'TODAS' && <span>⚠️ soma mistura unidades (m² e un)</span>}
              </div>
              <div style={{ position: 'relative', height: 260 }}>
                <Line data={chartEvolucaoData} options={chartEvolucaoOptions} />
              </div>
            </>
          ) : <div style={S.vazio}>Sem dados temporais disponíveis.</div>}
        </Card>
      </div>

      {renderTabelaResumoAtividades()}

      {temMediaOutrasObras && (
        <Card titulo="Obra atual vs. média das outras obras" Icone={BarChart3} cor={C.laranja}>
          <div style={{ position: 'relative', height: 240 }}>
            <Bar data={chartComparativoData.data} options={chartComparativoOptions} />
          </div>
        </Card>
      )}

      {renderTabelaRdos()}
    </>
  );

  const renderListaItens = ({ titulo, Icone, itens, colunaItem, busca, setBusca, mostrarStatusOp }) => {
    const visiveis = itens.slice(0, linhasVisiveis);
    const colunas = mostrarStatusOp ? 7 : 6;
    return (
      <Card titulo={`${titulo} (${itens.length})`} Icone={Icone}
        acao={
          <div style={{ position: 'relative', width: 220 }}>
            <input type="text" placeholder={`Buscar ${colunaItem.toLowerCase()}...`} value={busca} onChange={e => setBusca(e.target.value)} style={{ ...S.campo, height: 28, paddingLeft: 26 }} />
            <Search style={{ width: 13, position: 'absolute', left: 8, top: 7, color: C.textoMudo }} />
          </div>
        }>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr>
                <th style={S.th}>Data</th>
                <th style={S.th}>Obra</th>
                <th style={S.th}>Equipe</th>
                <th style={S.th}>{colunaItem}</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Qtd</th>
                {mostrarStatusOp && <th style={{ ...S.th, textAlign: 'center' }}>Status op.</th>}
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 ? (
                <tr><td colSpan={colunas} style={S.vazio}>Nenhum registro no período.</td></tr>
              ) : visiveis.map((it, i) => (
                <tr key={i}>
                  <td style={{ ...S.td, fontWeight: 700, whiteSpace: 'nowrap' }}>{formatarDataExibicao(it.rdo.data_diario)}</td>
                  <td style={S.td}>{it.rdo.nome_obra}</td>
                  <td style={S.td}>{it.rdo.equipe || 'Geral'}</td>
                  <td style={{ ...S.td, fontWeight: 700, color: '#166534' }}>{it.descricao}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(it.quantidade)} {it.unidade || 'UN'}</td>
                  {mostrarStatusOp && <td style={{ ...S.td, textAlign: 'center' }}><BadgeStatusOp status={it.rdo.status_operacional} /></td>}
                  <td style={{ ...S.td, textAlign: 'right' }}>
                    <button onClick={() => setDiarioSelecionado(it.rdo)} style={S.btnMini}>Abrir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <VerMais total={itens.length} visiveis={linhasVisiveis} onMais={() => setLinhasVisiveis(v => v + LINHAS_POR_PAGINA)} />
      </Card>
    );
  };

const renderModalRdo = () => {
    const d = diarioSelecionado;

    // Converte a string de fotos vindas do backend em um array de URLs
    const fotos = d.fotos_anexadas
      ? (Array.isArray(d.fotos_anexadas) 
          ? d.fotos_anexadas 
          : d.fotos_anexadas.split(','))
      : (d.arquivos || []);

    return (
      <div style={{ ...S.overlay, zIndex: 200 }}>
        <div style={{ backgroundColor: C.branco, borderRadius: 8, width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${C.textoMudo}` }}>
          <div style={{ padding: '10px 14px', backgroundColor: C.texto, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0 }}>
            <span style={{ fontWeight: 700 }}>RDO — {formatarDataExibicao(d.data_diario)}</span>
            <button onClick={() => setDiarioSelecionado(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X style={{ width: 18 }} /></button>
          </div>

          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
              <div><strong>Obra:</strong> {d.nome_obra}</div>
              <div><strong>Equipe:</strong> {d.equipe || 'Geral'}</div>
              <div><strong>Gestor:</strong> {d.nome_gestor || 'Não informado'}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <BadgeStatusRdo status={d.status_rdo} /> <BadgeStatusOp status={d.status_operacional} />
              </div>
            </div>

            <div style={{ border: `1px solid ${C.borda}`, borderRadius: 6, padding: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users style={{ width: 14 }} /> Efetivo presente ({d.total_efetivo || 0})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {d.nomes_efetivo ? d.nomes_efetivo.split(/[\n,]+/).map((n, i) => (
                  <span key={i} style={{ backgroundColor: '#f1f5f9', border: `1px solid ${C.bordaForte}`, padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>👤 {n.trim().toUpperCase()}</span>
                )) : <span style={{ color: C.textoMudo }}>Nenhum colaborador listado.</span>}
              </div>
            </div>

            <div style={{ border: `1px solid ${C.bordaForte}`, borderRadius: 6, padding: 10, backgroundColor: '#fffbe3' }}>
              <div style={{ fontWeight: 700, color: '#b45309', marginBottom: 4 }}>Resumo dos serviços</div>
              <div style={{ whiteSpace: 'pre-line' }}>{d.servicos_resumo || 'Sem registros.'}</div>
            </div>

            {/* SEÇÃO DE FOTOS E ANEXOS DO RDO COM LINK PARA EXPANDIR */}
            <div style={{ border: `1px solid ${C.borda}`, borderRadius: 6, padding: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                📷 Fotos e Anexos ({fotos.length})
              </div>

              {fotos.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                  {fotos.map((urlFoto, idx) => {
                    const urlCompleta = urlFoto.startsWith('http') 
                      ? urlFoto 
                      : `http://localhost:3001${urlFoto.startsWith('/') ? '' : '/'}${urlFoto}`;

                    return (
                      <div key={idx} style={{ border: `1px solid ${C.borda}`, borderRadius: 6, overflow: 'hidden', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
                        <a href={urlCompleta} target="_blank" rel="noopener noreferrer" title="Clique para abrir imagem original em alta resolução">
                          <img 
                            src={urlCompleta} 
                            alt={`Anexo ${idx + 1}`} 
                            style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block', cursor: 'zoom-in' }} 
                          />
                        </a>
                        <div style={{ padding: '6px 4px', textAlign: 'center', backgroundColor: '#fff' }}>
                          <a 
                            href={urlCompleta} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                          >
                            <ArrowUpRight style={{ width: 12 }} /> Ver Completa
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: C.textoMudo, fontStyle: 'italic', fontSize: 11 }}>
                  Nenhum arquivo ou imagem anexado a este diário.
                </div>
              )}
            </div>

            <div style={{ border: `1px solid ${C.borda}`, borderRadius: 6, padding: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Observações</div>
              <div>{d.observacoes || 'Sem observações.'}</div>
            </div>
          </div>

          <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.borda}`, backgroundColor: C.fundo, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {isMaster && (
              <button onClick={() => setModalExcluir(d)} style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', fontWeight: 700 }}>
                Excluir RDO
              </button>
            )}
            <button onClick={() => setDiarioSelecionado(null)} style={{ padding: '6px 16px', backgroundColor: C.textoSuave, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>Fechar</button>
          </div>
        </div>
      </div>
    );
  };

  const renderModalExcluir = () => (
    <div style={{ ...S.overlay, zIndex: 210 }}>
      <div style={{ backgroundColor: C.branco, borderRadius: 8, width: '100%', maxWidth: 400, padding: 16, border: `1px solid ${C.bordaForte}` }}>
        <h3 style={{ margin: '0 0 8px 0', color: '#991b1b' }}>Excluir o Diário nº {modalExcluir.id_diario || modalExcluir.id}?</h3>
        <p style={{ color: '#334155', margin: '0 0 16px 0' }}>
          Tem certeza de que deseja excluir o diário da obra <strong>{modalExcluir.nome_obra}</strong> do dia <strong>{formatarDataExibicao(modalExcluir.data_diario)}</strong>? Esta ação não poderá ser desfeita.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={() => setModalExcluir(null)} style={{ padding: '6px 12px', backgroundColor: C.borda, border: 'none', borderRadius: 4, cursor: 'pointer' }}>Cancelar</button>
          <button type="button" onClick={handleExcluirRdo} disabled={processandoAcao} style={{ padding: '6px 12px', backgroundColor: C.vermelho, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>
            {processandoAcao ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  );

  // ---------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------
  return (
    <div style={S.pagina}>
      {/* ABAS */}
      <div style={{ display: 'flex', gap: 6, borderBottom: `2px solid ${C.bordaForte}`, overflowX: 'auto' }}>
        {ABAS.map(aba => {
          const Icone = aba.icon;
          const ativa = abaAtiva === aba.key;
          return (
            <button key={aba.key} onClick={() => setAbaAtiva(aba.key)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: 'none',
              borderBottom: ativa ? `3px solid ${C.verde}` : '3px solid transparent',
              backgroundColor: ativa ? C.branco : 'transparent',
              color: ativa ? C.verdeEscuro : C.textoSuave,
              fontWeight: ativa ? 700 : 500, cursor: 'pointer', borderRadius: '4px 4px 0 0', whiteSpace: 'nowrap'
            }}>
              <Icone style={{ width: 15 }} /> {aba.label}
            </button>
          );
        })}
      </div>

      {renderFiltros()}

      {loading ? (
        <div style={{ ...S.card, ...S.vazio, fontWeight: 700 }}>Carregando dados...</div>
      ) : (
        <>
          {abaAtiva === 'RDO' && renderDashboard()}
          {abaAtiva === 'ATIVIDADES' && renderListaItens({
            titulo: 'Produção por atividade', Icone: Layers, itens: atividadesExtraidas,
            colunaItem: 'Atividade', busca: buscaAtividade, setBusca: setBuscaAtividade, mostrarStatusOp: true
          })}
          {abaAtiva === 'MATERIAIS' && renderListaItens({
            titulo: 'Consumo de materiais', Icone: Package, itens: materiaisExtraidos,
            colunaItem: 'Material', busca: buscaMaterial, setBusca: setBuscaMaterial, mostrarStatusOp: false
          })}
        </>
      )}

      {diarioSelecionado && renderModalRdo()}
      {modalExcluir && renderModalExcluir()}
    </div>
  );
}