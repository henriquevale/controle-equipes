import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  Users,
  CheckCircle,
  XCircle,
  Calendar,
  Sun,
  Search,
  Download,
  ChevronDown,
  ChevronRight,
  Clock,
  Building,
  Tag,
  AlertTriangle,
  Layers,
  Umbrella,
  Briefcase,
} from 'lucide-react';

const API_URL = 'http://localhost:3001/api';
// Extrai a origem base da API (remove o sufixo /api se existir) para montar a URL das fotos
const BASE_UPLOADS_URL = API_URL.replace(/\/api\/?$/, '');

// Larguras das colunas fixas da matriz
const COL_EXPANDIR = 35;
const COL_MATRICULA = 90;
const COL_NOME = 220;
const COL_NOME_LEFT = COL_EXPANDIR + COL_MATRICULA;
const COL_DIA = 34;
const COL_TOTAL = 60;
const COL_HORAS = 70;

const COR = {
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
};

const PALETA = {
  presente: { bg: '#dcfce7', fg: '#15803d' },
  alocado: { bg: '#e0e7ff', fg: '#4338ca' },
  falta: { bg: '#fee2e2', fg: '#dc2626' },
  ferias: { bg: '#f3e8ff', fg: '#7e22ce' },
  folga: { bg: '#fef3c7', fg: '#b45309' },
  chuva: { bg: '#ffedd5', fg: '#c2410c' },
  impedimento: { bg: '#fee2e2', fg: '#991b1b' },
  apoio: { bg: '#dbeafe', fg: '#1d4ed8' },
  multiplo: { bg: '#3b82f6', fg: '#ffffff' },
  neutro: { bg: '#f1f5f9', fg: '#475569' },
  info: { bg: '#e0f2fe', fg: '#0369a1' },
};

/* ==========================================================================
   FUNÇÕES AUXILIARES
   ========================================================================== */

const isoDoServidor = (valor) =>
  valor ? new Date(valor).toISOString().slice(0, 10) : '';

const isoLocal = (date) => {
  const a = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
};

const formatarDataISO = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR');

const maiusculo = (v) => (v || '').toUpperCase();

const classificarOperacional = (item) => {
  const op = maiusculo(item.status_operacional);
  if (op.includes('CHUVA') || op.includes('CHOVEU')) return 'chuva';
  if (op.includes('MATERIAL') || op.includes('EQUIPAMENTO')) return 'impedimento';
  if (op.includes('APOIO') || maiusculo(item.equipe).includes('APOIO')) return 'apoio';
  return 'neutro';
};

const intervaloDoMes = (tipo) => {
  const hoje = new Date();
  let ano = hoje.getFullYear();
  let mes = hoje.getMonth();

  if (tipo === 'MES_ANTERIOR') {
    mes -= 1;
    if (mes < 0) {
      mes = 11;
      ano -= 1;
    }
  }

  return {
    inicio: isoLocal(new Date(ano, mes, 1)),
    fim: isoLocal(new Date(ano, mes + 1, 0)),
  };
};

const obterSimboloDia = (eventos) => {
  if (!eventos || eventos.length === 0) return '-';
  if (eventos.length > 1) return `+${eventos.length}`;

  const ev = eventos[0];
  const presenca = maiusculo(ev.status_presenca);

  if (presenca === 'FALTOU') return 'F';
  if (presenca === 'FÉRIAS' || presenca === 'FERIAS') return 'FE';
  if (presenca === 'FOLGA') return 'FOL';
  if (presenca === 'ALOCADO') return 'AL';

  switch (classificarOperacional(ev)) {
    case 'chuva': return '☔';
    case 'impedimento': return 'IMP';
    case 'apoio': return 'AP';
    default: return 'P';
  }
};

/* ==========================================================================
   ESTILOS
   ========================================================================== */

const s = {
  pagina: {
    padding: 16,
    fontFamily: 'sans-serif',
    backgroundColor: COR.slate[50],
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  cartao: {
    backgroundColor: '#fff',
    border: `1px solid ${COR.slate[300]}`,
    borderRadius: 6,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  rotulo: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COR.slate[600],
    textTransform: 'uppercase',
  },
  campo: {
    height: 32,
    padding: '0 8px',
    border: `1px solid ${COR.slate[300]}`,
    borderRadius: 4,
    fontSize: 11,
    color: COR.slate[800],
    backgroundColor: '#fff',
  },
  coluna: { display: 'flex', flexDirection: 'column', gap: 4 },
  badge: (paleta) => ({
    backgroundColor: paleta.bg,
    color: paleta.fg,
    padding: '3px 6px',
    borderRadius: 4,
    fontWeight: 'bold',
    fontSize: 10,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  }),
  th: {
    padding: 10,
    borderBottom: `2px solid ${COR.slate[300]}`,
    backgroundColor: COR.slate[100],
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  td: {
    padding: 8,
    borderBottom: `1px solid ${COR.slate[200]}`,
  },
};

/* ==========================================================================
   COMPONENTES PEQUENOS
   ========================================================================== */

function Badge({ paleta, children, ...rest }) {
  return (
    <span style={s.badge(paleta)} {...rest}>
      {children}
    </span>
  );
}

function CardIndicador({ rotulo, valor, icone: Icone, corIcone, bgIcone, corRotulo, corValor }) {
  return (
    <div style={{ ...s.cartao, boxShadow: 'none', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ backgroundColor: bgIcone, padding: 8, borderRadius: 6 }}>
        <Icone style={{ width: 16, height: 16, color: corIcone }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 9, color: corRotulo, fontWeight: 'bold', textTransform: 'uppercase' }}>
          {rotulo}
        </span>
        <span style={{ fontSize: 15, fontWeight: 'bold', color: corValor }}>{valor}</span>
      </div>
    </div>
  );
}

function CelulaMatriz({ eventos }) {
  if (!eventos || eventos.length === 0) {
    return <span title="Sem registro" style={{ color: COR.slate[300], fontSize: 11 }}>—</span>;
  }

  if (eventos.length > 1) {
    return (
      <Badge
        paleta={PALETA.multiplo}
        title={`Múltiplos RDOs no dia (${eventos.length} alocações)`}
      >
        <Layers size={10} />
        <span>+{eventos.length}</span>
      </Badge>
    );
  }

  const ev = eventos[0];
  const presenca = maiusculo(ev.status_presenca);

  if (presenca === 'FALTOU') {
    return <Badge paleta={PALETA.falta} title="Falta não justificada">F</Badge>;
  }
  if (presenca === 'FÉRIAS' || presenca === 'FERIAS') {
    return <Badge paleta={PALETA.ferias} title="Férias / Afastamento">FE</Badge>;
  }
  if (presenca === 'FOLGA') {
    return <Badge paleta={PALETA.folga} title="Folga programada">FOL</Badge>;
  }
  if (presenca === 'ALOCADO') {
    return <Badge paleta={PALETA.alocado} title="Alocado (Não salvo completamente)">AL</Badge>;
  }

  switch (classificarOperacional(ev)) {
    case 'chuva':
      return <Badge paleta={PALETA.chuva} title="Impedimento: Chuva"><Umbrella size={10} /></Badge>;
    case 'impedimento':
      return (
        <Badge paleta={PALETA.impedimento} title={`Impedimento: ${ev.status_operacional}`}>
          <AlertTriangle size={10} />
        </Badge>
      );
    case 'apoio':
      return <Badge paleta={PALETA.apoio} title="Em Apoio / Remanejado">AP</Badge>;
    default:
      return <Badge paleta={PALETA.presente} title="Trabalho Normal / Presente">P</Badge>;
  }
}

function LegendaMatriz() {
  const itens = [
    { paleta: PALETA.presente, simbolo: 'P', texto: 'Trabalho Normal' },
    { paleta: PALETA.alocado, simbolo: 'AL', texto: 'Alocado (Incompleto)' },
    { paleta: PALETA.chuva, simbolo: '☔', texto: 'Impedimento / Chuva' },
    { paleta: PALETA.apoio, simbolo: 'AP', texto: 'Apoio / Remanejado' },
    { paleta: PALETA.falta, simbolo: 'F', texto: 'Falta' },
    { paleta: PALETA.folga, simbolo: 'FOL', texto: 'Folga' },
    { paleta: PALETA.ferias, simbolo: 'FE', texto: 'Férias' },
    { paleta: PALETA.multiplo, simbolo: '+2', texto: 'Múltiplos RDOs no dia' },
  ];

  return (
    <div style={{ ...s.cartao, boxShadow: 'none', padding: '8px 12px', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 10 }}>
      <span style={{ fontWeight: 'bold', color: COR.slate[600] }}>LEGENDA DA MATRIZ:</span>
      {itens.map(({ paleta, simbolo, texto }) => (
        <span key={texto} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ backgroundColor: paleta.bg, color: paleta.fg, padding: '1px 5px', borderRadius: 3, fontWeight: 'bold' }}>
            {simbolo}
          </span>
          {texto}
        </span>
      ))}
    </div>
  );
}

/* ==========================================================================
   DETALHAMENTO INDIVIDUAL (LINHA DO TEMPO DO COLABORADOR)
   ========================================================================== */

const COLUNAS_DETALHE = [
  { titulo: 'Data', align: 'left' },
  { titulo: 'Obra / Alocação', align: 'left' },
  { titulo: 'Equipe', align: 'center' },
  { titulo: 'Horário Jornada', align: 'center' },
  { titulo: 'Status Presença', align: 'center' },
  { titulo: 'Condição Operacional', align: 'center' },
  { titulo: 'Observação', align: 'left' },
];

const celulaDetalhe = { padding: 8, border: `1px solid ${COR.slate[200]}` };

function MensagemDetalhe({ cor, italico, children }) {
  return (
    <div style={{ padding: 16, fontSize: 11, color: cor, textAlign: 'center', fontStyle: italico ? 'italic' : 'normal' }}>
      {children}
    </div>
  );
}

function DetalhesRastroFuncionario({ idFuncionario, filtros, dataSelecionadaDia }) {
  const [historico, setHistorico] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!idFuncionario) return;

    const carregar = async () => {
      setCarregando(true);
      try {
        const res = await axios.get(`${API_URL}/rh/historico-presenca-detalhado`, {
          params: { ...filtros, id_funcionario: Number(idFuncionario) },
        });
        setHistorico(res.data || []);
      } catch (err) {
        console.error('Erro ao carregar detalhamento do funcionário:', err);
      } finally {
        setCarregando(false);
      }
    };

    carregar();
  }, [idFuncionario, filtros]);

  const historicoFiltrado = useMemo(() => {
    if (!dataSelecionadaDia) return historico;
    return historico.filter((item) => isoDoServidor(item.data_diario) === dataSelecionadaDia);
  }, [historico, dataSelecionadaDia]);

  if (carregando) {
    return (
      <MensagemDetalhe cor={COR.slate[500]} italico>
        Carregando histórico cronológico e diários de obra...
      </MensagemDetalhe>
    );
  }

  if (historicoFiltrado.length === 0) {
    return (
      <MensagemDetalhe cor={COR.slate[400]}>
        {dataSelecionadaDia
          ? `Nenhum lançamento de RDO/Presença registrado para o dia ${formatarDataISO(dataSelecionadaDia)}.`
          : 'Nenhum registro detalhado de obra/horário encontrado para os filtros selecionados.'}
      </MensagemDetalhe>
    );
  }

  return (
    <div style={{ padding: 14, backgroundColor: COR.slate[50], borderRadius: 6, border: `1px solid ${COR.slate[300]}`, margin: '8px 0' }}>
      <div style={{ fontSize: 11, fontWeight: 'bold', color: COR.slate[800], marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={14} color="#0284c7" />
          HISTÓRICO CRONOLÓGICO DE JORNADA E ALOCAÇÕES POR OBRA
        </span>
        {dataSelecionadaDia && (
          <span style={{ fontSize: 10, backgroundColor: PALETA.info.bg, color: PALETA.info.fg, padding: '2px 8px', borderRadius: 4 }}>
            Filtrado pelo dia: {formatarDataISO(dataSelecionadaDia)}
          </span>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, backgroundColor: '#fff', borderRadius: 4, overflow: 'hidden' }}>
          <thead>
            <tr style={{ backgroundColor: COR.slate[100], color: COR.slate[600], textTransform: 'uppercase', fontSize: 10 }}>
              {COLUNAS_DETALHE.map((c) => (
                <th key={c.titulo} style={{ padding: 8, textAlign: c.align, border: `1px solid ${COR.slate[300]}` }}>
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {historicoFiltrado.map((item, idx) => {
              const dataFormatada = item.data_diario
                ? new Date(item.data_diario).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                : '-';

              const presenca = item.status_presenca || 'PRESENTE';
              const paletaPresenca =
                presenca === 'PRESENTE' ? PALETA.presente : presenca === 'FALTOU' ? PALETA.falta : presenca === 'ALOCADO' ? PALETA.alocado : PALETA.info;
              const paletaOperacional = PALETA[classificarOperacional(item)];

              const horario = item.hora_inicio
                ? `${item.hora_inicio.slice(0, 5)} - ${item.hora_fim ? item.hora_fim.slice(0, 5) : 'Em aberto'}`
                : 'Jornada Integral';

              const fotos = item.fotos_anexadas
                ? (Array.isArray(item.fotos_anexadas) 
                    ? item.fotos_anexadas 
                    : item.fotos_anexadas.split(','))
                : [];

              return (
                <tr key={item.id || idx} style={{ borderBottom: `1px solid ${COR.slate[200]}`, backgroundColor: idx % 2 === 0 ? '#fff' : COR.slate[50] }}>
                  <td style={{ ...celulaDetalhe, fontWeight: 'bold', color: COR.slate[700] }}>{dataFormatada}</td>

                  <td style={{ ...celulaDetalhe, color: COR.slate[900], fontWeight: 500 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Building size={13} color={COR.slate[500]} />
                      <span>{item.nome_obra ? `[${item.codigo_obra || 'OBRA'}] ${item.nome_obra}` : 'Não Informada'}</span>
                    </div>
                  </td>

                  <td style={{ ...celulaDetalhe, textAlign: 'center', color: COR.slate[600] }}>{item.equipe || '-'}</td>

                  <td style={{ ...celulaDetalhe, textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold', color: PALETA.info.fg }}>
                    {horario}
                  </td>

                  <td style={{ ...celulaDetalhe, textAlign: 'center' }}>
                    <Badge paleta={paletaPresenca}>{presenca}</Badge>
                  </td>

                  <td style={{ ...celulaDetalhe, textAlign: 'center' }}>
                    <Badge paleta={paletaOperacional}>
                      <Tag size={11} />
                      {item.status_operacional || 'Normal'}
                    </Badge>
                  </td>

                  <td style={{ ...celulaDetalhe, color: COR.slate[700], minWidth: 180 }}>
                    <div>{item.observacao || 'Lançamento regular.'}</div>
                    
                    {fotos.length > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {fotos.map((urlFoto, fIdx) => {
                          const urlCompleta = urlFoto.startsWith('http')
                            ? urlFoto
                            : `${BASE_UPLOADS_URL}${urlFoto.startsWith('/') ? '' : '/'}${urlFoto}`;

                          return (
                            <a
                              key={fIdx}
                              href={urlCompleta}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                fontSize: 10,
                                fontWeight: 'bold',
                                color: '#2563eb',
                                backgroundColor: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                padding: '2px 6px',
                                borderRadius: 4,
                                textDecoration: 'none'
                              }}
                              title="Clique para abrir imagem original"
                            >
                              📷 Foto {fIdx + 1}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==========================================================================
   COMPONENTE PRINCIPAL
   ========================================================================== */

export default function HistoricoPresenca({ id, cargo }) {
  const [dadosPresenca, setDadosPresenca] = useState([]);
  const [detalhesBrutos, setDetalhesBrutos] = useState([]);
  const [obras, setObras] = useState([]);
  const [carregando, setCarregando] = useState(false);

  const [funcionarioExpandido, setFuncionarioExpandido] = useState(null);
  const [diaSelecionadoMatriz, setDiaSelecionadoMatriz] = useState(null);

  const [opcaoPeriodo, setOpcaoPeriodo] = useState('MES_ATUAL');
  const [idObra, setIdObra] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [termoBusca, setTermoBusca] = useState('');

  const ajustarDatasPorMes = useCallback((tipo) => {
    if (tipo !== 'MES_ATUAL' && tipo !== 'MES_ANTERIOR') return;
    const { inicio, fim } = intervaloDoMes(tipo);
    setDataInicio(inicio);
    setDataFim(fim);
  }, []);

  useEffect(() => {
    ajustarDatasPorMes('MES_ATUAL');
  }, [ajustarDatasPorMes]);

  useEffect(() => {
    if (!id) return;

    const carregarObras = async () => {
      try {
        const res = await axios.get(`${API_URL}/gestor/obras-ativas`, { params: { id, cargo } });
        setObras(res.data || []);
      } catch (e) {
        console.error('Erro ao carregar obras:', e);
      }
    };

    carregarObras();
  }, [id, cargo]);

  const buscarDadosMatriz = useCallback(async () => {
    if (!id || !dataInicio || !dataFim) return;

    const params = { 
      id: Number(id), 
      cargo, 
      id_obra: (idObra && idObra !== '' && idObra !== 'TODAS') ? Number(idObra) : undefined, 
      data_inicio: dataInicio, 
      data_fim: dataFim 
    };

    setCarregando(true);
    try {
      const [resConsolidado, resDetalhes] = await Promise.all([
        axios.get(`${API_URL}/rh/historico-presenca`, { params }),
        axios.get(`${API_URL}/rh/historico-presenca-detalhado-geral`, { params })
      ]);
      setDadosPresenca(resConsolidado.data || []);
      setDetalhesBrutos(resDetalhes.data || []);
    } catch (erro) {
      console.error('Erro ao carregar matriz mensal:', erro);
    } finally {
      setCarregando(false);
    }
  }, [id, cargo, idObra, dataInicio, dataFim]);

  useEffect(() => {
    if (id && dataInicio && dataFim) buscarDadosMatriz();
  }, [buscarDadosMatriz, id, dataInicio, dataFim]);

  const listaDiasMes = useMemo(() => {
    if (!dataInicio || !dataFim) return [];
    const dias = [];
    const atual = new Date(`${dataInicio}T00:00:00`);
    const fim = new Date(`${dataFim}T00:00:00`);
    while (atual <= fim) {
      dias.push(new Date(atual));
      atual.setDate(atual.getDate() + 1);
    }
    return dias;
  }, [dataInicio, dataFim]);

  const mapaDiarioFuncionario = useMemo(() => {
    const mapa = {};
    detalhesBrutos.forEach((item) => {
      const fid = item.id_funcionario;
      const dataIso = isoDoServidor(item.data_diario);
      if (!fid || !dataIso) return;
      ((mapa[fid] ??= {})[dataIso] ??= []).push(item);
    });
    return mapa;
  }, [detalhesBrutos]);

  const dadosFiltrados = useMemo(() => {
    const busca = termoBusca.toLowerCase().trim();
    if (!busca) return dadosPresenca;
    return dadosPresenca.filter(
      (p) =>
        (p.nome_funcionario || '').toLowerCase().includes(busca) ||
        (p.matricula || '').toLowerCase().includes(busca)
    );
  }, [dadosPresenca, termoBusca]);

  const totais = useMemo(
    () =>
      dadosFiltrados.reduce(
        (acc, p) => {
          acc.alocado += Number(p.total_alocado || 0);
          acc.integracao += Number(p.total_integracao || 0);
          acc.presente += Number(p.total_presente || 0);
          acc.faltou += Number(p.total_faltou || 0);
          acc.folga += Number(p.total_folga || 0);
          acc.ferias += Number(p.total_ferias || 0);
          acc.outros += Number(p.total_outro || p.total_outros || 0);
          return acc;
        },
        { alocado: 0, integracao: 0, presente: 0, faltou: 0, folga: 0, ferias: 0, outros: 0 }
      ),
    [dadosFiltrados]
  );

  const indicadores = [
    { rotulo: 'Colaboradores', valor: dadosFiltrados.length, icone: Users, bgIcone: COR.slate[100], corIcone: COR.slate[600], corRotulo: COR.slate[500], corValor: COR.slate[800] },
    { rotulo: 'Tot. Alocados', valor: totais.alocado, icone: Calendar, bgIcone: '#e0f2fe', corIcone: '#0369a1', corRotulo: '#0369a1', corValor: '#0c4a6e' },
    { rotulo: 'Tot. Presenças', valor: totais.presente, icone: CheckCircle, bgIcone: '#f0fdf4', corIcone: '#16a34a', corRotulo: '#166534', corValor: '#14532d' },
    { rotulo: 'Tot. Faltas', valor: totais.faltou, icone: XCircle, bgIcone: '#fef2f2', corIcone: '#dc2626', corRotulo: '#991b1b', corValor: '#7f1d1d' },
    { rotulo: 'Tot. Folgas', valor: totais.folga, icone: Sun, bgIcone: '#fffbeb', corIcone: '#d97706', corRotulo: '#92400e', corValor: '#78350f' },
    { rotulo: 'Integrações', valor: totais.integracao, icone: Briefcase, bgIcone: '#eff6ff', corIcone: '#2563eb', corRotulo: '#1e40af', corValor: '#1e3a8a' },
    { rotulo: 'Férias / Afast.', valor: totais.ferias + totais.outros, icone: Calendar, bgIcone: '#f5f3ff', corIcone: '#7c3aed', corRotulo: '#5b21b6', corValor: '#4c1d95' },
  ];

  const filtrosDetalhe = useMemo(
    () => ({ id, cargo, id_obra: idObra, data_inicio: dataInicio, data_fim: dataFim }),
    [id, cargo, idObra, dataInicio, dataFim]
  );

  const larguraTabela = COL_EXPANDIR + COL_MATRICULA + COL_NOME + listaDiasMes.length * COL_DIA + COL_TOTAL + COL_HORAS;

  const refTopo = useRef(null);
  const refCorpo = useRef(null);
  const sincronizando = useRef(false);
  const [larguraVisivel, setLarguraVisivel] = useState(0);

  useEffect(() => {
    const el = refCorpo.current;
    if (!el) return undefined;
    const medir = () => setLarguraVisivel(el.clientWidth);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [carregando, dadosFiltrados.length]);

  const sincronizarRolagem = (origem, destino) => {
    if (sincronizando.current) {
      sincronizando.current = false;
      return;
    }
    if (!destino.current || destino.current.scrollLeft === origem.current.scrollLeft) return;
    sincronizando.current = true;
    destino.current.scrollLeft = origem.current.scrollLeft;
  };

  const alternarExpansao = (idFuncionario, dia = null) => {
    setDiaSelecionadoMatriz(dia);
    setFuncionarioExpandido((atual) => (dia ? idFuncionario : atual === idFuncionario ? null : idFuncionario));
  };

  const limparFiltros = () => {
    setIdObra('');
    setTermoBusca('');
    setOpcaoPeriodo('MES_ATUAL');
    ajustarDatasPorMes('MES_ATUAL');
  };

  const exportarParaExcel = () => {
    if (dadosFiltrados.length === 0) return;

    const cabecalho = [
      'Matrícula',
      'Colaborador',
      'Cargo',
      ...listaDiasMes.map(dia => `${String(dia.getDate()).padStart(2, '0')}/${String(dia.getMonth() + 1).padStart(2, '0')}`),
      'Total Pres.',
      'Total Horas'
    ];

    const linhas = dadosFiltrados.map((p) => {
      const mapaFunc = mapaDiarioFuncionario[p.id_funcionario] || {};

      const diasDoFuncionario = listaDiasMes.map(dia => {
        const dataIso = isoLocal(dia);
        const eventosDoDia = mapaFunc[dataIso];
        return obterSimboloDia(eventosDoDia);
      });

      return [
        p.matricula || '-',
        p.nome_funcionario || '-',
        p.cargo || '-',
        ...diasDoFuncionario,
        p.total_presente || 0,
        p.total_horas ? `${Number(p.total_horas).toFixed(1)}h` : '0h'
      ];
    });

    const wsData = [cabecalho, ...linhas];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const colWidths = [
      { wch: 15 },
      { wch: 35 },
      { wch: 20 },
      ...listaDiasMes.map(() => ({ wch: 6 })),
      { wch: 12 },
      { wch: 12 }
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Matriz_Presenca');
    XLSX.writeFile(wb, `Matriz_Presenca_${dataInicio}_a_${dataFim}.xlsx`);
  };

  const semDados = dadosFiltrados.length === 0;

  return (
    <div style={s.pagina}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 'bold', textTransform: 'uppercase', margin: 0, color: COR.slate[900], display: 'flex', alignItems: 'center', gap: 8 }}>
            📋 CONTROLE DE PRESENÇA E RASTREABILIDADE DE EFETIVO
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: COR.slate[500] }}>
            Acompanhe a jornada, a presença, as obras e as ocorrências operacionais dos colaboradores.
          </p>
        </div>

        <button
          onClick={exportarParaExcel}
          disabled={semDados}
          style={{
            height: 34,
            padding: '0 14px',
            backgroundColor: semDados ? COR.slate[400] : '#16a34a',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 'bold',
            cursor: semDados ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          <Download style={{ width: 14, height: 14 }} />
          <span>Exportar Matriz Excel</span>
        </button>
      </div>

      <div style={{ ...s.cartao, display: 'flex', gap: 12, flexWrap: 'wrap', padding: 14 }}>
        <div style={{ ...s.coluna, width: 140 }}>
          <label style={s.rotulo}>Período Mensal</label>
          <select
            value={opcaoPeriodo}
            onChange={(e) => {
              setOpcaoPeriodo(e.target.value);
              ajustarDatasPorMes(e.target.value);
            }}
            style={s.campo}
          >
            <option value="MES_ATUAL">Mês Atual</option>
            <option value="MES_ANTERIOR">Mês Anterior</option>
            <option value="PERSONALIZADO">Personalizado</option>
          </select>
        </div>

        <div style={{ ...s.coluna, flex: 1, minWidth: 200 }}>
          <label style={s.rotulo}>Pesquisar Colaborador</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search style={{ position: 'absolute', left: 8, width: 14, height: 14, color: COR.slate[400] }} />
            <input
              type="text"
              placeholder="Buscar por nome ou matrícula..."
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              style={{ ...s.campo, paddingLeft: 28, width: '100%' }}
            />
          </div>
        </div>

        <div style={{ ...s.coluna, flex: 1, minWidth: 200 }}>
          <label style={s.rotulo}>Filtrar por Obra</label>
          <select value={idObra} onChange={(e) => setIdObra(e.target.value)} style={{ ...s.campo, width: '100%' }}>
            <option value="">
              {cargo === 'MASTER' || cargo === 'RH' ? 'Todas as Obras (Geral)' : 'Todas as Obras vinculadas'}
            </option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                [{o.codigo_obra}] {o.nome_obra}
              </option>
            ))}
          </select>
        </div>

        {[
          { rotulo: 'Data Início', valor: dataInicio, setar: setDataInicio },
          { rotulo: 'Data Fim', valor: dataFim, setar: setDataFim },
        ].map(({ rotulo, valor, setar }) => (
          <div key={rotulo} style={{ ...s.coluna, width: 130 }}>
            <label style={s.rotulo}>{rotulo}</label>
            <input
              type="date"
              value={valor}
              onChange={(e) => {
                setar(e.target.value);
                setOpcaoPeriodo('PERSONALIZADO');
              }}
              style={s.campo}
            />
          </div>
        ))}

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={limparFiltros}
            style={{ height: 32, padding: '0 16px', backgroundColor: COR.slate[500], color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase' }}
          >
            Limpar
          </button>
        </div>
      </div>

      {!carregando && !semDados && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: 10 }}>
          {indicadores.map((ind) => (
            <CardIndicador key={ind.rotulo} {...ind} />
          ))}
        </div>
      )}

      <LegendaMatriz />

      {carregando ? (
        <div style={{ ...s.cartao, boxShadow: 'none', padding: 32, textAlign: 'center' }}>
          <p style={{ color: COR.slate[500], fontSize: 12, fontStyle: 'italic', margin: 0 }}>
            Processando registros da matriz mensal...
          </p>
        </div>
      ) : semDados ? (
        <p style={{ color: COR.slate[500], fontSize: 11, padding: 24, border: `1px dashed ${COR.slate[300]}`, backgroundColor: '#fff', borderRadius: 6, textAlign: 'center', margin: 0 }}>
          Nenhum registro de presença encontrado para os filtros selecionados.
        </p>
      ) : (
        <div style={{ ...s.cartao, overflow: 'hidden' }}>
          <div
            ref={refTopo}
            onScroll={() => sincronizarRolagem(refTopo, refCorpo)}
            title="Arraste para ver os outros dias"
            style={{
              overflowX: 'auto',
              overflowY: 'hidden',
              width: larguraVisivel || '100%',
              height: 16,
              backgroundColor: COR.slate[100],
              borderBottom: `1px solid ${COR.slate[300]}`,
            }}
          >
            <div style={{ width: larguraTabela, height: 1 }} />
          </div>

          <div
            ref={refCorpo}
            onScroll={() => sincronizarRolagem(refCorpo, refTopo)}
            style={{ overflowX: 'auto', maxHeight: '70vh' }}
          >
            <table
              style={{
                tableLayout: 'fixed',
                width: larguraTabela,
                borderCollapse: 'separate',
                borderSpacing: 0,
                fontSize: 11,
                textAlign: 'left',
              }}
            >
              <colgroup>
                <col style={{ width: COL_EXPANDIR }} />
                <col style={{ width: COL_MATRICULA }} />
                <col style={{ width: COL_NOME }} />
                {listaDiasMes.map((dia) => (
                  <col key={isoLocal(dia)} style={{ width: COL_DIA }} />
                ))}
                <col style={{ width: COL_TOTAL }} />
                <col style={{ width: COL_HORAS }} />
              </colgroup>

              <thead>
                <tr style={{ color: COR.slate[600], fontSize: 10, textTransform: 'uppercase' }}>
                  <th style={{ ...s.th, position: 'sticky', left: 0, top: 0, zIndex: 20, borderRight: `1px solid ${COR.slate[300]}`, textAlign: 'center' }} />
                  <th style={{ ...s.th, position: 'sticky', left: COL_EXPANDIR, top: 0, zIndex: 20, borderRight: `1px solid ${COR.slate[300]}` }}>
                    Matrícula
                  </th>
                  <th style={{ ...s.th, position: 'sticky', left: COL_NOME_LEFT, top: 0, zIndex: 20, borderRight: `2px solid ${COR.slate[300]}` }}>
                    Colaborador / Cargo
                  </th>

                  {listaDiasMes.map((dia) => {
                    const fimDeSemana = dia.getDay() === 0 || dia.getDay() === 6;
                    return (
                      <th
                        key={isoLocal(dia)}
                        style={{
                          ...s.th,
                          padding: 6,
                          textAlign: 'center',
                          backgroundColor: fimDeSemana ? COR.slate[200] : COR.slate[100],
                          color: fimDeSemana ? COR.slate[500] : COR.slate[700],
                        }}
                      >
                        <div style={{ fontSize: 10, fontWeight: 'bold' }}>{String(dia.getDate()).padStart(2, '0')}</div>
                        <div style={{ fontSize: 8, opacity: 0.7 }}>{dia.toLocaleDateString('pt-BR', { weekday: 'narrow' })}</div>
                      </th>
                    );
                  })}

                  <th style={{ ...s.th, textAlign: 'center' }}>Pres.</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Horas</th>
                </tr>
              </thead>

              <tbody>
                {dadosFiltrados.map((p, index) => {
                  const expandido = funcionarioExpandido === p.id_funcionario;
                  const mapaFunc = mapaDiarioFuncionario[p.id_funcionario] || {};
                  const bgLinha = expandido ? '#e0f2fe' : index % 2 === 0 ? '#ffffff' : COR.slate[50];
                  const aoClicarLinha = () => alternarExpansao(p.id_funcionario);

                  const fixa = (left, extra = {}) => ({
                    position: 'sticky',
                    left,
                    zIndex: 5,
                    backgroundColor: bgLinha,
                    padding: 8,
                    borderBottom: `1px solid ${COR.slate[200]}`,
                    borderRight: `1px solid ${COR.slate[200]}`,
                    cursor: 'pointer',
                    ...extra,
                  });

                  return (
                    <React.Fragment key={`${p.id_funcionario}-${index}`}>
                      <tr style={{ backgroundColor: expandido ? '#f0f9ff' : index % 2 === 0 ? '#fff' : COR.slate[50], transition: 'background-color 0.15s' }}>
                        <td onClick={aoClicarLinha} style={fixa(0, { textAlign: 'center', color: '#0284c7' })}>
                          {expandido ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </td>

                        <td onClick={aoClicarLinha} style={fixa(COL_EXPANDIR, { fontWeight: 'bold', color: COR.slate[500], fontFamily: 'monospace' })}>
                          {p.matricula || '-'}
                        </td>

                        <td onClick={aoClicarLinha} style={fixa(COL_NOME_LEFT, { borderRight: `2px solid ${COR.slate[300]}` })}>
                          <div style={{ fontWeight: 'bold', color: COR.slate[900], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                            {p.nome_funcionario}
                          </div>
                          <div style={{ fontSize: 10, color: COR.slate[500], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                            {p.cargo || '-'}
                          </div>
                        </td>

                        {listaDiasMes.map((dia) => {
                          const dataIso = isoLocal(dia);
                          const fimDeSemana = dia.getDay() === 0 || dia.getDay() === 6;
                          return (
                            <td
                              key={dataIso}
                              onClick={() => alternarExpansao(p.id_funcionario, dataIso)}
                              style={{
                                padding: 4,
                                borderBottom: `1px solid ${COR.slate[200]}`,
                                borderRight: `1px solid ${COR.slate[200]}`,
                                textAlign: 'center',
                                cursor: 'pointer',
                                backgroundColor: fimDeSemana ? COR.slate[50] : undefined,
                              }}
                            >
                              <CelulaMatriz eventos={mapaFunc[dataIso]} />
                            </td>
                          );
                        })}

                        <td style={{ ...s.td, textAlign: 'center', fontWeight: 'bold', color: '#16a34a', backgroundColor: '#f0fdf4' }}>
                          {p.total_presente || 0}
                        </td>

                        <td style={{ ...s.td, textAlign: 'center', fontWeight: 'bold', color: '#0284c7', backgroundColor: '#e0f2fe' }}>
                          {p.total_horas ? `${Number(p.total_horas).toFixed(1)}h` : '0h'}
                        </td>
                      </tr>

                      {expandido && (
                        <tr>
                          <td colSpan={listaDiasMes.length + 5} style={{ padding: 0, backgroundColor: '#f0f9ff', borderBottom: '2px solid #0284c7' }}>
                            <div
                              style={{
                                position: 'sticky',
                                left: 0,
                                width: larguraVisivel || '100%',
                                boxSizing: 'border-box',
                                padding: '10px 16px',
                              }}
                            >
                              <DetalhesRastroFuncionario
                                idFuncionario={p.id_funcionario}
                                filtros={filtrosDetalhe}
                                dataSelecionadaDia={diaSelecionadoMatriz}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}