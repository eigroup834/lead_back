export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  // lowest role level the user holds (1 = Super Admin ... 4 = Executive)
  level: number;
  roles: string[];
  permissions: string[];
  departmentId: string | null;
  teamId: string | null;
}

export interface JwtAccessPayload {
  sub: string; // user id
  email: string;
  level: number;
  type: 'access';
}

export type SortDir = 'asc' | 'desc';
