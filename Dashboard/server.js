import express from 'express';
import path from 'path';
import session from 'express-session';
import { fileURLToPath } from 'url';
import db from '../Events/loadDatabase.js';
import { getAllCommands } from './utils.js';
import config from "../config.json" with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'Views'));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'mrt_bot_secret_key_2026',
    resave: false,
    saveUninitialized: true
}));

function checkAuth(req, res, next) {
    if (req.session.loggedIn) return next();
    res.redirect('/login');
}

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === config.panelUser && password === config.panelPass) {
        req.session.loggedIn = true;
        res.redirect('/');
    } else {
        res.render('login', { error: "Identifiants incorrects (config.json)" });
    }
});

app.get('/', checkAuth, async (req, res) => {
    try {
        const allCommands = await getAllCommands();
        db.all('SELECT * FROM modules', (err, moduleRows) => {
            db.all('SELECT * FROM commands_status', (err2, cmdStatusRows) => {
                res.render('index', { 
                    modules: moduleRows || [],
                    allCommands: allCommands || [],
                    cmdStatus: cmdStatusRows || []
                });
            });
        });
    } catch (error) {
        res.send("Erreur de chargement.");
    }
});

app.post('/toggle-module', checkAuth, (req, res) => {
    const { moduleName, currentState } = req.body;
    const newState = currentState === '1' ? 0 : 1;
    db.run('INSERT OR REPLACE INTO modules (guildId, moduleName, enabled) VALUES (?, ?, ?)', 
    ['GLOBAL', moduleName, newState], () => res.redirect('/'));
});

app.post('/toggle-command', checkAuth, (req, res) => {
    const { commandName, currentState } = req.body;
    const newState = currentState === '1' ? 0 : 1;
    db.run('INSERT OR REPLACE INTO commands_status (commandName, enabled) VALUES (?, ?)', 
    [commandName, newState], () => res.redirect('/'));
});

export function startDashboard() {
    const port = config.panelURL ? new URL(config.panelURL).port || 80 : 3000;
    
    app.listen(port, () => {
        console.log(`[DASHBOARD] Lancé sur ${config.panelURL || `http://localhost:${port}`}`);
    });
}