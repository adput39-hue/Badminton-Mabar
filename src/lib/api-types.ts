export interface ApiMember {
  id: string; pbId: string; name: string; phone: string | null;
  photo: string | null; address: string | null;
  class: string; type: string; memberType: string; isActive: boolean; joinedAt: string;
  gender: string | null; saldoAwalHutang: number | null;
  createdAt: string; updatedAt: string;
  hasPhoto?: boolean; photoVersion?: string | null;
}

export interface ApiSchedule {
  id: string; pbId: string; title: string; date: string;
  startTime: string | null; endTime: string | null; location: string | null;
  maxParticipants: number; htm: number | null; htmInsidentil: number | null; cockPrice: number | null; courts: string | null; sparingOpponent: string | null; logoUrl: string | null;
  tournamentId: string | null; team1Id: string | null; team2Id: string | null;
  notes: string | null; status: string;
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
  scoreTeam1Game3: number | null; scoreTeam2Game3: number | null;
  totalGames: number; winnerTeam: number | null; cockCount: number | null;
  status: string; notes: string | null; createdAt: string; updatedAt: string;
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
  logoUrl: string | null; favicon: string | null;
  primaryColor: string | null; captionColor: string | null; bgColor: string | null;
  address: string | null;
  phone: string | null; cockPrice: number | null; createdAt: string; updatedAt: string;
  _count?: { users: number; members: number; schedules: number };
}

export interface ApiKasBiaya {
  id: string; pbId: string; name: string;
  type: string; amount: number | null;
  description: string | null; isActive: boolean;
  createdAt: string; updatedAt: string;
}

export interface ApiKasMutasi {
  id: string; pbId: string; type: string;
  biayaId: string | null; description: string;
  amount: number; tanggal: string;
  reference: string | null; memberId: string | null;
  scheduleId: string | null;
  createdBy: string | null; void: number;
  createdAt: string; updatedAt: string;
}

export interface ApiLabaRugi {
  id: string; scheduleId: string; pbId: string;
  totalIncome: number; cockCost: number; courtCost: number;
  cockBiayaId: string | null; courtBiayaId: string | null;
  profitLoss: number; notes: string | null;
  createdAt: string; updatedAt: string;
  schedule?: ApiSchedule;
  cockBiaya?: ApiKasBiaya | null;
  courtBiaya?: ApiKasBiaya | null;
}

export interface ApiTournament {
  id: string; pbId: string; name: string; status: string;
  totalMatchGoal?: number | null; maxMatchPerTeam?: number | null;
  gameFormat?: string | null; courts?: string | null;
  standingsMode?: string | null; winPoints?: number | null;
  drawPoints?: number | null; lossPoints?: number | null;
  createdAt: string; updatedAt: string;
  teams?: ApiTeam[]; schedules?: ApiTournamentSchedule[];
  _count?: { schedules: number };
}

export interface ApiTournamentSchedule {
  id: string; pbId: string; title: string; date: string;
  team1Id: string | null; team2Id: string | null;
  status: string; notes: string | null;
  matches?: ApiMatch[];
  team1?: ApiTeam | null; team2?: ApiTeam | null;
  createdAt: string; updatedAt: string;
}

export interface ApiTeam {
  id: string; tournamentId: string; name: string; color: string; icon?: string | null;
  createdAt: string;
  players?: ApiTeamPlayer[];
}

export interface ApiTeamPlayer {
  id: string; teamId: string; memberId: string;
}
