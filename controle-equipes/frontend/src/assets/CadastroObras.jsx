import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { HardHat, Plus, Edit2, X, Check, ToggleLeft, ToggleRight } from 'lucide-react';

// Em vez de: const API_URL = 'http://localhost:3001/api';
const API_URL = 'https://meu-projeto-api.onrender.com/api'; i

export default function CadastroObras({ listaObrasGlobal, recarregarObrasGlobal }) {
  // Ajustado o estado inicial para incluir tipo_obra com valor padrão 'PRODUTIVA'
  const [novaObra, setNovaObra] = useState({ nome_obra: '', codigo_obra: '', status: 'ATIVA', tipo_obra: 'PRODUTIVA' });
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });
  
  // ESTADOS PARA EDIÇÃO DE OBRA
  const [obraEmEdicao, setObraEmEdicao] = useState(null);
  const [dadosEdicao, setDadosEdicao] = useState({ nome_obra: '', codigo_obra: '', status: 'ATIVA', tipo_obra: 'PRODUTIVA' });

  const mostrarMensagem = (texto, tipo) => {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem({ texto: '', tipo: '' }), 4000);
  };

  // 1. CADASTRAR NOVA OBRA
  const criarObra = async (e) => {
    e.preventDefault();
    if (!novaObra.nome_obra || !novaObra.codigo_obra || !novaObra.tipo_obra) {
      return mostrarMensagem('Preencha todos os campos da nova obra!', 'erro');
    }
    try {
      await axios.post(`${API_URL}/master/obras`, novaObra);
      mostrarMensagem('Obra cadastrada e vinculada com sucesso!', 'sucesso');
      setNovaObra({ nome_obra: '', codigo_obra: '', status: 'ATIVA', tipo_obra: 'PRODUTIVA' });
      if (recarregarObrasGlobal) recarregarObrasGlobal();
    } catch (err) {
      console.error("Erro ao criar obra:", err);
      mostrarMensagem('Erro ao criar nova obra no servidor.', 'erro');
    }
  };

  // 2. INICIAR MODO EDIÇÃO
  const iniciarEdicao = (obra) => {
    setObraEmEdicao(obra.id);
    setDadosEdicao({
      nome_obra: obra.nome_obra,
      codigo_obra: obra.codigo_obra,
      status: obra.status || 'ATIVA',
      tipo_obra: obra.tipo_obra || 'PRODUTIVA' // Fallback caso venha nulo do banco
    });
  };

  // 3. SALVAR ATUALIZAÇÃO DA OBRA
  const salvarEdicao = async (id) => {
    if (!dadosEdicao.nome_obra || !dadosEdicao.codigo_obra || !dadosEdicao.tipo_obra) {
      return mostrarMensagem('Os campos não podem ficar vazios na edição!', 'erro');
    }
    try {
      await axios.put(`${API_URL}/master/obras/${id}`, dadosEdicao);
      mostrarMensagem('Dados da obra atualizados com sucesso!', 'sucesso');
      setObraEmEdicao(null);
      if (recarregarObrasGlobal) recarregarObrasGlobal();
    } catch (err) {
      console.error("Erro ao atualizar obra:", err);
      mostrarMensagem('Erro ao atualizar dados da obra.', 'erro');
    }
  };

  // 4. ALTERAR STATUS (ATIVA/INATIVA) RAPIDAMENTE
  const alternarStatusObra = async (obra) => {
    const novoStatus = obra.status === 'ATIVA' ? 'INATIVA' : 'ATIVA';
    try {
      await axios.put(`${API_URL}/master/obras/${obra.id}`, {
        nome_obra: obra.nome_obra,
        codigo_obra: obra.codigo_obra,
        status: novoStatus,
        tipo_obra: obra.tipo_obra || 'PRODUTIVA'
      });
      if (recarregarObrasGlobal) recarregarObrasGlobal();
    } catch (err) {
      console.error("Erro ao alterar status da obra:", err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {mensagem.texto && (
        <div style={{ padding: '12px', borderRadius: '4px', border: '1px solid', fontSize: '11px', backgroundColor: mensagem.tipo === 'sucesso' ? '#f0fdf4' : '#fef2f2', color: mensagem.tipo === 'sucesso' ? '#166534' : '#991b1b' }}>
          {mensagem.texto}
        </div>
      )}

      {/* PAINEL SUPERIOR: LISTA DE OBRAS CADASTRADAS */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px' }}>
        <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <HardHat style={{ width: '16px', height: '16px' }} /> <span>Obras no Sistema</span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '380px', overflowY: 'auto' }}>
          {listaObrasGlobal && listaObrasGlobal.map(obra => (
            <div key={obra.id} style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '8px 10px', backgroundColor: obra.status === 'INATIVA' ? '#f1f5f9' : '#fafafa' }}>
              
              {obraEmEdicao === obra.id ? (
                /* MODO DE EDIÇÃO DA OBRA */
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="text" style={{ height: '26px', padding: '0 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', flex: 2 }} value={dadosEdicao.nome_obra} onChange={e => setDadosEdicao({...dadosEdicao, nome_obra: e.target.value})} placeholder="Nome da Obra" />
                  <input type="text" style={{ height: '26px', padding: '0 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', flex: 1 }} value={dadosEdicao.codigo_obra} onChange={e => setDadosEdicao({...dadosEdicao, codigo_obra: e.target.value})} placeholder="Código" />
                  
                  {/* Select do tipo na Edição */}
                  <select style={{ height: '26px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', fontSize: '12px', padding: '0 2px' }} value={dadosEdicao.tipo_obra} onChange={e => setDadosEdicao({...dadosEdicao, tipo_obra: e.target.value})}>
                    <option value="PRODUTIVA">PRODUTIVA</option>
                    <option value="ADMINISTRATIVA">ADMINISTRATIVA</option>
                    <option value="MISTA">ADMINISTRATIVA/PRODUTIVA</option>
                  </select>

                  <select style={{ height: '26px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', fontSize: '12px', padding: '0 2px' }} value={dadosEdicao.status} onChange={e => setDadosEdicao({...dadosEdicao, status: e.target.value})}>
                    <option value="ATIVA">ATIVA</option>
                    <option value="INATIVA">INATIVA</option>
                  </select>
                  
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => salvarEdicao(obra.id)} style={{ height: '26px', width: '70px', backgroundColor: '#166534', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', fontSize: '10px', fontWeight: 'bold' }}><Check size={12}/> SALVAR</button>
                    <button onClick={() => setObraEmEdicao(null)} style={{ height: '26px', width: '30px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12}/></button>
                  </div>
                </div>
              ) : (
                /* MODO DE VISUALIZAÇÃO DA OBRA */
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', color: obra.status === 'INATIVA' ? '#94a3b8' : '#1e293b' }}>
                      {obra.nome_obra} {obra.status === 'INATIVA' && '(INATIVA)'}
                      {/* Tag visual contendo a classificação atual da obra */}
                      <span style={{ 
                        marginLeft: '8px', 
                        fontSize: '10px', 
                        padding: '2px 6px', 
                        borderRadius: '3px', 
                        backgroundColor: obra.tipo_obra === 'ADMINISTRATIVA' ? '#e0f2fe' : obra.tipo_obra === 'MISTA' ? '#fef3c7' : '#dcfce7',
                        color: obra.tipo_obra === 'ADMINISTRATIVA' ? '#0369a1' : obra.tipo_obra === 'MISTA' ? '#b45309' : '#15803d',
                        fontWeight: 'bold'
                      }}>
                        {obra.tipo_obra === 'MISTA' ? 'ADMINISTRATIVA/PRODUTIVA' : obra.tipo_obra || 'PRODUTIVA'}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      CÓDIGO IDENTIFICADOR: <span style={{ fontWeight: 'bold', color: '#334155' }}>{obra.codigo_obra}</span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Botão de Alterar Status Rápido */}
                    <button onClick={() => alternarStatusObra(obra)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: obra.status === 'ATIVA' ? '#166534' : '#64748b' }} title="Clique para alternar o status">
                      {obra.status === 'ATIVA' ? <ToggleRight size={20} color="#22c55e" /> : <ToggleLeft size={20} color="#94a3b8" />}
                      <span>{obra.status || 'ATIVA'}</span>
                    </button>

                    {/* Ação de Editar dados textuais */}
                    <button onClick={() => iniciarEdicao(obra)} style={{ backgroundColor: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <Edit2 size={11}/>EDITAR
                    </button>
                  </div>
                </div>
              )}

            </div>
          ))}
        </div>
      </div>

      {/* PAINEL INFERIOR: FORMULÁRIO DE CADASTRO */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '12px' }}>
        <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> <span>Cadastrar Nova Obra</span>
        </div>
        <form onSubmit={criarObra} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input type="text" placeholder="Nome Descritivo da Obra" style={{ flex: 2, height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }} value={novaObra.nome_obra} onChange={e => setNovaObra({...novaObra, nome_obra: e.target.value})} />
          <input type="text" placeholder="Código (Ex: CT 5450)" style={{ flex: 1, height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }} value={novaObra.codigo_obra} onChange={e => setNovaObra({...novaObra, codigo_obra: e.target.value})} />
          
          {/* Select do Tipo no formulário de inclusão */}
          <select style={{ height: '30px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', fontSize: '12px', padding: '0 8px', color: '#334155', fontWeight: '500' }} value={novaObra.tipo_obra} onChange={e => setNovaObra({...novaObra, tipo_obra: e.target.value})}>
            <option value="PRODUTIVA">PRODUTIVA</option>
            <option value="ADMINISTRATIVA">ADMINISTRATIVA</option>
            <option value="MISTA">ADMINISTRATIVA/PRODUTIVA</option>
          </select>

          <button type="submit" style={{ height: '30px', padding: '0 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>
            Adicionar Obra
          </button>
        </form>
      </div>
    </div>
  );
}