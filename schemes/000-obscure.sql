create table obscure
(
	id serial not null,
	term char(64) not null,
	value text not null,
	author char(32) not null,
	submitted timestamp default CURRENT_TIMESTAMP,
	constraint obscure_pk
		primary key (id)
);

alter table obscure owner to root;

create unique index obscure_id_uindex
	on obscure using ??? (id);

