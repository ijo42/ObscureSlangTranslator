export const queries = {
    insertTerm: 'INSERT INTO obscure(term, value, author) VALUES($1, $2, $3) RETURNING id',
    lastIndex: 'SELECT max(id) FROM obscure',
    obscureCache: 'SELECT term, value, synonyms FROM obscure ORDER BY id',
    stagingEntry: 'SELECT id, term, value, author FROM staging WHERE status=\'waiting\' ORDER BY id LIMIT 1',
    updateStaging: 'UPDATE staging SET (status, updated, reviewed_by, accepted_as) = ($1, CURRENT_TIMESTAMP, $2, $3) WHERE id = $4'
}