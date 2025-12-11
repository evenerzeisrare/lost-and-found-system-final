require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');

const app = express();


const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        const name = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}${ext}`;
        cb(null, name);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});


const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size too large. Maximum is 5MB' });
        }
        return res.status(400).json({ error: err.message });
    } else if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
};

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'assets')));
app.use('/uploads', express.static(uploadsDir));

app.use(session({
    secret: process.env.SESSION_SECRET || 'csu-bsta-secret',
    resave: true, 
    saveUninitialized: false,
    cookie: { 
        secure: false, 
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax'
    },
    store: new (require('session-memory-store')(session))() 
}));

app.use(passport.initialize());
app.use(passport.session());


let pool;

async function initializeDatabase() {
    try {
        pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'csu_lost_found',
            port: process.env.DB_PORT || 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        const connection = await pool.getConnection();
        console.log('✅ Database connected successfully');
        
        try {
            const [imgUrlCol] = await connection.execute(`SHOW COLUMNS FROM items LIKE 'image_url'`);
            if (imgUrlCol.length === 0) {
                await connection.execute(`ALTER TABLE items ADD COLUMN image_url VARCHAR(500) NULL`);
                console.log('✅ Added missing items.image_url column');
            }
        } catch (e) {
            console.log('⚠️ Could not verify/add image_url column:', e.message);
        }

        try {
            const [msgImgCol] = await connection.execute(`SHOW COLUMNS FROM messages LIKE 'image_url'`);
            if (msgImgCol.length === 0) {
                await connection.execute(`ALTER TABLE messages ADD COLUMN image_url VARCHAR(500) NULL`);
                console.log('✅ Added missing messages.image_url column');
            }
        } catch (e) {
            console.log('⚠️ Could not verify/add messages.image_url column:', e.message);
        }

        try {
            await connection.execute('SELECT 1 FROM users LIMIT 1');
            console.log('✅ Users table exists');
        } catch (error) {
            console.log('⚠️ Users table might not exist, running database.sql is recommended');
        }
        
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        
        try {
            pool = mysql.createPool({
                host: 'localhost',
                user: 'root',
                password: '',
                database: 'csu_lost_found',
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            });
            
            const connection = await pool.getConnection();
            console.log('✅ Connected with default credentials');
            connection.release();
            return true;
        } catch (error2) {
            console.error('❌ Both connection attempts failed:', error2.message);
            return false;
        }
    }
}

//Google ID na part
passport.use('local', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
}, async (email, password, done) => {
    try {
        if (!pool) {
            console.error('Database pool not initialized');
            return done(new Error('Database not available'));
        }
        
        const connection = await pool.getConnection();
        const [rows] = await connection.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        connection.release();

        if (rows.length === 0) {
            return done(null, false, { message: 'Invalid account. Please register using your CSU email.' });
        }

        const user = rows[0];

        if (user.role !== 'admin' && !email.endsWith('@carsu.edu.ph')) {
            return done(null, false, { message: 'Please use a valid @carsu.edu.ph email address' });
        }

        if (!user.is_active) {
            return done(null, false, { message: 'Your account has been deactivated by the system. Please go to the Lost and Found Team at Hiraya CL5.' });
        }

        if (!user.password) {
            return done(null, false, { message: 'Please use Google Sign-In for this account or contact admin.' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return done(null, false, { message: 'Incorrect email or password.' });
        }

        return done(null, user);
    } catch (error) {
        console.error('Login error:', error);
        return done(error);
    }
}));


passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const connection = await pool.getConnection();
        const email = profile.emails[0].value;
        

        if (!email.endsWith('@carsu.edu.ph') && email !== 'lostfound.devteam@gmail.com') {
            connection.release();
            return done(null, false, { message: 'Only CSU email addresses (@carsu.edu.ph) are allowed for students. Admins must use the designated admin email.' });
        }
        
 
        const [existingUser] = await connection.execute(
            'SELECT * FROM users WHERE google_id = ? OR email = ?',
            [profile.id, email]
        );

        if (existingUser.length > 0) {

            await connection.execute(
                'UPDATE users SET google_id = ?, avatar_url = ? WHERE id = ?',
                [profile.id, profile.photos[0]?.value, existingUser[0].id]
            );
            connection.release();
            return done(null, existingUser[0]);
        }

        let role = 'student';
        if (email === 'lostfound.devteam@gmail.com') {
            role = 'admin';
        } else if (!email.endsWith('@carsu.edu.ph')) {
            connection.release();
            return done(null, false, { message: 'Only @carsu.edu.ph emails are allowed for student registration' });
        }
        

        const [result] = await connection.execute(
            `INSERT INTO users (full_name, email, google_id, avatar_url, role) 
             VALUES (?, ?, ?, ?, ?)`,
            [profile.displayName, email, profile.id, profile.photos[0]?.value, role]
        );
        
        const [newUser] = await connection.execute(
            'SELECT * FROM users WHERE id = ?',
            [result.insertId]
        );
        
        connection.release();
        return done(null, newUser[0]);
    } catch (error) {
        console.error('Google Auth error:', error);
        return done(error);
    }
}));


passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        if (!pool) {
            console.error('Database pool not initialized in deserializeUser');
            return done(new Error('Database not available'));
        }
        
        const connection = await pool.getConnection();
        const [rows] = await connection.execute(
            'SELECT id, full_name, email, student_id, role, avatar_url, is_active FROM users WHERE id = ?',
            [id]
        );
        connection.release();
        
        if (rows.length === 0) {
            console.log('User not found in database for id:', id);
            return done(null, false);
        }
        
        done(null, rows[0]);
    } catch (error) {
        console.error('Deserialize error:', error);
        done(error);
    }
});



function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        if (req.user.is_active === false) {
            req.logout((err) => {
                if (err) console.error('Logout error:', err);
            });
            return res.status(403).json({ error: 'Account deactivated' });
        }
        return next();
    }
    
    console.log('Not authenticated - req.isAuthenticated():', req.isAuthenticated());
    console.log('Session ID:', req.sessionID);
    console.log('User in session:', req.user);
    
    res.status(401).json({ error: 'Not authenticated' });
}

function ensureAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.role === 'admin' && req.user.is_active !== false) {
        return next();
    }
    console.log('Admin check failed - Role:', req.user?.role, 'Active:', req.user?.is_active);
    res.status(403).json({ error: 'Access denied. Admin only.' });
}

// authentication routes ni siya sa register part

app.post('/api/register', async (req, res) => {
    try {
        const { fullName, studentId, email, password } = req.body;
        
        if (!email.endsWith('@carsu.edu.ph')) {
            return res.status(400).json({ error: 'Only @carsu.edu.ph emails are allowed for student registration' });
        }
        
        const connection = await pool.getConnection();
        const [existingUser] = await connection.execute(
            'SELECT * FROM users WHERE email = ? OR student_id = ?',
            [email, studentId]
        );
        
        if (existingUser.length > 0) {
            connection.release();
            return res.status(400).json({ error: 'User already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await connection.execute(
            `INSERT INTO users (full_name, student_id, email, password, role) 
             VALUES (?, ?, ?, ?, 'student')`,
            [fullName, studentId, email, hashedPassword]
        );
        
        connection.release();
        res.json({ success: true, message: 'Registration successful' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', (req, res, next) => {
    console.log('Login attempt for email:', req.body.email);
    
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            console.error('Passport auth error:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        
        if (!user) {
            console.log('Authentication failed:', info?.message);
            return res.status(401).json({ error: info?.message || 'Invalid credentials' });
        }
        
        req.login(user, (err) => {
            if (err) {
                console.error('Login session error:', err);
                return res.status(500).json({ error: 'Login failed' });
            }
            
            console.log('Login successful for user:', user.email, 'Role:', user.role);
            return res.json({ 
                success: true, 
                user: {
                    id: user.id,
                    full_name: user.full_name,
                    email: user.email,
                    role: user.role,
                    student_id: user.student_id,
                    avatar_url: user.avatar_url
                },
                redirect: user.role === 'admin' ? '/admin-dashboard.html' : '/student-dashboard.html'
            });
        });
    })(req, res, next);
});

// gooogl auth ni siya  na routes where if magkuha
app.get('/auth/google', passport.authenticate('google', { 
    scope: ['profile', 'email'] 
}));

app.get('/auth/google/callback', 
    passport.authenticate('google', { 
        failureRedirect: '/login.html',
        failureMessage: true 
    }),
    (req, res) => {
        if (req.user.role === 'admin') {
            res.redirect('/admin-dashboard.html');
        } else {
            res.redirect('/student-dashboard.html');
        }
    }
);

app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ 
            user: {
                id: req.user.id,
                full_name: req.user.full_name,
                email: req.user.email,
                role: req.user.role,
                student_id: req.user.student_id,
                avatar_url: req.user.avatar_url,
                is_active: req.user.is_active,
                phone_number: req.user.phone_number,
                contact_method: req.user.contact_method
            }
        });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

app.get('/api/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Logout failed' });
        }
        req.session.destroy();
        res.json({ success: true });
    });
});


app.get(['/', '/index.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/student-dashboard.html', ensureAuthenticated, (req, res) => {
    if (req.user.role !== 'student') {
        return res.redirect('/admin-dashboard.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'student-dashboard.html'));
});

app.get('/admin-dashboard.html', ensureAuthenticated, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.redirect('/student-dashboard.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

// student na part sa dashboard na part 

// Dashboard data
app.get('/api/student/dashboard-data', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const connection = await pool.getConnection();
        
        const [stats] = await connection.execute(`
            SELECT 
                COUNT(CASE WHEN status = 'lost' THEN 1 END) as lost_count,
                COUNT(CASE WHEN status = 'found' THEN 1 END) as found_count,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN claimed_by = ? THEN 1 END) as claimed_count
            FROM items WHERE reported_by = ?
        `, [userId, userId]);
        
        const [recentItems] = await connection.execute(`
            SELECT i.*, u.full_name as reporter_name 
            FROM items i 
            LEFT JOIN users u ON i.reported_by = u.id 
            WHERE i.status IN ('lost', 'found')
            ORDER BY i.created_at DESC LIMIT 8
        `);
        
        const [notifCount] = await connection.execute(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );
        
        const [announcements] = await connection.execute(`
            SELECT a.*, u.full_name as admin_name 
            FROM announcements a 
            LEFT JOIN users u ON a.admin_id = u.id 
            WHERE a.is_active = TRUE 
            ORDER BY a.created_at DESC LIMIT 3
        `);
        
        connection.release();
        
        res.json({
            success: true,
            stats: stats[0] || { lost_count: 0, found_count: 0, pending_count: 0, claimed_count: 0 },
            recentItems: recentItems || [],
            unreadNotifications: notifCount[0]?.count || 0,
            announcements: announcements || []
        });
    } catch (error) {
        console.error('Dashboard data error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});


app.get('/api/student/profile', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const connection = await pool.getConnection();
        
        const [userInfo] = await connection.execute(
            'SELECT id, full_name, email, student_id, phone_number, contact_method, avatar_url FROM users WHERE id = ?',
            [userId]
        );
        
        const [userItems] = await connection.execute(
            `SELECT * FROM items WHERE reported_by = ? ORDER BY created_at DESC LIMIT 6`,
            [userId]
        );
        
        const [stats] = await connection.execute(
            `SELECT 
                COUNT(CASE WHEN status = 'lost' THEN 1 END) as lost_count,
                COUNT(CASE WHEN status = 'found' THEN 1 END) as found_count,
                COUNT(CASE WHEN claimed_by = ? THEN 1 END) as claimed_count
            FROM items WHERE reported_by = ? OR claimed_by = ?`,
            [userId, userId, userId]
        );
        
        connection.release();
        
        res.json({
            success: true,
            user: userInfo[0] || {},
            items: userItems || [],
            stats: stats[0] || { lost_count: 0, found_count: 0, claimed_count: 0 }
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.get('/api/items', ensureAuthenticated, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        await ensureItemDeleteColumn(connection);
        const [items] = await connection.execute(`
            SELECT i.*, u.full_name as reporter_name 
            FROM items i 
            LEFT JOIN users u ON i.reported_by = u.id 
            WHERE i.status IN ('lost', 'found')
            AND (i.deleted_by_reporter IS NULL OR i.deleted_by_reporter = FALSE)
            ORDER BY i.created_at DESC
        `);
        connection.release();
        res.json({ success: true, items: items || [] });
    } catch (error) {
        console.error('Get items error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.get('/api/student/my-items', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const connection = await pool.getConnection();
        await ensureItemDeleteColumn(connection);
        const [items] = await connection.execute(
            'SELECT * FROM items WHERE reported_by = ? AND (deleted_by_reporter IS NULL OR deleted_by_reporter = FALSE) ORDER BY created_at DESC',
            [userId]
        );
        connection.release();
        res.json({ success: true, items: items || [] });
    } catch (error) {
        console.error('My items error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});


app.post('/api/items/report', ensureAuthenticated, upload.single('itemImage'), handleMulterError, async (req, res) => {
    let connection;
    try {
        const userId = req.user.id;
        const { itemName, category, description, place, dateLostFound, status, contactInfo } = req.body;
        
        if (!itemName || !category || !description || !place || !dateLostFound || !status || !contactInfo) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        connection = await pool.getConnection();
        
        let imageUrl = null;
        if (req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
        }

        const [result] = await connection.execute(`
            INSERT INTO items (
                item_name, category, description, place, 
                date_lost_found, status, contact_info, reported_by, image_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [itemName, category, description, place, dateLostFound, status, contactInfo, userId, imageUrl]);
  
        const [lastInsert] = await connection.execute('SELECT LAST_INSERT_ID() as id');
        const itemId = lastInsert[0].id;
        

        await connection.execute(`
            INSERT INTO notifications (user_id, title, message, type, related_id)
            SELECT id, 'New Item Report', ?, 'info', ?
            FROM users WHERE role = 'admin'
        `, [`New ${status} item reported: ${itemName}`, itemId]);
        
        connection.release();
        res.json({
            success: true,
            message: 'Item reported successfully.',
            itemId: itemId
        });
    } catch (error) {
        console.error('Report item error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    } finally {
        if (connection) connection.release();
    }
});

app.put('/api/items/:id', ensureAuthenticated, upload.single('itemImage'), handleMulterError, async (req, res) => {
    let connection;
    try {
        const itemId = req.params.id;
        const userId = req.user.id;
        const { itemName, category, description, place, dateLostFound, status, contactInfo } = req.body;
        
        connection = await pool.getConnection();
        const [items] = await connection.execute('SELECT * FROM items WHERE id = ? AND reported_by = ?', [itemId, userId]);
        if (items.length === 0) {
            connection.release();
            return res.status(403).json({ error: 'Not authorized to edit this item' });
        }
        
        let imageUrl = items[0].image_url;
        if (req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
        }
        
        await connection.execute(`
            UPDATE items SET 
                item_name = ?, category = ?, description = ?, place = ?, 
                date_lost_found = ?, status = ?, contact_info = ?, image_url = ?
            WHERE id = ?
        `, [itemName, category, description, place, dateLostFound, status, contactInfo, imageUrl, itemId]);
        
        connection.release();
        res.json({ success: true, message: 'Item updated successfully' });
    } catch (error) {
        console.error('Update item error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/api/items/:id', ensureAuthenticated, async (req, res) => {
    let connection;
    try {
        const itemId = req.params.id;
        const userId = req.user.id;
        
        connection = await pool.getConnection();
        await ensureItemDeleteColumn(connection);
        const [items] = await connection.execute('SELECT * FROM items WHERE id = ? AND reported_by = ?', [itemId, userId]);
        if (items.length === 0) {
            connection.release();
            return res.status(403).json({ error: 'Not authorized to delete this item' });
        }
        await connection.execute('UPDATE items SET deleted_by_reporter = TRUE WHERE id = ?', [itemId]);
        connection.release();
        res.json({ success: true, message: 'Item marked deleted for admin review' });
    } catch (error) {
        console.error('Delete item error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/api/notifications/:id', ensureAuthenticated, async (req, res) => {
    try {
        const notificationId = req.params.id;
        const connection = await pool.getConnection();
        await connection.execute('DELETE FROM notifications WHERE id = ? AND user_id = ?', [notificationId, req.user.id]);
        connection.release();
        res.json({ success: true, message: 'Notification deleted' });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});


app.get('/api/items/:id/image', async (req, res) => {
    try {
        const itemId = req.params.id;
        const connection = await pool.getConnection();
        
     
        const [rows] = await connection.execute(
            'SELECT image_base64, image_url FROM items WHERE id = ?',
            [itemId]
        );
        
        connection.release();
        
        if (rows.length === 0) {
            return res.status(404).send('Item not found');
        }
        
        const item = rows[0];
        
      
        if (item.image_base64) {
            const imgBuffer = Buffer.from(item.image_base64, 'base64');
            res.writeHead(200, {
                'Content-Type': 'image/jpeg',
                'Content-Length': imgBuffer.length
            });
            return res.end(imgBuffer);
        }
        
        if (item.image_url) {
            if (item.image_url.startsWith('data:image')) {
         
                const base64Data = item.image_url.replace(/^data:image\/\w+;base64,/, '');
                const imgBuffer = Buffer.from(base64Data, 'base64');
                res.writeHead(200, {
                    'Content-Type': 'image/jpeg',
                    'Content-Length': imgBuffer.length
                });
                return res.end(imgBuffer);
            } else {
        
                return res.redirect(item.image_url);
            }
        }
        

        return res.status(404).send('Image not found');
    } catch (error) {
        console.error('Get image error:', error);
        res.status(500).send('Server error');
    }
});

app.post('/api/items/:id/claim', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const itemId = req.params.id;
        const { claimer_id } = req.body;
        const connection = await pool.getConnection();
        
        const [item] = await connection.execute(
            'SELECT * FROM items WHERE id = ? AND status = "found"',
            [itemId]
        );
        
        if (item.length === 0) {
            connection.release();
            return res.status(400).json({ error: 'Item not found or cannot be claimed' });
        }
        if (!claimer_id) {
            connection.release();
            return res.status(400).json({ error: 'claimer_id is required' });
        }
        const [userRows] = await connection.execute('SELECT id FROM users WHERE id = ? AND is_active = TRUE', [claimer_id]);
        if (userRows.length === 0) {
            connection.release();
            return res.status(400).json({ error: 'Claimer not found or inactive' });
        }
        
        await connection.execute(
            'UPDATE items SET claimed_by = ?, status = "claimed" WHERE id = ?',
            [claimer_id, itemId]
        );
        
        await connection.execute(
            'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)',
            [item[0].reported_by, 'Item Claimed', `Your item "${item[0].item_name}" has been marked claimed by admin`, 'claim', itemId]
        );
        
        await connection.execute(`
            INSERT INTO notifications (user_id, title, message, type, related_id)
            SELECT id, 'Item Claimed', ?, 'info', ?
            FROM users WHERE role = 'admin'
        `, [`Item "${item[0].item_name}" was approved as claimed`, itemId]);

        await connection.execute(
            'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)',
            [claimer_id, 'Claim Approved', `Your claim for item "${item[0].item_name}" was approved by admin`, 'success', itemId]
        );
        
        connection.release();
        res.json({ success: true, message: 'Claim approved and item marked as claimed' });
    } catch (error) {
        console.error('Claim item error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Approve claim using latest proof sender if claimer_id not provided
app.post('/api/admin/items/:id/approve-claim', ensureAuthenticated, ensureAdmin, async (req, res) => {
    let connection;
    try {
        const itemId = req.params.id;
        const { claimer_id } = req.body;
        connection = await pool.getConnection();
        const [items] = await connection.execute('SELECT id, item_name, reported_by, claimed_by, status FROM items WHERE id = ?', [itemId]);
        if (items.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, error: 'Item not found' });
        }
        const item = items[0];
        if (item.status === 'claimed' && item.claimed_by) {
            connection.release();
            return res.status(400).json({ success: false, error: 'Item already claimed' });
        }
        let finalClaimerId = claimer_id;
        if (!finalClaimerId) {
            const [proofRows] = await connection.execute(`
                SELECT m.sender_id
                FROM messages m
                WHERE m.item_id = ? AND m.image_url IS NOT NULL AND m.sender_id <> ?
                ORDER BY m.created_at DESC
                LIMIT 1
            `, [itemId, item.reported_by]);
            if (proofRows.length === 0) {
                connection.release();
                return res.status(400).json({ success: false, error: 'No proof available to determine claimer' });
            }
            finalClaimerId = proofRows[0].sender_id;
        }
        const [userRows] = await connection.execute('SELECT id FROM users WHERE id = ? AND is_active = TRUE', [finalClaimerId]);
        if (userRows.length === 0) {
            connection.release();
            return res.status(400).json({ success: false, error: 'Claimer not found or inactive' });
        }
        await connection.execute('UPDATE items SET claimed_by = ?, status = "claimed" WHERE id = ?', [finalClaimerId, itemId]);
        await connection.execute(
            'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)',
            [item.reported_by, 'Item Claimed', `Your item "${item.item_name}" was approved as claimed by admin`, 'claim', itemId]
        );
        await connection.execute(
            'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)',
            [finalClaimerId, 'Claim Approved', `Your claim for item "${item.item_name}" was approved by admin`, 'success', itemId]
        );
        connection.release();
        res.json({ success: true, message: 'Claim approved and item marked as claimed' });
    } catch (error) {
        if (connection) connection.release();
        console.error('Approve claim error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Upload claim proof (image/message) visible to admin(s) and item reporter
app.post('/api/items/:id/claim-proof', ensureAuthenticated, upload.single('proof'), handleMulterError, async (req, res) => {
    let connection;
    try {
        const itemId = req.params.id;
        const userId = req.user.id;
        const { note, claimer_name } = req.body;
        connection = await pool.getConnection();
        const [itemRows] = await connection.execute('SELECT * FROM items WHERE id = ?', [itemId]);
        if (itemRows.length === 0) {
            connection.release();
            return res.status(404).json({ error: 'Item not found' });
        }
        const item = itemRows[0];
        if (item.reported_by === userId) {
            connection.release();
            return res.status(403).json({ error: 'Reporter cannot submit claim proof' });
        }
        let imageUrl = null;
        if (req.file) imageUrl = `/uploads/${req.file.filename}`;

        const appendedMessage = note ? (claimer_name ? `${note} (Claimer: ${claimer_name})` : note) : (claimer_name ? `(Claimer: ${claimer_name})` : null);
        // Message to reporter
        if (item.reported_by) {
            await connection.execute(
                'INSERT INTO messages (sender_id, receiver_id, item_id, message, image_url) VALUES (?, ?, ?, ?, ?)',
                [userId, item.reported_by, itemId, appendedMessage || 'Claim proof submitted', imageUrl]
            );
            await connection.execute(
                'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)',
                [item.reported_by, 'Claim Proof', `A claimant submitted proof for your item "${item.item_name}"`, 'claim', itemId]
            );
        }

        // Message to all admins
        const [admins] = await connection.execute('SELECT id FROM users WHERE role = "admin" AND is_active = TRUE');
        for (const admin of admins) {
            await connection.execute(
                'INSERT INTO messages (sender_id, receiver_id, item_id, message, image_url) VALUES (?, ?, ?, ?, ?)',
                [userId, admin.id, itemId, appendedMessage || 'Claim proof submitted', imageUrl]
            );
            await connection.execute(
                'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)',
                [admin.id, 'Claim Proof', `A claimant submitted proof for item "${item.item_name}"`, 'claim', itemId]
            );
        }

        connection.release();
        res.json({ success: true, message: 'Claim proof submitted' });
    } catch (error) {
        if (connection) connection.release();
        console.error('Claim proof error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Check if current user has submitted image proof for an item
app.get('/api/items/:id/claim-proof/status', ensureAuthenticated, async (req, res) => {
    let connection;
    try {
        const itemId = req.params.id;
        const userId = req.user.id;
        connection = await pool.getConnection();
        const [rows] = await connection.execute(`
            SELECT id FROM messages 
            WHERE sender_id = ? AND item_id = ? AND image_url IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1
        `, [userId, itemId]);
        connection.release();
        res.json({ success: true, submitted: rows.length > 0 });
    } catch (error) {
        if (connection) connection.release();
        console.error('Claim proof status error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});


app.post('/api/messages/send', ensureAuthenticated, upload.single('image'), handleMulterError, async (req, res) => {
    try {
        const { receiver_id, item_id, message } = req.body;
        const sender_id = req.user.id;
        
        if (!receiver_id || !message) {
            return res.status(400).json({ error: 'Receiver and message are required' });
        }
        if (Number(receiver_id) === Number(sender_id)) {
            return res.status(400).json({ error: 'Cannot message yourself' });
        }
        
        const connection = await pool.getConnection();
        
        const [receiver] = await connection.execute(
            'SELECT id, role FROM users WHERE id = ? AND is_active = TRUE',
            [receiver_id]
        );
        
        if (receiver.length === 0) {
            connection.release();
            return res.status(400).json({ error: 'Receiver not found' });
        }
        if (receiver[0].role === 'admin' && req.user.role !== 'admin') {
            connection.release();
            return res.status(403).json({ error: 'Messaging admin is not allowed' });
        }
        
        const itemId = (item_id === undefined || item_id === '' ? null : item_id);
        let imageUrl = null;
        if (req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
        }
        const [result] = await connection.execute(
            'INSERT INTO messages (sender_id, receiver_id, item_id, message, image_url) VALUES (?, ?, ?, ?, ?)',
            [sender_id, receiver_id, itemId, message, imageUrl]
        );
        
        const [sender] = await connection.execute(
            'SELECT full_name FROM users WHERE id = ?',
            [sender_id]
        );
        
        if (receiver[0].role === 'admin') {
            await connection.execute(
                'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)',
                [receiver_id, 'New Message', `You have a new message from ${sender[0].full_name}`, 'message', result.insertId]
            );
        }
        
        connection.release();
        res.json({ success: true, message: 'Message sent successfully', messageId: result.insertId });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Ensure per-user delete columns exist on messages
async function ensureMessageDeleteColumns(connection) {
    try {
        await connection.execute('ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by_sender BOOLEAN DEFAULT FALSE');
        await connection.execute('ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by_receiver BOOLEAN DEFAULT FALSE');
    } catch (e) {}
}

app.get('/api/messages/conversation/:otherId', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const otherId = req.params.otherId;
        const connection = await pool.getConnection();
        await ensureMessageDeleteColumns(connection);
        const [messages] = await connection.execute(`
            SELECT m.*, 
                   s.full_name as sender_name,
                   r.full_name as receiver_name,
                   i.item_name,
                   i.image_url as item_image_url,
                   i.image_base64 as item_image_base64
            FROM messages m
            LEFT JOIN users s ON m.sender_id = s.id
            LEFT JOIN users r ON m.receiver_id = r.id
            LEFT JOIN items i ON m.item_id = i.id
            WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
            AND m.reported = FALSE
            AND NOT (m.sender_id = ? AND m.deleted_by_sender = TRUE)
            AND NOT (m.receiver_id = ? AND m.deleted_by_receiver = TRUE)
            ORDER BY m.created_at ASC
        `, [userId, otherId, otherId, userId, userId, userId]);
        await connection.execute(
            'UPDATE messages SET is_read = TRUE WHERE receiver_id = ? AND sender_id = ? AND is_read = FALSE',
            [userId, otherId]
        );
        connection.release();
        res.json({ success: true, messages: messages || [] });
    } catch (error) {
        console.error('Get conversation error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
app.get('/api/messages', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const connection = await pool.getConnection();
        await ensureMessageDeleteColumns(connection);
        
        const [messages] = await connection.execute(`
            SELECT m.*, 
                   s.full_name as sender_name,
                   r.full_name as receiver_name,
                   i.item_name,
                   i.image_url as item_image_url,
                   i.image_base64 as item_image_base64
            FROM messages m
            LEFT JOIN users s ON m.sender_id = s.id
            LEFT JOIN users r ON m.receiver_id = r.id
            LEFT JOIN items i ON m.item_id = i.id
            WHERE (m.sender_id = ? OR m.receiver_id = ?)
            AND m.reported = FALSE
            AND NOT (m.sender_id = ? AND m.deleted_by_sender = TRUE)
            AND NOT (m.receiver_id = ? AND m.deleted_by_receiver = TRUE)
            ORDER BY m.created_at DESC
        `, [userId, userId, userId, userId]);
        
        connection.release();
        res.json({ success: true, messages: messages || [] });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.delete('/api/messages/:id', ensureAuthenticated, async (req, res) => {
    let connection;
    try {
        const messageId = req.params.id;
        const userId = req.user.id;
        connection = await pool.getConnection();
        await ensureMessageDeleteColumns(connection);
        const [rows] = await connection.execute('SELECT sender_id, receiver_id FROM messages WHERE id = ?', [messageId]);
        if (rows.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, error: 'Message not found' });
        }
        const msg = rows[0];
        if (Number(msg.sender_id) !== Number(userId) && Number(msg.receiver_id) !== Number(userId)) {
            connection.release();
            return res.status(403).json({ success: false, error: 'Not allowed' });
        }
        if (Number(msg.sender_id) === Number(userId)) {
            await connection.execute('UPDATE messages SET deleted_by_sender = TRUE WHERE id = ?', [messageId]);
        } else {
            await connection.execute('UPDATE messages SET deleted_by_receiver = TRUE WHERE id = ?', [messageId]);
        }
        connection.release();
        res.json({ success: true });
    } catch (error) {
        if (connection) connection.release();
        console.error('Delete message error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.post('/api/messages/delete-all', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const connection = await pool.getConnection();
        const [result] = await connection.execute(
            'DELETE FROM messages WHERE (sender_id = ? OR receiver_id = ?) AND reported = FALSE',
            [userId, userId]
        );
        connection.release();
        res.json({ success: true, deleted: result?.affectedRows || 0 });
    } catch (error) {
        console.error('Delete all messages error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});


app.get('/api/notifications', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const connection = await pool.getConnection();
        
        const [notifications] = await connection.execute(
            `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
            [userId]
        );
        
        const unreadCount = notifications.filter(n => !n.is_read).length;
        
        connection.release();
        res.json({
            success: true,
            notifications: notifications || [],
            unreadCount
        });
    } catch (error) {
        console.error('Notifications error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.post('/api/notifications/:id/read', ensureAuthenticated, async (req, res) => {
    try {
        const notificationId = req.params.id;
        const connection = await pool.getConnection();
        
        await connection.execute(
            'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
            [notificationId, req.user.id]
        );
        
        connection.release();
        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.post('/api/notifications/read-all', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const connection = await pool.getConnection();
        
        await connection.execute(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
            [userId]
        );
        
        connection.release();
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});


app.post('/api/student/update-profile', ensureAuthenticated, upload.single('profileImage'), handleMulterError, async (req, res) => {
    try {
        const userId = req.user.id;
        const { phoneNumber, contactMethod, studentId } = req.body;
        let avatarUrl = null;
        if (req.file) {
            avatarUrl = `/uploads/${req.file.filename}`;
        }

        const connection = await pool.getConnection();
        
        await connection.execute(
            'UPDATE users SET phone_number = ?, contact_method = ?, student_id = ?, avatar_url = COALESCE(?, avatar_url) WHERE id = ?',
            [phoneNumber, contactMethod, studentId, avatarUrl, userId]
        );
        
        connection.release();
        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});


app.get('/api/announcements', ensureAuthenticated, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        const [announcements] = await connection.execute(`
            SELECT a.*, u.full_name as admin_name 
            FROM announcements a 
            LEFT JOIN users u ON a.admin_id = u.id 
            WHERE a.is_active = TRUE 
            ORDER BY a.created_at DESC
        `);
        
        connection.release();
        res.json({ success: true, announcements: announcements || [] });
    } catch (error) {
        console.error('Get announcements error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// BSTA KAY ADMIN NI DRI NA PART DILI MO MAGLIBOG

app.get('/api/admin/dashboard-data', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        const [stats] = await connection.execute(`
            SELECT 
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_verification,
                COUNT(CASE WHEN status = 'found' AND claimed_by IS NULL THEN 1 END) as ready_for_claim,
                COUNT(CASE WHEN status = 'claimed' AND MONTH(updated_at) = MONTH(CURRENT_DATE()) THEN 1 END) as claimed_this_month,
                COUNT(CASE WHEN status = 'pending' AND DATEDIFF(CURRENT_DATE(), created_at) > 30 THEN 1 END) as unresolved_reports,
                COUNT(CASE WHEN status = 'returned' THEN 1 END) as returned_items,
                (SELECT COUNT(*) FROM messages WHERE reported = TRUE) as reported_messages,
                (SELECT COUNT(*) FROM users WHERE is_active = FALSE) as inactive_users
            FROM items
        `);
        
        const [recentReports] = await connection.execute(`
            SELECT i.*, u.full_name, u.student_id 
            FROM items i 
            LEFT JOIN users u ON i.reported_by = u.id 
            ORDER BY i.created_at DESC LIMIT 10
        `);
        
        connection.release();
        
        res.json({
            success: true,
            stats: stats[0] || { 
                pending_verification: 0, 
                ready_for_claim: 0, 
                claimed_this_month: 0, 
                unresolved_reports: 0,
                returned_items: 0,
                reported_messages: 0,
                inactive_users: 0
            },
            recentReports: recentReports || []
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.get('/api/admin/users', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        const [users] = await connection.execute(`
            SELECT id, full_name, email, student_id, role, is_active, created_at 
            FROM users 
            ORDER BY created_at DESC
        `);
        
        connection.release();
        res.json({ success: true, users: users || [] });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});


app.get('/api/admin/items', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        const [items] = await connection.execute(`
            SELECT i.*, u.full_name, u.student_id, 
                   c.full_name as claimed_by_name
            FROM items i 
            LEFT JOIN users u ON i.reported_by = u.id 
            LEFT JOIN users c ON i.claimed_by = c.id 
            ORDER BY i.created_at DESC
        `);
        
        connection.release();
        res.json({ success: true, items: items || [] });
    } catch (error) {
        console.error('Get admin items error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});


// Deprecated: admin approval removed from workflow


app.post('/api/admin/items/:id/status', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const itemId = req.params.id;
        const { status } = req.body;
        
        if (!['pending', 'lost', 'found', 'claimed', 'returned'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        const connection = await pool.getConnection();
        
        await connection.execute(
            'UPDATE items SET status = ? WHERE id = ?',
            [status, itemId]
        );
        
        if (status === 'returned') {
            const [item] = await connection.execute(
                'SELECT reported_by, claimed_by, item_name FROM items WHERE id = ?',
                [itemId]
            );
            
            if (item.length > 0) {
                await connection.execute(
                    'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)',
                    [item[0].reported_by, 'Item Returned', `Your item "${item[0].item_name}" has been successfully returned to the owner`, 'success', itemId]
                );
                
                if (item[0].claimed_by) {
                    await connection.execute(
                        'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)',
                        [item[0].claimed_by, 'Item Returned', `The item "${item[0].item_name}" has been returned to its owner`, 'success', itemId]
                    );
                }
            }
        }
        
        connection.release();
        res.json({ success: true, message: 'Item status updated successfully' });
    } catch (error) {
        console.error('Update item status error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Allow item owner (reporter) to mark status as claimed or returned
app.post('/api/items/:id/status', ensureAuthenticated, async (req, res) => {
    let connection;
    try {
        const itemId = req.params.id;
        const { status } = req.body;
        const userId = req.user.id;
        if (!['claimed', 'returned'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }
        connection = await pool.getConnection();
        const [rows] = await connection.execute('SELECT reported_by, item_name FROM items WHERE id = ?', [itemId]);
        if (rows.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, error: 'Item not found' });
        }
        const item = rows[0];
        if (Number(item.reported_by) !== Number(userId)) {
            connection.release();
            return res.status(403).json({ success: false, error: 'Not allowed' });
        }
        await connection.execute('UPDATE items SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, itemId]);
        connection.release();
        res.json({ success: true, message: `Item marked as ${status}` });
    } catch (error) {
        if (connection) connection.release();
        console.error('Owner status update error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.post('/api/admin/users/:id/toggle-active', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const connection = await pool.getConnection();
        
        const [user] = await connection.execute(
            'SELECT is_active, full_name, email FROM users WHERE id = ?',
            [userId]
        );
        
        if (user.length === 0) {
            connection.release();
            return res.status(404).json({ error: 'User not found' });
        }
        
        const newStatus = !user[0].is_active;
        
        await connection.execute(
            'UPDATE users SET is_active = ? WHERE id = ?',
            [newStatus, userId]
        );
        
        const statusText = newStatus ? 'activated' : 'deactivated';
        await connection.execute(
            'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
            [userId, 'Account Status Updated', `Your account has been ${statusText} by an administrator`, newStatus ? 'success' : 'warning']
        );
        
        connection.release();
        res.json({ 
            success: true, 
            message: `User ${statusText} successfully`,
            is_active: newStatus 
        });
    } catch (error) {
        console.error('Toggle user active error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});


app.get('/api/admin/reported-messages', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        const [messages] = await connection.execute(`
            SELECT m.*, 
                   s.full_name as sender_name,
                   s.email as sender_email,
                   r.full_name as receiver_name,
                   r.email as receiver_email,
                   i.item_name
            FROM messages m
            LEFT JOIN users s ON m.sender_id = s.id
            LEFT JOIN users r ON m.receiver_id = r.id
            LEFT JOIN items i ON m.item_id = i.id
            WHERE m.reported = TRUE
            ORDER BY m.reported_at DESC
        `);
        
        connection.release();
        res.json({ success: true, messages: messages || [] });
    } catch (error) {
        console.error('Get reported messages error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.delete('/api/admin/messages/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const messageId = req.params.id;
        const connection = await pool.getConnection();
        
        await connection.execute('DELETE FROM messages WHERE id = ?', [messageId]);
        
        connection.release();
        res.json({ success: true, message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});


app.post('/api/admin/announcements', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const { title, content } = req.body;
        const adminId = req.user.id;
        
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }
        
        const connection = await pool.getConnection();
        
        const [result] = await connection.execute(
            'INSERT INTO announcements (admin_id, title, content) VALUES (?, ?, ?)',
            [adminId, title, content]
        );
        
        await connection.execute(`
            INSERT INTO notifications (user_id, title, message, type, related_id)
            SELECT id, 'New Announcement', ?, 'info', ?
            FROM users WHERE role = 'student' AND is_active = TRUE
        `, [title, result.insertId]);
        
        connection.release();
        res.json({ 
            success: true, 
            message: 'Announcement created successfully',
            announcementId: result.insertId 
        });
    } catch (error) {
        console.error('Create announcement error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});


app.get('/api/admin/all-announcements', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        const [announcements] = await connection.execute(`
            SELECT a.*, u.full_name as admin_name 
            FROM announcements a 
            LEFT JOIN users u ON a.admin_id = u.id 
            ORDER BY a.created_at DESC
        `);
        
        connection.release();
        res.json({ success: true, announcements: announcements || [] });
    } catch (error) {
        console.error('Get all announcements error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});


app.post('/api/admin/announcements/:id/toggle-active', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const announcementId = req.params.id;
        const connection = await pool.getConnection();
        
        const [announcement] = await connection.execute(
            'SELECT is_active FROM announcements WHERE id = ?',
            [announcementId]
        );
        
        if (announcement.length === 0) {
            connection.release();
            return res.status(404).json({ error: 'Announcement not found' });
        }
        
        const newStatus = !announcement[0].is_active;
        
        await connection.execute(
            'UPDATE announcements SET is_active = ? WHERE id = ?',
            [newStatus, announcementId]
        );
        
        connection.release();
        res.json({ 
            success: true, 
            message: `Announcement ${newStatus ? 'activated' : 'deactivated'} successfully`,
            is_active: newStatus 
        });
    } catch (error) {
        console.error('Toggle announcement active error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});


app.delete('/api/admin/announcements/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const announcementId = req.params.id;
        const connection = await pool.getConnection();
        
        await connection.execute('DELETE FROM announcements WHERE id = ?', [announcementId]);
        
        connection.release();
        res.json({ success: true, message: 'Announcement deleted successfully' });
    } catch (error) {
        console.error('Delete announcement error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Update announcement (edit title and content)
app.put('/api/admin/announcements/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const announcementId = req.params.id;
        const { title, content } = req.body;
        if (!title || !content) {
            return res.status(400).json({ success: false, error: 'Title and content are required' });
        }
        const connection = await pool.getConnection();
        const [exists] = await connection.execute('SELECT id FROM announcements WHERE id = ?', [announcementId]);
        if (exists.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, error: 'Announcement not found' });
        }
        await connection.execute('UPDATE announcements SET title = ?, content = ? WHERE id = ?', [title, content, announcementId]);
        connection.release();
        res.json({ success: true, message: 'Announcement updated successfully' });
    } catch (error) {
        console.error('Update announcement error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Get latest proof submission (image/message) for an item, regardless of claim status
app.get('/api/admin/items/:id/claim-proof', ensureAuthenticated, ensureAdmin, async (req, res) => {
    let connection;
    try {
        const itemId = req.params.id;
        connection = await pool.getConnection();
        const [items] = await connection.execute('SELECT id, item_name, reported_by FROM items WHERE id = ?', [itemId]);
        if (items.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, error: 'Item not found' });
        }
        const item = items[0];
        const [proofRows] = await connection.execute(`
            SELECT m.id, m.sender_id, m.message, m.image_url, m.created_at,
                   s.full_name as sender_name
            FROM messages m
            LEFT JOIN users s ON m.sender_id = s.id
            WHERE m.item_id = ? AND m.image_url IS NOT NULL AND m.sender_id <> ?
            ORDER BY m.created_at DESC
            LIMIT 1
        `, [itemId, item.reported_by]);
        connection.release();
        res.json({ success: true, proof: proofRows[0] || null });
    } catch (error) {
        if (connection) connection.release();
        console.error('Get claim proof error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Get all proof submissions for an item (non-reporters)
app.get('/api/admin/items/:id/claim-proofs', ensureAuthenticated, ensureAdmin, async (req, res) => {
    let connection;
    try {
        const itemId = req.params.id;
        connection = await pool.getConnection();
        const [items] = await connection.execute('SELECT id, reported_by FROM items WHERE id = ?', [itemId]);
        if (items.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, error: 'Item not found' });
        }
        const item = items[0];
        const [rows] = await connection.execute(`
            SELECT m.id, m.sender_id, m.message, m.image_url, m.created_at,
                   u.full_name AS sender_name
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.item_id = ? AND m.image_url IS NOT NULL AND m.sender_id <> ?
            ORDER BY m.created_at DESC
        `, [itemId, item.reported_by]);
        connection.release();
        res.json({ success: true, proofs: rows || [] });
    } catch (error) {
        if (connection) connection.release();
        console.error('Get claim proofs error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Reject a specific claimant's proof
app.post('/api/admin/items/:id/reject-proof', ensureAuthenticated, ensureAdmin, async (req, res) => {
    let connection;
    try {
        const itemId = req.params.id;
        const { claimer_id, reason } = req.body;
        if (!claimer_id) return res.status(400).json({ success: false, error: 'claimer_id is required' });
        connection = await pool.getConnection();
        const [items] = await connection.execute('SELECT id, item_name, reported_by FROM items WHERE id = ?', [itemId]);
        if (items.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, error: 'Item not found' });
        }
        const item = items[0];
        const msg = reason && reason.trim() ? reason.trim() : `Your proof for item "${item.item_name}" was rejected by admin`;
        await connection.execute(
            'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)',
            [claimer_id, 'Claim Proof Rejected', msg, 'warning', itemId]
        );
        connection.release();
        res.json({ success: true, message: 'Proof rejected and user notified' });
    } catch (error) {
        if (connection) connection.release();
        console.error('Reject proof error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Reject a claim: reset claimed_by and set status back to 'found'
app.post('/api/admin/items/:id/reject-claim', ensureAuthenticated, ensureAdmin, async (req, res) => {
    let connection;
    try {
        const itemId = req.params.id;
        connection = await pool.getConnection();
        const [items] = await connection.execute('SELECT id, item_name, reported_by, claimed_by FROM items WHERE id = ?', [itemId]);
        if (items.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, error: 'Item not found' });
        }
        const item = items[0];
        if (!item.claimed_by) {
            // Idempotent: ensure status is back to 'found' even if already unclaimed
            await connection.execute('UPDATE items SET status = "found" WHERE id = ?', [itemId]);
            // Notify reporter that claim was corrected/rejected state-wise
            await connection.execute(
                'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)',
                [item.reported_by, 'Claim Rejected', `The claim for your item "${item.item_name}" was rejected by admin`, 'warning', itemId]
            );
            connection.release();
            return res.json({ success: true, message: 'Claim rejection applied (item not currently claimed)' });
        }
        await connection.execute('UPDATE items SET claimed_by = NULL, status = "found" WHERE id = ?', [itemId]);
        // Notify claimer
        await connection.execute(
            'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)',
            [item.claimed_by, 'Claim Rejected', `Your claim for item "${item.item_name}" was rejected by admin`, 'warning', itemId]
        );
        // Notify reporter
        await connection.execute(
            'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)',
            [item.reported_by, 'Claim Rejected', `The claim for your item "${item.item_name}" was rejected by admin`, 'warning', itemId]
        );
        connection.release();
        res.json({ success: true, message: 'Claim rejected and item set back to found' });
    } catch (error) {
        if (connection) connection.release();
        console.error('Reject claim error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
app.get('/api/debug/admin-check', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [adminUsers] = await connection.execute(
            'SELECT id, email, role, is_active FROM users WHERE email = ? AND role = "admin"',
            ['lostfound.devteam@gmail.com'] 
        );
        
        connection.release();
        
        res.json({
            adminExists: adminUsers.length > 0,
            adminUser: adminUsers[0] || null
        });
    } catch (error) {
        console.error('Admin check error:', error);
        res.json({ error: error.message });
    }
});


app.post('/api/admin/setup', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        const connection = await pool.getConnection();
        const hashedPassword = await bcrypt.hash(password, 10);
        

        const [existing] = await connection.execute(
            'SELECT id FROM users WHERE email = ? AND role = "admin"',
            [email]
        );
        
        if (existing.length > 0) {
      
            await connection.execute(
                'UPDATE users SET password = ?, is_active = TRUE WHERE id = ?',
                [hashedPassword, existing[0].id]
            );
            connection.release();
            return res.json({ success: true, message: 'Admin password updated' });
        } else {
 
            await connection.execute(
                'INSERT INTO users (full_name, email, password, role, is_active) VALUES (?, ?, ?, "admin", TRUE)',
                ['Admin User', email, hashedPassword]
            );
            connection.release();
            return res.json({ success: true, message: 'Admin user created' });
        }
    } catch (error) {
        console.error('Admin setup error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});


app.post('/api/setup-admin', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const adminEmail = 'lostfound.devteam@gmail.com';
        const adminPassword = 'lost@!found$#developement1234@team*&^';
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        

        const [existing] = await connection.execute(
            'SELECT id FROM users WHERE email = ? AND role = "admin"',
            [adminEmail]
        );
        
        if (existing.length > 0) {
            await connection.execute(
                'UPDATE users SET password = ?, is_active = TRUE WHERE id = ?',
                [hashedPassword, existing[0].id]
            );
            connection.release();
            return res.json({ 
                success: true, 
                message: 'Admin password reset',
                credentials: {
                    email: adminEmail,
                    password: adminPassword
                }
            });
        } else {

            await connection.execute(
                'INSERT INTO users (full_name, email, password, role, is_active) VALUES (?, ?, ?, "admin", TRUE)',
                ['Admin User', adminEmail, hashedPassword]
            );
            connection.release();
            return res.json({ 
                success: true, 
                message: 'Admin user created',
                credentials: {
                    email: adminEmail,
                    password: adminPassword
                }
            });
        }
    } catch (error) {
        console.error('Setup admin error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});


app.get('/api/health', async (req, res) => {
    try {
        if (!pool) {
            return res.json({ 
                status: 'error', 
                message: 'Database pool not initialized',
                pool: 'not initialized'
            });
        }
        
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        
        res.json({ 
            status: 'ok', 
            message: 'Server is running',
            database: 'connected',
            session: req.sessionID ? 'active' : 'none',
            authenticated: req.isAuthenticated() ? 'yes' : 'no'
        });
    } catch (error) {
        res.json({ 
            status: 'error', 
            message: 'Database connection failed',
            error: error.message 
        });
    }
});


app.get('/api/test-db', async (req, res) => {
    try {
        if (!pool) {
            return res.json({ success: false, error: 'Database pool not initialized' });
        }
        
        const connection = await pool.getConnection();
        
        const [tables] = await connection.execute(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('users', 'items', 'messages', 'notifications', 'announcements')
        `, [process.env.DB_NAME || 'csu_lost_found']);
        const [adminUsers] = await connection.execute(
            'SELECT id, email, role, is_active FROM users WHERE email = ? AND role = "admin"',
            ['lostfound.devteam@gmail.com'] 
        );
        
        const [itemColumns] = await connection.execute(`
            SHOW COLUMNS FROM items
        `);
        
        connection.release();
        
        res.json({
            success: true,
            tables: tables.map(t => t.TABLE_NAME),
            adminExists: adminUsers.length > 0,
            adminUser: adminUsers[0] || null,
            itemColumns: itemColumns.map(c => c.Field),
            hasImageBase64: itemColumns.some(c => c.Field === 'image_base64'),
            hasImageUrl: itemColumns.some(c => c.Field === 'image_url')
        });
    } catch (error) {
        console.error('Test DB error:', error);
        res.json({ 
            success: false, 
            error: error.message,
            code: error.code
        });
    }
});
async function startServer() {
    const dbConnected = await initializeDatabase();
    
    if (!dbConnected) {
        console.log('⚠️  Starting server without database connection...');
        console.log('⚠️  Some features may not work properly');
    }
    
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`Setup admin: POST to http://localhost:${PORT}/api/setup-admin`);
        console.log(`Admin email: lostfound.devteam@gmail.com`);
        console.log(`Default password: lost@!found$#developement1234@team*&^`);
    });
}

startServer();
// Get single item details
app.get('/api/items/:id', ensureAuthenticated, async (req, res) => {
    try {
        const itemId = req.params.id;
        const connection = await pool.getConnection();
        const [items] = await connection.execute(`
            SELECT i.*, 
                   u.full_name as reporter_name,
                   u.student_id as reporter_student_id,
                   c.full_name as claimed_by_name
            FROM items i
            LEFT JOIN users u ON i.reported_by = u.id
            LEFT JOIN users c ON i.claimed_by = c.id
            WHERE i.id = ?
        `, [itemId]);
        connection.release();
        if (items.length === 0) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }
        res.json({ success: true, item: items[0] });
    } catch (error) {
        console.error('Get item error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
app.post('/api/messages/:id/report', ensureAuthenticated, async (req, res) => {
    let connection;
    try {
        const messageId = req.params.id;
        const { reason } = req.body || {};
        const userId = req.user.id;
        connection = await pool.getConnection();
        const [rows] = await connection.execute('SELECT sender_id, receiver_id, message FROM messages WHERE id = ?', [messageId]);
        if (rows.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, error: 'Message not found' });
        }
        const msg = rows[0];
        if (Number(msg.sender_id) !== Number(userId) && Number(msg.receiver_id) !== Number(userId)) {
            connection.release();
            return res.status(403).json({ success: false, error: 'Not allowed' });
        }
        await connection.execute('UPDATE messages SET reported = TRUE, reported_at = CURRENT_TIMESTAMP, reported_reason = ? WHERE id = ?', [reason || null, messageId]);
        const [admins] = await connection.execute('SELECT id FROM users WHERE role = "admin" AND is_active = TRUE');
        for (const admin of admins) {
            const snippet = (msg.message || '').slice(0, 120);
            await connection.execute(
                'INSERT INTO notifications (user_id, title, message, related_id) VALUES (?, ?, ?, ?)',
                [admin.id, 'Message Reported', snippet ? `Reported: "${snippet}"` : 'A message has been reported.', messageId]
            );
        }
        connection.release();
        res.json({ success: true });
    } catch (error) {
        if (connection) connection.release();
        console.error('Report message error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
async function ensureItemDeleteColumn(connection) {
    try {
        await connection.execute('ALTER TABLE items ADD COLUMN IF NOT EXISTS deleted_by_reporter BOOLEAN DEFAULT FALSE');
    } catch (e) {}
}

app.delete('/api/admin/items/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
    let connection;
    try {
        const itemId = req.params.id;
        connection = await pool.getConnection();
        const [items] = await connection.execute('SELECT image_url FROM items WHERE id = ?', [itemId]);
        await connection.execute('DELETE FROM items WHERE id = ?', [itemId]);
        connection.release();
        const imageUrl = items[0]?.image_url;
        if (imageUrl && imageUrl.startsWith('/uploads/')) {
            const filePath = path.join(uploadsDir, path.basename(imageUrl));
            fs.unlink(filePath, () => {});
        }
        res.json({ success: true, message: 'Item permanently deleted' });
    } catch (error) {
        if (connection) connection.release();
        console.error('Admin delete item error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.put('/api/admin/items/:id', ensureAuthenticated, ensureAdmin, upload.single('itemImage'), handleMulterError, async (req, res) => {
    let connection;
    try {
        const itemId = req.params.id;
        const { itemName, category, description, place, dateLostFound, status, contactInfo } = req.body;
        connection = await pool.getConnection();
        let imageUrl = null;
        const [items] = await connection.execute('SELECT image_url FROM items WHERE id = ?', [itemId]);
        imageUrl = items[0]?.image_url || null;
        if (req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
        }
        await connection.execute(
            `UPDATE items SET item_name = ?, category = ?, description = ?, place = ?, date_lost_found = ?, status = ?, contact_info = ?, image_url = ? WHERE id = ?`,
            [itemName, category, description, place, dateLostFound, status, contactInfo, imageUrl, itemId]
        );
        connection.release();
        res.json({ success: true, message: 'Item updated successfully' });
    } catch (error) {
        if (connection) connection.release();
        console.error('Admin update item error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
