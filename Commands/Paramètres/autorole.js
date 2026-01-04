import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import db from "../../Events/loadDatabase.js";

export const command = {
    name: 'autorole',
    description: "Configure le rôle donné automatiquement à l'arrivée d'un membre",
    use: 'autorole <@role/id/off>',
    run: async (bot, message, args, config) => {
        
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply("❌ Vous devez être administrateur.");
        }

        const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);

        if (args[0] === 'off') {
            db.run('DELETE FROM autorole WHERE guildId = ?', [message.guild.id], (err) => {
                if (err) return console.error(err);
                return message.reply("✅ L'autorole a été désactivé.");
            });
            return;
        }

        if (!role) return message.reply("❌ Veuillez mentionner un rôle ou écrire `off`.");

        db.run('INSERT OR REPLACE INTO autorole (guildId, roleId) VALUES (?, ?)', [message.guild.id, role.id], (err) => {
            if (err) return console.error(err);
            message.reply(`✅ L'autorole est maintenant configuré sur : ${role.name}`);
        });
    }
};