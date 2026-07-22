export interface PB {
  id: string
  name: string
  slug: string
  logo_url: string | null
  address: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  full_name: string
  phone: string | null
  role: 'superadmin' | 'admin_pb'
  pb_id: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type MemberClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

export interface Member {
  id: string
  pb_id: string
  name: string
  phone: string | null
  class: MemberClass
  is_active: boolean
  joined_at: string
  created_at: string
  updated_at: string
}

export interface Schedule {
  id: string
  pb_id: string
  title: string
  date: string
  start_time: string
  end_time: string
  location: string | null
  max_participants: number
  notes: string | null
  status: 'planned' | 'ongoing' | 'completed' | 'cancelled'
  created_by: string
  created_at: string
  updated_at: string
}

export interface Attendance {
  id: string
  schedule_id: string
  member_id: string
  status: 'hadir' | 'izin' | 'alpha'
  confirmed_at: string | null
  created_at: string
}

export interface Match {
  id: string
  schedule_id: string
  pb_id: string
  court_number: number
  round: number
  team1_player1_id: string
  team1_player2_id: string
  team2_player1_id: string
  team2_player2_id: string
  score_team1: number | null
  score_team2: number | null
  winner_team: 1 | 2 | null
  status: 'scheduled' | 'in_progress' | 'completed'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface MatchHistory {
  id: string
  match_id: string
  member_id: string
  partner_id: string | null
  opponent1_id: string
  opponent2_id: string
  result: 'win' | 'lose' | 'draw'
  pb_id: string
  created_at: string
}
