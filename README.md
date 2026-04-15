# Directorio de negocios de Manzanillo

Este proyecto queda listo para publicarse como una sola aplicacion:

- la pagina se sirve desde Express
- la API vive en `/api`
- la base de datos se conecta por `DATABASE_URL`
- si la base esta vacia, el servidor crea las tablas automaticamente
- la API responde en JSON y se puede probar desde Postman

## Ejecutar en local

1. Instala dependencias:

```powershell
cd Front-end
npm install
```

2. Define tus variables de entorno usando `Front-end/.env.example` como referencia:

```powershell
$env:PGUSER="postgres"
$env:PGPASSWORD="tu_password"
$env:PGHOST="127.0.0.1"
$env:PGPORT="5432"
$env:PGDATABASE="directorio_manzanillo"
npm start
```

3. Abre `http://localhost:5000`.

## Publicarlo en Render

El archivo `render.yaml` ya prepara:

- 1 web service Node
- 1 base de datos Postgres
- la variable `DATABASE_URL`
- el health check en `/api/health`

Pasos:

1. Sube esta carpeta a un repositorio de GitHub.
2. En Render, elige `New > Blueprint`.
3. Conecta tu repo y confirma el despliegue.
4. Cuando termine, tu sitio quedara en una URL tipo `https://directorio-manzanillo.onrender.com`.

## Probar la API en Postman

Importa `postman_collection.json` y cambia la variable `baseUrl`:

- En local: `http://localhost:5000`
- En produccion: `https://tu-app.onrender.com`

Endpoints incluidos:

- `GET /api/health`
- `GET /api/businesses`
- `GET /api/businesses/:id`
- `POST /api/businesses`
- `PUT /api/businesses/:id`
- `POST /api/businesses/:id/reviews`
- `DELETE /api/businesses/:id`

## Importante

- El plan `free` sirve para pruebas, pero la base de datos gratis expira a los 30 dias.
- Si quieres una pagina permanente, cambia el Postgres a un plan pagado o conecta una base remota propia.
