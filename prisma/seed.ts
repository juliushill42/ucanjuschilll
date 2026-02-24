import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create demo users
  const passwordHash = await bcrypt.hash('password123', 12)

  const user1 = await prisma.user.upsert({
    where: { email: 'demo@juschill.com' },
    update: {},
    create: {
      email: 'demo@juschill.com',
      username: 'demoartist',
      displayName: 'Demo Artist',
      passwordHash,
      bio: 'Making music from the bedroom. No studio needed. 💯',
      genre: 'Hip-Hop',
      location: 'Atlanta, GA',
    },
  })

  const user2 = await prisma.user.upsert({
    where: { email: 'luna@juschill.com' },
    update: {},
    create: {
      email: 'luna@juschill.com',
      username: 'lunavibes',
      displayName: 'Luna Vibes',
      passwordHash,
      bio: 'R&B singer. Writing my truth every day.',
      genre: 'R&B',
      location: 'Houston, TX',
    },
  })

  const user3 = await prisma.user.upsert({
    where: { email: 'marcus@juschill.com' },
    update: {},
    create: {
      email: 'marcus@juschill.com',
      username: 'marcbeats',
      displayName: 'Marc Beats',
      passwordHash,
      bio: 'Producer. Creating something from nothing.',
      genre: 'Trap',
      location: 'Detroit, MI',
    },
  })

  // Create sample posts
  await prisma.post.upsert({
    where: { id: 'seed-post-1' },
    update: {},
    create: {
      id: 'seed-post-1',
      userId: user1.id,
      title: 'Bedroom Sessions Vol. 1',
      description: 'Recorded this at 2am. Just me and my thoughts. AI mixed it automatically.',
      type: 'AUDIO',
      genre: 'Hip-Hop',
      tags: ['hiphop', 'bedroomrecording', 'independent', 'rawmusic'],
      duration: 183,
      likeCount: 47,
      playCount: 312,
      commentCount: 12,
      aiProcessed: true,
      captions: {
        create: [
          { language: 'en', startTime: 0, endTime: 30, text: 'Verse one, coming from the heart' },
          { language: 'en', startTime: 30, endTime: 60, text: 'No studio, no label, just art' },
        ],
      },
    },
  })

  await prisma.post.upsert({
    where: { id: 'seed-post-2' },
    update: {},
    create: {
      id: 'seed-post-2',
      userId: user2.id,
      title: 'Late Night Feels',
      description: 'When words become music. This one wrote itself.',
      type: 'AUDIO',
      genre: 'R&B',
      tags: ['rnb', 'soulmusic', 'independent', 'latenight'],
      duration: 214,
      likeCount: 89,
      playCount: 654,
      commentCount: 23,
      aiProcessed: true,
    },
  })

  await prisma.post.upsert({
    where: { id: 'seed-post-3' },
    update: {},
    create: {
      id: 'seed-post-3',
      userId: user3.id,
      title: '808 Overdose (Free Beat)',
      description: 'Free for non-commercial use. Tag me if you use it.',
      type: 'AUDIO',
      genre: 'Trap',
      tags: ['freebeat', 'trap', 'producer', '808'],
      duration: 180,
      likeCount: 134,
      playCount: 1203,
      commentCount: 45,
      aiProcessed: false,
    },
  })

  console.log('✅ Seed complete')
  console.log('Demo credentials: demo@juschill.com / password123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
