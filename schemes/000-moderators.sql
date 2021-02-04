create table moderators
(
    id          serial  not null,
    user_id     integer not null,
    promoted_by integer not null,
    constraint moderators_pk
        primary key (id)
);

alter table moderators
    owner to root;

create unique index moderators_id_uindex
    on moderators (id);

create unique index moderators_user_id_uindex
    on moderators (user_id);

