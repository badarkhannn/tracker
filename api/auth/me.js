import jwt from 'jsonwebtoken';
import { parse } from 'cookie';

const JWT_SECRET = 'tempo-secret-key-123';

export default async function handler(req, res) {
  const cookies = parse(req.headers.cookie || '');
  const token = cookies.tempo_token;
  
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.status(200).json({ user: { username: decoded.username } });
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}
