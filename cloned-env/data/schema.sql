-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Categories table
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

-- Tags table
CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

-- Users table with role field for auth
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    first_name TEXT,
    last_name TEXT,
    email TEXT UNIQUE,
    password TEXT NOT NULL,
    phone TEXT,
    user_status INTEGER DEFAULT 1,
    role TEXT DEFAULT 'customer',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Pets table
CREATE TABLE pets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category_id INTEGER,
    status TEXT DEFAULT 'available',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Pet tags junction table
CREATE TABLE pet_tags (
    pet_id INTEGER,
    tag_id INTEGER,
    PRIMARY KEY (pet_id, tag_id),
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Pet photos table
CREATE TABLE pet_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER,
    photo_url TEXT NOT NULL,
    upload_date TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
);

-- Orders table with user_id for ownership tracking
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER,
    user_id INTEGER,
    quantity INTEGER DEFAULT 1,
    ship_date TEXT,
    status TEXT DEFAULT 'placed',
    complete INTEGER DEFAULT 0,
    order_date TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pet_id) REFERENCES pets(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Insert sample categories
INSERT INTO categories (name) VALUES 
    ('Dogs'),
    ('Cats'),
    ('Birds'),
    ('Fish');

-- Insert sample tags
INSERT INTO tags (name) VALUES 
    ('Friendly'),
    ('Energetic'),
    ('Calm'),
    ('Trained'),
    ('Young'),
    ('Adult');

-- Insert test users with proper bcrypt hashed passwords
-- Password is "password" for all test accounts
INSERT INTO users (username, first_name, last_name, email, password, role) VALUES
    ('admin', 'Admin', 'User', 'admin@petstore.com', '$2b$10$QKu3ViFOt0WKM3kOmZrt2eDn2y7c/KLt6073vLknBCH1ajvEIffci', 'admin'),
    ('storeowner', 'Store', 'Owner', 'owner@petstore.com', '$2b$10$QKu3ViFOt0WKM3kOmZrt2eDn2y7c/KLt6073vLknBCH1ajvEIffci', 'store_owner'),
    ('customer1', 'John', 'Doe', 'john@example.com', '$2b$10$QKu3ViFOt0WKM3kOmZrt2eDn2y7c/KLt6073vLknBCH1ajvEIffci', 'customer'),
    ('customer2', 'Jane', 'Smith', 'jane@example.com', '$2b$10$QKu3ViFOt0WKM3kOmZrt2eDn2y7c/KLt6073vLknBCH1ajvEIffci', 'customer');

-- Insert sample pets
INSERT INTO pets (name, category_id, status) VALUES
    ('Buddy', 1, 'available'),
    ('Whiskers', 2, 'available'),
    ('Charlie', 1, 'pending'),
    ('Fluffy', 2, 'sold'),
    ('Tweety', 3, 'available'),
    ('Goldie', 4, 'available');

-- Insert pet-tag relationships
INSERT INTO pet_tags (pet_id, tag_id) VALUES
    (1, 1), (1, 2), -- Buddy: Friendly, Energetic
    (2, 1), (2, 3), -- Whiskers: Friendly, Calm
    (3, 4), (3, 6), -- Charlie: Trained, Adult
    (4, 3), (4, 6), -- Fluffy: Calm, Adult
    (5, 2), (5, 5), -- Tweety: Energetic, Young
    (6, 3), (6, 5); -- Goldie: Calm, Young

-- Insert sample photo URLs
INSERT INTO pet_photos (pet_id, photo_url) VALUES
    (1, 'https://example.com/photos/buddy1.jpg'),
    (1, 'https://example.com/photos/buddy2.jpg'),
    (2, 'https://example.com/photos/whiskers1.jpg'),
    (3, 'https://example.com/photos/charlie1.jpg'),
    (4, 'https://example.com/photos/fluffy1.jpg'),
    (5, 'https://example.com/photos/tweety1.jpg'),
    (6, 'https://example.com/photos/goldie1.jpg');

-- Insert sample orders
INSERT INTO orders (pet_id, user_id, quantity, status, ship_date) VALUES
    (3, 3, 1, 'approved', '2024-01-15T10:00:00Z'),  -- customer1 ordered Charlie (pending pet)
    (4, 4, 1, 'delivered', '2024-01-10T10:00:00Z'); -- customer2 ordered Fluffy (sold pet)