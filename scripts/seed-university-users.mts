import { config as loadEnv } from 'dotenv'

const DEMO_PASSWORD = 'MorshidDemoP0!'

for (const path of ['server/.env', '.env', '../.env']) {
  loadEnv({ path })
}

const DEFAULT_ADMIN_EMAIL = 'admin@morshid.demo'

interface SeedUserSpec {
  email: string
  displayName: string
  role: 'STUDENT' | 'INSTRUCTOR'
}

interface SeedUniversity {
  id: string
  name: string
  code: string
}

interface SeedAdminUser {
  id: string
  universityId: string | null
  university: SeedUniversity | null
  ownedUniversity: SeedUniversity | null
}

interface SeededUser {
  id: string
}

interface SeedPrismaClient {
  user: {
    findUnique(input: unknown): Promise<SeedAdminUser | null>
    upsert(input: unknown): Promise<SeededUser>
  }
  university: {
    findUnique(input: unknown): Promise<SeedUniversity | null>
  }
  course: {
    findFirst(input: unknown): Promise<{ id: string } | null>
  }
  courseMembership: {
    upsert(input: unknown): Promise<unknown>
  }
  $disconnect(): Promise<void>
}

type SeedPrismaClientConstructor = new (options: {
  adapter: unknown
}) => SeedPrismaClient

function isPrismaClientModule(
  value: unknown,
): value is { PrismaClient: SeedPrismaClientConstructor } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'PrismaClient' in value &&
    typeof value.PrismaClient === 'function'
  )
}

export const SEEDED_50_USERS: readonly SeedUserSpec[] = [
  // 5 Instructors
  {
    email: 'demo.instructor01@morshid.demo',
    displayName: 'Dr. Khaled Al-Mansoor',
    role: 'INSTRUCTOR',
  },
  {
    email: 'demo.instructor02@morshid.demo',
    displayName: 'Dr. Mona El-Sayed',
    role: 'INSTRUCTOR',
  },
  {
    email: 'demo.instructor03@morshid.demo',
    displayName: 'Dr. Amr El-Gohary',
    role: 'INSTRUCTOR',
  },
  {
    email: 'demo.instructor04@morshid.demo',
    displayName: 'Dr. Salma Hegazy',
    role: 'INSTRUCTOR',
  },
  {
    email: 'demo.instructor05@morshid.demo',
    displayName: 'Dr. Tamer Shawkat',
    role: 'INSTRUCTOR',
  },
  // 45 Students
  {
    email: 'demo.student01@morshid.demo',
    displayName: 'Ahmed Hassan',
    role: 'STUDENT',
  },
  {
    email: 'demo.student02@morshid.demo',
    displayName: 'Fatima Al-Mansoor',
    role: 'STUDENT',
  },
  {
    email: 'demo.student03@morshid.demo',
    displayName: 'Omar Farooq',
    role: 'STUDENT',
  },
  {
    email: 'demo.student04@morshid.demo',
    displayName: 'Layla Mahmoud',
    role: 'STUDENT',
  },
  {
    email: 'demo.student05@morshid.demo',
    displayName: 'Karim Youssef',
    role: 'STUDENT',
  },
  {
    email: 'demo.student06@morshid.demo',
    displayName: 'Mariam Tarek',
    role: 'STUDENT',
  },
  {
    email: 'demo.student07@morshid.demo',
    displayName: 'Youssef Ibrahim',
    role: 'STUDENT',
  },
  {
    email: 'demo.student08@morshid.demo',
    displayName: 'Nour El-Din',
    role: 'STUDENT',
  },
  {
    email: 'demo.student09@morshid.demo',
    displayName: 'Salma Mostafa',
    role: 'STUDENT',
  },
  {
    email: 'demo.student10@morshid.demo',
    displayName: 'Ziad Adel',
    role: 'STUDENT',
  },
  {
    email: 'demo.student11@morshid.demo',
    displayName: 'Amina Khalil',
    role: 'STUDENT',
  },
  {
    email: 'demo.student12@morshid.demo',
    displayName: 'Khaled Nasser',
    role: 'STUDENT',
  },
  {
    email: 'demo.student13@morshid.demo',
    displayName: 'Sara Hamdy',
    role: 'STUDENT',
  },
  {
    email: 'demo.student14@morshid.demo',
    displayName: 'Amr Sherif',
    role: 'STUDENT',
  },
  {
    email: 'demo.student15@morshid.demo',
    displayName: 'Hoda Magdy',
    role: 'STUDENT',
  },
  {
    email: 'demo.student16@morshid.demo',
    displayName: 'Tarek Said',
    role: 'STUDENT',
  },
  {
    email: 'demo.student17@morshid.demo',
    displayName: 'Dina Kamel',
    role: 'STUDENT',
  },
  {
    email: 'demo.student18@morshid.demo',
    displayName: 'Mostafa Essam',
    role: 'STUDENT',
  },
  {
    email: 'demo.student19@morshid.demo',
    displayName: 'Reem Fouad',
    role: 'STUDENT',
  },
  {
    email: 'demo.student20@morshid.demo',
    displayName: 'Hassan Wagdy',
    role: 'STUDENT',
  },
  {
    email: 'demo.student21@morshid.demo',
    displayName: 'Yasmin Badr',
    role: 'STUDENT',
  },
  {
    email: 'demo.student22@morshid.demo',
    displayName: 'Ali Radwan',
    role: 'STUDENT',
  },
  {
    email: 'demo.student23@morshid.demo',
    displayName: 'Nadine Soliman',
    role: 'STUDENT',
  },
  {
    email: 'demo.student24@morshid.demo',
    displayName: 'Mohamed Shaker',
    role: 'STUDENT',
  },
  {
    email: 'demo.student25@morshid.demo',
    displayName: 'Farah Galal',
    role: 'STUDENT',
  },
  {
    email: 'demo.student26@morshid.demo',
    displayName: 'Sherif Helmy',
    role: 'STUDENT',
  },
  {
    email: 'demo.student27@morshid.demo',
    displayName: 'Hala Samir',
    role: 'STUDENT',
  },
  {
    email: 'demo.student28@morshid.demo',
    displayName: 'Ibrahim Ezzat',
    role: 'STUDENT',
  },
  {
    email: 'demo.student29@morshid.demo',
    displayName: 'Mona Zaher',
    role: 'STUDENT',
  },
  {
    email: 'demo.student30@morshid.demo',
    displayName: 'Mahmoud Ragab',
    role: 'STUDENT',
  },
  {
    email: 'demo.student31@morshid.demo',
    displayName: 'Rania Shawky',
    role: 'STUDENT',
  },
  {
    email: 'demo.student32@morshid.demo',
    displayName: 'Hesham Lotfy',
    role: 'STUDENT',
  },
  {
    email: 'demo.student33@morshid.demo',
    displayName: 'Lina Ashraf',
    role: 'STUDENT',
  },
  {
    email: 'demo.student34@morshid.demo',
    displayName: 'Bassem Fikry',
    role: 'STUDENT',
  },
  {
    email: 'demo.student35@morshid.demo',
    displayName: 'Nourhan Wael',
    role: 'STUDENT',
  },
  {
    email: 'demo.student36@morshid.demo',
    displayName: 'Seif Salem',
    role: 'STUDENT',
  },
  {
    email: 'demo.student37@morshid.demo',
    displayName: 'Malak Fayed',
    role: 'STUDENT',
  },
  {
    email: 'demo.student38@morshid.demo',
    displayName: 'Walid Sabry',
    role: 'STUDENT',
  },
  {
    email: 'demo.student39@morshid.demo',
    displayName: 'Habiba Emad',
    role: 'STUDENT',
  },
  {
    email: 'demo.student40@morshid.demo',
    displayName: 'Sameh Rasheed',
    role: 'STUDENT',
  },
  {
    email: 'demo.student41@morshid.demo',
    displayName: 'Menna Hazem',
    role: 'STUDENT',
  },
  {
    email: 'demo.student42@morshid.demo',
    displayName: 'Ehab Metwally',
    role: 'STUDENT',
  },
  {
    email: 'demo.student43@morshid.demo',
    displayName: 'Donia Mourad',
    role: 'STUDENT',
  },
  {
    email: 'demo.student44@morshid.demo',
    displayName: 'Haitham Refaat',
    role: 'STUDENT',
  },
  {
    email: 'demo.student45@morshid.demo',
    displayName: 'Jana Gabr',
    role: 'STUDENT',
  },
] as const

export async function seed50UniversityUsers(options?: {
  adminEmail?: string
  prisma?: SeedPrismaClient
}) {
  const adminEmail = options?.adminEmail ?? DEFAULT_ADMIN_EMAIL
  const localDatabaseUrl =
    'postgresql://morshid:morshid_local_password@localhost:5432/morshid'

  let prisma = options?.prisma
  if (prisma === undefined) {
    const { PrismaPg } = await import('@prisma/adapter-pg')
    const generatedClientPath = '../server/src/generated/prisma/client.js'
    const prismaClientModule: unknown = await import(generatedClientPath)
    if (!isPrismaClientModule(prismaClientModule)) {
      throw new Error('Generated Prisma client does not export PrismaClient.')
    }
    prisma = new prismaClientModule.PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL ?? localDatabaseUrl,
      }),
    })
  }

  const { createDeterministicArgon2idPasswordHash } =
    await import('../server/src/modules/identity/password-hasher.js')

  const shouldDisconnect = options?.prisma === undefined

  try {
    const admin = await prisma.user.findUnique({
      where: { email: adminEmail },
      include: {
        university: true,
        ownedUniversity: true,
      },
    })

    if (!admin) {
      throw new Error(`Admin user with email "${adminEmail}" was not found.`)
    }

    const universityId = admin.universityId ?? admin.ownedUniversity?.id

    if (universityId === undefined) {
      throw new Error(
        `Admin user "${adminEmail}" is not associated with any university.`,
      )
    }

    const university =
      admin.university ??
      admin.ownedUniversity ??
      (await prisma.university.findUnique({ where: { id: universityId } }))

    if (!university) {
      throw new Error(`University with ID "${universityId}" was not found.`)
    }

    console.log(
      `Found university "${university.name}" (${university.code}) for admin ${adminEmail}.`,
    )

    const pythonCourse = await prisma.course.findFirst({
      where: {
        universityId,
        code: 'PYTHON-PROG-P0',
      },
    })

    const seededUsers: SeededUser[] = []

    for (const spec of SEEDED_50_USERS) {
      const passwordSalt = `morshid-user-${spec.email}`
      const passwordHash = createDeterministicArgon2idPasswordHash(
        DEMO_PASSWORD,
        passwordSalt,
      )

      const user = await prisma.user.upsert({
        where: { email: spec.email },
        update: {
          displayName: spec.displayName,
          role: spec.role,
          status: 'ACTIVE',
          universityId,
          passwordHash,
          disabledAt: null,
          disabledById: null,
          lastLoginAt: null,
        },
        create: {
          email: spec.email,
          displayName: spec.displayName,
          role: spec.role,
          status: 'ACTIVE',
          universityId,
          passwordHash,
        },
      })

      seededUsers.push(user)

      if (pythonCourse) {
        await prisma.courseMembership.upsert({
          where: {
            courseId_userId: {
              courseId: pythonCourse.id,
              userId: user.id,
            },
          },
          update: {
            role: spec.role === 'INSTRUCTOR' ? 'INSTRUCTOR' : 'STUDENT',
            createdById: admin.id,
          },
          create: {
            courseId: pythonCourse.id,
            userId: user.id,
            role: spec.role === 'INSTRUCTOR' ? 'INSTRUCTOR' : 'STUDENT',
            createdById: admin.id,
          },
        })
      }
    }

    const instructorCount = SEEDED_50_USERS.filter(
      (u) => u.role === 'INSTRUCTOR',
    ).length
    const studentCount = SEEDED_50_USERS.filter(
      (u) => u.role === 'STUDENT',
    ).length

    console.log(
      `Successfully seeded ${seededUsers.length.toString()} users (${instructorCount.toString()} instructors, ${studentCount.toString()} students) into university "${university.name}" (${university.code}).`,
    )
    console.log(`Default password for all seeded users: ${DEMO_PASSWORD}`)

    return {
      university,
      users: seededUsers,
      totalCount: seededUsers.length,
      instructorCount,
      studentCount,
    }
  } finally {
    if (shouldDisconnect) {
      await prisma.$disconnect()
    }
  }
}

async function main() {
  const adminEmail = process.argv[2] ?? DEFAULT_ADMIN_EMAIL
  await seed50UniversityUsers({ adminEmail })
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith('seed-university-users.mts') ||
    process.argv[1].endsWith('seed-university-users.mjs'))
) {
  void main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
}
