-- Migration to create cold email related tables

CREATE TABLE IF NOT EXISTS cold_email_campaigns (
  campaign_id SERIAL PRIMARY KEY,
  campaign_name VARCHAR(255) NOT NULL,
  description TEXT,
  objective TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'Draft',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cold_email_contacts (
  contact_id SERIAL PRIMARY KEY,
  campaign_id INT REFERENCES cold_email_campaigns(campaign_id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  company VARCHAR(255),
  designation VARCHAR(255),
  phone VARCHAR(50),
  country VARCHAR(100),
  status VARCHAR(20) DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cold_email_templates (
  template_id SERIAL PRIMARY KEY,
  campaign_id INT REFERENCES cold_email_campaigns(campaign_id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  variation_no INT NOT NULL,
  status VARCHAR(20) DEFAULT 'Ready',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cold_email_queue (
  queue_id SERIAL PRIMARY KEY,
  campaign_id INT REFERENCES cold_email_campaigns(campaign_id) ON DELETE CASCADE,
  contact_id INT REFERENCES cold_email_contacts(contact_id) ON DELETE CASCADE,
  template_id INT REFERENCES cold_email_templates(template_id) ON DELETE CASCADE,
  scheduled_time TIMESTAMP WITH TIME ZONE,
  sent_time TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'Pending',
  retry_count INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cold_email_followups (
  followup_id SERIAL PRIMARY KEY,
  campaign_id INT REFERENCES cold_email_campaigns(campaign_id) ON DELETE CASCADE,
  sequence_no INT NOT NULL,
  delay_days INT NOT NULL,
  template_id INT REFERENCES cold_email_templates(template_id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS cold_email_replies (
  reply_id SERIAL PRIMARY KEY,
  campaign_id INT REFERENCES cold_email_campaigns(campaign_id) ON DELETE CASCADE,
  contact_id INT REFERENCES cold_email_contacts(contact_id) ON DELETE CASCADE,
  classification VARCHAR(50),
  message TEXT,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cold_email_events (
  event_id SERIAL PRIMARY KEY,
  campaign_id INT REFERENCES cold_email_campaigns(campaign_id) ON DELETE CASCADE,
  contact_id INT REFERENCES cold_email_contacts(contact_id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);
