Use `$wingmanpm-product-designer` in read-only planning mode. Do not edit files.

For each benchmark in `evals/benchmarks.json`, give one compact decision record
with: classification, references to load, required user gate, blocking proof,
and one main risk. Preserve existing product authority. Return JSON only as an
object with a `results` array. Each item has `id`, `classification`, `decision`,
`proof`, and `risk`.
