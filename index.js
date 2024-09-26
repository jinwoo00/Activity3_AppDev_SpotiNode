const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const path = require('path');
const fs = require('fs');
const ejsLayouts = require('express-ejs-layouts');
const multer = require('multer');

const app = express();
const port = 3000;


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MySQL connection setup
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', 
    database: 'spotify_lite'
});

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error('MySQL connection error:', err.stack);
        return;
    }
    console.log('MySQL Connected...');
});

// Set view engine to EJS
app.set('view engine', 'ejs');
app.use(ejsLayouts);

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'music'); // Directory for uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
    }
});
const upload = multer({ storage: storage }); // Set up multer

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/music', express.static(path.join(__dirname, 'music')));

// Route for the homepage
app.get('/', (req, res) => {
    const songsQuery = 'SELECT * FROM songs';
    const playlistsQuery = 'SELECT * FROM playlists';

    // Fetch songs and playlists concurrently
    db.query(songsQuery, (err, songsResults) => {
        if (err) {
            console.error('Error fetching songs:', err);
            return res.status(500).send('Internal Server Error');
        }

        db.query(playlistsQuery, (err, playlistsResults) => {
            if (err) {
                console.error('Error fetching playlists:', err);
                return res.status(500).send('Internal Server Error');
            }

            res.render('index', { songs: songsResults, playlists: playlistsResults });
        });
    });
});

// Stream a song
app.get('/api/songs/play/:id', (req, res) => {
    const songId = req.params.id;
    const query = 'SELECT filepath FROM songs WHERE id = ?';

    db.query(query, [songId], (err, results) => {
        if (err) {
            console.error('Error fetching song:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (results.length > 0) {
            const songPath = path.join(__dirname, results[0].filepath);
            res.sendFile(songPath, (err) => {
                if (err) {
                    console.error('Error sending file:', err);
                    res.status(err.status).end();
                }
            });
        } else {
            res.status(404).send('Song not found');
        }
    });
});

// Route to add a song
app.post('/add-song', upload.single('file'), (req, res) => {
    const { title, artist, album, genre } = req.body;
    const filepath = `music/${req.file.filename}`; // Path to the uploaded file

    const query = 'INSERT INTO songs (title, artist, album, genre, filepath) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [title, artist, album, genre, filepath], (err) => {
        if (err) {
            console.error('Error adding song:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/'); // Redirect to the homepage after adding the song
    });
});

// Route to delete a song by its ID
app.post('/delete-song/:id', (req, res) => {
    const songId = req.params.id;

    // Query to get the file path of the song
    const getFilePathQuery = 'SELECT filepath FROM songs WHERE id = ?';
    db.query(getFilePathQuery, [songId], (err, results) => {
        if (err) {
            console.error('Error fetching song file path:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (results.length > 0) {
            const filepath = path.join(__dirname, results[0].filepath);

            // Delete the file from the file system
            fs.unlink(filepath, (err) => {
                if (err) {
                    console.error('Error deleting file:', err);
                    return res.status(500).send('Error deleting file');
                }

                // Delete the song from the database
                const deleteQuery = 'DELETE FROM songs WHERE id = ?';
                db.query(deleteQuery, [songId], (err) => {
                    if (err) {
                        console.error('Error deleting song from database:', err);
                        return res.status(500).send('Internal Server Error');
                    }

                    console.log('Song deleted successfully');
                    res.redirect('/'); // Redirect to the homepage after deletion
                });
            });
        } else {
            return res.status(404).send('Song not found');
        }
    });
});

// Route to create a new playlist
app.post('/create-playlist', (req, res) => {
    const { name, description } = req.body;
    const query = 'INSERT INTO playlists (name, description) VALUES (?, ?)';
    db.query(query, [name, description], (err) => {
        if (err) {
            console.error('Error creating playlist:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/playlists');
    });
});

// Route to add a song to a playlist
app.post('/add-to-playlist', (req, res) => {
    const { playlist_id, song_id } = req.body;
    const query = 'INSERT INTO playlist_songs (playlist_id, song_id) VALUES (?, ?)';
    db.query(query, [playlist_id, song_id], (err) => {
        if (err) {
            console.error('Error adding song to playlist:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/playlists/' + playlist_id);
    });
});

app.post('/delete-playlist/:id', (req, res) => {
    const id = req.params.id;
    // Assuming you have a function to delete a playlist from the database
    deletePlaylistFromDatabase(id, (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error deleting playlist');
        } else {
            res.redirect('/playlists'); // Redirect to the playlists page
        }
    });
});

// Example function to delete a playlist from the database
function deletePlaylistFromDatabase(id, callback) {
    // Assuming you have a database connection
    db.query(`DELETE FROM playlists WHERE id = ${id}`, (err, result) => {
        if (err) {
            callback(err, null);
        } else {
            callback(null, result);
        }
    });
}

// Route to view all playlists
app.get('/playlists', (req, res) => {
    const query = 'SELECT * FROM playlists';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching playlists:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.render('playlists', { playlists: results });
    });
});

// Route to view songs in a specific playlist
app.get('/playlists/:id', (req, res) => {
    const playlistId = req.params.id;
    
    // Query to get songs in the playlist
    const songsQuery = `
        SELECT songs.* FROM songs 
        JOIN playlist_songs ON songs.id = playlist_songs.song_id 
        WHERE playlist_songs.playlist_id = ?`;
    
    // Query to get the playlist details
    const playlistQuery = 'SELECT * FROM playlists WHERE id = ?';

    db.query(songsQuery, [playlistId], (err, songsResults) => {
        if (err) {
            console.error('Error fetching songs for playlist:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Fetch the playlist details
        db.query(playlistQuery, [playlistId], (err, playlistResults) => {
            if (err) {
                console.error('Error fetching playlist details:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Ensure playlist exists
            if (playlistResults.length === 0) {
                return res.status(404).send('Playlist not found');
            }

            // Pass the playlist and songs to the view
            res.render('playlist_songs', {
                songs: songsResults,
                playlist: playlistResults[0], // Assuming we want the first result
                playlistId
            });
        });
    });
});

// Route to remove a song from a playlist
app.post('/playlists/:playlistId/remove/:songId', (req, res) => {
    const { playlistId, songId } = req.params;
    const query = 'DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?';

    db.query(query, [playlistId, songId], (err) => {
        if (err) {
            console.error('Error removing song from playlist:', err);
            return res.status(500).send('Internal Server Error');
        }

        console.log('Song removed from playlist successfully');
        res.redirect('/playlists/' + playlistId); // Redirect back to the playlist
    });
});


// Start the server
app.listen(port, () => {
    console.log(`Server started on http://localhost:${port}`);
});
