-- =====================================================================
-- Social module — accounts + scheduled posts
-- Apply once against an existing Aczen Connect database.
-- =====================================================================

-- ---------------------------------------------------------------------
-- social_accounts  (connected brand handles per platform)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform      TEXT NOT NULL CHECK (platform IN (
                  'twitter','linkedin','instagram','facebook','youtube','tiktok','threads'
                )),
  handle        TEXT NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  connected_by  TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, handle)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON public.social_accounts(platform);

CREATE TRIGGER trg_social_accounts_updated
  BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- social_posts  (content plan + scheduling queue)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_posts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT,
  content        TEXT NOT NULL,
  platforms      TEXT[] NOT NULL DEFAULT '{}',
  media_urls     TEXT[] NOT NULL DEFAULT '{}',
  link_url       TEXT,
  status         TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','scheduled','published','failed','cancelled')),
  scheduled_at   TIMESTAMPTZ,
  published_at   TIMESTAMPTZ,
  campaign       TEXT,
  tags           TEXT[] NOT NULL DEFAULT '{}',
  author_user_id TEXT NOT NULL,
  author_name    TEXT,
  engagement     JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_status       ON public.social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled    ON public.social_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_social_posts_author       ON public.social_posts(author_user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_campaign     ON public.social_posts(campaign);
CREATE INDEX IF NOT EXISTS idx_social_posts_created_at   ON public.social_posts(created_at DESC);

CREATE TRIGGER trg_social_posts_updated
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- RLS (permissive, matches existing module pattern)
-- ---------------------------------------------------------------------
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth can all on social_accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "auth can all on social_posts"    ON public.social_posts;

CREATE POLICY "auth can all on social_accounts"
  ON public.social_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth can all on social_posts"
  ON public.social_posts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.social_accounts';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
