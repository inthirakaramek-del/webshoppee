-- Supabase Schema for Minimalist Fashion Brand SPA

-- Drop tables if they exist (for easy resetting)
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS collections;

-- Create Collections Table
CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    image TEXT NOT NULL,
    showcase_image TEXT,
    color_tone TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Migration: Add showcase_image and color_tone to existing table (run in Supabase SQL editor if table already exists)
ALTER TABLE collections ADD COLUMN IF NOT EXISTS showcase_image TEXT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS color_tone TEXT;

-- Create Products Table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- e.g., 'Tops', 'Bottoms', 'Accessories'
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    image TEXT NOT NULL,
    affiliate_link TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable Row-Level Security (RLS)
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create public read policies (Anyone can view collections and products)
CREATE POLICY "Allow public read access on collections" 
ON collections FOR SELECT 
USING (true);

CREATE POLICY "Allow public read access on products" 
ON products FOR SELECT 
USING (true);

-- Create full write policies (For admin dashboard, since we check password in frontend / client API)
-- Note: In a production environment, you would use Supabase Auth and restrict these policies to authenticated users.
-- For a fast & simple setup, we allow all operations. We will protect updates with a client-side API/token check 
-- or you can configure standard Supabase Auth rules.
CREATE POLICY "Allow all operations for everyone" 
ON collections FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations for everyone on products" 
ON products FOR ALL 
USING (true)
WITH CHECK (true);

-- Enable Realtime for collections and products tables
-- This allows the frontend to receive instant updates when data changes
ALTER PUBLICATION supabase_realtime ADD TABLE collections;
ALTER PUBLICATION supabase_realtime ADD TABLE products;

-- Insert Sample Minimalist Collections
INSERT INTO collections (id, title, image, description) VALUES
('b3c8f8a1-5a3d-4c3e-8f92-5b82cb1b0f1a', 'NOIR CAPSULE', 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1200&auto=format&fit=crop', 'Sleek, structure-driven monochrome staples designed for the modern metropolitan silhouette.'),
('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'NEUTRAL ESSENTIALS', 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&auto=format&fit=crop', 'Earth tones, lightweight fabrics, and relaxed tailoring optimized for effortless everyday comfort.'),
('f8e7d6c5-b4a3-2f1e-0d9c-8b7a6f5e4d3c', 'DUSK MONOCHROME', 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?q=80&w=1200&auto=format&fit=crop', 'Transition garments that blur the line between daytime sophistication and nighttime allure.');

-- Insert Sample Products for Noir Capsule
INSERT INTO products (collection_id, category, name, price, image, affiliate_link) VALUES
('b3c8f8a1-5a3d-4c3e-8f92-5b82cb1b0f1a', 'Tops', 'Oversized Silk Poplin Shirt', 1890.00, 'https://images.unsplash.com/photo-1603252109303-2751441dd157?q=80&w=800&auto=format&fit=crop', 'https://example.com/buy/silk-poplin-shirt'),
('b3c8f8a1-5a3d-4c3e-8f92-5b82cb1b0f1a', 'Tops', 'Asymmetric Ribbed Bodysuit', 1250.00, 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?q=80&w=800&auto=format&fit=crop', 'https://example.com/buy/ribbed-bodysuit'),
('b3c8f8a1-5a3d-4c3e-8f92-5b82cb1b0f1a', 'Bottoms', 'High-Waist Tailored Trousers', 2490.00, 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&w=800&auto=format&fit=crop', 'https://example.com/buy/tailored-trousers'),
('b3c8f8a1-5a3d-4c3e-8f92-5b82cb1b0f1a', 'Bottoms', 'Structured Pleated Skirt', 1950.00, 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=800&auto=format&fit=crop', 'https://example.com/buy/pleated-skirt'),
('b3c8f8a1-5a3d-4c3e-8f92-5b82cb1b0f1a', 'Accessories', 'Chunky Leather Platform Boots', 4500.00, 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?q=80&w=800&auto=format&fit=crop', 'https://example.com/buy/platform-boots');

-- Insert Sample Products for Neutral Essentials
INSERT INTO products (collection_id, category, name, price, image, affiliate_link) VALUES
('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Tops', 'Cashmere Knit Vest', 2200.00, 'https://images.unsplash.com/photo-1574164904299-3a102b110380?q=80&w=800&auto=format&fit=crop', 'https://example.com/buy/cashmere-vest'),
('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Tops', 'Relaxed Linen Blazer', 3890.00, 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=800&auto=format&fit=crop', 'https://example.com/buy/linen-blazer'),
('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Bottoms', 'Wide-Leg Pleated Shorts', 1490.00, 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?q=80&w=800&auto=format&fit=crop', 'https://example.com/buy/pleated-shorts'),
('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Accessories', 'Minimalist Woven Tote', 2900.00, 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=800&auto=format&fit=crop', 'https://example.com/buy/woven-tote');

-- Insert Sample Products for Dusk Monochrome
INSERT INTO products (collection_id, category, name, price, image, affiliate_link) VALUES
('f8e7d6c5-b4a3-2f1e-0d9c-8b7a6f5e4d3c', 'Tops', 'Sheer Silk Organza Blouse', 2650.00, 'https://images.unsplash.com/photo-1551163943-3f6a855d1153?q=80&w=800&auto=format&fit=crop', 'https://example.com/buy/organza-blouse'),
('f8e7d6c5-b4a3-2f1e-0d9c-8b7a6f5e4d3c', 'Bottoms', 'Satin Slip Midi Skirt', 1890.00, 'https://images.unsplash.com/photo-1577900232427-18219b9166a0?q=80&w=800&auto=format&fit=crop', 'https://example.com/buy/midi-skirt'),
('f8e7d6c5-b4a3-2f1e-0d9c-8b7a6f5e4d3c', 'Accessories', 'Fine Chain Sterling Necklace', 1190.00, 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=800&auto=format&fit=crop', 'https://example.com/buy/necklace');

-- Create Page Visits Stats Table
CREATE TABLE IF NOT EXISTS page_visits (
    id TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Insert initial record if not exists
INSERT INTO page_visits (id, count) 
VALUES ('home', 0) 
ON CONFLICT (id) DO NOTHING;

-- Enable Row-Level Security (RLS)
ALTER TABLE page_visits ENABLE ROW LEVEL SECURITY;

-- Create policy to allow everyone to view and modify page visits
CREATE POLICY "Allow public select and update on page_visits" 
ON page_visits FOR ALL 
USING (true)
WITH CHECK (true);

-- Enable Realtime for page_visits table
ALTER PUBLICATION supabase_realtime ADD TABLE page_visits;

-- Storage policies for 'fashion-images' bucket
-- Note: Create the bucket named 'fashion-images' as a Public bucket in your Supabase Storage dashboard first.
CREATE POLICY "Allow public uploads on fashion-images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'fashion-images');

CREATE POLICY "Allow public read access on fashion-images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'fashion-images');

-- Create Settings Table for Brand Config
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Seed Initial Vandalyn Brand Config
INSERT INTO settings (key, value) VALUES
('tiktok_link', 'https://www.tiktok.com/'),
('lemon8_link', 'https://www.lemon8-app.com/'),
('hero_title', 'Welcome to Our Wardrobe'),
('hero_subtitle', 'Hi! ยินดีต้อนรับค่ะซิส อยากได้ลุคไหน วันนี้เราคัดพิกัดชุดสวยราคาดีมาให้แล้ว เลือกช้อปกันได้เลยจ้า'),
('hero_image', 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1600&auto=format&fit=crop')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


-- Enable Row-Level Security (RLS)
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow everyone to view settings
CREATE POLICY "Allow public read on settings" 
ON settings FOR SELECT 
USING (true);

-- Create policy to allow everyone to modify settings (for simplicity in our admin portal)
CREATE POLICY "Allow all actions on settings for everyone" 
ON settings FOR ALL 
USING (true)
WITH CHECK (true);

-- Enable Realtime for settings table
ALTER PUBLICATION supabase_realtime ADD TABLE settings;

-- Create Tone Categories Table
CREATE TABLE IF NOT EXISTS tone_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    image TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS and Realtime for tone_categories
ALTER TABLE tone_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on tone_categories" 
ON tone_categories FOR SELECT USING (true);

CREATE POLICY "Allow all operations for everyone on tone_categories" 
ON tone_categories FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE tone_categories;

-- Insert Sample Tone Categories
INSERT INTO tone_categories (id, name, image, description) VALUES
('c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c', 'NOIR / BLACK', 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800&auto=format&fit=crop', 'โทนสีดำ คลาสสิก เรียบหรู ทรงพลัง'),
('d2b3c4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d', 'NEUTRAL / WHITE', 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=800&auto=format&fit=crop', 'โทนสีขาว ครีม มินิมอล สะอาดตา'),
('e3c4d5e6-f7a8-9b0c-1d2e-3f4a5b6c7d8e', 'EARTH TONE', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=800&auto=format&fit=crop', 'โทนสีน้ำตาล เบจ อุ่น เป็นธรรมชาติ'),
('f4d5e6f7-a8b9-0c1d-2e3f-4a5b6c7d8e9f', 'PASTEL / PINK', 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?q=80&w=800&auto=format&fit=crop', 'โทนสีพาสเทล ชมพู ละมุน อ่อนหวาน')
ON CONFLICT (name) DO NOTHING;


