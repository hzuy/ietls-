---
name: seo-analysis
description: "Complete SEO analysis for any keyword — SERP data, page fetching, entity/LSI/variation extraction, Wikipedia/Wikidata links via entity-finder, CSV output. Use when user asks to analyze a keyword for SEO, content optimization, keyword research, SERP analysis, entity extraction from search results, LSI keyword discovery. Triggers on: 'SEO analysis', 'analyze keyword', 'keyword research', 'SERP data', 'phân tích SEO', 'nghiên cứu từ khóa'."
version: 1.1.0
---

# SEO Analysis

SERP data → page fetching → Claude-native extraction → entity-finder Wikipedia/Wikidata mapping → CSV output.

## Arguments

$ARGUMENTS

- keyword (required): Target keyword to analyze
- language (optional, default "vi"): Language code (vi, en-us, en-uk, th, id, ms, nl, bd)
- serp_depth (optional, default 100): Number of SERP results

## Architecture

```
Claude ─── orchestrate ───>
  ├── MCP: seo-tools       → SERP + fetch pages
  ├── entity-finder CLI     → Wikipedia/Wikidata lookups
  ├── Claude native         → extract entities/LSI/variations
  └── Write CSV files       → entities.csv, lsi.csv, variations.csv
```

## Scope & Security

Read-only SEO keyword analysis. Does NOT modify websites, generate content, or build links.
Refuse: scraping private data, ranking manipulation, spam generation.

## Workflow

### Step 1: Fetch SERP + Pages

Call MCP tool `full_seo_pipeline` from **seo-tools** server:

```
full_seo_pipeline(keyword="<keyword>", language="<language>", serp_depth=<depth>)
```

Output JSON contains:
- `serp_results.organic_results[]` — URLs, titles, descriptions, rankings
- `serp_results.related_searches[]`, `serp_results.people_also_ask[]`
- `pages[]` — each with `plain_text`, `html_elements`, `is_valid`

### Step 2: Extract SEO Data (Claude Native)

Combine `plain_text` from all valid pages (is_valid=true). For the target keyword, extract:

**Entities** — Named entities found in text.
For each: `name`, `type` (Person, Organization, Location, Topic, Product, Technology, Event, etc.), `count` (case-insensitive occurrences in combined text), `relevance` (0.0-1.0 semantic proximity to keyword).

**LSI Keywords** — Latent Semantic Indexing keywords. Semantically related terms co-occurring with the keyword.
For each: `term`, `count`, `relevance` (0.0-1.0).

**Keyword Variations** — Different forms, synonyms, long-tail variations of the target keyword.
For each: `term`, `count`, `relevance` (0.0-1.0).

**Extraction Rules:**
- Only items actually appearing in text (count > 0)
- Count = case-insensitive occurrences in combined plain_text
- Relevance: 1.0=direct synonym, 0.7-0.9=closely related, 0.4-0.6=moderate, 0.1-0.3=loose
- Deduplicate case-insensitive
- Exclude generic/noise terms: social platforms (facebook, youtube, tiktok...), e-commerce (shopee, lazada...), country names, generic web words (click, home, subscribe...)
- Sort by relevance desc, then count desc

### Step 3: Map Entities to Wikipedia/Wikidata

**CRITICAL: Every entity MUST be resolved via entity-finder.**

Use entity-finder CLI to search and resolve each entity:

```bash
EF="/home/binh/work/backend/entity_finder/.venv/bin/python3 /home/binh/work/backend/entity_finder/src/cli.py"

# Step 3a: Search each entity on Wikidata (parallel Bash calls)
$EF search-entities "<entity_name>" --lang <lang_code> --limit 3

# Step 3b: For each match, get full details with Wikipedia URL
$EF get-entity <Q_ID> --lang <lang_code>
```

**Search strategy:**
1. Search exact entity name with `--lang` matching analysis language
2. If no results: try English equivalent with `--lang en`
3. If still none: try acronym/short form, then `search-wikipedia` as fallback
4. Use SHORT EXACT keywords, not descriptive phrases

**Mapping rules:**
- Pick the most relevant Wikidata result (match description to context)
- Extract: `wikidata_id` (Q-ID), `wikidata_url`, `wikipedia_url`
- If entity not found: leave fields empty (not null, just empty string)
- Prefer Wikipedia URL in analysis language, fallback to English

**Parallelism:** Batch all `search-entities` calls together in one message (multiple parallel Bash calls). Then batch all `get-entity` calls together.

### Step 4: Save CSV Output

Create output directory and write 3 CSV files:

```bash
mkdir -p /tmp/seo-mcp/<safe_keyword>/
```

**entities.csv** — All entities with Wikidata/Wikipedia mapping:
```csv
name,type,count,relevance,wikidata_id,wikidata_url,wikipedia_url
SEO,Topic,45,0.95,Q180711,https://www.wikidata.org/wiki/Q180711,https://en.wikipedia.org/wiki/Search_engine_optimization
Google,Organization,32,0.85,Q95,https://www.wikidata.org/wiki/Q95,https://en.wikipedia.org/wiki/Google
```

**lsi.csv** — LSI keywords:
```csv
term,count,relevance
tối ưu hóa công cụ tìm kiếm,12,0.92
backlink,28,0.88
content marketing,15,0.75
```

**variations.csv** — Keyword variations:
```csv
term,count,relevance
SEO website,18,0.95
dịch vụ SEO,14,0.90
SEO là gì,22,0.88
```

Use the Write tool to create each CSV file directly.

### Step 5: Report

Present structured summary:
- Keyword, language, pages fetched/valid
- Top 10 entities with Wikipedia links (clickable)
- Top 10 LSI keywords
- Top 10 keyword variations
- CSV file paths

## MCP Tools Reference

| Tool | Server | Purpose |
|------|--------|---------|
| `full_seo_pipeline` | seo-tools | SERP + fetch + filter (all-in-one) |
| `get_serp_results` | seo-tools | SERP data only |
| `fetch_and_parse_pages` | seo-tools | Fetch URLs + extract text |

## Entity Finder CLI Reference

```bash
EF="/home/binh/work/backend/entity_finder/.venv/bin/python3 /home/binh/work/backend/entity_finder/src/cli.py"
$EF search-entities "query" --lang vi --limit 3    # Search Wikidata
$EF get-entity Q12345 --lang vi                    # Get entity details + Wikipedia URL
$EF search-wikipedia "query" --lang vi --limit 3   # Fulltext Wikipedia search (fallback)
$EF get-summary "Article Title" --lang vi           # Get Wikipedia summary
```
