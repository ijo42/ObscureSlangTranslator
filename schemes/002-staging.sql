create table staging
(
    id          serial                                   not null,
    status      staging_status default 'waiting'::staging_status,
    created     timestamp      default CURRENT_TIMESTAMP not null,
    updated     timestamp      default CURRENT_TIMESTAMP not null,
    term        text                                     not null,
    value       text                                     not null,
    author      text                                     not null,
    reviewed_by integer,
    accepted_as integer,
    constraint staging_pk
        primary key (id)
);

alter table staging
    owner to root;

create unique index staging_id_uindex
    on staging (id);

