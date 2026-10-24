/** Work history for the homepage, a curated subset of cv/cv.md. Newest first. */

export interface Role {
	title: string;
	/** ISO year-month, used for <time datetime>. `end` is omitted for the current role. */
	start: string;
	end?: string;
	highlights: Highlight[];
}

export interface Highlight {
	text: string;
	/** Blog post id of a related case study. Only linked when that post is published. */
	caseStudy?: string;
}

export interface Job {
	company: string;
	location: string;
	roles: Role[];
}

export const experience: Job[] = [
	{
		company: 'Amiqus',
		location: 'Brighton, UK (Remote)',
		roles: [
			{
				title: 'Senior Front-End Engineer',
				start: '2025-02',
				highlights: [
					{
						text: 'Building the company design system from scratch: 15+ production components, shipped alongside feature work.',
						caseStudy: 'building-a-design-system',
					},
					{ text: 'Led the adoption of Claude across feature teams and shaped how engineers work with AI-assisted development.' },
				],
			},
			{
				title: 'Front-End Engineer',
				start: '2023-02',
				end: '2025-02',
				highlights: [
					{
						text: 'Led the Vue 2 → Vue 3 migration of the entire app, shipped with zero issues after release.',
						caseStudy: 'vue-2-to-vue-3-migration',
					},
					{ text: 'Led the Webpack → Vite migration with the platform team, a like-for-like switch with no impact on users.' },
					{ text: 'Led accessibility remediation following an AbilityNet audit across a multi-month project.' },
				],
			},
		],
	},
	{
		company: 'BarkWeb',
		location: 'Eastbourne, UK',
		roles: [
			{
				title: 'Front-End Developer',
				start: '2021-03',
				end: '2023-02',
				highlights: [
					{ text: "Created and maintained a production Svelte UI component library for Jolojo, BarkWeb's CMS and website builder." },
					{ text: "Built BarkWeb's design system in Svelte and Tailwind CSS." },
					{ text: "Built the front end of BarkWeb's auction platform." },
				],
			},
		],
	},
	{
		company: 'Bluesky Interactive',
		location: 'Haywards Heath, UK',
		roles: [
			{
				title: 'Front-End Developer',
				start: '2018-11',
				end: '2021-03',
				highlights: [
					{ text: 'Built and maintained websites for car dealerships using HTML, CSS, JavaScript and VB.NET.' },
					{ text: "Converted parts of the platform's UX to Vue and rewrote jQuery code in vanilla JavaScript." },
				],
			},
		],
	},
];
