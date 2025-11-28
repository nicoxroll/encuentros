import { GoogleGenAI, Type } from "@google/genai";
import { Encounter, UserProfile, EncounterStatus, AVAILABLE_TAGS, EncounterTag } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to generate random coordinates near a center point (approx 100-200m radius)
const getRandomLocationNearby = (lat: number, lng: number): { lat: number, lng: number } => {
  const r = 0.0015; // roughly 150m
  const u = Math.random();
  const v = Math.random();
  const w = r * Math.sqrt(u);
  const t = 2 * Math.PI * v;
  const x = w * Math.cos(t);
  const y = w * Math.sin(t);
  
  // Adjust for longitude shrinking
  const xAdjusted = x / Math.cos(lat * (Math.PI / 180));
  
  return {
    lat: lat + y,
    lng: lng + xAdjusted
  };
};

const getRandomTags = (): EncounterTag[] => {
  const shuffled = [...AVAILABLE_TAGS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.floor(Math.random() * 2) + 1); // 1 or 2 tags
};

export const generateNearbyEncounters = async (lat: number, lng: number): Promise<Encounter[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate 4 fictional "Missed Connection" or "Encounter" posts for a dating app. 
      These should be romantic, fleeting moments where someone saw someone attractive but didn't speak.
      The context is a city environment.
      
      Return a JSON array of objects with the following schema:
      - title: Short catchy title (e.g., "Girl with the red scarf", "Guy reading on the bench")
      - description: A 2-sentence description of the moment.
      - name: First name of the person posting.
      - bio: Short bio of the person posting.
      - gender: "male" or "female" (for profile pic selection).
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              name: { type: Type.STRING },
              bio: { type: Type.STRING },
              gender: { type: Type.STRING }
            }
          }
        }
      }
    });

    const data = JSON.parse(response.text || "[]");

    return data.map((item: any, index: number) => {
      const isFemale = item.gender === 'female';
      const imageId = index + 10; // offset for picsum
      
      const location = getRandomLocationNearby(lat, lng);

      const userProfile: UserProfile = {
        id: `mock-user-${index}`,
        name: item.name,
        bio: item.bio,
        images: [
           `https://picsum.photos/seed/${item.name}/400/600`,
           `https://picsum.photos/seed/${item.name}2/400/600`
        ],
        isCurrentUser: false,
      };

      return {
        id: `encounter-${index}`,
        userId: userProfile.id,
        userProfile,
        title: item.title,
        description: item.description,
        location: location,
        timestamp: Date.now() - (Math.random() * 86400000), // Within last 24h
        image: `https://picsum.photos/seed/location${index}/500/300`,
        status: EncounterStatus.PENDING,
        tags: getRandomTags(),
      };
    });

  } catch (error) {
    console.error("Gemini failed to generate encounters:", error);
    return [];
  }
};

export const generateInitialMessage = async (encounterTitle: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Write a short, flirty but polite opening message for a chat in a dating app. The context is that we matched on a post titled "${encounterTitle}".`,
        });
        return response.text;
    } catch (e) {
        return "Hola! Me alegro de que nos hayamos encontrado.";
    }
}