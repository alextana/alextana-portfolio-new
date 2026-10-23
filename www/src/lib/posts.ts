import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

/** Published posts, newest first. Drafts are only included in dev. */
export async function getPosts(): Promise<Post[]> {
	const posts = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
	return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export async function getCaseStudies(): Promise<Post[]> {
	const posts = await getPosts();
	return posts
		.filter((post) => post.data.caseStudy)
		.sort((a, b) => a.data.caseStudy!.order - b.data.caseStudy!.order);
}

export function formatDate(date: Date): string {
	return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
