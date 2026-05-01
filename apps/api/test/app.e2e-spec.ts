import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, HttpStatus } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { globalValidationPipe } from "../src/common/pipes/validation.pipe";
import * as argon2 from "argon2";
import { Role } from "@prisma/client";

describe("MyAllocator CMS API (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testSuperAdmin = {
    email: "superadmin@test.com",
    password: "TestPassword123!",
    role: Role.SUPER_ADMIN,
  };

  const testAdmin = {
    email: "admin@test.com",
    password: "TestPassword123!",
    role: Role.ADMIN,
  };

  const testEditor = {
    email: "editor@test.com",
    password: "TestPassword123!",
    role: Role.EDITOR,
  };

  let superAdminToken: string;
  let adminToken: string;
  let editorToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(globalValidationPipe);
    await app.init();

    prisma = app.get(PrismaService);

    // Clean up test data
    await prisma.pageVersion.deleteMany({});
    await prisma.page.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({});

    // Seed test users
    const passwordHash = await argon2.hash(testSuperAdmin.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await prisma.user.createMany({
      data: [
        {
          email: testSuperAdmin.email,
          passwordHash,
          role: testSuperAdmin.role,
        },
        {
          email: testAdmin.email,
          passwordHash,
          role: testAdmin.role,
        },
        {
          email: testEditor.email,
          passwordHash,
          role: testEditor.role,
        },
      ],
    });
  });

  afterAll(async () => {
    // Clean up
    await prisma.pageVersion.deleteMany({});
    await prisma.page.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({});
    await app.close();
  });

  // ─── Health ──────────────────────────────────────────────

  describe("GET /health", () => {
    it("should return health status", async () => {
      const res = await request(app.getHttpServer())
        .get("/health")
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty("status", "ok");
      expect(res.body).toHaveProperty("uptime");
      expect(res.body).toHaveProperty("dbConnected", true);
      expect(res.body).toHaveProperty("timestamp");
    });
  });

  // ─── Auth ────────────────────────────────────────────────

  describe("POST /auth/login", () => {
    it("should login super admin successfully", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: testSuperAdmin.email,
          password: testSuperAdmin.password,
        })
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty("accessToken");
      expect(res.body.user).toHaveProperty("email", testSuperAdmin.email);
      expect(res.body.user).toHaveProperty("role", "SUPER_ADMIN");
      superAdminToken = res.body.accessToken;
    });

    it("should login admin successfully", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: testAdmin.email, password: testAdmin.password })
        .expect(HttpStatus.OK);

      adminToken = res.body.accessToken;
    });

    it("should login editor successfully", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: testEditor.email, password: testEditor.password })
        .expect(HttpStatus.OK);

      editorToken = res.body.accessToken;
    });

    it("should return 401 for wrong password", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: testSuperAdmin.email, password: "WrongPassword1!" })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(res.body.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 for non-existent email", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "nobody@test.com", password: "SomePassword1!" })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(res.body.code).toBe("UNAUTHORIZED");
    });

    it("should return 400 for invalid request body", async () => {
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "not-an-email", password: "123" })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe("POST /auth/refresh", () => {
    it("should refresh access token with valid cookie", async () => {
      // First login to get refresh cookie
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: testSuperAdmin.email,
          password: testSuperAdmin.password,
        })
        .expect(HttpStatus.OK);

      const cookies = loginRes.headers["set-cookie"];
      expect(cookies).toBeDefined();

      const res = await request(app.getHttpServer())
        .post("/auth/refresh")
        .set("Cookie", cookies as unknown as string[])
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty("accessToken");
    });

    it("should return 401 without refresh cookie", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/refresh")
        .expect(HttpStatus.UNAUTHORIZED);

      expect(res.body.code).toBe("TOKEN_EXPIRED");
    });
  });

  describe("POST /auth/logout", () => {
    it("should logout successfully", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/logout")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty("message", "Logged out successfully");
    });

    it("should return 401 without token", async () => {
      await request(app.getHttpServer())
        .post("/auth/logout")
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  // Re-login after logout tests
  beforeAll(async () => {
    // This will be called after the describe blocks' beforeAll
  });

  // ─── Users (SUPER_ADMIN only) ───────────────────────────

  describe("Users CRUD", () => {
    let createdUserId: string;

    beforeAll(async () => {
      // Re-login super admin
      const res = await request(app.getHttpServer()).post("/auth/login").send({
        email: testSuperAdmin.email,
        password: testSuperAdmin.password,
      });
      superAdminToken = res.body.accessToken;
    });

    it("GET /users — should list users (SUPER_ADMIN)", async () => {
      const res = await request(app.getHttpServer())
        .get("/users")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("total");
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("GET /users — should return 403 for EDITOR", async () => {
      // Re-login editor
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: testEditor.email, password: testEditor.password });
      editorToken = loginRes.body.accessToken;

      await request(app.getHttpServer())
        .get("/users")
        .set("Authorization", `Bearer ${editorToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it("POST /users — should create user (SUPER_ADMIN)", async () => {
      const res = await request(app.getHttpServer())
        .post("/users")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          email: "newuser@test.com",
          password: "NewUserPass1!",
          role: "EDITOR",
        })
        .expect(HttpStatus.CREATED);

      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("email", "newuser@test.com");
      createdUserId = res.body.id;
    });

    it("POST /users — should return 409 for duplicate email", async () => {
      const res = await request(app.getHttpServer())
        .post("/users")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          email: "newuser@test.com",
          password: "AnotherPass1!",
          role: "EDITOR",
        })
        .expect(HttpStatus.CONFLICT);

      expect(res.body.code).toBe("CONFLICT");
    });

    it("PATCH /users/:id — should update user", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/${createdUserId}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ email: "updated@test.com" })
        .expect(HttpStatus.OK);

      expect(res.body.email).toBe("updated@test.com");
    });

    it("DELETE /users/:id — should delete user", async () => {
      const res = await request(app.getHttpServer())
        .delete(`/users/${createdUserId}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty("message", "User deleted");
    });

    it("DELETE /users/:id — cannot delete own account", async () => {
      const currentUser = await prisma.user.findUnique({
        where: { email: testSuperAdmin.email },
      });

      const res = await request(app.getHttpServer())
        .delete(`/users/${currentUser!.id}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  // ─── Pages ───────────────────────────────────────────────

  describe("Pages CRUD", () => {
    const testPage = {
      slug: "test-page",
      locale: "en",
      title: "Test Page",
      puckData: { content: [], root: { title: "Test" } },
      seoTitle: "Test SEO Title",
      seoDescription: "Test SEO Description",
    };

    beforeAll(async () => {
      // Re-login tokens
      let res = await request(app.getHttpServer()).post("/auth/login").send({
        email: testSuperAdmin.email,
        password: testSuperAdmin.password,
      });
      superAdminToken = res.body.accessToken;

      res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: testAdmin.email, password: testAdmin.password });
      adminToken = res.body.accessToken;

      res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: testEditor.email, password: testEditor.password });
      editorToken = res.body.accessToken;
    });

    it("POST /pages — should create page (EDITOR)", async () => {
      const res = await request(app.getHttpServer())
        .post("/pages")
        .set("Authorization", `Bearer ${editorToken}`)
        .send(testPage)
        .expect(HttpStatus.CREATED);

      expect(res.body).toHaveProperty("slug", "test-page");
      expect(res.body).toHaveProperty("locale", "en");
      expect(res.body).toHaveProperty("title", "Test Page");
      expect(res.body).toHaveProperty("puckData");
      expect(res.body).toHaveProperty("published", false);
    });

    it("POST /pages — should return 409 for duplicate slug+locale", async () => {
      const res = await request(app.getHttpServer())
        .post("/pages")
        .set("Authorization", `Bearer ${editorToken}`)
        .send(testPage)
        .expect(HttpStatus.CONFLICT);

      expect(res.body.code).toBe("CONFLICT");
    });

    it("GET /pages — should list pages (authenticated)", async () => {
      const res = await request(app.getHttpServer())
        .get("/pages")
        .set("Authorization", `Bearer ${editorToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("total");
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it("GET /pages/:slug — should get page by slug", async () => {
      const res = await request(app.getHttpServer())
        .get("/pages/test-page?locale=en")
        .set("Authorization", `Bearer ${editorToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty("slug", "test-page");
      expect(res.body).toHaveProperty("puckData");
    });

    it("PUT /pages/:slug — should update page", async () => {
      const res = await request(app.getHttpServer())
        .put("/pages/test-page?locale=en")
        .set("Authorization", `Bearer ${editorToken}`)
        .send({
          title: "Updated Test Page",
          puckData: {
            content: [{ type: "Hero", props: {} }],
            root: { title: "Updated" },
          },
        })
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty("title", "Updated Test Page");
    });

    it("POST /pages/:slug/publish — should publish page (ADMIN)", async () => {
      const res = await request(app.getHttpServer())
        .post("/pages/test-page/publish?locale=en")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty("message", "Page published");
    });

    it("POST /pages/:slug/publish — EDITOR should be forbidden", async () => {
      await request(app.getHttpServer())
        .post("/pages/test-page/publish?locale=en")
        .set("Authorization", `Bearer ${editorToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it("GET /pages/:slug?published=true — public access to published page", async () => {
      const res = await request(app.getHttpServer())
        .get("/pages/test-page?locale=en&published=true")
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty("slug", "test-page");
      expect(res.body).toHaveProperty("published", true);
    });

    it("GET /pages/:slug/preview — should return preview data", async () => {
      const res = await request(app.getHttpServer())
        .get("/pages/test-page/preview?locale=en")
        .set("Authorization", `Bearer ${editorToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty("slug", "test-page");
      expect(res.body).toHaveProperty("puckData");
    });

    it("POST /pages/:slug/unpublish — should unpublish page", async () => {
      const res = await request(app.getHttpServer())
        .post("/pages/test-page/unpublish?locale=en")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty("message", "Page unpublished");
    });

    // ─── Versions ──────────────────────────────────────────

    it("GET /pages/:slug/versions — should return version history", async () => {
      const res = await request(app.getHttpServer())
        .get("/pages/test-page/versions?locale=en")
        .set("Authorization", `Bearer ${editorToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("total");
      expect(res.body.data.length).toBeGreaterThanOrEqual(2); // initial + update
    });

    it("POST /pages/:slug/versions/:id/restore — ADMIN can restore", async () => {
      // Get versions
      const versionsRes = await request(app.getHttpServer())
        .get("/pages/test-page/versions?locale=en")
        .set("Authorization", `Bearer ${adminToken}`);

      const firstVersionId =
        versionsRes.body.data[versionsRes.body.data.length - 1].id;

      const res = await request(app.getHttpServer())
        .post(`/pages/test-page/versions/${firstVersionId}/restore?locale=en`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty("slug", "test-page");
    });

    it("POST /pages/:slug/versions/:id/restore — EDITOR should be forbidden", async () => {
      const versionsRes = await request(app.getHttpServer())
        .get("/pages/test-page/versions?locale=en")
        .set("Authorization", `Bearer ${editorToken}`);

      const versionId = versionsRes.body.data[0].id;

      await request(app.getHttpServer())
        .post(`/pages/test-page/versions/${versionId}/restore?locale=en`)
        .set("Authorization", `Bearer ${editorToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    // ─── Delete Page ───────────────────────────────────────

    it("DELETE /pages/:slug — EDITOR should be forbidden", async () => {
      await request(app.getHttpServer())
        .delete("/pages/test-page?locale=en")
        .set("Authorization", `Bearer ${editorToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it("DELETE /pages/:slug — ADMIN can delete", async () => {
      const res = await request(app.getHttpServer())
        .delete("/pages/test-page?locale=en")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty("message", "Page deleted");
    });

    it("GET /pages/:slug — should return 404 after deletion", async () => {
      await request(app.getHttpServer())
        .get("/pages/test-page?locale=en")
        .set("Authorization", `Bearer ${editorToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  // ─── Validation ──────────────────────────────────────────

  describe("Input Validation", () => {
    it("should reject invalid slug format", async () => {
      // Re-login
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: testEditor.email, password: testEditor.password });
      editorToken = loginRes.body.accessToken;

      const res = await request(app.getHttpServer())
        .post("/pages")
        .set("Authorization", `Bearer ${editorToken}`)
        .send({
          slug: "Invalid Slug!!",
          locale: "en",
          title: "Test",
          puckData: {},
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("should reject invalid locale", async () => {
      await request(app.getHttpServer())
        .post("/pages")
        .set("Authorization", `Bearer ${editorToken}`)
        .send({
          slug: "valid-slug",
          locale: "xx",
          title: "Test",
          puckData: {},
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it("should reject extra fields (forbidNonWhitelisted)", async () => {
      await request(app.getHttpServer())
        .post("/pages")
        .set("Authorization", `Bearer ${editorToken}`)
        .send({
          slug: "valid-slug",
          locale: "en",
          title: "Test",
          puckData: {},
          hackerField: "malicious",
        })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });
});
