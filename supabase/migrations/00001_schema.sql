-- Multi-tenant schema for Badminton Mabar

-- 1. TABEL VENUE / PEMILIK BADMINTON
CREATE TABLE pb (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TABEL USER (login)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'admin_pb')),
  pb_id UUID REFERENCES pb(id) ON DELETE CASCADE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TABEL ANGGOTA
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pb_id UUID NOT NULL REFERENCES pb(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  class TEXT NOT NULL CHECK (class IN ('A', 'B', 'C', 'D', 'E', 'F')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_members_pb_id ON members(pb_id);
CREATE INDEX idx_members_class ON members(class);

-- 4. TABEL JADWAL MABAR
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pb_id UUID NOT NULL REFERENCES pb(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT,
  max_participants INT NOT NULL DEFAULT 20,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'ongoing', 'completed', 'cancelled')),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_schedules_pb_id ON schedules(pb_id);
CREATE INDEX idx_schedules_date ON schedules(date);

-- 5. TABEL ABSEN
CREATE TABLE attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('hadir', 'izin', 'alpha')),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(schedule_id, member_id)
);

CREATE INDEX idx_attendances_schedule ON attendances(schedule_id);

-- 6. TABEL PERTANDINGAN
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  pb_id UUID NOT NULL REFERENCES pb(id) ON DELETE CASCADE,
  court_number INT NOT NULL DEFAULT 1,
  round INT NOT NULL DEFAULT 1,
  team1_player1_id UUID NOT NULL REFERENCES members(id),
  team1_player2_id UUID NOT NULL REFERENCES members(id),
  team2_player1_id UUID NOT NULL REFERENCES members(id),
  team2_player2_id UUID NOT NULL REFERENCES members(id),
  score_team1 INT,
  score_team2 INT,
  winner_team INT CHECK (winner_team IN (1, 2)),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_matches_schedule ON matches(schedule_id);
CREATE INDEX idx_matches_pb_id ON matches(pb_id);

-- 7. TABEL HISTORY PERTANDINGAN (buat statistik)
CREATE TABLE match_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id),
  partner_id UUID REFERENCES members(id),
  opponent1_id UUID NOT NULL REFERENCES members(id),
  opponent2_id UUID NOT NULL REFERENCES members(id),
  result TEXT NOT NULL CHECK (result IN ('win', 'lose', 'draw')),
  pb_id UUID NOT NULL REFERENCES pb(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_match_history_member ON match_history(member_id);
CREATE INDEX idx_match_history_pb_id ON match_history(pb_id);

-- 8. FUNGSI UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pb_updated_at
  BEFORE UPDATE ON pb FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_schedules_updated_at
  BEFORE UPDATE ON schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_matches_updated_at
  BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 9. ROW LEVEL SECURITY (optional, bisa diaktifkan nanti)
ALTER TABLE pb ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_history ENABLE ROW LEVEL SECURITY;
