const bcrypt = require('bcryptjs');

// Generate a bcrypt hash for password
async function generateHash() {
    const password = 'lost@!found$#developement1234@team*&^'; // Change this to your desired password
    const saltRounds = 10;
    
    try {
        const hash = await bcrypt.hash(password, saltRounds);
        console.log('Password:', password);
        console.log('Hash:', hash);
        console.log('\nSQL to create admin:');
        console.log(`
INSERT INTO users (full_name, email, password, role, is_active) 
VALUES ('Admin User', 'lostfound.devteam@gmail.com', '${hash}', 'admin', TRUE)
ON DUPLICATE KEY UPDATE password = '${hash}', is_active = TRUE;
        `);
    } catch (error) {
        console.error('Error generating hash:', error);
    }
}

generateHash();