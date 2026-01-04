/* eslint-disable no-unused-vars */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from 'discord.js';

export const command = {
  name: 'films',
  description: 'Ouvre le menu de recherche de films',
  use: 'films',
  run: async (bot, message, args, config) => {
    const embed = new EmbedBuilder()
      .setTitle("🎬 Recherche de Films")
      .setDescription("Cliquez sur le bouton ci-dessous pour rechercher un film dans notre catalogue.")
      .setColor("Blurple");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('open_recherche_modal')
        .setLabel('Rechercher un film')
        .setEmoji('🍿')
        .setStyle(ButtonStyle.Primary)
    );

    message.reply({ embeds: [embed], components: [row] });
  }
};