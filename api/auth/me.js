import jwt from 'jsonwebtoken';

const JWT_SECRET = 'tempo-secret-key-123';

export default async function handler(req, res) {
  const cookie = req.headers.cookie;
  if (!cookie) return res.status(401).json({ message: 'Unauthorized' });

  const token = cookie.split('; ').find(row => row.startsWith('tempo_token='))?.split('=')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.status(200).json({ user: { username: decoded.username } });
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}
