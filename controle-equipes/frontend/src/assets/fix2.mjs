import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, 'DiarioEfetivo.jsx');

let content = fs.readFileSync(filePath, 'utf-8');

const old = `          id: usuarioSalvo?.id,
          data_diario: dataSelecionada`;

const neu = `          id: usuarioSalvo?.id,
          cargo: usuarioSalvo?.cargo,
          data_diario: dataSelecionada`;

if (content.includes(old)) {
  content = content.replace(old, neu);
  fs.writeFileSync(filePath, content);
  console.log('✅ Sucesso! Cargo adicionado aos parâmetros.');
} else {
  console.log('❌ Pattern não encontrado. Verificando...');
  if (content.includes('usuarioSalvo?.id')) {
    console.log('✓ Encontrado usuarioSalvo?.id');
  }
  if (content.includes('data_diario: dataSelecionada')) {
    console.log('✓ Encontrado data_diario: dataSelecionada');
  }
}
