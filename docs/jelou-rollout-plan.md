# Skillbox para Jelou — plan de despliegue

Objetivo: una biblioteca de skills interna en Fly.io (org `jelou-ops`), con login de Google `@jelou.ai`,
en la que cualquier persona de Jelou conecta su agente con **un solo comando** y en la que publicar o
actualizar una skill llega a todos al instante.

## Cómo queda

```
Persona de Jelou ──Google @jelou.ai──▶ Panel web ──▶ "Conectar mi agente" ──▶ código de un solo uso
                                                                                   │
Terminal:  curl -fsSL https://skills.jelou.dev/install | sh -s -- <código>  ◀──────┘
                   │
                   ├─ Claude Code (CLI + pestaña Code de Desktop)
                   ├─ Codex (CLI + app de escritorio + extensión IDE)
                   └─ Cursor
                        │
                        ▼
                /mcp con key personal ──▶ skills en vivo (sin copias locales)
```

| Rol | Quién | Qué puede hacer |
|---|---|---|
| **Admin** | Alexander (lista en `SKILLBOX_ADMIN_EMAILS`) | Todo: crear, editar, archivar skills, aprobar propuestas, revocar keys |
| **Autor** | Quien el admin marque | Proponer skills nuevas o cambios; el admin aprueba |
| **Miembro** | Cualquier `@jelou.ai` | Leer skills, generar y revocar **sus** keys |

`SKILLBOX_ADMIN_TOKEN` se queda como acceso de emergencia si Google falla.

---

## Fase 0 — Limpieza (hecha el 2026-09-18)

- [x] Borrado `jelou-internal-hub` (org `jelou`): app, máquina, volumen y secretos.
- [x] Google OAuth client rescatado en `.env.local` (gitignored). El redirect URI todavía apunta a
      `jelou-internal-hub.fly.dev`; se cambia en la Fase 2.

## Fase 1 — Desplegar tal cual en Fly

Meta: skillbox corriendo en HTTPS con su login actual. El único cambio de código de esta fase es la base de datos.

Todo vive en **una sola app de Fly**: sin base de datos aparte ni proveedores externos.

1. **Base de datos: PGlite** (Postgres compilado a WASM, corre dentro del proceso de Bun) guardado en
   un volumen de Fly. Sigue siendo Postgres, así que `jsonb`, `to_tsvector`, `FOR UPDATE` y el esquema
   actual siguen funcionando.
   - `src/server/db.ts`: si hay `DATABASE_URL` se usa `postgres.js` como hoy (desarrollo local y
     tests); si no, PGlite en `SKILLBOX_DATA_DIR` con `drizzle-orm/pglite`.
   - Adaptar las ~22 consultas escritas a mano sobre `connection\`...\`` y las transacciones
     (`begin`) a la API de PGlite, detrás de una interfaz común.
   - **Cierre limpio:** en `SIGINT`/`SIGTERM` hay que llamar `pg.close()` antes de salir; si Fly
     mata el proceso a mitad de una escritura, los datos pueden quedar corruptos.
   - Backups: `pg_dump` ya no aplica; se usan los snapshots diarios del volumen más el `export` de
     skills.
   - Probar el esquema completo y la búsqueda sobre PGlite (`bun test`) antes del deploy.
2. `fly.toml` en la raíz: app `jelou-skillbox`, org `jelou-ops`, región `iad`, `internal_port = 4791`,
   `force_https`, check a `/healthz`, `shared-cpu-1x` / 512 MB, y **apagado automático**:
   ```toml
   kill_signal = "SIGINT"
   kill_timeout = "30s"

   [http_service]
     auto_stop_machines = "stop"      # "suspend" no va bien con volúmenes
     auto_start_machines = true
     min_machines_running = 0

   [[mounts]]
     source = "skillbox_data"
     destination = "/data"
     initial_size = "1gb"
     snapshot_retention = 14
   ```
   Sin uso solo se paga el volumen (~$0.15/GB-mes) y el disco de la imagen. Al despertar tarda un par de
   segundos; para un agente que abre el MCP al empezar la tarea no se nota. **Siempre una sola
   máquina**: PGlite no se comparte entre máquinas.
3. Secretos: `SKILLBOX_ADMIN_TOKEN` (32+ caracteres aleatorios), `SKILLBOX_ORIGIN=https://skills.jelou.dev`.
   Env: `SKILLBOX_DATA_DIR=/data/pglite`.
4. Dominio: `fly certs add skills.jelou.dev` + registro DNS (patrón de `tooling.jelou.dev`).
5. Deploy por GitHub Actions al hacer push a `main` (igual que `internal-tooling`).

Estado (2026-09-18): código listo. `db.ts` usa PGlite si no hay `DATABASE_URL`; las consultas globales
hechas dentro de una transacción se unen a ella (PGlite tiene un solo backend y si no se bloquearían).
`bun test` pasa completo sobre PGlite en memoria. El `Dockerfile` tiene el target `fly`, que ajusta los
permisos del volumen y corre el servidor como `bun`. Falta crear la app en Fly y el dominio.

**Listo cuando:** `/healthz` responde 200 por HTTPS, entras con el admin token, creas un perfil y una key
de prueba, y `claude mcp add ...` con esa key lista skills.

## Fase 2 — Login con Google `@jelou.ai`

Mismo patrón que `internal-tooling` (Auth.js, dominio restringido).

1. Tabla `users` (`email`, `name`, `role: admin|author|member`, `created_at`). Primer login crea el
   usuario como `member`; los correos de `SKILLBOX_ADMIN_EMAILS` entran como `admin`.
2. `sessions` gana columna `user_email`; `authenticate()` devuelve el principal según el rol del usuario,
   ya no siempre `ADMIN`.
3. Rutas `GET /api/auth/google` y `/api/auth/google/callback` (OAuth + PKCE, `hd=jelou.ai`).
   **El servidor verifica** `email_verified` y que el dominio sea `jelou.ai`: `hd` solo es una pista
   para Google, no un control.
4. Pantalla de login: botón "Entrar con Google"; el login con admin token queda en un enlace secundario.
5. En Google Cloud Console: agregar el redirect `https://skills.jelou.dev/api/auth/google/callback` y
   quitar el de `jelou-internal-hub`. Secretos: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
6. Panel: un miembro ve solo el catálogo (lectura) y "Conectar mi agente". Admin ve todo.

**Listo cuando:** un `@jelou.ai` entra y ve el catálogo, un `@gmail.com` es rechazado y el admin ve la
administración completa.

## Fase 3 — Keys personales ("Conectar mi agente")

1. `clients` gana `owner_email`. Perfil por defecto `jelou-lectura` (todas las skills, solo lectura);
   los autores reciben uno con permiso de propuesta.
2. Página "Conectar mi agente": el usuario pone un nombre ("MacBook"), y la página genera una key atada
   a su correo, lista sus keys (nombre, último uso) y le deja revocarlas. Tope: 5 activas por persona.
3. Además de la key, la página emite un **código de instalación de un solo uso** (vence en 10 minutos),
   que es lo que va en el comando. Así la key nunca queda en el historial del shell ni en una URL.
4. Admin: ve todas las keys con su dueño y puede revocar cualquiera.

## Fase 4 — Instalador de un solo comando

```sh
curl -fsSL https://skills.jelou.dev/install | sh -s -- <código>
```

1. `GET /install` sirve un `sh` corto: comprueba que haya `node` o `bun`, descarga `skillbox.mjs` y
   `package.mjs` a `~/.local/share/skillbox/` y ejecuta `skillbox setup <código>`.
2. `skillbox setup` (nuevo, en Node; **no** en Python: el Python del sistema en macOS no trae
   `tomllib`) hace lo que hoy hace `scripts/install-client.py`:
   - Canjea el código por la key → `~/.config/skillbox/config.json` (modo 0600).
   - Instala la skill `skills-library` en `~/.agents/skills/` y la enlaza en `~/.claude/skills/` y
     `~/.cursor/skills/`.
   - Registra el MCP en cada cliente que encuentre, usando el **puente stdio** con `SKILLBOX_CONFIG`
     (las apps de escritorio no heredan variables del shell, así que un env var no sirve):
     - Claude Code → `~/.claude.json` (lo lee también la pestaña Code de Claude Desktop).
     - Codex → `~/.codex/config.toml` (compartido por CLI, app de escritorio e IDE).
     - Cursor → `~/.cursor/mcp.json`.
   - Hace backup de cada archivo que toca y prueba la conexión (`tools/list` + `search_skills`).
   - Instala el comando `skillbox` en `~/.local/bin`.
3. Comandos nuevos del CLI:
   - `skillbox update`: vuelve a bajar el CLI y la skill `skills-library` desde el servidor.
   - `skillbox doctor`: revisa la key, la conexión y qué clientes están configurados.
   - `skillbox uninstall`: quita la configuración de los clientes y restaura los backups.

**Listo cuando:** en una Mac limpia, un `@jelou.ai` va del login a su primera skill cargada en Claude Code y
en Codex en menos de 2 minutos.

## Fase 5 — Publicar y actualizar skills

Lo que ya existe (no se toca):

- **CLI:** `skillbox publish ./carpeta id <revisión-actual|new>`. La revisión esperada evita pisar el
  cambio de otra persona.
- **MCP:** `upsert_skill` (quien tiene permiso de escritura) y `propose_skill_update` (autores).
- **Panel:** editor, historial, restaurar, revisión de propuestas.

Qué se agrega:

1. **Skill `skillbox-publisher`**, guardada en la propia biblioteca y visible solo para admin y autores.
   Le enseña al agente a:
   - validar la carpeta (`SKILL.md` con `name` y `description`, sin secretos, sin rutas absolutas);
   - `skillbox load <id>` para sacar la revisión actual, o `new` si la skill no existe;
   - publicar (admin) o proponer (autor) con un mensaje claro de qué cambió.

   No es obligatoria (las herramientas MCP ya permiten escribir), pero hace que todos publiquen igual y
   evita errores comunes.
2. **Carga inicial:** `bun scripts/import.ts` con las skills que se decidan (ver Decisiones pendientes).

Para quien consume las skills: **no hay nada que actualizar.** El agente lee la biblioteca en vivo. Solo
las skills bajadas con `skillbox fetch` (las que traen scripts) se refrescan con `skillbox fetch <id>`.

## Fase 6 (posterior) — Claude Desktop (chat) y claude.ai

Estos no pueden usar el MCP con key fija. Por ahora:

- `skillbox export --zip <id>` genera un ZIP por skill.
- Un owner de la organización de Claude lo sube en **Organization settings → Skills** y aparece para toda
  la org.
- Es una copia fija: cada cambio hay que volver a subirlo. Solo para las skills que valga la pena.

Más adelante: OAuth en skillbox (sobre el mismo login de Google) para agregarlo como conector propio.

## Operación

- **Backups:** snapshots diarios del volumen de Fly (14 días), más un `export` semanal de las skills a un repo privado.
- **Rotación:** cambiar `SKILLBOX_ADMIN_TOKEN` deja ilegibles las credenciales guardadas (ver
  `docs/deployment.md`); rotarlo solo a propósito.
- **Baja de una persona:** revocar sus keys desde el panel; su Google ya no entra al salir de Jelou.

## Decisiones pendientes

1. **Dominio:** ¿`skills.jelou.dev`?
2. **Carga inicial:** ¿qué skills entran primero? (¿las `jelou-*`?)
3. **Autores:** ¿quiénes arrancan con permiso de proponer?
4. **Owner de Claude:** ¿quién sube los ZIP en claude.ai si hacemos la Fase 6?
