-- CreateTable
CREATE TABLE "pb" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pb_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin_pb',
    "pb_id" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "pb_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "class" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "pb_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "location" TEXT,
    "max_participants" INTEGER NOT NULL DEFAULT 20,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "pb_id" TEXT NOT NULL,
    "court_number" INTEGER NOT NULL DEFAULT 1,
    "round" INTEGER NOT NULL DEFAULT 1,
    "team1_player1_id" TEXT NOT NULL,
    "team1_player2_id" TEXT NOT NULL,
    "team2_player1_id" TEXT NOT NULL,
    "team2_player2_id" TEXT NOT NULL,
    "score_team1" INTEGER,
    "score_team2" INTEGER,
    "winner_team" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_history" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "partner_id" TEXT,
    "opponent1_id" TEXT NOT NULL,
    "opponent2_id" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "pb_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pb_slug_key" ON "pb"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "members_pb_id_idx" ON "members"("pb_id");

-- CreateIndex
CREATE INDEX "members_class_idx" ON "members"("class");

-- CreateIndex
CREATE INDEX "schedules_pb_id_idx" ON "schedules"("pb_id");

-- CreateIndex
CREATE INDEX "schedules_date_idx" ON "schedules"("date");

-- CreateIndex
CREATE INDEX "attendances_schedule_id_idx" ON "attendances"("schedule_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_schedule_id_member_id_key" ON "attendances"("schedule_id", "member_id");

-- CreateIndex
CREATE INDEX "matches_schedule_id_idx" ON "matches"("schedule_id");

-- CreateIndex
CREATE INDEX "matches_pb_id_idx" ON "matches"("pb_id");

-- CreateIndex
CREATE INDEX "match_history_member_id_idx" ON "match_history"("member_id");

-- CreateIndex
CREATE INDEX "match_history_pb_id_idx" ON "match_history"("pb_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_pb_id_fkey" FOREIGN KEY ("pb_id") REFERENCES "pb"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_pb_id_fkey" FOREIGN KEY ("pb_id") REFERENCES "pb"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_pb_id_fkey" FOREIGN KEY ("pb_id") REFERENCES "pb"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_pb_id_fkey" FOREIGN KEY ("pb_id") REFERENCES "pb"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_team1_player1_id_fkey" FOREIGN KEY ("team1_player1_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_team1_player2_id_fkey" FOREIGN KEY ("team1_player2_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_team2_player1_id_fkey" FOREIGN KEY ("team2_player1_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_team2_player2_id_fkey" FOREIGN KEY ("team2_player2_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_history" ADD CONSTRAINT "match_history_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_history" ADD CONSTRAINT "match_history_pb_id_fkey" FOREIGN KEY ("pb_id") REFERENCES "pb"("id") ON DELETE CASCADE ON UPDATE CASCADE;
