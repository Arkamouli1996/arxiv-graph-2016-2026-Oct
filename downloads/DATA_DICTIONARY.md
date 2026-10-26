# Data dictionary

## Paper records (`papers.parquet`, `papers.csv.gz`)

| Column | Meaning |
|---|---|
| `id` | Base arXiv ID without `v1`, `v2`, etc.; unique row key. |
| `title`, `authors`, `abstract` | Current metadata at source retrieval; authors are a list, without author identity disambiguation. |
| `submitted` | First-submission timestamp in UTC, copied from Atom `published`. |
| `updated`, `version` | Latest revision timestamp and version in the retrieved metadata. |
| `primary_category` | Normalized primary category; can be outside the 32 requested categories. |
| `categories` | List of normalized memberships in the 32 requested categories only. |
| `categories_raw` | All original category labels returned by arXiv, including aliases and categories outside the requested list. |
| `comments`, `doi` | Unmodified source metadata after whitespace normalization. Comments were not used as authoritative page counts. |
| `week` | Monday UTC at the start of the submission week. |
| `month` | Actual submission month, `YYYY-MM`. |
| `pages_v1` | Integer physical page count of version 1; null if unavailable. |
| `page_status` | `measured` or `unavailable` in the finished dataset. `not measured` is a collection-progress state only. |
| `page_bin` | Inclusive physical-page group: 1–5, 6–10, 11–20, 21–30, 31–40, 41–99, 100+; null if unknown. |
| `page_source` | Measured PDF source URL, normally a GCS object pinned by generation or a versioned arXiv export URL. Some carried-over pilot rows have a method description here; use their `v1_pdf_url`. |
| `pdf_sha256` | Full-file checksum retained from the pilot where available. Most range-count rows do not have a full-file hash; their exact range hashes are in `page_proofs.jsonl.gz`. New full-file recovery hashes are also in those receipts. |
| `abstract_url` | Current arXiv title/subjects page. |
| `date_evidence_url` | arXiv v1 page and submission history for checking `submitted`. |
| `v1_pdf_url` | Original arXiv version-1 PDF link. |

CSV list columns are JSON strings. Parquet list columns are typed lists. Empty numeric CSV values correspond to nulls, not zero.

## Weekly and monthly aggregates

`mode` is `memberships` (cross-listings included) or `primary`. `category` is a requested category code or `all` for the deduplicated overall scope. `category_name` is a display label where supplied.

| Column | Meaning |
|---|---|
| `n` | Distinct paper IDs in this scope and interval. Zero means a genuinely empty, fully collected interval. |
| `measured`, `unknown` | PDFs with measured lengths, and papers whose length is unavailable. These sum to `n`. |
| `coverage` | `measured / n`, or null for an empty interval. |
| `b1` … `b7` | Counts in 1–5, 6–10, 11–20, 21–30, 31–40, 41–99, and 100+ pages, respectively. They sum to `measured`. |
| `short5`, `short10` | Counts in 1–5 and 1–10 pages, respectively. |
| `short5Share`, `shortShare` | Corresponding counts divided by `measured`; null if no PDFs are measured. |
| `median`, `q25`, `q75` | Exact median and interpolated 25th/75th percentiles of individual measured page lengths. Quantiles use linear interpolation at `(N−1)q`. |
| `week`, `end` | Monday and Sunday UTC calendar dates for a weekly row. |
| `partial` | The first or final boundary week has less than seven full days in the dataset. |
| `metadata_complete` | All source-month partitions needed by this row were collected and reconciled. |
| `iso_year`, `iso_week` | ISO week calendar coordinates; distinct from the submission calendar year around New Year. |
| `context_event` | Source-backed ChatGPT launch-week annotation text, where relevant. |

Monthly rows use actual `month`; annual rows use actual calendar `year`. `monthly_weekly_counts.csv` splits every week at calendar-month boundaries. It is a separate overlapping representation and must not be added to weekly totals.

`context_periods.csv` groups only complete weeks wholly inside each event-defined interval. `papers_per_week = n / weeks`. The intervals have different lengths and seasonal coverage; the table is descriptive and is not a causal comparison. `from_week` and `to_week` identify the exact contributing weeks.

## Matched comparisons and field-mixture adjustment

`matched_comparisons.csv` uses the same ISO week numbers in 2016 and 2026. It supplies all baseline/current paper counts, weekly averages, measured counts and coverage. `volumeGrowth = current_papers / baseline_papers − 1`, as a fraction. `short_change_pp` is the current minus baseline ≤10-page share multiplied by 100, in percentage points.

`standardized_shares.csv` uses primary categories and the same complete week numbers in every year. `rawShortShare` is the observed pooled ≤10-page share. `standardizedShortShare` holds each field's weight at its 2016 share of measured primary-category papers. `mix_difference_pp = 100 × (rawShortShare − standardizedShortShare)`. All field/year shares and `baseline_weight` values appear in `standardized_field_inputs.csv`.

## PDF measurement receipts

Decompress `page_proofs.jsonl.gz` and select the JSON record whose `id` matches the paper. A measured row has `pages`, `status`, `source_url`, `method` and a measurement timestamp. GCS range reads also provide the immutable `generation`, `etag`, total bytes read and a `range_hashes` list. Each member identifies the actual `Content-Range`, its SHA-256 checksum and byte count. Retrieve the pinned source URL with the corresponding HTTP Range header to independently check those bytes.

Full-file checks supply `pdf_sha256`, `bytes_read`, `native_pages` and `poppler_pages`; those two page counts must agree. A dedicated-export catch-up receipt has `selective_catchup: true`. Unavailable rows retain the error and attempted source; they never supply zero pages.
