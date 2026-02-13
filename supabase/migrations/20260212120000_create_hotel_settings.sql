-- Hotel Settings table (single-row configuration)
CREATE TABLE IF NOT EXISTS hotel_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_name text NOT NULL DEFAULT 'Mi Hotel',
  address text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  logo_url text DEFAULT '',
  currency text NOT NULL DEFAULT 'ARS',
  timezone text NOT NULL DEFAULT 'America/Buenos_Aires',
  notification_email_enabled boolean NOT NULL DEFAULT true,
  notification_whatsapp_enabled boolean NOT NULL DEFAULT false,
  notification_send_on_booking boolean NOT NULL DEFAULT true,
  notification_send_on_payment boolean NOT NULL DEFAULT true,
  notification_send_on_check_in boolean NOT NULL DEFAULT true,
  notification_send_on_check_out boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default row
INSERT INTO hotel_settings (hotel_name, address, phone, email)
VALUES ('Hotel Demo', 'Av. Principal 123, Ciudad', '+54 11 1234-5678', 'info@hoteldemo.com');

-- Enable RLS
ALTER TABLE hotel_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can read hotel_settings"
  ON hotel_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update hotel_settings"
  ON hotel_settings FOR UPDATE TO authenticated USING (true);

-- Allow anon read for dev/demo
CREATE POLICY "Anon can read hotel_settings"
  ON hotel_settings FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can update hotel_settings"
  ON hotel_settings FOR UPDATE TO anon USING (true);
