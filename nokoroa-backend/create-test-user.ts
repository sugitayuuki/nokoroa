import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash('password123', 10);

    // テストユーザーを作成
    const user = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {
        password: hashedPassword,
        bio: 'テストユーザーです',
      },
      create: {
        email: 'test@example.com',
        name: 'Test User',
        password: hashedPassword,
        bio: 'テストユーザーです',
      },
    });

    console.log('テストユーザーが作成されました:', user);
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();