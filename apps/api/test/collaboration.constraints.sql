-- Shared trips constraints (#131 COLLAB-1): the partial unique index, the
-- checks, and the deletion rules from #129 DOC-3.
-- Run against a migrated test database with psql -v ON_ERROR_STOP=1, or by
-- test/constraints.e2e-spec.ts. All fixtures are rolled back, including on a
-- failed assertion.
BEGIN;

INSERT INTO "User" (id, email, first_name, last_name, username, updated_at)
VALUES
  ('collab_constraint_owner', 'owner@example.com', 'Owner', 'Test', 'collab_constraint_owner', NOW()),
  ('collab_constraint_member', 'member@example.com', 'Member', 'Test', 'collab_constraint_member', NOW()),
  ('collab_constraint_guest', 'guest@example.com', 'Guest', 'Test', 'collab_constraint_guest', NOW());

INSERT INTO trips (id, owner_id, title, destination, start_date, end_date, updated_at)
VALUES
  ('c0000000-0000-4000-8000-000000000001', 'collab_constraint_owner', 'Kept', 'Lisbon', '2026-12-01', '2026-12-05', NOW()),
  ('c0000000-0000-4000-8000-000000000002', 'collab_constraint_owner', 'Deleted', 'Porto', '2026-12-10', '2026-12-12', NOW());

INSERT INTO locations (id, provider, provider_place_id, name, latitude, longitude, updated_at)
VALUES
  ('c0000000-0000-4000-8000-0000000000a1', 'mapbox', 'collab_constraint_place_1', 'Time Out Market', 38.707, -9.146, NOW()),
  ('c0000000-0000-4000-8000-0000000000a2', 'mapbox', 'collab_constraint_place_2', 'Livraria Lello', 41.147, -8.615, NOW());

DO $$
DECLARE
  kept CONSTANT uuid := 'c0000000-0000-4000-8000-000000000001';
  deleted CONSTANT uuid := 'c0000000-0000-4000-8000-000000000002';
  place1 CONSTANT uuid := 'c0000000-0000-4000-8000-0000000000a1';
  place2 CONSTANT uuid := 'c0000000-0000-4000-8000-0000000000a2';
  first_invite uuid := gen_random_uuid();
BEGIN
  -- Invites: one pending per person per trip

  INSERT INTO trip_invites (id, trip_id, inviter_id, invitee_id)
  VALUES (first_invite, kept, 'collab_constraint_owner', 'collab_constraint_guest');

  BEGIN
    INSERT INTO trip_invites (id, trip_id, inviter_id, invitee_id)
    VALUES (gen_random_uuid(), kept, 'collab_constraint_owner', 'collab_constraint_guest');
    RAISE EXCEPTION 'A second pending invite was accepted';
  EXCEPTION WHEN unique_violation THEN
    IF SQLERRM NOT LIKE '%trip_invites_one_pending_key%' THEN
      RAISE;
    END IF;
  END;

  -- After a decline, the owner can invite them again
  UPDATE trip_invites SET status = 'declined', responded_at = NOW() WHERE id = first_invite;
  INSERT INTO trip_invites (id, trip_id, inviter_id, invitee_id)
  VALUES (gen_random_uuid(), kept, 'collab_constraint_owner', 'collab_constraint_guest');

  BEGIN
    INSERT INTO trip_invites (id, trip_id, inviter_id, invitee_id)
    VALUES (gen_random_uuid(), kept, 'collab_constraint_owner', 'collab_constraint_owner');
    RAISE EXCEPTION 'A self-invite was accepted';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE '%trip_invites_no_self_invite%' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    INSERT INTO trip_invites (id, trip_id, inviter_id, invitee_id, status)
    VALUES (gen_random_uuid(), kept, 'collab_constraint_owner', 'collab_constraint_member', 'accepted');
    RAISE EXCEPTION 'An answered invite without responded_at was accepted';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE '%trip_invites_responded_at_check%' THEN
      RAISE;
    END IF;
  END;

  -- Notifications

  BEGIN
    INSERT INTO notifications (id, recipient_id, actor_id, type, trip_id)
    VALUES (gen_random_uuid(), 'collab_constraint_guest', 'collab_constraint_owner', 'trip_invite', kept);
    RAISE EXCEPTION 'A trip_invite notification without an invite was accepted';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE '%notifications_trip_invite_check%' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    INSERT INTO notifications (id, recipient_id, actor_id, type)
    VALUES (gen_random_uuid(), 'collab_constraint_owner', 'collab_constraint_member', 'trip_invite_accepted');
    RAISE EXCEPTION 'A trip_invite_accepted notification without a trip was accepted';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE '%notifications_trip_invite_accepted_check%' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    INSERT INTO notifications (id, recipient_id, actor_id, type, trip_id)
    VALUES (gen_random_uuid(), 'collab_constraint_owner', 'collab_constraint_owner', 'trip_invite_accepted', kept);
    RAISE EXCEPTION 'A notification to its own actor was accepted';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE '%notifications_no_self_notify%' THEN
      RAISE;
    END IF;
  END;

  -- Buckets: a place at most once per trip

  INSERT INTO trip_members (trip_id, user_id) VALUES (kept, 'collab_constraint_member'), (deleted, 'collab_constraint_member');
  INSERT INTO trip_bucket_items (id, trip_id, location_id, added_by_id)
  VALUES (gen_random_uuid(), kept, place1, 'collab_constraint_owner');

  BEGIN
    INSERT INTO trip_bucket_items (id, trip_id, location_id, added_by_id)
    VALUES (gen_random_uuid(), kept, place1, 'collab_constraint_member');
    RAISE EXCEPTION 'A duplicate bucket place was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Locations are RESTRICT, like posts (Postgres reports it as restrict_violation)

  INSERT INTO place_saves (user_id, location_id) VALUES ('collab_constraint_member', place2);

  BEGIN
    DELETE FROM locations WHERE id = place2;
    RAISE EXCEPTION 'Deleting a saved location was accepted';
  EXCEPTION WHEN restrict_violation THEN NULL;
  END;

  BEGIN
    DELETE FROM locations WHERE id = place1;
    RAISE EXCEPTION 'Deleting a location in a bucket was accepted';
  EXCEPTION WHEN restrict_violation THEN NULL;
  END;

  -- Leaving a trip keeps the places you added

  INSERT INTO trip_bucket_items (id, trip_id, location_id, added_by_id)
  VALUES (gen_random_uuid(), kept, place2, 'collab_constraint_member');
  DELETE FROM trip_members WHERE trip_id = kept AND user_id = 'collab_constraint_member';
  IF (SELECT count(*) FROM trip_bucket_items WHERE trip_id = kept) <> 2 THEN
    RAISE EXCEPTION 'Leaving a trip removed bucket places';
  END IF;

  -- Deleting a trip deletes its members, invites, bucket and notifications

  INSERT INTO trip_invites (id, trip_id, inviter_id, invitee_id)
  VALUES (gen_random_uuid(), deleted, 'collab_constraint_owner', 'collab_constraint_guest');
  INSERT INTO notifications (id, recipient_id, actor_id, type, trip_id, invite_id)
  SELECT gen_random_uuid(), 'collab_constraint_guest', 'collab_constraint_owner', 'trip_invite', deleted, id
  FROM trip_invites WHERE trip_id = deleted;
  INSERT INTO trip_bucket_items (id, trip_id, location_id, added_by_id)
  VALUES (gen_random_uuid(), deleted, place2, 'collab_constraint_member');

  DELETE FROM trips WHERE id = deleted;
  IF EXISTS (SELECT 1 FROM trip_members WHERE trip_id = deleted)
    OR EXISTS (SELECT 1 FROM trip_invites WHERE trip_id = deleted)
    OR EXISTS (SELECT 1 FROM trip_bucket_items WHERE trip_id = deleted)
    OR EXISTS (SELECT 1 FROM notifications WHERE trip_id = deleted) THEN
    RAISE EXCEPTION 'Trip deletion did not cascade';
  END IF;

  -- Deleting an account removes their memberships, invites, notifications,
  -- saved places and the bucket places they added, but not others' trips

  INSERT INTO trip_members (trip_id, user_id) VALUES (kept, 'collab_constraint_member');
  INSERT INTO notifications (id, recipient_id, actor_id, type, trip_id)
  VALUES (gen_random_uuid(), 'collab_constraint_owner', 'collab_constraint_member', 'trip_invite_accepted', kept);

  DELETE FROM "User" WHERE id = 'collab_constraint_member';
  IF EXISTS (SELECT 1 FROM trip_members WHERE user_id = 'collab_constraint_member')
    OR EXISTS (SELECT 1 FROM place_saves WHERE user_id = 'collab_constraint_member')
    OR EXISTS (SELECT 1 FROM trip_bucket_items WHERE added_by_id = 'collab_constraint_member')
    OR EXISTS (SELECT 1 FROM notifications WHERE actor_id = 'collab_constraint_member') THEN
    RAISE EXCEPTION 'Account deletion did not cascade';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM trips WHERE id = kept)
    OR (SELECT count(*) FROM trip_bucket_items WHERE trip_id = kept) <> 1 THEN
    RAISE EXCEPTION 'Deleting a collaborator touched the owner''s trip';
  END IF;

  DELETE FROM "User" WHERE id = 'collab_constraint_guest';
  IF EXISTS (SELECT 1 FROM trip_invites WHERE invitee_id = 'collab_constraint_guest')
    OR EXISTS (SELECT 1 FROM notifications WHERE recipient_id = 'collab_constraint_guest') THEN
    RAISE EXCEPTION 'Deleting an invitee did not cascade';
  END IF;

  -- When an owner deletes their account, their trips go for everyone

  DELETE FROM "User" WHERE id = 'collab_constraint_owner';
  IF EXISTS (SELECT 1 FROM trips WHERE id = kept)
    OR EXISTS (SELECT 1 FROM trip_bucket_items WHERE trip_id = kept)
    OR EXISTS (SELECT 1 FROM trip_invites WHERE trip_id = kept) THEN
    RAISE EXCEPTION 'Owner deletion did not delete their trips';
  END IF;
END $$;

ROLLBACK;
