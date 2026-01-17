import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const command = {
    name: 'vouch',
    description: 'Ouvre le formulaire de vouch',
    run: async (bot, message, args, config) => {
        
        const embed = new EmbedBuilder()
            .setTitle("Laisser un avis")
            .setDescription("Cliquez sur le bouton ci-dessous pour partager votre avis sur nos services !")
            .setColor(config.color);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_vouch_modal')
                .setLabel('Laisser un avis')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📝')
        );

        await message.channel.send({ embeds: [embed], components: [row] });
    }
};