import { EmbedBuilder, time } from 'discord.js';
import db from '../../Events/loadDatabase.js';

export const command = {
    name: 'profile',
    description: 'Affiche votre profil et vos statistiques de jeu',
    use: 'profile [@user]',
    run: async (bot, message, args, config) => {
        const target = message.mentions.users.first() || message.author;
        
        let member;
        try {
            member = message.guild.members.cache.get(target.id) || await message.guild.members.fetch(target.id);
        } catch (e) {
            member = null;
        }

        db.get('SELECT * FROM profiles WHERE userId = ?', [target.id], async (err, row) => {
            if (err) return console.error(err);

            const userFetch = await bot.users.fetch(target.id, { force: true });
            const banner = userFetch.bannerURL({ size: 1024 });

            const createdAt = time(target.createdAt, 'R');
            const joinedAt = member ? time(member.joinedAt, 'R') : "Inconnu";
            const isUHQ = target.id === "689911388713517093" ? "✅" : "❌";
            
            const bannerStatus = banner ? `➡️ [Lien de la bannière](${banner})` : "❌ (sale pauvre)";

            const infoDescription = [
                `**Nom d'affichage :** ${target.displayName}`,
                `**Nom d'utilisateur :** ${target.username}`,
                `**ID :** ${target.id}`,
                `**UHQ :** ${isUHQ}`,
                `**Bannière :** ${bannerStatus}`,
                `**Création du compte :** ${createdAt}`,
                `**Rejoint le serveur :** ${joinedAt}`
            ].join('\n');

            if (!row) {
                if (target.id === message.author.id) {
                    db.run('INSERT INTO profiles (userId, username, displayName) VALUES (?, ?, ?)', 
                        [target.id, target.username, target.displayName], (err) => {
                            if (err) console.error("Erreur lors de l'insertion du profil:", err.message);
                        });
                }
                
                const tempEmbed = new EmbedBuilder()
                    .setAuthor({ name: `Profil de ${target.username}`, iconURL: target.displayAvatarURL() })
                    .setColor(config.color)
                    .setDescription(`${infoDescription}\n\n*Statistiques indisponibles (aucune victoire).*`)
                    .setThumbnail(target.displayAvatarURL())
                    .setFooter({ text: `Profil généré` })
                    .setTimestamp();

                if (banner) tempEmbed.setImage(banner);
                return message.reply({ embeds: [tempEmbed] });
            }

            const profileEmbed = new EmbedBuilder()
                .setAuthor({ name: `Profil de ${target.username}`, iconURL: target.displayAvatarURL() })
                .setColor(config.color)
                .setDescription(infoDescription)
                .setThumbnail(target.displayAvatarURL())
                .addFields(
                    { name: '🎮 Statistiques de Jeu', value: [
                        `🟡 **Puissance 4 :** ${row.p4_wins || 0} victoires`,
                        `❌ **Morpion :** ${row.ttt_wins || 0} victoires`,
                        `🏁 **Dames :** ${row.dames_wins || 0} victoires`
                    ].join('\n'), inline: false }
                )
                .setTimestamp();

            if (banner) profileEmbed.setImage(banner);

            message.reply({ embeds: [profileEmbed] });
        });
    }
};