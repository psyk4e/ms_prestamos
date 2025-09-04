# MS Prestamos - Webhook Service

Microservicio webhook para acceso a información de clientes con créditos atrasados, implementado con TypeScript, Express y Prisma ORM usando arquitectura en capas (Onion Architecture).

## 🚀 Características

- **Arquitectura en Capas (Onion)**: Separación clara de responsabilidades
- **Autenticación**: API Key fija para acceso seguro
- **Rate Limiting**: Protección contra abuso de la API
- **Logging**: Registro completo de accesos al webhook
- **Validación**: Validación robusta de parámetros de entrada
- **Paginación**: Soporte para consultas paginadas
- **CORS**: Configuración flexible de orígenes permitidos
- **Compresión**: Respuestas comprimidas para mejor rendimiento
- **Health Checks**: Endpoints de monitoreo

## 📋 Requisitos

- Node.js 18+
- Microsoft SQL Server (opcional - incluye modo demostración)
- npm o yarn

## 🛠️ Instalación

1. **Clonar e instalar dependencias:**
```bash
npm install
```

2. **Configurar variables de entorno:**
Editar el archivo `.env` con tus configuraciones:
```env
DATABASE_URL="sqlserver://localhost:1433;database=ms_prestamos;user=sa;password=YourPassword123;trustServerCertificate=true"
PORT=3001
NODE_ENV=development
AUTH_KEY=webhook_secret_key_2025
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

3. **Configurar Prisma:**
```bash
npm run prisma:generate
npm run prisma:migrate
```

4. **Iniciar en modo desarrollo:**
```bash
npm run dev
```

## 📊 Base de Datos

El servicio está configurado para utilizar **Microsoft SQL Server** como motor de base de datos y Prisma como ORM. La configuración se basa en una vista llamada `View_creditos_atrasados` que debe existir en la base de datos.

### Modo Demostración

Para facilitar las pruebas sin necesidad de configurar SQL Server, el proyecto incluye implementaciones mock que simulan la funcionalidad de la base de datos con datos de ejemplo en memoria.

### Vista de Base de Datos

El servicio está basado en la vista `View_creditos_atrasados` con la siguiente estructura:

```sql
SELECT 
  CLIENTE,
  CANT_CUOTAS as [CUOTAS VENCIDAS],
  'Notificación de atraso en cuota' AS [CONCEPTO],
  DESDE,
  TotalAdeudado AS [PONERSE AL DIA] 
FROM View_creditos_atrasados 
WHERE num_credito = 87
```

## 🔐 Autenticación

Todas las rutas del webhook requieren autenticación mediante API Key:

**Opción 1: Header**
```bash
curl -H "x-auth-key: webhook_secret_key_2025" http://localhost:3000/webhook/credito/87
```

**Opción 2: Query Parameter**
```bash
curl "http://localhost:3000/webhook/credito/87?authKey=webhook_secret_key_2025"
```

## 📚 Endpoints

### Webhook Endpoints (Requieren Autenticación)

#### `GET /webhook/credito/:numCredito`
Obtiene información de un crédito específico.

**Ejemplo:**
```bash
curl -H "x-auth-key: webhook_secret_key_2025" \
  http://localhost:3000/webhook/credito/87
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "cliente": "Juan Pérez",
    "cuotasVencidas": 3,
    "concepto": "Notificación de atraso en cuota",
    "desde": "2024-01-15T00:00:00.000Z",
    "ponerseAlDia": 15000.50
  },
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

#### `GET /webhook/cliente/:cliente`
Obtiene todos los créditos atrasados de un cliente.

**Ejemplo:**
```bash
curl -H "x-auth-key: webhook_secret_key_2025" \
  "http://localhost:3000/webhook/cliente/Juan%20Perez"
```

#### `GET /webhook/creditos`
Obtiene créditos con filtros opcionales y paginación.

**Parámetros de consulta:**
- `numCredito`: Filtrar por número de crédito
- `cliente`: Filtrar por nombre de cliente
- `fechaDesde`: Filtrar desde fecha (YYYY-MM-DD)
- `fechaHasta`: Filtrar hasta fecha (YYYY-MM-DD)
- `page`: Número de página (default: 1)
- `limit`: Elementos por página (default: 10, max: 100)

**Ejemplo:**
```bash
curl -H "x-auth-key: webhook_secret_key_2025" \
  "http://localhost:3000/webhook/creditos?page=1&limit=10&cliente=Juan"
```

#### `POST /webhook/credito`
Consulta compleja mediante body JSON.

**Ejemplo:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-auth-key: webhook_secret_key_2025" \
  -d '{
    "cliente": "Juan",
    "fechaDesde": "2024-01-01",
    "fechaHasta": "2024-01-31"
  }' \
  http://localhost:3000/webhook/credito
```

### API Endpoints (Públicos)

#### `GET /api/v1/health`
Health check del servicio.

#### `GET /api/v1/info`
Información general del servicio.

#### `GET /api/v1/docs`
Documentación completa de la API.

## 🏗️ Arquitectura

El proyecto sigue la **Arquitectura en Capas (Onion Architecture)**:

```
src/
├── domain/                 # Capa de Dominio
│   ├── entities/          # Entidades de negocio
│   └── interfaces/        # Contratos/Interfaces
├── application/           # Capa de Aplicación
│   └── services/         # Servicios de aplicación
├── infrastructure/        # Capa de Infraestructura
│   ├── database/         # Repositorios y conexión DB
│   ├── services/         # Servicios de infraestructura
│   └── config/           # Configuración
└── presentation/          # Capa de Presentación
    ├── controllers/      # Controladores HTTP
    ├── middleware/       # Middleware de Express
    └── routes/           # Definición de rutas
```

## 🔒 Seguridad

- **Rate Limiting**: 100 requests por 15 minutos por IP
- **Helmet**: Headers de seguridad HTTP
- **CORS**: Configuración de orígenes permitidos
- **Validación**: Validación estricta de parámetros
- **Logging**: Registro de todos los accesos
- **Auth Key**: Autenticación mediante clave fija

## 📊 Monitoreo

- **Health Checks**: `/health` y `/api/v1/health`
- **Logging**: Registro completo en `webhook_logs`
- **Métricas**: Tiempo de respuesta y códigos de estado

## 🚀 Scripts Disponibles

```bash
# Desarrollo
npm run dev

# Construcción
npm run build

# Producción
npm start

# Prisma
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
```

## 🐛 Troubleshooting

### Error de conexión a base de datos
1. Verificar que PostgreSQL esté ejecutándose
2. Confirmar credenciales en `DATABASE_URL`
3. Ejecutar migraciones: `npm run prisma:migrate`

### Error 401 Unauthorized
1. Verificar que el header `x-auth-key` esté presente
2. Confirmar que la clave coincida con `AUTH_KEY` en `.env`

### Error 429 Too Many Requests
1. Esperar el tiempo de ventana (15 minutos por defecto)
2. Ajustar `RATE_LIMIT_MAX_REQUESTS` si es necesario

## 📝 Ejemplo de Uso Completo

```bash
# 1. Consultar crédito específico
curl -H "x-auth-key: webhook_secret_key_2025" \
  http://localhost:3000/webhook/credito/87

# 2. Consultar por cliente
curl -H "x-auth-key: webhook_secret_key_2025" \
  "http://localhost:3000/webhook/cliente/Juan%20Perez"

# 3. Consulta con filtros y paginación
curl -H "x-auth-key: webhook_secret_key_2025" \
  "http://localhost:3000/webhook/creditos?fechaDesde=2024-01-01&limit=5"

# 4. Health check
curl http://localhost:3000/health

# 5. Documentación
curl http://localhost:3000/api/v1/docs
```