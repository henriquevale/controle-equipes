import express from 'express';
import multer from 'multer';
import db from '../../db.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @route   GET /api/master/materiais/comparativo
 * @desc    Retorna a lista de materiais comparando Faturamento Direto x Estoque x Apontados
 */


export default router;