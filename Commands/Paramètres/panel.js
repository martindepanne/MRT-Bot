import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from "discord.js";

export const command = {
    name: 'panel',
    description: 'Affiche les accès au panel depuis le config',
    run: async (bot, message, args, config) => {
        if (!message.member.permissions.has('Administrator')) return;

        const url = config.panelURL || "Non configuré";
        const user = config.panelUser || "Non défini";
        const pass = config.panelPass || "Non défini";

        const warningEmbed = new EmbedBuilder()
            .setTitle("⚠️ Attention - Sécurité")
            .setDescription("Vous allez afficher les accès du fichier `config.json`.\n\n**Êtes-vous dans un salon privé ?**")
            .setColor("#faa61a");

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('show_panel').setLabel('Afficher').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel_panel').setLabel('Annuler').setStyle(ButtonStyle.Secondary)
        );

        const msg = await message.reply({ embeds: [warningEmbed], components: [row] });
        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) return i.reply({ content: "Refusé.", ephemeral: true });

            if (i.customId === 'show_panel') {
                const panelEmbed = new EmbedBuilder()
                    .setTitle("🖥️ Panel MRT-Bot")
                    .setColor(config.color || "#7289da")
                    .addFields(
                        { name: "🌐 URL", value: url, inline: false },
                        { name: "🔑 Utilisateur", value: `\`${user}\``, inline: true },
                        { name: "🔒 Mot de passe", value: `\`${pass}\``, inline: true }
                    );

                const linkRow = new ActionRowBuilder();
                if (url.startsWith('http')) {
                    linkRow.addComponents(new ButtonBuilder().setLabel('Ouvrir').setURL(url).setStyle(ButtonStyle.Link));
                }

                await i.update({ embeds: [panelEmbed], components: url.startsWith('http') ? [linkRow] : [] });
            } else {
                await i.update({ content: "Annulé.", embeds: [], components: [] });
            }
            collector.stop();
        });
    }
};