require('dotenv').config();
const { pool, initDb } = require('./database');
const bcrypt = require('bcrypt');

(async () => {
  try {
    await initDb();
    const adminHash = await bcrypt.hash('admin123', 10);
    const userHash = await bcrypt.hash('demo123', 10);

    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      ['VoltTrack Admin', 'admin@volttrack.com', adminHash, 'ADMIN']
    );

    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      ['Demo Operator', 'demo@volttrack.com', userHash, 'USER']
    );

    const adminRes = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@volttrack.com']);
    const adminId = adminRes.rows[0].id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (let i = 1; i <= 30; i++) {
        const type = i <= 20 ? 'Residential' : i <= 26 ? 'Commercial' : 'Industrial';
        const meterId = `VT-${String(i).padStart(4, '0')}`;
        const load = type === 'Residential' ? 5 : type === 'Commercial' ? 20 : 55;

        await client.query(
          `INSERT INTO meters (meter_id, consumer_name, address, connection_type, sanctioned_load_kw, status, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (meter_id) DO NOTHING`,
          [
            meterId,
            `Consumer ${String(i).padStart(2, '0')}`,
            `${10 + i} Maple Street, Ward ${(i % 6) + 1}`,
            type,
            load,
            'Active',
            adminId,
          ]
        );

        const meterRes = await client.query('SELECT id FROM meters WHERE meter_id = $1', [meterId]);
        const id = meterRes.rows[0].id;

        for (let j = 0; j < 12; j++) {
          const d = new Date(2025, j, 1);
          const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          let units =
            type === 'Residential'
              ? 220 + i * 8 + Math.sin(i + j) * 35
              : type === 'Commercial'
              ? 2100 + i * 80 + Math.sin(i + j) * 200
              : 6300 + i * 220 + Math.sin(i + j) * 400;

          if (i === 3 && j === 11) units *= 0.32;
          if (i === 7 && j >= 8 && j <= 11) units = Math.round((12 - j) * 135);
          if (i === 7 && j === 11) units = 0;
          if (i === 12 && j === 11) units *= 3.8;

          const remarks = i === 3 && j === 8 ? 'Demo sudden drop' : i === 7 && j === 10 ? 'Demo zero reading' : '';

          await client.query(
            `INSERT INTO readings (meter_id, month, units_consumed, reading_date, remarks)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (meter_id, month) DO NOTHING`,
            [id, month, Math.round(units), `${month}-28`, remarks]
          );
        }
      }

      await client.query('COMMIT');
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

    console.log('Seeded admin, demo user, 30 meters and 360 monthly readings into PostgreSQL.');
    await pool.end();
  } catch (e) {
    console.error('Seeding failed:', e);
    process.exit(1);
  }
})();
