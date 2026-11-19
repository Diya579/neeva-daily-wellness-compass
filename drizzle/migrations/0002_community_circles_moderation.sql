CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid,
  alias text NOT NULL CHECK (char_length(alias) BETWEEN 2 AND 40),
  circle text NOT NULL CHECK (circle ~ '^[a-z]{2,20}$'),
  body text NOT NULL CHECK (char_length(body) BETWEEN 5 AND 600),
  status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','removed')),
  is_team boolean NOT NULL DEFAULT false,
  moderation text NOT NULL DEFAULT 'local' CHECK (moderation IN ('ai','local','team')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_posts_feed_idx ON public.community_posts (status, created_at DESC);
CREATE INDEX community_posts_author_idx ON public.community_posts (author_id);
GRANT ALL ON public.community_posts TO service_role;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.community_members (
  user_id uuid NOT NULL,
  circle text NOT NULL CHECK (circle ~ '^[a-z]{2,20}$'),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, circle)
);
GRANT SELECT, INSERT, DELETE ON public.community_members TO authenticated;
GRANT ALL ON public.community_members TO service_role;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members see own memberships" ON public.community_members FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Members join as themselves" ON public.community_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Members leave own circles" ON public.community_members FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.community_supports (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT ALL ON public.community_supports TO service_role;
ALTER TABLE public.community_supports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  target text NOT NULL DEFAULT 'post' CHECK (target IN ('post','user')),
  reason text NOT NULL CHECK (reason IN ('harassment','hate','self_harm','personal_info','spam','other')),
  details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);
GRANT SELECT, INSERT ON public.community_reports TO authenticated;
GRANT ALL ON public.community_reports TO service_role;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reporters see own reports" ON public.community_reports FOR SELECT TO authenticated USING (reporter_id = auth.uid());
CREATE POLICY "Reporters file as themselves" ON public.community_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());

CREATE TABLE public.community_blocks (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
GRANT ALL ON public.community_blocks TO service_role;
ALTER TABLE public.community_blocks ENABLE ROW LEVEL SECURITY;

-- Hide a post for everyone once enough distinct people report it.
CREATE OR REPLACE FUNCTION public.community_after_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int; n_harm int;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE reason = 'self_harm') INTO n, n_harm
  FROM public.community_reports WHERE post_id = NEW.post_id;
  IF n >= 3 OR n_harm >= 2 THEN
    UPDATE public.community_posts SET status = 'hidden' WHERE id = NEW.post_id AND status = 'visible' AND NOT is_team;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER community_reports_after_insert AFTER INSERT ON public.community_reports
FOR EACH ROW EXECUTE FUNCTION public.community_after_report();

-- Feed without any author identifiers. Excludes blocked authors and posts the caller reported.
CREATE OR REPLACE FUNCTION public.community_feed(_circle text DEFAULT NULL, _limit int DEFAULT 60)
RETURNS TABLE (id uuid, alias text, circle text, body text, created_at timestamptz, is_team boolean, is_mine boolean, support_count bigint, supported_by_me boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.alias, p.circle, p.body, p.created_at, p.is_team,
         (p.author_id IS NOT NULL AND p.author_id = auth.uid()) AS is_mine,
         (SELECT count(*) FROM public.community_supports s WHERE s.post_id = p.id) AS support_count,
         EXISTS (SELECT 1 FROM public.community_supports s WHERE s.post_id = p.id AND s.user_id = auth.uid()) AS supported_by_me
  FROM public.community_posts p
  WHERE auth.uid() IS NOT NULL
    AND (p.status = 'visible' OR (p.status = 'hidden' AND p.author_id = auth.uid()))
    AND (_circle IS NULL OR p.circle = _circle)
    AND NOT EXISTS (SELECT 1 FROM public.community_blocks b WHERE b.blocker_id = auth.uid() AND b.blocked_id = p.author_id)
    AND NOT EXISTS (SELECT 1 FROM public.community_reports r WHERE r.post_id = p.id AND r.reporter_id = auth.uid())
  ORDER BY p.is_team DESC, p.created_at DESC
  LIMIT LEAST(GREATEST(_limit, 1), 100)
$$;

CREATE OR REPLACE FUNCTION public.community_toggle_support(_post uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF EXISTS (SELECT 1 FROM public.community_supports WHERE post_id = _post AND user_id = me) THEN
    DELETE FROM public.community_supports WHERE post_id = _post AND user_id = me;
    RETURN false;
  END IF;
  INSERT INTO public.community_supports (post_id, user_id)
  SELECT _post, me WHERE EXISTS (SELECT 1 FROM public.community_posts WHERE id = _post AND status = 'visible');
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.community_block_author(_post uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); author uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT author_id INTO author FROM public.community_posts WHERE id = _post AND NOT is_team;
  IF author IS NULL OR author = me THEN RETURN false; END IF;
  INSERT INTO public.community_blocks (blocker_id, blocked_id) VALUES (me, author) ON CONFLICT DO NOTHING;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.community_blocked_count()
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.community_blocks WHERE blocker_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.community_unblock_all()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  DELETE FROM public.community_blocks WHERE blocker_id = auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.community_delete_my_post(_post uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.community_posts WHERE id = _post AND author_id = auth.uid() AND auth.uid() IS NOT NULL;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.community_circle_stats()
RETURNS TABLE (circle text, members bigint, posts_week bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.circle,
         (SELECT count(*) FROM public.community_members m WHERE m.circle = c.circle),
         (SELECT count(*) FROM public.community_posts p WHERE p.circle = c.circle AND p.status = 'visible' AND NOT p.is_team AND p.created_at > now() - interval '7 days')
  FROM (SELECT DISTINCT circle FROM public.community_members UNION SELECT DISTINCT circle FROM public.community_posts) c
  WHERE auth.uid() IS NOT NULL
$$;

-- Removes everything community-related for the caller (used before account deletion).
CREATE OR REPLACE FUNCTION public.community_delete_my_data()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  DELETE FROM public.community_posts WHERE author_id = me;
  DELETE FROM public.community_supports WHERE user_id = me;
  DELETE FROM public.community_reports WHERE reporter_id = me;
  DELETE FROM public.community_members WHERE user_id = me;
  DELETE FROM public.community_blocks WHERE blocker_id = me OR blocked_id = me;
END $$;

REVOKE EXECUTE ON FUNCTION public.community_feed(text, int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.community_toggle_support(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.community_block_author(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.community_blocked_count() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.community_unblock_all() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.community_delete_my_post(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.community_circle_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.community_delete_my_data() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.community_after_report() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_feed(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_toggle_support(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_block_author(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_blocked_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_unblock_all() TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_delete_my_post(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_circle_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_delete_my_data() TO authenticated;

INSERT INTO public.community_posts (alias, circle, body, is_team, moderation) VALUES
('Neeva team', 'campus', 'Welcome to Campus Wellness. Exams, hostels, placements, figuring life out — share a win, a worry or a question. Everyone here posts under an anonymous alias. Please never share phone numbers, Instagram handles or college roll numbers.', true, 'team'),
('Neeva team', 'anxiety', 'Circle guidelines: be kind, share your own experience rather than advice that sounds like orders, and do not post anything that could identify you or someone else. If you are in danger right now, use the Crisis help button — this circle is peer support, not emergency care.', true, 'team');