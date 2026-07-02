const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'DiarioEfetivo.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Padrão exato - com quebra de linha
const old = `        params: { 
          id: usuarioSalvo?.id,
          data_diario: dataSelecionada`;

const neu = `        params: { 
          id: usuarioSalvo?.id,
          cargo: usuarioSalvo?.cargo,
          data_diario: dataSelecionada`;

if (content.includes(old)) {
  content = content.replace(old, neu);
  fs.writeFileSync(filePath, content);
  console.log('✅ Arquivo atualizado com sucesso!');
} else {
  console.log('❌ Pattern não encontrado');
  // Verificar o que tem
  const idx = content.indexOf('usuarioSalvo?.id');
  if (idx !== -1) {
    console.log('Encontrado em:', content.substring(idx - 50, idx + 100));
  }
}
