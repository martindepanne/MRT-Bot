import { ActivityType, Events } from "discord.js";

export default {
    // Utiliser la constante au lieu de la chaîne de caractères
    name: Events.ClientReady, 
    once: true, // L'événement ready ne doit s'exécuter qu'une seule fois
    async execute(bot) {
        // Enregistrement des slash commands
        if (bot.arrayOfSlashCommands) {
            await bot.application.commands.set(bot.arrayOfSlashCommands);
        }

        // Configuration de la présence
        bot.user.setPresence({
            activities: [{ 
                name: 'MRT-Bot', 
                type: ActivityType.Streaming, 
                url: 'https://twitch.tv/martindepanne' 
            }], 
            status: 'online'
        });
        
        console.log(`[READY] ${bot.user.tag} est opérationnel.`);
    }
};