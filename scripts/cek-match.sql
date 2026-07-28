SELECT 'tournament_schedules' as label, count(*) as cnt FROM schedules WHERE tournament_id IS NOT NULL;
SELECT 'tournament_matches' as label, count(*) as cnt FROM matches WHERE schedule_id IN (SELECT id FROM schedules WHERE tournament_id IS NOT NULL);
SELECT 'all_matches' as label, count(*) as cnt FROM matches;
SELECT 'schedules_with_tournament' as label, id, title FROM schedules WHERE tournament_id IS NOT NULL;
