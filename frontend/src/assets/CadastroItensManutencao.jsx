import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';
//const API_URL = 'https://controle-equipes.onrender.com/api'; 

export default function CadastroItensManutencao() {
  const [itens, setItens] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Estados do Formulário
  const [idEdicao, setIdEdicao] = useState(null);
  const [cod, setCod] = useState('');
  const [nome, setNome] = useState('');

  // Carregar lista de itens
  const carregarItens = async () => {
    setLoading(true);
    setErro('');
    try {
      const response = await axios.get(`${API_URL}/veiculos/itens-manutencao`);
      setItens(response.data);
    } catch (err) {
      setErro('Erro ao carregar a lista de itens de manutenção.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarItens();
  }, []);

  // Limpar formulário
  const limparFormulario = () => {
    setIdEdicao(null);
    setCod('');
    setNome('');
  };

  // Salvar (POST ou PUT)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setSucesso('');

    if (!cod.trim() || !nome.trim()) {
      setErro('Preencha o código e o nome do item.');
      return;
    }

    try {
      if (idEdicao) {
        // Atualizar
        await axios.put(`${API_URL}/veiculos/itens-manutencao/${idEdicao}`, {
          cod: cod.trim(),
          nome: nome.trim(),
        });
        setSucesso('Item atualizado com sucesso!');
      } else {
        // Criar Novo
        await axios.post(`${API_URL}/veiculos/itens-manutencao`, {
          cod: cod.trim(),
          nome: nome.trim(),
        });
        setSucesso('Item cadastrado com sucesso!');
      }

      limparFormulario();
      carregarItens();
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao salvar o item.';
      setErro(msg);
      console.error(err);
    }
  };

  // Preparar para Editar
  const handleEditar = (item) => {
    setIdEdicao(item.id);
    setCod(item.cod);
    setNome(item.nome);
    setErro('');
    setSucesso('');
  };

  // Excluir
  const handleExcluir = async (id, nomeItem) => {
    if (!window.confirm(`Tem certeza que deseja remover o item "${nomeItem}"?`)) return;

    setErro('');
    setSucesso('');
    try {
      const response = await axios.delete(`${API_URL}/veiculos/itens-manutencao/${id}`);
      setSucesso(response.data.message || 'Item removido com sucesso!');
      carregarItens();
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao excluir o item.';
      setErro(msg);
      console.error(err);
    }
  };

  // Filtrar itens na busca
  const itensFiltrados = itens.filter(
    (item) =>
      item.cod?.toLowerCase().includes(busca.toLowerCase()) ||
      item.nome?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ color: '#1e293b', marginBottom: '20px' }}>
        Cadastrar Itens de Manutenção
      </h2>

      {/* Alertas de Retorno */}
      {erro && (
        <div style={{ padding: '10px 15px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '15px' }}>
          {erro}
        </div>
      )}
      {sucesso && (
        <div style={{ padding: '10px 15px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '6px', marginBottom: '15px' }}>
          {sucesso}
        </div>
      )}

      {/* Formulário de Cadastro/Edição */}
      <form onSubmit={handleSubmit} style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '30px' }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#334155' }}>
          {idEdicao ? 'Editar Item de Manutenção' : 'Novo Item de Manutenção'}
        </h4>
        
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '15px' }}>
          <div style={{ flex: '1', minWidth: '150px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>
              CÓDIGO (COD) *
            </label>
            <input
              type="text"
              placeholder="Ex: ITEM-001"
              value={cod}
              onChange={(e) => setCod(e.target.value.toUpperCase())}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              required
            />
          </div>

          <div style={{ flex: '3', minWidth: '250px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>
              NOME DO SERVIÇO / ITEM *
            </label>
            <input
              type="text"
              placeholder="Ex: TROCA DE ÓLEO DO MOTOR"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              required
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          {idEdicao && (
            <button
              type="button"
              onClick={limparFormulario}
              style={{ padding: '8px 16px', backgroundColor: '#94a3b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            style={{ padding: '8px 20px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {idEdicao ? 'Atualizar Item' : 'Salvar Item'}
          </button>
        </div>
      </form>

      {/* Busca e Tabela */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0, color: '#334155' }}>Itens Cadastrados ({itensFiltrados.length})</h3>
        <input
          type="text"
          placeholder="Buscar por código ou nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '250px' }}
        />
      </div>

      {loading ? (
        <p>Carregando itens...</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#1e293b', color: '#fff' }}>
                <th style={{ padding: '10px 12px', width: '120px' }}>Código</th>
                <th style={{ padding: '10px 12px' }}>Nome do Item</th>
                <th style={{ padding: '10px 12px', width: '140px', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {itensFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="3" style={{ padding: '15px', textAlign: 'center', color: '#64748b' }}>
                    Nenhum item encontrado.
                  </td>
                </tr>
              ) : (
                itensFiltrados.map((item) => (
                  <tr key={`item-${item.id}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#0f172a' }}>
                      {item.cod}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#334155' }}>
                      {item.nome}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleEditar(item)}
                        style={{ padding: '4px 8px', backgroundColor: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '5px', fontSize: '12px' }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleExcluir(item.id, item.nome)}
                        style={{ padding: '4px 8px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}