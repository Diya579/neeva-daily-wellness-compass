"""001_initial_schema

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # ENUM types (must be created before the tables that use them)
    # ------------------------------------------------------------------
    user_goal = postgresql.ENUM("stress", "focus", "community", "sleep", name="user_goal", create_type=True)
    preferred_language = postgresql.ENUM("en", "hinglish", "hi", "gu", "mr", "bn", "ta", "te", name="preferred_language", create_type=True)
    script_style = postgresql.ENUM("auto", "roman", "native", name="script_style", create_type=True)
    companion_vibe = postgresql.ENUM("bestie", "coach", "sage", "hype", name="companion_vibe", create_type=True)
    companion_length = postgresql.ENUM("short", "balanced", "deep", name="companion_length", create_type=True)
    companion_avatar = postgresql.ENUM("bloom", "moon", "wave", "spark", name="companion_avatar", create_type=True)
    companion_approach = postgresql.ENUM("validate", "advise", "mix", "explore", name="companion_approach", create_type=True)
    companion_tone = postgresql.ENUM("gentle", "honest", "playful", name="companion_tone", create_type=True)
    mood_type = postgresql.ENUM("peaceful", "joyful", "tired", "anxious", "overwhelmed", name="mood_type", create_type=True)
    chat_role = postgresql.ENUM("user", "assistant", name="chat_role", create_type=True)
    wellness_activity_type = postgresql.ENUM("meditation", "breathing", "focus", "game", "thought_record", "journal", name="wellness_activity_type", create_type=True)
    post_status = postgresql.ENUM("visible", "hidden", "removed", name="post_status", create_type=True)
    moderation_source = postgresql.ENUM("ai", "local", "team", name="moderation_source", create_type=True)
    report_target = postgresql.ENUM("post", "user", name="report_target", create_type=True)
    report_reason = postgresql.ENUM("harassment", "hate", "self_harm", "personal_info", "spam", "other", name="report_reason", create_type=True)
    consent_type = postgresql.ENUM("ai_journal_analysis", "context_sharing", "analytics", name="consent_type", create_type=True)
    export_status = postgresql.ENUM("pending", "processing", "ready", "failed", name="export_status", create_type=True)
    deletion_status = postgresql.ENUM("pending", "completed", "cancelled", name="deletion_status", create_type=True)

    for enum in [
        user_goal, preferred_language, script_style, companion_vibe, companion_length,
        companion_avatar, companion_approach, companion_tone, mood_type, chat_role,
        wellness_activity_type, post_status, moderation_source, report_target, report_reason,
        consent_type, export_status, deletion_status,
    ]:
        enum.create(op.get_bind(), checkfirst=True)

    # ------------------------------------------------------------------
    # user_profiles
    # ------------------------------------------------------------------
    op.create_table(
        "user_profiles",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("display_name", sa.String(40), nullable=False),
        sa.Column("goal", sa.Enum("stress", "focus", "community", "sleep", name="user_goal", create_type=False), nullable=False),
        sa.Column("preferred_language", sa.Enum("en", "hinglish", "hi", "gu", "mr", "bn", "ta", "te", name="preferred_language", create_type=False), nullable=False, server_default="en"),
        sa.Column("script_style", sa.Enum("auto", "roman", "native", name="script_style", create_type=False), nullable=False, server_default="auto"),
        sa.Column("onboarded", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("companion_configured", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("companion_name", sa.String(24), nullable=False, server_default="Neeva"),
        sa.Column("companion_vibe", sa.Enum("bestie", "coach", "sage", "hype", name="companion_vibe", create_type=False), nullable=False, server_default="bestie"),
        sa.Column("companion_length", sa.Enum("short", "balanced", "deep", name="companion_length", create_type=False), nullable=False, server_default="balanced"),
        sa.Column("companion_avatar", sa.Enum("bloom", "moon", "wave", "spark", name="companion_avatar", create_type=False), nullable=False, server_default="bloom"),
        sa.Column("companion_emoji", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("companion_approach", sa.Enum("validate", "advise", "mix", "explore", name="companion_approach", create_type=False), nullable=False, server_default="mix"),
        sa.Column("companion_tone", sa.Enum("gentle", "honest", "playful", name="companion_tone", create_type=False), nullable=False, server_default="gentle"),
        sa.Column("companion_notes", sa.String(200), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # mood_entries
    # ------------------------------------------------------------------
    op.create_table(
        "mood_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mood", sa.Enum("peaceful", "joyful", "tired", "anxious", "overwhelmed", name="mood_type", create_type=False), nullable=False),
        sa.Column("intensity", sa.Integer(), nullable=False),
        sa.Column("triggers", postgresql.JSON(), nullable=False, server_default="[]"),
        sa.Column("note", sa.String(500), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_mood_entries_user_id", "mood_entries", ["user_id"])

    # ------------------------------------------------------------------
    # journal_entries
    # ------------------------------------------------------------------
    op.create_table(
        "journal_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("prompt", sa.String(300), nullable=False),
        sa.Column("content_ciphertext", sa.LargeBinary(), nullable=True),
        sa.Column("content_iv", sa.LargeBinary(), nullable=True),
        sa.Column("analysis_json", postgresql.JSON(), nullable=True),
        sa.Column("analysis_source", sa.String(16), nullable=True),
        sa.Column("word_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_journal_entries_user_id", "journal_entries", ["user_id"])

    # ------------------------------------------------------------------
    # journal_drafts
    # ------------------------------------------------------------------
    op.create_table(
        "journal_drafts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("prompt", sa.String(300), nullable=False),
        sa.Column("content_ciphertext", sa.LargeBinary(), nullable=False),
        sa.Column("content_iv", sa.LargeBinary(), nullable=False),
        sa.Column("saved_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_journal_drafts_user_id", "journal_drafts", ["user_id"])

    # ------------------------------------------------------------------
    # thought_records
    # ------------------------------------------------------------------
    op.create_table(
        "thought_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("situation", sa.String(500), nullable=False),
        sa.Column("automatic_thought", sa.String(500), nullable=False),
        sa.Column("emotions", postgresql.JSON(), nullable=False, server_default="[]"),
        sa.Column("emotion_intensity_before", sa.Integer(), nullable=False),
        sa.Column("thinking_patterns", postgresql.JSON(), nullable=False, server_default="[]"),
        sa.Column("evidence_for", sa.String(500), nullable=False, server_default=""),
        sa.Column("evidence_against", sa.String(500), nullable=False, server_default=""),
        sa.Column("balanced_thought", sa.String(500), nullable=False, server_default=""),
        sa.Column("emotion_intensity_after", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_thought_records_user_id", "thought_records", ["user_id"])

    # ------------------------------------------------------------------
    # conversations
    # ------------------------------------------------------------------
    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(100), nullable=True),
        sa.Column("language", sa.String(16), nullable=False, server_default="en"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_conversations_user_id", "conversations", ["user_id"])

    # ------------------------------------------------------------------
    # chat_messages
    # ------------------------------------------------------------------
    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.Enum("user", "assistant", name="chat_role", create_type=False), nullable=False),
        sa.Column("content_ciphertext", sa.LargeBinary(), nullable=True),
        sa.Column("content_iv", sa.LargeBinary(), nullable=True),
        sa.Column("safety_tier", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_chat_messages_conversation_id", "chat_messages", ["conversation_id"])
    op.create_index("ix_chat_messages_user_id", "chat_messages", ["user_id"])

    # ------------------------------------------------------------------
    # wellness_activities
    # ------------------------------------------------------------------
    op.create_table(
        "wellness_activities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("activity_type", sa.Enum("meditation", "breathing", "focus", "game", "thought_record", "journal", name="wellness_activity_type", create_type=False), nullable=False),
        sa.Column("activity_id", sa.String(128), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("points_earned", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_wellness_activities_user_id", "wellness_activities", ["user_id"])

    # ------------------------------------------------------------------
    # wellness_streaks
    # ------------------------------------------------------------------
    op.create_table(
        "wellness_streaks",
        sa.Column("user_id", sa.String(128), sa.ForeignKey("user_profiles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("current_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("longest_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_activity_date", sa.Date(), nullable=False),
        sa.Column("total_points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # community_posts
    # ------------------------------------------------------------------
    op.create_table(
        "community_posts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("author_id", sa.String(128), sa.ForeignKey("user_profiles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("alias", sa.String(40), nullable=False),
        sa.Column("circle", sa.String(20), nullable=False),
        sa.Column("body", sa.String(600), nullable=False),
        sa.Column("status", sa.Enum("visible", "hidden", "removed", name="post_status", create_type=False), nullable=False, server_default="visible"),
        sa.Column("is_team", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("moderation", sa.Enum("ai", "local", "team", name="moderation_source", create_type=False), nullable=False, server_default="ai"),
        sa.Column("safety_tier", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_community_posts_author_id", "community_posts", ["author_id"])
    op.create_index("ix_community_posts_circle", "community_posts", ["circle"])

    # ------------------------------------------------------------------
    # community_members
    # ------------------------------------------------------------------
    op.create_table(
        "community_members",
        sa.Column("user_id", sa.String(128), sa.ForeignKey("user_profiles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("circle", sa.String(20), primary_key=True),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # community_support
    # ------------------------------------------------------------------
    op.create_table(
        "community_support",
        sa.Column("post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("community_posts.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("user_profiles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # community_reports
    # ------------------------------------------------------------------
    op.create_table(
        "community_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reporter_id", sa.String(128), nullable=False),
        sa.Column("target", sa.Enum("post", "user", name="report_target", create_type=False), nullable=False),
        sa.Column("reason", sa.Enum("harassment", "hate", "self_harm", "personal_info", "spam", "other", name="report_reason", create_type=False), nullable=False),
        sa.Column("details", sa.String(300), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("post_id", "reporter_id", name="uq_report_post_reporter"),
    )
    op.create_index("ix_community_reports_post_id", "community_reports", ["post_id"])

    # ------------------------------------------------------------------
    # community_blocks
    # ------------------------------------------------------------------
    op.create_table(
        "community_blocks",
        sa.Column("blocker_id", sa.String(128), sa.ForeignKey("user_profiles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("blocked_id", sa.String(128), sa.ForeignKey("user_profiles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # community_mutes
    # ------------------------------------------------------------------
    op.create_table(
        "community_mutes",
        sa.Column("muter_id", sa.String(128), sa.ForeignKey("user_profiles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("muted_id", sa.String(128), sa.ForeignKey("user_profiles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # community_replies
    # ------------------------------------------------------------------
    op.create_table(
        "community_replies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.String(128), sa.ForeignKey("user_profiles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("alias", sa.String(40), nullable=False),
        sa.Column("body", sa.String(400), nullable=False),
        sa.Column("status", sa.Enum("visible", "hidden", "removed", name="post_status", create_type=False), nullable=False, server_default="visible"),
        sa.Column("safety_tier", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_community_replies_post_id", "community_replies", ["post_id"])

    # ------------------------------------------------------------------
    # moderation_logs
    # ------------------------------------------------------------------
    op.create_table(
        "moderation_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("target_type", sa.String(20), nullable=False),
        sa.Column("target_id", sa.String(128), nullable=False),
        sa.Column("moderator_id", sa.String(128), nullable=False),
        sa.Column("action", sa.String(32), nullable=False),
        sa.Column("reason", sa.String(300), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_moderation_logs_target_id", "moderation_logs", ["target_id"])

    # ------------------------------------------------------------------
    # consent_records
    # ------------------------------------------------------------------
    op.create_table(
        "consent_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("consent_type", sa.Enum("ai_journal_analysis", "context_sharing", "analytics", name="consent_type", create_type=False), nullable=False),
        sa.Column("granted", sa.Boolean(), nullable=False),
        sa.Column("granted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_consent_records_user_id", "consent_records", ["user_id"])

    # ------------------------------------------------------------------
    # data_export_requests
    # ------------------------------------------------------------------
    op.create_table(
        "data_export_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.Enum("pending", "processing", "ready", "failed", name="export_status", create_type=False), nullable=False, server_default="pending"),
        sa.Column("download_url", sa.String(2048), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_data_export_requests_user_id", "data_export_requests", ["user_id"])

    # ------------------------------------------------------------------
    # account_deletion_requests
    # ------------------------------------------------------------------
    op.create_table(
        "account_deletion_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.Enum("pending", "completed", "cancelled", name="deletion_status", create_type=False), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_account_deletion_requests_user_id", "account_deletion_requests", ["user_id"])

    # ------------------------------------------------------------------
    # audit_events
    # ------------------------------------------------------------------
    op.create_table(
        "audit_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("metadata", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_audit_events_user_id", "audit_events", ["user_id"])


def downgrade() -> None:
    # Drop tables in reverse dependency order.
    for table in [
        "audit_events",
        "account_deletion_requests",
        "data_export_requests",
        "consent_records",
        "community_blocks",
        "community_reports",
        "community_support",
        "community_members",
        "community_posts",
        "wellness_streaks",
        "wellness_activities",
        "chat_messages",
        "conversations",
        "thought_records",
        "journal_drafts",
        "journal_entries",
        "mood_entries",
        "user_profiles",
    ]:
        op.drop_table(table)

    # Drop ENUM types.
    for name in [
        "deletion_status", "export_status", "consent_type",
        "report_reason", "report_target", "moderation_source", "post_status",
        "wellness_activity_type", "chat_role", "mood_type",
        "companion_tone", "companion_approach", "companion_avatar",
        "companion_length", "companion_vibe", "script_style",
        "preferred_language", "user_goal",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {name}")
