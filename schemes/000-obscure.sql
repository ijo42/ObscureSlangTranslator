create table obscure
(
	id serial not null,
	term text not null,
	value text not null,
	author text not null,
	submitted timestamp default CURRENT_TIMESTAMP,
	constraint obscure_pk
		primary key (id)
);

alter table obscure owner to root;

