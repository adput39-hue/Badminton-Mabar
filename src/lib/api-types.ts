export interface ApiMember {
  id: string; pbId: string; name: string; phone: string | null;
  photo: string | null; address: string | null;
  class: string; type: string; isActive: boolean; joinedAt: string;
  createdAt: string; updatedAt: string;
}

export interface ApiSchedule {
  id: string; pbId: string; title: string; date: string;
  startTime: string | null; endTime: string | null; location: string | null;
  maxParticipants: number; htm: number | null; courts: string | null; sparingOpponent: string | null; notes: string | null; status: string;
  createdBy: string | null; createdAt: string; updatedAt: string;
}

export interface ApiAttendance {
  id: string; scheduleId: string; memberId: string;
  status: "undangan" | "hadir" | "tidak_jadi";
  confirmedAt: string | null; createdAt: string;
}

export interface ApiMatch {
  id: string; scheduleId: string; pbId: string;
  courtNumber: number | null; round: number;
  team1Player1Id: string; team1Player2Id: string;
  team2Player1Id: string; team2Player2Id: string;
  scoreTeam1: number | null; scoreTeam2: number | null;
  scoreTeam1Game2: number | null; scoreTeam2Game2: number | null;
  totalGames: number; winnerTeam: number | null; status: string;
  notes: string | null; createdAt: string; updatedAt: string;
}

export interface ApiMatchHistory {
  id: string; matchId: string; memberId: string;
  partnerId: string | null;
  opponent1Id: string; opponent2Id: string;
  result: string; pbId: string; createdAt: string;
}

export interface ApiUser {
  id: string; email: string; fullName: string;
  phone: string | null; password?: string;
  role: string; levelId: string | null;
  pbId: string | null; avatarUrl: string | null;
  createdAt: string; updatedAt: string;
  level: ApiUserLevel | null;
}

export interface ApiUserLevel {
  id: string; name: string; slug: string;
  description: string | null; color: string;
  menus: string[];
  createdAt: string; updatedAt: string;
  _count?: { users: number };
}

export interface ApiPb {
  id: string; name: string; slug: string;
  logoUrl: string | null; address: string | null;
  phone: string | null;
  createdAt: string; updatedAt: string;
  _count?: { users: number; members: number; schedules: number };
}
