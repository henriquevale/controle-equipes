import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const db = mysql.createPool({
  host: process.env.DB_HOST || 'mysql-145fd207-controle-equipes-backend01-a849.c.aivencloud.com',
  user: process.env.DB_USER || 'avnadmin',
  password: process.env.DB_PASSWORD || 'AVNS_43U010-O_-8MYzRpope', 
  database: process.env.DB_NAME || 'defaultdb', 
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
// host: process.env.DB_HOST || 'localhost',
  //user: process.env.DB_USER || 'root',
 // password: process.env.DB_PASSWORD || '', 
//  database: process.env.DB_NAME || 'controle_equipes', 
  //waitForConnections: true,
  //connectionLimit: 10,
  //queueLimit: 0
export default db;