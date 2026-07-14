import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Verifica se estamos rodando localmente ou no Render
const isLocal = process.env.NODE_ENV !== 'production';

const dbConfig = {
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

if (isLocal && !process.env.DB_HOST) {
  // CONFIGURAÇÃO LOCAL: Se você não tiver variáveis do Aiven no seu .env local
  dbConfig.host = 'localhost';
  dbConfig.user = 'root';
  dbConfig.password = ''; 
  dbConfig.database = 'controle_equipes';
} else {
  // CONFIGURAÇÃO ONLINE (AIVEN): Usada no Render ou se você colocar os dados do Aiven no .env local
  const sslCaPath = process.env.DB_SSL_CA || './ca.pem';
  
  dbConfig.host = process.env.DB_HOST || 'mysql-145fd207-controle-equipes-backend01-a849.c.aivencloud.com';
  dbConfig.user = process.env.DB_USER || 'avnadmin';
  dbConfig.password = process.env.DB_PASS || process.env.DB_PASSWORD || 'AVNS_43U010-O_-8MYzRpope';
  dbConfig.database = process.env.DB_NAME || 'defaultdb';
  dbConfig.port = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 27362;
  dbConfig.ssl = {
    ca: fs.readFileSync(sslCaPath)
  };
}

const db = mysql.createPool(dbConfig);

export default db;