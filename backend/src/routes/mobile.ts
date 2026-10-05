import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as survey from '../controllers/surveyController';
import * as submission from '../controllers/submissionController';
import { uploadMiddleware } from '../middleware/upload';

const router = Router();

// Mobile sync endpoint (the critical one for offline-first)
router.post('/sync', authenticate, submission.syncSubmission);

// Photo upload (with GPS metadata)
router.post('/photos', authenticate, uploadMiddleware.single('photo'), submission.uploadPhoto);

// My assignments
router.get('/my-assignments', authenticate, survey.listAssignments);

// Get a template by ID
router.get('/templates/:id', authenticate, survey.getTemplate);

// Submit / update a submission
router.patch('/submissions/:id', authenticate, submission.updateSubmission);

// Get submission detail
router.get('/submissions/:id', authenticate, submission.getSubmission);

export default router;
