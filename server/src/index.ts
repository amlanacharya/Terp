import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'path';
import { testConnection } from './config/db';
import authRoutes from './routes/auth.routes';
import annexuresRoutes from './routes/annexures.routes';
import backupRoutes from './routes/backup.routes';
import collectionsRoutes from './routes/collections.routes';
import customersRoutes from './routes/customers.routes';
import dashboardRoutes from './routes/dashboard.routes';
import driversRoutes from './routes/drivers.routes';
import feedbackRoutes from './routes/feedback.routes';
import gstRoutes from './routes/gst.routes';
import importRoutes from './routes/import.routes';
import invoicesRoutes from './routes/invoices.routes';
import leadsRoutes from './routes/leads.routes';
import licenseRoutes from './routes/license.routes';
import networkRoutes from './routes/network.routes';
import ownersRoutes from './routes/owners.routes';
import rateChartsRoutes from './routes/rate-charts.routes';
import reportsRoutes from './routes/reports.routes';
import settingsRoutes from './routes/settings.routes';
import taxComponentsRoutes from './routes/tax-components.routes';
import settlementsRoutes from './routes/settlements.routes';
import tripsRoutes from './routes/trips.routes';
import vehicleCategoriesRoutes from './routes/vehicle-categories.routes';
import vehiclesRoutes from './routes/vehicles.routes';

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/import', importRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api', annexuresRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/gst', gstRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/vehicle-categories', vehicleCategoriesRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/owners', ownersRoutes);
app.use('/api', rateChartsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/collections', collectionsRoutes);
app.use('/api/settlements', settlementsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/tax-components', taxComponentsRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'API route not found.' });
});

// Serve React frontend in production
const staticPath = path.join(__dirname, '../../dist');
app.use(express.static(staticPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

void testConnection()
  .then(() => {
    app.listen(port, () => {
      console.log(`TravelERP backend listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Database connection failed:', error);
    process.exit(1);
  });




