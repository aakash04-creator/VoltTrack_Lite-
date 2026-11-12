require('dotenv').config();

const app = require('./app');
const { sequelize } = require('./models');

const port = process.env.PORT || 3000;

async function startServer() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    app.listen(port, () => {
      console.log(`VoltTrack Lite API listening on port ${port}`);
    });
  } catch (error) {
    console.error('Unable to start the server:', error.message);
    process.exit(1);
  }
}

startServer();
