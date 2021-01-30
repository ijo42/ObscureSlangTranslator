export const queries = {
    insertTerm: 'INSERT INTO obscure(term, value, author) VALUES($1, $2, $3) RETURNING id, term',
    lastIndex: 'SELECT max(id) FROM obscure',
    obscureCache: 'SELECT term, value, synonyms FROM obscure ORDER BY id'
}