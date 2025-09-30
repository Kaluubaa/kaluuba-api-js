import express from 'express'
import { createInvoice, getInvoice, getInvoices, getInvoiceStats, getPublicInvoice, updateInvoice, updateInvoiceStatus } from '../controllers/InvoiceController.js';

const router = express.Router();

router.get('/', getInvoices)
router.post('/create', createInvoice)
router.get('/:invoiceId', getInvoice)
router.patch('/:invoiceId', updateInvoice)
router.patch('/:invoiceId/status', updateInvoiceStatus)
router.get('/stats/all', getInvoiceStats)
router.get('/get/:invoiceNumber', getPublicInvoice)

export default router;