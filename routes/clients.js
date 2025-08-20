import express from 'express'
import { createClient, deactivateClient, getClient, getClientInvoices, getClients, reactivateClient, searchPotentialClients, updateClient } from '../controllers/ClientController.js';

const router = express.Router();

router.get('/', getClients)
router.get('/:clientId', getClient)
router.get('/:clientId/invoices', getClientInvoices)
router.post('/create', createClient)
router.put('/:clientId/update', updateClient)
router.get('/search/potential', searchPotentialClients)
router.patch('/:clientId/deactivate', deactivateClient)
router.patch('/:clientId/reactivate', reactivateClient)


export default router;