create table obscure
(
    id        serial                       not null,
    term      text                         not null,
    value     text                         not null,
    author    text                         not null,
    submitted timestamp default CURRENT_TIMESTAMP,
    synonyms  text      default '[]'::text not null,
    constraint obscure_pk
        primary key (id)
);

