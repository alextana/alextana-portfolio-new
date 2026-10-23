import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.md' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		tags: z.array(z.string()).default([]),
		draft: z.boolean().default(false),
		// Posts with this field are featured as case studies in the homepage hero.
		caseStudy: z
			.object({
				order: z.number(),
				highlights: z.array(z.string()).default([]),
			})
			.optional(),
	}),
});

export const collections = { blog };
