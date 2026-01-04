/* eslint-disable object-shorthand */
/* eslint-disable no-unused-vars */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import db from '../../Events/loadDatabase.js';

export const command = {
  name: 'addfilm',
  description: 'Ajoute un film à la liste',
  use: 'addfilm <nom> | <description> | <episode> | <lien> | <image> | <categorie>',
  run: async (bot, message, args, config) => {
    
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply("❌ Permission insuffisante.");
    }

    const content = args.join(" ").split("|");
    if (content.length < 6) {
      return message.reply("❌ Format: `Nom | Desc | Ep | Lien | Image | Categorie`\n**Catégories :** netflix, disney, prime-video, crunchyroll, action, horreur, comedie, anime, sf");
    }

    const film = content[0].trim();
    const description = content[1].trim();
    const episode = content[2].trim();
    const lien = content[3].trim();
    const image = content[4].trim();
    const categ = content[5].trim().toLowerCase();

    db.run(
      `INSERT INTO movies (title, url, genre, addedBy) VALUES (?, ?, ?, ?)`,
      [film, lien, categ, message.author.username],
      async (err) => {
        if (err) return message.reply("❌ Erreur SQLite.");

        const embedSuccess = new EmbedBuilder()
          .setTitle('🎬・Film Ajouté')
          .setDescription(`**Nom :** ${film}\n**Plateforme/Genre :** ${categ.toUpperCase()}`)
          .setImage(image)
          .setColor('Blurple');

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(lien).setLabel('Regarder')
        );

        await message.reply({ embeds: [embedSuccess], components: [row] });
      }
    );
  }
};