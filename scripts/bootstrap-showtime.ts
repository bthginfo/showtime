import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { parseEnv } from "node:util";
const environment = process.argv[2] || "development";
const runtime = JSON.parse(fs.readFileSync(`.local/runtime-${environment}.json`, "utf8"));
Object.assign(process.env, runtime);
const { auth } = await import("../src/platform/auth");
const { authDb, controlDb, authSql, controlSql, appSql, workerSql } =
  await import("../src/platform/db/connections");
const { platformAdmins, user, permissionGrants } = await import("../src/platform/db/schema");
const { createTenant } = await import("../src/modules/theater/tenants");
const { eq } = await import("drizzle-orm");
const loginPath = `.local/access-${environment}.json`;
const access = fs.existsSync(loginPath)
  ? JSON.parse(fs.readFileSync(loginPath, "utf8"))
  : { username: "showtime-admin", password: randomBytes(20).toString("base64url") };
try {
  let [person] = await authDb
    .select()
    .from(user)
    .where(eq(user.username, access.username))
    .limit(1);
  if (!person) {
    const result = await auth.api.signUpEmail({
      body: {
        username: access.username,
        email: `${access.username}@showtime.invalid`,
        name: "Showtime Administration",
        password: access.password,
      },
    });
    person = result.user as typeof person;
  }
  await controlDb.insert(platformAdmins).values({ userId: person.id }).onConflictDoNothing();
  const { organizations } = await import("../src/platform/db/schema");
  const [existing] = await controlDb.select().from(organizations).limit(1);
  if (!existing) {
    const tenant = await createTenant(
      {
        name: environment === "production" ? "Mein Theater" : "Showtime Testtheater",
        slug: environment === "production" ? "mein-theater" : "testtheater",
      },
      person.id,
    );
    access.organizationId = tenant.id;
    access.departments = tenant.departments;
    // These are explicit theater grants for the bootstrap owner, distinct from platform privileges.
    await controlDb
      .insert(permissionGrants)
      .values(
        ["production_lead", "disposition", "technical_lead", "intendance", "personnel"].map(
          (role) => ({
            organizationId: tenant.id,
            userId: person.id,
            role: role as never,
            scope: "tenant" as const,
            scopeId: null,
          }),
        ),
      );
  }
  if (access.organizationId) {
    const { seedTenantDefaults } = await import("../src/modules/theater/defaults");
    await seedTenantDefaults(access.organizationId, person.id);
  }
  fs.writeFileSync(loginPath, JSON.stringify({ ...access, userId: person.id }, null, 2));
  console.log(JSON.stringify({ environment, bootstrapped: true, credentialsFile: loginPath }));
} finally {
  await Promise.all([authSql.end(), controlSql.end(), appSql.end(), workerSql.end()]);
}
