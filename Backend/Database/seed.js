require('dotenv').config();
const { pool, initDb } = require('./database');
const bcrypt = require('bcrypt');

(async () => {
  try {
    console.log('Connecting to database and creating tables...');
    await initDb();
    console.log('Tables ready. Inserting users and records...');

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

      const meterValues = [];
      const meterParams = [];
      let mIdx = 1;

      for (let i = 1; i <= 30; i++) {
        const type = i <= 20 ? 'Residential' : i <= 26 ? 'Commercial' : 'Industrial';
        const meterId = `VT-${String(i).padStart(4, '0')}`;
        const load = type === 'Residential' ? 5 : type === 'Commercial' ? 20 : 55;

        meterValues.push(`($${mIdx++}, $${mIdx++}, $${mIdx++}, $${mIdx++}, $${mIdx++}, $${mIdx++}, $${mIdx++})`);
        meterParams.push(
          meterId,
          `Consumer ${String(i).padStart(2, '0')}`,
          `${10 + i} Maple Street, Ward ${(i % 6) + 1}`,
          type,
          load,
          'Active',
          adminId
        );
      }

      await client.query(
        `INSERT INTO meters (meter_id, consumer_name, address, connection_type, sanctioned_load_kw, status, created_by)
         VALUES ${meterValues.join(', ')}
         ON CONFLICT (meter_id) DO NOTHING`,
        meterParams
      );

      const allMeters = (await client.query('SELECT id, meter_id FROM meters ORDER BY meter_id')).rows;
      const meterMap = Object.fromEntries(allMeters.map((m) => [m.meter_id, m.id]));

      const readingValues = [];
      const readingParams = [];
      let rIdx = 1;

      for (let i = 1; i <= 30; i++) {
        const type = i <= 20 ? 'Residential' : i <= 26 ? 'Commercial' : 'Industrial';
        const meterCode = `VT-${String(i).padStart(4, '0')}`;
        const dbId = meterMap[meterCode];

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

          readingValues.push(`($${rIdx++}, $${rIdx++}, $${rIdx++}, $${rIdx++}, $${rIdx++})`);
          readingParams.push(dbId, month, Math.round(units), `${month}-28`, remarks);
        }
      }

      await client.query(
        `INSERT INTO readings (meter_id, month, units_consumed, reading_date, remarks)
         VALUES ${readingValues.join(', ')}
         ON CONFLICT (meter_id, month) DO NOTHING`,
        readingParams
      );

      await client.query('COMMIT');
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

    console.log('Seeded admin, demo user, 30 meters and 360 monthly readings into PostgreSQL successfully!');
    await pool.end();
  } catch (e) {
    console.error('Seeding failed:', e);
    process.exit(1);
  }
})();
