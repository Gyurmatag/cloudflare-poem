import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { poems } from "./db/schema";
import { desc } from "drizzle-orm";

type Bindings = {
  [key in keyof CloudflareBindings]: CloudflareBindings[key]
}

interface WeatherResponse {
  weather: { description: string }[];
  main: { temp: number; feels_like: number };
}

const app = new Hono<{ Bindings: Bindings }>();

app.get('/current-weather-poem', async (c) => {
  const db = drizzle(c.env.DB);

  const poem = await db.select().from(poems).orderBy(desc(poems.createdDate)).limit(1);

  return c.json(poem[0]);
});

export default {
  scheduled(
      event: ScheduledEvent,
      env: Bindings,
      ctx: ExecutionContext
  ) {
    const delayedProcessing = async () => {
      await createPoem(env);
    };
    ctx.waitUntil(delayedProcessing());
  },
  fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
};

async function createPoem(env: Bindings) {
  const db = drizzle(env.DB);

  const startTime = Date.now();

  const currentWeatherInBudapestResponse = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=47.497913&lon=19.040236&appid=${env.OPENWEATHER_API_KEY}`);
  const currentWeatherInBudapest = await currentWeatherInBudapestResponse.json() as WeatherResponse;

  const aiGeneratedPoemResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    prompt: `Write a poem about the current weather in Budapest.
    Here is the weather in an object JSON: ${JSON.stringify(currentWeatherInBudapest)}.
    Please make sure to not make anything up, just write about the exact weather that is provided.
    Please note that the temperature is in Kelvin (main.temp, main.feels_like), so convert it to Celsius!
    Please only write the text of the poem, nothing else!`
  }) as { response: string }

  const imageName = generateRandomImageName();

  const aiGeneratedImageResponse = await env.AI.run(
      "@cf/stabilityai/stable-diffusion-xl-base-1.0",
      {
        prompt: `${currentWeatherInBudapest.weather[0].description} in Budapest, Hungary.`
      }
  );

  await env.BUCKET.put(imageName, aiGeneratedImageResponse);

  const poemData = {
    text: aiGeneratedPoemResponse.response,
    imgBucketName: imageName,
    createdDate: new Date().toISOString()
  };

  const [insertedPoem] = await db.insert(poems).values(poemData).returning({
    id: poems.id,
  });

  const endTime = Date.now();

  const elapsedTime = endTime - startTime;

  await env.KV.put(insertedPoem.id.toString(), elapsedTime.toString());
}

function generateRandomImageName(): string {
  return `image_${Math.random().toString(36).substring(2, 15)}`;
}
