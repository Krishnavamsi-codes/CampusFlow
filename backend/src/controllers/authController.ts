import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'iiits_live_rooms_secret_key_2026_super_secure_key';

export async function login(req: Request, res: Response) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await prisma.cRUser.findUnique({
      where: { username: username.toLowerCase().trim() }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT token containing identity, batch, and section
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        name: user.name,
        batch: user.batch,
        section: user.section
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        batch: user.batch,
        section: user.section
      }
    });
  } catch (error) {
    console.error('Error during CR login:', error);
    return res.status(500).json({ error: 'An error occurred during login' });
  }
}
