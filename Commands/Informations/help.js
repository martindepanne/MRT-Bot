import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import config from '../../config.json' with { type: 'json' };
import db from '../../Events/loadDatabase.js';
import path from "node:path";
import fs from "fs";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const categories = [
    'Informations',
    'Jeux',
    'Films',
    'Utilitaires',
    'Musique',
    'Modérations',
    'Gestions',
    'Antiraid',
    'Logs',
    'Contact',
    'Paramètres'
];

export const command = {
    name: 'help',
    helpname: 'help',
    description: "Affiche la liste complète des commandes",
    help: 'help [commande]',
    run: async (bot, message, args) => {
        if (args[0]) {
            let found = false;
            for (const category of categories) {
                const dirPath = path.join(__dirname, `../../Commands/${category}`);
                if (!fs.existsSync(dirPath)) continue;
                const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.js'));
                for (const file of files) {
                    const { command: cmdData } = await import(`../../Commands/${category}/${file}`);
                    if (cmdData.name === args[0] || (cmdData.aliases && cmdData.aliases.includes(args[0]))) {
                        const embed = new EmbedBuilder()
                            .setTitle(`Commande : ${cmdData.name}`)
                            .setDescription(cmdData.description || "Pas de description")
                            .addFields(
                                { name: 'Utilisation', value: `\`${config.prefix}${cmdData.help || cmdData.name}\`` },
                                { name: 'Alias', value: cmdData.aliases?.join(', ') || 'Aucun' }
                            )
                            .setColor(config.color)
                            .setFooter({ text: "MRT-Bot" });
                        await message.reply({ embeds: [embed] });
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            if (!found) return message.reply(`La commande \`${args[0]}\` est introuvable.`);
            return;
        }

        const categoryData = [];
        for (const category of categories) {
            const dirPath = path.join(__dirname, `../../Commands/${category}`);
            let list = [];

            if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.js'));
                for (const file of files) {
                    try {
                        const { command: cmd } = await import(`../../Commands/${category}/${file}`);
                        list.push(`**\`${config.prefix}${cmd.name}\`**\n${cmd.description || ' '}`);
                    } catch (e) { continue; }
                }
            }

            if (list.length > 0) {
                categoryData.push({
                    name: category,
                    embed: new EmbedBuilder()
                        .setTitle(`📜 Liste complète : ${category}`)
                        .setDescription(`Voici toutes les commandes de la catégorie **${category}**.\n\n${list.join('\n\n')}`)
                        .setColor(config.color)
                        .setFooter({ text: "MRT-Bot" })
                });
            }
        }

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('help_select')
                .setPlaceholder('Sélectionnez une catégorie')
                .addOptions(categoryData.map((c, i) => ({ label: c.name, value: `cat_${i}` })))
        );

        const helpMsg = await message.reply({ embeds: [categoryData[0].embed], components: [menu] });
        const collector = helpMsg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'help_select') {
                const idx = parseInt(i.values[0].split('_')[1]);
                await i.update({ embeds: [categoryData[idx].embed] });
            }
        });

        collector.on('end', () => {
            helpMsg.edit({ components: [] }).catch(() => {});
        });
    }
};