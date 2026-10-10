import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
const pool = (key: string) =>
  postgres(process.env[key] || "postgresql://unconfigured:unconfigured@127.0.0.1:5432/showtime", {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
  });
export const appSql = pool("APP_DATABASE_URL");
export const authSql = pool("AUTH_DATABASE_URL");
export const workerSql = pool("WORKER_DATABASE_URL");
export const controlSql = pool("CONTROL_DATABASE_URL");
export const appDatabase = drizzle(appSql, { schema });
export const authDb = drizzle(authSql, { schema });
export const workerDb = drizzle(workerSql, { schema });
export const controlDb = drizzle(controlSql, { schema });
