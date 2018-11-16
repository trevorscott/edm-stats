CREATE TABLE button_click (
	id serial PRIMARY KEY,
	uuid VARCHAR(37),
	button_id VARCHAR(90),
	created_date TIMESTAMP NOT NULL
);

CREATE TABLE page_load (
	id serial PRIMARY KEY,
	uuid VARCHAR(37),
	user_device_type VARCHAR(40),
	user_agent text,
	created_date TIMESTAMP NOT NULL
);

ALTER TABLE button_click ADD COLUMN clicks integer;
ALTER TABLE page_load ADD COLUMN loads integer;

ALTER TABLE button_click ALTER COLUMN created_date SET DEFAULT now();