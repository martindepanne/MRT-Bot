import { EmbedBuilder } from 'discord.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import config from "../../config.json" with { type: 'json' };

const genAI = new GoogleGenerativeAI(config.geminiKey);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash" 
});

export const chatHistory = new Map();

export const command = {
    name: 'ia',
    helpname: 'ia <votre question>',
    description: 'Discute avec une Intelligence Artificielle (Gemini)',
    help: 'ia <votre question>',
    run: async (bot, message, args, config) => {

        const question = args.join(" ");
        if (!question) return message.reply("Pose-moi une question !");

        await message.channel.sendTyping();

        try {
            if (!chatHistory.has(message.author.id)) {
                chatHistory.set(message.author.id, []);
            }
            let userHistory = chatHistory.get(message.author.id);

            const chat = model.startChat({ history: userHistory });
            const result = await chat.sendMessage(question);
            const response = await result.response;
            const text = response.text();

            userHistory.push({ role: "user", parts: [{ text: question }] });
            userHistory.push({ role: "model", parts: [{ text: text }] });

            if (userHistory.length > 10) userHistory.splice(0, 2);

            const embed = new EmbedBuilder()
                .setTitle("🤖 Assistant IA")
                .setColor(config.color)
                .setDescription(text.length > 4000 ? text.substring(0, 3997) + "..." : text)
                .setFooter({ text: "Utilise +ia-reset pour tout oublier" });

            message.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            message.reply("Désolé, j'ai eu un bug... Vérifie ma clé API.");
        }
    },
};