DO $roles$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'academic_writing_db_owner'
  ) THEN
    CREATE ROLE academic_writing_db_owner
      NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'academic_writing_migrator'
  ) THEN
    CREATE ROLE academic_writing_migrator
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'academic_writing_app'
  ) THEN
    CREATE ROLE academic_writing_app
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END
$roles$;

ALTER ROLE academic_writing_db_owner
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE academic_writing_migrator
  LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE academic_writing_app
  LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

REVOKE academic_writing_db_owner FROM academic_writing_migrator, academic_writing_app;
REVOKE academic_writing_migrator FROM academic_writing_app;
REVOKE academic_writing_app FROM academic_writing_migrator;

DO $database_privileges$
BEGIN
  EXECUTE format(
    'ALTER DATABASE %I OWNER TO academic_writing_db_owner',
    current_database()
  );
  EXECUTE format(
    'REVOKE ALL PRIVILEGES ON DATABASE %I FROM PUBLIC',
    current_database()
  );
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO academic_writing_migrator, academic_writing_app',
    current_database()
  );
END
$database_privileges$;

ALTER SCHEMA public OWNER TO academic_writing_db_owner;
CREATE SCHEMA IF NOT EXISTS drizzle AUTHORIZATION academic_writing_db_owner;
ALTER SCHEMA drizzle OWNER TO academic_writing_db_owner;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public, drizzle FROM academic_writing_migrator, academic_writing_app;

GRANT USAGE, CREATE ON SCHEMA public, drizzle TO academic_writing_migrator;
GRANT USAGE ON SCHEMA public, drizzle TO academic_writing_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO academic_writing_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO academic_writing_app;
GRANT SELECT ON ALL TABLES IN SCHEMA drizzle TO academic_writing_app;

ALTER DEFAULT PRIVILEGES FOR ROLE academic_writing_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO academic_writing_app;
ALTER DEFAULT PRIVILEGES FOR ROLE academic_writing_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO academic_writing_app;
ALTER DEFAULT PRIVILEGES FOR ROLE academic_writing_migrator IN SCHEMA public
  GRANT USAGE ON TYPES TO academic_writing_app;
ALTER DEFAULT PRIVILEGES FOR ROLE academic_writing_migrator IN SCHEMA drizzle
  GRANT SELECT ON TABLES TO academic_writing_app;
