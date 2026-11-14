const router = require('express').Router();
const db = require('../Database/database');
const auth = require('../middleware/auth');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { analyzeMeters } = require('../services/riskengine');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
router.use(auth);

const admin = (req, res, next) =>
  req.user.role === 'ADMIN' ? next() : res.status(403).json({ error: 'Admin access required' });

const owned = async (req, id) => {
  const sql =
    req.user.role === 'ADMIN'
      ? 'SELECT * FROM meters WHERE id = $1'
      : 'SELECT * FROM meters WHERE id = $1 AND created_by = $2';
  const params = req.user.role === 'ADMIN' ? [Number(id)] : [Number(id), req.user.id];
  const { rows } = await db.query(sql, params);
  return rows[0];
};

const getMeters = async (req) => {
  const sql =
    req.user.role === 'ADMIN'
      ? 'SELECT * FROM meters ORDER BY meter_id'
      : 'SELECT * FROM meters WHERE created_by = $1 ORDER BY meter_id';
  const params = req.user.role === 'ADMIN' ? [] : [req.user.id];
  const { rows } = await db.query(sql, params);
  return rows;
};

const readings = async (meterId) => {
  const { rows } = await db.query(
    `SELECT r.id, r.meter_id AS "meterId", m.meter_id AS "meterCode",
            r.month, r.units_consumed AS "units", r.reading_date AS "readingDate", r.remarks
     FROM readings r
     JOIN meters m ON m.id = r.meter_id
     WHERE r.meter_id = $1
     ORDER BY r.month`,
    [meterId]
  );
  return rows.map((r) => ({ ...r, units: Number(r.units) }));
};

const getSettings = async () => {
  const { rows } = await db.query('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map((x) => [x.key, Number(x.value)]));
};

async function runAnalysis(ms) {
  if (!ms || !ms.length) return [];
  const meterIds = ms.map((m) => m.id);
  const { rows } = await db.query(
    `SELECT r.id, r.meter_id AS "meterId", m.meter_id AS "meterCode",
            r.month, r.units_consumed AS "units", r.reading_date AS "readingDate", r.remarks
     FROM readings r
     JOIN meters m ON m.id = r.meter_id
     WHERE r.meter_id = ANY($1::int[])
     ORDER BY r.month`,
    [meterIds]
  );
  const data = rows.map((r) => ({ ...r, units: Number(r.units) }));
  const conf = await getSettings();
  const result = analyzeMeters(ms, data, conf);

  if (result.length) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      for (const r of result) {
        await client.query(
          `INSERT INTO analysis (
            meter_id, month, units_consumed, change_percent, rolling_avg,
            deviation_percent, risk_score, risk_level, flags, reasons
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (meter_id, month) DO UPDATE SET
            units_consumed = EXCLUDED.units_consumed,
            change_percent = EXCLUDED.change_percent,
            rolling_avg = EXCLUDED.rolling_avg,
            deviation_percent = EXCLUDED.deviation_percent,
            risk_score = EXCLUDED.risk_score,
            risk_level = EXCLUDED.risk_level,
            flags = EXCLUDED.flags,
            reasons = EXCLUDED.reasons,
            analyzed_at = CURRENT_TIMESTAMP`,
          [
            r.meterId,
            r.month,
            r.units,
            r.changePercent,
            r.rollingAvg,
            r.deviationPercent,
            r.score,
            r.level,
            JSON.stringify(r.flags),
            JSON.stringify(r.reasons),
          ]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  return result;
}

router.get('/meters', async (req, res, next) => {
  try {
    const meters = await getMeters(req);
    res.json({ meters });
  } catch (e) {
    next(e);
  }
});

router.post('/meters', async (req, res, next) => {
  try {
    const {
      meter_id,
      consumer_name,
      address,
      connection_type,
      sanctioned_load_kw = 5,
      status = 'Active',
    } = req.body;
    if (
      !meter_id ||
      !consumer_name ||
      !address ||
      !['Residential', 'Commercial', 'Industrial'].includes(connection_type) ||
      Number(sanctioned_load_kw) < 0
    ) {
      return res.status(400).json({ error: 'Complete all meter fields with a valid connection type' });
    }
    const { rows } = await db.query(
      `INSERT INTO meters (meter_id, consumer_name, address, connection_type, sanctioned_load_kw, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [meter_id, consumer_name, address, connection_type, Number(sanctioned_load_kw), status, req.user.id]
    );
    res.status(201).json({ meter: rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Meter ID already exists' });
    next(e);
  }
});

router.get('/meters/:id', async (req, res, next) => {
  try {
    const m = await owned(req, Number(req.params.id));
    if (!m) return res.status(404).json({ error: 'Meter not found' });
    const { rows } = await db.query('SELECT * FROM analysis WHERE meter_id = $1 ORDER BY month DESC LIMIT 1', [m.id]);
    const analysis = rows[0];
    const meterReadings = await readings(m.id);
    res.json({
      meter: m,
      readings: meterReadings,
      risk: analysis
        ? {
            ...analysis,
            flags: typeof analysis.flags === 'string' ? JSON.parse(analysis.flags) : analysis.flags,
            reasons: typeof analysis.reasons === 'string' ? JSON.parse(analysis.reasons) : analysis.reasons,
          }
        : null,
    });
  } catch (e) {
    next(e);
  }
});

router.put('/meters/:id', async (req, res, next) => {
  try {
    const m = await owned(req, Number(req.params.id));
    if (!m) return res.status(404).json({ error: 'Meter not found' });
    const b = req.body;
    const type = b.connection_type ?? m.connection_type;
    const status = b.status ?? m.status;
    const load = Number(b.sanctioned_load_kw ?? m.sanctioned_load_kw);
    if (
      !['Residential', 'Commercial', 'Industrial'].includes(type) ||
      !['Active', 'Inactive'].includes(status) ||
      !Number.isFinite(load) ||
      load < 0
    ) {
      return res.status(400).json({ error: 'Connection type, status, or sanctioned load is invalid' });
    }
    const { rows } = await db.query(
      `UPDATE meters
       SET consumer_name = $1, address = $2, connection_type = $3, sanctioned_load_kw = $4, status = $5
       WHERE id = $6
       RETURNING *`,
      [b.consumer_name || m.consumer_name, b.address || m.address, type, load, status, m.id]
    );
    res.json({ meter: rows[0] });
  } catch (e) {
    next(e);
  }
});

router.delete('/meters/:id', async (req, res, next) => {
  try {
    const m = await owned(req, Number(req.params.id));
    if (!m) return res.status(404).json({ error: 'Meter not found' });
    await db.query('DELETE FROM meters WHERE id = $1', [m.id]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/readings', async (req, res, next) => {
  try {
    let sql = `SELECT r.id, r.meter_id AS "meterId", m.meter_id AS "meterCode",
                      m.consumer_name AS "consumerName", r.month, r.units_consumed AS "units",
                      r.reading_date AS "readingDate", r.remarks
               FROM readings r
               JOIN meters m ON m.id = r.meter_id
               WHERE 1=1`;
    const params = [];
    if (req.user.role !== 'ADMIN') {
      params.push(req.user.id);
      sql += ` AND m.created_by = $${params.length}`;
    }
    if (req.query.month) {
      params.push(req.query.month);
      sql += ` AND r.month = $${params.length}`;
    }
    if (req.query.meterId) {
      params.push(Number(req.query.meterId));
      sql += ` AND m.id = $${params.length}`;
    }
    sql += ' ORDER BY r.month DESC, m.meter_id';
    const { rows } = await db.query(sql, params);
    res.json({ readings: rows.map((r) => ({ ...r, units: Number(r.units) })) });
  } catch (e) {
    next(e);
  }
});

router.post('/readings', async (req, res, next) => {
  try {
    const {
      meter_id,
      month,
      units_consumed,
      reading_date = new Date().toISOString().slice(0, 10),
      remarks = '',
    } = req.body;
    const m = await owned(req, Number(meter_id));
    if (!m) return res.status(404).json({ error: 'Meter not found' });
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '') || !Number.isFinite(+units_consumed) || +units_consumed < 0) {
      return res.status(400).json({ error: 'Month must be YYYY-MM and units must be non-negative' });
    }
    const { rows } = await db.query(
      `INSERT INTO readings (meter_id, month, units_consumed, reading_date, remarks)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [m.id, month, +units_consumed, reading_date, remarks]
    );
    res.status(201).json({ reading: rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'A reading already exists for this meter and month' });
    next(e);
  }
});

router.put('/readings/:id', async (req, res, next) => {
  try {
    const sql =
      `SELECT r.* FROM readings r
       JOIN meters m ON m.id = r.meter_id
       WHERE r.id = $1` + (req.user.role === 'ADMIN' ? '' : ' AND m.created_by = $2');
    const params = req.user.role === 'ADMIN' ? [Number(req.params.id)] : [Number(req.params.id), req.user.id];
    const { rows } = await db.query(sql, params);
    const r = rows[0];
    if (!r) return res.status(404).json({ error: 'Reading not found' });

    const month = req.body.month ?? r.month;
    const units = Number(req.body.units_consumed ?? r.units_consumed);
    const readingDate = req.body.reading_date ?? r.reading_date;
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
      !Number.isFinite(units) ||
      units < 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(readingDate)
    ) {
      return res.status(400).json({ error: 'Month, non-negative units, or reading date is invalid' });
    }
    await db.query(
      'UPDATE readings SET month = $1, units_consumed = $2, reading_date = $3, remarks = $4 WHERE id = $5',
      [month, units, readingDate, req.body.remarks ?? r.remarks, r.id]
    );
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'A reading already exists for this meter and month' });
    next(e);
  }
});

router.delete('/readings/:id', async (req, res, next) => {
  try {
    const sql =
      `DELETE FROM readings WHERE id IN (
         SELECT r.id FROM readings r
         JOIN meters m ON m.id = r.meter_id
         WHERE r.id = $1` +
      (req.user.role === 'ADMIN' ? '' : ' AND m.created_by = $2') +
      ')';
    const params = req.user.role === 'ADMIN' ? [Number(req.params.id)] : [Number(req.params.id), req.user.id];
    const result = await db.query(sql, params);
    res.json({ deleted: result.rowCount > 0 });
  } catch (e) {
    next(e);
  }
});

router.post('/readings/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose a CSV file' });
    const rows = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
    let added = 0,
      skipped = 0,
      errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const n = i + 2;
      const { rows: meterRows } = await db.query('SELECT * FROM meters WHERE meter_id = $1', [row.meter_id]);
      const m = meterRows[0];
      if (!m || (req.user.role !== 'ADMIN' && m.created_by !== req.user.id)) {
        errors.push({ row: n, message: 'Unknown meter ID or no access' });
        continue;
      }
      if (
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month || '') ||
        !Number.isFinite(Number(row.units_consumed)) ||
        Number(row.units_consumed) < 0
      ) {
        errors.push({ row: n, message: 'Invalid month or units' });
        continue;
      }
      try {
        await db.query(
          'INSERT INTO readings (meter_id, month, units_consumed, reading_date) VALUES ($1, $2, $3, $4)',
          [m.id, row.month, Number(row.units_consumed), `${row.month}-28`]
        );
        added++;
      } catch (e) {
        if (e.code === '23505') skipped++;
        else errors.push({ row: n, message: 'Could not save row' });
      }
    }
    res.json({ added, skipped, errors });
  } catch (e) {
    next(e);
  }
});

router.post('/analysis/run', async (req, res, next) => {
  try {
    let ms = await getMeters(req);
    if (req.body.meterId) {
      ms = ms.filter((m) => m.id === +req.body.meterId);
    }
    const results = await runAnalysis(ms);
    res.json({ count: results.length });
  } catch (e) {
    next(e);
  }
});

router.get('/analysis', async (req, res, next) => {
  try {
    const ms = await getMeters(req);
    await runAnalysis(ms);
    let sql = `SELECT a.*, m.meter_id AS "meterCode", m.consumer_name AS "consumerName",
                      m.connection_type AS "connectionType"
               FROM analysis a
               JOIN meters m ON m.id = a.meter_id
               WHERE 1=1`;
    const params = [];
    if (req.user.role !== 'ADMIN') {
      params.push(req.user.id);
      sql += ` AND m.created_by = $${params.length}`;
    }
    for (const [k, col] of [
      ['month', 'a.month'],
      ['level', 'a.risk_level'],
      ['connectionType', 'm.connection_type'],
    ]) {
      if (req.query[k]) {
        params.push(req.query[k]);
        sql += ` AND ${col} = $${params.length}`;
      }
    }
    sql += ' ORDER BY a.month DESC, a.risk_score DESC';
    const { rows } = await db.query(sql, params);
    const out = rows.map((a) => ({
      ...a,
      meterId: a.meter_id,
      flags: typeof a.flags === 'string' ? JSON.parse(a.flags) : a.flags,
      reasons: typeof a.reasons === 'string' ? JSON.parse(a.reasons) : a.reasons,
      score: a.risk_score,
      level: a.risk_level,
      units: Number(a.units_consumed),
    }));
    res.json({ analysis: out });
  } catch (e) {
    next(e);
  }
});

router.get('/dashboard/summary', async (req, res, next) => {
  try {
    const ms = await getMeters(req);
    const data = await runAnalysis(ms);
    const month = req.query.month || (data.map((x) => x.month).sort().pop() || new Date().toISOString().slice(0, 7));
    const selected = data.filter((x) => x.month === month);

    const countSql =
      'SELECT COUNT(*)::int AS n FROM readings r JOIN meters m ON m.id = r.meter_id WHERE ' +
      (req.user.role === 'ADMIN' ? '1=1' : 'm.created_by = $1');
    const countParams = req.user.role === 'ADMIN' ? [] : [req.user.id];
    const { rows: countRows } = await db.query(countSql, countParams);

    res.json({
      totalMeters: ms.length,
      totalReadings: countRows[0].n,
      highRisk: selected.filter((x) => x.level === 'HIGH').length,
      mediumRisk: selected.filter((x) => x.level === 'MEDIUM').length,
      avgConsumption: selected.length ? Math.round(selected.reduce((s, x) => s + x.units, 0) / selected.length) : 0,
      month,
      analysis: selected,
      meters: ms,
      trend: selected.slice(0, 10),
    });
  } catch (e) {
    next(e);
  }
});

router.put('/meters/:id/investigation', admin, async (req, res, next) => {
  try {
    const { status, notes = '' } = req.body;
    if (!['Pending', 'Under Investigation', 'Resolved', 'False Alarm'].includes(status)) {
      return res.status(400).json({ error: 'Invalid investigation status' });
    }
    const result = await db.query(
      'UPDATE meters SET investigation_status = $1, investigation_notes = $2, investigation_updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [status, String(notes), Number(req.params.id)]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Meter not found' });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/settings', async (req, res, next) => {
  try {
    res.json({ settings: await getSettings() });
  } catch (e) {
    next(e);
  }
});

router.put('/settings', admin, async (req, res, next) => {
  try {
    const current = await getSettings();
    for (const [k, v] of Object.entries(req.body)) {
      if (current[k] !== undefined && Number(v) >= 0) {
        await db.query('UPDATE settings SET value = $1 WHERE key = $2', [Number(v), k]);
      }
    }
    res.json({ settings: await getSettings() });
  } catch (e) {
    next(e);
  }
});

router.get('/reports/export', async (req, res, next) => {
  try {
    const ms = await getMeters(req);
    await runAnalysis(ms);
    const targetMonth = req.query.month || new Date().toISOString().slice(0, 7);
    const sql =
      `SELECT a.month, m.meter_id, m.consumer_name, m.connection_type, a.units_consumed, a.risk_score, a.risk_level, a.flags, a.reasons
       FROM analysis a
       JOIN meters m ON m.id = a.meter_id
       WHERE a.month = $1` +
      (req.user.role === 'ADMIN' ? '' : ' AND m.created_by = $2') +
      ' ORDER BY a.risk_score DESC';
    const params = req.user.role === 'ADMIN' ? [targetMonth] : [targetMonth, req.user.id];
    const { rows } = await db.query(sql, params);
    const esc = (x) => '"' + String(x ?? '').replaceAll('"', '""') + '"';
    const csv = [
      'month,meter_id,consumer_name,connection_type,units_consumed,risk_score,risk_level,flags,reasons',
      ...rows.map((r) =>
        [
          r.month,
          r.meter_id,
          r.consumer_name,
          r.connection_type,
          r.units_consumed,
          r.risk_score,
          r.risk_level,
          typeof r.flags === 'object' ? JSON.stringify(r.flags) : r.flags,
          typeof r.reasons === 'object' ? JSON.stringify(r.reasons) : r.reasons,
        ]
          .map(esc)
          .join(',')
      ),
    ].join('\n');
    res.type('text/csv').attachment('volttrack-risk-report.csv').send(csv);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
