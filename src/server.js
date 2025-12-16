require('dotenv').config();
const app = require('./app');
const { initializeDatabase } = require('./models/db');
require('./config/passport');

const PORT = process.env.PORT || 3000;

(async () => {
  const dbConnected = await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
})();

