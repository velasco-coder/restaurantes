const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = Number(process.env.PORT) || 5000;
const publicDir = path.join(__dirname, 'public');
const dbInitRetries = Number(process.env.DB_INIT_RETRIES) || 12;
const dbInitDelayMs = Number(process.env.DB_INIT_DELAY_MS) || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(publicDir));

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl:
          process.env.DATABASE_SSL === 'false'
            ? false
            : process.env.NODE_ENV === 'production'
              ? { rejectUnauthorized: false }
              : false,
      }
    : {
        user: process.env.PGUSER || 'postgres',
        host: process.env.PGHOST || '127.0.0.1',
        database: process.env.PGDATABASE || 'directorio_manzanillo',
        password: process.env.PGPASSWORD || 'velasco',
        port: Number(process.env.PGPORT) || 5432,
      }
);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS businesses (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      category TEXT NOT NULL,
      phone TEXT NOT NULL,
      hours TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      review_text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE reviews
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function initializeDatabase() {
  await ensureSchema();
  await pool.query('SELECT 1');
}

async function initializeDatabaseWithRetry() {
  let lastError;

  for (let attempt = 1; attempt <= dbInitRetries; attempt += 1) {
    try {
      await initializeDatabase();
      console.log(`Base de datos lista en el intento ${attempt}.`);
      return;
    } catch (error) {
      lastError = error;
      console.error(`Intento ${attempt}/${dbInitRetries} para inicializar la base fallido:`, error);

      if (attempt < dbInitRetries) {
        await sleep(dbInitDelayMs);
      }
    }
  }

  throw lastError;
}

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ status: 'error' });
  }
});

app.get('/api/businesses', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        b.id,
        b.name,
        b.address,
        b.category,
        b.phone,
        b.hours,
        b.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', r.id,
              'business_id', r.business_id,
              'review_text', r.review_text,
              'created_at', r.created_at
            )
            ORDER BY r.id
          ) FILTER (WHERE r.id IS NOT NULL),
          '[]'::json
        ) AS reviews
      FROM businesses b
      LEFT JOIN reviews r ON b.id = r.business_id
      GROUP BY b.id
      ORDER BY b.id DESC;
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al consultar los negocios.');
  }
});

app.get('/api/businesses/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
        SELECT
          b.id,
          b.name,
          b.address,
          b.category,
          b.phone,
          b.hours,
          b.created_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id', r.id,
                'business_id', r.business_id,
                'review_text', r.review_text,
                'created_at', r.created_at
              )
              ORDER BY r.id
            ) FILTER (WHERE r.id IS NOT NULL),
            '[]'::json
          ) AS reviews
        FROM businesses b
        LEFT JOIN reviews r ON b.id = r.business_id
        WHERE b.id = $1
        GROUP BY b.id;
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Negocio no encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar el negocio.' });
  }
});

app.post('/api/businesses', async (req, res) => {
  const { name, address, category, phone, hours } = req.body;

  if (![name, address, category, phone, hours].every(isNonEmptyString)) {
    return res.status(400).json({ error: 'Todos los campos del negocio son obligatorios.' });
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO businesses (name, address, category, phone, hours)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `,
      [name.trim(), address.trim(), category.trim().toLowerCase(), phone.trim(), hours.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al guardar el negocio.' });
  }
});

app.put('/api/businesses/:id', async (req, res) => {
  const { id } = req.params;
  const { name, address, category, phone, hours } = req.body;

  if (![name, address, category, phone, hours].every(isNonEmptyString)) {
    return res.status(400).json({ error: 'Todos los campos del negocio son obligatorios.' });
  }

  try {
    const result = await pool.query(
      `
        UPDATE businesses
        SET name = $1, address = $2, category = $3, phone = $4, hours = $5
        WHERE id = $6
        RETURNING *;
      `,
      [name.trim(), address.trim(), category.trim().toLowerCase(), phone.trim(), hours.trim(), id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Negocio no encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el negocio.' });
  }
});

app.delete('/api/businesses/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM businesses WHERE id = $1 RETURNING id;', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Negocio no encontrado.' });
    }

    res.json({ message: 'Negocio eliminado.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el negocio.' });
  }
});

app.post('/api/businesses/:id/reviews', async (req, res) => {
  const { id } = req.params;
  const { review_text: reviewText } = req.body;

  if (!isNonEmptyString(reviewText)) {
    return res.status(400).json({ error: 'La resena no puede estar vacia.' });
  }

  try {
    const business = await pool.query('SELECT id FROM businesses WHERE id = $1;', [id]);

    if (business.rowCount === 0) {
      return res.status(404).json({ error: 'Negocio no encontrado.' });
    }

    const result = await pool.query(
      `
        INSERT INTO reviews (business_id, review_text)
        VALUES ($1, $2)
        RETURNING *;
      `,
      [id, reviewText.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al agregar la resena.' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

async function startServer() {
  try {
    await initializeDatabaseWithRetry();

    app.listen(port, () => {
      console.log(`Servidor corriendo en el puerto ${port}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar la aplicacion:', error);
    process.exit(1);
  }
}

startServer();
