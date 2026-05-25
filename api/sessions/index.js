import dbConnect from '../lib/db';
import Session from '../lib/models/Session';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'tempo-secret-key-123';

export default async function handler(req, res) {
  await dbConnect();

  const cookie = req.headers.cookie;
  const token = cookie?.split('; ').find(row => row.startsWith('tempo_token='))?.split('=')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const userId = 'badar'; // Since we only have one user

  if (req.method === 'GET') {
    try {
      const sessions = await Session.find({ userId }).sort({ start: -1 });
      return res.status(200).json(sessions);
    } catch (error) {
      return res.status(500).json({ message: 'Error fetching sessions' });
    }
  }

  if (req.method === 'POST') {
    try {
      const session = await Session.create({ ...req.body, userId });
      return res.status(201).json(session);
    } catch (error) {
      return res.status(500).json({ message: 'Error creating session' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      await Session.findByIdAndDelete(id);
      return res.status(200).json({ message: 'Session deleted' });
    } catch (error) {
      return res.status(500).json({ message: 'Error deleting session' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
