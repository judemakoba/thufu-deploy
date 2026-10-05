import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as auth from '../controllers/authController';
import * as survey from '../controllers/surveyController';
import * as submission from '../controllers/submissionController';

const router = Router();

// Auth routes (all users)
router.post('/auth/login', auth.login);
router.post('/auth/register', auth.register);
router.get('/auth/profile', authenticate, auth.getProfile);

// Users (admin only)
router.get('/users', authenticate, authorize('admin'), auth.listUsers);

// Sites
router.get('/sites', authenticate, survey.listSites);
router.post('/sites', authenticate, authorize('admin', 'reviewer'), survey.createSite);
router.patch('/sites/:id', authenticate, authorize('admin', 'reviewer'), survey.updateSite);
router.delete('/sites/:id', authenticate, authorize('admin'), survey.deleteSite);

// Survey Templates
router.get('/templates', authenticate, survey.listTemplates);
router.get('/templates/:id', authenticate, survey.getTemplate);
router.post('/templates', authenticate, authorize('admin', 'reviewer'), survey.createTemplate);

// Assignments
router.get('/assignments', authenticate, survey.listAssignments);
router.post('/assignments', authenticate, authorize('admin', 'reviewer'), survey.createAssignment);

// Submissions
router.get('/submissions', authenticate, submission.listSubmissions);
router.get('/submissions/:id', authenticate, submission.getSubmission);
router.patch('/submissions/:id', authenticate, authorize('admin', 'reviewer'), submission.updateSubmission);

// Photo upload
router.post('/photos', authenticate, submission.uploadPhoto);

// Analytics
router.get('/analytics', authenticate, submission.getAnalytics);

export default router;
