import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { AppError, asyncHandler, unauthorized } from '../lib/errors';
import { loginSchema, registerSchema } from '../lib/validation';
import { clearAuthCookie, publicUser, requireAuth, setAuthCookie, signToken } from '../middleware/auth';

export const authRouter = Router();

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.', {
        email: 'An account with this email already exists.',
      });
    }
    const isVolunteer = data.role === 'VOLUNTEER';
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        passwordHash: await bcrypt.hash(data.password, 10),
        role: data.role,
        city: data.city,
        area: data.area,
        lat: data.lat,
        lng: data.lng,
        // Business rule: requesters need no verification, volunteers start PENDING.
        verificationStatus: isVolunteer ? 'PENDING' : 'NOT_REQUIRED',
        idProofText: isVolunteer ? data.idProofText : null,
        skills: isVolunteer ? data.skills : null,
        hasVehicle: isVolunteer ? !!data.hasVehicle : false,
      },
    });
    const token = signToken(user.id);
    setAuthCookie(res, token);
    res.status(201).json({ user: publicUser(user), token });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw unauthorized('Incorrect email or password.');
    }
    const token = signToken(user.id);
    setAuthCookie(res, token);
    res.json({ user: publicUser(user), token });
  }),
);

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user!) });
});
