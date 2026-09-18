-- Up Migration
CREATE TABLE readings (
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL,
  solar_power_kw numeric(12, 3) NOT NULL CHECK (solar_power_kw >= 0 AND solar_power_kw <= 1000000),
  ac_voltage_v numeric(7, 2) CHECK (ac_voltage_v >= 0 AND ac_voltage_v <= 600),
  inverter_temp_c numeric(6, 2) CHECK (inverter_temp_c >= -50 AND inverter_temp_c <= 150),
  source text NOT NULL DEFAULT 'simulated' CHECK (source = 'simulated'),
  PRIMARY KEY (site_id, recorded_at)
);

CREATE TABLE alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('high_temperature', 'voltage_out_of_range')),
  measured_value double precision NOT NULL,
  triggered_at timestamptz NOT NULL,
  resolved_at timestamptz
);
CREATE UNIQUE INDEX alerts_one_open_type ON alerts (site_id, type) WHERE resolved_at IS NULL;
CREATE INDEX alerts_site_time ON alerts (site_id, triggered_at DESC);

-- Down Migration
DROP TABLE alerts;
DROP TABLE readings;
