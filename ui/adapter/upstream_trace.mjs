/**
 * upstream_trace.mjs — §7.5 recursive upstream-abnormality collection
 * (registered Part 5 obligation b).
 *
 * Walks result.dependencies through getByResultId (live or retired), layer
 * by layer. Every visited node contributes its warning entries together
 * with the user-confirmation state. Nodes with empty dependencies are
 * leaves (user_input / assumption / constant). A visited-set guards against
 * cycles; entries deduplicate on `${result_id}:${code}`. The trace NEVER
 * writes into the consuming Result's own warnings — it renders in its own
 * "Upstream abnormalities" section, annotated with hop distance
 * (direct = 1) and the source variable.
 */

/**
 * @param {object} result — the consuming Result instance
 * @param {object} deps — {engine, confirmedResultIds}
 * @returns entries: [{resultId, variableId, source, code, message, hops,
 *                     confirmed, retired}]
 */
export function collectUpstreamAbnormalities(result, { engine, confirmedResultIds }) {
  const confirmed = confirmedResultIds ?? new Set();
  const visited = new Set([result.result_id]);
  const seenEntry = new Set();
  const entries = [];

  let frontier = [...result.dependencies];
  let hops = 1;

  while (frontier.length > 0) {
    const next = [];
    for (const resultId of frontier) {
      if (visited.has(resultId)) continue;
      visited.add(resultId);
      const node = engine.getByResultId(resultId);
      if (!node) continue;

      for (const warning of node.warnings) {
        const key = `${node.result_id}:${warning.code}`;
        if (seenEntry.has(key)) continue;
        seenEntry.add(key);
        entries.push({
          resultId: node.result_id,
          variableId: node.variable_id,
          source: node.source,
          code: warning.code,
          message: warning.message,
          hops,
          direct: hops === 1,
          confirmed: confirmed.has(node.result_id),
          retired: engine.getResults(node.variable_id).every((live) => live.result_id !== node.result_id),
        });
      }
      next.push(...node.dependencies);
    }
    frontier = next;
    hops += 1;
  }

  return entries;
}
