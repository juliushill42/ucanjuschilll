import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      image?: string | null
      username: string
    }
  }

  interface User {
    username?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    username: string
  }
}

export type { Session, User } from 'next-auth'
