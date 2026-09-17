import {
  AdminRoleCode,
  PriceType,
  Prisma,
  PrismaClient,
  UserType,
} from '@prisma/client';
import * as argon2 from 'argon2';
import {
  ACCOUNTING_PERMISSION_CODES,
  ADMIN_PERMISSION_CODES,
  CUSTOMER_MANAGER_PERMISSION_CODES,
  ORDER_MANAGER_PERMISSION_CODES,
  PRODUCT_MANAGER_PERMISSION_CODES,
} from '../src/modules/admin/constants/permissions';

const prisma = new PrismaClient();

async function assignRolePermissions(
  roleCode: AdminRoleCode,
  codes: readonly string[],
  permissionByCode: Map<string, { id: string }>,
): Promise<void> {
  const role = await prisma.adminRole.findUniqueOrThrow({
    where: { code: roleCode },
  });
  for (const code of codes) {
    const permission = permissionByCode.get(code);
    if (!permission) continue;
    await prisma.adminRolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
  }
}

async function ensureRbacCatalog(): Promise<void> {
  for (const code of ADMIN_PERMISSION_CODES) {
    await prisma.adminPermission.upsert({
      where: { code },
      update: {},
      create: { code, description: code },
    });
  }

  for (const code of Object.values(AdminRoleCode)) {
    await prisma.adminRole.upsert({
      where: { code },
      update: {},
      create: { code, description: code },
    });
  }

  const permissions = await prisma.adminPermission.findMany();
  const permissionByCode = new Map(permissions.map((p) => [p.code, p]));

  const superAdmin = await prisma.adminRole.findUniqueOrThrow({
    where: { code: AdminRoleCode.SUPER_ADMIN },
  });
  for (const permission of permissions) {
    await prisma.adminRolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdmin.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: { roleId: superAdmin.id, permissionId: permission.id },
    });
  }

  await assignRolePermissions(
    AdminRoleCode.PRODUCT_MANAGER,
    PRODUCT_MANAGER_PERMISSION_CODES,
    permissionByCode,
  );
  await assignRolePermissions(
    AdminRoleCode.ORDER_MANAGER,
    ORDER_MANAGER_PERMISSION_CODES,
    permissionByCode,
  );
  await assignRolePermissions(
    AdminRoleCode.ACCOUNTING,
    ACCOUNTING_PERMISSION_CODES,
    permissionByCode,
  );
  await assignRolePermissions(
    AdminRoleCode.CUSTOMER_MANAGER,
    CUSTOMER_MANAGER_PERMISSION_CODES,
    permissionByCode,
  );
}

async function seedAdminWithRole(
  emailEnv: string,
  passwordEnv: string,
  roleCode: AdminRoleCode,
  firstName: string,
): Promise<void> {
  const email = process.env[emailEnv]?.trim().toLowerCase();
  const password = process.env[passwordEnv];
  if (!email || !password) {
    console.log(
      `Skipping ${roleCode} user seed (set ${emailEnv} and ${passwordEnv} to enable).`,
    );
    return;
  }
  if (password.length < 8) {
    throw new Error(`${passwordEnv} must be at least 8 characters`);
  }

  const passwordHash = await argon2.hash(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, firstName, lastName: 'Admin' },
    create: {
      email,
      passwordHash,
      firstName,
      lastName: 'Admin',
      userType: UserType.INDIVIDUAL,
    },
  });

  const role = await prisma.adminRole.findUniqueOrThrow({
    where: { code: roleCode },
  });
  const adminUser = await prisma.adminUser.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });
  await prisma.adminUserRole.upsert({
    where: {
      adminUserId_roleId: { adminUserId: adminUser.id, roleId: role.id },
    },
    update: {},
    create: { adminUserId: adminUser.id, roleId: role.id },
  });
  console.log(`${roleCode} ensured for ${email}`);
}

async function seedAdmins(): Promise<void> {
  await seedAdminWithRole(
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD',
    AdminRoleCode.SUPER_ADMIN,
    'Super',
  );
  await seedAdminWithRole(
    'E2E_PRODUCT_MANAGER_EMAIL',
    'E2E_PRODUCT_MANAGER_PASSWORD',
    AdminRoleCode.PRODUCT_MANAGER,
    'PM',
  );
  await seedAdminWithRole(
    'E2E_ACCOUNTING_EMAIL',
    'E2E_ACCOUNTING_PASSWORD',
    AdminRoleCode.ACCOUNTING,
    'Acc',
  );
}

async function upsertCategory(data: {
  name: string;
  slug: string;
  parentId?: string;
  sortOrder: number;
}) {
  return prisma.category.upsert({
    where: { slug: data.slug },
    update: {
      name: data.name,
      parentId: data.parentId,
      sortOrder: data.sortOrder,
      active: true,
    },
    create: {
      name: data.name,
      slug: data.slug,
      parentId: data.parentId,
      sortOrder: data.sortOrder,
      active: true,
    },
  });
}

async function seedCatalog(): Promise<void> {
  const klima = await upsertCategory({
    name: 'Klima',
    slug: 'klima',
    sortOrder: 1,
  });
  const split = await upsertCategory({
    name: 'Split Klima',
    slug: 'split-klima',
    parentId: klima.id,
    sortOrder: 1,
  });
  await upsertCategory({
    name: 'Salon Tipi Klima',
    slug: 'salon-tipi-klima',
    parentId: klima.id,
    sortOrder: 2,
  });
  await upsertCategory({
    name: 'Kaset Tipi Klima',
    slug: 'kaset-tipi-klima',
    parentId: klima.id,
    sortOrder: 3,
  });

  const spare = await upsertCategory({
    name: 'Yedek Parça',
    slug: 'yedek-parca',
    sortOrder: 2,
  });
  const spareParts = await upsertCategory({
    name: 'Klima Parçaları',
    slug: 'klima-parcalari',
    parentId: spare.id,
    sortOrder: 1,
  });
  await upsertCategory({
    name: 'Kompresör',
    slug: 'kompresor',
    parentId: spare.id,
    sortOrder: 2,
  });
  await upsertCategory({
    name: 'Fan Motoru',
    slug: 'fan-motoru',
    parentId: spare.id,
    sortOrder: 3,
  });

  const brands = [
    { name: 'Arçelik', slug: 'arcelik' },
    { name: 'Beko', slug: 'beko' },
    { name: 'Vestel', slug: 'vestel' },
    { name: 'Bosch', slug: 'bosch' },
    { name: 'Daikin', slug: 'daikin' },
    { name: 'Mitsubishi Electric', slug: 'mitsubishi-electric' },
  ];

  const brandRecords = [];
  for (const brand of brands) {
    brandRecords.push(
      await prisma.brand.upsert({
        where: { slug: brand.slug },
        update: { name: brand.name, active: true },
        create: { ...brand, active: true },
      }),
    );
  }

  const arcelik = brandRecords.find((b) => b.slug === 'arcelik')!;
  const daikin = brandRecords.find((b) => b.slug === 'daikin')!;
  const vestel = brandRecords.find((b) => b.slug === 'vestel')!;

  await seedProduct({
    sku: 'SKU-SPLIT-12000',
    barcode: '8690000001200',
    name: '12.000 BTU Split Klima',
    slug: '12000-btu-split-klima',
    description: 'Enerji verimli split klima ünitesi.',
    brandId: arcelik.id,
    categoryId: split.id,
    vatRate: 20,
    attributes: [
      { name: 'Soğutma Kapasitesi', value: '12000 BTU', sortOrder: 1 },
      { name: 'Gaz Tipi', value: 'R32', sortOrder: 2 },
      { name: 'Voltaj', value: '220V', sortOrder: 3 },
    ],
    images: [
      {
        url: 'https://cdn.furkansogutma.local/dev/split-12000-1.jpg',
        alt: 'Split klima ön görünüm',
        sortOrder: 1,
        isPrimary: true,
      },
    ],
    compatibility: [
      {
        manufacturer: 'Arçelik',
        model: '12325',
        modelYear: 2024,
      },
    ],
  });

  await seedProduct({
    sku: 'SKU-DAIKIN-18000',
    barcode: '8690000001800',
    name: '18.000 BTU Daikin Split',
    slug: '18000-btu-daikin-split',
    description: 'Yüksek performanslı split klima.',
    brandId: daikin.id,
    categoryId: split.id,
    vatRate: 20,
    attributes: [
      { name: 'Soğutma Kapasitesi', value: '18000 BTU', sortOrder: 1 },
      { name: 'Gaz Tipi', value: 'R32', sortOrder: 2 },
    ],
    images: [
      {
        url: 'https://cdn.furkansogutma.local/dev/daikin-18000.jpg',
        isPrimary: true,
        sortOrder: 1,
      },
    ],
    compatibility: [{ manufacturer: 'Daikin', model: 'FTXM50' }],
  });

  await seedProduct({
    sku: 'SKU-FAN-001',
    barcode: '8690000003001',
    name: 'Klima Fan Motoru',
    slug: 'klima-fan-motoru',
    description: 'Evrensel fan motoru yedek parçası.',
    brandId: vestel.id,
    categoryId: spareParts.id,
    vatRate: 20,
    attributes: [{ name: 'Voltaj', value: '220V', sortOrder: 1 }],
    images: [
      {
        url: 'https://cdn.furkansogutma.local/dev/fan-motor.jpg',
        isPrimary: true,
        sortOrder: 1,
      },
    ],
    compatibility: [
      { manufacturer: 'Vestel', model: 'XYZ123' },
      { manufacturer: 'Beko', model: 'BKO-FAN-9' },
    ],
  });

  console.log('Catalog seed data ensured');
}

async function seedProduct(input: {
  sku: string;
  barcode: string;
  name: string;
  slug: string;
  description: string;
  brandId: string;
  categoryId: string;
  vatRate: number;
  attributes: { name: string; value: string; sortOrder: number }[];
  images: {
    url: string;
    alt?: string;
    sortOrder: number;
    isPrimary: boolean;
  }[];
  compatibility: {
    manufacturer: string;
    model: string;
    modelYear?: number;
  }[];
}): Promise<void> {
  const existing = await prisma.product.findUnique({
    where: { sku: input.sku },
  });
  if (existing) {
    return;
  }

  await prisma.product.create({
    data: {
      sku: input.sku,
      barcode: input.barcode,
      name: input.name,
      slug: input.slug,
      description: input.description,
      brandId: input.brandId,
      categoryId: input.categoryId,
      vatRate: new Prisma.Decimal(input.vatRate),
      active: true,
      attributes: { create: input.attributes },
      images: { create: input.images },
      compatibility: { create: input.compatibility },
      inventory: {
        create: {
          quantity: 20,
          reservedQuantity: 0,
          minimumQuantity: 5,
        },
      },
      prices: {
        create: [
          {
            type: PriceType.RETAIL,
            price: new Prisma.Decimal('1000.00'),
            currency: 'TRY',
            active: true,
          },
          {
            type: PriceType.CAMPAIGN,
            price: new Prisma.Decimal('900.00'),
            currency: 'TRY',
            active: true,
          },
          {
            type: PriceType.WHOLESALE,
            price: new Prisma.Decimal('800.00'),
            currency: 'TRY',
            active: true,
          },
          {
            type: PriceType.CORPORATE,
            price: new Prisma.Decimal('750.00'),
            currency: 'TRY',
            active: true,
          },
        ],
      },
    },
  });
}

async function seedBankAccounts(): Promise<void> {
  const accounts = [
    {
      bankName: 'Ziraat Bankası',
      accountName: 'Furkan Soğutma',
      iban: 'TR330006100519786457841326',
      branch: 'Merkez',
      sortOrder: 1,
      description: 'Havale/EFT için ana hesap',
    },
    {
      bankName: 'İş Bankası',
      accountName: 'Furkan Soğutma',
      iban: 'TR120006400000111111111111',
      branch: 'Merkez',
      sortOrder: 2,
      description: null,
    },
    {
      bankName: 'Garanti BBVA',
      accountName: 'Furkan Soğutma',
      iban: 'TR650006200000222222222222',
      branch: 'Merkez',
      sortOrder: 3,
      description: null,
    },
  ];

  for (const account of accounts) {
    const existing = await prisma.companyBankAccount.findFirst({
      where: { iban: account.iban },
    });
    if (existing) {
      await prisma.companyBankAccount.update({
        where: { id: existing.id },
        data: {
          ...account,
          currency: 'TRY',
          active: true,
        },
      });
    } else {
      await prisma.companyBankAccount.create({
        data: {
          ...account,
          currency: 'TRY',
          active: true,
        },
      });
    }
  }
  console.log('Company bank accounts ensured');
}

async function main(): Promise<void> {
  await ensureRbacCatalog();
  await seedAdmins();
  await seedCatalog();
  await seedBankAccounts();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
