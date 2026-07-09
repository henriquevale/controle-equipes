import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs'; // Importante para ler o certificado SSL

dotenv.config();

// Define o caminho do certificado: se estiver no Render, usa a variável, se não, usa o caminho padrão
const sslCaPath = process.env.DB_SSL_CA || './ca.pem';

const db = mysql.createPool({
  host: process.env.DB_HOST || 'mysql-145fd207-controle-equipes-backend01-a849.c.aivencloud.com',
  user: process.env.DB_USER || 'avnadmin',
  // ATENÇÃO: No seu código estava process.env.DB_PASSWORD, mas no seu print do Render a chave está como DB_PASS. Ajustei para aceitar ambos abaixo:
  password: process.env.DB_PASS || process.env.DB_PASSWORD || 'AVNS_43U010-O_-8MYzRpope', 
  database: process.env.DB_NAME || 'defaultdb',
  // Adiciona a porta da Aiven (se não achar a variável, usa a 27362 como padrão)
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 27362, 
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Adiciona o SSL obrigatório da Aiven
  ssl: {
    ca: fs.readFileSync(sslCaPath)
  }
});

export default db;
// host: process.env.DB_HOST || 'localhost',
  //user: process.env.DB_USER || 'root',
 // password: process.env.DB_PASSWORD || '', 
//  database: process.env.DB_NAME || 'controle_equipes', 
  //waitForConnections: true,
  //connectionLimit: 10,
  //queueLimit: 0