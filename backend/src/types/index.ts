export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  level: number;
  roles: string[];
  permissions: string[];
  departmentId: string | null;
  teamId: string | null;
}

export interface JwtAccessPayload {
  sub: string;
  email: string;
  level: number;
  type: 'access';
}

export type SortDir = 'asc' | 'desc';
