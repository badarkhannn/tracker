import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

const JWT_SECRET = process.env.JWT_SECRET || 'tempo-fallback-secret';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, password } = req.body;

  // Hardcoded user as requested
  if (username === 'badar' && password === 'pass1.0@') {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });

    const cookie = serialize('tempo_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 604800, // 7 days
      path: '/',
    });

    res.setHeader('Set-Cookie', cookie);
    return res.status(200).json({ message: 'Login successful', user: { username } });
  }

  return res.status(401).json({ message: 'Invalid credentials' });
}
