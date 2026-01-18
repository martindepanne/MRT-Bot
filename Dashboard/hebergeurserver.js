import express from 'express';
import path from 'path';
import fs from 'fs';
import session from 'express-session';
import { fileURLToPath } from 'url';
import axios from 'axios'; 
import db from '../Events/loadDatabase.js';
import { getAllCommands } from './utils.js';
import config from "../config.json" with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = process.cwd();
const app = express();

let logsMemoire = []; 

async function addPanelLog(action) {
    const timestamp = new Date().toLocaleString('fr-FR');
    const logEntry = `[${timestamp}] 🛠️ ${action}`;
    
    logsMemoire.push(logEntry);
    if (logsMemoire.length > 50) logsMemoire.shift();

    if (config.panelLogs && config.panelLogs.startsWith('http')) {
        try {
            await axios.post(config.panelLogs, {
                embeds: [{
                    title: "Action Dashboard",
                    description: logEntry,
                    color: 0x5865F2
                }]
            });
        } catch (e) {
            console.error("[LOGS] Erreur Webhook:", e.message);
        }
    }
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'Views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: 'mrt_bot_secret_key_2026',
    resave: false,
    saveUninitialized: true
}));

function findFileRecursive(dir, fileName) {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            const found = findFileRecursive(fullPath, fileName);
            if (found) return found;
        } else if (file === fileName) {
            return fullPath;
        }
    }
    return null;
}

function checkAuth(req, res, next) {
    if (req.session.loggedIn) return next();
    res.redirect('/login');
}

app.get('/login', (req, res) => {
    const guild = global.client?.guilds.cache.get(config.panelGuildId);
    const stats = {
        serverName: guild ? guild.name : "Serveur Discord",
        serverIcon: guild ? guild.iconURL({ extension: 'png', size: 512 }) : 'https://cdn.discordapp.com/embed/avatars/0.png'
    };
    res.render('login', { error: null, stats: stats });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const guild = global.client?.guilds.cache.get(config.panelGuildId);
    const stats = {
        serverName: guild ? guild.name : "Serveur Discord",
        serverIcon: guild ? guild.iconURL({ extension: 'png', size: 512 }) : 'https://cdn.discordapp.com/embed/avatars/0.png'
    };

    if (username === config.panelUser && password === config.panelPass) {
        const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        db.run('INSERT INTO login_history (username, ip, timestamp) VALUES (?, ?, ?)', [username, userIP, Date.now()]);
        
        req.session.loggedIn = true;
        addPanelLog(`Connexion de ${username}`);
        res.redirect('/');
    } else {
        res.render('login', { error: "Identifiants incorrects", stats: stats });
    }
});

app.get('/', checkAuth, async (req, res) => {
    try {
        const allCommands = await getAllCommands();
        const guild = global.client?.guilds.cache.get(config.panelGuildId);
        const stats = {
            ping: global.client?.ws.ping || 0,
            serverName: guild ? guild.name : "Non trouvé",
            users: guild ? guild.memberCount : 0,
            ram: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)
        };

        db.all('SELECT * FROM modules', (err, moduleRows) => {
            db.all('SELECT * FROM commands_status', (err2, cmdStatusRows) => {
                res.render('index', { 
                    modules: moduleRows || [],
                    allCommands: allCommands || [],
                    cmdStatus: cmdStatusRows || [],
                    stats: stats
                });
            });
        });
    } catch (error) { 
        res.send("Erreur de chargement."); 
    }
});

app.get('/api/stats', checkAuth, async (req, res) => {
    const guild = global.client?.guilds.cache.get(config.panelGuildId);
    res.json({
        ping: global.client?.ws.ping || 0,
        serverName: guild ? guild.name : "Serveur introuvable",
        users: guild ? guild.memberCount : 0,
        ram: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
        icon: guild ? guild.iconURL({ dynamic: true, size: 64 }) : null
    });
});

app.get('/get-panel-logs', checkAuth, (req, res) => {
    res.json({ logs: logsMemoire });
});

app.get('/get-script/:name', checkAuth, (req, res) => {
    const name = req.params.name;
    let filePath = (name === "config.json") ? path.join(rootDir, 'config.json') : findFileRecursive(path.join(rootDir, 'Commands'), name + '.js');
    
    if (filePath && fs.existsSync(filePath)) {
        res.json({ content: fs.readFileSync(filePath, 'utf8') });
    } else { 
        res.status(404).json({ error: "Fichier non trouvé" }); 
    }
});

app.post('/save-script', checkAuth, (req, res) => {
    const { fileName, content } = req.body;
    let filePath = (fileName === "config.json") ? path.join(rootDir, 'config.json') : findFileRecursive(path.join(rootDir, 'Commands'), fileName + '.js');

    if (filePath) {
        fs.writeFileSync(filePath, content, 'utf8');
        addPanelLog(`Modification du fichier : ${fileName}`);
        res.json({ success: true });
    } else { 
        res.status(404).json({ error: "Localisation impossible" }); 
    }
});

app.post('/sql-query', checkAuth, (req, res) => {
    const { query } = req.body;
    const action = query.trim().split(' ')[0].toUpperCase();
    addPanelLog(`SQL : ${query.substring(0, 50)}`);
    
    if (action === 'SELECT') {
        db.all(query, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ type: 'data', rows });
        });
    } else {
        db.run(query, function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ type: 'info', message: `Succès. Changements : ${this.changes}` });
        });
    }
});

app.get('/sql-tables', checkAuth, (req, res) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => r.name));
    });
});

app.get('/download-db', checkAuth, (req, res) => {
    const dbPath = path.join(rootDir, 'database.sqlite3');
    if (fs.existsSync(dbPath)) {
        addPanelLog("Téléchargement de la base de données");
        res.download(dbPath);
    } else { 
        res.status(404).send("Base de données introuvable."); 
    }
});

app.post('/toggle-module', checkAuth, (req, res) => {
    const { moduleName, currentState } = req.body;
    const newState = currentState === '1' ? 0 : 1;
    addPanelLog(`Module [${moduleName}] -> ${newState === 1 ? 'ON' : 'OFF'}`);
    db.run('INSERT OR REPLACE INTO modules (guildId, moduleName, enabled) VALUES (?, ?, ?)', ['GLOBAL', moduleName, newState], () => res.redirect('/'));
});

app.post('/toggle-command', checkAuth, (req, res) => {
    const { commandName, currentState } = req.body;
    const newState = currentState === '1' ? 0 : 1;
    addPanelLog(`Commande [${commandName}] -> ${newState === 1 ? 'ON' : 'OFF'}`);
    db.run('INSERT OR REPLACE INTO commands_status (commandName, enabled) VALUES (?, ?)', [commandName, newState], () => res.redirect('/'));
});

export function startDashboard() {
    let port = 3000;
    try {
        if (config.panelURL) {
            const url = new URL(config.panelURL);
            port = url.port || (url.protocol === 'https:' ? 443 : 80);
        }
    } catch(e) { 
        port = 3000; 
    }
    app.listen(port, '0.0.0.0', () => { console.log(`[DASHBOARD] Prêt sur le port ${port}`); });
}