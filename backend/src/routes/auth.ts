import { Router } from 'express';
import * as auth from '../controllers/authController';

const router = Router();

router.post('/login', auth.login);
router.post('/register', auth.register);
router.get('/profile', auth.getProfile);

export default router;
