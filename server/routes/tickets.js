const express = require('express');
const router = express.Router();
const TicketController = require('../controllers/ticketController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Static routes MUST come before /:id
router.get('/', TicketController.getTickets);
router.get('/check-existing', TicketController.checkExistingTickets);
router.get('/check-conflicts', TicketController.checkNvrCameraConflicts);
router.get('/location-cameras', TicketController.getLocationCameras);
router.get('/location-cameras/list', TicketController.getLocationCamerasList);
router.post('/location-cameras', TicketController.addLocationCameras);
router.delete('/location-cameras/:id', TicketController.deleteLocationCamera);
router.get('/raise/users', TicketController.getRaiseFormUsers);
router.get('/my-tickets', TicketController.getMyTickets);
router.get('/report', TicketController.getTicketsReport);
router.get('/completed', TicketController.getCompletedTickets);
router.post('/report/send-mail', TicketController.upload.array('attachments', 10), TicketController.sendTicketsReportMail);
router.post('/', TicketController.upload.array('attachments', 10), TicketController.createTicket);

// Dynamic routes
router.get('/:id', TicketController.getTicket);
router.put('/:id', TicketController.upload.array('attachments', 10), TicketController.updateTicket);
router.patch('/:id/status', TicketController.updateTicketStatus);
router.patch('/:id/vendor-engineer-status', TicketController.upload.array('attachments', 10), TicketController.updateVendorEngineerStatus);
router.patch('/:id/raise', TicketController.upload.array('raise_attachments', 10), TicketController.saveRaiseTicket);
router.delete('/:id', TicketController.deleteTicket);

module.exports = router;
