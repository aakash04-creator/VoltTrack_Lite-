const path = require('path');
const db = require('./database');

const databasePath = process.env.DB_PATH || path.join(__dirname, 'volttrack.sqlite');
console.log(`Database ready at ${path.resolve(databasePath)}`);
db.close();
