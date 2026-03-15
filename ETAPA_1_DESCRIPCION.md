cp .env.example .env   # Editar passwords y JWT secrets
make dev               # Levanta todo con hot-reload
# Abrir http://localhost


Archivo 1 de 40 — docker-compose.yml
¿Qué hace? Define y conecta todos los servicios de la aplicación: Nginx (proxy), la API Node.js, el frontend React, PostgreSQL, Redis y MinIO. Es el "director de orquesta" — con un solo comando docker compose up levanta todo el sistema.

Archivo 2 de 40 — docker-compose.dev.yml
¿Qué hace? Sobreescribe partes del docker-compose.yml para el entorno de desarrollo local. Activa hot-reload en la API y el frontend, expone los puertos de Postgres y Redis para inspección directa desde tu máquina, y desactiva Certbot (no necesitas SSL en local).
Cómo se usa: docker compose -f docker-compose.yml -f docker-compose.dev.yml up

Archivo 3 de 40 — .env.example
¿Qué hace? Documenta todas las variables de entorno que necesita la aplicación. El archivo .env real (que nunca va al repositorio) se crea copiando este. Cada variable tiene un comentario que explica para qué sirve.

Archivo 4 de 40 — .gitignore
¿Qué hace? Le dice a Git qué archivos ignorar. Lo más importante: el .env con contraseñas reales, las carpetas node_modules y los builds compilados nunca deben subir al repositorio.

Archivo 5 de 40 — Makefile
¿Qué hace? Centraliza todos los comandos del proyecto en atajos simples. En lugar de recordar comandos largos de Docker, escribes make dev, make logs, make db-shell, etc.

Raíz lista (5 archivos). Ahora pasamos a la infraestructura Nginx.

Archivo 6 de 40 — infra/nginx/nginx.conf
¿Qué hace? Configuración base de Nginx. Define cómo trabaja el proceso: cuántas conexiones acepta, si usa compresión gzip, qué formato tienen los logs, y declara los dos "upstream" — los servidores internos a los que Nginx reenvía el tráfico (la API y el frontend).

Archivo 7 de 40 — infra/nginx/conf.d/prod.conf
¿Qué hace? Virtual host de producción. Redirige HTTP→HTTPS, configura SSL con Let's Encrypt, agrega headers de seguridad, y enruta /api/ hacia la API y todo lo demás hacia el frontend React.

Archivo 8 de 40 — infra/nginx/conf.d/dev.conf
¿Qué hace? Virtual host para desarrollo local. Sin SSL, sin redirecciones. Solo enruta /api/ a la API y todo lo demás al servidor de Vite. Incluye soporte para WebSocket, que es lo que usa Vite para el hot-reload.

Archivo 9 de 40 — infra/postgres/init.sql
¿Qué hace? Se ejecuta automáticamente la primera vez que el contenedor de Postgres arranca. Crea todas las tablas (usuarios, transacciones, cuentas, deudas, presupuestos), los índices de rendimiento, los triggers de updated_at y las categorías por defecto que verá cada usuario nuevo.

Archivo 10 de 40 — scripts/vps-setup.sh¿Qué hace? Script que se ejecuta una sola vez en el servidor VPS recién creado. Instala Docker, configura el firewall UFW, activa Fail2ban para proteger SSH, crea el usuario deploy y prepara todos los directorios necesarios.

Archivo 11 de 40 — scripts/deploy.sh
¿Qué hace? Script de despliegue continuo. Cada vez que quieres actualizar la app en producción, corres este script: hace git pull, reconstruye las imágenes Docker, reemplaza los contenedores sin downtime y verifica que la API responda antes de terminar.

Archivo 12 de 40 — scripts/ssl-init.sh
¿Qué hace? Obtiene el certificado SSL gratuito de Let's Encrypt por primera vez. Se ejecuta una sola vez después de que Nginx ya esté corriendo en el puerto 80. Certbot verifica que eres el dueño del dominio colocando un archivo en /.well-known/acme-challenge/

Scripts listos. Ahora empezamos con la API Node.js.

Archivo 13 de 40 — api/Dockerfile
¿Qué hace? Define cómo se construye la imagen Docker de la API. Usa un patrón multi-stage: el stage development activa hot-reload con nodemon, el stage production crea una imagen mínima y segura con un usuario sin privilegios de root.

Archivo 14 de 40 — api/package.json
¿Qué hace? Declara el proyecto Node.js: nombre, scripts (npm run dev, npm start) y todas las dependencias. Express es el servidor web, bcryptjs cifra contraseñas, jsonwebtoken maneja JWT, pg conecta a Postgres, ioredis conecta a Redis.

Archivo 15 de 40 — api/src/server.js
¿Qué hace? Es el punto de entrada de la API. Su único trabajo es arrancar el servidor: verificar que Postgres y Redis estén disponibles, y luego poner Express a escuchar en el puerto 4000. También maneja el apagado limpio (SIGTERM) cuando Docker detiene el contenedor.

Archivo 16 de 40 — api/src/app.js
¿Qué hace? Configura la aplicación Express: activa seguridad con Helmet, CORS, compresión gzip, rate limiting global y el logging HTTP. Luego monta todas las rutas bajo el prefijo /api/v1 y define el manejador de errores global.

Archivo 17 de 40 — api/src/utils/logger.js
¿Qué hace? Configura Winston como sistema de logs. En desarrollo imprime mensajes con colores en la consola. En producción escribe archivos JSON rotados por día. Todos los módulos de la API importan este logger en lugar de usar console.log.

Archivo 18 de 40 — api/src/utils/database.js
¿Qué hace? Crea y exporta el pool de conexiones a PostgreSQL. Un pool mantiene varias conexiones abiertas para reutilizarlas — mucho más eficiente que abrir una nueva conexión en cada petición. Incluye un helper query_safe que loguea errores automáticamente.

Archivo 19 de 40 — api/src/utils/redis.js
¿Qué hace? Configura la conexión a Redis con ioredis. Agrega tres helpers específicos para la app: setEx para guardar con tiempo de expiración, getJson para recuperar objetos JSON, y blacklistToken / isTokenBlacklisted para el sistema de logout seguro.

Archivo 20 de 40 — api/src/middleware/auth.middleware.js
¿Qué hace? Middleware que protege las rutas privadas. Extrae el JWT del header Authorization: Bearer <token>, verifica que sea válido y que no esté en la blacklist de Redis (logouts). Si pasa todo, agrega req.user con los datos del usuario para que el controller lo use.

Archivo 21 de 40 — api/src/middleware/validate.middleware.js
¿Qué hace? Middleware que revisa los resultados de express-validator. Si alguna regla de validación falló (email mal formado, campo vacío, etc.), devuelve un 422 con la lista de errores en formato estándar. Si todo está bien, deja pasar al controller.

Archivo 22 de 40 — api/src/controllers/auth.controller.js
¿Qué hace? Toda la lógica de autenticación: registro de usuarios, login, renovación de tokens (refresh), logout seguro y consulta del perfil propio. Usa bcrypt para cifrar contraseñas y JWT para los tokens de sesión.

Archivo 23 de 40 — api/src/routes/auth.routes.js
¿Qué hace? Define los endpoints de autenticación y las reglas de validación de cada uno. Usa express-validator para validar email, contraseña segura y campos obligatorios antes de que el controller procese nada.

Archivo 24 de 40 — api/src/controllers/transaction.controller.js
¿Qué hace? Toda la lógica de ingresos y gastos: listar con paginación y filtros, crear, editar y eliminar transacciones. Cada query filtra siempre por user_id para que un usuario nunca pueda ver datos de otro.

Archivo 25 de 40 — api/src/routes/transaction.routes.js
¿Qué hace? Define los 5 endpoints de transacciones con sus validaciones. Todas las rutas pasan primero por authMW (requieren login). Los parámetros de filtro en el GET son opcionales pero validados.

Archivo 26 de 40 — api/src/controllers/account.controller.js
¿Qué hace? Gestiona las cuentas bancarias, inversiones, efectivo y criptomonedas. El listado agrupa por tipo y calcula el total de activos. El delete es un "soft delete" — desactiva la cuenta sin borrarla para no perder el historial.

Archivo 27 de 40 — api/src/routes/account.routes.js
¿Qué hace? Endpoints CRUD para cuentas. Valida que el type sea uno de los cuatro permitidos y que el balance sea un número positivo.

Archivo 28 de 40 — api/src/controllers/debt.controller.js
¿Qué hace? Gestiona deudas y calcula la tabla de amortización francesa. La función buildAmortizationTable simula el plan de pagos mes a mes: cuánto es capital, cuánto es interés y cuánto queda de saldo en cada cuota.

Archivo 29 de 40 — api/src/routes/debt.routes.js
¿Qué hace? Endpoints de deudas. Incluye la ruta especial /:id/projection que devuelve la tabla de amortización completa. Valida que la tasa de interés esté entre 0 y 1 (decimal, no porcentaje).

Archivo 30 de 40 — api/src/controllers/category.controller.js
¿Qué hace? Gestiona las categorías de transacciones. El listado devuelve tanto las categorías globales por defecto (is_default = true) como las personalizadas del usuario. Solo se pueden editar o borrar las propias — las globales son de solo lectura.

Archivo 31 de 40 — api/src/routes/category.routes.js
¿Qué hace? Endpoints de categorías. Sin validaciones complejas salvo el formato del color hexadecimal y la longitud de los campos.

Archivo 32 de 40 — api/src/controllers/analytics.controller.js
¿Qué hace? El cerebro del dashboard. Cinco consultas SQL optimizadas que calculan: resumen de ingresos/gastos por período, gasto por categoría con porcentajes, proyección de flujo de caja a futuro, patrimonio neto (activos menos deudas) y flujo día a día.

Archivo 33 de 40 — api/src/routes/analytics.routes.js
¿Qué hace? Los 5 endpoints de análisis. Todos son solo GET — solo leen datos, nunca los modifican. El parámetro period acepta daily, weekly, monthly o yearly.

Archivo 34 de 40 — web/Dockerfile y web/Dockerfile.dev
¿Qué hacen? El Dockerfile de producción compila React con Vite y sirve el resultado estático con Nginx. El Dockerfile.dev arranca Vite directamente para tener hot-reload durante el desarrollo.

Archivo 35 de 40 — web/package.json, vite.config.js, tailwind.config.js, postcss.config.js
¿Qué hacen? El package.json declara React, Vite, Tailwind, Recharts (gráficas), Zustand (estado global), Axios y React Router. Los archivos de configuración conectan Vite con Tailwind y definen el proxy hacia la API en desarrollo.

Archivo 36 de 40 — web/index.html, web/nginx.conf, web/src/main.jsx, web/src/index.css
¿Qué hacen? El index.html es la cáscara vacía donde React se monta. El nginx.conf del web maneja el enrutamiento SPA: cualquier ruta que no sea un archivo devuelve index.html para que React Router tome el control. El main.jsx monta la app. El index.css carga Tailwind y define los componentes reutilizables (.card, .btn-primary, .input).

Progreso: 40+ archivos generados. Todos los archivos del backend están completos. El frontend avanza con los archivos de configuración base.

Archivo 37 de 40 — web/src/index.css
¿Qué hace? Carga Tailwind y define los componentes CSS reutilizables con @layer components. Así en lugar de repetir 10 clases de Tailwind en cada botón, escribes simplemente className="btn-primary". También define el scrollbar personalizado.

Archivo 38 de 40 — web/src/api/client.js
¿Qué hace? Configura Axios con interceptores. El interceptor de request inyecta el token JWT en cada petición. El interceptor de response detecta cuando el token expiró (TOKEN_EXPIRED), pide uno nuevo automáticamente con el refresh token, y reintenta la petición original sin que el usuario note nada.

Archivo 39 de 40 — web/src/store/index.js
¿Qué hace? Estado global con Zustand. useAuthStore maneja el usuario autenticado, login, logout y registro. useUIStore controla el sidebar y el sistema de notificaciones tipo toast. Al ser stores de Zustand, cualquier componente puede suscribirse sin prop drilling.

Archivo 40 de 40 — web/src/App.jsx
¿Qué hace? Raíz de la aplicación React. Configura el router con rutas protegidas (PrivateRoute) que redirigen al login si no hay sesión, y rutas públicas (PublicRoute) que redirigen al dashboard si ya estás autenticado. Al arrancar, carga automáticamente el perfil del usuario si hay token guardado.

Componentes UI — Layout.jsx, Toasts.jsx, Modal.jsx
¿Qué hacen? Layout es el esqueleto visual con sidebar de navegación y topbar. Toasts muestra las notificaciones flotantes. Modal es un diálogo reutilizable con fondo oscuro y cierre con Escape.

Páginas — LoginPage.jsx y RegisterPage.jsx
¿Qué hacen? Login tiene un panel izquierdo con presentación de la app y un formulario a la derecha con toggle para mostrar/ocultar contraseña. Registro es más simple: nombre, email, contraseña y selección de moneda. Ambos usan el useAuthStore para autenticar.


Las 5 páginas principales — Dashboard, Transactions, Accounts, Debts, Analytics







finanzasapp/
│
├── Raíz (6 archivos)
│   docker-compose.yml · docker-compose.dev.yml
│   .env.example · .gitignore · Makefile
│
├── infra/ (4 archivos)
│   nginx/nginx.conf · nginx/conf.d/prod.conf · nginx/conf.d/dev.conf
│   postgres/init.sql
│
├── scripts/ (3 archivos)
│   vps-setup.sh · deploy.sh · ssl-init.sh
│
├── api/ (23 archivos)
│   Dockerfile · package.json · src/server.js · src/app.js
│   utils/  logger.js · database.js · redis.js
│   middleware/  auth.middleware.js · validate.middleware.js
│   controllers/ auth · transaction · account · debt · category · analytics
│   routes/      auth · transaction · account · debt · category · analytics
│
└── web/ (20 archivos)
    Dockerfile · Dockerfile.dev · package.json · vite.config.js
    tailwind.config.js · postcss.config.js · nginx.conf · index.html
    src/ main.jsx · index.css · App.jsx
    api/client.js · store/index.js
    components/layout/Layout.jsx
    components/ui/Modal.jsx · Toasts.jsx
    pages/ Dashboard · Transactions · Accounts · Debts · Analytics
           LoginPage · RegisterPage