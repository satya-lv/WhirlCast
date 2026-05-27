require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/forecast', require('./routes/forecast'));
app.use('/api/scenarios', require('./routes/scenarios'));
app.use('/api/collaboration', require('./routes/collaboration'));
app.use('/api/conflicts', require('./routes/conflicts'));
app.use('/api/demand-sensing', require('./routes/demandSensing'));
app.use('/api/npi', require('./routes/npi'));
app.use('/api/report', require('./routes/report'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/demo',  require('./routes/demo'));
app.use('/api/cycles', require('./routes/cycles'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'WhirlCast', version: '1.0.0' }));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/build/index.html')));
}

app.listen(PORT, () => {
  console.log(`WhirlCast API running on http://localhost:${PORT}`);
});
