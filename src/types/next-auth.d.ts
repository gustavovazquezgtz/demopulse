import "next-auth";
import "next-auth/jwt";

export type AuthRole = "MANAGER" | "CEO";

declare module "next-auth" {
  interface User {
    id: string;
    role: AuthRole;
    avatarUrl?: string;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: AuthRole;
      avatarUrl?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: AuthRole;
  }
}
