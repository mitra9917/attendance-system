import './loadEnv.js';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import studentRoutes from './routes/students.js';
import courseRoutes from './routes/courses.js';

import enrollmentRoutes from './routes/enrollments.js';
import sessionRoutes from './routes/sessions.js';
import statsRoutes from './routes/stats.js';
import gmailRoutes from './routes/gmail.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
// 5 MB limit — needed to accept base64 photo data URLs in student registration
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Routes
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/courses', courseRoutes);

app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/gmail', gmailRoutes);

app.listen(port, () => {
  const gmailReady = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
  console.log(`Attendance API running at http://localhost:${port}`);
  console.log(`Gmail OAuth: ${gmailReady ? 'configured' : 'missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET'}`);
});
