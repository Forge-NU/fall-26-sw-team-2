-- Run against a migrated test database with psql -v ON_ERROR_STOP=1.
-- All fixtures are rolled back, including on a failed assertion.
BEGIN;

INSERT INTO "User" (id, email, first_name, last_name, username, updated_at)
VALUES
  ('follow_constraint_a', 'a@example.com', 'A', 'Test', 'follow_constraint_a', NOW()),
  ('follow_constraint_b', 'b@example.com', 'B', 'Test', 'follow_constraint_b', NOW()),
  ('follow_constraint_c', 'c@example.com', 'C', 'Test', 'follow_constraint_c', NOW());

INSERT INTO follows (follower_id, following_id)
VALUES ('follow_constraint_a', 'follow_constraint_b'),
       ('follow_constraint_c', 'follow_constraint_a');

DO $$
BEGIN
  BEGIN
    INSERT INTO follows (follower_id, following_id)
    VALUES ('follow_constraint_a', 'follow_constraint_a');
    RAISE EXCEPTION 'Self-follow was accepted';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE '%follows_no_self_follow%' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    INSERT INTO follows (follower_id, following_id)
    VALUES ('follow_constraint_a', 'follow_constraint_b');
    RAISE EXCEPTION 'Duplicate follow was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO follows (follower_id, following_id)
    VALUES ('follow_constraint_a', 'follow_constraint_missing');
    RAISE EXCEPTION 'Missing user was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  DELETE FROM "User" WHERE id = 'follow_constraint_a';
  IF EXISTS (
    SELECT 1 FROM follows
    WHERE follower_id = 'follow_constraint_a' OR following_id = 'follow_constraint_a'
  ) THEN
    RAISE EXCEPTION 'User deletion did not cascade in both directions';
  END IF;
END $$;

ROLLBACK;
