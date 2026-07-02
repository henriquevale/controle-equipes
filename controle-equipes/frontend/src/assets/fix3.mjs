import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, 'DiarioEfetivo.jsx');

let content = fs.readFileSync(filePath, 'utf-8');

// Usando regex para capturar qualquer espaçamento
const regex = /id:\s+usuarioSalvo\?\.id,\s+data_diario:\s+dataSelecionada/g;

if (regex.test(content)) {
  content = content.replace(
    /id:\s+usuarioSalvo\?\.id,\s+data_diario:\s+dataSelecionada/g,
    `id: usuarioSalvo?.id,\n          cargo: usuarioSalvo?.cargo,\n          data_diario: dataSelecionada`
  );
  fs.writeFileSync(filePath, content);
  console.log('✅ Sucesso! Cargo adicionado aos parâmetros.');
} else {
  console.log('❌ Regex não casou. Tentando abordagem alternativa...');
}
