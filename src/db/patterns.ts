export const queries = {
    insertTerm: 'INSERT INTO obscure(term, value, author) VALUES($1, $2, $3) RETURNING id',
    insertStg: 'INSERT INTO staging(term, value, author) VALUES($1, $2, $3) RETURNING id',
    lastIndex: 'SELECT max(id) FROM obscure',
    obscureCache: 'SELECT id, term, value, synonyms FROM obscure ORDER BY id',
    stagingEntry: 'SELECT id, term, value, author FROM staging WHERE status=\'waiting\' ORDER BY id LIMIT 1',
    updateStaging: 'UPDATE staging SET (status, updated, reviewed_by, accepted_as) = ($1, CURRENT_TIMESTAMP, $2, $3) WHERE id = $4',
    insertSynonym: 'UPDATE obscure SET synonyms = array_prepend($1, synonyms) WHERE id = $2',
    moderatorCache: 'SELECT user_id FROM moderators ORDER BY id',
    insertModerator: 'INSERT INTO moderators(user_id, promoted_by) VALUES ($1,$2) RETURNING id'
}