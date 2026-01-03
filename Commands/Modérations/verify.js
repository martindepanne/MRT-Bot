import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";

export const command = {
    name: 'verify',
    run: async (bot, message, args, config) => {
        const embed = new EmbedBuilder()
            .setTitle("Configuration de la Vérification OAuth2")
            .setDescription("Cliquez sur le bouton pour configurer l'embed que verront les utilisateurs.")
            .setColor(config.color);

        const btn = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_verify_modal')
                .setLabel('Configurer l\'embed')
                .setStyle(ButtonStyle.Primary)
        );

        message.reply({ embeds: [embed], components: [btn] });
    }
};