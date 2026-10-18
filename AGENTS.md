# AI Agent Instructions for regional-specialties-be

## Project overview
- Backend API server written in TypeScript using Express.
- Uses Node.js, Yarn, MySQL, multer, bcrypt, jsonwebtoken, node-cron, nodemailer.
- Entry point: `src/server.ts`.
- Source files live in `src/`; compiled output is `dist/`.
- This repo is backend-only; do not add frontend work here.

## Key directories
- `src/routes/` - route definitions and router wiring.
- `src/controllers/` - request handlers and business logic.
- `src/model/` - database model objects.
- `src/middlewares/` - authentication and admin authorization.
- `src/database.ts` - database connection and `testConnection()`.
- `src/email.service.ts` - email sending logic.
- `upload/` and `public/avatars/` - served as static asset folders.

## Run and build commands
- Install dependencies: `yarn`
- Start in development: `yarn dev`
- Compile TypeScript: `yarn build`
- Run production build: `yarn start`

## Important conventions
- The project uses CommonJS module semantics in TypeScript.
- TypeScript config is strict: `strict`, `noImplicitAny`, `strictNullChecks`.
- Keep new source files under `src/` and maintain the existing routing/controller pattern.
- Environment values come from `.env` for database/mailer/auth; do not hardcode secrets.
- Static files are served from `upload/` and `public/avatars/`.
- CORS is restricted to known origins listed in `src/server.ts`; changes should be intentional.
- Logging middleware and debug `console.log` statements are already in place; preserve or improve them carefully.

## What an agent should do first
1. Review `src/server.ts` to understand route mounting and middleware order.
2. Use `README.md` for install/run expectations.
3. Preserve existing patterns for controllers, routes, and models.
4. Prefer incremental fixes over broad refactors unless asked.

## Notes for tasks
- If adding or fixing endpoints, update the matching route file in `src/routes/` and controller in `src/controllers/`.
- For database changes, inspect/modify `src/database.ts` and related model files.
- When adding new types or interfaces, keep them close to the module that uses them.
- Avoid changing the package manager or build workflow unless the user explicitly asks.

## References
- Project README: `README.md`
