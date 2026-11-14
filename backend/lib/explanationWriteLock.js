'use strict'

// The source editor and explanation writer share this transaction-scoped lock.
// It is held only while checking/committing data, never during a provider call.
async function lockExplanationTarget(tx, kind, id) {
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1::integer, $2::integer)', kind === 'practice' ? 72414 : 72413, Number(id))
}

module.exports = { lockExplanationTarget }
