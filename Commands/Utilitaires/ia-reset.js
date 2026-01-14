import { EmbedBuilder } from 'discord.js';
import { chatHistory } from "./ia.js"; 
import config from "../../config.json" with { type: 'json' };

export const command = {
    name: 'ia-reset',
    helpname: 'ia-reset',
    description: 'Réinitialise ta discussion avec l\'IA',
    help: 'ia-reset',
    run: async (bot, message, args, config) => {
        
        if (chatHistory && chatHistory.has(message.author.id)) {
            chatHistory.delete(message.author.id);
            
            const embed = new EmbedBuilder()
                .setColor(config.color)
                .setDescription("✅ **Mémoire effacée !** Ta discussion est remise à zéro.");
                
            return message.reply({ embeds: [embed] });
        } else {
            return message.reply("Tu n'as aucune discussion en cours.");
        }
    }
};