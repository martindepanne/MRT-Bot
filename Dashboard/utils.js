import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const categories = [
    'Informations',
    'Jeux',
    'Films',
    'Utilitaires',
    'Modérations',
    'Gestions',
    'Antiraid',
    'Contact',
    'Paramètres',
    'FiveM'
];

export async function getAllCommands() {
    const allCmds = [];
    for (const category of categories) {
        const dirPath = path.join(__dirname, `../Commands/${category}`);
        if (fs.existsSync(dirPath)) {
            const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.js'));
            for (const file of files) {
                try {
                    const { command: cmd } = await import(`../Commands/${category}/${file}`);
                    allCmds.push({
                        category,
                        name: cmd.name,
                        description: cmd.description || 'Aucune description',
                        help: cmd.help || cmd.name
                    });
                } catch (e) { continue; }
            }
        }
    }
    return allCmds;
}