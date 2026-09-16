import { PrismaClient, Role, QuestionType } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "demo1234";

async function ensureAuthUser(
  admin: ReturnType<typeof createClient>,
  email: string,
  fullName: string,
  role: Role
) {
  // Try find by listing (free tier) — create if missing
  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = listed?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });
    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });

  if (error || !data.user) {
    throw new Error(`No se pudo crear Auth user ${email}: ${error?.message}`);
  }
  return data.user.id;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey || url.includes("placeholder")) {
    console.warn(
      "⚠️  SUPABASE no configurado (URL/SERVICE_ROLE_KEY). Se sembrará solo la DB local sin crear usuarios Auth.\n" +
        "   Configure .env y vuelva a ejecutar: npm run db:seed"
    );
  }

  let adminAuth: ReturnType<typeof createClient> | null = null;
  if (url && serviceKey && !url.includes("placeholder")) {
    adminAuth = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  // Clean slate for demo school data (keep if re-seeding carefully)
  await prisma.answerGrade.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.testAttempt.deleteMany();
  await prisma.option.deleteMany();
  await prisma.question.deleteMany();
  await prisma.test.deleteMany();
  await prisma.material.deleteMany();
  await prisma.teacherSubject.deleteMany();
  await prisma.studentGroup.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.group.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.user.deleteMany();
  await prisma.school.deleteMany();

  const school = await prisma.school.create({
    data: { name: "Colegio San Marcos" },
  });

  const usersDef: { email: string; fullName: string; role: Role }[] = [
    { email: "admin@colegio.demo", fullName: "Ana Administradora", role: "ADMINISTRADOR" },
    { email: "profesor@colegio.demo", fullName: "Pedro Profesor", role: "PROFESOR" },
    { email: "alumno@colegio.demo", fullName: "Laura Alumna", role: "ALUMNO" },
  ];

  const createdUsers: Record<string, string> = {};

  for (const u of usersDef) {
    let supabaseId = `local-${u.email}`;
    if (adminAuth) {
      supabaseId = await ensureAuthUser(adminAuth, u.email, u.fullName, u.role);
    }
    const dbUser = await prisma.user.create({
      data: {
        supabaseId,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        schoolId: school.id,
      },
    });
    createdUsers[u.role] = dbUser.id;
    console.log(`✓ Usuario ${u.email} (${u.role})`);
  }

  const g1 = await prisma.grade.create({
    data: { name: "1° Secundaria", level: 7, schoolId: school.id },
  });
  const g2 = await prisma.grade.create({
    data: { name: "2° Secundaria", level: 8, schoolId: school.id },
  });

  const groupA = await prisma.group.create({ data: { name: "A", gradeId: g1.id } });
  await prisma.group.create({ data: { name: "B", gradeId: g1.id } });
  await prisma.group.create({ data: { name: "A", gradeId: g2.id } });

  const mat = await prisma.subject.create({
    data: { name: "Matemáticas", code: "MAT", schoolId: school.id, gradeId: g1.id },
  });
  const lit = await prisma.subject.create({
    data: { name: "Lengua Española", code: "LEN", schoolId: school.id, gradeId: g1.id },
  });
  const cie = await prisma.subject.create({
    data: { name: "Ciencias Naturales", code: "CIE", schoolId: school.id, gradeId: g1.id },
  });

  await prisma.teacherSubject.create({
    data: {
      teacherId: createdUsers.PROFESOR,
      subjectId: mat.id,
      groupId: groupA.id,
    },
  });
  await prisma.teacherSubject.create({
    data: {
      teacherId: createdUsers.PROFESOR,
      subjectId: lit.id,
      groupId: groupA.id,
    },
  });

  await prisma.studentGroup.create({
    data: { studentId: createdUsers.ALUMNO, groupId: groupA.id },
  });

  // Sample published test
  await prisma.test.create({
    data: {
      title: "Quiz de fracciones",
      description: "Examen de práctica — Matemáticas",
      subjectId: mat.id,
      groupId: groupA.id,
      creatorId: createdUsers.PROFESOR,
      published: true,
      maxScore: 100,
      questions: {
        create: [
          {
            prompt: "¿Cuánto es 1/2 + 1/4?",
            type: QuestionType.MULTIPLE_CHOICE,
            points: 2,
            order: 0,
            options: {
              create: [
                { text: "3/4", isCorrect: true, order: 0 },
                { text: "1/4", isCorrect: false, order: 1 },
                { text: "2/4", isCorrect: false, order: 2 },
                { text: "1/8", isCorrect: false, order: 3 },
              ],
            },
          },
          {
            prompt: "Escriba el nombre del número 0.5 como fracción irreducible",
            type: QuestionType.SHORT_ANSWER,
            points: 2,
            order: 1,
            correctText: "1/2",
          },
          {
            prompt: "Explique con sus palabras qué es una fracción propia.",
            type: QuestionType.LONG_ANSWER,
            points: 3,
            order: 2,
          },
        ],
      },
    },
  });

  console.log("\n✅ Seed completado — Colegio San Marcos");
  console.log("   admin@colegio.demo / demo1234");
  console.log("   profesor@colegio.demo / demo1234");
  console.log("   alumno@colegio.demo / demo1234");
  if (!adminAuth) {
    console.log("\n⚠️  Auth de Supabase no se pobló. Configure .env y re-ejecute el seed.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
