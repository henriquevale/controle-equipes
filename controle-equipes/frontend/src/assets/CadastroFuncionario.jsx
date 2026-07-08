import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Save, AlertCircle, RefreshCw, Users, CalendarDays } from 'lucide-react';

// Em vez de: const API_URL = 'http://localhost:3001/api';
const API_URL = 'https://meu-projeto-api.onrender.com/api'; i

export default function CadastroFuncionario({ usuarioLogado }) {
  const [formData, setFormData] = useState({
    nome: '',
    matricula: '',
    cargo: '',
    cpf: '',
    telefone: '',
    tam_calca: '',
    tam_camisa: '',
    tam_calcado: '',
    id_usuario_gestor: '', // Controla apenas o ID do gestor selecionado
    data_admissao: '',
    data_postagem_aso_pasta: '',
    data_documentos_rh_completos: ''
  });

  const [gestores, setGestores] = useState([]); 
  const [carregando, setCarregando] = useState(false);
  const [erroPainel, setErroPainel] = useState('');
  const [statusEnvio, setStatusEnvio] = useState({ texto: '', tipo: '' });

  // Busca a lista de gestores ao carregar o componente
  useEffect(() => {
    const buscarGestores = async () => {
      try {
        const response = await axios.get(`${API_URL}/rh/gestores-disponiveis`);
        setGestores(response.data);
      } catch (err) {
        console.error("Erro ao carregar lista de gestores:", err);
      }
    };
    buscarGestores();
  }, []);

  const aplicarMascaraCPF = (valor) => {
    return valor
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .substring(0, 14);
  };

  const aplicarMascaraTelefone = (valor) => {
    return valor
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/g, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .substring(0, 15);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let valorFinal = type === 'checkbox' ? checked : value;

    if (name === 'cpf') valorFinal = aplicarMascaraCPF(value);
    if (name === 'telefone') valorFinal = aplicarMascaraTelefone(value);

    setFormData({
      ...formData,
      [name]: valorFinal
    });
    setErroPainel('');
  };

  const salvarFuncionario = async (e) => {
    e.preventDefault();
    
    if (!formData.nome.trim() || !formData.matricula.trim() || !formData.cargo.trim()) {
      setErroPainel('Por favor, preencha os campos obrigatórios: Nome, Matrícula e Cargo.');
      return;
    }

    if (formData.cpf && formData.cpf.length < 14) {
      setErroPainel('Por favor, insira um CPF válido.');
      return;
    }

    try {
      const idUsuarioCadastro = usuarioLogado?.id || (usuarioLogado?.id_usuario ? usuarioLogado.id_usuario : null);

      setCarregando(true);
      setErroPainel('');
      setStatusEnvio({ texto: 'Cadastrando funcionário no sistema...', tipo: 'processando' });

      const payload = {
        nome: formData.nome,
        matricula: formData.matricula,
        cargo: formData.cargo,
        cpf: formData.cpf.replace(/\D/g, ''),
        telefone: formData.telefone.replace(/\D/g, ''),
        tam_calca: formData.tam_calca,
        tam_camisa: formData.tam_camisa,
        tam_calcado: formData.tam_calcado,
        id_usuario_cadastro: idUsuarioCadastro, 
        id_usuario_gestor: formData.id_usuario_gestor || null,
        data_admissao: formData.data_admissao || null,
        data_postagem_aso_pasta: formData.data_postagem_aso_pasta || null,
        data_documentos_rh_completos: formData.data_documentos_rh_completos || null
      };

      await axios.post(`${API_URL}/rh/funcionarios`, payload);

      setStatusEnvio({ texto: '✓ Funcionário enviado para a esteira de integração com sucesso!', tipo: 'sucesso' });
      
      setFormData({
        nome: '',
        matricula: '',
        cargo: '',
        cpf: '',
        telefone: '',
        tam_calca: '',
        tam_camisa: '',
        tam_calcado: '',
        id_usuario_gestor: '',
        data_admissao: '',
        data_postagem_aso_pasta: '',
        data_documentos_rh_completos: ''
      });

      setTimeout(() => setStatusEnvio({ texto: '', tipo: '' }), 4000);
    } catch (err) {
      console.error('Erro ao cadastrar funcionário:', err);
      const msg = err.response?.data?.error || err.message || 'Erro interno no servidor.';
      setErroPainel(`Falha no cadastro: ${msg}`);
      setStatusEnvio({ texto: 'Erro ao processar cadastro.', tipo: 'erro' });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', fontFamily: 'sans-serif', fontSize: '12px' }}>
      
      {erroPainel && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', color: '#991b1b', fontWeight: 'bold' }}>
          <AlertCircle style={{ width: '16px', height: '16px', marginRight: '8px' }} />
          <span>{erroPainel}</span>
        </div>
      )}

      {statusEnvio.texto && (
        <div style={{ 
          padding: '10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', 
          backgroundColor: statusEnvio.tipo === 'sucesso' ? '#bbf7d0' : statusEnvio.tipo === 'erro' ? '#fecaca' : '#eff6ff', 
          color: statusEnvio.tipo === 'sucesso' ? '#166534' : statusEnvio.tipo === 'erro' ? '#991b1b' : '#1e40af' 
        }}>
          {statusEnvio.texto}
        </div>
      )}

      <form onSubmit={salvarFuncionario} style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
        <div style={{ padding: '8px 12px', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '11px', borderBottom: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <UserPlus style={{ width: '14px', height: '14px' }} />
          <span>CADASTRO DE NOVO COLABORADOR / FUNCIONÁRIO</span>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Linha 1: Dados Principais */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: '2', minWidth: '250px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', marginBottom: '4px' }}>NOME COMPLETO *</label>
              <input type="text" name="nome" value={formData.nome} onChange={handleChange} placeholder="Digite o nome completo" style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} required />
            </div>

            <div style={{ flex: '1', minWidth: '120px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', marginBottom: '4px' }}>MATRÍCULA *</label>
              <input type="text" name="matricula" value={formData.matricula} onChange={handleChange} placeholder="Ex: M1234" style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} required />
            </div>

            <div style={{ flex: '1.5', minWidth: '180px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', marginBottom: '4px' }}>CARGO / FUNÇÃO *</label>
              <input type="text" name="cargo" value={formData.cargo} onChange={handleChange} placeholder="Ex: Apontador, Motorista..." style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} required />
            </div>
          </div>

          {/* Linha 2: Documentos e Contato */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', marginBottom: '4px' }}>CPF</label>
              <input type="text" name="cpf" value={formData.cpf} onChange={handleChange} placeholder="000.000.000-00" style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>

            <div style={{ flex: '1', minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', marginBottom: '4px' }}>TELEFONE</label>
              <input type="text" name="telefone" value={formData.telefone} onChange={handleChange} placeholder="(00) 00000-0000" style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* BOX: Datas de Controle de Admissão e Documentações (Novas Colunas) */}
          <div style={{ backgroundColor: '#fff8e1', padding: '12px', border: '1px solid #ffe082', borderRadius: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', color: '#b78103', marginBottom: '10px' }}>
              <CalendarDays style={{ width: '14px', height: '14px' }} />
              CONTROLE DE DATAS INTERNAS DO RH (OPCIONAL)
            </label>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1', minWidth: '160px' }}>
                <label style={{ display: 'block', fontSize: '10px', marginBottom: '4px', color: '#744210', fontWeight: '600' }}>DATA ADMISSÃO</label>
                <input type="date" name="data_admissao" value={formData.data_admissao} onChange={handleChange} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box', backgroundColor: '#fff' }} />
              </div>
              <div style={{ flex: '1', minWidth: '160px' }}>
                <label style={{ display: 'block', fontSize: '10px', marginBottom: '4px', color: '#744210', fontWeight: '600' }}>POSTAGEM DO ASO NA PASTA</label>
                <input type="date" name="data_postagem_aso_pasta" value={formData.data_postagem_aso_pasta} onChange={handleChange} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box', backgroundColor: '#fff' }} />
              </div>
              <div style={{ flex: '1', minWidth: '160px' }}>
                <label style={{ display: 'block', fontSize: '10px', marginBottom: '4px', color: '#744210', fontWeight: '600' }}>DOCUMENTOS RH COMPLETOS</label>
                <input type="date" name="data_documentos_rh_completos" value={formData.data_documentos_rh_completos} onChange={handleChange} style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box', backgroundColor: '#fff' }} />
              </div>
            </div>
          </div>

          {/* BOX: Seleção apenas do Gestor */}
          <div style={{ backgroundColor: '#f0fdf4', padding: '12px', border: '1px solid #bbf7d0', borderRadius: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', color: '#166534', marginBottom: '6px' }}>
              <Users style={{ width: '14px', height: '14px' }} />
              VINCULAR DIRETAMENTE A UM GESTOR (OPCIONAL)
            </label>
            <select
              name="id_usuario_gestor"
              value={formData.id_usuario_gestor}
              onChange={handleChange}
              style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#fff', boxSizing: 'border-box', color: '#334155' }}
            >
              <option value="">-- Deixar Sem Gestor por enquanto --</option>
              {gestores.map((g) => (
                <option key={g.id_usuario} value={g.id_usuario}>
                  {g.nome_gestor}
                </option>
              ))}
            </select>
          </div>

          {/* Linha 3: Controle de Tamanhos de EPI */}
          <div style={{ backgroundColor: '#f8fafc', padding: '12px', border: '1px dashed #cbd5e1', borderRadius: '4px' }}>
            <span style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', color: '#475569', marginBottom: '10px' }}>
              GRADE DE TAMANHOS (UNIFORMES / EPI)
            </span>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1', minWidth: '100px' }}>
                <label style={{ display: 'block', fontSize: '10px', marginBottom: '4px', color: '#64748b' }}>TAM. CALÇA</label>
                <input type="text" name="tam_calca" value={formData.tam_calca} onChange={handleChange} placeholder="Ex: 42, G" style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: '1', minWidth: '100px' }}>
                <label style={{ display: 'block', fontSize: '10px', marginBottom: '4px', color: '#64748b' }}>TAM. CAMISA</label>
                <input type="text" name="tam_camisa" value={formData.tam_camisa} onChange={handleChange} placeholder="Ex: M, GG" style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: '1', minWidth: '100px' }}>
                <label style={{ display: 'block', fontSize: '10px', marginBottom: '4px', color: '#64748b' }}>TAM. CALÇADO</label>
                <input type="number" name="tam_calcado" value={formData.tam_calcado} onChange={handleChange} placeholder="Ex: 40" min="30" max="50" style={{ width: '100%', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
              </div>
            </div>
          </div>

        </div>

        <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', borderTop: '1px solid #cbd5e1', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            disabled={carregando}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 20px', 
              backgroundColor: carregando ? '#94a3b8' : '#16a34a', color: '#fff', 
              border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: carregando ? 'not-allowed' : 'pointer' 
            }}
          >
            {carregando ? (
              <RefreshCw style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
            ) : (
              <Save style={{ width: '16px', height: '16px' }} />
            )}
            {carregando ? 'Salvando...' : 'Salvar Cadastro'}
          </button>
        </div>
      </form>
    </div>
  );
}