-- Runs once, when the data directory is empty, as POSTGRES_USER on POSTGRES_DB.
--
-- The image creates Speckle's database from POSTGRES_DB; this adds the second
-- one, for the Powerhouse reactor (operation history and read models). One role
-- and two databases is right for a local stack sharing one machine — it is not
-- a deployment layout.
CREATE DATABASE powerhouse;
