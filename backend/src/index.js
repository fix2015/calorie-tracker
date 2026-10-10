require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const mealRoutes = require('./routes/meals');
const reportRoutes = require('./routes/reports');
const contentReportRoutes = require('./routes/contentReports');
const publicRoutes = require('./routes/public');
const notificationRoutes = require('./routes/notifications');
const messageRoutes = require('./routes/messages');
const adminRoutes = require('./routes/admin');
const storyRoutes = require('./routes/stories');
const productRoutes = require('./routes/products');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

// Web origin(s) from CORS_ORIGIN (comma-separated), plus the Capacitor web views of the iOS / Android apps
const NATIVE_APP_ORIGINS = ['capacitor://localhost', 'https://localhost'];
app.use(cors({
  origin: [...(process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((o) => o.trim()), ...NATIVE_APP_ORIGINS],
  credentials: true,
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads')));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/reports', contentReportRoutes); // POST / — content reports
app.use('/api/reports', reportRoutes);        // nutrition reports
app.use('/api/public', publicRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/products', productRoutes);

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
