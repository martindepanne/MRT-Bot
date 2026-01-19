import express from 'express';
import path from 'path';
import fs from 'fs';
import session from 'express-session';
import { fileURLToPath } from 'url';
import axios from 'axios'; 
import db from '../Events/loadDatabase.js';
import { getAllCommands } from './utils.js';
import config from "../config.json" with { type: 'json' };
import { GoogleGenerativeAI } from "@google/generative-ai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

let logsMemoire = []; 

async function addPanelLog(action) {
    const timestamp = new Date().toLocaleString('fr-FR');
    const logEntry = `[${timestamp}] 🛠️ ${action}`;
    
    logsMemoire.push(logEntry);
    if (logsMemoire.length > 50) logsMemoire.shift();

    if (config.panelLogs) {
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
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: 'mrt_bot_secret_key_2026',
    resave: false,
    saveUninitialized: true
}));

function findFileRecursive(dir, fileName) {
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
        req.session.loggedIn = true;
        res.redirect('/');
    } else {
        res.render('login', { error: "Identifiants incorrects", stats: stats });
    }
});

app.get('/', checkAuth, async (req, res) => {
    try {
        const allCommands = await getAllCommands();
        const stats = {
            ping: global.client?.ws.ping || 0,
            guilds: global.client?.guilds.cache.size || 0,
            users: global.client?.users.cache.size || 0,
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
    } catch (error) { res.send("Erreur de chargement."); }
});

app.get('/api/stats', async (req, res) => {
    let geminiValid = true;
    if (config.geminiKey) {
        try {
            const genAI = new GoogleGenerativeAI(config.geminiKey);
            await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }).generateContent("test");
        } catch (e) {
            geminiValid = false;
        }
    }

    res.json({
        ping: Date.now() - req.startTime,
        serverName: client.guilds.cache.first()?.name || "Bot",
        users: client.users.cache.size,
        ram: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
        geminiKey: !!config.geminiKey,
        geminiValid: geminiValid
    });
});

app.post('/api/ai-chat', checkAuth, async (req, res) => {
    const { message, code, fileName, history } = req.body;
    if (!config.geminiKey) return res.status(400).json({ error: "Clé manquante" });

    try {
        const genAI = new GoogleGenerativeAI(config.geminiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const context = history.map(h => `User: ${h.user}\nBot: ${h.bot}`).join("\n");
        
        const prompt = `Tu es un expert en Discord.js. 
        Fichier actuel : ${fileName}
        Code actuel : 
        ${code}

        Historique :
        ${context}

        Question de l'utilisateur : ${message}

        Réponds de manière concise. Si tu proposes une modification de code, fournis le code complet mis à jour à la fin de ta réponse entouré de balises [CODE_START] et [CODE_END].`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        let reply = text;
        let newCode = null;

        if (text.includes("[CODE_START]") && text.includes("[CODE_END]")) {
            newCode = text.split("[CODE_START]")[1].split("[CODE_END]")[0].trim();
            newCode = newCode.replace(/```javascript/g, "").replace(/```/g, "").trim();
            reply = text.split("[CODE_START]")[0].trim();
        }

        res.json({ reply, newCode });
    } catch (e) {
        res.status(500).json({ error: "Erreur IA" });
    }
});

app.get('/get-panel-logs', checkAuth, (req, res) => {
    res.json({ logs: logsMemoire });
});

app.get('/get-script/:name', checkAuth, (req, res) => {
    const name = req.params.name;
    let filePath = (name === "config.json") ? path.join(__dirname, '../config.json') : findFileRecursive(path.join(__dirname, '../Commands'), name + '.js');
    if (filePath && fs.existsSync(filePath)) {
        res.json({ content: fs.readFileSync(filePath, 'utf8') });
    } else { res.status(404).json({ error: "Fichier non trouvé" }); }
});

app.post('/save-script', checkAuth, (req, res) => {
    const { fileName, content } = req.body;
    let filePath = (fileName === "config.json") ? path.join(__dirname, '../config.json') : findFileRecursive(path.join(__dirname, '../Commands'), fileName + '.js');
    if (filePath) {
        fs.writeFileSync(filePath, content, 'utf8');
        addPanelLog(`Modification du fichier : ${fileName}`);
        res.json({ success: true });
    } else { res.status(404).json({ error: "Localisation impossible" }); }
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
    addPanelLog("Téléchargement de la base de données");
    res.download(path.join(__dirname, '../database.sqlite3'));
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
    const port = config.panelURL ? new URL(config.panelURL).port : 3000;
    app.listen(port, '0.0.0.0', () => { console.log(`[DASHBOARD] Prêt sur le port ${port}`); });
}