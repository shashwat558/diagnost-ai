-- ClickHouse: high-cardinality event store.
-- Attributes are stored as JSON strings (no experimental JSON type needed);
-- drill-down parses client-side. PII audit ships alongside every event.

CREATE TABLE IF NOT EXISTS {db}.events
(
    id              UUID,
    workspace_id    LowCardinality(String),
    trace_id        String,
    span_id         String,
    parent_span_id  Nullable(String),
    conversation_id String,
    session_id      Nullable(String),
    name            String,
    kind            Enum8('agent' = 1, 'llm' = 2, 'tool' = 3, 'retrieval' = 4, 'checkpoint' = 5, 'session' = 6),
    status          Enum8('ok' = 1, 'error' = 2),
    error_message   Nullable(String),
    attributes      String DEFAULT '{}',
    latency_ms      Nullable(UInt64),
    tokens_in       Nullable(UInt64),
    tokens_out      Nullable(UInt64),
    cost_usd        Nullable(Float64),
    transcript_ref  Nullable(String),
    pii_redactions  Array(Tuple(field String, type String, action String, count UInt32)),
    zero_pii_mode   Bool,
    redactor_version LowCardinality(String) DEFAULT '',
    timestamp       DateTime64(3, 'UTC'),
    ingested_at     DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree
PARTITION BY toDate(timestamp)
ORDER BY (workspace_id, timestamp, trace_id)
TTL toDateTime(timestamp) + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;
