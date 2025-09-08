-- Add columns to support dynamic window generation
ALTER TABLE reports ADD COLUMN generation_trigger TEXT; -- 'scheduled' vs 'dynamic'
ALTER TABLE reports ADD COLUMN window_start_time TEXT;  -- actual window bounds
ALTER TABLE reports ADD COLUMN window_end_time TEXT;

-- Create index for generation trigger to support filtering
CREATE INDEX idx_generation_trigger ON reports(generation_trigger);