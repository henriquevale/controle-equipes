import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, 'DiarioEfetivo.jsx');

let content = fs.readFileSync(filePath, 'utf-8');

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
  console.log('✅ Arquivo atualizado com sucesso! Cargo adicionado.');
} else {
  console.log('❌ Pattern não encontrado');
}
