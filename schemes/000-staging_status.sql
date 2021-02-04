create type staging_status as enum ('waiting', 'accepted', 'declined', 'request_changes');

alter type staging_status owner to root;

