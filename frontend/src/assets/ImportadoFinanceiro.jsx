import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UploadCloud, FileSpreadsheet, Loader2, Eye, Trash2, X } from 'lucide-react';

export default function ImportadorFinanceiro({ API_URL, mostrarMensagem }) {
  // Dados do backend
  const [listaCentros, setListaCentros] = useState([]);
  const [listaObras, setListaObras] = useState([]);

  // Seleções do formulário
  const [tipoDestino, setTipoDestino] = useState(''); // 'CENTRO_CUSTO' ou 'OBRA'
  const [destinoId, setDestinoId] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [carregando, setCarregando] = useState(false);

  // Lista de Histórico e Modal
  const [historico, setHistorico] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [linhasDetalhe, setLinhasDetalhe] = useState([]);
  const [arquivoSelecionadoNome, setArquivoSelecionadoNome] = useState('');
  const [carregandoLinhas, setCarregandoLinhas] = useState(false);
  const [excluindoId, setExcluindoId] = useState(null);

  useEffect(() => {
    carregarCentrosEObras();
    carregarHistorico();
  }, []);

  const carregarCentrosEObras = async () => {
    try {
      const res = await axios.get(`${API_URL}/financeiro/centros-custo-obras`);
      setListaCentros(res.data.centrosCusto || []);
      setListaObras(res.data.obras || []);
    } catch (err) {
      console.error("Erro ao carregar opções:", err);
    }
  };

  const carregarHistorico = async () => {
    try {
      const res = await axios.get(`${API_URL}/financeiro/historico-importacoes`);
      setHistorico(res.data || []);
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
    }
  };

  const handleTipoChange = (e) => {
    setTipoDestino(e.target.value);
    setDestinoId(''); // Reseta o segundo select
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!tipoDestino || !destinoId) {
      if (mostrarMensagem) mostrarMensagem("Selecione o tipo e o destino.", "erro");
      return;
    }
    if (!arquivo) {
      if (mostrarMensagem) mostrarMensagem("Selecione um arquivo .xlsx ou .csv", "erro");
      return;
    }

    const formData = new FormData();
    formData.append('arquivo', arquivo);
    formData.append('tipo_destino', tipoDestino);
    formData.append('destino_id', destinoId);

    setCarregando(true);
    try {
      const res = await axios.post(`${API_URL}/financeiro/importar-planilha`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (mostrarMensagem) mostrarMensagem(res.data.message, "sucesso");
      setArquivo(null);
      carregarHistorico();
    } catch (err) {
      console.error("Erro no upload:", err);
      if (mostrarMensagem) mostrarMensagem(err.response?.data?.error || "Erro ao subir arquivo.", "erro");
    } finally {
      setCarregando(false);
    }
  };

  const abrirDetalhesModal = async (importacao) => {
    setArquivoSelecionadoNome(importacao.nome_arquivo);
    setModalAberto(true);
    setCarregandoLinhas(true);
    try {
      const res = await axios.get(`${API_URL}/financeiro/importacao/${importacao.id}/linhas`);
      setLinhasDetalhe(res.data || []);
    } catch (err) {
      console.error("Erro ao buscar detalhes:", err);
    } finally {
      setCarregandoLinhas(false);
    }
  };

  const handleExcluirImportacao = async (importacao) => {
    const confirmacao = window.confirm(
      `Tem certeza que deseja excluir a importação "${importacao.nome_arquivo}"?\n\nTodas as ${importacao.total_linhas} linhas associadas a ela serão apagadas permanentemente.`
    );

    if (!confirmacao) return;

    setExcluindoId(importacao.id);
    try {
      const res = await axios.delete(`${API_URL}/financeiro/importacao/${importacao.id}`);
      if (mostrarMensagem) mostrarMensagem(res.data.message || "Importação excluída!", "sucesso");
      carregarHistorico();
    } catch (err) {
      console.error("Erro ao excluir importação:", err);
      if (mostrarMensagem) mostrarMensagem(err.response?.data?.error || "Erro ao excluir arquivo.", "erro");
    } finally {
      setExcluindoId(null);
    }
  };

  const opcoesSegundaEtapa = tipoDestino === 'CENTRO_CUSTO' ? listaCentros : tipoDestino === 'OBRA' ? listaObras : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. SEÇÃO DE IMPORTAÇÃO */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <FileSpreadsheet style={{ width: '24px', height: '24px', color: '#2563eb' }} />
          <h3 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>Importar Planilha Financeira</h3>
        </div>

        <form onSubmit={handleUpload} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'end' }}>
          
          {/* Select 1: Tipo */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>
              1. TIPO DE DESTINO:
            </label>
            <select
              value={tipoDestino}
              onChange={handleTipoChange}
              style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '12px' }}
            >
              <option value="">-- Selecione o Tipo --</option>
              <option value="OBRA">Obra</option>
              <option value="CENTRO_CUSTO">Centro de Custo</option>
            </select>
          </div>

          {/* Select 2: Opção baseada no Select 1 */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>
              2. SELECIONE A OPÇÃO:
            </label>
            <select
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
              disabled={!tipoDestino}
              style={{ 
                width: '100%', 
                height: '38px', 
                borderRadius: '6px', 
                border: '1px solid #cbd5e1', 
                padding: '0 10px', 
                fontSize: '12px',
                backgroundColor: !tipoDestino ? '#f1f5f9' : '#fff'
              }}
            >
              <option value="">-- Primeiro escolha o Tipo --</option>
              {opcoesSegundaEtapa.map(item => (
                <option key={item.id} value={item.id}>{item.nome}</option>
              ))}
            </select>
          </div>

          {/* Input de Arquivo */}
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>
              3. SELECIONE O ARQUIVO (.XLSX / .CSV):
            </label>
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              onChange={(e) => setArquivo(e.target.files[0] || null)}
              style={{ width: '100%', fontSize: '12px' }}
            />
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <button 
              type="submit" 
              disabled={carregando}
              style={{
                height: '38px',
                width: '100%',
                backgroundColor: carregando ? '#94a3b8' : '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: carregando ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '12px'
              }}
            >
              {carregando ? <Loader2 className="animate-spin" style={{ width: '16px', height: '16px' }} /> : <UploadCloud style={{ width: '16px', height: '16px' }} />}
              {carregando ? 'Processando Arquivo...' : 'Enviar e Processar Planilha'}
            </button>
          </div>
        </form>
      </div>

      {/* 2. SEÇÃO DE HISTÓRICO DE IMPORTAÇÕES */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#1e293b' }}>Histórico de Planilhas Importadas</h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                <th style={{ padding: '10px' }}>Arquivo</th>
                <th style={{ padding: '10px' }}>Destino</th>
                <th style={{ padding: '10px' }}>Data de Upload</th>
                <th style={{ padding: '10px' }}>Total Linhas</th>
                <th style={{ padding: '10px' }}>Valor Total</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {historico.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>Nenhuma planilha importada até o momento.</td>
                </tr>
              ) : (
                historico.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#334155' }}>{item.nome_arquivo}</td>
                    <td style={{ padding: '10px', color: '#0284c7' }}>{item.centro_custo_nome || '-'}</td>
                    <td style={{ padding: '10px', color: '#64748b' }}>{new Date(item.criado_em).toLocaleString('pt-BR')}</td>
                    <td style={{ padding: '10px' }}>{item.total_linhas}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>R$ {Number(item.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <button
                          onClick={() => abrirDetalhesModal(item)}
                          style={{
                            backgroundColor: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            color: '#334155'
                          }}
                        >
                          <Eye style={{ width: '13px', height: '13px', color: '#2563eb' }} /> Ver Linhas
                        </button>

                        <button
                          onClick={() => handleExcluirImportacao(item)}
                          disabled={excluindoId === item.id}
                          style={{
                            backgroundColor: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            cursor: excluindoId === item.id ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            color: '#dc2626'
                          }}
                        >
                          {excluindoId === item.id ? (
                            <Loader2 className="animate-spin" style={{ width: '13px', height: '13px' }} />
                          ) : (
                            <Trash2 style={{ width: '13px', height: '13px', color: '#dc2626' }} />
                          )}
                          Excluir
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

      {/* 3. MODAL DE VISUALIZAÇÃO DE LINHAS */}
      {modalAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '900px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', color: '#1e293b' }}>Detalhes do Arquivo: {arquivoSelecionadoNome}</h4>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Exibindo os lançamentos gravados no banco</span>
              </div>
              <button onClick={() => setModalAberto(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X style={{ width: '20px', height: '20px', color: '#64748b' }} />
              </button>
            </div>

            <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
              {carregandoLinhas ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Loader2 className="animate-spin" style={{ width: '24px', height: '24px', margin: '0 auto', color: '#2563eb' }} />
                  <p style={{ marginTop: '8px', color: '#64748b' }}>Carregando linhas...</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Data Mov.</th>
                      <th style={{ padding: '8px' }}>Cliente / Fornecedor</th>
                      <th style={{ padding: '8px' }}>Descrição</th>
                      <th style={{ padding: '8px' }}>Categoria</th>
                      <th style={{ padding: '8px' }}>Tipo</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasDetalhe.map((linha) => (
                      <tr key={linha.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px' }}>{new Date(linha.data_movimento).toLocaleDateString('pt-BR')}</td>
                        <td style={{ padding: '8px' }}>{linha.nome_cliente_fornecedor || '-'}</td>
                        <td style={{ padding: '8px' }}>{linha.descricao || '-'}</td>
                        <td style={{ padding: '8px' }}>{linha.categoria_nome || '-'}</td>
                        <td style={{ padding: '8px', fontWeight: 'bold', color: linha.tipo === 'RECEITA' ? '#16a34a' : '#dc2626' }}>
                          {linha.tipo}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                          R$ {Number(linha.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}